import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Mail, ArrowLeft, ArrowRight, RefreshCw, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth, AuthError } from '../context/AuthContext';
import { authService } from '../services/authService';

export default function Login() {
  const navigate = useNavigate();
  const { login, verifyLoginOtp, resendLoginOtp, loginWithGoogle, user } = useAuth();

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Step state: 'credentials' | 'otp' | 'forgot_request' | 'forgot_reset'
  const [step, setStep] = useState<'credentials' | 'otp' | 'forgot_request' | 'forgot_reset'>('credentials');

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // OTP state (Login)
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot Password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotChallengeToken, setForgotChallengeToken] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotOtpDigits, setForgotOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(60);
  const [canResendForgot, setCanResendForgot] = useState(false);
  const [isResendingForgot, setIsResendingForgot] = useState(false);

  const forgotOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown for login OTP resend
  useEffect(() => {
    if (step !== 'otp' || resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // Focus first login OTP input on step switch
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Cooldown countdown for Forgot Password OTP resend
  useEffect(() => {
    if (step !== 'forgot_reset' || forgotCooldown <= 0) {
      setCanResendForgot(true);
      return;
    }
    const timer = setInterval(() => {
      setForgotCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResendForgot(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, forgotCooldown]);

  // Focus first forgot OTP input on forgot_reset
  useEffect(() => {
    if (step === 'forgot_reset') {
      setTimeout(() => {
        forgotOtpRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Please enter both email/username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(identifier.trim(), password);

      if (res && 'requires_verification' in res && res.requires_verification) {
        setChallengeToken(res.challenge_token);
        setMaskedEmail(res.masked_email);
        setStep('otp');
        setResendCooldown(60);
        setCanResend(false);
        setInfoMessage(`Verification code sent to ${res.masked_email}`);
      } else {
        // Direct login succeeded
        navigate('/dashboard', { replace: true });
      }
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

  const handleOtpDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    const char = clean.slice(-1);
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);
    setErrorMessage('');

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    } else {
      const fullCode = next.join('');
      if (fullCode.length === 6) {
        handleOtpSubmit(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtpDigits(next);
    setErrorMessage('');

    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();

    if (pasted.length === 6) {
      handleOtpSubmit(pasted);
    }
  };

  const handleOtpSubmit = async (codeToSubmit?: string) => {
    const code = codeToSubmit || otpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      await verifyLoginOtp(challengeToken, code);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof AuthError) {
        setErrorMessage(err.message || 'Invalid or expired verification code.');
      } else {
        setErrorMessage('Verification failed. Please check the code and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setErrorMessage('');
    try {
      const res = await resendLoginOtp(challengeToken);
      if (res.challenge_token) {
        setChallengeToken(res.challenge_token);
      }
      setResendCooldown(60);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);
      setInfoMessage(`A fresh verification code was sent to ${res.masked_email || maskedEmail}`);
      otpInputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Forgot Password Handlers ──
  const handleOpenForgotPassword = () => {
    setForgotIdentifier(identifier.trim());
    setErrorMessage('');
    setInfoMessage('');
    setStep('forgot_request');
  };

  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!forgotIdentifier.trim()) {
      setErrorMessage('Please enter your registered email or username.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.requestPasswordReset(forgotIdentifier.trim());
      setForgotChallengeToken(res.challenge_token);
      setForgotMaskedEmail(res.masked_email);
      setForgotOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setForgotCooldown(60);
      setCanResendForgot(false);
      setStep('forgot_reset');
      setInfoMessage(`Reset code sent to ${res.masked_email}`);
    } catch (err) {
      if (err instanceof AuthError) {
        setErrorMessage(err.message || 'Unable to request password reset.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to send reset code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotOtpDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...forgotOtpDigits];
      next[index] = '';
      setForgotOtpDigits(next);
      return;
    }

    const char = clean.slice(-1);
    const next = [...forgotOtpDigits];
    next[index] = char;
    setForgotOtpDigits(next);
    setErrorMessage('');

    if (index < 5) {
      forgotOtpRefs.current[index + 1]?.focus();
    }
  };

  const handleForgotOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !forgotOtpDigits[index] && index > 0) {
      forgotOtpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      forgotOtpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      forgotOtpRefs.current[index + 1]?.focus();
    }
  };

  const handleForgotOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...forgotOtpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setForgotOtpDigits(next);
    setErrorMessage('');

    const focusIndex = Math.min(pasted.length, 5);
    forgotOtpRefs.current[focusIndex]?.focus();
  };

  const handleForgotResendOtp = async () => {
    if (!canResendForgot || isResendingForgot) return;
    setIsResendingForgot(true);
    setErrorMessage('');
    try {
      const res = await authService.resendPasswordResetOtp({
        challenge_token: forgotChallengeToken,
        identifier: forgotIdentifier.trim()
      });
      if (res.challenge_token) {
        setForgotChallengeToken(res.challenge_token);
      }
      setForgotCooldown(60);
      setCanResendForgot(false);
      setForgotOtpDigits(['', '', '', '', '', '']);
      setInfoMessage(`A fresh reset code was sent to ${res.masked_email || forgotMaskedEmail}`);
      forgotOtpRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend reset code.');
    } finally {
      setIsResendingForgot(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = forgotOtpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter all 6 digits of the reset code.');
      return;
    }
    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      await authService.resetPassword({
        challenge_token: forgotChallengeToken,
        code,
        new_password: newPassword
      });
      setStep('credentials');
      setPassword('');
      setErrorMessage('');
      setInfoMessage('Password reset successfully! You can now sign in with your new password.');
    } catch (err) {
      if (err instanceof AuthError) {
        setErrorMessage(err.message || 'Password reset failed.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setErrorMessage('');
    setInfoMessage('');
    setOtpDigits(['', '', '', '', '', '']);
    setForgotOtpDigits(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <main className="h-screen h-[100dvh] w-full flex items-center justify-center bg-slate-50/80 p-3 sm:p-4 md:p-6 overflow-y-auto select-none">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-2xl sm:rounded-3xl overflow-hidden my-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-0">

          {/* LEFT SIDE --- Form */}
          <div className="p-4 sm:p-6 md:p-6 lg:p-8 xl:p-9 flex flex-col justify-center min-h-[460px]">
            <div className="flex flex-col items-center text-center mb-3 sm:mb-4 lg:mb-5">
              <Link
                to="/"
                title="Return to Landing Page"
                className="group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-2xl p-1 transition-all"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shadow-md ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 group-hover:shadow-lg group-hover:scale-105 active:scale-95 transition-all duration-200 bg-white flex items-center justify-center mb-2 sm:mb-2.5">
                  <img
                    src="/Responde_Logo.png"
                    alt="RESPONDE Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-blue-800 tracking-wider group-hover:text-blue-600 transition-colors">
                  RESPONDE
                </h1>
              </Link>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 mt-0.5">
                Talisay MDRRMO Command Center
              </p>
              <p className="text-slate-400 text-xs mt-0.5 sm:mt-1 max-w-xs">
                Disaster Intake &amp; Geospatial Analytics System
              </p>
            </div>

            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50/90 border border-red-200/80 flex items-center gap-2 text-red-600 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-blue-50/90 border border-blue-200/80 flex items-center gap-2 text-blue-700 text-xs animate-in fade-in duration-200">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* STEP 1: CREDENTIALS */}
            {step === 'credentials' && (
              <>
                <form onSubmit={handleCredentialsSubmit} className="space-y-2.5 sm:space-y-3">
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
                        placeholder="e.g. mdrrmo@gmail.com or username"
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
                      onClick={handleOpenForgotPassword}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                    >
                      Forgot Password?
                    </span>
                  </div>

                  <button
                    id="login-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-700/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all transform active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm min-h-[40px] sm:min-h-[42px] cursor-pointer"
                  >
                    {isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
                  </button>
                </form>

                {/* Divider */}
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

                {/* Google Sign In (Direct OAuth without OTP) */}
                <button
                  id="login-google"
                  type="button"
                  onClick={() => loginWithGoogle().catch((err) => {
                    setErrorMessage(err instanceof Error ? err.message : 'Google sign-in failed.');
                  })}
                  className="w-full py-2 sm:py-2.5 px-4 flex items-center justify-center gap-2.5 bg-white border border-slate-300 hover:bg-slate-50/80 rounded-xl text-xs sm:text-sm font-medium text-slate-700 transition-colors min-h-[38px] sm:min-h-[40px] cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </>
            )}

            {/* STEP 2: EMAIL VERIFICATION CODE (LOGIN OTP) */}
            {step === 'otp' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 mb-1.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-900">
                    Step 2: Enter Verification Code
                  </h3>
                  <p className="text-[11px] text-blue-700/90 mt-0.5">
                    Enter the 6-digit code sent to <strong className="font-semibold">{maskedEmail}</strong>
                  </p>
                </div>

                <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      disabled={isLoading}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                        digit
                          ? 'border-blue-600 bg-blue-50/30 text-blue-900 font-extrabold'
                          : 'border-slate-300 bg-slate-50/60 text-slate-800'
                      } focus:ring-blue-500/20 focus:border-blue-500`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 text-[11px]">
                    Expires in 10 minutes
                  </span>
                  <button
                    type="button"
                    disabled={!canResend || isResending}
                    onClick={handleResendOtp}
                    className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer disabled:cursor-not-allowed text-[11px]"
                  >
                    <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                    {canResend ? 'Resend Code' : `Resend in ${resendCooldown}s`}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOtpSubmit()}
                  disabled={isLoading || otpDigits.join('').length < 6}
                  className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-700/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm min-h-[40px] sm:min-h-[42px] cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying Code...' : (
                    <>
                      <span>Verify &amp; Enter Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to credentials</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP: FORGOT PASSWORD REQUEST */}
            {step === 'forgot_request' && (
              <div className="space-y-3.5 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-center">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 mb-1.5">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-900">
                    Reset Your Password
                  </h3>
                  <p className="text-[11px] text-blue-700/90 mt-0.5">
                    Enter your email or username. We'll send a 6-digit verification code to reset your password.
                  </p>
                </div>

                <form onSubmit={handleForgotRequestSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Email or Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="e.g. mdrrmo@gmail.com or username"
                        autoComplete="username"
                        autoFocus
                        required
                        className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-50/80 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm min-h-[38px] sm:min-h-[40px]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-700/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm min-h-[40px] sm:min-h-[42px] cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Sending Code...' : (
                      <>
                        <span>Send Verification Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP: FORGOT PASSWORD RESET */}
            {step === 'forgot_reset' && (
              <form onSubmit={handleForgotResetSubmit} className="space-y-3 animate-in fade-in slide-in-from-right-3 duration-200">
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-2.5 text-center">
                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 mb-1">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-900">
                    Enter Verification Code &amp; New Password
                  </h3>
                  <p className="text-[11px] text-blue-700/90 mt-0.5">
                    Sent to <strong className="font-semibold">{forgotMaskedEmail}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    6-Digit Code
                  </label>
                  <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handleForgotOtpPaste}>
                    {forgotOtpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { forgotOtpRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        disabled={isLoading}
                        onChange={(e) => handleForgotOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleForgotOtpKeyDown(idx, e)}
                        className={`w-10 h-10 sm:w-11 sm:h-11 text-center text-lg sm:text-xl font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                          digit
                            ? 'border-blue-600 bg-blue-50/30 text-blue-900 font-extrabold'
                            : 'border-slate-300 bg-slate-50/60 text-slate-800'
                        } focus:ring-blue-500/20 focus:border-blue-500`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400 text-[10px] sm:text-[11px]">
                      Expires in 10 minutes
                    </span>
                    <button
                      type="button"
                      disabled={!canResendForgot || isResendingForgot}
                      onClick={handleForgotResendOtp}
                      className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer disabled:cursor-not-allowed text-[11px]"
                    >
                      <RefreshCw className={`w-3 h-3 ${isResendingForgot ? 'animate-spin' : ''}`} />
                      {canResendForgot ? 'Resend Code' : `Resend in ${forgotCooldown}s`}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="w-full pl-9 pr-9 py-2 bg-slate-50/80 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm min-h-[38px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="w-full pl-9 pr-9 py-2 bg-slate-50/80 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs sm:text-sm min-h-[38px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || forgotOtpDigits.join('').length < 6 || !newPassword}
                  className="w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-700/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm min-h-[40px] sm:min-h-[42px] cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting Password...' : (
                    <>
                      <span>Reset Password &amp; Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </form>
            )}

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
