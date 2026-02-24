import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AlertGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly orgRooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    console.log(`[Alert Gateway] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Alert Gateway] Client disconnected: ${client.id}`);
    // Clean up org rooms
    this.orgRooms.forEach((clients, orgId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.orgRooms.delete(orgId);
      }
    });
  }

  @SubscribeMessage('joinOrg')
  handleJoinOrg(client: Socket, orgId: string) {
    client.join(`org:${orgId}`);
    
    if (!this.orgRooms.has(orgId)) {
      this.orgRooms.set(orgId, new Set());
    }
    this.orgRooms.get(orgId)!.add(client.id);
    
    console.log(`[Alert Gateway] Client ${client.id} joined org: ${orgId}`);
    return { success: true, message: `Joined organization ${orgId}` };
  }

  @SubscribeMessage('leaveOrg')
  handleLeaveOrg(client: Socket, orgId: string) {
    client.leave(`org:${orgId}`);
    
    const clients = this.orgRooms.get(orgId);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.orgRooms.delete(orgId);
      }
    }
    
    console.log(`[Alert Gateway] Client ${client.id} left org: ${orgId}`);
    return { success: true, message: `Left organization ${orgId}` };
  }

  // Emit new alert to all clients in the organization
  emitNewAlert(orgId: string, alert: any) {
    this.server.to(`org:${orgId}`).emit('newAlert', alert);
  }

  // Emit alert status update to all clients in the organization
  emitAlertStatusUpdate(orgId: string, alert: any) {
    this.server.to(`org:${orgId}`).emit('alertStatusUpdate', alert);
  }

  // Emit alert event to all clients in the organization
  emitAlertEvent(orgId: string, event: any) {
    this.server.to(`org:${orgId}`).emit('alertEvent', event);
  }
}
