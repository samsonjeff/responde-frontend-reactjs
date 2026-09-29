// -- Auth Service --
// All calls to the Express backend (/api/auth/*).
//
// In development: Vite proxies /api/* → https://messbot-928g.onrender.com
//   so we use relative paths (no base URL needed).
// In production: We prefix with VITE_API_URL since there's no proxy.
//
// `credentials: 'include'` is mandatory on every request so the browser
//   sends and receives the httpOnly session cookie automatically.

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
  avatar_url: string | null;
  phone_number: string | null;
  expires_at?: string;
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

// Internal fetch wrapper — always sends cookies and sets Content-Type.
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
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

    // Backend may return { user: {...} } or the user object directly
    return (data.user ?? data) as AuthUser;
  },

  /**
   * Restore session from httpOnly cookie on app boot.
   * Returns the current user, or null if no valid session exists.
   */
  async me(): Promise<AuthUser | null> {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) return null;
      const data = await res.json();
      return (data.user ?? data) as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Sign out — revokes the session cookie on the backend.
   */
  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  },

  /**
   * Register a new account using a super_admin invite token.
   * Used on the /register?token=... page.
   */
  async register(payload: {
    token: string;
    email: string;
    password: string;
    username: string;
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
   * Super admin only — the backend enforces this via session check.
   */
  async generateInvite(
    target_role: 'admin' | 'staff'
  ): Promise<{ token: string; invite_url: string; expires_at: string }> {
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
   * Initiate Google OAuth login.
   * Redirects the browser to the backend's Google OAuth endpoint.
   * Only works for accounts that were pre-invited (email must already exist
   * in system_users).
   */
  loginWithGoogle(): void {
    window.location.href = `${API_BASE}/api/auth/google`;
  },
};
