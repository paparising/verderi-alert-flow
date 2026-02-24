import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventNotificationService } from '../notification.service';
import { AlertGateway } from '../alert.gateway';

describe('EventNotificationService', () => {
  let service: EventNotificationService;
  let alertGateway: jest.Mocked<AlertGateway>;
  let configService: jest.Mocked<ConfigService>;

  const mockAlertGateway = {
    emitAlertEvent: jest.fn(),
    emitNewAlert: jest.fn(),
    emitAlertStatusUpdate: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultVal: string) => defaultVal),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventNotificationService,
        {
          provide: AlertGateway,
          useValue: mockAlertGateway,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EventNotificationService>(EventNotificationService);
    alertGateway = module.get(AlertGateway);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('should emit alert event via websocket', async () => {
      const eventData = {
        orgId: 'org-123',
        eventId: 'event-456',
        eventData: { type: 'alert_created', alertId: 'alert-789' },
        createdBy: 'user-001',
      };

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(eventData)),
        },
      };

      // Call private method via reflection
      await (service as any).handleMessage(mockPayload);

      expect(mockAlertGateway.emitAlertEvent).toHaveBeenCalledWith(
        eventData.orgId,
        eventData,
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
