import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, RotateCcw,
  ShieldCheck, FileText, MapPinned, Bot, Globe,
} from 'lucide-react';
import DatePicker from '../components/DatePicker';
import FilterDropdown from '../components/DropDown';
import PageLoader from '../components/PageLoader';
import { StaggerContainer, StaggerItem } from '../components/Stagger';

import {
  isReportIncomplete,
  formatReportCode,
  type Report,
  type ReportStatus,
} from '../services/incidentService';
import { useReports } from '../context/ReportsContext';
import ReportReviewModal, { ToastItem, type Toast } from '../components/ReportReviewModal';
import { useRestoreReport } from '../hooks/useRestoreReport';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';

export type TabKey = 'under_review' | 'incomplete' | 'verified' | 'resolved' | 'rejected';

export const BASE_INCIDENT_TYPES = [
  'Earthquake',
  'Fire',
  'Flood',
  'General',
  'Landslide',
  'Typhoon',
  'Volcanic Eruption',
  'Unknown',
] as const;


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
const APPLE_SLIDE_SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;



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



export default function IncidentReports() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    reports,
    loading,
    updateReport: contextUpdateReport,
    error: reportsError,
    refreshReports,
  } = useReports();
  const [activeTab, setActiveTab] = useState<TabKey>('under_review');
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const loadError = reportsError;

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
  const handleRestore = useRestoreReport(showToast);


  const [searchParams] = useSearchParams();
  const urlBarangay = searchParams.get('barangay');
  const urlFocus = searchParams.get('focus');
  const urlSearch = searchParams.get('search') || searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(() => urlSearch);

  useEffect(() => {
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  // Filters
  const [filterSource, setFilterSource] = useState<'all' | 'bot' | 'scraper'>('all');
  const [filterBarangay, setFilterBarangay] = useState(() => urlBarangay || 'All Barangays');
  const [filterType, setFilterType] = useState('All Types');
  const [filterUrgency, setFilterUrgency] = useState('All Urgency');

  const handledFocusRef = useRef<string | null>(null);

  const openReview = (target: Report) => {
    setReviewingReport(target);
    if (target.status === 'pending') {
      contextUpdateReport(target.id, { status: 'under_review' });
    }
  };

  // The shared modal closes itself with an exit animation, then calls this to clear state.
  const closeReview = () => {
    setReviewingReport(null);
  };

  useEffect(() => {
    if (!urlFocus) {
      handledFocusRef.current = null;
      return;
    }
    if (reports.length === 0) return;
    if (handledFocusRef.current === urlFocus) return;

    const match = reports.find((r) => {
      if (!r || !r.id) return false;
      const target = String(urlFocus).trim().toLowerCase();
      const rid = String(r.id).trim().toLowerCase();
      if (rid === target) return true;

      const rCode = formatReportCode(r.id, r.source).toLowerCase();
      if (rCode === target || rCode.replace('#', '') === target) return true;

      const numTarget = target.replace(/\D/g, '');
      const numRid = rid.replace(/\D/g, '');
      if (numTarget !== '' && numTarget === numRid) {
        if (
          (target.includes('bot') || target.includes('conv')) &&
          (rid.includes('bot') || rid.includes('conv') || r.source === 'Bot')
        ) {
          return true;
        }
        if (target.includes('fb') && (rid.includes('fb') || r.source === 'Scraper')) {
          return true;
        }
        if (!isNaN(Number(target)) && !isNaN(Number(rid))) {
          return true;
        }
      }
      return false;
    });

    if (match) {
      handledFocusRef.current = urlFocus;
      openReview(match);
      if (match.status === 'verified' || match.status === 'resolved' || match.status === 'rejected') {
        setActiveTab(match.status);
      } else {
        setActiveTab(isReportIncomplete(match) ? 'incomplete' : 'under_review');
      }

      // Quietly strip focus param from browser address bar without triggering React Router re-render
      // This prevents the incomplete report modal from popping up again if the officer manually refreshes the page
      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('focus')) {
          currentUrl.searchParams.delete('focus');
          const cleanPath = currentUrl.pathname + (currentUrl.search ? currentUrl.search : '');
          window.history.replaceState(null, '', cleanPath);
        }
      } catch {
        // ignore fallback
      }
    }
  }, [urlFocus, reports]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterSource('all');
    setFilterBarangay('All Barangays');
    setFilterType('All Types');
    setFilterUrgency('All Urgency');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
    if (location.search) {
      navigate('/incident-reports', { replace: true });
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filterSource !== 'all' ||
    filterBarangay !== 'All Barangays' ||
    filterType !== 'All Types' ||
    filterUrgency !== 'All Urgency' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const activeFilterCount =
    (searchQuery.trim() !== '' ? 1 : 0) +
    (filterSource !== 'all' ? 1 : 0) +
    (filterBarangay !== 'All Barangays' ? 1 : 0) +
    (filterType !== 'All Types' ? 1 : 0) +
    (filterUrgency !== 'All Urgency' ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);


  const itemsPerPage = 10;



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
  }, [activeTab, filterSource, filterBarangay, filterType, filterUrgency, fromDate, toDate, searchQuery]);

  const availableBarangayOptions = useMemo(() => {
    const extra = reports
      .map(r => r.barangay)
      .filter((b): b is string => Boolean(b && typeof b === 'string' && !['none', 'unknown', 'unspecified', 'n/a', 'null', 'all barangays'].includes(b.toLowerCase().trim())));
    const sorted = Array.from(new Set([...TALISAY_BARANGAYS, ...extra])).sort();
    return ['All Barangays', 'Unknown', ...sorted];
  }, [reports]);

  const availableFilterTypes = useMemo(() => {
    const fromReports = reports.map(r => r.type).filter(Boolean);
    const sorted = Array.from(new Set([...BASE_INCIDENT_TYPES, ...fromReports]))
      .filter((t): t is string => Boolean(t && t.toLowerCase() !== 'all types' && t.toLowerCase() !== 'unclassified' && t.toLowerCase() !== 'none' && t.toLowerCase() !== 'unknown'))
      .sort();
    return ['All Types', 'Unknown', ...sorted];
  }, [reports]);


  // Keep the original row around so the shared modal can trigger a restore,
  // then open the modal on the CURRENT tab (no navigation).


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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = formatReportCode(r.id, r.source).toLowerCase();
        const id = (r.id || '').toLowerCase();
        const brgy = (r.barangay || '').toLowerCase();
        const type = (r.type || '').toLowerCase();
        const reporter = (r.reporter || '').toLowerCase();
        const contact = (r.contact || '').toLowerCase();
        const text = (r.originalText || r.description || '').toLowerCase();
        const action = (r.action || '').toLowerCase();
        if (
          !code.includes(q) &&
          !id.includes(q) &&
          !brgy.includes(q) &&
          !type.includes(q) &&
          !reporter.includes(q) &&
          !contact.includes(q) &&
          !text.includes(q) &&
          !action.includes(q)
        ) {
          return false;
        }
      }
      if (activeTab === 'under_review') {
        const isUnderReviewOrPending = r.status === 'under_review' || r.status === 'pending';
        if (!isUnderReviewOrPending) return false;
        // Incomplete reports (Unknown barangay) always belong in the Incomplete tab
        if (isReportIncomplete(r)) return false;
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
      if (filterBarangay !== 'All Barangays') {
        const normFilter = filterBarangay.toLowerCase().trim();
        const rBrgy = (r.barangay || '').toLowerCase().trim();
        const isNoneBarangay = !rBrgy || rBrgy === 'none' || rBrgy === 'unknown' || rBrgy === 'unspecified' || rBrgy === 'n/a' || rBrgy === 'null';
        if (normFilter === 'none' || normFilter === 'unknown') {
          if (!isNoneBarangay) return false;
        } else if (rBrgy !== normFilter) {
          return false;
        }
      }
      if (filterType !== 'All Types') {
        const normFilter = filterType.toLowerCase().trim();
        const repType = (r.type || '').trim().toLowerCase();
        const isNoneType = !repType || repType === 'none' || repType === 'unclassified' || repType === 'unknown' || repType === 'null' || repType === 'undefined' || repType === 'n/a' || repType === 'unspecified';
        if (normFilter === 'none' || normFilter === 'unknown') {
          if (!isNoneType) return false;
        } else if (repType !== normFilter) {
          return false;
        }
      }
      if (filterUrgency !== 'All Urgency') {
        const u = (r.urgency || '').toLowerCase();
        const fu = filterUrgency.toLowerCase();
        if (fu === 'critical' && u !== 'critical') return false;
        if (fu === 'high' && u !== 'high') return false;
        if (fu === 'moderate' && u !== 'moderate' && u !== 'mod' && u !== 'medium') return false;
        if (fu === 'low' && u !== 'low') return false;
      }
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
  }, [reports, activeTab, filterSource, filterBarangay, filterType, filterUrgency, fromDate, toDate, searchQuery]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);

  // Clamp page when tab switches, searches, or triage updates shrink the result set
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getUrgencyBadge = (urgency: string) => {
    switch ((urgency || '').toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[84px] py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
            <span>Critical</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[84px] py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>High</span>
          </span>
        );
      case 'moderate':
      case 'mod':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[84px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>Moderate</span>
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[84px] py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
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
    }
  };

  const getTypeBadge = (type: string) => {
    const norm = (type || '').trim().toLowerCase();
    if (!norm || norm === 'none' || norm === 'unclassified' || norm === 'unknown' || norm === 'null' || norm === 'unspecified') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          <span>Unknown</span>
        </span>
      );
    }

    const colorMap: Record<string, string> = {
      'earthquake': 'text-amber-600 dark:text-amber-400',
      'fire': 'text-rose-600 dark:text-rose-400',
      'flood': 'text-cyan-600 dark:text-cyan-400',
      'landslide': 'text-yellow-700 dark:text-yellow-500',
      'search & rescue': 'text-orange-600 dark:text-orange-400',
      'medical': 'text-emerald-600 dark:text-emerald-400',
      'food & water': 'text-blue-600 dark:text-blue-400',
      'infrastructure': 'text-purple-600 dark:text-purple-400',
      'general': 'text-slate-700 dark:text-slate-300',
      'typhoon': 'text-teal-600 dark:text-teal-400',
      'volcanic eruption': 'text-orange-600 dark:text-orange-400',
    };
    const textColor = colorMap[norm] || 'text-slate-700 dark:text-slate-300';

    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        <span>{type}</span>
      </span>
    );
  };



  if (loading) return <PageLoader variant="incidents" />;

  return (
    <div className="incidents-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative">
      {loadError && (
        <div role="alert" className="px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-50/80 dark:bg-rose-950/20 text-xs font-medium text-rose-700 dark:text-rose-300">
          Could not load reports: {loadError}
          <button type="button" onClick={() => refreshReports(true)} className="ml-3 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer">
            Retry
          </button>
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
        <StaggerItem className="relative z-40">
          <div className="relative z-40 flex flex-col gap-2.5 shrink-0">
        <div className="relative z-40 backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3 sm:p-3.5 shrink-0">
          {/* Filter Controls Row with Grouped Inset Containers */}
          <div className="flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap items-stretch md:items-center justify-between gap-2.5 sm:gap-3 overflow-visible pb-1 md:pb-0 relative z-40">
            {/* Left Filter Scope Container */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:inline-flex md:items-center gap-2 sm:gap-2.5 md:gap-2 md:p-1.5 md:px-2 bg-slate-100/70 dark:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] w-full md:w-auto shrink-0 relative z-40">
              <div className="col-span-2 sm:col-span-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[#0071E3] dark:text-sky-400 cursor-default select-none shrink-0">
                <Filter className="w-3.5 h-3.5 transition-transform duration-300 group-hover/filters:scale-110 text-[#0071E3] dark:text-sky-400" strokeWidth={1.8} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0071E3] text-white tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </div>

              {/* Source Toggle Filter: [Bot] [Scraper] */}
              <div className="col-span-2 sm:col-span-1 md:col-span-auto inline-flex items-center p-0.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-white/10 shadow-xs gap-1 shrink-0 h-[34px] sm:h-[36px]">
                <button
                  type="button"
                  onClick={() => {
                    setFilterSource(prev => (prev === 'bot' ? 'all' : 'bot'));
                    setCurrentPage(1);
                  }}
                  className={`h-full inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 select-none active:scale-[0.96] cursor-pointer ${
                    filterSource === 'bot'
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
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
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                  }`}
                  title={filterSource === 'scraper' ? 'Click to show all sources' : 'Filter by Scraper reports'}
                >
                  <Globe className={`w-3.5 h-3.5 ${filterSource === 'scraper' ? 'text-white' : 'text-purple-500'}`} strokeWidth={1.75} />
                  <span>Scraper</span>
                </button>
              </div>

              <div className="col-span-1 md:col-span-auto min-w-0 md:min-w-[130px] w-full md:w-auto">
                <FilterDropdown
                  labelPrefix="Barangay"
                  value={filterBarangay}
                  options={availableBarangayOptions}
                  onChange={setFilterBarangay}
                />
              </div>

              <div className="col-span-1 md:col-span-auto min-w-0 md:min-w-[120px] w-full md:w-auto">
                <FilterDropdown
                  labelPrefix="Type"
                  value={filterType}
                  options={availableFilterTypes}
                  onChange={setFilterType}
                />
              </div>

              <div className="col-span-2 sm:col-span-1 md:col-span-auto min-w-0 md:min-w-[120px] w-full md:w-auto">
                <FilterDropdown
                  labelPrefix="Urgency"
                  value={filterUrgency}
                  options={['All Urgency', 'Critical', 'High', 'Moderate', 'Low']}
                  onChange={setFilterUrgency}
                />
              </div>
            </div>

            {/* Right Date Scope Container + Preserved Reset Option */}
            <div className="col-span-2 md:col-span-auto flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 md:ml-auto w-full md:w-auto shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:inline-flex md:items-center gap-1.5 sm:gap-2 md:gap-2 md:p-1.5 md:bg-slate-100/70 md:dark:bg-white/[0.05] md:backdrop-blur-xl md:rounded-2xl md:border md:border-slate-200/70 md:dark:border-white/10 md:shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] md:px-2.5 w-full md:w-auto shrink-0">
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-0 sm:min-w-[125px] w-full sm:w-auto">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap pl-0.5">
                    From:
                  </span>
                  <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                </div>
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-0 sm:min-w-[125px] w-full sm:w-auto">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    To:
                  </span>
                  <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="relative inline-flex items-center justify-center w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] text-[#0071E3] hover:text-blue-700 dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all duration-150 active:scale-[0.95] cursor-pointer shrink-0 border border-blue-500/20 after:absolute after:-inset-1.5 after:content-['']"
                  title="Reset all filters"
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        </div>
          </div>
        </StaggerItem>

        {/* ── Table (Soft UI Evolution Data Table) ── */}
        <StaggerItem className="w-full flex-1 lg:min-h-0 flex flex-col">
          <div className="relative z-10 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] overflow-hidden flex flex-col flex-1 lg:min-h-0">
        {/* Mobile Incident Cards (< sm) */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5 overflow-y-auto flex-1">
          {paginatedReports.length === 0 ? (
            <div className="py-16 px-4 text-center text-slate-400 dark:text-slate-500">
              <span className="text-sm font-medium">
                {activeTab === 'incomplete'
                  ? 'No incomplete reports. All reports have complete information!'
                  : 'No reports found.'}
              </span>
            </div>
          ) : (
            paginatedReports.map((report) => (
              <div
                key={report.id}
                className={`p-3.5 space-y-3 transition-colors ${
                  report.status === 'pending'
                    ? 'bg-blue-50/20 dark:bg-blue-900/5'
                    : ''
                }`}
              >
                {/* Top Row: ID Code, Source Pill, Time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {report.status === 'pending' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-500/20 animate-pulse" title="Pending" />
                    )}
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 truncate">
                      {formatReportCode(report.id, report.source)}
                    </span>
                    {(report.source || '').trim().toLowerCase() === 'scraper' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0">
                        <Globe className="w-2.5 h-2.5" />
                        <span>Scraper</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/20 shrink-0">
                        <Bot className="w-2.5 h-2.5" />
                        <span>Bot</span>
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono tabular-nums shrink-0">
                    {report.time}
                  </span>
                </div>

                {/* Middle: Barangay & Type */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    {(!report.barangay || report.barangay.toLowerCase() === 'unknown' || report.barangay.toLowerCase() === 'none') ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Missing Barangay
                      </span>
                    ) : (
                      <span className="truncate">{report.barangay}</span>
                    )}
                  </div>
                  <div className="shrink-0">{getTypeBadge(report.type)}</div>
                </div>

                {/* Bottom Row: Urgency, Status, and Actions */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80 dark:border-white/5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getUrgencyBadge(report.urgency)}
                    {getStatusBadge(report.status, isReportIncomplete(report))}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(report.status === 'pending' || report.status === 'under_review') && (
                      <button
                        type="button"
                        onClick={() => openReview(report)}
                        className="px-3.5 py-1.5 min-h-[36px] text-xs font-bold text-[#0071E3] dark:text-sky-300 bg-[#0071E3]/18 hover:bg-[#0071E3]/28 active:bg-[#0071E3]/38 dark:bg-[#0071E3]/25 dark:hover:bg-[#0071E3]/38 border border-[#0071E3]/45 hover:border-[#0071E3]/75 dark:border-sky-400/40 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-[0_2px_10px_rgba(0,113,227,0.22)] cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>{isReportIncomplete(report) ? 'Review & Complete' : 'Review'}</span>
                      </button>
                    )}

                    {report.status === 'verified' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openReview(report)}
                          className="px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-white/10 rounded-xl transition-all flex items-center gap-1 active:scale-[0.96] shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/geospatial?focus=${report.id}`)}
                          className="px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1 active:scale-[0.96] shadow-2xs cursor-pointer"
                        >
                          <MapPinned className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Map</span>
                        </button>
                      </>
                    )}

                    {(report.status === 'resolved' || report.status === 'rejected') && (
                      <button
                        type="button"
                        onClick={() => openReview(report)}
                        className="px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-white/10 rounded-xl transition-all flex items-center gap-1 active:scale-[0.96] shadow-2xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>View</span>
                      </button>
                    )}

                    {report.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() => handleRestore(report.id)}
                        className="px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-[#0071E3] dark:text-sky-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1 active:scale-[0.96] shadow-2xs cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop/Tablet Table (>= sm) */}
        <div
          className="hidden sm:block overflow-x-auto overflow-y-auto w-full flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
          style={{
            maskImage: 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)',
          }}
        >
          <table className="w-full min-w-[980px] text-sm text-left border-separate border-spacing-0">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-white/10 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <tr>
                <th className="px-4 py-3 w-28 min-w-[105px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">ID</th>
                <th className="px-3.5 py-3 w-[26%] min-w-[160px] text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Barangay</th>
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
                  <td colSpan={8} className="h-full px-4 text-center text-slate-400 dark:text-slate-500 align-middle">
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
                    className={`cursor-pointer transition-colors duration-150 border-b border-slate-100 dark:border-white/5 group hover:bg-blue-50/30 dark:hover:bg-slate-800/40 active:bg-blue-50/50 dark:active:bg-slate-800/60 ${
                      report.status === 'pending'
                        ? 'bg-blue-50/20 dark:bg-blue-900/5'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 w-28 min-w-[105px] whitespace-nowrap shrink-0">
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
                    <td className="px-3.5 py-3.5 w-[26%] min-w-[160px] text-slate-900 dark:text-slate-100 font-medium whitespace-nowrap group-hover:text-[#0071E3] group-active:text-[#0071E3] dark:group-hover:text-sky-400 dark:group-active:text-sky-400 transition-colors duration-150">
                      {(!report.barangay || report.barangay.trim().toLowerCase() === 'unknown' || report.barangay.trim().toLowerCase() === 'none') ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" strokeWidth={1.75} />
                          <span>Unknown</span>
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
                            className="group/btn px-3.5 py-1.5 text-xs font-bold text-[#0071E3] dark:text-sky-300 bg-[#0071E3]/18 hover:bg-[#0071E3]/28 active:bg-[#0071E3]/38 dark:bg-[#0071E3]/25 dark:hover:bg-[#0071E3]/38 border border-[#0071E3]/45 hover:border-[#0071E3]/75 dark:border-sky-400/40 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] shadow-[0_2px_10px_rgba(0,113,227,0.22)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.35)] backdrop-blur-sm cursor-pointer"
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

      {/* â”€â”€ Review & Verify Modal (shared â€” stays on the current tab) â”€â”€ */}
      {reviewingReport && (
        <ReportReviewModal
          key={reviewingReport.id}
          report={reviewingReport}
          onClose={closeReview}
        />
      )}
    </div>
  );
}


