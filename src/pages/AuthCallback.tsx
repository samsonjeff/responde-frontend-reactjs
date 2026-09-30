import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { authService, AuthError } from '../services/authService';
import { useAuth } from '../context/AuthContext';

/**
 * Google OAuth Callback Handler
 *
 * After the user signs in with Google, Supabase redirects them back to
 * /auth/callback with a fragment containing the access_token.
 *
 * This page:
 *   1. Picks up the Supabase session from the URL fragment
 *   2. Sends the access_token to POST /api/auth/google on our Express backend
 *   3. The backend validates the token, checks system_users allowlist,
 *      and creates an httpOnly server-side session cookie
 *   4. On success, updates AuthContext user state and navigates to /dashboard
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // We need setUser from auth context — just use login-side effect via me()
  const { } = useAuth(); // ensure context is available

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        // Supabase stores the session from the URL hash automatically
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

        // Exchange the Supabase token for our backend server-side session cookie
        await authService.handleGoogleCallback(session.access_token);

        if (!cancelled) {
          // Reload auth state then navigate (the cookie is now set)
          navigate('/dashboard', { replace: true });
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="max-w-sm w-full mx-4 p-6 bg-white rounded-2xl shadow-lg border border-red-100 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-slate-800 font-semibold text-lg mb-2">Sign-In Failed</h2>
          <p className="text-red-600 text-sm mb-5">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl transition-colors text-sm"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-9 h-9 text-blue-700 animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Completing Google sign-in…</p>
    </div>
  );
}
