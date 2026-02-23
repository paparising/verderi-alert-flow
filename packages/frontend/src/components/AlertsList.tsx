import React, { useState, useCallback } from 'react';
import { useAlertSocket, Alert } from '../hooks/useAlertSocket';
import './AlertsList.css';

interface AlertsListProps {
  orgId: string;
}

export const AlertsList: React.FC<AlertsListProps> = ({ orgId }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const handleNewAlert = useCallback((alert: Alert) => {
    setAlerts((prev) => [alert, ...prev]);
  }, []);

  const handleAlertStatusUpdate = useCallback((updatedAlert: Alert) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === updatedAlert.id ? updatedAlert : alert
      )
    );
  }, []);

  const { isConnected } = useAlertSocket({
    orgId,
    onNewAlert: handleNewAlert,
    onAlertStatusUpdate: handleAlertStatusUpdate,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return '#f44336';
      case 'Acknowledged':
        return '#ff9800';
      case 'Resolved':
        return '#4caf50';
      default:
        return '#999';
    }
  };

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <h2>Live Alerts</h2>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="no-alerts">
          <p>No alerts yet. Waiting for new alerts...</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-item">
              <div className="alert-header-row">
                <span className="alert-id">{alert.alertId}</span>
                <span
                  className="alert-status"
                  style={{ backgroundColor: getStatusColor(alert.status) }}
                >
                  {alert.status}
                </span>
              </div>
              <div className="alert-context">{alert.alertContext}</div>
              <div className="alert-time">
                {new Date(alert.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
