import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, X, Eye, ChevronLeft, ChevronRight, ChevronDown,
  Clock, User, Phone, MessageSquare,
  CheckCircle2, AlertTriangle, RotateCcw, Send,
  ShieldCheck, FileText, AlertOctagon, MapPinned, Bot, Globe,
  Check, Search,
} from 'lucide-react';
import DatePicker from '../components/DatePicker';
import FilterDropdown from '../components/DropDown';
import PageLoader from '../components/PageLoader';
import { StaggerContainer, StaggerItem } from '../components/Stagger';

import {
  isReportIncomplete,
  getIncompleteReasons,
  formatReportCode,
  getTypeHexColor,
  type Report,
  type ReportStatus,
} from '../services/incidentService';
import { useReports } from '../context/ReportsContext';
import { useBotConversations, type BotMessage } from '../context/BotConversationsContext';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';
import { formatPhilippineTimeOnly, getPhilippineTimestampNow } from '../utils/dateUtils';

export type TabKey = 'under_review' | 'incomplete' | 'verified' | 'resolved' | 'rejected';

export const BASE_INCIDENT_TYPES = ['Earthquake', 'Fire', 'Flood', 'General', 'Landslide'] as const;

const formatBubbleTime = (iso?: string) => formatPhilippineTimeOnly(iso);

// ── Perfectly Aligned Datetime Component (Apple Tabular Layout) ──
function AlignedTableTime({ rawTime }: { rawTime?: string }) {
  if (!rawTime) return <span className="text-slate-400 dark:text-slate-500">—</span>;

  // Match: (date part) (time part) (AM/PM)
  // e.g. "10/31 6:32 PM", "10/31 12:20 PM", "1/5 9:00 AM"
  const match = rawTime.trim().match(/^(.*?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([AaPp][Mm])$/);
  if (!match) {
    return <span className="font-mono tabular-nums">{rawTime}</span>;
  }

  const [, rawDate, time, period] = match;
  let displayDate = rawDate;
  const slashMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    displayDate = slashMatch[1].padStart(2, "0") + "/" + slashMatch[2].padStart(2, "0");
  }

  const isLongTime = time.length > 5;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs">
      <span className="text-slate-400 dark:text-slate-500 shrink-0">{displayDate}</span>
      <span className={(isLongTime ? "w-[8ch]" : "w-[5ch]") + " text-right font-medium text-slate-700 dark:text-slate-200 shrink-0"}>
        {time}
      </span>
      <span className="w-[2.5ch] text-left font-medium text-slate-500 dark:text-slate-400 shrink-0">
        {period.toUpperCase()}
      </span>
    </span>
  );
}


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
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

const MODAL_TRANSITION = {
  opacity: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  scale: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
  y: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
} as const;

// ── Bulk bar: hardware-accelerated transform + opacity only ──
const barActionVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
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

  return (
    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0071E3] dark:text-sky-400 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/25 rounded-xl hover:bg-[#0071E3] hover:text-white dark:hover:bg-[#0071E3] dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed transition-all backdrop-blur-md active:scale-[0.96] shadow-2xs cursor-pointer"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
      </button>

      <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
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

      <span className="sm:hidden px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-xl tabular-nums shadow-2xs">
        Page {currentPage} of {safeTotal}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= safeTotal}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0071E3] dark:text-sky-400 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/25 rounded-xl hover:bg-[#0071E3] hover:text-white dark:hover:bg-[#0071E3] dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed transition-all backdrop-blur-md active:scale-[0.96] shadow-2xs cursor-pointer"
      >
        <span className="hidden sm:inline">Next</span><span className="sm:hidden">Next</span> <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
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
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90 cursor-pointer"
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
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] cursor-pointer select-none shadow-2xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${isPlaceholder ? 'text-slate-400 dark:text-slate-500 font-normal' : 'text-slate-800 dark:text-slate-100 font-medium'}`}>
          {isPlaceholder ? (value === 'Unknown' ? 'Unknown (Select Barangay)' : 'Select Barangay') : value}
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
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-[#0071E3] dark:text-sky-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400 shrink-0 ml-2" strokeWidth={2} />}
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
  const {
    reports,
    loading,
    updateReport: contextUpdateReport,
    bulkUpdateReports: contextBulkUpdateReports,
  } = useReports();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('under_review');
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError] = useState('');

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

  const [searchParams] = useSearchParams();
  const urlBarangay = searchParams.get('barangay');
  const urlFocus = searchParams.get('focus');

  // Filters
  const [filterSource, setFilterSource] = useState<'all' | 'bot' | 'scraper'>('all');
  const [filterBarangay, setFilterBarangay] = useState(() => urlBarangay || 'All Barangays');
  const [filterType, setFilterType] = useState('All Types');
  const [filterUrgency, setFilterUrgency] = useState('All Urgency');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (urlFocus && reports.length > 0) {
      const match = reports.find((r) => r.id === urlFocus);
      if (match) {
        setReviewingReport(match);
        if (match.status === 'verified' || match.status === 'resolved' || match.status === 'rejected') {
          setActiveTab(match.status);
        } else {
          setActiveTab(isReportIncomplete(match) ? 'incomplete' : 'under_review');
        }
      }
    }
  }, [urlFocus, reports]);

  const resetFilters = () => {
    setFilterSource('all');
    setFilterBarangay('All Barangays');
    setFilterType('All Types');
    setFilterUrgency('All Urgency');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    filterSource !== 'all' ||
    filterBarangay !== 'All Barangays' ||
    filterType !== 'All Types' ||
    filterUrgency !== 'All Urgency' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const activeFilterCount =
    (filterSource !== 'all' ? 1 : 0) +
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

  // ── Incomplete detection for review modal ──
  const isModalReportIncomplete = useMemo(() => {
    if (!reviewingReport) return false;
    const b = (editForm.barangay !== undefined ? editForm.barangay : reviewingReport.barangay) || '';
    const t = (editForm.type !== undefined ? editForm.type : reviewingReport.type) || '';
    return isReportIncomplete({ barangay: b, type: t });
  }, [reviewingReport, editForm.barangay, editForm.type]);

  const modalIncompleteReasons = useMemo(() => {
    if (!reviewingReport) return [];
    const b = (editForm.barangay !== undefined ? editForm.barangay : reviewingReport.barangay) || '';
    const t = (editForm.type !== undefined ? editForm.type : reviewingReport.type) || '';
    return getIncompleteReasons({ barangay: b, type: t });
  }, [reviewingReport, editForm.barangay, editForm.type]);

  // ── Bot conversation thread for the review modal ──
  const { conversations: botConversations } = useBotConversations();
  const isBotReport = reviewingReport?.source === 'Bot';
  const isScraperReport = reviewingReport?.source === 'Scraper';
  const botThread = useMemo<BotMessage[]>(() => {
    if (!reviewingReport || reviewingReport.source !== 'Bot') return [];
    if (reviewingReport.threadMessages && reviewingReport.threadMessages.length > 0) {
      return reviewingReport.threadMessages;
    }
    const reportTime = new Date(reviewingReport.createdAt || 0).getTime();
    const sessions = botConversations.filter((c) => c.psid === reviewingReport.senderPsid);
    const session =
      sessions.find((c) => c.messages.some((m) => m.timestamp && new Date(m.timestamp).getTime() === reportTime)) ??
      sessions[0];
    if (session && session.messages.length > 0) return session.messages;
    return [{ sender: 'user', text: reviewingReport.originalText, timestamp: reviewingReport.createdAt || '' }];
  }, [reviewingReport, botConversations]);

  const tabs = [
    {
      key: 'under_review' as const,
      label: 'Under Review',
      count: reports.filter(r => (r.status === 'under_review' || r.status === 'pending') && !isReportIncomplete(r)).length,
    },
    {
      key: 'incomplete' as const,
      label: 'Incomplete',
      count: reports.filter(r => (r.status === 'under_review' || r.status === 'pending') && isReportIncomplete(r)).length,
    },
    {
      key: 'verified' as const,
      label: 'Verified',
      count: reports.filter(r => r.status === 'verified').length,
    },
    {
      key: 'resolved' as const,
      label: 'Resolved',
      count: reports.filter(r => r.status === 'resolved').length,
    },
    {
      key: 'rejected' as const,
      label: 'Rejected',
      count: reports.filter(r => r.status === 'rejected').length,
    },
  ];

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [activeTab, filterSource, filterBarangay, filterType, filterUrgency, fromDate, toDate]);

  const availableIncidentTypes = useMemo(() => {
    const set = new Set<string>(BASE_INCIDENT_TYPES);
    reports.forEach(r => {
      const norm = (r.type || '').trim().toLowerCase();
      if (r.type && norm && r.type !== 'All Types' && norm !== 'unclassified' && norm !== 'none') {
        set.add(r.type);
      }
    });
    const editNorm = (editForm.type || '').trim().toLowerCase();
    if (editForm.type && editNorm && editForm.type !== 'All Types' && editNorm !== 'unclassified' && editNorm !== 'none') {
      set.add(editForm.type);
    }
    return Array.from(set).filter(t => t.toLowerCase() !== 'unclassified' && t.toLowerCase() !== 'none').sort();
  }, [reports, editForm.type]);

  const openReview = (report: Report) => {
    setReviewingReport(report);

    const initialType = (!report.type || report.type.toLowerCase() === 'unclassified' || report.type.toLowerCase() === 'none') ? 'General' : report.type;

    setEditForm({
      ...report,
      type: initialType,
      coordinates: report.coordinates || '',
      contact: report.contact === '—' ? '' : (report.contact || ''),
    });
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
      contextUpdateReport(report.id, { status: 'under_review' });
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

  const handleSaveDraft = async () => {
    if (!reviewingReport || !editForm) return;
    const targetId = reviewingReport.id;
    const isOngoingStatus = reviewingReport.status === 'verified' || reviewingReport.status === 'resolved';
    const actionDesc = editForm.action || (isOngoingStatus ? 'Updated report details' : 'Draft saved');
    const updated = {
      ...reviewingReport,
      ...editForm,
      action: actionDesc,
      actionTaken: actionDesc,
    } as Report;
    showToast(isOngoingStatus ? `Report #${targetId} changes saved` : `Report #${targetId} draft saved`, 'info');
    closeReview();

    try {
      await contextUpdateReport(targetId, updated);
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  const handleVerify = async () => {
    if (!reviewingReport || !editForm) return;

    // Guard: Report must be complete before it can be verified
    const currentBarangay = (editForm.barangay || reviewingReport.barangay || '').trim();
    const currentType = (editForm.type || reviewingReport.type || '').trim();
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
      ...reviewingReport,
      ...editForm,
      coordinates: rawCoords,
      status: 'verified',
      verifiedBy: 'MDRRMO Officer',
      verifiedAt: now,
      rejectionReason: null,
      action: actionDesc,
      actionTaken: actionDesc,
    };

    showToast(`Report #${reviewingReport.id} verified and plotted on map`, 'success');
    closeReview();

    try {
      await contextUpdateReport(reviewingReport.id, updated);
    } catch (err) {
      console.error('Failed to persist verification:', err);
    }
  };

  const handleResolve = async () => {
    if (!reviewingReport) return;
    const targetId = reviewingReport.id;
    const actionDesc = editForm.action || 'Marked as resolved';
    const updated: Report = {
      ...reviewingReport,
      ...editForm,
      status: 'resolved',
      action: actionDesc,
      actionTaken: actionDesc,
    };
    showToast(`Report #${targetId} marked as resolved`, 'success');
    closeReview();

    try {
      await contextUpdateReport(targetId, updated);
    } catch (err) {
      console.error('Failed to persist resolve action:', err);
    }
  };

  const handleReject = async () => {
    if (!reviewingReport || !rejectReason) return;
    const targetId = reviewingReport.id;
    const reasonLabel = getRejectionLabel(rejectReason);
    const actionDesc = editForm.action || `Rejected: ${reasonLabel}`;
    const updated: Report = {
      ...reviewingReport,
      ...editForm,
      status: 'rejected',
      rejectionReason: rejectReason,
      verifiedBy: null,
      verifiedAt: null,
      action: actionDesc,
      actionTaken: actionDesc,
    };
    showToast(`Report #${targetId} rejected: ${reasonLabel}`, 'error');
    closeReview();

    try {
      await contextUpdateReport(targetId, updated);
    } catch (err) {
      console.error('Failed to persist rejection:', err);
    }
  };

  const handleRestore = async (id: string) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
    const target = reports.find(r => r.id === id);
    const isIncomplete = target ? isReportIncomplete(target) : false;
    const destination = isIncomplete ? 'Incomplete' : 'Under Review';
    const code = formatReportCode(id, target?.source);
    showToast(`Report ${code} restored to ${destination}`, 'info');

    try {
      await contextUpdateReport(id, {
        status: 'under_review',
        rejectionReason: null,
        action: `Restored to ${destination}`,
        actionTaken: `Restored to ${destination}`,
      });
    } catch (err) {
      console.error('Failed to persist restore:', err);
    }
  };

  const handleBulkResolve = async () => {
    const count = selectedIds.length;
    const targetIds = [...selectedIds];
    showToast(`${count} reports marked as resolved`, 'success');
    setSelectedIds([]);

    try {
      await contextBulkUpdateReports(targetIds, 'resolved', 'Marked resolved in bulk');
    } catch (err) {
      console.error('Failed to persist bulk resolve:', err);
    }
  };

  const handleBulkRestore = async () => {
    const count = selectedIds.length;
    const targetIds = [...selectedIds];
    showToast(`${count} reports restored (complete to Under Review, incomplete to Incomplete)`, 'info');
    setSelectedIds([]);

    try {
      await contextBulkUpdateReports(targetIds, 'under_review', 'Restored from rejected in bulk');
    } catch (err) {
      console.error('Failed to persist bulk restore:', err);
    }
  };

  const allChecklistChecked = Object.values(checklist).every(Boolean);

  const getReportDateString = (r: Report): string | null => {
    if (r.createdAt) {
      try {
        const d = new Date(r.createdAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {}
    }
    if (r.time) {
      const parts = r.time.split(' ')[0].split('/');
      if (parts.length === 2) {
        const mm = parts[0].padStart(2, '0');
        const dd = parts[1].padStart(2, '0');
        const yyyy = new Date().getFullYear();
        return `${yyyy}-${mm}-${dd}`;
      }
      if (parts.length === 3) {
        const mm = parts[0].padStart(2, '0');
        const dd = parts[1].padStart(2, '0');
        const yyyy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return null;
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (activeTab === 'under_review') {
        const isUnderReviewOrPending = r.status === 'under_review' || r.status === 'pending';
        if (!isUnderReviewOrPending || isReportIncomplete(r)) return false;
      } else if (activeTab === 'incomplete') {
        const isUnderReviewOrPending = r.status === 'under_review' || r.status === 'pending';
        if (!isUnderReviewOrPending || !isReportIncomplete(r)) return false;
      } else {
        if (r.status !== activeTab) return false;
      }
      if (filterSource !== 'all') {
        const rSource = (r.source || '').trim().toLowerCase();
        if (filterSource === 'bot' && rSource !== 'bot') return false;
        if (filterSource === 'scraper' && rSource !== 'scraper') return false;
      }
      if (filterBarangay !== 'All Barangays' && r.barangay?.toLowerCase() !== filterBarangay.toLowerCase()) return false;
      if (filterType !== 'All Types') {
        const normFilter = filterType.toLowerCase();
        const repType = (r.type || 'none').toLowerCase();
        if (normFilter === 'none') {
          if (repType !== 'none' && repType !== 'unclassified') return false;
        } else if (repType !== normFilter) {
          return false;
        }
      }
      if (filterUrgency !== 'All Urgency' && r.urgency?.toLowerCase() !== filterUrgency.toLowerCase()) return false;
      if (fromDate) {
        const repDate = getReportDateString(r);
        if (repDate && repDate < fromDate) return false;
      }
      if (toDate) {
        const repDate = getReportDateString(r);
        if (repDate && repDate > toDate) return false;
      }
      return true;
    });
  }, [reports, activeTab, filterSource, filterBarangay, filterType, filterUrgency, fromDate, toDate]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'High':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>High</span>
          </span>
        );
      case 'Moderate':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>Moderate</span>
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
            <span>Low</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: ReportStatus, isIncomplete: boolean) => {
    if (activeTab === 'incomplete' || (isIncomplete && (status === 'pending' || status === 'under_review'))) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>Incomplete</span>
        </span>
      );
    }
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-[#0071E3] dark:text-sky-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span>Pending</span>
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-orange-600/12 text-orange-800 dark:text-orange-300 border border-orange-600/25">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse shrink-0" />
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
    }
  };

  const getTypeBadge = (type: string) => {
    const norm = (type || '').trim().toLowerCase();
    if (!norm || norm === 'none' || norm === 'unclassified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" strokeWidth={1.75} />
          <span>Out of Scope</span>
        </span>
      );
    }

    const dotColor = getTypeHexColor(type);

    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span>{type}</span>
      </span>
    );
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
    <div className="incidents-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative">
      {loadError && (
        <div role="alert" className="px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-50/80 dark:bg-rose-950/20 text-xs font-medium text-rose-700 dark:text-rose-300">
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

      <StaggerContainer className="flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full max-w-[1600px] mx-auto">
        {/* ── Top Page Header with Integrated Segmented Tabs ── */}
        <StaggerItem>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                <FileText className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-lg sm:text-[22px] font-semibold tracking-[-0.025em] leading-tight text-slate-900 dark:text-white">
                  Incident Reports
                </h1>
                <p className="text-[11px] sm:text-xs font-normal tracking-[0.005em] text-slate-500/90 dark:text-slate-400/90 mt-0.5 leading-relaxed">
                  Emergency triage <span className="text-slate-300 dark:text-slate-600 mx-1">·</span> Verification &amp; resolution across Talisay City
                </p>
              </div>
            </div>

            {/* ── Tabs (Apple macOS Segmented Control — fits to top on desktop/tablet, smooth horizontal swipe on mobile) ── */}
            <div className="overflow-x-auto scrollbar-none -mx-1 px-1 py-0.5 shrink-0">
              <div className="p-1 bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 inline-flex items-center gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2 select-none active:scale-[0.97] cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-2xs'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabPill"
                          transition={APPLE_SLIDE_SPRING}
                          className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-black/4 dark:border-white/10"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                      <span
                        className={`relative z-10 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full transition-colors shrink-0 ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/40 text-[#0071E3] dark:text-sky-400'
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
          </div>
        </StaggerItem>

        {/* ── Filter Bar & Bulk Actions ── */}
        <StaggerItem>
          <div className="relative z-30 flex flex-col gap-2.5 shrink-0">
        <div className="backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3 sm:p-3.5 shrink-0">
          {/* Mobile Filter Header Toggle (< md) */}
          <div className="flex md:hidden items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/25 dark:border-blue-400/25 text-xs font-semibold cursor-pointer select-none shadow-2xs active:scale-[0.98] transition-transform"
            >
              <Filter className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
              <span>Filter Incident Reports</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0071E3] text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${mobileFiltersOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] dark:text-sky-400 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className={`${mobileFiltersOpen ? 'grid' : 'hidden'} md:flex md:flex-wrap grid-cols-2 gap-2 sm:gap-2.5 md:gap-3 md:items-center pt-2.5 md:pt-0`}>
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 text-[#0071E3] dark:text-sky-400 cursor-default select-none shrink-0">
              <Filter className="w-3.5 h-3.5 transition-transform duration-300 group-hover/filters:scale-110 text-[#0071E3] dark:text-sky-400" strokeWidth={1.8} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
            </div>

            {/* Source Toggle Filter: [Bot] [Scraper] */}
            <div className="col-span-2 sm:col-span-1 md:col-span-auto inline-flex items-center p-0.5 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] gap-1 shrink-0 h-[34px] sm:h-[36px]">
              <button
                type="button"
                onClick={() => {
                  setFilterSource(prev => (prev === 'bot' ? 'all' : 'bot'));
                  setCurrentPage(1);
                }}
                className={`h-full inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 select-none active:scale-[0.96] cursor-pointer ${
                  filterSource === 'bot'
                    ? "bg-[#0071E3] text-white shadow-xs hover:bg-[#0077ED] hover:shadow-[0_2px_8px_rgba(0,113,227,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs hover:-translate-y-0.5 active:translate-y-0"
                }`}
                title={filterSource === 'bot' ? 'Click to show all sources' : 'Filter by Bot reports'}
              >
                <Bot className={`w-3.5 h-3.5 ${filterSource === 'bot' ? 'text-white' : 'text-[#0071E3]'}`} strokeWidth={1.75} />
                <span>Bot</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterSource(prev => (prev === 'scraper' ? 'all' : 'scraper'));
                  setCurrentPage(1);
                }}
                className={`h-full inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 select-none active:scale-[0.96] cursor-pointer ${
                  filterSource === 'scraper'
                    ? "bg-[#0071E3] text-white shadow-xs hover:bg-[#0077ED] hover:shadow-[0_2px_8px_rgba(0,113,227,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs hover:-translate-y-0.5 active:translate-y-0"
                }`}
                title={filterSource === 'scraper' ? 'Click to show all sources' : 'Filter by Scraper reports'}
              >
                <Globe className={`w-3.5 h-3.5 ${filterSource === 'scraper' ? 'text-white' : 'text-purple-500'}`} strokeWidth={1.75} />
                <span>Scraper</span>
              </button>
            </div>

            <div className="col-span-1 md:col-span-auto min-w-[130px]">
              <FilterDropdown
                value={filterBarangay}
                options={['All Barangays', ...Array.from(new Set([...TALISAY_BARANGAYS, ...reports.map(r => r.barangay)])).sort()]}
                onChange={setFilterBarangay}
              />
            </div>

            <div className="col-span-1 md:col-span-auto min-w-[120px]">
              <FilterDropdown
                value={filterType}
                options={[
                  'All Types',
                  ...Array.from(new Set([...BASE_INCIDENT_TYPES, ...reports.map(r => r.type)]))
                    .filter(t => Boolean(t) && t.toLowerCase() !== 'unclassified' && t.toLowerCase() !== 'none')
                    .sort()
                ]}
                onChange={setFilterType}
              />
            </div>

            <div className="col-span-2 sm:col-span-1 md:col-span-auto min-w-[120px]">
              <FilterDropdown
                value={filterUrgency}
                options={['All Urgency', 'High', 'Moderate', 'Low']}
                onChange={setFilterUrgency}
              />
            </div>

            <div className="col-span-2 md:col-span-auto flex flex-wrap sm:flex-nowrap items-center gap-2 md:ml-auto w-full md:w-auto">
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[125px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  From:
                </span>
                <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
              </div>
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[125px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  To:
                </span>
                <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] text-[#0071E3] hover:text-blue-700 dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all duration-150 active:scale-[0.95] cursor-pointer shrink-0 ml-auto sm:ml-0 border border-blue-500/20"
                  title="Reset all filters"
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Actions Floating Island */}
        <AnimatePresence mode="wait">
          {selectedIds.length > 0 && (
            <motion.div
              key="bulk-actions"
              variants={barActionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={APPLE_SPRING}
              className="relative z-20 flex flex-wrap items-center justify-between gap-2.5 bg-blue-50/90 dark:bg-blue-950/40 backdrop-blur-md border border-blue-200/80 dark:border-blue-800/60 rounded-2xl px-4 sm:px-5 py-2.5 shrink-0 shadow-sm"
            >
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                {selectedIds.length} report{selectedIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {activeTab === 'verified' && (
                  <button
                    type="button"
                    onClick={handleBulkResolve}
                    className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-700/80 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Mark Resolved
                  </button>
                )}
                {activeTab === 'rejected' && (
                  <button
                    type="button"
                    onClick={handleBulkRestore}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#0071E3] bg-white dark:bg-slate-800 border border-blue-200/80 dark:border-blue-700/80 dark:text-sky-300 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore to Pending
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </StaggerItem>

        {/* ── Table (Soft UI Evolution Data Table) ── */}
        <StaggerItem className="flex-1 min-h-0 flex flex-col">
          <div className="relative z-10 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] overflow-hidden flex flex-col flex-1 min-h-0">
        <div
          className="overflow-x-auto overflow-y-auto w-full flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
          style={{
            maskImage: 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)',
          }}
        >
          <table className="w-full min-w-[980px] text-sm text-left border-separate border-spacing-0">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-white/10 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <tr>
                <th className="px-3.5 py-3 w-10 shrink-0">
                  <input
                    type="checkbox"
                    checked={paginatedReports.length > 0 && paginatedReports.every(r => selectedIds.includes(r.id))}
                    onChange={toggleSelectAll}
                    className="rounded-md border-slate-300 dark:border-slate-600 text-[#0071E3] focus:ring-0 w-4 h-4 cursor-pointer transition-all"
                  />
                </th>
                <th className="px-3.5 py-3 w-28 min-w-[105px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">ID</th>
                <th className="px-3.5 py-3 w-[25%] min-w-[160px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Barangay</th>
                <th className="px-3.5 py-3 w-[16%] min-w-[140px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-3.5 py-3 w-[11%] min-w-[100px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Urgency</th>
                <th className="px-3.5 py-3 w-[14%] min-w-[120px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-3.5 py-3 w-[10%] min-w-[95px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Source</th>
                <th className="px-3.5 py-3 w-[12%] min-w-[115px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Time</th>
                <th className="px-3.5 py-3 w-28 min-w-[110px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 text-left whitespace-nowrap sticky top-0 right-0 z-40 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-white/10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.4)] shrink-0">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedReports.length === 0 ? (
                <tr className="h-full">
                  <td colSpan={9} className="h-full px-4 text-center text-slate-400 dark:text-slate-500 align-middle">
                    <div className="flex flex-col items-center justify-center py-20">
                      <span className="text-sm font-medium">
                        {activeTab === 'incomplete'
                          ? 'No incomplete reports. All reports have complete information!'
                          : 'No reports found.'}
                      </span>
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
                      delay: Math.min(index * 0.02, 0.15),
                    }}
                    onClick={() => openReview(report)}
                    className={`cursor-pointer transition-colors duration-150 border-b border-slate-100 dark:border-white/5 group hover:bg-blue-50/30 dark:hover:bg-slate-800/40 active:bg-blue-50/50 dark:active:bg-slate-800/60 ${selectedIds.includes(report.id)
                      ? 'bg-blue-50/40 dark:bg-blue-900/15'
                      : report.status === 'pending'
                        ? 'bg-blue-50/20 dark:bg-blue-900/5'
                        : ''
                      }`}
                  >
                    <td className="px-3.5 py-3.5 w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(report.id)}
                        onChange={() => toggleSelect(report.id)}
                        className="rounded-md border-slate-300 dark:border-slate-600 text-[#0071E3] focus:ring-0 w-4 h-4 cursor-pointer transition-all"
                      />
                    </td>
                    <td className="px-3.5 py-3.5 w-28 min-w-[105px] whitespace-nowrap shrink-0">
                      <div className="flex items-center gap-1.5">
                        {report.status === 'pending' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-500/20 animate-pulse" title="Pending" />
                        )}
                        <span
                          className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 truncate inline-block"
                          title={`Original ID: ${report.id}`}
                        >
                          {formatReportCode(report.id, report.source)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 w-[25%] min-w-[160px] text-slate-900 dark:text-slate-100 font-medium whitespace-nowrap group-hover:text-[#0071E3] group-active:text-[#0071E3] dark:group-hover:text-sky-400 dark:group-active:text-sky-400 transition-colors duration-150">
                      {(!report.barangay || report.barangay.trim().toLowerCase() === 'unknown') ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" strokeWidth={1.75} />
                          <span>Unknown Barangay</span>
                        </span>
                      ) : (
                        <span>{report.barangay}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 w-[16%] min-w-[140px] whitespace-nowrap">
                      {getTypeBadge(report.type)}
                    </td>
                    <td className="px-3.5 py-3.5 w-[11%] min-w-[100px] whitespace-nowrap">
                      {getUrgencyBadge(report.urgency)}
                    </td>
                    <td className="px-3.5 py-3.5 w-[14%] min-w-[120px] whitespace-nowrap">
                      {getStatusBadge(report.status, isReportIncomplete(report))}
                    </td>
                    <td className="px-3.5 py-3.5 w-[10%] min-w-[95px] whitespace-nowrap">
                      {(report.source || '').trim().toLowerCase() === 'scraper' ? (
                        <span className="inline-flex items-center justify-center gap-1.5 w-[76px] py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                          <Globe className="w-3 h-3" strokeWidth={1.75} />
                          <span>Scraper</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1.5 w-[76px] py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/20">
                          <Bot className="w-3 h-3" strokeWidth={1.75} />
                          <span>Bot</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 w-[12%] min-w-[115px] text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      <AlignedTableTime rawTime={report.time} />
                    </td>
                    <td className="px-3.5 py-3.5 w-28 min-w-[110px] text-left whitespace-nowrap sticky right-0 z-10 bg-white dark:bg-[#111827] group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-white/5 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.4)] shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-start gap-1.5">
                        {(report.status === 'pending' || report.status === 'under_review') && (
                          <button
                            type="button"
                            onClick={() => openReview(report)}
                            className={`group/btn px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] backdrop-blur-sm cursor-pointer ${
                              isReportIncomplete(report)
                                ? 'text-amber-700 dark:text-amber-300 bg-amber-500/22 hover:bg-amber-500/35 active:bg-amber-500/45 dark:bg-amber-500/30 dark:hover:bg-amber-500/45 border border-amber-500/50 hover:border-amber-500/80 dark:border-amber-400/40 shadow-[0_2px_10px_rgba(217,119,6,0.22)] hover:shadow-[0_4px_16px_rgba(217,119,6,0.35)]'
                                : 'text-[#0071E3] dark:text-sky-300 bg-[#0071E3]/18 hover:bg-[#0071E3]/28 active:bg-[#0071E3]/38 dark:bg-[#0071E3]/25 dark:hover:bg-[#0071E3]/38 border border-[#0071E3]/45 hover:border-[#0071E3]/75 dark:border-sky-400/40 shadow-[0_2px_10px_rgba(0,113,227,0.22)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.35)]'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" strokeWidth={1.75} />
                            <span>{isReportIncomplete(report) ? 'Review & Complete' : 'Review'}</span>
                          </button>
                        )}

                        {report.status === 'verified' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openReview(report)}
                              className="group/btn px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-200 dark:hover:text-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" strokeWidth={1.75} />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/geospatial?focus=${report.id}`)}
                              className="group/btn px-3 py-1.5 text-xs font-semibold text-[#0071E3] dark:text-sky-300 bg-blue-500/10 hover:bg-[#0071E3] hover:text-white border border-blue-500/25 hover:border-[#0071E3] rounded-xl transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] shadow-2xs hover:shadow-[0_4px_14px_rgba(0,113,227,0.35)] cursor-pointer"
                            >
                              <MapPinned className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110 text-[#0071E3] group-hover/btn:text-white" strokeWidth={1.75} />
                              <span>Map</span>
                            </button>
                          </>
                        )}

                        {(report.status === 'resolved' || report.status === 'rejected') && (
                          <button
                            type="button"
                            onClick={() => openReview(report)}
                            className="group/btn px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-200 dark:hover:text-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" strokeWidth={1.75} />
                            <span>View</span>
                          </button>
                        )}

                        {report.status === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleRestore(report.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#0071E3] dark:text-sky-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Restore</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
                {paginatedReports.length > 0 && (
                  <tr aria-hidden="true" className="h-4 pointer-events-none border-none">
                    <td colSpan={9} className="p-0 border-0" />
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Footer: Pagination */}
        <div className="border-t border-slate-100 dark:border-white/10 px-4 sm:px-6 py-3 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
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

      {/* ── Review & Verify Modal (Soft UI Evolution Pro Sheet) ── */}
      <AnimatePresence>
        {reviewingReport && editForm && (
          <motion.div
            key="review-modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md"
            onClick={closeReview}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={MODAL_TRANSITION}
              className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col transform-gpu will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-white/10 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md shrink-0 rounded-t-2xl sm:rounded-t-3xl z-10">
                <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 min-w-0">
                  <span
                    className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10"
                    title={`Original ID: ${reviewingReport.id}`}
                  >
                    {formatReportCode(reviewingReport.id, reviewingReport.source)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline max-w-[200px] truncate" title={reviewingReport.id}>
                    ({reviewingReport.id})
                  </span>
                  {getStatusBadge(reviewingReport.status, isReportIncomplete(reviewingReport))}
                  {reviewingReport.possibleDuplicateOf && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      <AlertTriangle className="w-3 h-3 text-amber-500" strokeWidth={1.75} />
                      <span>Duplicate #{reviewingReport.possibleDuplicateOf}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeReview}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90 shrink-0 cursor-pointer"
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
                            <span className="truncate font-semibold">{reviewingReport.reporter}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span>{reviewingReport.source}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span>{reviewingReport.time}</span>
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
                                    {formatBubbleTime(msg.timestamp)}
                                  </span>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[11px] font-bold text-[#0071E3] dark:text-blue-400 shrink-0 mb-4 ring-1 ring-blue-500/20">
                                  <Bot className="w-3.5 h-3.5" strokeWidth={1.75} />
                                </div>
                              </div>
                            ) : (
                              <div key={idx} className="flex items-end gap-2 justify-start">
                                <div className="w-7 h-7 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-4 ring-1 ring-black/5">
                                  {(reviewingReport.reporter || '?').trim().charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col items-start max-w-[82%]">
                                  <div className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-[18px] rounded-bl-[4px] px-3.5 py-2.5">
                                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
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
                      <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl p-4.5 border border-slate-200/70 dark:border-white/10 space-y-3.5">
                        <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                          &quot;{reviewingReport.originalText}&quot;
                        </p>
                        <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 grid grid-cols-2 gap-2.5 text-xs">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span className="truncate">{reviewingReport.reporter}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                            <span className="truncate">{reviewingReport.contact || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            {(reviewingReport.source || '').trim().toLowerCase() === 'scraper' ? (
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
                            <span className="truncate">{reviewingReport.time}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {reviewingReport.verifiedBy && (
                      <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Verified by {reviewingReport.verifiedBy} at {reviewingReport.verifiedAt}</span>
                        </p>
                      </div>
                    )}

                    {reviewingReport.rejectionReason && (
                      <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                        <p className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                          <AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Rejected: {getRejectionLabel(reviewingReport.rejectionReason)}</span>
                        </p>
                      </div>
                    )}

                    {reviewingReport.action && (
                      <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                        <p className="text-xs text-[#0071E3] dark:text-sky-400 font-semibold flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Action: {reviewingReport.action}</span>
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
                            value={editForm.type || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none transition-all cursor-pointer shadow-2xs"
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
                            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#0071E3] outline-none transition-all cursor-pointer shadow-2xs"
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
                                navigate(`/geospatial?focus=${reviewingReport.id}`);
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

                {/* Verification Checklist — Apple Interactive Setting Cards */}
                {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                  <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl p-4 sm:p-4.5 border border-slate-200/70 dark:border-white/10">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#0071E3]" strokeWidth={1.75} />
                      <span>Verification Checklist</span>
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
                      className="bg-rose-500/10 rounded-2xl p-4 sm:p-4.5 border border-rose-500/20 space-y-3"
                    >
                      <label className="block text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Rejection Reason
                      </label>
                      <select
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
              </div>

              {/* Modal Footer Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/70 backdrop-blur-md shrink-0 rounded-b-2xl sm:rounded-b-3xl">
                <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                  {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all active:scale-[0.97] flex items-center cursor-pointer"
                      >
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRejectPanel(true)}
                        className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.75} /> Reject
                      </button>
                    </>
                  )}

                  {/* Save Changes button for verified or resolved reports */}
                  {(reviewingReport.status === 'verified' || reviewingReport.status === 'resolved') && (
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all active:scale-[0.97] flex items-center cursor-pointer"
                    >
                      Save Changes
                    </button>
                  )}

                  {reviewingReport.status === 'verified' && (
                    <button
                      type="button"
                      onClick={handleResolve}
                      className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Mark Resolved
                    </button>
                  )}

                  {reviewingReport.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRestore(reviewingReport.id);
                        closeReview();
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
                    onClick={closeReview}
                    className="flex-1 sm:flex-none justify-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-white/10 rounded-xl transition-all active:scale-[0.97] flex items-center cursor-pointer"
                  >
                    Close
                  </button>

                  {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
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
                      className="flex-1 sm:flex-none justify-center px-5 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" strokeWidth={1.75} /> Verify & Plot
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
