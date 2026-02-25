import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAlertSocket, Alert, AlertEvent } from '../hooks/useAlertSocket';
import './AlertsList.css';

interface AlertsListProps {
  orgId: string;
  apiUrl: string;
  token: string;
}

type StatusFilter = '' | 'New' | 'Acknowledged' | 'Resolved';
const STATUS_OPTIONS: StatusFilter[] = ['', 'New', 'Acknowledged', 'Resolved'];
const PAGE_SIZE_OPTIONS = [5, 10, 20];

type EditableStatus = Exclude<StatusFilter, ''>;
const EDITABLE_STATUS_OPTIONS: EditableStatus[] = ['New', 'Acknowledged', 'Resolved'];

const normalizeStatus = (status: string) => status?.toLowerCase?.() || '';
const formatStatusLabel = (status: string) => {
  const lower = normalizeStatus(status);
  if (lower === 'new') return 'New';
  if (lower === 'acknowledged') return 'Acknowledged';
  if (lower === 'resolved') return 'Resolved';
  return status;
};

export const AlertsList: React.FC<AlertsListProps> = ({ orgId, apiUrl, token }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [editForm, setEditForm] = useState<{ alertContext: string; status: EditableStatus } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const handleNewAlert = useCallback((alert: Alert) => {
    setAlerts((prev) => {
      const existing = prev.find((a) => a.id === alert.id);
      if (existing) {
        return prev.map((a) => (a.id === alert.id ? alert : a));
      }
      return [alert, ...prev];
    });
  }, []);

  const handleAlertStatusUpdate = useCallback((updatedAlert: Alert) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === updatedAlert.id ? { ...alert, ...updatedAlert } : alert)));
    setSelectedAlert((prev) => (prev?.id === updatedAlert.id ? { ...prev, ...updatedAlert } : prev));
    setEditForm((prev) =>
      prev && selectedAlert?.id === updatedAlert.id
        ? { ...prev, status: updatedAlert.status as EditableStatus, alertContext: updatedAlert.alertContext }
        : prev,
    );
    setDetailAlert((prev) => (prev?.id === updatedAlert.id ? { ...prev, ...updatedAlert } : prev));
  }, [selectedAlert]);

  const handleAlertEvent = useCallback((event: AlertEvent) => {
    setAlertEvents((prev) => {
      if (!detailAlert || event.eventData?.alertId !== detailAlert.id) return prev;
      if (prev.some((e) => e.id === event.id)) return prev;
      const next = [event, ...prev];
      return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }, [detailAlert]);

  const { isConnected } = useAlertSocket({
    orgId,
    onNewAlert: handleNewAlert,
    onAlertStatusUpdate: handleAlertStatusUpdate,
    onAlertEvent: handleAlertEvent,
  });

  useEffect(() => {
    if (!orgId || !token) {
      setAlerts([]);
      setError(orgId ? 'Provide a token to load alerts.' : 'Enter an org ID to load alerts.');
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL('/alerts', apiUrl.replace(/\/$/, ''));
        url.searchParams.set('orgId', orgId);
        if (statusFilter) {
          url.searchParams.set('status', statusFilter);
        }
        if (mineOnly) {
          url.searchParams.set('mine', 'true');
        }

        const res = await fetch(url.toString(), {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as any)?.message || 'Failed to load alerts');
        }

        const data: Alert[] = await res.json();
        setAlerts(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setPage(1);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err?.message || 'Error loading alerts');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [apiUrl, mineOnly, orgId, statusFilter, token]);

  const openDetails = async (alert: Alert) => {
    setDetailAlert(alert);
    setEventsLoading(true);
    setEventsError(null);
    try {
      const url = new URL(`/alerts/${alert.id}/events`, apiUrl.replace(/\/$/, ''));
      url.searchParams.set('orgId', orgId);
      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error((body as any)?.message || 'Failed to load alert events');
      }
      const events = (body as AlertEvent[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAlertEvents(events);
    } catch (err: any) {
      setEventsError(err?.message || 'Error loading alert events');
      setAlertEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailAlert(null);
    setAlertEvents([]);
    setEventsError(null);
  };

  const filteredAlerts = useMemo(() => {
    if (!searchTerm.trim()) return alerts;
    const term = searchTerm.toLowerCase();
    return alerts.filter((a) =>
      a.alertContext.toLowerCase().includes(term) ||
      a.alertId.toLowerCase().includes(term) ||
      a.status.toLowerCase().includes(term),
    );
  }, [alerts, searchTerm]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredAlerts.length / pageSize)), [filteredAlerts.length, pageSize]);

  const pagedAlerts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const setPageSafe = (next: number) => setPage(Math.min(Math.max(1, next), totalPages));

  const getStatusColor = (status: string) => {
    const lower = normalizeStatus(status);
    switch (lower) {
      case 'new':
        return '#6a4cfe';
      case 'acknowledged':
        return '#fbb040';
      case 'resolved':
        return '#22c55e';
      default:
        return '#999';
    }
  };

  const startEdit = (alert: Alert) => {
    if (selectedAlert?.id === alert.id) {
      setSelectedAlert(null);
      setEditForm(null);
      setActionError(null);
      setActionMessage(null);
      return;
    }
    setSelectedAlert(alert);
    setEditForm({ alertContext: alert.alertContext, status: alert.status as EditableStatus });
    setActionError(null);
    setActionMessage(null);
  };

  const cancelEdit = () => {
    setSelectedAlert(null);
    setEditForm(null);
    setActionError(null);
    setActionMessage(null);
  };

  const handleUpdateAlert = async () => {
    if (!selectedAlert || !editForm) return;
    if (selectedAlert.status === 'Resolved') {
      setActionError('Resolved alerts cannot be edited.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const url = new URL(`/alerts/${selectedAlert.id}`, apiUrl.replace(/\/$/, ''));
      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alertContext: editForm.alertContext,
          status: editForm.status,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as any)?.message || 'Failed to update alert');
      }

      const updated: Alert = { ...selectedAlert, ...body, alertContext: editForm.alertContext, status: editForm.status };
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setSelectedAlert((prev) => (prev?.id === updated.id ? updated : prev));
      setDetailAlert((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
      setActionMessage('Alert updated');
    } catch (err: any) {
      setActionError(err?.message || 'Error updating alert');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAlert = async (alert: Alert) => {
    const isResolved = normalizeStatus(alert.status) === 'resolved';
    if (!isResolved) {
      setSelectedAlert(alert);
      setEditForm({ alertContext: alert.alertContext, status: alert.status as EditableStatus });
      setActionError('Only resolved alerts can be deleted.');
      return;
    }

    setSelectedAlert(alert);
    const confirmed = window.confirm('Delete this resolved alert? This cannot be undone.');
    if (!confirmed) return;

    setActionLoading(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const url = new URL(`/alerts/${alert.id}`, apiUrl.replace(/\/$/, ''));
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.message || 'Failed to delete alert');
      }

      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      setActionMessage('Alert deleted');
      cancelEdit();
      if (detailAlert?.id === alert.id) closeDetails();
    } catch (err: any) {
      setActionError(err?.message || 'Error deleting alert');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <div>
          <p className="muted">Filter by status, ownership, or search text.</p>
        </div>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'WebSocket connected' : 'WebSocket offline'}</span>
        </div>
      </div>

      <div className="filters-row">
        <label className="filter-field search-field">
          <span>Search</span>
          <input
            type="search"
            placeholder="Search alerts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>

        <label className="filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt || 'all'} value={opt}>
                {opt || 'All'}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field checkbox">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          <span>Created by me</span>
        </label>

        <label className="filter-field">
          <span>Per page</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <div className="inline-message">Loading alerts…</div>}
      {error && <div className="inline-message error">{error}</div>}

      {!loading && alerts.length === 0 && !error && (
        <div className="no-alerts">
          <p>No alerts yet. Waiting for new alerts…</p>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <>
          <div className="alerts-list">
            {pagedAlerts.map((alert) => {
              const isEditing = selectedAlert?.id === alert.id;
              return (
                <div
                  key={alert.id}
                  className="alert-item"
                  onClick={() => openDetails(alert)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') openDetails(alert); }}
                >
                  <div className="alert-header-row">
                    <span className="alert-id">{alert.alertId}</span>
                    <span
                      className="alert-status"
                      style={{ backgroundColor: getStatusColor(alert.status) }}
                    >
                      {formatStatusLabel(alert.status)}
                    </span>
                  </div>
                  <div className="alert-context">{alert.alertContext}</div>
                  <div className="alert-time">Created {new Date(alert.createdAt).toLocaleString()}</div>

                  <div className="alert-actions">
                    <button
                      className="btn-primary"
                      onClick={(e) => { e.stopPropagation(); startEdit(alert); }}
                      disabled={actionLoading && isEditing}
                    >
                      {isEditing ? 'Hide' : 'Edit'}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={(e) => { e.stopPropagation(); handleDeleteAlert(alert); }}
                      disabled={normalizeStatus(alert.status) !== 'resolved' || (actionLoading && isEditing)}
                    >
                      Delete
                    </button>
                  </div>

                  {isEditing && editForm && (
                    <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
                      {actionError && <div className="inline-message error">{actionError}</div>}
                      {actionMessage && <div className="inline-message">{actionMessage}</div>}

                      <label className="field">
                        <span>Alert context</span>
                        <textarea
                          value={editForm.alertContext}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, alertContext: e.target.value } : prev)}
                          disabled={alert.status === 'Resolved' || actionLoading}
                        />
                      </label>

                      <label className="field">
                        <span>Status</span>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm((prev) => prev ? { ...prev, status: e.target.value as EditableStatus } : prev)}
                          disabled={alert.status === 'Resolved' || actionLoading}
                        >
                          {EDITABLE_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </label>

                      <div className="detail-actions">
                        <button
                          className="btn-primary"
                          onClick={(e) => { e.stopPropagation(); handleUpdateAlert(); }}
                          disabled={alert.status === 'Resolved' || actionLoading}
                        >
                          {actionLoading ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} disabled={actionLoading}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pagination">
            <button className="page-btn" onClick={() => setPageSafe(page - 1)} disabled={page === 1}>Prev</button>
            <span className="page-info">Page {page} of {totalPages}</span>
            <button className="page-btn" onClick={() => setPageSafe(page + 1)} disabled={page === totalPages}>Next</button>
          </div>
        </>
      )}

      {detailAlert && (
        <div className="modal-backdrop" onClick={closeDetails}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Alert details</p>
                <h3>{detailAlert.alertContext || 'Alert'}</h3>
                <p className="muted">ID: {detailAlert.alertId}</p>
              </div>
              <button className="btn-secondary" onClick={closeDetails}>Close</button>
            </div>

            <div className="modal-meta-row">
              <span className="pill" style={{ backgroundColor: getStatusColor(detailAlert.status) }}>{formatStatusLabel(detailAlert.status)}</span>
              <span className="muted">Created {new Date(detailAlert.createdAt).toLocaleString()}</span>
              <span className="muted">Updated {new Date(detailAlert.updatedAt).toLocaleString()}</span>
            </div>

            {eventsLoading && <div className="inline-message">Loading events…</div>}
            {eventsError && <div className="inline-message error">{eventsError}</div>}

            {!eventsLoading && !eventsError && (
              <div className="events-list">
                {alertEvents.length === 0 && <div className="muted">No events for this alert yet.</div>}
                {alertEvents.map((event) => (
                  <div key={event.id} className="event-item">
                    <div className="event-row">
                      <span className="event-title">{event.eventData?.newStatus || event.eventData?.previousStatus ? 'Status change' : 'Event'}</span>
                      <span className="event-time">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <pre className="event-body">{JSON.stringify(event.eventData, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};