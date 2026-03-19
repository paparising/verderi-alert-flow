import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AlertEventProcessorService } from '../alert-event-processor.service';
import { AlertEvent, ProcessedEvent, ProcessingStatus } from '@videri/shared';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import type { Mocked } from 'vitest';

describe('AlertEventProcessorService', () => {
  let service: AlertEventProcessorService;
  let alertEventRepo: Mocked<Repository<AlertEvent>>;
  let processedEventRepo: Mocked<Repository<ProcessedEvent>>;
  let kafkaProducer: Mocked<KafkaProducerService>;
  let configService: Mocked<ConfigService>;
  let dataSource: Mocked<DataSource>;
  let queryRunner: any;

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
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        create: vi.fn(),
        save: vi.fn(),
        update: vi.fn(),
      },
    };

    const mockAlertEventRepo = {
      find: vi.fn(),
      count: vi.fn(),
    };

    const mockProcessedEventRepo = {
      findOne: vi.fn(),
      count: vi.fn(),
    };

    const mockKafka = {
      sendAlertEvent: vi.fn(),
    };

    const mockConfig = {
      get: vi.fn().mockReturnValue(1000), // Default 1000ms
    };

    const mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunner),
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
    vi.clearAllMocks();
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
      const unpublishedEvent = { ...mockAlertEvent };
      alertEventRepo.find.mockResolvedValue([unpublishedEvent] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null); // Not yet processed
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);
      queryRunner.manager.create.mockReturnValue({ eventId: 'event-uuid', status: ProcessingStatus.PROCESSING });

      await service.processEvents();

      expect(alertEventRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
        take: 100,
      });
      expect(processedEventRepo.findOne).toHaveBeenCalledWith({
        where: { eventId: 'event-uuid' },
      });
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledWith(
        'alert-events',
        expect.objectContaining({
          orgId: 'org-123',
          alertId: 'alert-123',
          eventId: 'event-uuid',
          createdBy: 'user-123',
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should skip already published events (based on ProcessedEvent status)', async () => {
      const event = { ...mockAlertEvent };
      alertEventRepo.find.mockResolvedValue([event] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue({
        eventId: 'event-uuid',
        status: ProcessingStatus.COMPLETED,
      } as ProcessedEvent);

      await service.processEvents();

      expect(kafkaProducer.sendAlertEvent).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should handle multiple unpublished events', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1' };
      const event2 = { ...mockAlertEvent, eventId: 'event-2' };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);
      queryRunner.manager.create.mockReturnValue({ status: ProcessingStatus.PROCESSING });

      await service.processEvents();

      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
    });

    it('should not process if already processing', async () => {
      service['isProcessing'] = true;
      alertEventRepo.find.mockResolvedValue([]);

      await service.processEvents();

      expect(alertEventRepo.find).not.toHaveBeenCalled();
    });

    it('should rollback transaction if Kafka fails', async () => {
      const unpublishedEvent = { ...mockAlertEvent };
      alertEventRepo.find.mockResolvedValue([unpublishedEvent] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockRejectedValue(new Error('Kafka error'));
      queryRunner.manager.create.mockReturnValue({ status: ProcessingStatus.PROCESSING });

      await service.processEvents();

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should return early if no events', async () => {
      alertEventRepo.find.mockResolvedValue([]);

      await service.processEvents();

      expect(kafkaProducer.sendAlertEvent).not.toHaveBeenCalled();
    });
  });

  describe('getUnpublishedEventCount', () => {
    it('should return count of events not yet completed in ProcessedEvent', async () => {
      alertEventRepo.count.mockResolvedValue(10);
      processedEventRepo.count.mockResolvedValue(5);

      const count = await service.getUnpublishedEventCount();

      expect(count).toBe(5); // 10 total - 5 completed
      expect(alertEventRepo.count).toHaveBeenCalled();
      expect(processedEventRepo.count).toHaveBeenCalledWith({
        where: { status: ProcessingStatus.COMPLETED },
      });
    });
  });

  describe('getUnpublishedEventsByAlert', () => {
    it('should return unpublished events for a specific alert (not in ProcessedEvent with COMPLETED)', async () => {
      const events = [mockAlertEvent] as AlertEvent[];
      alertEventRepo.find.mockResolvedValue(events);
      processedEventRepo.findOne.mockResolvedValue(null); // Not completed

      const result = await service.getUnpublishedEventsByAlert('alert-123', 'org-123');

      expect(alertEventRepo.find).toHaveBeenCalledWith({
        where: {
          alertId: 'alert-123',
          orgId: 'org-123',
        },
        order: { createdAt: 'ASC' },
      });
      expect(result.length).toBe(1);
    });

    it('should filter out completed events from ProcessedEvent table', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1' };
      const event2 = { ...mockAlertEvent, eventId: 'event-2' };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne
        .mockResolvedValueOnce({ eventId: 'event-1', status: ProcessingStatus.COMPLETED } as ProcessedEvent)
        .mockResolvedValueOnce(null);

      const result = await service.getUnpublishedEventsByAlert('alert-123', 'org-123');

      expect(result.length).toBe(1);
      expect(result[0].eventId).toBe('event-2');
    });
  });

  describe('manuallyProcessEvents', () => {
    it('should process all unpublished events and return count', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1' };
      const event2 = { ...mockAlertEvent, eventId: 'event-2' };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent.mockResolvedValue(undefined);
      queryRunner.manager.create.mockReturnValue({ status: ProcessingStatus.PROCESSING });

      const processedCount = await service.manuallyProcessEvents();

      expect(processedCount).toBe(2);
      expect(kafkaProducer.sendAlertEvent).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
    });

    it('should skip already completed events', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1' };
      alertEventRepo.find.mockResolvedValue([event1] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue({
        eventId: 'event-1',
        status: ProcessingStatus.COMPLETED,
      } as ProcessedEvent);

      const processedCount = await service.manuallyProcessEvents();

      expect(processedCount).toBe(0);
      expect(kafkaProducer.sendAlertEvent).not.toHaveBeenCalled();
    });

    it('should handle partial failures and return processed count', async () => {
      const event1 = { ...mockAlertEvent, eventId: 'event-1' };
      const event2 = { ...mockAlertEvent, eventId: 'event-2' };
      alertEventRepo.find.mockResolvedValue([event1, event2] as AlertEvent[]);
      processedEventRepo.findOne.mockResolvedValue(null);
      kafkaProducer.sendAlertEvent
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Kafka error'));
      queryRunner.manager.create.mockReturnValue({ status: ProcessingStatus.PROCESSING });

      const processedCount = await service.manuallyProcessEvents();

      expect(processedCount).toBe(1); // Only first event processed
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('module lifecycle', () => {
    it('should initialize and destroy properly', () => {
      const destroySpy = vi.spyOn(service, 'onModuleDestroy');

      service.onModuleInit();
      service.onModuleDestroy();

      expect(destroySpy).toHaveBeenCalled();
      destroySpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear processing interval on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      service['processingInterval'] = setInterval(() => {}, 1000);

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});



