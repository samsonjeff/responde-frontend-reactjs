import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Download,
  FileText,
  TrendingUp,
  MapPin,
  AlertTriangle,
  Activity,
  Flame,
  Waves,
  Shield,
  Mountain,
  Wind,
  BarChart3,
  Lightbulb,
  CheckCircle2,
  Clock,
  Bot,
  Globe2,
  Sparkles,
  Filter,
  X,
  RotateCcw,
  Layers,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import AnimatedNumber from '../components/AnimatedNumber';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import DatePicker from '../components/DatePicker';
import FilterDropdown from '../components/DropDown';
import { useReports } from '../context/ReportsContext';
import PageLoader from '../components/PageLoader';
import { containerVariants, itemVariants } from '../components/Stagger';
import { BarangayBarChart, type BarangayBarChartProps } from '../components/BarangayBarChart';
import { TALISAY_BARANGAYS, normalizeBarangayName } from '../data/talisay-barangays';
import { BASE_INCIDENT_TYPES } from '../services/incidentService';

export { BarangayBarChart, type BarangayBarChartProps };

// ── Types ───────────────────────────────────────────────────────────────────
export type AnalyticsReport = {
  id: string;
  barangay: string;
  type: string;
  urgency: string;
  source: string;
  time: string;
  status: string;
  createdAt?: string | null;
  verifiedAt?: string | null;
};

// ── Design Tokens & Config ───────────────────────────────────────────────────
const ACCENT_BLUE = '#2563EB';

export const CANONICAL_INCIDENT_TYPES = [
  'Earthquake',
  'Fire',
  'Flood',
  'General',
  'Landslide',
  'Typhoon',
  'Volcanic Eruption',
] as const;

export type CanonicalIncidentType = typeof CANONICAL_INCIDENT_TYPES[number];

const TYPE_CONFIG: Record<
  string,
  {
    icon: LucideIcon;
    iconClass: string;
    color: string;
    bg: string;
    glowShadow: string;
    glowBorder: string;
    hoverBg: string;
    activeBorder: string;
    activeBg: string;
    activeShadow: string;
  }
> = {
  Earthquake: {
    icon: Activity,
    iconClass: 'text-amber-500',
    color: '#EAB308',
    bg: 'rgba(234,179,8,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(234,179,8,0.25)]',
    glowBorder: 'hover:border-amber-400/80 dark:hover:border-amber-500/70',
    hoverBg: 'hover:bg-amber-50/60 dark:hover:bg-amber-950/25',
    activeBorder: 'border-amber-500/60 dark:border-amber-400/60',
    activeBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(234,179,8,0.28)]',
  },
  Fire: {
    icon: Flame,
    iconClass: 'text-rose-500',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(239,68,68,0.25)]',
    glowBorder: 'hover:border-rose-400/80 dark:hover:border-rose-500/70',
    hoverBg: 'hover:bg-rose-50/60 dark:hover:bg-rose-950/25',
    activeBorder: 'border-rose-500/60 dark:border-rose-400/60',
    activeBg: 'bg-rose-500/15 dark:bg-rose-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.28)]',
  },
  Flood: {
    icon: Waves,
    iconClass: 'text-sky-500',
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(14,165,233,0.25)]',
    glowBorder: 'hover:border-sky-400/80 dark:hover:border-sky-500/70',
    hoverBg: 'hover:bg-sky-50/60 dark:hover:bg-sky-950/25',
    activeBorder: 'border-sky-500/60 dark:border-sky-400/60',
    activeBg: 'bg-sky-500/15 dark:bg-sky-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(14,165,233,0.28)]',
  },
  General: {
    icon: Shield,
    iconClass: 'text-indigo-500',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(99,102,241,0.25)]',
    glowBorder: 'hover:border-indigo-400/80 dark:hover:border-indigo-500/70',
    hoverBg: 'hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25',
    activeBorder: 'border-indigo-500/60 dark:border-indigo-400/60',
    activeBg: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(99,102,241,0.28)]',
  },
  Landslide: {
    icon: Mountain,
    iconClass: 'text-amber-700',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(217,119,6,0.25)]',
    glowBorder: 'hover:border-amber-600/80 dark:hover:border-amber-600/70',
    hoverBg: 'hover:bg-amber-50/60 dark:hover:bg-amber-950/25',
    activeBorder: 'border-amber-600/60 dark:border-amber-500/60',
    activeBg: 'bg-amber-600/15 dark:bg-amber-600/20',
    activeShadow: 'shadow-[0_0_20px_rgba(217,119,6,0.28)]',
  },
  Typhoon: {
    icon: Wind,
    iconClass: 'text-teal-500',
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(6,182,212,0.25)]',
    glowBorder: 'hover:border-teal-400/80 dark:hover:border-teal-500/70',
    hoverBg: 'hover:bg-teal-50/60 dark:hover:bg-teal-950/25',
    activeBorder: 'border-teal-500/60 dark:border-teal-400/60',
    activeBg: 'bg-teal-500/15 dark:bg-teal-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.28)]',
  },
  'Volcanic Eruption': {
    icon: Flame,
    iconClass: 'text-orange-500',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(249,115,22,0.25)]',
    glowBorder: 'hover:border-orange-400/80 dark:hover:border-orange-500/70',
    hoverBg: 'hover:bg-orange-50/60 dark:hover:bg-orange-950/25',
    activeBorder: 'border-orange-500/60 dark:border-orange-400/60',
    activeBg: 'bg-orange-500/15 dark:bg-orange-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(249,115,22,0.28)]',
  },
};

const URGENCY_WEIGHT: Record<string, number> = { Critical: 4, High: 3, Moderate: 2, Low: 1 };

// ── Helpers ──────────────────────────────────────────────────────────────────
export function normalizeIncidentType(type?: string | null): string {
  const norm = (type || '').trim().toLowerCase();
  if (norm.includes('earthquake') || norm.includes('lindol')) {
    return 'Earthquake';
  }
  if (norm.includes('fire') || norm.includes('sunog')) {
    return 'Fire';
  }
  if (norm.includes('flood') || norm.includes('baha')) {
    return 'Flood';
  }
  if (norm.includes('landslide') || norm.includes('guho')) {
    return 'Landslide';
  }
  if (norm.includes('typhoon') || norm.includes('bagyo') || norm.includes('storm') || norm.includes('wind')) {
    return 'Typhoon';
  }
  if (norm.includes('volcan') || norm.includes('ash') || norm.includes('taal') || norm.includes('erupt')) {
    return 'Volcanic Eruption';
  }
  if (norm.includes('general')) {
    return 'General';
  }
  const matched = CANONICAL_INCIDENT_TYPES.find((t) => t.toLowerCase() === norm);
  if (matched) return matched;
  return 'General';
}

function parseReportTime(value: string) {
  const m = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!m) return null;
  let hour = +m[3];
  const ampm = m[5]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return { month: +m[1], day: +m[2], hour, minute: +m[4] };
}

function responseMinutes(report: AnalyticsReport) {
  if (!report.verifiedAt) return null;
  const a = parseReportTime(report.time), b = parseReportTime(report.verifiedAt);
  if (!a || !b) return null;
  const diff = b.hour * 60 + b.minute - (a.hour * 60 + a.minute);
  return diff >= 0 ? diff : null;
}

function daysBefore(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Soft UI Evolution Card Component ─────────────────────────────────────────
function SoftCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-[0_12px_36px_-8px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
  iconColor = ACCENT_BLUE,
  iconBg,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: ReactNode;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
          style={{
            background: iconBg ?? `${iconColor}12`,
            borderColor: `${iconColor}22`,
            color: iconColor,
          }}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white tracking-tight text-base">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

// ── Custom Tooltips ──────────────────────────────────────────────────────────
interface TooltipPayloadItem {
  value?: number | string;
  name?: string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface CTP {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

function VolumeTooltip({ active, payload, label }: CTP) {
  if (!active || !payload?.length) return null;
  const val = Number(payload[0]?.value ?? 0);
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-white/10 px-3.5 py-2.5 rounded-2xl shadow-[0_8px_24px_rgba(0,113,227,0.18)] text-xs backdrop-blur-md ring-1 ring-[#0071E3]/20 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full bg-[#0071E3] shadow-[0_0_6px_rgba(0,113,227,0.8)]" />
        <p className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{val}</span>
        <span className="text-xs font-semibold text-[#0071E3] dark:text-sky-400">{val === 1 ? 'incident' : 'incidents'}</span>
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: CTP) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as { name?: string; value?: number; color?: string } | undefined;
  if (!d) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2.5 rounded-xl shadow-lg text-xs backdrop-blur-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="font-semibold text-slate-800 dark:text-slate-100">{d.name}</span>
      </div>
      <p className="font-bold text-sm mt-1 text-slate-900 dark:text-white tabular-nums">
        {d.value} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{d.value === 1 ? 'report' : 'reports'}</span>
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function getDominantNeedMeta(type: string) {
  const norm = (type || '').toLowerCase();
  if (norm.includes('fire') || norm.includes('sunog')) {
    return {
      label: 'Fire',
      pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    };
  }
  if (norm.includes('flood') || norm.includes('baha')) {
    return {
      label: 'Flood',
      pill: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
    };
  }
  if (norm.includes('earthquake') || norm.includes('lindol')) {
    return {
      label: 'Earthquake',
      pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    };
  }
  if (norm.includes('landslide') || norm.includes('guho')) {
    return {
      label: 'Landslide',
      pill: 'bg-yellow-600/10 text-yellow-700 dark:text-yellow-400 border-yellow-600/25',
    };
  }
  if (norm.includes('typhoon') || norm.includes('bagyo')) {
    return {
      label: 'Typhoon',
      pill: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25',
    };
  }
  if (norm.includes('volcan') || norm.includes('ash') || norm.includes('taal')) {
    return {
      label: 'Volcano',
      pill: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25',
    };
  }
  return {
    label: 'General',
    pill: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
  };
}

export default function Analytics() {
  const { reports, loading: reportsLoading, error: reportsError, refreshReports } = useReports();
  const location = useLocation();
  // MANDATORY FLOW: Incident Report -> Geospatial -> Analytics
  // Analytics MUST ONLY compute from Geospatial verified data (verified by system users).
  const data = useMemo(
    () => (reports as AnalyticsReport[]).filter((r) => r.status === 'verified'),
    [reports]
  );

  // ── Filter state ────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('All Barangays');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [volumeRange, setVolumeRange] = useState<'7d' | '30d' | '3m'>('7d');
  const [minDelayDone, setMinDelayDone] = useState(false);
  const loading = reportsLoading || !minDelayDone;

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDelayDone(true);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  // Click-to-filter from charts
  const [activeBarangay, setActiveBarangay] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const [typeViewMode, setTypeViewMode] = useState<'donut' | 'bar'>('donut');

  const allBarangays = useMemo(() => {
    const extra = data
      .map(r => normalizeBarangayName(r.barangay) || r.barangay)
      .filter((b): b is string => Boolean(b && typeof b === 'string' && !['all barangays', 'none', 'unknown', 'unspecified', 'n/a', 'null'].includes(b.toLowerCase().trim()) && !(TALISAY_BARANGAYS as readonly string[]).includes(b)));
    const sorted = Array.from(new Set([...TALISAY_BARANGAYS, ...extra])).sort();
    return ['All Barangays', 'Unknown', ...sorted];
  }, [data]);

  const allTypes = useMemo(() => {
    const fromReports = data.map(r => r.type).filter(Boolean);
    const sorted = Array.from(new Set([...BASE_INCIDENT_TYPES, ...CANONICAL_INCIDENT_TYPES, ...fromReports]))
      .filter((t): t is string => Boolean(t && t.toLowerCase() !== 'all types' && t.toLowerCase() !== 'unclassified' && t.toLowerCase() !== 'none' && t.toLowerCase() !== 'unknown'))
      .sort();
    return ['All Types', 'Unknown', ...sorted];
  }, [data]);

  const allSources = useMemo(() => ['All Sources', 'Bot', 'Scraper'], []);

  // Effective filters (header dropdowns override chart clicks)
  const effectiveBarangay = barangayFilter !== 'All Barangays' ? barangayFilter : activeBarangay;
  const effectiveType = typeFilter !== 'All Types' ? typeFilter : activeType;

  const isBarangayMatch = (reportBarangay?: string, target?: string | null): boolean => {
    if (!target || target === 'All Barangays') return true;
    const normTarget = target.toLowerCase().trim();
    const repBarangay = (reportBarangay || '').toLowerCase().trim();
    if (normTarget === 'none' || normTarget === 'unknown') {
      return !repBarangay || repBarangay === 'none' || repBarangay === 'unknown' || repBarangay === 'unspecified' || repBarangay === 'n/a' || repBarangay === 'null';
    }
    return repBarangay === normTarget;
  };

  const isTypeMatch = (reportType?: string, target?: string | null): boolean => {
    if (!target || target === 'All Types') return true;
    const normTarget = target.toLowerCase().trim();
    const repType = (reportType || 'unknown').toLowerCase().trim();
    if (normTarget === 'none' || normTarget === 'unknown') {
      return !repType || repType === 'none' || repType === 'unclassified' || repType === 'unknown';
    }
    return normalizeIncidentType(reportType) === normalizeIncidentType(target);
  };

  const getAnalyticsReportDate = (r: AnalyticsReport): string | null => {
    if (r.createdAt) {
      try {
        const d = new Date(r.createdAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {}
    }
    const p = parseReportTime(r.time);
    if (p) {
      const yyyy = new Date().getFullYear();
      const mm = String(p.month).padStart(2, '0');
      const dd = String(p.day).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  };

  // ── Filtered data (used across KPI cards, volume chart, high-risk table, recommendations) ──
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (!isBarangayMatch(r.barangay, effectiveBarangay)) return false;
      if (!isTypeMatch(r.type, effectiveType)) return false;
      if (sourceFilter !== 'All Sources' && !r.source?.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (fromDate) {
        const dStr = getAnalyticsReportDate(r);
        if (dStr && dStr < fromDate) return false;
      }
      if (toDate) {
        const dStr = getAnalyticsReportDate(r);
        if (dStr && dStr > toDate) return false;
      }
      return true;
    });
  }, [data, effectiveBarangay, effectiveType, sourceFilter, fromDate, toDate]);

  // Reports for Barangay Bar Chart: filtered by date, source, and incident type, but not self-filtered by effectiveBarangay
  const reportsForBarangayChart = useMemo(() => {
    return data.filter(r => {
      if (!isTypeMatch(r.type, effectiveType)) return false;
      if (sourceFilter !== 'All Sources' && !r.source?.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (fromDate) {
        const dStr = getAnalyticsReportDate(r);
        if (dStr && dStr < fromDate) return false;
      }
      if (toDate) {
        const dStr = getAnalyticsReportDate(r);
        if (dStr && dStr > toDate) return false;
      }
      return true;
    });
  }, [data, effectiveType, sourceFilter, fromDate, toDate]);

  // Reports for Incident Type Breakdown: filtered by date, source, and barangay, but not self-filtered by effectiveType
  const reportsForTypeChart = useMemo(() => {
    return data.filter(r => {
      if (!isBarangayMatch(r.barangay, effectiveBarangay)) return false;
      if (sourceFilter !== 'All Sources' && !r.source?.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (fromDate) {
        const dStr = getAnalyticsReportDate(r);
        if (dStr && dStr < fromDate) return false;
      }
      if (toDate) {
        const dStr = getAnalyticsReportDate(r);
        if (dStr && dStr > toDate) return false;
      }
      return true;
    });
  }, [data, effectiveBarangay, sourceFilter, fromDate, toDate]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}`;
    const responseTimes = filtered.map(responseMinutes).filter((v): v is number => v !== null);
    const criticalCount = filtered.filter(
      (r) => (r.urgency || '').trim().toLowerCase() === 'critical'
    ).length;
    const highCount = filtered.filter(
      (r) => (r.urgency || '').trim().toLowerCase() === 'high'
    ).length;
    const totalHighUrgency = criticalCount + highCount;

    return {
      total: filtered.length,
      high: totalHighUrgency,
      critical: criticalCount,
      verified: filtered.filter((r) => r.status === 'verified').length,
      resolvedToday: filtered.filter((r) => {
        const p = parseReportTime(r.time);
        return p && `${p.month}/${p.day}` === todayStr && r.status === 'verified';
      }).length,
      incomplete: reports.filter(
        (r) => r.status === 'under_review' || r.status === 'pending'
      ).length,
      bot: filtered.filter((r) => r.source?.toLowerCase().includes('bot')).length,
      scraper: filtered.filter((r) => r.source?.toLowerCase().includes('scraper')).length,
      avgResponse: responseTimes.length
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0,
    };
  }, [filtered, reports]);

  // ── Donut & Bar chart data for Incident Types ──
  const typeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    CANONICAL_INCIDENT_TYPES.forEach((t) => {
      counts[t] = 0;
    });
    reportsForTypeChart.forEach((r) => {
      const canonical = normalizeIncidentType(r.type);
      counts[canonical] = (counts[canonical] || 0) + 1;
    });
    return CANONICAL_INCIDENT_TYPES.map((type) => ({
      name: type,
      value: counts[type] || 0,
      color: TYPE_CONFIG[type]?.color ?? '#64748b',
    }));
  }, [reportsForTypeChart]);

  // ── Volume line chart ────────────────────────────────────────────────────
  const volumeChartData = useMemo(() => {
    const days = volumeRange === '7d' ? 7 : volumeRange === '30d' ? 30 : 90;
    const cutoff = daysBefore(days);
    const counts: Record<string, number> = {};
    const year = new Date().getFullYear();
    filtered.forEach(r => {
      const p = parseReportTime(r.time);
      if (p) {
        const d = new Date(year, p.month - 1, p.day);
        if (d >= cutoff) {
          const k = `${p.month}/${p.day}`;
          counts[k] = (counts[k] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .sort((a, b) => {
        const [am, ad] = a[0].split('/').map(Number);
        const [bm, bd] = b[0].split('/').map(Number);
        return am - bm || ad - bd;
      })
      .map(([date, count]) => ({ date, count }));
  }, [filtered, volumeRange]);

  // ── Risk table ───────────────────────────────────────────────────────────
  const riskData = useMemo(() => {
    const grouped: Record<
      string,
      { incidents: number; score: number; high: number; critical: number; types: Record<string, number> }
    > = {};
    data.forEach((r) => {
      const n = r.barangay || 'Unknown';
      if (!grouped[n]) grouped[n] = { incidents: 0, score: 0, high: 0, critical: 0, types: {} };
      grouped[n].incidents++;
      const urgRaw = (r.urgency || 'Low').trim().toLowerCase();
      const urgCanonical =
        urgRaw === 'critical'
          ? 'Critical'
          : urgRaw === 'high'
          ? 'High'
          : urgRaw === 'moderate' || urgRaw === 'mod'
          ? 'Moderate'
          : 'Low';
      grouped[n].score += URGENCY_WEIGHT[urgCanonical] || 1;
      if (urgCanonical === 'Critical') {
        grouped[n].critical++;
        grouped[n].high++;
      } else if (urgCanonical === 'High') {
        grouped[n].high++;
      }
      const canonicalType = normalizeIncidentType(r.type);
      grouped[n].types[canonicalType] = (grouped[n].types[canonicalType] || 0) + 1;
    });
    return Object.entries(grouped)
      .map(([barangay, v]) => {
        const dominantType =
          Object.entries(v.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
        const priority =
          v.critical > 0
            ? 'Critical'
            : v.high > 0
            ? 'High'
            : v.score >= 4
            ? 'Moderate'
            : 'Low';
        return {
          barangay,
          ...v,
          dominantType,
          priority,
        };
      })
      .sort((a, b) => b.score - a.score || b.incidents - a.incidents)
      .slice(0, 6);
  }, [data]);

  const recommendations = useMemo(() => riskData.slice(0, 3).map((item) => {
    const resource =
      item.dominantType === 'Fire'
        ? 'fire response units and water tankers'
        : item.dominantType === 'Flood'
        ? 'rescue boats, evacuation units, and life vests'
        : item.dominantType === 'Earthquake'
        ? 'structural assessment engineers and search and rescue teams'
        : item.dominantType === 'Landslide'
        ? 'heavy earth-moving equipment and extraction teams'
        : item.dominantType === 'Typhoon'
        ? 'storm shelters, clearing crews, and emergency relief supplies'
        : item.dominantType === 'Volcanic Eruption'
        ? 'N95 masks, evacuation transport, and ashfall response teams'
        : 'emergency medical response teams and relief resources';
    return {
      ...item,
      text: `Pre-position ${resource} in ${item.barangay} based on ${item.incidents} recorded incident${item.incidents === 1 ? '' : 's'} and elevated urgency pattern.`,
    };
  }), [riskData]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ['Barangay', 'Incident Type', 'Urgency', 'Source', 'Status', 'Time'];
    const rows = filtered.map(r => [r.barangay, r.type, r.urgency, r.source, r.status, r.time]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `responde-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const downloadPDF = useCallback(() => {
    window.print();
  }, []);

  const resetFilters = () => {
    setBarangayFilter('All Barangays');
    setTypeFilter('All Types');
    setSourceFilter('All Sources');
    setFromDate('');
    setToDate('');
    setActiveBarangay(null);
    setActiveType(null);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (barangayFilter !== 'All Barangays') count++;
    if (typeFilter !== 'All Types') count++;
    if (sourceFilter !== 'All Sources') count++;
    if (Boolean(fromDate)) count++;
    if (Boolean(toDate)) count++;
    if (Boolean(activeBarangay)) count++;
    if (Boolean(activeType)) count++;
    return count;
  }, [barangayFilter, typeFilter, sourceFilter, fromDate, toDate, activeBarangay, activeType]);

  const hasActiveFilters = activeFilterCount > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader variant="analytics" />;
  if (!loading && reportsError && data.length === 0) {
    return (
      <div className="analytics-soft w-full flex items-center justify-center min-h-[50vh] p-4">
        <div className="flex flex-col items-center gap-3 text-center bg-rose-500/[0.06] dark:bg-rose-500/[0.10] border border-rose-500/20 rounded-2xl p-6 sm:p-8 max-w-md shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Failed to load analytics</p>
          <p className="text-xs text-rose-500 dark:text-rose-400 font-mono">{reportsError}</p>
          <button type="button" onClick={() => refreshReports(true)} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs">
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Retry Now</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-soft w-full">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full space-y-6 pb-0"
      >
          {/* ── 1. PAGE HEADER & FILTER BAR ── */}
          <motion.div variants={itemVariants} className="relative z-50">
            <SoftCard className="p-5 md:p-6 space-y-5 relative z-50">
              {/* Title and Primary Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
                    <BarChart3 className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-[22px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em] leading-tight">
                      Analytics
                    </h1>
                    <p className="text-[11px] sm:text-xs font-normal tracking-[0.005em] text-slate-500/90 dark:text-slate-400/90 mt-0.5 leading-relaxed">
                      Incident trends <span className="text-slate-300 dark:text-slate-600 mx-1">·</span> Response patterns &amp; resource insights
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <motion.button
                    type="button"
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    onClick={exportCSV}
                    className="group inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-slate-800/90 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 hover:text-[#0071E3] dark:hover:text-sky-300 hover:border-blue-400/60 dark:hover:border-blue-500/50 rounded-xl shadow-xs hover:shadow-[0_4px_16px_rgba(0,113,227,0.18)] transition-all duration-200 cursor-pointer select-none"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-[#0071E3] dark:group-hover:text-sky-300 transition-all duration-200 group-hover:-translate-y-0.5" strokeWidth={1.8} />
                    <span>Export CSV</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    onClick={downloadPDF}
                    className="group inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] border border-blue-400/30 rounded-xl shadow-[0_2px_10px_rgba(0,113,227,0.30)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.45)] transition-all duration-200 cursor-pointer select-none"
                  >
                    <FileText className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" strokeWidth={1.8} />
                    <span>Download PDF</span>
                  </motion.button>
                </div>
              </div>

              {/* Filter Bar with DatePicker and FilterDropdown */}
              <div className="pt-3.5 border-t border-slate-200/60 dark:border-white/5 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap items-stretch md:items-center justify-between gap-2.5 sm:gap-3 relative z-50">
                {/* Left Filter Scope Container */}
                <div className="grid grid-cols-1 sm:grid-cols-3 md:inline-flex md:items-center gap-2.5 sm:gap-3 md:gap-2.5 md:p-1.5 md:px-2 bg-slate-100/70 dark:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] w-full md:w-auto relative z-50">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[#0071E3] dark:text-sky-400 cursor-default select-none shrink-0">
                    <Filter className="w-3.5 h-3.5 transition-transform duration-300 group-hover/filters:scale-110 text-[#0071E3] dark:text-sky-400" strokeWidth={1.8} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0071E3] text-white tabular-nums">
                        {activeFilterCount}
                      </span>
                    )}
                  </div>

                  {/* Barangay DropDown */}
                  <div className="w-full md:w-auto min-w-0 md:min-w-[135px]">
                    <FilterDropdown
                      labelPrefix="Barangay"
                      value={barangayFilter}
                      options={allBarangays}
                      onChange={(val) => {
                        setBarangayFilter(val);
                        setActiveBarangay(null);
                      }}
                    />
                  </div>

                  {/* Type DropDown */}
                  <div className="w-full md:w-auto min-w-0 md:min-w-[125px]">
                    <FilterDropdown
                      labelPrefix="Type"
                      value={typeFilter}
                      options={allTypes}
                      onChange={(val) => {
                        setTypeFilter(val);
                        setActiveType(null);
                      }}
                    />
                  </div>

                  {/* Source DropDown */}
                  <div className="w-full md:w-auto min-w-0 md:min-w-[125px]">
                    <FilterDropdown
                      labelPrefix="Source"
                      value={sourceFilter}
                      options={allSources}
                      onChange={setSourceFilter}
                    />
                  </div>
                </div>

                {/* Right Date Scope Container + Preserved Reset Option */}
                <div className="col-span-2 md:col-span-auto flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 md:ml-auto w-full md:w-auto relative z-40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:inline-flex md:items-center gap-2 sm:gap-2.5 md:gap-2.5 md:p-1.5 md:bg-slate-100/70 md:dark:bg-white/[0.05] md:backdrop-blur-xl md:rounded-2xl md:border md:border-slate-200/70 md:dark:border-white/10 md:shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] md:px-3 w-full md:w-auto">
                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-0 sm:min-w-[130px] w-full sm:w-auto">
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap pl-0.5">
                        From:
                      </span>
                      <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-0 sm:min-w-[130px] w-full sm:w-auto">
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
                      className="inline-flex items-center justify-center w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] text-[#0071E3] hover:text-blue-700 dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all duration-150 active:scale-[0.95] cursor-pointer shrink-0 ml-auto sm:ml-0 border border-blue-500/20"
                      title="Reset all filters"
                      aria-label="Reset all filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>
            </SoftCard>
          </motion.div>

          {data.length === 0 && (
            <motion.div variants={itemVariants} className="relative z-10">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" strokeWidth={1.75} />
                <span>
                  Geospatial has 0 verified reports. Analytics is currently showing empty states (0). Incoming citizen reports in the Incident Reports triage queue will appear here dynamically once verified by an officer.
                </span>
              </div>
            </motion.div>
          )}

          {/* ── 2. 4-STAT SOFT METRIC CARDS ── */}
          <motion.div variants={itemVariants} className="relative z-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
              {[
                {
                  key: 'total',
                  icon: Layers,
                  color: '#0071E3',
                  value: stats.total,
                  label: 'Total Reports',
                  desc: 'Across all streams',
                  pulseColor: 'bg-blue-500',
                  hoverBorder: 'hover:border-blue-500/35 dark:hover:border-blue-500/40',
                  hoverShadow: 'hover:shadow-[0_12px_28px_-6px_rgba(0,113,227,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(0,113,227,0.22)]',
                  radialBg: 'bg-[radial-gradient(circle,rgba(0,113,227,0.16)_0%,rgba(0,113,227,0.05)_45%,transparent_70%)]',
                  bottomGradient: 'via-blue-500/70',
                  iconBg: 'bg-blue-500/10 group-hover:bg-blue-500/18 text-[#0071E3] dark:text-sky-400 border-blue-500/20 group-hover:border-blue-500/35 shadow-[0_0_16px_rgba(0,113,227,0.15)] group-hover:shadow-[0_0_24px_rgba(0,113,227,0.3)]',
                },
                {
                  key: 'high',
                  icon: AlertTriangle,
                  color: '#EF4444',
                  value: stats.high,
                  label: 'High Urgency',
                  desc: 'Immediate dispatch',
                  pulseColor: 'bg-rose-500',
                  hoverBorder: 'hover:border-rose-500/35 dark:hover:border-rose-500/40',
                  hoverShadow: 'hover:shadow-[0_12px_28px_-6px_rgba(239,68,68,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(239,68,68,0.22)]',
                  radialBg: 'bg-[radial-gradient(circle,rgba(239,68,68,0.16)_0%,rgba(239,68,68,0.05)_45%,transparent_70%)]',
                  bottomGradient: 'via-rose-500/70',
                  iconBg: 'bg-rose-500/10 group-hover:bg-rose-500/18 text-rose-600 dark:text-rose-400 border-rose-500/20 group-hover:border-rose-500/35 shadow-[0_0_16px_rgba(239,68,68,0.15)] group-hover:shadow-[0_0_24px_rgba(239,68,68,0.3)]',
                },
                {
                  key: 'verified',
                  icon: CheckCircle2,
                  color: '#10B981',
                  value: stats.verified,
                  label: 'Verified Reports',
                  desc: 'Confirmed on field',
                  pulseColor: 'bg-emerald-500',
                  hoverBorder: 'hover:border-emerald-500/35 dark:hover:border-emerald-500/40',
                  hoverShadow: 'hover:shadow-[0_12px_28px_-6px_rgba(16,185,129,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(16,185,129,0.22)]',
                  radialBg: 'bg-[radial-gradient(circle,rgba(16,185,129,0.16)_0%,rgba(16,185,129,0.05)_45%,transparent_70%)]',
                  bottomGradient: 'via-emerald-500/70',
                  iconBg: 'bg-emerald-500/10 group-hover:bg-emerald-500/18 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 group-hover:border-emerald-500/35 shadow-[0_0_16px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]',
                },
                {
                  key: 'pending',
                  icon: Clock,
                  color: '#F59E0B',
                  value: stats.incomplete,
                  label: 'Pending Review',
                  desc: 'Under triage',
                  pulseColor: 'bg-amber-500',
                  hoverBorder: 'hover:border-amber-500/35 dark:hover:border-amber-500/40',
                  hoverShadow: 'hover:shadow-[0_12px_28px_-6px_rgba(245,158,11,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(245,158,11,0.22)]',
                  radialBg: 'bg-[radial-gradient(circle,rgba(245,158,11,0.16)_0%,rgba(245,158,11,0.05)_45%,transparent_70%)]',
                  bottomGradient: 'via-amber-500/70',
                  iconBg: 'bg-amber-500/10 group-hover:bg-amber-500/18 text-amber-600 dark:text-amber-400 border-amber-500/20 group-hover:border-amber-500/35 shadow-[0_0_16px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_24px_rgba(245,158,11,0.3)]',
                },
              ].map(({ key, icon: Icon, value, label, desc, pulseColor, hoverBorder, hoverShadow, radialBg, bottomGradient, iconBg }) => (
                <div
                  key={key}
                  className={`relative overflow-hidden bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-[transform,box-shadow,border-color,background-color] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:bg-white/95 dark:hover:bg-[#151e31]/95 ${hoverBorder} ${hoverShadow} min-w-0`}
                >
                  <div className={`pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full ${radialBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-gradient-to-r from-transparent ${bottomGradient} to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]`} />
                  
                  <div className="relative z-10 space-y-1 min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-200 truncate">
                      {label}
                    </p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
                      <AnimatedNumber key={`analytics-stat-${key}-${location.key}`} value={value} duration={2} />
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${pulseColor} animate-pulse shrink-0 group-hover:shadow-[0_0_8px_rgba(0,0,0,0.35)] transition-shadow duration-200`} />
                      <span className="truncate">{desc}</span>
                    </div>
                  </div>

                  <div className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl border ${iconBg} group-hover:scale-108 transition-[transform,background-color,border-color,box-shadow] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center justify-center shrink-0`}>
                    <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110" strokeWidth={1.75} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── 3. ROW: BARANGAY BAR + DONUT ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 relative z-10">
            {/* Incident Frequency per Barangay */}
            <motion.div variants={itemVariants} className="h-full">
              <BarangayBarChart
                interactive={true}
                activeBarangay={activeBarangay}
                onSelectBarangay={(b) => {
                  setActiveBarangay(b);
                  setBarangayFilter('All Barangays');
                }}
                reports={reportsForBarangayChart}
                className="h-full"
              />
            </motion.div>

            {/* Breakdown by Incident Type */}
            <motion.div variants={itemVariants} className="h-full">
              <SoftCard className="p-6 h-full flex flex-col">
                <SectionHeader
                  icon={PieChartIcon}
                  title="Breakdown by Incident Type"
                  description="Click any category to filter the entire view by disaster type"
                  iconColor="#8B5CF6"
                  badge={
                    <div className="flex items-center gap-2">
                      {activeType && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
                          <span>Filtered: {activeType}</span>
                          <button
                            type="button"
                            onClick={() => setActiveType(null)}
                            className="hover:opacity-75 transition-opacity cursor-pointer p-0.5"
                          >
                            <X className="w-3 h-3" strokeWidth={2} />
                          </button>
                        </div>
                      )}
                      <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/60 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => setTypeViewMode('donut')}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            typeViewMode === 'donut'
                              ? 'bg-white dark:bg-slate-700 text-[#8B5CF6] dark:text-purple-400 shadow-2xs'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                          }`}
                          title="Donut chart view"
                        >
                          <PieChartIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTypeViewMode('bar')}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            typeViewMode === 'bar'
                              ? 'bg-white dark:bg-slate-700 text-[#8B5CF6] dark:text-purple-400 shadow-2xs'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                          }`}
                          title="Bar chart view"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center flex-1">
                  {/* Chart Graphic (Donut or Bar view) */}
                  <div className="sm:col-span-5 relative flex items-center justify-center" style={{ height: 220 }}>
                    {typeChartData.some(d => d.value > 0) ? (
                      typeViewMode === 'bar' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={typeChartData}
                            margin={{ top: 12, right: 8, left: -24, bottom: 20 }}
                            onClick={(state: any) => {
                              if (state && state.activePayload && state.activePayload.length > 0) {
                                const clicked = state.activePayload[0].payload.name;
                                setActiveType(prev => (prev === clicked ? null : clicked));
                                setTypeFilter('All Types');
                              }
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="currentColor"
                              className="text-slate-200/50 dark:text-slate-800/60"
                            />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                              axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                              tickLine={false}
                              interval={0}
                              angle={-15}
                              textAnchor="end"
                              tickFormatter={(val) =>
                                val === 'Volcanic Eruption'
                                  ? 'Volcano'
                                  : val === 'Earthquake'
                                  ? 'Quake'
                                  : val
                              }
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                              axisLine={false}
                              tickLine={false}
                              width={28}
                            />
                            <Tooltip content={<PieTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                            <Bar dataKey="value" radius={[5, 5, 0, 0]} cursor="pointer">
                              {typeChartData.map((entry) => {
                                const isSelected = activeType === entry.name;
                                const isHovered = hoveredType === entry.name;
                                const isDimmed = (activeType && !isSelected) || (hoveredType && !isHovered);
                                return (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.color}
                                    opacity={isDimmed ? 0.35 : 1}
                                    style={{
                                      filter: isSelected || isHovered ? `drop-shadow(0 0 10px ${entry.color})` : undefined,
                                      transition: 'all 0.25s ease',
                                    }}
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                          {/* Pulsing ambient halo behind donut core — dynamically glows with hovered or active category color */}
                          <motion.div
                            animate={{
                              scale: hoveredType || activeType ? [1.02, 1.15, 1.02] : [0.94, 1.08, 0.94],
                              opacity: hoveredType || activeType ? [0.35, 0.6, 0.35] : [0.2, 0.45, 0.2],
                            }}
                            transition={{
                              duration: hoveredType ? 2.0 : 3.5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                            className="absolute w-28 h-28 rounded-full blur-xl pointer-events-none transition-colors duration-300"
                            style={{
                              backgroundColor: (hoveredType && TYPE_CONFIG[hoveredType]?.color)
                                ? `${TYPE_CONFIG[hoveredType].color}40`
                                : (activeType && TYPE_CONFIG[activeType]?.color)
                                ? `${TYPE_CONFIG[activeType].color}40`
                                : 'rgba(139, 92, 246, 0.2)',
                            }}
                          />

                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip content={<PieTooltip />} />
                              <Pie
                                data={typeChartData.filter(d => d.value > 0)}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={56}
                                outerRadius={82}
                                paddingAngle={5}
                                cornerRadius={6}
                                cursor="pointer"
                                isAnimationActive={true}
                                animationBegin={120}
                                animationDuration={1400}
                                animationEasing="ease-out"
                                stroke="none"
                                onClick={(d: { name?: string }) => {
                                  if (!d?.name) return;
                                  setActiveType(prev => (prev === d.name ? null : (d.name ?? null)));
                                  setTypeFilter('All Types');
                                }}
                              >
                                {typeChartData.filter(d => d.value > 0).map((entry) => {
                                  const isSelected = activeType === entry.name;
                                  const isHovered = hoveredType === entry.name;
                                  const isDimmed = (activeType && !isSelected) || (hoveredType && !isHovered);
                                  return (
                                    <Cell
                                      key={entry.name}
                                      fill={entry.color}
                                      opacity={isDimmed ? 0.35 : 1}
                                      style={{
                                        filter: isSelected || isHovered
                                          ? `drop-shadow(0 0 12px ${entry.color})`
                                          : undefined,
                                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                      }}
                                    />
                                  );
                                })}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                        <PieChartIcon className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600 mb-1" />
                        <span className="text-[11px]">No verified incidents</span>
                      </div>
                    )}
                    {typeViewMode === 'donut' && typeChartData.some(d => d.value > 0) && (
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none z-10">
                        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                          <AnimatedNumber
                            key={`donut-count-${activeType ?? 'all'}-${location.key}`}
                            value={activeType ? (typeChartData.find(d => d.name === activeType)?.value ?? 0) : reportsForTypeChart.length}
                            duration={1.8}
                          />
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-widest mt-0.5 max-w-[90px] truncate text-center">
                          {activeType ? activeType : 'Total'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Legend with interactive buttons */}
                  <div className="sm:col-span-7 space-y-2.5">
                    {CANONICAL_INCIDENT_TYPES.map(type => {
                      const c = TYPE_CONFIG[type];
                      const Icon = c.icon;
                      const count = typeChartData.find(d => d.name === type)?.value ?? 0;
                      const totalTypeReports = reportsForTypeChart.length;
                      const pct = totalTypeReports > 0 ? Math.round((count / totalTypeReports) * 100) : 0;
                      const isActive = activeType === type;
                      const isHovered = hoveredType === type;

                      return (
                        <motion.button
                          key={type}
                          type="button"
                          whileHover={{ y: -2, scale: 1.015 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                          onMouseEnter={() => setHoveredType(type)}
                          onMouseLeave={() => setHoveredType(null)}
                          onClick={() => {
                            setActiveType(prev => (prev === type ? null : type));
                            setTypeFilter('All Types');
                          }}
                          className={`w-full p-2.5 sm:p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer group relative overflow-hidden select-none ${
                            isActive
                              ? `${c.activeBg} ${c.activeBorder} ${c.activeShadow}`
                              : `bg-white/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-white/5 ${c.hoverBg} ${c.glowBorder} ${c.glowShadow}`
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5 relative z-10">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-110"
                                style={{
                                  background: c.bg,
                                  borderColor: isHovered || isActive ? `${c.color}70` : `${c.color}30`,
                                  color: c.color,
                                  boxShadow: isHovered || isActive ? `0 0 12px ${c.color}45` : undefined,
                                }}
                              >
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:scale-105" strokeWidth={1.8} />
                              </div>
                              <span
                                className={`text-xs font-semibold truncate transition-colors duration-200 ${
                                  isActive
                                    ? 'text-slate-900 dark:text-white font-bold'
                                    : 'text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'
                                }`}
                                style={{
                                  color: isHovered ? c.color : undefined,
                                }}
                              >
                                {type}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums transition-transform duration-200 group-hover:scale-105">
                                <AnimatedNumber key={`legend-count-${type}-${location.key}`} value={count} duration={1.8} />
                              </span>
                              <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                ({pct}%)
                              </span>
                            </div>
                          </div>
                          {/* Animated Miniature Progress Indicator with color glow */}
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden relative">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.95, ease: [0.25, 1, 0.5, 1] }}
                              className="h-full rounded-full transition-[box-shadow] duration-200"
                              style={{
                                backgroundColor: c.color,
                                boxShadow: isHovered || isActive ? `0 0 10px ${c.color}` : undefined,
                              }}
                            />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </SoftCard>
            </motion.div>
          </div>

          {/* ── 4. INCIDENT VOLUME TIME-SERIES ── */}
          <motion.div variants={itemVariants} className="relative z-10">
            <SoftCard className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <SectionHeader
                  icon={TrendingUp}
                  title="Incident Volume Over Time"
                  description="Daily incident intake volume and rate of submissions"
                  iconColor="#0071E3"
                />

                {/* Soft Segmented Control with glowing blue hover effects */}
                <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl shrink-0 border border-slate-200/60 dark:border-white/5 shadow-inner self-start sm:self-auto backdrop-blur-md">
                  {(['7d', '30d', '3m'] as const).map((r) => {
                    const isActive = volumeRange === r;
                    return (
                      <motion.button
                        key={r}
                        type="button"
                        whileHover={{ y: -1, scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                        onClick={() => setVolumeRange(r)}
                        className={`group relative px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer select-none ${
                          isActive
                            ? 'bg-white text-[#0071E3] dark:bg-slate-700 dark:text-sky-300 shadow-[0_2px_10px_rgba(0,113,227,0.18)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)] ring-1 ring-[#0071E3]/25 dark:ring-blue-400/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-[#0071E3] dark:hover:text-sky-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:shadow-2xs'
                        }`}
                      >
                        <span className="transition-colors duration-200">
                          {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'Last 3 Months'}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {volumeChartData.length ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeChartData} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="softBlueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-slate-200/50 dark:text-slate-800/60"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<VolumeTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#2563EB"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#softBlueGradient)"
                        dot={{ r: 3, fill: '#2563EB', strokeWidth: 1.5, stroke: '#fff' }}
                        activeDot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-xs gap-2">
                  <TrendingUp className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                  <span>No time-series reports recorded for the chosen timeframe.</span>
                </div>
              )}
            </SoftCard>
          </motion.div>

          {/* ── 5. SOURCE CHANNELS BREAKDOWN (Presentable Glassmorphic Cards) ── */}
          <motion.div variants={itemVariants} className="relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  icon: Bot,
                  label: 'Messenger Chatbot',
                  count: stats.bot,
                  desc: 'Direct citizen conversational submissions',
                  bg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                  barGradient: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600',
                  badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                  topBar: 'from-indigo-500 via-purple-500 to-indigo-500',
                },
                {
                  icon: Globe2,
                  label: 'Social Media Scraper',
                  count: stats.scraper,
                  desc: 'AI-mined community social feeds and groups',
                  bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border-blue-500/20',
                  barGradient: 'bg-gradient-to-r from-[#0071E3] via-blue-500 to-sky-400',
                  badgeBg: 'bg-blue-500/10 text-[#0071E3] dark:text-sky-400 border-blue-500/20',
                  topBar: 'from-[#0071E3] via-sky-400 to-[#0071E3]',
                },
              ].map(({ icon: Icon, label, count, desc, bg, barGradient, badgeBg, topBar }) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={label}>
                    <SoftCard className="relative overflow-hidden p-6 flex items-center gap-5 border border-slate-200/80 dark:border-white/10 cursor-default backdrop-blur-md shadow-xs">
                      {/* Fixed Top Accent Gradient Line */}
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${topBar} opacity-100`} />

                      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs relative z-10 ${bg}`}>
                        <Icon className="w-7 h-7" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {label}
                          </p>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs tabular-nums ${badgeBg}`}>
                            {pct}% intake
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1.5">
                          <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                            <AnimatedNumber key={`source-count-${label}-${count}-${location.key}`} value={count} duration={1.6} />
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {count === 1 ? 'incident report' : 'incident reports'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{desc}</p>
                        {/* Recessed Progress Track */}
                        <div className="mt-3.5 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/60 dark:border-white/5 relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                            className={`h-full rounded-full ${barGradient}`}
                          />
                        </div>
                      </div>
                    </SoftCard>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── 6. HIGH-RISK BARANGAYS RANKING (Minimalist iOS Priority Table) ── */}
          <motion.div variants={itemVariants} className="relative z-10">
            <SoftCard className="p-5 sm:p-6 h-full flex flex-col">
              <SectionHeader
                icon={AlertTriangle}
                title="High-Risk Barangays"
                description="Priority ranking determined by cumulative volume & urgency score"
                iconColor="#EF4444"
                badge={
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Top {riskData.length} Priority Zones</span>
                  </span>
                }
              />

              {(() => {
                const maxRiskIncidents = Math.max(...riskData.map((r) => r.incidents), 1);

                return (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md shadow-xs">
                    <table className="w-full min-w-[650px] text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-50/80 dark:bg-white/[0.04] border-b border-slate-200/70 dark:border-white/5">
                        <tr>
                          <th className="py-3 px-4 sm:px-5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Barangay &amp; Sector
                          </th>
                          <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Incident Density
                          </th>
                          <th className="py-3 px-4 text-center text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            High Urgency
                          </th>
                          <th className="py-3 px-4 text-center text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Risk Priority
                          </th>
                          <th className="py-3 px-4 sm:px-5 text-center text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Dominant Need
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
                        {riskData.length > 0 ? (
                          riskData.map((item, index) => {
                            const isCritical = item.priority === 'Critical';
                            const isHigh = item.priority === 'High';
                            const isModerate = item.priority === 'Moderate';
                            const need = getDominantNeedMeta(item.dominantType);
                            const densityPct = Math.round((item.incidents / maxRiskIncidents) * 100);

                            return (
                              <tr
                                key={item.barangay}
                                className="border-b border-slate-100/80 dark:border-white/5 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-white/[0.025] transition-colors duration-150 group"
                              >
                                {/* 1. Ranked Barangay & Sector */}
                                <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] tabular-nums shrink-0 shadow-2xs border ${
                                        index === 0
                                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 ring-1 ring-amber-500/20'
                                          : index === 1
                                          ? 'bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300/60 dark:border-white/10'
                                          : index === 2
                                          ? 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30'
                                          : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/5'
                                      }`}
                                    >
                                      {index + 1}
                                    </span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <MapPin className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400 shrink-0" strokeWidth={1.75} />
                                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                                        {item.barangay}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* 2. Reports & Recessed Incident Density Bar */}
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="space-y-1.5 min-w-[130px] max-w-[180px]">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                        {item.incidents} {item.incidents === 1 ? 'report' : 'reports'}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                                        {densityPct}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-[#0071E3] transition-all duration-500"
                                        style={{ width: `${Math.max(10, densityPct)}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>

                                {/* 3. High Urgency Count Pill */}
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  {item.high > 0 ? (
                                    <span className="inline-flex items-center justify-center gap-1.5 w-[84px] py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs tabular-nums">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)] animate-pulse shrink-0" />
                                      <span>{item.high} Urgent</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center gap-1.5 w-[84px] py-0.5 rounded-full text-xs font-medium bg-slate-100/70 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-white/5 tabular-nums">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                      <span>0 Urgent</span>
                                    </span>
                                  )}
                                </td>

                                {/* 4. Risk Priority Apple Pill */}
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center justify-center gap-1.5 w-[86px] py-0.5 rounded-full text-xs font-medium border shadow-2xs ${
                                      isCritical
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25'
                                        : isHigh
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                        : isModerate
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        isCritical
                                          ? 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)]'
                                          : isHigh
                                          ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                                          : isModerate
                                          ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                                          : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                                      }`}
                                    />
                                    <span>{item.priority}</span>
                                  </span>
                                </td>

                                {/* 5. Dominant Need Pill */}
                                <td className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">
                                  <span className={`inline-flex items-center justify-center w-[92px] py-0.5 rounded-full text-xs font-semibold border shadow-2xs ${need.pill}`}>
                                    <span>{need.label}</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                              No verified geospatial risk data recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </SoftCard>
          </motion.div>

          {/* ── 7. PRESCRIPTIVE RECOMMENDATIONS ── */}
          <motion.div variants={itemVariants} className="relative z-10">
            <SoftCard className="p-6 relative overflow-hidden bg-gradient-to-br from-amber-500/[0.03] via-blue-500/[0.02] to-slate-50/50 dark:from-amber-950/20 dark:via-slate-900/90 dark:to-slate-900/80 border-amber-500/20 dark:border-amber-500/20 shadow-sm">
              {/* Subtle ambient light glow orbs */}
              <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 bg-amber-400/10 dark:bg-amber-400/5 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 bg-blue-500/10 dark:bg-blue-400/5 rounded-full blur-3xl" />

              <SectionHeader
                icon={Lightbulb}
                title="Prescriptive Action Recommendations"
                description="Automated resource pre-positioning intelligence based on real-time incident density"
                iconColor="#F59E0B"
                iconBg="rgba(245, 158, 11, 0.12)"
                badge={
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI Dispatch Intelligence</span>
                  </span>
                }
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
                {recommendations.map((item) => {
                  const need = getDominantNeedMeta(item.dominantType);
                  const isHigh = item.priority === 'High';
                  const isModerate = item.priority === 'Moderate';

                  const isCritical = item.priority === 'Critical';
                  const cardTheme = isCritical
                    ? {
                        bg: 'bg-white dark:bg-slate-900/90',
                        border: 'border-purple-500/30 dark:border-purple-500/30',
                        pinBg: 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/20 text-purple-600 dark:text-purple-400',
                        hover: 'hover:border-purple-500/50 dark:hover:border-purple-500/50 hover:shadow-[0_8px_24px_rgba(139,92,246,0.15)]',
                        topBar: 'from-purple-500 via-rose-500 to-amber-500',
                        badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-2xs',
                        pulse: 'bg-purple-500',
                      }
                    : isHigh
                    ? {
                        bg: 'bg-white dark:bg-slate-900/90',
                        border: 'border-slate-200/80 dark:border-white/10',
                        pinBg: 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/20 text-rose-600 dark:text-rose-400',
                        hover: 'hover:border-slate-300 dark:hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
                        topBar: 'from-rose-500 via-rose-400 to-amber-500',
                        badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-2xs',
                        pulse: 'bg-rose-500',
                      }
                    : isModerate
                    ? {
                        bg: 'bg-white dark:bg-slate-900/90',
                        border: 'border-slate-200/80 dark:border-white/10',
                        pinBg: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 text-amber-600 dark:text-amber-400',
                        hover: 'hover:border-slate-300 dark:hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
                        topBar: 'from-amber-500 via-amber-400 to-yellow-400',
                        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-2xs',
                        pulse: 'bg-amber-500',
                      }
                    : {
                        bg: 'bg-white dark:bg-slate-900/90',
                        border: 'border-slate-200/80 dark:border-white/10',
                        pinBg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20 text-[#0071E3] dark:text-sky-400',
                        hover: 'hover:border-slate-300 dark:hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
                        topBar: 'from-[#0071E3] via-sky-400 to-emerald-400',
                        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-2xs',
                        pulse: 'bg-[#10b981]',
                      };

                  return (
                    <motion.div
                      key={item.barangay}
                      whileHover={{ y: -3, scale: 1.015 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                      className={`group relative overflow-hidden rounded-2xl border ${cardTheme.border} p-5 ${cardTheme.bg} backdrop-blur-md transition-all duration-300 flex flex-col justify-between cursor-default shadow-xs ${cardTheme.hover}`}
                    >
                      {/* Top Accent Gradient Bar with Hover Expansion */}
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cardTheme.topBar} opacity-85 group-hover:opacity-100 group-hover:h-1.5 transition-all duration-300`} />

                      <div>
                        <div className="flex items-center justify-between gap-3 mb-3 pt-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${cardTheme.pinBg}`}>
                              <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                            </div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-[#0071E3] dark:group-hover:text-sky-400 transition-colors">
                              {item.barangay}
                            </span>
                          </div>
                          <span className={`shrink-0 inline-flex items-center justify-center gap-1.5 w-[124px] py-0.5 rounded-full border text-[11px] font-bold ${cardTheme.badge}`}>
                            <span className="relative flex h-2 w-2 items-center justify-center">
                              {(isCritical || isHigh) && (
                                <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${isCritical ? 'bg-purple-500' : 'bg-rose-500'}`} />
                              )}
                              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full shrink-0 ${cardTheme.pulse}`} />
                            </span>
                            <span>{item.priority} Urgency</span>
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 font-normal">
                          {item.text}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>Dominant:</span>
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full border text-[10.5px] font-semibold shadow-2xs ${need.pill}`}>
                            {need.label}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 shadow-2xs tabular-nums group-hover:border-[#0071E3]/30 transition-colors">
                          {item.incidents} {item.incidents === 1 ? 'event' : 'events'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
                {!recommendations.length && (
                  <div className="lg:col-span-3 text-center py-10 text-xs text-slate-400">
                    Prescriptive dispatch recommendations will populate dynamically as reports are verified.
                  </div>
                )}
              </div>
            </SoftCard>
          </motion.div>
        </motion.div>
      </div>
  );
}
