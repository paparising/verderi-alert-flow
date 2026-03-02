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
    it('should route ALERT_CREATED to emitNewAlert', async () => {
      const eventData = {
        orgId: 'org-123',
        alertId: 'alert-789',
        eventId: 'event-456',
        eventType: 'ALERT_CREATED',
        alertContext: 'Test alert',
        status: 'New',
        createdAt: '2026-02-27T00:00:00.000Z',
        createdBy: 'user-001',
      };

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(eventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      expect(mockAlertGateway.emitNewAlert).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({
          id: 'alert-789',
          alertContext: 'Test alert',
          status: 'New',
          orgId: 'org-123',
        }),
      );
    });

    it('should route ALERT_STATUS_CHANGED to emitAlertStatusUpdate', async () => {
      const eventData = {
        orgId: 'org-123',
        alertId: 'alert-789',
        eventId: 'event-456',
        eventType: 'ALERT_STATUS_CHANGED',
        previousStatus: 'New',
        newStatus: 'Acknowledged',
        changedAt: '2026-02-27T00:00:00.000Z',
        createdBy: 'user-001',
      };

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(eventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      expect(mockAlertGateway.emitAlertStatusUpdate).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({
          id: 'alert-789',
          previousStatus: 'New',
          status: 'Acknowledged',
        }),
      );
    });

    it('should route ALERT_CONTEXT_CHANGED to emitAlertEvent', async () => {
      const eventData = {
        orgId: 'org-123',
        alertId: 'alert-789',
        eventId: 'event-456',
        eventType: 'ALERT_CONTEXT_CHANGED',
        alertContext: 'Updated context',
        changedAt: '2026-02-27T00:00:00.000Z',
        createdBy: 'user-001',
      };

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(eventData)),
        },
      };

      await (service as any).handleMessage(mockPayload);

      expect(mockAlertGateway.emitAlertEvent).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({
          id: 'alert-789',
          alertContext: 'Updated context',
          changedAt: '2026-02-27T00:00:00.000Z',
        }),
      );
    });

    it('should route unknown event types to emitAlertEvent', async () => {
      const eventData = {
        orgId: 'org-123',
        alertId: 'alert-789',
        eventId: 'event-456',
        eventType: 'CUSTOM_EVENT',
        type: 'custom',
        createdBy: 'user-001',
      };

      const mockPayload = {
        topic: 'alert-events',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(eventData)),
        },
      };

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
