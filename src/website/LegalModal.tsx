import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { PrivacyPolicyContent } from './PrivacyPolicy';
import { TermsOfUseContent } from './TermsOfUse';

export type LegalDoc = 'privacy' | 'terms';

const TITLES: Record<LegalDoc, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
};

export default function LegalModal({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [doc, onClose]);

  return (
    <AnimatePresence>
      {doc && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={TITLES[doc]}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-end border-b border-slate-200 px-5 py-3 sm:px-7">
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${TITLES[doc]}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-6 sm:px-8">
              {doc === 'privacy' ? <PrivacyPolicyContent /> : <TermsOfUseContent />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
