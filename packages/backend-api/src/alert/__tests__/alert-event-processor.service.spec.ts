import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AlertEventProcessorService } from '../alert-event-processor.service';
import { AlertEvent, ProcessedEvent } from '@videri/shared';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';

describe('AlertEventProcessorService', () => {
  let service: AlertEventProcessorService;
  let alertEventRepo: jest.Mocked<Repository<AlertEvent>>;
  let processedEventRepo: jest.Mocked<Repository<ProcessedEvent>>;
  let kafkaProducer: jest.Mocked<KafkaProducerService>;
  let configService: jest.Mocked<ConfigService>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: any;
  let transactionManager: any;

  const mockAlertEvent: Partial<AlertEvent> = {
    id: 'event-123',
    orgId: 'org-123',
    alertId: 'alert-123',
    eventId: 'event-uuid',
    eventData: {
      eventType: 'ALERT_CREATED',
      alertContext: 'Test alert',
      status: 'NEW',
    },
    createdAt: new Date(),
    createdBy: 'user-123',
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        update: jest.fn(),
      },
    };

    transactionManager = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((_entity: any, payload: any) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const mockAlertEventRepo = {
      find: jest.fn(),
      count: jest.fn(),
    };

    const mockProcessedEventRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const mockKafka = {
      sendAlertEvent: jest.fn(),
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue(1000), // Default 1000ms
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      transaction: jest.fn().mockImplementation(async (cb: (manager: any) => Promise<void>) => {
        return cb(transactionManager as unknown as any);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEventProcessorService,
        { provide: getRepositoryToken(AlertEvent), useValue: mockAlertEventRepo },
        { provide: getRepositoryToken(ProcessedEvent), useValue: mockProcessedEventRepo },
        { provide: KafkaProducerService, useValue: mockKafka },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AlertEventProcessorService>(AlertEventProcessorService);
    alertEventRepo = module.get(getRepositoryToken(AlertEvent));
    processedEventRepo = module.get(getRepositoryToken(ProcessedEvent));
    kafkaProducer = module.get(KafkaProducerService);
    configService = module.get(ConfigService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should read polling interval from ConfigService with default 1000ms', () => {
      expect(configService.get).toHaveBeenCalledWith('ALERT_EVENT_POLLING_INTERVAL_MS', 1000);
    });
  });

  describe('processEvents', () => {
    it('should fetch unpublished events and publish to Kafka with ProcessedEvent tracking', async () => {
      const unpublishedEvent = { ...mockAlertEvent, published: false, publishAttempts: 0 };
      alertEventRepo.find.mockResolvedValue([unpublishedEvent] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);
      await service.processEvents();

      expect(alertEventRepo.find).toHaveBeenCalledWith({
        where: { published: false },
        order: { createdAt: 'ASC' },
        take: 100,
      });
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(transactionManager.update).toHaveBeenCalledWith(
        AlertEvent,
        { id: unpublishedEvent.id },
        expect.objectContaining({
          published: true,
          publishAttempts: 1,
          lastPublishError: null,
        }),
      );
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledWith(
        'alert-events',
        expect.objectContaining({
          orgId: 'org-123',
          alertId: 'alert-123',
          eventId: 'event-uuid',
          createdBy: 'user-123',
        }),
      );
      expect(transactionManager.save).toHaveBeenCalled();
    });

    it('should skip already published events (based on published flag)', async () => {
      // Query for published=false returns no events
      alertEventRepo.find.mockResolvedValue([]);

      await service.processEvents();

      expect(alertEventRepo.find).toHaveBeenCalledWith({
        where: { published: false },
        order: { createdAt: 'ASC' },
        take: 100,
      });
      expect(kafkaProducer.sendAlertEvent).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should handle multiple unpublished events', async () => {
      const event1 = { ...mockAlertEvent, id: 'id-1', eventId: 'event-1', published: false, publishAttempts: 0 };
      const event2 = { ...mockAlertEvent, id: 'id-2', eventId: 'event-2', published: false, publishAttempts: 0 };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);
      await service.processEvents();

      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledTimes(2);
      expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    });

    it('should not process if already processing', async () => {
      service['isProcessing'] = true;
      alertEventRepo.find.mockResolvedValue([]);

      await service.processEvents();

      expect(alertEventRepo.find).not.toHaveBeenCalled();
    });

    it('should rollback transaction if Kafka fails', async () => {
      const unpublishedEvent = { ...mockAlertEvent, publishAttempts: 0 };
      alertEventRepo.find.mockResolvedValue([unpublishedEvent] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockRejectedValue(new Error('Kafka error'));

      await service.processEvents();

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        AlertEvent,
        { id: unpublishedEvent.id },
        expect.objectContaining({
          publishAttempts: 1,
          lastPublishError: 'Kafka error',
        }),
      );
    });

    it('should return early if no events', async () => {
      alertEventRepo.find.mockResolvedValue([]);

      await service.processEvents();

      expect(kafkaProducer.sendAlertEvent).not.toHaveBeenCalled();
    });
  });

  describe('getUnpublishedEventCount', () => {
    it('should return count of unpublished events using published flag', async () => {
      alertEventRepo.count.mockResolvedValue(5);

      const count = await service.getUnpublishedEventCount();

      expect(count).toBe(5);
      expect(alertEventRepo.count).toHaveBeenCalledWith({
        where: { published: false },
      });
    });
  });

  describe('getUnpublishedEventsByAlert', () => {
    it('should return unpublished events for a specific alert using published flag', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1', published: false };
      const event2 = { ...mockAlertEvent, eventId: 'event-2', published: false };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);

      const result = await service.getUnpublishedEventsByAlert('alert-123', 'org-123');

      expect(alertEventRepo.find).toHaveBeenCalledWith({
        where: {
          alertId: 'alert-123',
          orgId: 'org-123',
          published: false,
        },
        order: { createdAt: 'ASC' },
      });
      expect(result.length).toBe(2);
    });

    it('should only return events with published=false', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1', published: false };
      const event2 = { ...mockAlertEvent, eventId: 'event-2', published: false };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);

      const result = await service.getUnpublishedEventsByAlert('alert-123', 'org-123');

      expect(result.length).toBe(2);
      expect(result[0].eventId).toBe('event-1');
      expect(result[1].eventId).toBe('event-2');
    });
  });

  describe('manuallyProcessEvents', () => {
    it('should process all unpublished events and return count', async () => {
      const event1 = { ...mockAlertEvent, id: 'id-1', eventId: 'event-1', published: false, publishAttempts: 0 };
      const event2 = { ...mockAlertEvent, id: 'id-2', eventId: 'event-2', published: false, publishAttempts: 0 };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);
      const processedCount = await service.manuallyProcessEvents();

      expect(processedCount).toBe(2);
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledTimes(2);
      expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    });

    it('should only process unpublished events', async () => {
      // Mock returns only unpublished events
      alertEventRepo.find.mockResolvedValue([]);

      const processedCount = await service.manuallyProcessEvents();

      expect(processedCount).toBe(0);
      expect(alertEventRepo.find).toHaveBeenCalledWith({
        where: { published: false },
        order: { createdAt: 'ASC' },
      });
      expect(kafkaProducer.sendAlertEvent).not.toHaveBeenCalled();
    });

    it('should handle partial failures and return processed count', async () => {
      const event1 = { ...mockAlertEvent, id: 'id-1', eventId: 'event-1', published: false, publishAttempts: 0 };
      const event2 = { ...mockAlertEvent, id: 'id-2', eventId: 'event-2', published: false, publishAttempts: 0 };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Kafka error'));
      const processedCount = await service.manuallyProcessEvents();

      expect(processedCount).toBe(1); // Only first event processed
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('module lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should initialize and destroy properly', () => {
      const destroySpy = jest.spyOn(service, 'onModuleDestroy');

      service.onModuleInit();
      jest.runOnlyPendingTimers();
      service.onModuleDestroy();

      expect(destroySpy).toHaveBeenCalled();
      destroySpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear processing interval on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      service['processingInterval'] = setInterval(() => {}, 1000);

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
