import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import {
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { authService, AuthError } from '../services/authService';

export default function Register() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Animation variants
  const cardVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 20,
      scale: shouldReduceMotion ? 1 : 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      },
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -14,
      scale: shouldReduceMotion ? 1 : 0.98,
      transition: {
        duration: 0.25,
        ease: [0.25, 1, 0.5, 1],
      },
    },
  };

  const formStaggerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
        delayChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  const formItemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.36,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const iconSpringVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.4,
      rotate: shouldReduceMotion ? 0 : -15,
    },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring',
        stiffness: 340,
        damping: 20,
        delay: 0.08,
      },
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !fullName.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (username.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || cleanUsername.length > 50) {
        setErrorMessage('Username must be between 3 and 50 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
        setErrorMessage('Username can only contain letters, numbers, periods, underscores, and hyphens.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await authService.register({
        token: token!,
        email: email.trim().toLowerCase(),
        password,
        username: username.trim() || undefined,
        full_name: fullName.trim(),
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof AuthError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Registration failed. Please check your invitation link and try again.');
      }
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-slate-50/80 p-4 py-8">
      <AnimatePresence mode="wait">
        {!token ? (
          <motion.div
            key="invalid-token"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center"
          >
            <motion.div
              variants={iconSpringVariants}
              className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm"
            >
              <AlertCircle className="w-7 h-7 text-red-600" />
            </motion.div>
            <h2 className="text-slate-800 font-bold text-xl mb-2">Invalid Invite Link</h2>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              No invitation token was found in this link. Please ask your System Administrator for a valid invite link.
            </p>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.985 }}>
              <Link
                to="/login"
                className="block w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-700/20 text-sm"
              >
                Go to Login
              </Link>
            </motion.div>
          </motion.div>
        ) : success ? (
          <motion.div
            key="success-screen"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-green-100 p-8 text-center"
          >
            <motion.div
              variants={iconSpringVariants}
              className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-200 shadow-sm"
            >
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </motion.div>
            <h2 className="text-slate-800 font-bold text-xl mb-2">Account Created!</h2>
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              Your invitation was accepted and your account has been created.
            </p>
            <p className="text-xs text-slate-400">Redirecting to login page...</p>
          </motion.div>
        ) : (
          <motion.div
            key="register-form"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 p-6 sm:p-7 text-white text-center">
              <Link
                to="/"
                title="Return to Landing Page"
                className="group inline-flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl p-1 transition-all"
              >
                <motion.div
                  variants={iconSpringVariants}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  className="w-14 h-14 rounded-full overflow-hidden shadow-lg ring-2 ring-white/30 group-hover:ring-white/60 transition-all duration-200 bg-white flex items-center justify-center mx-auto mb-2.5"
                >
                  <img
                    src="/Responde_Logo.png"
                    alt="RESPONDE Logo"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide group-hover:text-blue-100 transition-colors">
                  Personnel Registration
                </h1>
              </Link>
              <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-xs mx-auto">
                Talisay MDRRMO Command Center Invitation
              </p>
            </div>

            {/* Form */}
            <motion.div
              variants={formStaggerVariants}
              initial="hidden"
              animate="visible"
              className="p-6 sm:p-8"
            >
              <AnimatePresence mode="wait">
                {errorMessage && (
                  <motion.div
                    key="form-error"
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-600 text-xs shadow-xs"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Email */}
                <motion.div variants={formItemVariants}>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Official Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. officer@mdrrmo.gov.ph"
                      required
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </motion.div>

                {/* Full Name */}
                <motion.div variants={formItemVariants}>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      required
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </motion.div>

                {/* Username (Optional) */}
                <motion.div variants={formItemVariants}>
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
                      placeholder="e.g. jdelacruz (leave empty to use email)"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </motion.div>

                {/* Password */}
                <motion.div variants={formItemVariants}>
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
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Confirm Password */}
                <motion.div variants={formItemVariants}>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type your password"
                      required
                      minLength={6}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Submit button */}
                <motion.div variants={formItemVariants}>
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={!isSubmitting ? { scale: 1.01 } : undefined}
                    whileTap={!isSubmitting ? { scale: 0.985 } : undefined}
                    className="w-full py-3 px-4 mt-3 bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </form>

              {/* Footer */}
              <motion.div
                variants={formItemVariants}
                className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-400"
              >
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium">
                  Sign In
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
