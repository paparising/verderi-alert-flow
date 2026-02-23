import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export interface Alert {
  id: string;
  orgId: string;
  alertId: string;
  alertContext: string;
  status: 'New' | 'Acknowledged' | 'Resolved';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface AlertEvent {
  id: string;
  orgId: string;
  eventId: string;
  eventData: {
    alertId: string;
    previousStatus?: string;
    newStatus?: string;
    changedAt: string;
  };
  createdAt: string;
  createdBy: string;
}

interface UseAlertSocketProps {
  orgId: string;
  onNewAlert?: (alert: Alert) => void;
  onAlertStatusUpdate?: (alert: Alert) => void;
  onAlertEvent?: (event: AlertEvent) => void;
}

export const useAlertSocket = ({
  orgId,
  onNewAlert,
  onAlertStatusUpdate,
  onAlertEvent,
}: UseAlertSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Join organization room
      socket.emit('joinOrg', orgId, (response: any) => {
        console.log('Joined org response:', response);
      });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    // Listen for new alerts
    socket.on('newAlert', (alert: Alert) => {
      console.log('New alert received:', alert);
      onNewAlert?.(alert);
    });

    // Listen for alert status updates
    socket.on('alertStatusUpdate', (alert: Alert) => {
      console.log('Alert status updated:', alert);
      onAlertStatusUpdate?.(alert);
    });

    // Listen for alert events
    socket.on('alertEvent', (event: AlertEvent) => {
      console.log('Alert event received:', event);
      onAlertEvent?.(event);
    });

    return () => {
      if (socket) {
        socket.emit('leaveOrg', orgId);
        socket.disconnect();
      }
    };
  }, [orgId, onNewAlert, onAlertStatusUpdate, onAlertEvent]);

  return {
    socket: socketRef.current,
    isConnected,
  };
};
