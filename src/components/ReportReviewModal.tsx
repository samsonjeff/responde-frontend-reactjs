import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertOctagon, AlertTriangle, Clock, User, MessageSquare,
  Bot, FileText, Phone, Globe, Send, ShieldCheck, RotateCcw, Check,
  Search, ChevronDown, X, MapPinned,
} from 'lucide-react';
import { getPhilippineTimestampNow, formatPhilippineTimeOnly } from '../utils/dateUtils';
import { useReports } from '../context/ReportsContext';
import { useBotConversations, type BotMessage } from '../context/BotConversationsContext';
import {
  isReportIncomplete, getIncompleteReasons, formatReportCode, type Report,
} from '../services/incidentService';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';
import { BASE_INCIDENT_TYPES } from '../services/incidentService';

export interface ReportReviewModalProps {
  report: Report;
  onClose: () => void;
}

/**
 * Restores a rejected report back to the review queue.
 * Shared by the review modal and the reports table (which passes its own notify).
 */
const APPLE_SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.8 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// ── Animation presets (Apple HIG & Emil Kowalski craft bar) ──
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

const MODAL_TRANSITION = {
  opacity: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  scale: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
  y: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
} as const;

// ── Toast Type ──
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Toast Item Component (Apple Floating Notification) ──
export function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === 'success'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
    : toast.type === 'error'
      ? <AlertOctagon className="w-4 h-4 text-rose-500" strokeWidth={1.75} />
      : <AlertTriangle className="w-4 h-4 text-blue-500" strokeWidth={1.75} />;

  const borderTint = toast.type === 'success'
    ? 'border-emerald-500/20'
    : toast.type === 'error'
      ? 'border-rose-500/20'
      : 'border-blue-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={APPLE_SPRING}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${borderTint} shadow-[0_10px_30px_rgba(0,0,0,0.12)] bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl min-w-70 max-w-95`}
    >
      {icon}
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="relative w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90 cursor-pointer after:absolute after:-inset-2.5 after:content-['']"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </motion.div>
  );
}

// ── Review Modal Scrollable Barangay Select ──
interface BarangaySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
}

function BarangaySelect({ value, onChange, options }: BarangaySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
      if (listRef.current) {
        const selectedEl = listRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null;
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [isOpen]);

  const allOptions = useMemo(() => {
    const list = ['Unknown', ...options];
    if (value && value !== 'Unknown' && value !== 'None' && !list.includes(value)) {
      list.unshift(value);
    }
    return list;
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return allOptions;
    const query = searchTerm.toLowerCase().trim();
    return allOptions.filter(opt => opt.toLowerCase().includes(query));
  }, [allOptions, searchTerm]);

  const isPlaceholder = !value || value.toLowerCase() === 'unknown' || value.toLowerCase() === 'none';

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-40' : 'z-10'}`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] cursor-pointer select-none shadow-2xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${isPlaceholder ? 'text-slate-400 dark:text-slate-500 font-normal' : 'text-slate-800 dark:text-slate-100 font-medium'}`}>
          {isPlaceholder ? 'Unknown' : value}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#0071E3]' : ''}`}
          strokeWidth={1.75}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Search filter */}
            <div className="p-2 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" strokeWidth={1.75} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search barangay..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Scrollable List */}
            <div
              ref={listRef}
              role="listbox"
              className="max-h-52 overflow-y-auto overscroll-contain py-1 text-xs sm:text-sm divide-y divide-slate-100/60 dark:divide-white/5"
              style={{ scrollbarWidth: 'thin' }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  No barangay matching &ldquo;{searchTerm}&rdquo;
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = opt === 'Unknown'
                    ? (!value || value.toLowerCase() === 'none' || value.toLowerCase() === 'unknown')
                    : value === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-[#0071E3] dark:text-sky-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400 shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
  const getRejectionLabel = (reason: string | null) => {
    switch (reason) {
      case 'spam_or_fake': return 'Spam / Fake';
      case 'duplicate': return 'Duplicate';
      case 'outside_jurisdiction': return 'Outside Jurisdiction';
      case 'not_disaster_related': return 'Not Disaster-Related';
      case 'insufficient_info': return 'Insufficient Info';
      default: return reason || '';
    }
  };

// Status badge for the review modal. Mirrors the reports table badge, except
// the table version also keys off the active tab — inside the modal only the
// incomplete rule applies, which matches what the table shows for these reports.
function getModalStatusBadge(status: Report['status'], isIncomplete: boolean) {
  if (isIncomplete && (status === 'pending' || status === 'under_review')) {
    return (
      <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>Incomplete</span>
      </span>
    );
  }
  switch (status) {
    case 'pending':
    case 'under_review':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
          <span>Under Review</span>
        </span>
      );
    case 'verified':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Verified</span>
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          <span>Resolved</span>
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Rejected</span>
        </span>
      );
    default:
      return null;
  }
}

// Builds the review form's initial values from the report (previously done in openReview).
function buildInitialEditForm(report: Report): Partial<Report> {
  const initialType = (!report.type || report.type.toLowerCase() === 'unclassified' || report.type.toLowerCase() === 'none') ? 'Unknown' : report.type;
  const rawAction = report.action || '';
  const cleanAction = rawAction.trim().toLowerCase() === 'draft saved' ? '' : rawAction;
  const rawActionTaken = report.actionTaken || '';
  const cleanActionTaken = rawActionTaken.trim().toLowerCase() === 'draft saved' ? '' : rawActionTaken;
  return {
    ...report,
    type: initialType,
    coordinates: report.coordinates || '',
    contact: report.contact === '—' ? '' : (report.contact || ''),
    action: cleanAction,
    actionTaken: cleanActionTaken,
  };
}

export default function ReportReviewModal({ report, onClose }: ReportReviewModalProps) {
  const { reports, contextUpdateReport } = useReports();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const requestClose = () => setOpen(false);
  // ── Toast State ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Edit form state inside modal
  const [editForm, setEditForm] = useState<Partial<Report>>(() => buildInitialEditForm(report));
  const [checklist, setChecklist] = useState({
    barangayCorrect: false,
    typeAccurate: false,
    locationReal: false,
    notDuplicate: false,
    urgencyAppropriate: false,
  });
  const allChecklistChecked = Object.values(checklist).every(Boolean);
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showIncompletePanel, setShowIncompletePanel] = useState(false);
  const [incompleteReasonChoice, setIncompleteReasonChoice] = useState<'barangay' | 'type' | 'both'>('both');
  const rejectPanelRef = useRef<HTMLDivElement>(null);
  const incompletePanelRef = useRef<HTMLDivElement>(null);
  const rejectReasonSelectRef = useRef<HTMLSelectElement>(null);

  // The action panels render inside the scrollable modal body, below the fold.
  // Bring the opened panel into view so the footer buttons visibly do something.
  useEffect(() => {
    if (showRejectPanel) {
      rejectPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      window.setTimeout(() => rejectReasonSelectRef.current?.focus({ preventScroll: true }), 300);
    }
  }, [showRejectPanel]);

  useEffect(() => {
    if (showIncompletePanel) {
      incompletePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showIncompletePanel]);

  // ── Validation State ──
  const [coordError, setCoordError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // ── Incomplete detection for review modal ──
  const isModalReportIncomplete = useMemo(() => {
    if (!report) return false;
    const b = (editForm.barangay !== undefined ? editForm.barangay : report.barangay) || '';
    const t = (editForm.type !== undefined ? editForm.type : report.type) || '';
    return isReportIncomplete({ barangay: b, type: t });
  }, [report, editForm.barangay, editForm.type]);

  const modalIncompleteReasons = useMemo(() => {
    if (!report) return [];
    const b = (editForm.barangay !== undefined ? editForm.barangay : report.barangay) || '';
    const t = (editForm.type !== undefined ? editForm.type : report.type) || '';
    return getIncompleteReasons({ barangay: b, type: t });
  }, [report, editForm.barangay, editForm.type]);

  // ── Bot conversation thread for the review modal ──
  const { conversations: botConversations } = useBotConversations();
  const isBotReport = report?.source === 'Bot';
  const isScraperReport = report?.source === 'Scraper';
  const botThread = useMemo<BotMessage[]>(() => {
    if (!report || report.source !== 'Bot') return [];
    if (report.threadMessages && report.threadMessages.length > 0) {
      return report.threadMessages;
    }
    const reportTime = new Date(report.createdAt || 0).getTime();
    const sessions = botConversations.filter((c) => c.psid === report.senderPsid);
    const session =
      sessions.find((c) => c.messages.some((m) => m.timestamp && new Date(m.timestamp).getTime() === reportTime)) ??
      sessions[0];
    if (session && session.messages.length > 0) return session.messages;
    return [{ sender: 'user', text: report.originalText, timestamp: report.createdAt || '' }];
  }, [report, botConversations]);

  const availableIncidentTypes = useMemo(() => {
    const set = new Set<string>(['Unknown', ...BASE_INCIDENT_TYPES]);
    reports.forEach(r => {
      const norm = (r.type || '').trim().toLowerCase();
      if (r.type && norm && r.type !== 'All Types' && norm !== 'unclassified' && norm !== 'none' && norm !== 'unknown') {
        set.add(r.type);
      }
    });
    const editNorm = (editForm.type || '').trim().toLowerCase();
    if (editForm.type && editNorm && editForm.type !== 'All Types' && editNorm !== 'unclassified' && editNorm !== 'none' && editNorm !== 'unknown') {
      set.add(editForm.type);
    }
    return Array.from(set).filter(t => t.toLowerCase() !== 'unclassified').sort((a, b) => {
      if (a === 'Unknown') return -1;
      if (b === 'Unknown') return 1;
      return a.localeCompare(b);
    });
  }, [reports, editForm.type]);

  const validateCoordinates = (coords: string): boolean => {
    const pattern = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/;
    return pattern.test(coords.trim());
  };

  const formatCoordinates = (value: string): string => {
    return value.replace(/[^0-9.,\-\s]/g, '');
  };

  const handleSaveChanges = async () => {
    if (!report || !editForm) return;
    const targetId = report.id;
    const actionDesc = editForm.action || 'Updated report details';
    const updated = {
      ...report,
      ...editForm,
      action: actionDesc,
      actionTaken: actionDesc,
    } as Report;
    requestClose();

    try {
      const ok = await contextUpdateReport(targetId, updated);
      showToast(
        ok ? `Report #${targetId} changes saved` : `Failed to save changes for report #${targetId}. Please try again.`,
        ok ? 'info' : 'error'
      );
    } catch (err) {
      console.error('Failed to save changes:', err);
      showToast(`Failed to save changes for report #${targetId}. Please try again.`, 'error');
    }
  };

  const handleMarkIncomplete = async () => {
    if (!report) return;
    const targetId = report.id;
    const newBarangay = (incompleteReasonChoice === 'barangay' || incompleteReasonChoice === 'both')
      ? 'Unknown'
      : (editForm.barangay || report.barangay || 'Unknown');
    const newType = (incompleteReasonChoice === 'type' || incompleteReasonChoice === 'both')
      ? 'Unknown'
      : (editForm.type || report.type || 'Unknown');
    const reasonText = incompleteReasonChoice === 'barangay'
      ? 'Missing Barangay'
      : incompleteReasonChoice === 'type'
        ? 'Incident not mentioned'
        : 'Missing Barangay and Incident';
    const actionDesc = `Flagged as incomplete (${reasonText})`;

    const updated: Report = {
      ...report,
      ...editForm,
      barangay: newBarangay,
      type: newType,
      status: 'under_review',
      action: actionDesc,
      actionTaken: actionDesc,
    };

    try {
      const ok = await contextUpdateReport(targetId, updated);
      if (ok) {
        requestClose();
      }
      showToast(
        ok ? `Report #${targetId} moved to Incomplete tab (${reasonText})` : `Failed to move report #${targetId} to Incomplete. Please try again.`,
        ok ? 'info' : 'error'
      );
    } catch (err) {
      console.error('Failed to mark report incomplete:', err);
      showToast(`Failed to move report #${targetId} to Incomplete. Please try again.`, 'error');
    }
  };

  const handleVerify = async () => {
    if (!report || !editForm) return;

    // Guard: Report must be complete before it can be verified
    const currentBarangay = (editForm.barangay || report.barangay || '').trim();
    const currentType = (editForm.type || report.type || '').trim();
    if (isReportIncomplete({ barangay: currentBarangay, type: currentType })) {
      const reasons = getIncompleteReasons({ barangay: currentBarangay, type: currentType });
      showToast(`Cannot verify incomplete report. Please resolve: ${reasons.join(', ')}`, 'error');
      return;
    }

    const rawCoords = (editForm.coordinates || '').trim();
    if (rawCoords) {
      if (!validateCoordinates(rawCoords)) {
        setCoordError(true);
        setShakeKey(prev => prev + 1);
        showToast('Invalid coordinates format. Use: lat, lng', 'error');
        return;
      }
      setCoordError(false);
    }

    const now = getPhilippineTimestampNow();
    const actionDesc = editForm.action || 'Verified and plotted on map';
    const updated: Report = {
      ...report,
      ...editForm,
      coordinates: rawCoords,
      status: 'verified',
      verifiedBy: 'MDRRMO Officer',
      verifiedAt: now,
      rejectionReason: null,
      action: actionDesc,
      actionTaken: actionDesc,
    };

    requestClose();

    try {
      const ok = await contextUpdateReport(report.id, updated);
      showToast(
        ok
          ? `Report #${report.id} verified and plotted on map`
          : `Failed to save verification for report #${report.id}. Please try again.`,
        ok ? 'success' : 'error'
      );
    } catch (err) {
      console.error('Failed to persist verification:', err);
      showToast(`Failed to save verification for report #${report.id}. Please try again.`, 'error');
    }
  };

  const handleResolve = async () => {
    if (!report) return;
    const targetId = report.id;
    const actionDesc = editForm.action || 'Marked as resolved';
    const updated: Report = {
      ...report,
      ...editForm,
      status: 'resolved',
      action: actionDesc,
      actionTaken: actionDesc,
    };
    requestClose();

    try {
      const ok = await contextUpdateReport(targetId, updated);
      showToast(
        ok ? `Report #${targetId} marked as resolved` : `Failed to resolve report #${targetId}. Please try again.`,
        ok ? 'success' : 'error'
      );
    } catch (err) {
      console.error('Failed to persist resolve action:', err);
      showToast(`Failed to resolve report #${targetId}. Please try again.`, 'error');
    }
  };

  const handleReject = async () => {
    if (!report || !rejectReason) return;
    const targetId = report.id;
    const reasonLabel = getRejectionLabel(rejectReason);
    const actionDesc = editForm.action || `Rejected: ${reasonLabel}`;
    const updated: Report = {
      ...report,
      ...editForm,
      status: 'rejected',
      rejectionReason: rejectReason,
      verifiedBy: null,
      verifiedAt: null,
      action: actionDesc,
      actionTaken: actionDesc,
    };
    try {
      const ok = await contextUpdateReport(targetId, updated);
      if (ok) {
        requestClose();
      }
      showToast(
        ok ? `Report #${targetId} rejected: ${reasonLabel}` : `Failed to reject report #${targetId}. Please try again.`,
        ok ? 'success' : 'error'
      );
    } catch (err) {
      console.error('Failed to persist rejection:', err);
      showToast(`Failed to reject report #${targetId}. Please try again.`, 'error');
    }
  };

  const handleRestore = async (id: string) => {
    const target = reports.find(r => r.id === id);
    const isIncomplete = target ? isReportIncomplete(target) : false;
    const destination = isIncomplete ? 'Incomplete' : 'Under Review';
    const code = formatReportCode(id, target?.source);
    try {
      const ok = await contextUpdateReport(id, {
        status: 'under_review',
        rejectionReason: null,
        action: `Restored to ${destination}`,
        actionTaken: `Restored to ${destination}`,
      });
      showToast(
        ok ? `Report ${code} restored to ${destination}` : `Failed to restore report ${code}. Please try again.`,
        ok ? 'info' : 'error'
      );
    } catch (err) {
      console.error('Failed to persist restore:', err);
      showToast(`Failed to restore report ${code}. Please try again.`, 'error');
    }
  };
  return (
    <>
      <div className="fixed top-4 right-4 z-[250] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence onExitComplete={onClose}>
        {open && (

      <AnimatePresence>
          <motion.div
            key="review-modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md"
            onClick={requestClose}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={MODAL_TRANSITION}
              className="bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col transform-gpu will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-white/10 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md shrink-0 rounded-t-2xl sm:rounded-t-3xl z-10">
                <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 min-w-0">
                  <span
                    className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10"
                    title={`Original ID: ${report.id}`}
                  >
                    {formatReportCode(report.id, report.source)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline max-w-[200px] truncate" title={report.id}>
                    ({report.id})
                  </span>
                  {getModalStatusBadge(report.status, isReportIncomplete(report))}
                  {report.possibleDuplicateOf && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      <AlertTriangle className="w-3 h-3 text-amber-500" strokeWidth={1.75} />
                      <span>Duplicate #{report.possibleDuplicateOf}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  className="relative w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90 shrink-0 cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
                  title="Close Modal"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Modal Body */}
              <div
                className="px-4 sm:px-6 py-4 sm:py-5 pb-10 space-y-5 sm:space-y-6 overflow-y-auto"
                style={{
                  maxHeight: 'calc(92vh - 130px)',
                  maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                  {/* LEFT: Original Report / Chat Thread */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isBotReport ? <Bot className="w-3.5 h-3.5" strokeWidth={1.75} /> : <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />}
                      <span>{isBotReport ? 'Bot Conversation' : 'Original Report'}</span>
                    </div>

                    {isBotReport ? (
                      <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl border border-slate-200/70 dark:border-white/10 overflow-hidden flex flex-col">
                        {/* Header row: user, source, date */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200/60 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
                            <span className="truncate font-semibold">{report.reporter}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span>{report.source}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span>{report.time}</span>
                          </span>
                        </div>

                        {/* Scrollable chat thread */}
                        <div
                          className="h-72 overflow-y-auto p-4 pb-8 space-y-3 bg-slate-50/40 dark:bg-[#0B0F17]/40"
                          style={{
                            maskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                          }}
                        >
                          {botThread.map((msg, idx) =>
                            msg.sender === 'bot' ? (
                              <div key={idx} className="flex items-end gap-2 justify-end">
                                <div className="flex flex-col items-end max-w-[82%]">
                                  <div className="bg-[#0071E3] text-white rounded-[18px] rounded-br-[4px] px-3.5 py-2.5 shadow-xs">
                                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 mr-1 font-medium">
                                    {formatPhilippineTimeOnly(msg.timestamp)}
                                  </span>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[11px] font-bold text-[#0071E3] dark:text-blue-400 shrink-0 mb-4 ring-1 ring-blue-500/20">
                                  <Bot className="w-3.5 h-3.5" strokeWidth={1.75} />
                                </div>
                              </div>
                            ) : (
                              <div key={idx} className="flex items-end gap-2 justify-start">
                                <div className="w-7 h-7 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-4 ring-1 ring-black/5">
                                  {(report.reporter || '?').trim().charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col items-start max-w-[82%]">
                                  <div className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-[18px] rounded-bl-[4px] px-3.5 py-2.5">
                                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1 font-medium">
                                    {formatPhilippineTimeOnly(msg.timestamp)}
                                  </span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl p-4.5 border border-slate-200/70 dark:border-white/10 space-y-3.5">
                        <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                          &quot;{report.originalText}&quot;
                        </p>
                        <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 grid grid-cols-2 gap-2.5 text-xs">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span className="truncate">{report.reporter}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span className="truncate">{report.contact || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            {(report.source || '').trim().toLowerCase() === 'scraper' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                <Globe className="w-3 h-3" strokeWidth={1.75} /> Scraper
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-[#0071E3] dark:text-sky-400 border border-blue-500/20">
                                <Bot className="w-3 h-3" strokeWidth={1.75} /> Bot
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span className="truncate">{report.time}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {report.verifiedBy && (
                      <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Verified by {report.verifiedBy} at {report.verifiedAt}</span>
                        </p>
                      </div>
                    )}

                    {report.rejectionReason && (
                      <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                        <p className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                          <AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Rejected: {getRejectionLabel(report.rejectionReason)}</span>
                        </p>
                      </div>
                    )}

                    {report.action && report.action.trim().toLowerCase() !== 'draft saved' && (
                      <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                        <p className="text-xs text-[#0071E3] dark:text-sky-400 font-semibold flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Action: {report.action}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Officer Edit Form */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0071E3]" strokeWidth={1.75} />
                      <span>Officer Review</span>
                    </div>

                    <div className="space-y-3">
                      {/* Incomplete warning banner */}
                      {isModalReportIncomplete && (
                        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex items-start gap-3">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                                Incomplete / Out of Scope
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold">
                                {modalIncompleteReasons.join(' • ')}
                              </span>
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                              Assign a valid Barangay and a disaster Type before verifying. Reports with unknown barangays or out-of-scope types cannot be plotted on the geospatial map.
                            </p>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Barangay</label>
                        <BarangaySelect
                          value={editForm.barangay || ''}
                          options={TALISAY_BARANGAYS}
                          onChange={selected => {
                            setEditForm(prev => ({
                              ...prev,
                              barangay: selected,
                            }));
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Type</label>
                          <select
                            value={editForm.type || 'Unknown'}
                            onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none transition-all cursor-pointer shadow-2xs"
                          >
                            {availableIncidentTypes.map(t => (
                              <option key={t} value={t}>
                                {t === 'Unknown' ? 'Unknown (Incident Not Mentioned / Out of Scope)' : t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Urgency</label>
                          <select
                            value={editForm.urgency || 'Low'}
                            onChange={e => setEditForm(prev => ({ ...prev, urgency: e.target.value }))}
                            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none transition-all cursor-pointer shadow-2xs"
                          >
                            {['Critical', 'High', 'Moderate', 'Low'].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Landmark</label>
                        <input
                          type="text"
                          value={editForm.landmark || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, landmark: e.target.value }))}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none transition-all shadow-2xs"
                          placeholder="e.g. Near 7-Eleven, in front of school..."
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={editForm.contact || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, contact: e.target.value }))}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none font-mono transition-all shadow-2xs"
                          placeholder="e.g. 0912-345-6789"
                        />
                      </div>

                      <motion.div
                        key={shakeKey}
                        animate={coordError ? { x: [0, -6, 6, -6, 6, -3, 3, 0] } : { x: 0 }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                            Coordinates (lat, lng)
                            {coordError && (
                              <span className="ml-2 text-rose-500 font-normal lowercase">— invalid format</span>
                            )}
                          </label>
                          {editForm.coordinates && validateCoordinates(editForm.coordinates) && (
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/geospatial?focus=${report.id}`);
                              }}
                              className="text-[11px] font-semibold text-[#0071E3] dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 flex items-center gap-1 hover:underline cursor-pointer group transition-all"
                            >
                              <MapPinned className="w-3 h-3 transition-transform duration-200 group-hover:scale-110" />
                              <span>View on Map</span>
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={editForm.coordinates || ''}
                          onChange={e => {
                            const formatted = formatCoordinates(e.target.value);
                            setEditForm(prev => ({ ...prev, coordinates: formatted }));
                            if (coordError && validateCoordinates(formatted)) {
                              setCoordError(false);
                            }
                          }}
                          className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none font-mono transition-all shadow-2xs ${coordError
                            ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/10'
                            : 'border-slate-200/80 dark:border-white/10'
                            }`}
                          placeholder="14.0951, 121.0203"
                        />
                      </motion.div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Action Taken / Response Notes
                        </label>
                        <input
                          type="text"
                          value={editForm.action || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, action: e.target.value, actionTaken: e.target.value }))}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none transition-all shadow-2xs"
                          placeholder="e.g. Dispatched rescue boat, verified with Barangay Captain..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification Checklist */}
                {(report.status === 'pending' || report.status === 'under_review') && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0071E3]" />
                        <span>Verification Checklist</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const allChecked = Object.values(checklist).every(Boolean);
                          setChecklist({
                            barangayCorrect: !allChecked,
                            typeAccurate: !allChecked,
                            locationReal: !allChecked,
                            notDuplicate: !allChecked,
                            urgencyAppropriate: !allChecked,
                          });
                        }}
                        className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                      >
                        {Object.values(checklist).every(Boolean) ? 'Uncheck All' : 'Check All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          key: 'barangayCorrect',
                          label: isBotReport
                            ? 'Barangay & phone number verified'
                            : isScraperReport
                              ? 'Barangay & location verified'
                              : 'Barangay & coordinates verified',
                        },
                        { key: 'typeAccurate', label: 'Incident type is accurate' },
                        { key: 'locationReal', label: 'Location / landmark is real' },
                        { key: 'notDuplicate', label: 'Not a duplicate report' },
                        { key: 'urgencyAppropriate', label: 'Urgency level is appropriate' },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer select-none active:scale-[0.98] ${
                            checklist[item.key as keyof typeof checklist]
                              ? 'bg-blue-50/80 dark:bg-blue-900/25 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200'
                              : 'bg-white/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checklist[item.key as keyof typeof checklist]}
                            onChange={(e) => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="rounded-md border-slate-300 dark:border-slate-600 text-[#0071E3] focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs font-medium leading-snug">
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection Panel */}
                <AnimatePresence>
                  {showRejectPanel && (
                    <motion.div
                      initial={{ opacity: 0, scaleY: 0.95 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0.95 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      style={{ originY: 0 }}
                      ref={rejectPanelRef}
                      className="bg-rose-500/10 rounded-2xl p-4 sm:p-4.5 border border-rose-500/20 space-y-3"
                    >
                      <label className="block text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Rejection Reason
                      </label>
                      <select
                        ref={rejectReasonSelectRef}
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
                      >
                        <option value="">Select a reason...</option>
                        <option value="spam_or_fake">Spam / Fake Report</option>
                        <option value="duplicate">Duplicate Report</option>
                        <option value="outside_jurisdiction">Outside Talisay Jurisdiction</option>
                        <option value="not_disaster_related">Not Disaster-Related</option>
                        <option value="insufficient_info">Insufficient Information</option>
                      </select>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={!rejectReason}
                          className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all active:scale-[0.97] cursor-pointer"
                        >
                          Confirm Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRejectPanel(false)}
                          className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-[0.97] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Incomplete Panel */}
                <AnimatePresence>
                  {showIncompletePanel && (
                    <motion.div
                      initial={{ opacity: 0, scaleY: 0.95 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0.95 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      style={{ originY: 0 }}
                      ref={incompletePanelRef}
                      className="bg-amber-500/10 rounded-2xl p-4 sm:p-4.5 border border-amber-500/20 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.75} />
                        <label className="block text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          Mark as Incomplete
                        </label>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                        Specify what vital information is missing. The report will be moved to the <strong>Incomplete</strong> queue for follow-up.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setIncompleteReasonChoice('barangay')}
                          className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                            incompleteReasonChoice === 'barangay'
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30'
                              : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-semibold text-amber-800 dark:text-amber-300">Missing Barangay</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Location unknown / unstated</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIncompleteReasonChoice('type')}
                          className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                            incompleteReasonChoice === 'type'
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30'
                              : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-semibold text-amber-800 dark:text-amber-300">No Incident Stated</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Disaster or emergency type not mentioned</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIncompleteReasonChoice('both')}
                          className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                            incompleteReasonChoice === 'both'
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30'
                              : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-semibold text-amber-800 dark:text-amber-300">Both Missing</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Neither location nor incident known</div>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleMarkIncomplete}
                          className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all active:scale-[0.97] cursor-pointer shadow-xs"
                        >
                          Confirm & Move to Incomplete
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowIncompletePanel(false)}
                          className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-[0.97] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/70 backdrop-blur-md shrink-0 rounded-b-2xl sm:rounded-b-3xl">
                <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                  {(report.status === 'pending' || report.status === 'under_review') && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowIncompletePanel(prev => !prev);
                          setShowRejectPanel(false);
                        }}
                        className="flex-1 sm:flex-none justify-center px-4 py-2.5 min-h-[42px] text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} /> Incomplete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRejectPanel(prev => !prev);
                          setShowIncompletePanel(false);
                        }}
                        className="flex-1 sm:flex-none justify-center px-4 py-2.5 min-h-[42px] text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.75} /> Reject
                      </button>
                    </>
                  )}

                  {/* Save Changes button for verified or resolved reports */}
                  {(report.status === 'verified' || report.status === 'resolved') && (
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all active:scale-[0.97] flex items-center cursor-pointer"
                    >
                      Save Changes
                    </button>
                  )}

                  {report.status === 'verified' && (
                    <button
                      type="button"
                      onClick={handleResolve}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Mark Resolved
                    </button>
                  )}

                  {report.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRestore(report.id);
                        requestClose();
                      }}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-[#0071E3] dark:text-sky-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore to Pending
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={requestClose}
                    className="flex-1 sm:flex-none justify-center px-4 py-2.5 min-h-[42px] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all active:scale-[0.97] flex items-center cursor-pointer"
                  >
                    Close
                  </button>

                  {(report.status === 'pending' || report.status === 'under_review') && (
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={!allChecklistChecked || isModalReportIncomplete}
                      title={
                        isModalReportIncomplete
                          ? `Cannot verify: ${modalIncompleteReasons.join(', ')}`
                          : !allChecklistChecked
                            ? 'Complete the checklist first'
                            : 'Verify and plot on map'
                      }
                      className="flex-1 sm:flex-none justify-center px-5 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" strokeWidth={1.75} /> Verify & Plot
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
      </AnimatePresence>
        )}
      </AnimatePresence>
    </>
  );
}
