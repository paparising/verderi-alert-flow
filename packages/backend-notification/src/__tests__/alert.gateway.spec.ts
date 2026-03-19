import { Test, TestingModule } from '@nestjs/testing';
import { AlertGateway } from '../alert.gateway';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
import type { Mocked } from 'vitest';

describe('AlertGateway', () => {
  let gateway: AlertGateway;
  let wsAuthService: Mocked<WsAuthService>;

  const mockServer = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };

  beforeEach(async () => {
    const mockWsAuthService = {
      authenticateClient: vi.fn().mockResolvedValue({
        userId: 'user-123',
        orgId: 'org-456',
        roles: ['user'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertGateway,
        {
          provide: WsAuthService,
          useValue: mockWsAuthService,
        },
      ],
    }).compile();

    gateway = module.get<AlertGateway>(AlertGateway);
    wsAuthService = module.get(WsAuthService);
    // Inject mock server
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate and log client connection', async () => {
      const mockClient = { id: 'client-123' } as Socket;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await gateway.handleConnection(mockClient);

      expect(wsAuthService.authenticateClient).toHaveBeenCalledWith(mockClient);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client connected: client-123'),
      );
      consoleSpy.mockRestore();
    });

    it('should disconnect unauthenticated client', async () => {
      const mockClient = {
        id: 'client-unauth',
        disconnect: vi.fn(),
      } as unknown as Socket;
      wsAuthService.authenticateClient.mockRejectedValue(new Error('invalid token'));

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client from org rooms on disconnect', () => {
      const mockClient = {
        id: 'client-123',
        join: vi.fn(),
        leave: vi.fn(),
        data: {
          user: {
            userId: 'user-123',
            orgId: 'org-456',
            roles: ['user'],
          },
        },
      } as unknown as Socket;

      // First join an org
      gateway.handleJoinOrg(mockClient, 'org-456');

      // Then disconnect
      gateway.handleDisconnect(mockClient);

      // Room should be cleaned up (no clients left)
      expect((gateway as any).orgRooms.has('org-456')).toBe(false);
    });
  });

  describe('handleJoinOrg', () => {
    it('should add client to org room', () => {
      const mockClient = {
        id: 'client-123',
        join: vi.fn(),
        data: {
          user: {
            userId: 'user-123',
            orgId: 'org-456',
            roles: ['user'],
          },
        },
      } as unknown as Socket;

      const result = gateway.handleJoinOrg(mockClient, 'org-456');

      expect(mockClient.join).toHaveBeenCalledWith('org:org-456');
      expect(result).toEqual({
        success: true,
        message: 'Joined organization org-456',
      });
    });

    it('should track client in orgRooms map', () => {
      const mockClient = {
        id: 'client-123',
        join: vi.fn(),
        data: {
          user: {
            userId: 'user-123',
            orgId: 'org-456',
            roles: ['user'],
          },
        },
      } as unknown as Socket;

      gateway.handleJoinOrg(mockClient, 'org-456');

      expect((gateway as any).orgRooms.get('org-456').has('client-123')).toBe(true);
    });
    it('should reject join when user org differs from requested org', () => {
      const mockClient = {
        id: 'client-123',
        join: vi.fn(),
        data: {
          user: {
            userId: 'user-123',
            orgId: 'org-456',
            roles: ['user'],
          },
        },
      } as unknown as Socket;

      const result = gateway.handleJoinOrg(mockClient, 'org-other');

      expect(result).toEqual({
        success: false,
        message: 'Forbidden organization access',
      });
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveOrg', () => {
    it('should remove client from org room', () => {
      const mockClient = {
        id: 'client-123',
        join: vi.fn(),
        leave: vi.fn(),
        data: {
          user: {
            userId: 'user-123',
            orgId: 'org-456',
            roles: ['user'],
          },
        },
      } as unknown as Socket;

      // First join
      gateway.handleJoinOrg(mockClient, 'org-456');

      // Then leave
      const result = gateway.handleLeaveOrg(mockClient, 'org-456');

      expect(mockClient.leave).toHaveBeenCalledWith('org:org-456');
      expect(result).toEqual({
        success: true,
        message: 'Left organization org-456',
      });
    });
  });

  describe('emitNewAlert', () => {
    it('should emit newAlert event to org room', () => {
      const alert = { id: 'alert-123', title: 'Test Alert' };

      gateway.emitNewAlert('org-456', alert);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-456');
      expect(mockServer.emit).toHaveBeenCalledWith('newAlert', alert);
    });
  });

  describe('emitAlertStatusUpdate', () => {
    it('should emit alertStatusUpdate event to org room', () => {
      const alert = { id: 'alert-123', status: 'resolved' };

      gateway.emitAlertStatusUpdate('org-456', alert);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-456');
      expect(mockServer.emit).toHaveBeenCalledWith('alertStatusUpdate', alert);
    });
  });

  describe('emitAlertEvent', () => {
    it('should emit alertEvent to org room', () => {
      const event = { eventId: 'event-123', type: 'alert_created' };

      gateway.emitAlertEvent('org-456', event);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-456');
      expect(mockServer.emit).toHaveBeenCalledWith('alertEvent', event);
    });
  });
});



