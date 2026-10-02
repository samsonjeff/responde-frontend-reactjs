// -- Auth Service --
// All calls to the Express backend (/api/auth/*).
//
// In development: Vite proxies /api/* -> https://messbot-928g.onrender.com
//   so we use relative paths (no base URL needed).
// In production: We prefix with VITE_API_URL since there's no proxy.
//
// credentials: 'include' is mandatory on every request so the browser
//   sends and receives the httpOnly session cookie automatically.

import { supabase } from '../lib/supabaseClient';

// In dev, use proxy (relative path). In prod, use the full API URL.
const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ?? '');

// -- Types --
export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface AuthUser {
  user_id: string;
  auth_user_id?: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  avatar_url: string | null;
  phone_number: string | null;
  last_login_at?: string | null;
  created_at?: string;
  expires_at?: string;
}

export interface GoogleCallbackResult {
  success: boolean;
  requires_setup?: boolean;
  requires_approval?: boolean;
  user?: AuthUser;
  email?: string;
  full_name?: string;
  avatar_url?: string | null;
  message?: string;
}

export interface LoginErrorDetail {
  reason: 'wrong_password' | 'account_locked' | 'user_not_found' | string;
  attempts?: number;
  remaining?: number;
  locked_until?: string;
}

export class AuthError extends Error {
  detail: LoginErrorDetail;
  constructor(message: string, detail: LoginErrorDetail) {
    super(message);
    this.name = 'AuthError';
    this.detail = detail;
  }
}

// -- Local Token & User Storage Helpers --
const SESSION_TOKEN_KEY = 'responde_session_token';
const USER_KEY = 'responde_user';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {}
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

// Internal fetch wrapper - sends cookies AND Authorization Bearer header if token exists
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
}

// -- Auth API --
export const authService = {

  /**
   * Sign in with email/username + password.
   * Throws AuthError with detail on failure (wrong password, locked, etc.).
   */
  async login(identifier: string, password: string): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new AuthError(
        data.error ?? data.message ?? 'Login failed',
        {
          reason: data.reason ?? data.error ?? 'unknown',
          attempts: data.attempts,
          remaining: data.remaining,
          locked_until: data.locked_until,
        }
      );
    }

    const token = data.token || data.session_token;
    if (token) {
      setStoredSessionToken(token);
    }
    const user = (data.user ?? data) as AuthUser;
    setStoredUser(user);
    return user;
  },

  /**
   * Restore session from httpOnly cookie on app boot.
   * Returns the current user, or null if no valid session exists.
   */
  async me(): Promise<AuthUser | null> {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.status === 401 || res.status === 403) {
        setStoredSessionToken(null);
        setStoredUser(null);
        return null;
      }
      if (!res.ok) return getStoredUser();
      const data = await res.json();
      const user = (data.user ?? data) as AuthUser;
      const existing = getStoredUser();
      if (!user.avatar_url && existing?.avatar_url && (existing.user_id === user.user_id || existing.email === user.email)) {
        user.avatar_url = existing.avatar_url;
      }
      setStoredUser(user);
      return user;
    } catch {
      return getStoredUser();
    }
  },

  /**
   * Sign out - revokes the session cookie on the backend.
   */
  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredSessionToken(null);
      setStoredUser(null);
    }
  },

  /**
   * Fetch all registered system users (Super Admin & Admin only).
   */
  async getUsers(): Promise<AuthUser[]> {
    const res = await apiFetch('/api/auth/users');
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to load users', {
        reason: 'users_fetch_error'
      });
    }
    return (data.users ?? []) as AuthUser[];
  },

  /**
   * Activate or deactivate a user (Approve pending users or revoke access).
   */
  async updateUserStatus(userId: string, is_active: boolean): Promise<{ success: boolean; message: string; is_active: boolean }> {
    const res = await apiFetch(`/api/auth/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to update user status', {
        reason: 'status_update_error'
      });
    }
    if (data.token || data.session_token) {
      setStoredSessionToken(data.token || data.session_token);
    }
    if (data.user) {
      setStoredUser(data.user);
    }
    return data;
  },

  /**
   * Promote or change user role.
   * Admin: can promote to admin or staff.
   * Super Admin: can promote to staff, admin, or super_admin (with OTP).
   */
  async updateUserRole(
    userId: string,
    new_role: UserRole,
    password: string,
    supabase_otp?: string
  ): Promise<{ success: boolean; message: string; old_role: UserRole; new_role: UserRole }> {
    const res = await apiFetch(`/api/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ new_role, password, supabase_otp })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to change role', {
        reason: 'role_update_error'
      });
    }
    return data;
  },

  /**
   * Request OTP for super_admin promotion.
   */
  async requestOtp(): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/api/auth/request-otp', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to send OTP', {
        reason: 'otp_error'
      });
    }
    return data;
  },

  /**
   * Register a new account using an invite token.
   * Used on the /register?token=... page.
   */
  async register(payload: {
    token: string;
    email: string;
    password: string;
    username?: string;
    full_name: string;
  }): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Registration failed', {
        reason: data.reason ?? 'registration_error',
      });
    }
    return (data.user ?? data) as AuthUser;
  },

  /**
   * Generate a 1-hour invite link for a new user.
   * Super Admin & Admin supported.
   */
  async generateInvite(
    target_role: 'admin' | 'staff' | 'super_admin'
  ): Promise<{ token: string; invite_url: string; target_role: string; expires_in: string }> {
    const res = await apiFetch('/api/auth/invite', {
      method: 'POST',
      body: JSON.stringify({ target_role }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Could not generate invite', {
        reason: data.reason ?? 'invite_error',
      });
    }
    return data;
  },

  /**
   * Initiate Google OAuth login via Supabase client-side OAuth.
   */
  async loginWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });

    if (error) throw new AuthError(error.message, { reason: 'google_oauth_error' });
  },

  /**
   * Called after the Google OAuth redirect returns to /auth/callback.
   * Exchanges the Supabase access_token with our Express backend to create
   * a server-side httpOnly session cookie (POST /api/auth/google).
   */
  async handleGoogleCallback(access_token: string): Promise<GoogleCallbackResult> {
    const res = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ access_token }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Google login failed', {
        reason: data.reason ?? 'google_oauth_error',
      });
    }
    if (data.token || data.session_token) {
      setStoredSessionToken(data.token || data.session_token);
    }
    if (data.user) {
      setStoredUser(data.user);
    }
    return data as GoogleCallbackResult;
  },

  /**
   * Complete setup for a new Google account: sets the password and optional username.
   */
  async completeGoogleSetup(payload: {
    access_token: string;
    password: string;
    username?: string;
    full_name?: string;
    phone_number?: string;
  }): Promise<{ user?: AuthUser; requires_approval?: boolean; message?: string }> {
    const res = await apiFetch('/api/auth/google/complete-setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Account setup failed', {
        reason: data.reason ?? 'setup_error',
      });
    }
    return data;
  },
};
