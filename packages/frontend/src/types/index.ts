/**
 * Shared types for the Videri Alert Flow frontend
 */

export type Role = 'superadmin' | 'admin' | 'user';

export const ALERT_STATUS_OPTIONS = ['New', 'Acknowledged', 'Resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUS_OPTIONS)[number];

export interface SessionState {
  token: string;
  orgId: string;
  userId: string;
  role: Role;
  email?: string;
}

export interface AlertFormState {
  alertContext: string;
  status: AlertStatus;
}

export interface OrgUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  address?: string;
  phone?: string;
  createdAt?: string;
}

export interface UserFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  role: 'user' | 'admin';
  password: string;
}

/**
 * Decode JWT token to extract user information
 */
export const decodeJwt = (token: string): { userId: string; orgId: string; role: Role; email?: string } | null => {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload));
    return {
      userId: decoded.sub as string,
      orgId: decoded.orgId as string,
      role: (decoded.roles?.[0] as Role) || 'user',
      email: decoded.email as string | undefined,
    };
  } catch (err) {
    console.error('Failed to decode JWT', err);
    return null;
  }
};

export const DEFAULT_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
