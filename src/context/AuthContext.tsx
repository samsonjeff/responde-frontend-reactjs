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
   * Throws AuthError on failure (wrong_password, account_locked, etc.)
   */
  login: (identifier: string, password: string) => Promise<void>;

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
  // Stored user allows instant access to dashboard while validation completes in background.
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (identifier: string, password: string) => {
    // authService.login throws AuthError on bad credentials / locked account
    const loggedInUser = await authService.login(identifier, password);
    setUser(loggedInUser);
  }, [setUser]);

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

// Re-export AuthError so consumers can import from one place
export { AuthError };
