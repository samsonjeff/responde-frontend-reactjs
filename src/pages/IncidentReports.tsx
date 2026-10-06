import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, X, Eye, ChevronLeft, ChevronRight, ChevronDown,
  Clock, User, Phone, MessageSquare,
  CheckCircle2, AlertTriangle, RotateCcw, Send,
  ShieldCheck, FileText, AlertOctagon, MapPinned, Bot,
  Check, Search,
} from 'lucide-react';
import DatePicker from '../components/DatePicker';
import FilterDropdown from '../components/DropDown';
import { StaggerContainer, StaggerItem } from '../components/Stagger';
import PageLoader from '../components/PageLoader';
import PageTransition from '../components/Transition';

import { fetchReports, subscribeToReports, type Report, type ReportStatus } from '../services/incidentService';
import { useBotConversations, type BotMessage } from '../context/BotConversationsContext';
import { TALISAY_BARANGAYS, talisayBarangays } from '../data/talisay-barangays';

export const BASE_INCIDENT_TYPES = ['Earthquake', 'Fire', 'Flood', 'Landslide', 'None'] as const;

const formatBubbleTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// ── Apple Design Spring Physics & Ease curves ──
const APPLE_SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.8 } as const;
const APPLE_SLIDE_SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// ── Animation presets (Apple HIG & Emil Kowalski craft bar) ──
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 10 },
};

// ── Bulk bar: hardware-accelerated transform + opacity only ──
const barActionVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
};

// ── Shake animation for validation errors ──
export const shakeVariants = {
  shake: {
    x: [0, -6, 6, -6, 6, -3, 3, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};

// ── Toast Type ──
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Pagination Component (Apple Pager Style) ──
function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  const safeTotal = Math.max(totalPages, 1);
  const getPages = () => {
    const pages: (number | string)[] = [];
    if (safeTotal <= 7) {
      for (let i = 1; i <= safeTotal; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', safeTotal - 1, safeTotal);
      } else if (currentPage >= safeTotal - 2) {
        pages.push(1, 2, '...', safeTotal - 3, safeTotal - 2, safeTotal - 1, safeTotal);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', safeTotal);
      }
    }
    return pages;
  };

  // Always render pagination so controls remain accessible on all filter states

  return (
    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white/80 dark:bg-slate-800/80 backdrop-blur-md active:scale-[0.96] shadow-2xs cursor-pointer"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
      </button>

      <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-md">
        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">...</span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page as number)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-all active:scale-[0.94] cursor-pointer ${currentPage === page
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <span className="sm:hidden px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-700 rounded-xl tabular-nums shadow-2xs">
        Page {currentPage} of {safeTotal}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= safeTotal}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white/80 dark:bg-slate-800/80 backdrop-blur-md active:scale-[0.96] shadow-2xs cursor-pointer"
      >
        <span className="hidden sm:inline">Next</span><span className="sm:hidden">Next</span> <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Toast Item Component (Apple Floating Notification) ──
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === 'success'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : toast.type === 'error'
      ? <AlertOctagon className="w-4 h-4 text-red-500" />
      : <AlertTriangle className="w-4 h-4 text-blue-500" />;

  const borderTint = toast.type === 'success'
    ? 'border-emerald-500/20'
    : toast.type === 'error'
      ? 'border-red-500/20'
      : 'border-blue-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={APPLE_SPRING}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${borderTint} shadow-[0_10px_30px_rgba(0,0,0,0.12)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl min-w-70 max-w-95`}
    >
      {icon}
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"
      >
        <X className="w-3.5 h-3.5" />
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
    const list = [...options];
    if (value && value !== 'Unknown' && !list.includes(value)) {
      list.unshift(value);
    }
    return list;
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return allOptions;
    const query = searchTerm.toLowerCase().trim();
    return allOptions.filter(opt => opt.toLowerCase().includes(query));
  }, [allOptions, searchTerm]);

  const isPlaceholder = !value || value === 'Unknown';

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-40' : 'z-10'}`}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer select-none shadow-2xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${isPlaceholder ? 'text-slate-400 dark:text-slate-500 font-normal' : 'text-slate-800 dark:text-slate-100 font-medium'}`}>
          {isPlaceholder ? (value === 'Unknown' ? 'Unknown (Select Barangay)' : 'Select Barangay') : value}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
          >
            {/* Search filter */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search barangay..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Scrollable List — Fixed max-height so it is scrollable and never stretches to the bottom */}
            <div
              ref={listRef}
              role="listbox"
              className="max-h-52 overflow-y-auto overscroll-contain py-1 text-xs sm:text-sm divide-y divide-slate-100/60 dark:divide-slate-700/40"
              style={{ scrollbarWidth: 'thin' }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  No barangay matching &ldquo;{searchTerm}&rdquo;
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = value === opt;
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
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
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

export default function IncidentReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ReportStatus>('under_review');
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState('');

  // ── Load reports from Supabase (+ realtime refresh) ──
  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      try {
        const data = await fetchReports();
        if (cancelled) return;
        setReports((prev) => {
          // keep local review state (status edits) for rows we already have
          const local = new Map(prev.map((r) => [r.id, r]));
          return data.map((r) => local.get(r.id) ?? r);
        });
        setLoadError('');
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load reports.');
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    load(true);
    const unsubscribe = subscribeToReports(() => load(false));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // ── Toast State ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useState(0);
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef[0];
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Filters
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterType, setFilterType] = useState('All Types');
  const [filterUrgency, setFilterUrgency] = useState('All Urgency');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters =
    filterBarangay !== 'All Barangays' ||
    filterType !== 'All Types' ||
    filterUrgency !== 'All Urgency' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const activeFilterCount =
    (filterBarangay !== 'All Barangays' ? 1 : 0) +
    (filterType !== 'All Types' ? 1 : 0) +
    (filterUrgency !== 'All Urgency' ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  // Edit form state inside modal
  const [editForm, setEditForm] = useState<Partial<Report>>({});
  const [checklist, setChecklist] = useState({
    barangayCorrect: false,
    typeAccurate: false,
    locationReal: false,
    notDuplicate: false,
    urgencyAppropriate: false,
  });
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ── Validation State ──
  const [coordError, setCoordError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const itemsPerPage = 10;

  // ── Bot conversation thread for the review modal (existing context data) ──
  const { conversations: botConversations } = useBotConversations();
  const isBotReport = reviewingReport?.source === 'Bot';
  const isScraperReport = reviewingReport?.source === 'Scraper';
  const botThread = useMemo<BotMessage[]>(() => {
    if (!reviewingReport || reviewingReport.source !== 'Bot') return [];
    if (reviewingReport.threadMessages && reviewingReport.threadMessages.length > 0) {
      return reviewingReport.threadMessages;
    }
    const reportTime = new Date(reviewingReport.createdAt).getTime();
    const sessions = botConversations.filter((c) => c.psid === reviewingReport.senderPsid);
    const session =
      sessions.find((c) => c.messages.some((m) => m.timestamp && new Date(m.timestamp).getTime() === reportTime)) ??
      sessions[0];
    if (session && session.messages.length > 0) return session.messages;
    // Fallback: only the single message stored on the report
    return [{ sender: 'user', text: reviewingReport.originalText, timestamp: reviewingReport.createdAt }];
  }, [reviewingReport, botConversations]);

  const tabs = [
    { key: 'under_review' as const, label: 'Under Review', count: reports.filter(r => r.status === 'under_review').length },
    { key: 'verified' as const, label: 'Verified', count: reports.filter(r => r.status === 'verified').length },
    { key: 'resolved' as const, label: 'Resolved', count: reports.filter(r => r.status === 'resolved').length },
    { key: 'rejected' as const, label: 'Rejected', count: reports.filter(r => r.status === 'rejected').length },
  ];

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [activeTab, filterBarangay, filterType, filterUrgency]);

  const availableIncidentTypes = useMemo(() => {
    const set = new Set<string>(BASE_INCIDENT_TYPES);
    reports.forEach(r => {
      if (r.type && r.type.trim() && r.type !== 'All Types') {
        set.add(r.type);
      }
    });
    if (editForm.type && editForm.type.trim() && editForm.type !== 'All Types') {
      set.add(editForm.type);
    }
    return Array.from(set).sort();
  }, [reports, editForm.type]);

  const openReview = (report: Report) => {
    setReviewingReport(report);
    setEditForm({ ...report });
    setChecklist({
      barangayCorrect: false,
      typeAccurate: false,
      locationReal: false,
      notDuplicate: false,
      urgencyAppropriate: false,
    });
    setShowRejectPanel(false);
    setRejectReason('');
    setCoordError(false);
    if (report.status === 'pending') {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'under_review' } : r));
    }
  };

  const closeReview = () => {
    setReviewingReport(null);
    setEditForm({});
    setShowRejectPanel(false);
    setCoordError(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = paginatedReports.map(r => r.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const validateCoordinates = (coords: string): boolean => {
    const pattern = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/;
    return pattern.test(coords.trim());
  };

  const formatCoordinates = (value: string): string => {
    return value.replace(/[^0-9.,\-\s]/g, '');
  };

  const handleSaveDraft = () => {
    if (!reviewingReport || !editForm) return;
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, ...editForm } as Report : r));
    showToast(`Report #${reviewingReport.id} draft saved`, 'info');
    closeReview();
  };

  const handleVerify = () => {
    if (!reviewingReport || !editForm) return;
    const hasCoordinatesField = reviewingReport.source !== 'Bot' && reviewingReport.source !== 'Scraper';
    if (hasCoordinatesField) {
      const coords = editForm.coordinates || '';
      if (!validateCoordinates(coords)) {
        setCoordError(true);
        setShakeKey(prev => prev + 1);
        showToast('Invalid coordinates format. Use: lat, lng', 'error');
        return;
      }
      setCoordError(false);
    }
    const now = new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? {
      ...r,
      ...editForm,
      status: 'verified',
      verifiedBy: 'Current Officer',
      verifiedAt: now,
      rejectionReason: null,
    } as Report : r));
    showToast(hasCoordinatesField ? `Report #${reviewingReport.id} verified and plotted on map` : `Report #${reviewingReport.id} verified`, 'success');
    closeReview();
  };

  const handleResolve = () => {
    if (!reviewingReport) return;
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, status: 'resolved' } : r));
    showToast(`Report #${reviewingReport.id} marked as resolved`, 'success');
    closeReview();
  };

  const handleReject = () => {
    if (!reviewingReport || !rejectReason) return;
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? {
      ...r,
      status: 'rejected',
      rejectionReason: rejectReason,
      verifiedBy: null,
      verifiedAt: null,
    } as Report : r));
    showToast(`Report #${reviewingReport.id} rejected: ${getRejectionLabel(rejectReason)}`, 'error');
    closeReview();
  };

  const handleRestore = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'pending', rejectionReason: null } : r));
    setSelectedIds(prev => prev.filter(i => i !== id));
    showToast(`Report #${id} restored to pending`, 'info');
  };

  const handleBulkStartReview = () => {
    setReports(prev => prev.map(r => selectedIds.includes(r.id) && r.status === 'pending' ? { ...r, status: 'under_review' } : r));
    showToast(`${selectedIds.length} reports moved to Under Review`, 'info');
    setSelectedIds([]);
  };

  const handleBulkResolve = () => {
    setReports(prev => prev.map(r => selectedIds.includes(r.id) && r.status === 'verified' ? { ...r, status: 'resolved' } : r));
    showToast(`${selectedIds.length} reports marked as resolved`, 'success');
    setSelectedIds([]);
  };

  const handleBulkRestore = () => {
    setReports(prev => prev.map(r => selectedIds.includes(r.id) && r.status === 'rejected' ? { ...r, status: 'pending', rejectionReason: null } : r));
    showToast(`${selectedIds.length} reports restored to pending`, 'info');
    setSelectedIds([]);
  };

  const allChecklistChecked = Object.values(checklist).every(Boolean);

  const filteredReports = reports.filter(r => {
    if (r.status !== activeTab) return false;
    if (filterBarangay !== 'All Barangays' && r.barangay !== filterBarangay) return false;
    if (filterType !== 'All Types' && r.type !== filterType) return false;
    if (filterUrgency !== 'All Urgency' && r.urgency !== filterUrgency) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'High':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      case 'Moderate':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'Low':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Earthquake': return 'text-amber-600 dark:text-amber-400';
      case 'Fire': return 'text-rose-600 dark:text-rose-400';
      case 'Flood': return 'text-cyan-600 dark:text-cyan-400';
      case 'Landslide': return 'text-yellow-700 dark:text-yellow-500';
      case 'Search & Rescue': return 'text-orange-600 dark:text-orange-400';
      case 'Medical': return 'text-emerald-600 dark:text-emerald-400';
      case 'Food & Water': return 'text-blue-600 dark:text-blue-400';
      case 'Infrastructure': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'under_review':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'verified':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'resolved':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
      case 'rejected':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
    }
  };

  const getStatusLabel = (status: ReportStatus) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'under_review': return 'Under Review';
      case 'verified': return 'Verified';
      case 'resolved': return 'Resolved';
      case 'rejected': return 'Rejected';
    }
  };

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

  if (loading) return <PageLoader variant="incidents" />;

  return (
    <PageTransition>
      <div className="flex flex-col flex-1 min-h-0 gap-6 relative">
        {loadError && (
          <div role="alert" className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-700 dark:text-red-300">
            Could not load reports: {loadError}
          </div>
        )}

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-250 flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <div key={toast.id} className="pointer-events-auto">
                <ToastItem toast={toast} onDismiss={dismissToast} />
              </div>
            ))}
          </AnimatePresence>
        </div>

        <StaggerContainer className="flex flex-col gap-4 sm:gap-6 pb-20 sm:pb-24 md:pb-8 w-full">
          {/* Tabs — Apple macOS Segmented Control */}
          <StaggerItem>
            <div className="w-full">
              <div className="p-1 bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 grid grid-cols-2 sm:inline-flex sm:items-center gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] w-full sm:w-auto">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-150 flex items-center justify-between sm:justify-center gap-2 select-none active:scale-[0.98] cursor-pointer ${isActive
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabPill"
                          transition={APPLE_SLIDE_SPRING}
                          className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-black/4 dark:border-white/10"
                        />
                      )}
                      <span className="relative z-10 truncate">{tab.label}</span>
                      <span
                        className={`relative z-10 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full transition-colors shrink-0 ${isActive
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
                          }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </StaggerItem>

          {/* Filter Bar & Bulk Selection */}
          <StaggerItem className="relative z-30 flex flex-col gap-3">
            {/* Filter Bar — Apple Frosted Glass Toolbar */}
            <div className="relative z-30 backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-3 sm:p-4 shrink-0 border-t border-t-white/80 dark:border-t-white/10">
              {/* Mobile Filter Header Toggle */}
              <div className="flex lg:hidden items-center justify-between w-full">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${mobileFiltersOpen ? 'rotate-180' : ''}`} />
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterBarangay('All Barangays');
                      setFilterType('All Types');
                      setFilterUrgency('All Urgency');
                      setFromDate('');
                      setToDate('');
                    }}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Filter Controls — 2-column compact grid on mobile, flex row on desktop */}
              <div className={`${mobileFiltersOpen ? 'grid' : 'hidden'} lg:flex grid-cols-2 gap-2 lg:gap-3 lg:items-center pt-2.5 lg:pt-0`}>
                <div className="hidden lg:flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs font-semibold shrink-0 uppercase tracking-wider">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                  <span>Filters</span>
                </div>

                <div className="col-span-1 lg:col-span-auto">
                  <FilterDropdown
                    value={filterBarangay}
                    options={['All Barangays', ...Array.from(new Set([...TALISAY_BARANGAYS, ...reports.map(r => r.barangay)])).sort()]}
                    onChange={setFilterBarangay}
                  />
                </div>

                <div className="col-span-1 lg:col-span-auto">
                  <FilterDropdown
                    value={filterType}
                    options={['All Types', ...Array.from(new Set([...BASE_INCIDENT_TYPES, ...reports.map(r => r.type)])).filter(Boolean).sort()]}
                    onChange={setFilterType}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1 lg:col-span-auto">
                  <FilterDropdown
                    value={filterUrgency}
                    options={['All Urgency', 'High', 'Moderate', 'Low']}
                    onChange={setFilterUrgency}
                  />
                </div>

                <div className="col-span-2 lg:col-span-auto flex items-center gap-2 lg:ml-auto w-full lg:w-auto">
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                    <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">From:</span>
                    <div className="flex-1 sm:w-36">
                      <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                    <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">To:</span>
                    <div className="flex-1 sm:w-36">
                      <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Actions — Apple Floating Island */}
            <AnimatePresence mode="wait">
              {selectedIds.length > 0 && (
                <motion.div
                  key="bulk-actions"
                  variants={barActionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={APPLE_SPRING}
                  className="relative z-20 flex flex-wrap items-center justify-between gap-2.5 bg-blue-50/90 dark:bg-blue-950/40 backdrop-blur-md border border-blue-200/80 dark:border-blue-800/60 rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shrink-0 shadow-sm"
                >
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    {selectedIds.length} report{selectedIds.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeTab === 'pending' && (
                      <button
                        type="button"
                        onClick={handleBulkStartReview}
                        className="px-3.5 py-1.5 text-xs font-semibold text-amber-700 bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-700/80 dark:text-amber-300 rounded-xl hover:bg-amber-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> Start Review
                      </button>
                    )}
                    {activeTab === 'verified' && (
                      <button
                        type="button"
                        onClick={handleBulkResolve}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-700/80 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    )}
                    {activeTab === 'rejected' && (
                      <button
                        type="button"
                        onClick={handleBulkRestore}
                        className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-white dark:bg-slate-800 border border-blue-200/80 dark:border-blue-700/80 dark:text-blue-300 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore to Pending
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </StaggerItem>

          {/* Table — Apple Pro Data Table */}
          <StaggerItem className="flex flex-col flex-1 min-h-0 w-full">
            <div className="relative z-10 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="overflow-x-auto w-full flex-1">
                <table className="w-full min-w-[720px] text-sm text-left">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedReports.length > 0 && paginatedReports.every(r => selectedIds.includes(r.id))}
                          onChange={toggleSelectAll}
                          className="rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer transition-all"
                        />
                      </th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">ID</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Barangay</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Type</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Urgency</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Source</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Time</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {paginatedReports.length === 0 ? (
                      <tr className="h-full">
                        <td colSpan={9} className="h-full px-4 text-center text-slate-400 dark:text-slate-500 align-middle">
                          <div className="flex flex-col items-center justify-center py-20">
                            <span className="text-sm font-medium">No reports found.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedReports.map((report, index) => (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.25,
                            ease: EASE_OUT,
                            delay: Math.min(index * 0.025, 0.2),
                          }}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/80 group ${selectedIds.includes(report.id)
                            ? 'bg-blue-50/40 dark:bg-blue-900/15'
                            : report.status === 'pending'
                              ? 'bg-blue-50/20 dark:bg-blue-900/5'
                              : ''
                            }`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(report.id)}
                              onChange={() => toggleSelect(report.id)}
                              className="rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer transition-all"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {report.status === 'pending' && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-500/20 animate-pulse" title="Pending" />
                              )}
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
                                #{report.id}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-900 dark:text-slate-100 font-medium whitespace-nowrap">
                            {report.barangay}
                          </td>
                          <td className={`px-4 py-3.5 whitespace-nowrap font-medium text-xs ${getTypeColor(report.type)}`}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {report.type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getUrgencyColor(report.urgency)}`}>
                              {report.urgency}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(report.status)}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {getStatusLabel(report.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                              {report.source}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap font-mono">
                            {report.time}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {(report.status === 'pending' || report.status === 'under_review') && (
                                <button
                                  type="button"
                                  onClick={() => openReview(report)}
                                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Review
                                </button>
                              )}

                              {report.status === 'verified' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openReview(report)}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/geospatial?focus=${report.id}`)}
                                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                                  >
                                    <MapPinned className="w-3.5 h-3.5" /> Map
                                  </button>
                                </>
                              )}

                              {(report.status === 'resolved' || report.status === 'rejected') && (
                                <button
                                  type="button"
                                  onClick={() => openReview(report)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                              )}

                              {report.status === 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleRestore(report.id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Bottom Footer: Pagination right in the bottom of the table! */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 px-4 sm:px-6 py-3 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap shrink-0">
                  {filteredReports.length === 0
                    ? 'No reports to display'
                    : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredReports.length)} of ${filteredReports.length} reports`}
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Review & Verify Modal — Apple macOS Pro Sheet */}
        <AnimatePresence>
          {reviewingReport && editForm && (
            <motion.div
              key="review-modal-backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-2.5 sm:p-6 bg-black/40 backdrop-blur-md"
              onClick={closeReview}
            >
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={APPLE_SPRING}
                className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col transform-gpu will-change-transform"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md shrink-0 rounded-t-2xl sm:rounded-t-3xl z-10">
                  <div className="flex items-center flex-wrap gap-2 sm:gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      #{reviewingReport.id}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(reviewingReport.status)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {getStatusLabel(reviewingReport.status)}
                    </span>
                    {reviewingReport.possibleDuplicateOf && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" /> Duplicate #{reviewingReport.possibleDuplicateOf}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeReview}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
                  <StaggerContainer className="space-y-6">
                    <StaggerItem>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Original Report */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {isBotReport ? <Bot className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />} {isBotReport ? 'Bot Conversation' : 'Original Report'}
                          </div>

                          {isBotReport ? (
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col">
                              {/* Header row: user, source, date */}
                              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate font-semibold">{reviewingReport.reporter}</span>
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                  {reviewingReport.source}
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {reviewingReport.time}
                                </span>
                              </div>

                              {/* Scrollable chat thread */}
                              <div className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-[#0B0F17]/40">
                                {botThread.map((msg, idx) =>
                                  msg.sender === 'bot' ? (
                                    <div key={idx} className="flex items-end gap-2 justify-end">
                                      <div className="flex flex-col items-end max-w-[82%]">
                                        <div className="bg-[#0071E3] text-white rounded-[20px] rounded-br-[4px] px-4 py-2.5 shadow-[0_2px_10px_rgba(0,113,227,0.22)]">
                                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 mr-1 font-medium">
                                          {formatBubbleTime(msg.timestamp)}
                                        </span>
                                      </div>
                                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[11px] font-bold text-[#0071E3] dark:text-blue-400 shrink-0 mb-4 ring-1 ring-blue-500/20">
                                        <Bot className="w-3.5 h-3.5" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div key={idx} className="flex items-end gap-2 justify-start">
                                      <div className="w-7 h-7 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-4 ring-1 ring-black/5">
                                        {(reviewingReport.reporter || '?').trim().charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex flex-col items-start max-w-[82%]">
                                        <div className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-[20px] rounded-bl-[4px] px-4 py-2.5">
                                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1 font-medium">
                                          {formatBubbleTime(msg.timestamp)}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4.5 border border-slate-200/60 dark:border-slate-700/60 space-y-3.5">
                              <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                                &quot;{reviewingReport.originalText}&quot;
                              </p>
                              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-2.5 text-xs">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate">{reviewingReport.reporter}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate">{reviewingReport.contact}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate">{reviewingReport.source}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="truncate">{reviewingReport.time}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {reviewingReport.verifiedBy && (
                            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Verified by {reviewingReport.verifiedBy} at {reviewingReport.verifiedAt}
                              </p>
                            </div>
                          )}

                          {reviewingReport.rejectionReason && (
                            <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                              <p className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                Rejected: {getRejectionLabel(reviewingReport.rejectionReason)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Officer Edit Form */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5" /> Officer Review
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Barangay</label>
                              <BarangaySelect
                                value={editForm.barangay || ''}
                                options={TALISAY_BARANGAYS}
                                onChange={selected => {
                                  const feature = talisayBarangays.features.find(f => f.properties.name === selected);
                                  setEditForm(prev => ({
                                    ...prev,
                                    barangay: selected,
                                    coordinates: prev.coordinates || (feature ? `${feature.properties.centroid[1]}, ${feature.properties.centroid[0]}` : prev.coordinates)
                                  }));
                                }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Type</label>
                                <select
                                  value={editForm.type || ''}
                                  onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all cursor-pointer"
                                >
                                  {!editForm.type && (
                                    <option value="" disabled>Select Type</option>
                                  )}
                                  {availableIncidentTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Urgency</label>
                                <select
                                  value={editForm.urgency || ''}
                                  onChange={e => setEditForm(prev => ({ ...prev, urgency: e.target.value }))}
                                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                                >
                                  {['High', 'Moderate', 'Low'].map(u => (
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
                                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. Near 7-Eleven, in front of school..."
                              />
                            </div>

                            {isBotReport ? (
                              <div>
                                <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                  Phone Number
                                </label>
                                <input
                                  type="text"
                                  value={editForm.contact || ''}
                                  onChange={e => setEditForm(prev => ({ ...prev, contact: e.target.value }))}
                                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none font-mono transition-all"
                                  placeholder="e.g. 0912-345-6789"
                                />
                              </div>
                            ) : !isScraperReport ? (
                              <motion.div
                                key={shakeKey}
                                animate={coordError ? { x: [0, -6, 6, -6, 6, -3, 3, 0] } : { x: 0 }}
                                transition={{ duration: 0.4, ease: 'easeInOut' }}
                              >
                                <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                  Coordinates (lat, lng)
                                  {coordError && (
                                    <span className="ml-2 text-rose-500 font-normal lowercase">— invalid format</span>
                                  )}
                                </label>
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
                                  className={`w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none font-mono transition-all ${coordError
                                    ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/10'
                                    : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                  placeholder="14.0951, 121.0203"
                                />
                              </motion.div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </StaggerItem>

                    {/* Verification Checklist — Apple Interactive Setting Cards */}
                    {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                      <StaggerItem>
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4.5 border border-slate-200/60 dark:border-slate-700/60">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-500" /> Verification Checklist
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                                className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer select-none active:scale-[0.98] ${checklist[item.key as keyof typeof checklist]
                                  ? 'bg-blue-50/70 dark:bg-blue-900/25 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200'
                                  : 'bg-white/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checklist[item.key as keyof typeof checklist]}
                                  onChange={(e) => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                  className="rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-medium leading-snug">
                                  {item.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </StaggerItem>
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
                          className="bg-rose-500/10 rounded-2xl p-4.5 border border-rose-500/20 space-y-3"
                        >
                          <label className="block text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                            Rejection Reason
                          </label>
                          <select
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
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
                              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all active:scale-[0.97]"
                            >
                              Confirm Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRejectPanel(false)}
                              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-[0.97]"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </StaggerContainer>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-md shrink-0 rounded-b-2xl sm:rounded-b-3xl">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                    {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-all active:scale-[0.97] flex items-center"
                        >
                          Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRejectPanel(true)}
                          className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97]"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {reviewingReport.status === 'verified' && (
                      <button
                        type="button"
                        onClick={handleResolve}
                        className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    )}

                    {reviewingReport.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() => {
                          setReports(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, status: 'pending', rejectionReason: null } : r));
                          showToast(`Report #${reviewingReport.id} restored to pending`, 'info');
                          closeReview();
                        }}
                        className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore to Pending
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeReview}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-all active:scale-[0.97] flex items-center"
                    >
                      Close
                    </button>

                    {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={!allChecklistChecked}
                        title={!allChecklistChecked ? 'Complete the checklist first' : ''}
                        className="flex-1 sm:flex-none justify-center px-5 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <Send className="w-3.5 h-3.5" /> Verify & Plot
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
