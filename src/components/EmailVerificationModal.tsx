import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Mail, AlertCircle, RefreshCw, X, ArrowRight, Loader2 } from 'lucide-react';

export interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend?: () => Promise<void>;
  title?: string;
  subtitle?: string;
  maskedEmail?: string;
  actionButtonText?: string;
  error?: string | null;
  isLoading?: boolean;
}

export function EmailVerificationModal({
  isOpen,
  onClose,
  onVerify,
  onResend,
  title = 'Email Verification Required',
  subtitle = 'Please enter the 6-digit verification code sent to your authorized email address.',
  maskedEmail,
  actionButtonText = 'Verify & Proceed',
  error: externalError,
  isLoading: externalLoading = false,
}: EmailVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const error = externalError || internalError;
  const isLoading = externalLoading || internalLoading;

  // Reset digits and focus on open
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setInternalError(null);
      setCooldown(60);
      setCanResend(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Cooldown countdown
  useEffect(() => {
    if (!isOpen || cooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric characters
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Single character input
    const char = clean.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setInternalError(null);

    // Auto-advance to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // If 6th digit entered, auto submit if all filled
      const fullCode = next.join('');
      if (fullCode.length === 6) {
        handleConfirm(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);
    setInternalError(null);

    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();

    if (pasted.length === 6) {
      handleConfirm(pasted);
    }
  };

  const handleConfirm = async (codeToSubmit?: string) => {
    const code = codeToSubmit || digits.join('');
    if (code.length < 6) {
      setInternalError('Please enter all 6 digits of your verification code.');
      return;
    }

    setInternalLoading(true);
    setInternalError(null);
    try {
      await onVerify(code);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Verification code failed. Please try again.');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !onResend || isLoading) return;
    setInternalLoading(true);
    setInternalError(null);
    try {
      await onResend();
      setCooldown(60);
      setCanResend(false);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200/80 dark:border-blue-700/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Two-Factor Security Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {subtitle}
          </p>

          {maskedEmail && (
            <div className="mt-3 py-2 px-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Sent to: <strong className="font-semibold">{maskedEmail}</strong></span>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200/80 dark:border-red-900/50 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 6 Digit Inputs */}
          <div className="mt-6 flex justify-between gap-2 sm:gap-2.5" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                disabled={isLoading}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                  digit
                    ? 'border-blue-600 bg-blue-50/30 text-blue-900 dark:text-blue-200 dark:border-blue-500'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100'
                } focus:ring-blue-500/20 focus:border-blue-500`}
              />
            ))}
          </div>

          {/* Resend Cooldown */}
          <div className="mt-5 flex items-center justify-between text-xs">
            <span className="text-slate-400 dark:text-slate-500">
              Code expires in 10 minutes
            </span>
            {onResend && (
              <button
                type="button"
                disabled={!canResend || isLoading}
                onClick={handleResend}
                className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {canResend ? 'Resend Code' : `Resend in ${cooldown}s`}
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-1/3 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleConfirm()}
              disabled={isLoading || digits.join('').length < 6}
              className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-700/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>{actionButtonText}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center text-[10px] text-slate-400">
          Secured by MDRRMO Talisay Disaster Command Center &bull; Brevo SMTP
        </div>
      </div>
    </div>
  );
}
export default EmailVerificationModal;
