/**
 * Example: Updated AlertsList Component with Better Error Handling
 * 
 * This shows how to refactor the current AlertsList.tsx to use
 * the enhanced API error handling and circuit breaker awareness.
 * 
 * Replace the relevant fetch calls in AlertsList.tsx with these patterns.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { fetchWithErrorHandling, type ApiErrorResponse, type ApiResponse } from '../services/api';
import { useAlertSocket, Alert, AlertEvent } from '../hooks/useAlertSocket';

interface AlertsListProps {
  orgId: string;
  apiUrl: string;
  token: string;
}

interface AlertsListState {
  alerts: Alert[];
  loading: boolean;
  error: ApiErrorResponse | null;
  retryCountdown: number | null; // For circuit breaker, show countdown
}

export const AlertsListEnhanced: React.FC<AlertsListProps> = ({ orgId, apiUrl, token }) => {
  const [state, setState] = useState<AlertsListState>({
    alerts: [],
    loading: false,
    error: null,
    retryCountdown: null,
  });

  /**
   * Pattern 1: Load alerts with enhanced error handling
   */
  const loadAlerts = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const url = new URL('/alerts', apiUrl.replace(/\/$/, ''));
    url.searchParams.set('orgId', orgId);

    const response = await fetchWithErrorHandling<Alert[]>(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      setState((prev) => ({
        ...prev,
        alerts: (response.data || []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        loading: false,
        error: null,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: response.error || null,
      }));

      // If circuit breaker is open, show countdown
      if (response.error?.isCircuitBreakerOpen) {
        startRetryCountdown();
      }
    }
  }, [apiUrl, orgId, token]);

  /**
   * Pattern 2: Show countdown for circuit breaker recovery
   */
  const startRetryCountdown = useCallback(() => {
    let countdown = 60; // 60 seconds circuit breaker timeout
    setState((prev) => ({ ...prev, retryCountdown: countdown }));

    const interval = setInterval(() => {
      countdown--;
      setState((prev) => ({ ...prev, retryCountdown: countdown > 0 ? countdown : null }));

      if (countdown <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Pattern 3: Create alert with retry on network error
   */
  const createAlertWithRetry = useCallback(
    async (alertContext: string): Promise<ApiResponse<Alert>> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetchWithErrorHandling<Alert>(
          new URL('/alerts', apiUrl.replace(/\/$/, '')).toString(),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              alertContext,
              status: 'New',
            }),
          },
        );

        // Success - return immediately
        if (response.ok) {
          return response;
        }

        // Only retry on network errors (not on server errors or client errors)
        if (response.error?.isNetworkError && attempt < 1) {
          // Wait 1 second before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Don't retry other errors
        return response;
      }

      return {
        ok: false,
        status: 0,
        error: {
          message: 'Max retry attempts exceeded',
          statusCode: 0,
          isCircuitBreakerOpen: false,
          isTimeout: false,
          isNetworkError: false,
          isRetryable: false,
        },
      };
    },
    [apiUrl, token],
  );

  /**
   * Pattern 4: Load alert events with error handling
   */
  const loadAlertEvents = useCallback(
    async (alert: Alert): Promise<AlertEvent[] | null> => {
      const url = new URL(`/alerts/${alert.id}/events`, apiUrl.replace(/\/$/, ''));
      url.searchParams.set('orgId', orgId);

      const response = await fetchWithErrorHandling<AlertEvent[]>(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return (response.data || []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } else {
        // Log error for debugging
        console.error('[ALERTS] Failed to load events', {
          alert: alert.id,
          error: response.error,
          timestamp: new Date().toISOString(),
        });
        return null;
      }
    },
    [apiUrl, orgId, token],
  );

  /**
   * Pattern 5: Render error message with context-aware info
   */
  const renderErrorMessage = (error: ApiErrorResponse | null): string => {
    if (!error) return '';

    if (error.isCircuitBreakerOpen) {
      return 'Service is temporarily overloaded. Please wait a moment and try again.';
    }

    if (error.isTimeout) {
      return 'Request took too long to complete. Please check your connection and try again.';
    }

    if (error.isNetworkError) {
      return 'Network error. Please check your internet connection.';
    }

    // Fallback to generic error message from backend
    return error.message || 'An error occurred. Please try again.';
  };

  // Initial load
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const { isConnected } = useAlertSocket({
    orgId,
    token,
    onNewAlert: (alert) => {
      setState((prev) => ({
        ...prev,
        alerts: [alert, ...prev.alerts],
      }));
    },
    onAlertStatusUpdate: (alert) => {
      setState((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) => (a.id === alert.id ? alert : a)),
      }));
    },
  });

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <h2>Alerts</h2>

        {/* Show WebSocket connection status */}
        <div className="connection-status">
          WebSocket:
          <span style={{ color: isConnected ? 'green' : 'red' }}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>

        {/* Show retry countdown if circuit is open */}
        {state.retryCountdown !== null && (
          <div className="retry-countdown" style={{ color: '#ff6b6b' }}>
            Service recovering... Try again in {state.retryCountdown}s
          </div>
        )}
      </div>

      {/* Show error message */}
      {state.error && (
        <div className="alert-error">
          <p>{renderErrorMessage(state.error)}</p>

          {/* Show retry button for transient errors */}
          {(state.error.isNetworkError || state.error.isCircuitBreakerOpen || state.error.isTimeout) && (
            <button
              onClick={loadAlerts}
              disabled={state.loading || state.retryCountdown !== null}
              className="retry-button"
            >
              {state.loading ? 'Retrying...' : 'Try Again'}
            </button>
          )}

          {/* Show detailed error info in development/test */}
          {process.env.NODE_ENV !== 'production' && (
            <details style={{ marginTop: '10px', fontSize: '12px' }}>
              <summary>Error Details</summary>
              <pre>{JSON.stringify(state.error, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {/* Loading state */}
      {state.loading && (
        <div className="alerts-loading">
          {state.error?.isTimeout && 'Request is taking longer than usual...'}
          {!state.error && 'Loading alerts...'}
        </div>
      )}

      {/* Alerts list */}
      {!state.loading && state.alerts.length === 0 && !state.error && (
        <div className="alerts-empty">No alerts</div>
      )}

      {state.alerts.length > 0 && (
        <div className="alerts-list">
          {state.alerts.map((alert) => (
            <div key={alert.id} className="alert-item">
              <h3>{alert.alertContext}</h3>
              <p>Status: {alert.status}</p>
              <small>ID: {alert.alertId}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * CSS for error handling UI
 * Add to AlertsList.css
 */
export const ENHANCED_ALERTS_CSS = `
.alert-error {
  padding: 12px;
  margin: 10px 0;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
}

.alert-error p {
  margin: 0 0 10px 0;
}

.retry-button {
  padding: 8px 16px;
  background-color: #6a4cfe;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-button:hover:not(:disabled) {
  background-color: #5a3ede;
}

.retry-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.retry-countdown {
  padding: 10px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  margin: 10px 0;
}

.connection-status {
  margin-top: 10px;
  padding: 8px;
  font-size: 14px;
  background-color: #f0f0f0;
  border-radius: 4px;
}

.alerts-loading {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.alerts-empty {
  padding: 20px;
  text-align: center;
  color: #999;
}
`;
