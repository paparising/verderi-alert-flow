import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPersistenceService } from '../persistence.service';
import { AlertEvent, ProcessedEvent, ProcessingStatus } from '@videri/shared';

describe('EventPersistenceService', () => {
  let service: EventPersistenceService;
  let alertEventRepo: jest.Mocked<Repository<AlertEvent>>;
  let processedEventRepo: jest.Mocked<Repository<ProcessedEvent>>;
  let configService: jest.Mocked<ConfigService>;

  const mockAlertEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockProcessedEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultVal: string) => defaultVal),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPersistenceService,
        {
          provide: getRepositoryToken(AlertEvent),
          useValue: mockAlertEventRepo,
        },
        {
          provide: getRepositoryToken(ProcessedEvent),
          useValue: mockProcessedEventRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EventPersistenceService>(EventPersistenceService);
    alertEventRepo = module.get(getRepositoryToken(AlertEvent));
    processedEventRepo = module.get(getRepositoryToken(ProcessedEvent));
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    // Kafka message with eventData fields spread at top level
    const kafkaEventData = {
      orgId: 'org-123',
      alertId: 'alert-789',
      eventId: 'event-456',
      eventType: 'ALERT_STATUS_CHANGED',
      newStatus: 'Acknowledged',
      previousStatus: 'New',
      changedAt: '2026-02-27T00:00:00.000Z',
      createdBy: 'user-001',
      createdAt: '2026-02-27T00:00:00.000Z',
    };

    const reconstructedEventData = {
      eventType: 'ALERT_STATUS_CHANGED',
      newStatus: 'Acknowledged',
      previousStatus: 'New',
      changedAt: '2026-02-27T00:00:00.000Z',
    };

    const mockProcessedEvent = {
      id: 'proc-1',
      eventId: 'event-456',
      status: ProcessingStatus.PROCESSING,
      createdAt: new Date(),
    };

    it('should save alert event with properly reconstructed eventData', async () => {
      mockProcessedEventRepo.findOne.mockResolvedValue(null);
      mockProcessedEventRepo.create.mockReturnValue(mockProcessedEvent as any);
      mockProcessedEventRepo.save.mockResolvedValue(mockProcessedEvent as any);
      mockAlertEventRepo.create.mockReturnValue({
        ...kafkaEventData,
        eventData: reconstructedEventData,
      } as any);
      mockAlertEventRepo.save.mockResolvedValue({
        ...kafkaEventData,
        eventData: reconstructedEventData,
      } as any);

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(kafkaEventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      // Should check for existing processed event
      expect(mockProcessedEventRepo.findOne).toHaveBeenCalledWith({
        where: { eventId: kafkaEventData.eventId },
      });

      // Should create processed event record for idempotency
      expect(mockProcessedEventRepo.create).toHaveBeenCalledWith({
        eventId: kafkaEventData.eventId,
        status: ProcessingStatus.PROCESSING,
      });

      // Should extract eventData from flattened Kafka message
      // Should save alert event with properly reconstructed eventData
      expect(mockAlertEventRepo.create).toHaveBeenCalledWith({
        orgId: 'org-123',
        alertId: 'alert-789',
        eventId: 'event-456',
        eventData: expect.objectContaining({
          eventType: 'ALERT_STATUS_CHANGED',
          newStatus: 'Acknowledged',
          previousStatus: 'New',
        }),
        createdBy: 'user-001',
      });
      expect(mockAlertEventRepo.save).toHaveBeenCalled();

      // Should mark processed event as completed
      expect(mockProcessedEventRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should skip already processed events (idempotency)', async () => {
      const existingProcessedEvent = {
        ...mockProcessedEvent,
        status: ProcessingStatus.COMPLETED,
      };
      mockProcessedEventRepo.findOne.mockResolvedValue(existingProcessedEvent as any);

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(kafkaEventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      // Should check for existing processed event
      expect(mockProcessedEventRepo.findOne).toHaveBeenCalledWith({
        where: { eventId: kafkaEventData.eventId },
      });

      // Should NOT create new processed event or save alert event
      expect(mockProcessedEventRepo.create).not.toHaveBeenCalled();
      expect(mockAlertEventRepo.create).not.toHaveBeenCalled();
      expect(mockAlertEventRepo.save).not.toHaveBeenCalled();
    });

    it('should skip event when another consumer is processing (unique constraint violation)', async () => {
      mockProcessedEventRepo.findOne.mockResolvedValue(null);
      mockProcessedEventRepo.create.mockReturnValue(mockProcessedEvent as any);
      mockProcessedEventRepo.save.mockRejectedValueOnce({ code: '23505' }); // Unique constraint violation

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(kafkaEventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      // Should not save alert event when another consumer claimed it
      expect(mockAlertEventRepo.create).not.toHaveBeenCalled();
      expect(mockAlertEventRepo.save).not.toHaveBeenCalled();
    });

    it('should mark event as failed when processing error occurs', async () => {
      mockProcessedEventRepo.findOne.mockResolvedValue(null);
      mockProcessedEventRepo.create.mockReturnValue(mockProcessedEvent as any);
      mockProcessedEventRepo.save.mockResolvedValue(mockProcessedEvent as any);
      mockAlertEventRepo.create.mockReturnValue({
        ...kafkaEventData,
        eventData: reconstructedEventData,
      } as any);
      mockAlertEventRepo.save.mockRejectedValueOnce(new Error('Database error'));

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(kafkaEventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      // Should mark as failed with error message
      expect(mockProcessedEventRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: ProcessingStatus.FAILED,
          errorMessage: expect.stringContaining('Database error'),
        }),
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from('invalid-json'),
        },
      };

      // Should not throw, just log error
      await expect(
        (service as any).handleMessage(mockPayload),
      ).resolves.not.toThrow();
    });

    it('should handle empty message value', async () => {
      mockProcessedEventRepo.findOne.mockResolvedValue(null);
      
      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: null,
        },
      };

      // Should not throw, just use empty object
      await expect(
        (service as any).handleMessage(mockPayload),
      ).resolves.not.toThrow();
    });
  });
});
