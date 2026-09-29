import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { authService, type AuthUser, type UserRole, AuthError } from '../services/authService';

// -- Context shape --
interface AuthContextValue {
  /** Currently authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** Shortcut to user.role — null when not authenticated */
  role: UserRole | null;
  /** True while the initial session check (/api/auth/me) is in flight */
  isLoading: boolean;

  /**
   * Sign in with email or username + password.
   * Throws AuthError on failure (wrong_password, account_locked, etc.)
   */
  login: (identifier: string, password: string) => Promise<void>;

  /** Redirect to backend Google OAuth (pre-invited accounts only) */
  loginWithGoogle: () => void;

  /** Sign out and clear local user state */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// -- Provider --
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app boot: try to restore session from the httpOnly cookie.
  // If the cookie is still valid, /api/auth/me returns the user profile.
  useEffect(() => {
    authService
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    // authService.login throws AuthError on bad credentials / locked account
    const loggedInUser = await authService.login(identifier, password);
    setUser(loggedInUser);
  }, []);

  const loginWithGoogle = useCallback(() => {
    authService.loginWithGoogle();
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
