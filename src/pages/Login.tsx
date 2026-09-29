import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth, AuthError } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Please enter both email/username and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(identifier.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof AuthError) {
        const { reason, remaining, locked_until } = err.detail;

        if (reason === 'account_locked') {
          const until = locked_until
            ? new Date(locked_until).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : 'later';
          setErrorMessage(`Account locked after too many failed attempts. Try again after ${until}.`);
        } else if (reason === 'user_not_found') {
          setErrorMessage('No account found with that email or username.');
        } else if (reason === 'wrong_password' || reason === 'invalid_credentials') {
          const attemptsLeft = typeof remaining === 'number' ? remaining : null;
          setErrorMessage(
            attemptsLeft !== null && attemptsLeft <= 2
              ? `Incorrect password. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`
              : 'Incorrect password. Please try again.'
          );
        } else {
          setErrorMessage(err.message || 'Login failed. Please try again.');
        }
      } else {
        setErrorMessage('Unable to connect to the server. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen h-[100dvh] w-full flex items-center justify-center bg-slate-50/80 p-3 sm:p-4 md:p-6 overflow-hidden select-none">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-0">

          {/* LEFT SIDE --- Form */}
          <div className="p-4 sm:p-6 md:p-6 lg:p-8 xl:p-9 flex flex-col justify-center">
            <div className="flex flex-col items-center text-center mb-3 sm:mb-4 lg:mb-5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 border border-blue-200/80 rounded-xl flex items-center justify-center mb-2 sm:mb-2.5 shadow-sm">
                <ShieldAlert className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-blue-700" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-blue-800 tracking-wider">
                RESPONDE
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 mt-0.5">
                Talisay MDRRMO Command Center
              </p>
              <p className="text-slate-400 text-xs mt-0.5 sm:mt-1 max-w-xs">
                Disaster Intake &amp; Geospatial Analytics System
              </p>
            </div>

            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50/90 border border-red-200/80 flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. mddrmo@gmail.com"
                    autoComplete="username"
                    className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-50/80 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm min-h-[38px] sm:min-h-[40px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-9 pr-9 py-2 sm:py-2.5 bg-slate-50/80 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm min-h-[38px] sm:min-h-[40px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-0.5">
                <span
                  onClick={() => alert('Please contact your System Administrator to reset your password.')}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                >
                  Forgot Password?
                </span>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-700/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all transform active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm min-h-[40px] sm:min-h-[42px]"
              >
                {isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
              </button>
            </form>

            {/* ── Divider ── */}
            <div className="relative my-2.5 sm:my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 uppercase tracking-wider text-[10px]">
                  or
                </span>
              </div>
            </div>

            {/* ── Google Sign In ── */}
            <button
              id="login-google"
              type="button"
              onClick={loginWithGoogle}
              className="w-full py-2 sm:py-2.5 px-4 flex items-center justify-center gap-2.5 bg-white border border-slate-300 hover:bg-slate-50/80 rounded-xl text-xs sm:text-sm font-medium text-slate-700 transition-colors min-h-[38px] sm:min-h-[40px]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-center">
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                Authorized Personnel Only • Talisay, Batangas
              </p>
            </div>
          </div>

          {/* RIGHT SIDE --- Image Panel */}
          <div className="hidden md:flex relative w-full h-full min-h-[380px] lg:min-h-[440px] flex-col items-center justify-center overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1547683905-f686c993aae5?q=80&w=1000&auto=format&fit=crop"
              alt="Disaster Response"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/75 to-blue-900/60" />
            <div className="relative z-10 p-6 md:p-8 lg:p-10 max-w-sm lg:max-w-md">
              <h2 className="text-white text-lg sm:text-xl lg:text-2xl font-bold leading-tight">
                Real-Time Disaster Intelligence
              </h2>
              <p className="text-blue-100/90 text-xs sm:text-sm font-normal mt-2.5 sm:mt-3 leading-relaxed">
                Monitor incident reports, track geospatial data, and coordinate emergency response across Talisay, Batangas.
              </p>
              <div className="mt-5 sm:mt-6 flex items-center gap-2.5">
                <div className="h-0.5 w-8 sm:w-10 bg-white/90 rounded-full" />
                <span className="text-white/95 text-xs font-semibold uppercase tracking-wider">
                  MDRRMO Operations
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}