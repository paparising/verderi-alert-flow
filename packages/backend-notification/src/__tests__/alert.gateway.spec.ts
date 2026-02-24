import { Test, TestingModule } from '@nestjs/testing';
import { AlertGateway } from '../alert.gateway';
import { Server, Socket } from 'socket.io';

describe('AlertGateway', () => {
  let gateway: AlertGateway;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertGateway],
    }).compile();

    gateway = module.get<AlertGateway>(AlertGateway);
    // Inject mock server
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const mockClient = { id: 'client-123' } as Socket;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      gateway.handleConnection(mockClient);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client connected: client-123'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client from org rooms on disconnect', () => {
      const mockClient = {
        id: 'client-123',
        join: jest.fn(),
        leave: jest.fn(),
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
        join: jest.fn(),
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
        join: jest.fn(),
      } as unknown as Socket;

      gateway.handleJoinOrg(mockClient, 'org-456');

      expect((gateway as any).orgRooms.get('org-456').has('client-123')).toBe(true);
    });
  });

  describe('handleLeaveOrg', () => {
    it('should remove client from org room', () => {
      const mockClient = {
        id: 'client-123',
        join: jest.fn(),
        leave: jest.fn(),
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
