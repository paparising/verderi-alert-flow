import React, { useState, FormEvent } from 'react';
import { AlertFormState, DEFAULT_API_URL } from '../types';

interface AlertFormProps {
  token: string;
  onSuccess?: (alertId: string) => void;
  onError?: (message: string) => void;
}

export const AlertForm: React.FC<AlertFormProps> = ({ token, onSuccess, onError }) => {
  const [alertForm, setAlertForm] = useState<AlertFormState>({
    alertContext: '',
    status: 'New',
  });
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  const handleAlertFormChange = (field: keyof AlertFormState, value: string) => {
    setAlertForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAlertSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      const msg = 'Please log in before creating an alert.';
      setAlertMessage(msg);
      onError?.(msg);
      return;
    }

    setAlertLoading(true);
    setAlertMessage(null);

    const base = DEFAULT_API_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alertContext: alertForm.alertContext,
          status: 'New',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to create alert');
      }

      const successMsg = `Alert created with id ${data?.id || 'success'}`;
      setAlertMessage(successMsg);
      setAlertForm({ alertContext: '', status: 'New' });
      onSuccess?.(data?.id);
    } catch (err: any) {
      const errorMsg = err?.message || 'Error creating alert';
      setAlertMessage(errorMsg);
      onError?.(errorMsg);
    } finally {
      setAlertLoading(false);
    }
  };

  const handleReset = () => {
    setAlertForm({ alertContext: '', status: 'New' });
    setAlertMessage(null);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">POST New Alerts</p>
        </div>
      </div>

      {alertMessage && <div className="inline-message">{alertMessage}</div>}

      <form className="alert-form" onSubmit={handleAlertSubmit}>
        <label className="field">
          <span>Alert Message</span>
          <textarea
            value={alertForm.alertContext}
            onChange={(e) => handleAlertFormChange('alertContext', e.target.value)}
            placeholder="CPU > 90% on node-1"
            required
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={alertLoading}>
            {alertLoading ? 'Creating…' : 'Create alert'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            disabled={alertLoading}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default AlertForm;
