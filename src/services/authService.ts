import { supabase } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || '';

export type UserRole = 'staff' | 'admin' | 'super_admin';

export interface AuthUser {
  user_id: string;
  username: string;
  email: string;
  full_name?: string;
  role: UserRole;
  is_active?: boolean;
  avatar_url?: string | null;
  phone_number?: string | null;
  created_at?: string;
  last_login_at?: string;
}

export interface GoogleCallbackResult {
  requires_setup?: boolean;
  user?: AuthUser;
  temp_user?: {
    email: string;
    full_name?: string;
    avatar_url?: string | null;
  };
  email?: string;
  full_name?: string;
  avatar_url?: string | null;
  message?: string;
}

export interface LoginChallengeResponse {
  requires_verification: true;
  challenge_token: string;
  masked_email: string;
  message: string;
}

export type LoginResponse = AuthUser | LoginChallengeResponse;

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
   * If 2FA is required, returns LoginChallengeResponse ({ requires_verification: true, challenge_token, masked_email }).
   * If verified directly, returns AuthUser.
   */
  async login(identifier: string, password: string, code?: string, challenge_token?: string): Promise<LoginResponse> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, code, challenge_token }),
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

    if (data.requires_verification) {
      return {
        requires_verification: true,
        challenge_token: data.challenge_token,
        masked_email: data.masked_email,
        message: data.message,
      };
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
   * Verify the 6-digit one-time code during manual sign-in.
   */
  async verifyLoginOtp(challenge_token: string, code: string): Promise<AuthUser> {
    const res = await apiFetch('/api/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ challenge_token, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new AuthError(
        data.error ?? 'Verification failed',
        { reason: 'otp_failed' }
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
   * Resend the 6-digit verification code for manual sign-in.
   */
  async resendLoginOtp(challenge_token: string): Promise<{ success: boolean; challenge_token: string; masked_email: string; message: string }> {
    const res = await apiFetch('/api/auth/login/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ challenge_token }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to resend code', { reason: 'resend_error' });
    }
    return data;
  },

  /**
   * Request password reset code via Brevo OTP.
   */
  async requestPasswordReset(identifier: string): Promise<{
    success: boolean;
    challenge_token: string;
    masked_email: string;
    message: string;
  }> {
    const res = await apiFetch('/api/auth/forgot-password/request', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to request password reset', {
        reason: 'forgot_password_request_error'
      });
    }
    return data;
  },

  /**
   * Resend password reset OTP code.
   */
  async resendPasswordResetOtp(payload: { challenge_token?: string; identifier?: string }): Promise<{
    success: boolean;
    challenge_token: string;
    masked_email: string;
    message: string;
  }> {
    const res = await apiFetch('/api/auth/forgot-password/resend', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to resend reset code', {
        reason: 'forgot_password_resend_error'
      });
    }
    return data;
  },

  /**
   * Reset password using OTP verification code.
   */
  async resetPassword(payload: {
    challenge_token: string;
    code: string;
    new_password: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/api/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to reset password', {
        reason: 'forgot_password_reset_error'
      });
    }
    return data;
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
   * Requires caller password confirmation.
   */
  async updateUserRole(
    userId: string,
    new_role: UserRole,
    password: string
  ): Promise<{ success: boolean; message: string; old_role: UserRole; new_role: UserRole }> {
    const res = await apiFetch(`/api/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({
        new_role,
        password,
      })
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
   * Request OTP code via Brevo SMTP (optional diagnostic/legacy).
   * Accessible by: super_admin and admin.
   */
  async requestOtp(): Promise<{ success: boolean; message: string; challenge_token?: string; masked_email?: string }> {
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
   * Send a verification code for user settings changes.
   */
  async sendVerificationCode(purpose = 'settings_change'): Promise<{ success: boolean; message: string; challenge_token: string; masked_email: string }> {
    const res = await apiFetch('/api/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ purpose })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Failed to send verification code', {
        reason: 'code_send_error'
      });
    }
    return data;
  },

  /**
   * Validate a verification code for user settings.
   */
  async verifyCode(challenge_token: string, code: string, purpose = 'settings_change'): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ challenge_token, code, purpose })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? 'Verification failed', {
        reason: 'code_verify_error'
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

  /**
   * Update triage status of a scraped Facebook comment.
   * Requires: staff, admin, or super_admin.
   */
  async updateFbCommentStatus(
    commentId: string,
    status: 'New' | 'Verified' | 'Flagged' | 'Resolved'
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const res = await apiFetch('/api/auth/data/fb-comments/' + encodeURIComponent(commentId) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new AuthError(data.error ?? data.message ?? 'Failed to update status', {
        reason: 'comment_status_update_error',
      });
    }
    return data;
  },

  /**
   * Delete caller's own personal account with password and OTP verification.
   */
  async deleteAccount(payload: { password: string; code?: string; challenge_token?: string }): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch('/api/auth/users/me', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new AuthError(data.error ?? data.message ?? 'Failed to delete account', {
        reason: data.reason ?? 'delete_account_error'
      });
    }
    return data;
  },
};
