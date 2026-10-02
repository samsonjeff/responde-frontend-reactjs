import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { authService, AuthError } from '../services/authService';
import { useAuth } from '../context/AuthContext';

/**
 * Google OAuth Callback & Account Setup Handler
 *
 * Flow:
 * 1. Checks Supabase OAuth session from URL hash / storage.
 * 2. Sends access_token to POST /api/auth/google.
 * 3. Case A: Existing user (active) -> creates session cookie, updates AuthContext, redirects to /dashboard.
 * 4. Case B: New user (requires_setup) -> displays setup form to set password (and optional username).
 *    Once submitted:
 *      - If pending approval: displays confirmation message.
 *      - If active: enters /dashboard immediately.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [error, setError] = useState<string | null>(null);

  // Setup state for new accounts
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Form inputs
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new AuthError(sessionError.message, { reason: 'google_oauth_error' });
        }

        if (!session?.access_token) {
          throw new AuthError(
            'No session token received from Google. Please try again.',
            { reason: 'google_oauth_error' }
          );
        }

        const token = session.access_token;
        setAccessToken(token);

        // Exchange the Supabase token with our backend
        const result = await authService.handleGoogleCallback(token);

        if (cancelled) return;

        if (result.requires_setup) {
          // New account: prompt to set password and optional username
          setEmail(result.email || session.user.email || '');
          setFullName(result.full_name || session.user.user_metadata?.full_name || '');
          setAvatarUrl(result.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null);
          setNeedsSetup(true);
        } else if (result.user) {
          // Existing active user: logged in seamlessly without password!
          const avatar =
            result.user.avatar_url ||
            result.avatar_url ||
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            null;
          setUser({ ...result.user, avatar_url: avatar });
          navigate('/dashboard', { replace: true });
        } else {
          // Fallback verify
          const restored = await authService.me();
          if (restored) {
            setUser(restored);
            navigate('/dashboard', { replace: true });
          } else {
            throw new Error('Unable to establish user session. Please try logging in again.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof AuthError) {
            setError(err.message);
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('An unexpected error occurred during Google sign-in.');
          }
        }
      }
    }

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate, setUser]);

  // Handle setting password for new account
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!password) {
      setFormError('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-type your password.');
      return;
    }

    if (username.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || cleanUsername.length > 50) {
        setFormError('Username must be between 3 and 50 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
        setFormError('Username can only contain letters, numbers, periods, underscores, and hyphens.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await authService.completeGoogleSetup({
        access_token: accessToken,
        password: password,
        username: username.trim() || undefined,
        full_name: fullName.trim() || undefined,
      });

      if (res.requires_approval) {
        setNeedsSetup(false);
        setIsPendingApproval(true);
      } else if (res.user) {
        const avatar = res.user.avatar_url || avatarUrl || null;
        setUser({ ...res.user, avatar_url: avatar });
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof AuthError) {
        setFormError(err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Failed to complete account setup. Please try again.');
      }
    }
  };

  // Pending Approval Screen
  if (isPendingApproval) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-amber-200/80 p-6 sm:p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Clock className="w-7 h-7 text-amber-600 animate-pulse" />
          </div>
          <h2 className="text-slate-800 font-bold text-xl mb-2">Account Pending Approval</h2>
          <p className="text-slate-600 text-sm mb-4 leading-relaxed">
            Your account has been registered successfully with role <span className="font-semibold text-slate-800">Staff</span>.
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 mb-6 text-left">
            An administrator or supervisor must accept your account before you can log in to the command center.
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-700/20 text-sm"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-6 sm:p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-slate-800 font-bold text-xl mb-2">Sign-In Failed</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-700/20 text-sm"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Setup form for new account
  if (needsSetup) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/80 p-4 py-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 p-6 sm:p-7 text-white text-center relative">
            <div className="relative inline-block mb-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'User Avatar'}
                  className="w-16 h-16 rounded-full border-2 border-white/80 shadow-md object-cover mx-auto"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center mx-auto">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white shadow">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <h1 className="text-lg sm:text-xl font-bold">Set Your Password</h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xs mx-auto">
              Welcome to Responde! Set a password to complete your account setup.
            </p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-mono border border-white/15">
              <span>{email}</span>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-7">
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteSetup} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Full Name"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Username (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Username <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <span className="text-[11px] text-blue-600 font-medium">Optional</span>
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jdoe (leave blank to log in with email)"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only needed if you want to sign in with a username instead of your email.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type your password"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 mt-2 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all transform active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting up account...</span>
                  </>
                ) : (
                  <>
                    <span>Submit &amp; Request Approval</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
              New self-registered accounts require administrator approval before logging in.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default Loading Screen
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-9 h-9 text-blue-700 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Completing Google sign-in...</p>
    </div>
  );
}
