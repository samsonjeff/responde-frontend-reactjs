import { useEffect, useState } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { LogOut, X, Loader2 } from 'lucide-react';
import type { AuthUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
  user?: AuthUser | null;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: 12 },
};

const springTransition: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 340,
};

function formatRole(role?: string | null): string {
  if (!role) return 'Staff';
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function SignOutModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  user: propUser,
}: SignOutModalProps) {
  const { user: authUser } = useAuth();
  const user = propUser !== undefined ? propUser : authUser;
  const [imgError, setImgError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatar_url || (user as { avatar?: string | null })?.avatar || (user as { picture?: string | null })?.picture || null
  );

  useEffect(() => {
    const direct = user?.avatar_url || (user as { avatar?: string | null })?.avatar || (user as { picture?: string | null })?.picture || null;
    if (direct) {
      setAvatarUrl(direct);
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const meta = data.session?.user?.user_metadata;
      const metaAvatar = meta?.avatar_url || meta?.picture || meta?.avatar || null;
      if (metaAvatar) {
        setAvatarUrl(metaAvatar);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  // Lock background scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  const displayName = user?.full_name || user?.username || 'User';
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="signout-modal-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!isLoading) onClose();
          }}
          aria-hidden={!isOpen}
        >
          <motion.div
            key="signout-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-modal-title"
            aria-describedby="signout-modal-desc"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springTransition}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/80 dark:border-white/10 shadow-[0_24px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] p-6 sm:p-7 relative overflow-hidden"
          >
            {/* Ambient background accent */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 dark:bg-red-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Top Close Button */}
            <button
              id="close-signout-modal-btn"
              type="button"
              onClick={onClose}
              disabled={isLoading}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center text-center">
              {/* Icon Container */}
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center mb-4 shadow-xs">
                <LogOut className="w-6 h-6 sm:w-7 sm:h-7 translate-x-0.5" strokeWidth={2} />
              </div>

              {/* Title & Description */}
              <h3
                id="signout-modal-title"
                className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white tracking-tight"
              >
                Do you want to sign out?
              </h3>
              <p
                id="signout-modal-desc"
                className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-xs"
              >
                You will be signed out of your session and redirected to the login screen.
              </p>

              {/* Current user card summary */}
              {user && (
                <div className="w-full mt-4 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/5 flex items-center gap-3 text-left">
                  {avatarUrl && !imgError ? (
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-white dark:ring-slate-800 shadow-xs">
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-600 dark:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white dark:ring-slate-800">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {displayName}
                    </p>
                    {user.email && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                    {formatRole(user.role)}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full mt-6 grid grid-cols-2 gap-3">
                <button
                  id="cancel-signout-btn"
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-slate-700/80 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="confirm-signout-btn"
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
