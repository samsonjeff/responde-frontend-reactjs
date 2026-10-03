import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  authService,
  type AuthUser,
  type UserRole,
  type LoginResponse,
  AuthError,
  getStoredUser,
  setStoredUser,
} from '../services/authService';

// -- Context shape --
interface AuthContextValue {
  /** Currently authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** Shortcut to user.role - null when not authenticated */
  role: UserRole | null;
  /** True while the initial session check (/api/auth/me) is in flight */
  isLoading: boolean;

  /**
   * Sign in with email or username + password.
   * If 2FA is required, returns LoginChallengeResponse.
   * If completed directly, returns AuthUser.
   */
  login: (identifier: string, password: string) => Promise<LoginResponse>;

  /**
   * Complete 2FA sign in with the 6-digit email verification code.
   */
  verifyLoginOtp: (challengeToken: string, code: string) => Promise<AuthUser>;

  /**
   * Resend a fresh 6-digit code for the current login challenge.
   */
  resendLoginOtp: (challengeToken: string) => Promise<{ challenge_token: string; masked_email: string; message: string }>;

  /** Redirect to Google OAuth via Supabase */
  loginWithGoogle: () => Promise<void>;

  /** Manually update current user state (e.g. after Google OAuth or setup) */
  setUser: (user: AuthUser | null) => void;

  /** Re-fetch session from /api/auth/me */
  refreshUser: () => Promise<AuthUser | null>;

  /** Sign out and clear local user state */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// -- Provider --
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => !getStoredUser());

  const setUser = useCallback((newUser: AuthUser | null) => {
    setUserState(newUser);
    setStoredUser(newUser);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const meUser = await authService.me();
      setUser(meUser);
      return meUser;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  // On app boot: validate/refresh session with the backend.
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (identifier: string, password: string): Promise<LoginResponse> => {
    const res = await authService.login(identifier, password);
    if ('user_id' in res) {
      setUser(res as AuthUser);
    }
    return res;
  }, [setUser]);

  const verifyLoginOtp = useCallback(async (challengeToken: string, code: string): Promise<AuthUser> => {
    const loggedInUser = await authService.verifyLoginOtp(challengeToken, code);
    setUser(loggedInUser);
    return loggedInUser;
  }, [setUser]);

  const resendLoginOtp = useCallback(async (challengeToken: string) => {
    return await authService.resendLoginOtp(challengeToken);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await authService.loginWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isLoading,
        login,
        verifyLoginOtp,
        resendLoginOtp,
        loginWithGoogle,
        setUser,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// -- Hook --
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be called inside <AuthProvider>. Did you wrap your app in <AuthProvider>?');
  }
  return ctx;
}

export { AuthError };
export type { LoginResponse };
