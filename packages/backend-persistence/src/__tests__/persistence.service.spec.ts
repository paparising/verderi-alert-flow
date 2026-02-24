import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPersistenceService } from '../persistence.service';
import { AlertEvent } from '@vederi/shared';

describe('EventPersistenceService', () => {
  let service: EventPersistenceService;
  let alertEventRepo: jest.Mocked<Repository<AlertEvent>>;
  let configService: jest.Mocked<ConfigService>;

  const mockAlertEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
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
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EventPersistenceService>(EventPersistenceService);
    alertEventRepo = module.get(getRepositoryToken(AlertEvent));
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('should save alert event to database', async () => {
      const eventData = {
        orgId: 'org-123',
        eventId: 'event-456',
        eventData: { type: 'alert_created', alertId: 'alert-789' },
        createdBy: 'user-001',
      };

      const mockEvent = {
        id: 1,
        ...eventData,
        createdAt: new Date(),
      };

      mockAlertEventRepo.create.mockReturnValue(mockEvent as any);
      mockAlertEventRepo.save.mockResolvedValue(mockEvent as any);

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(eventData)),
        },
      };

      // Call private method via reflection
      await (service as any).handleMessage(mockPayload);

      expect(mockAlertEventRepo.create).toHaveBeenCalledWith({
        orgId: eventData.orgId,
        eventId: eventData.eventId,
        eventData: eventData.eventData,
        createdBy: eventData.createdBy,
      });
      expect(mockAlertEventRepo.save).toHaveBeenCalledWith(mockEvent);
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
