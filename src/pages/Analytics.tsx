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
  Siren,
  HeartPulse,
  Droplets,
  HardHat,
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
  'Search & Rescue': {
    icon: Siren,
    iconClass: 'text-amber-500',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(245,158,11,0.25)]',
    glowBorder: 'hover:border-amber-400/80 dark:hover:border-amber-500/70',
    hoverBg: 'hover:bg-amber-50/60 dark:hover:bg-amber-950/25',
    activeBorder: 'border-amber-500/60 dark:border-amber-400/60',
    activeBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.28)]',
  },
  Medical: {
    icon: HeartPulse,
    iconClass: 'text-rose-500',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(239,68,68,0.25)]',
    glowBorder: 'hover:border-rose-400/80 dark:hover:border-rose-500/70',
    hoverBg: 'hover:bg-rose-50/60 dark:hover:bg-rose-950/25',
    activeBorder: 'border-rose-500/60 dark:border-rose-400/60',
    activeBg: 'bg-rose-500/15 dark:bg-rose-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.28)]',
  },
  'Food & Water': {
    icon: Droplets,
    iconClass: 'text-emerald-500',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(16,185,129,0.30)]',
    glowBorder: 'hover:border-emerald-400/80 dark:hover:border-emerald-500/70',
    hoverBg: 'hover:bg-emerald-50/60 dark:hover:bg-emerald-950/25',
    activeBorder: 'border-emerald-500/60 dark:border-emerald-400/60',
    activeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(16,185,129,0.32)]',
  },
  Infrastructure: {
    icon: HardHat,
    iconClass: 'text-indigo-500',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
    glowShadow: 'hover:shadow-[0_8px_24px_rgba(99,102,241,0.30)]',
    glowBorder: 'hover:border-indigo-400/80 dark:hover:border-indigo-500/70',
    hoverBg: 'hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25',
    activeBorder: 'border-indigo-500/60 dark:border-indigo-400/60',
    activeBg: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    activeShadow: 'shadow-[0_0_20px_rgba(99,102,241,0.32)]',
  },
};

const URGENCY_WEIGHT: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

// ── Helpers ──────────────────────────────────────────────────────────────────
export function normalizeIncidentType(type?: string | null): string {
  const norm = (type || '').trim().toLowerCase();
  if (norm.includes('search') || norm.includes('rescue') || norm.includes('evacuat') || norm.includes('stranded')) {
    return 'Search & Rescue';
  }
  if (norm.includes('medic') || norm.includes('casualty') || norm.includes('sugat') || norm.includes('hospital')) {
    return 'Medical';
  }
  if (norm.includes('food') || norm.includes('water') || norm.includes('tubig') || norm.includes('relief')) {
    return 'Food & Water';
  }
  if (norm.includes('infra') || norm.includes('poste') || norm.includes('kuryente') || norm.includes('fire') || norm.includes('flood') || norm.includes('landslide') || norm.includes('earthquake')) {
    return 'Infrastructure';
  }
  return 'Infrastructure';
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
      className={`rounded-2xl border transition-all duration-300 ${className}`}
      style={{
        backgroundColor: 'var(--soft-surface)',
        borderColor: 'var(--soft-border)',
        boxShadow: 'var(--soft-shadow-card)',
      }}
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
  if (norm.includes('fire')) {
    return {
      label: 'Fire',
      pill: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25',
    };
  }
  if (norm.includes('search') || norm.includes('rescue')) {
    return {
      label: 'Rescue',
      pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    };
  }
  if (norm.includes('medic') || norm.includes('casualty') || norm.includes('sugat')) {
    return {
      label: 'Medical',
      pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    };
  }
  if (norm.includes('food') || norm.includes('water') || norm.includes('relief')) {
    return {
      label: 'Relief',
      pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    };
  }
  if (norm.includes('infra') || norm.includes('poste') || norm.includes('road') || norm.includes('kuryente')) {
    return {
      label: 'Infra',
      pill: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
    };
  }
  return {
    label: 'General',
    pill: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10',
  };
}

export default function Analytics() {
  const { reports } = useReports();
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  // Click-to-filter from charts
  const [activeBarangay, setActiveBarangay] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const [typeViewMode, setTypeViewMode] = useState<'donut' | 'bar'>('donut');

  const allBarangays = useMemo(() => {
    const unique = Array.from(new Set(data.map(r => r.barangay).filter(Boolean))).sort();
    return ['All Barangays', ...unique];
  }, [data]);

  const allTypes = useMemo(() => {
    return ['All Types', 'Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure'];
  }, []);

  const allSources = useMemo(() => ['All Sources', 'Bot', 'Scraper'], []);

  // Effective filters (header dropdowns override chart clicks)
  const effectiveBarangay = barangayFilter !== 'All Barangays' ? barangayFilter : activeBarangay;
  const effectiveType = typeFilter !== 'All Types' ? typeFilter : activeType;

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
      if (effectiveBarangay && r.barangay?.toLowerCase() !== effectiveBarangay.toLowerCase()) return false;
      if (effectiveType && effectiveType !== 'All Types') {
        if (normalizeIncidentType(r.type) !== normalizeIncidentType(effectiveType)) return false;
      }
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
      if (effectiveType && effectiveType !== 'All Types') {
        if (normalizeIncidentType(r.type) !== normalizeIncidentType(effectiveType)) return false;
      }
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
      if (effectiveBarangay && r.barangay?.toLowerCase() !== effectiveBarangay.toLowerCase()) return false;
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
    return {
      total: filtered.length,
      high: filtered.filter(r => r.urgency === 'High').length,
      verified: filtered.filter(r => r.status === 'verified').length,
      resolvedToday: filtered.filter(r => {
        const p = parseReportTime(r.time);
        return p && `${p.month}/${p.day}` === todayStr && r.status === 'verified';
      }).length,
      incomplete: 0,
      bot: filtered.filter(r => r.source?.toLowerCase().includes('bot')).length,
      scraper: filtered.filter(r => r.source?.toLowerCase().includes('scraper')).length,
      avgResponse: responseTimes.length
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0,
    };
  }, [filtered]);

  // ── Donut & Bar chart data for Incident Types ──
  const typeChartData = useMemo(() => {
    const counts: Record<string, number> = {
      'Search & Rescue': 0,
      'Medical': 0,
      'Food & Water': 0,
      'Infrastructure': 0,
    };
    reportsForTypeChart.forEach(r => {
      const canonical = normalizeIncidentType(r.type);
      counts[canonical] = (counts[canonical] || 0) + 1;
    });
    return ['Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure']
      .map(type => ({
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
    const grouped: Record<string, { incidents: number; score: number; high: number; types: Record<string, number> }> = {};
    data.forEach(r => {
      const n = r.barangay || 'Unknown';
      if (!grouped[n]) grouped[n] = { incidents: 0, score: 0, high: 0, types: {} };
      grouped[n].incidents++;
      grouped[n].score += URGENCY_WEIGHT[r.urgency] || 1;
      if (r.urgency === 'High') grouped[n].high++;
      grouped[n].types[r.type] = (grouped[n].types[r.type] || 0) + 1;
    });
    return Object.entries(grouped)
      .map(([barangay, v]) => {
        const dominantType = Object.entries(v.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
        return {
          barangay,
          ...v,
          dominantType,
          priority: v.high > 0 ? 'High' : v.score >= 4 ? 'Moderate' : 'Low',
        };
      })
      .sort((a, b) => b.score - a.score || b.incidents - a.incidents)
      .slice(0, 6);
  }, [data]);

  const recommendations = useMemo(() => riskData.slice(0, 3).map(item => {
    const resource = item.dominantType === 'Medical' ? 'medical response teams and ambulance support'
      : item.dominantType === 'Search & Rescue' ? 'search and rescue units with extraction equipment'
        : item.dominantType === 'Food & Water' ? 'relief food packs and potable water containers'
          : 'road-clearing crews and structural assessment engineers';
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

  const hasActiveFilters =
    barangayFilter !== 'All Barangays' ||
    typeFilter !== 'All Types' ||
    sourceFilter !== 'All Sources' ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(activeBarangay) ||
    Boolean(activeType);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader variant="analytics" />;

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
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-sky-400 border border-blue-500/20 flex items-center justify-center shrink-0">
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
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap items-stretch md:items-center justify-between gap-2.5 sm:gap-3 relative z-50">
                <div className="flex flex-wrap items-center gap-2.5 relative z-50">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 text-xs font-semibold shrink-0 border border-blue-500/25 dark:border-blue-400/25 shadow-2xs">
                    <Filter className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
                    <span>Filters</span>
                  </div>

                  {/* Barangay DropDown */}
                  <FilterDropdown
                    value={barangayFilter}
                    options={allBarangays}
                    onChange={(val) => {
                      setBarangayFilter(val);
                      setActiveBarangay(null);
                    }}
                  />

                  {/* Type DropDown */}
                  <FilterDropdown
                    value={typeFilter}
                    options={allTypes}
                    onChange={(val) => {
                      setTypeFilter(val);
                      setActiveType(null);
                    }}
                  />

                  {/* Source DropDown */}
                  <FilterDropdown
                    value={sourceFilter}
                    options={allSources}
                    onChange={setSourceFilter}
                  />
                </div>

                {/* Date Pickers & Reset */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 md:ml-auto w-full md:w-auto relative z-40">
                  <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[130px]">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      From:
                    </span>
                    <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[130px]">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      To:
                    </span>
                    <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0071E3] dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 ml-auto sm:ml-0 border border-blue-500/25"
                      title="Reset all filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Reset</span>
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
                                val === 'Search & Rescue'
                                  ? 'S&R'
                                  : val === 'Food & Water'
                                  ? 'F&W'
                                  : val === 'Infrastructure'
                                  ? 'Infra'
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
                    {['Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure'].map(type => {
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
                              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full transition-all duration-300"
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
                  hoverBorder: 'hover:border-indigo-400 dark:hover:border-indigo-400 ring-1 ring-transparent hover:ring-indigo-400/30',
                  hoverShadow: 'hover:shadow-[0_0_24px_rgba(99,102,241,0.22),0_12px_28px_rgba(99,102,241,0.14)] dark:hover:shadow-[0_0_30px_rgba(99,102,241,0.32),0_12px_28px_rgba(0,0,0,0.5)]',
                  hoverBg: 'hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20',
                  iconHover: 'group-hover:shadow-[0_0_16px_rgba(99,102,241,0.35)] group-hover:border-indigo-400/50',
                  barGradient: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:shadow-[0_0_14px_rgba(99,102,241,0.8)]',
                  badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 group-hover:border-indigo-400/50 group-hover:bg-indigo-500/15',
                  glowOrb: 'bg-indigo-500/0 group-hover:bg-indigo-500/15 dark:group-hover:bg-indigo-500/20',
                  topBar: 'from-indigo-500 via-purple-500 to-indigo-500',
                },
                {
                  icon: Globe2,
                  label: 'Social Media Scraper',
                  count: stats.scraper,
                  desc: 'AI-mined community social feeds and groups',
                  bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border-blue-500/20',
                  hoverBorder: 'hover:border-[#0071E3] dark:hover:border-sky-400 ring-1 ring-transparent hover:ring-[#0071E3]/30',
                  hoverShadow: 'hover:shadow-[0_0_24px_rgba(0,113,227,0.22),0_12px_28px_rgba(0,113,227,0.14)] dark:hover:shadow-[0_0_30px_rgba(0,113,227,0.32),0_12px_28px_rgba(0,0,0,0.5)]',
                  hoverBg: 'hover:bg-blue-50/40 dark:hover:bg-blue-950/20',
                  iconHover: 'group-hover:shadow-[0_0_16px_rgba(0,113,227,0.35)] group-hover:border-blue-400/50',
                  barGradient: 'bg-gradient-to-r from-[#0071E3] via-blue-500 to-sky-400 shadow-[0_0_10px_rgba(0,113,227,0.5)] group-hover:shadow-[0_0_14px_rgba(0,113,227,0.8)]',
                  badgeBg: 'bg-blue-500/10 text-[#0071E3] dark:text-sky-400 border-blue-500/20 group-hover:border-blue-400/50 group-hover:bg-blue-500/15',
                  glowOrb: 'bg-blue-500/0 group-hover:bg-blue-500/15 dark:group-hover:bg-blue-500/20',
                  topBar: 'from-[#0071E3] via-sky-400 to-[#0071E3]',
                },
              ].map(({ icon: Icon, label, count, desc, bg, hoverBorder, hoverShadow, hoverBg, iconHover, barGradient, badgeBg, glowOrb, topBar }) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <motion.div
                    key={label}
                    whileHover={{ y: -3, scale: 1.01 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <SoftCard className={`group relative overflow-hidden p-6 flex items-center gap-5 transition-all duration-300 border border-slate-200/80 dark:border-white/10 ${hoverBorder} ${hoverShadow} ${hoverBg} cursor-default backdrop-blur-md`}>
                      {/* Top Accent Gradient Line with Hover Bloom */}
                      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${topBar} opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-300`} />

                      {/* Ambient Light Glow Orb */}
                      <div className={`pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full blur-2xl transition-all duration-500 ${glowOrb}`} />

                      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 shadow-2xs relative z-10 ${bg} ${iconHover}`}>
                        <Icon className="w-7 h-7" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {label}
                          </p>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs tabular-nums transition-all duration-300 ${badgeBg}`}>
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
                        {/* Recessed Progress Track with Neon Glow Fill */}
                        <div className="mt-3.5 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/60 dark:border-white/5 relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                            className={`h-full rounded-full transition-all duration-300 ${barGradient}`}
                          />
                        </div>
                      </div>
                    </SoftCard>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* ── 6. HIGH-RISK BARANGAYS RANKING (Presentable Priority Analytics Table) ── */}
          <motion.div variants={itemVariants} className="relative z-10">
            <SoftCard className="p-6 h-full flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <SectionHeader
                  icon={AlertTriangle}
                  title="High-Risk Barangays"
                  description="Priority ranking determined by cumulative volume & urgency score"
                  iconColor="#EF4444"
                />
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs">
                    Top {riskData.length} Critical Zones
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md shadow-xs">
                <table className="w-full min-w-[560px] text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-white/5">
                    <tr>
                      <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        Barangay
                      </th>
                      <th className="py-3 px-3 text-center text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        Total Reports
                      </th>
                      <th className="py-3 px-3 text-center text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        High Urgency
                      </th>
                      <th className="py-3 px-3 text-center text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        Risk Priority
                      </th>
                      <th className="py-3 px-4 text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        Dominant Need
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {riskData.length > 0 ? (
                      riskData.map((item, index) => {
                        const need = getDominantNeedMeta(item.dominantType);

                        return (
                          <tr
                            key={item.barangay}
                            className="border-b border-slate-100/80 dark:border-white/5 last:border-b-0"
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] tabular-nums shrink-0 shadow-2xs border ${
                                  index === 0
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                    : index === 1
                                    ? 'bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300/60 dark:border-white/10'
                                    : index === 2
                                    ? 'bg-amber-700/15 text-amber-800 dark:text-amber-300 border-amber-700/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-white/5'
                                }`}>
                                  {index + 1}
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {item.barangay}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/5 shadow-2xs tabular-nums">
                                {item.incidents}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-0.5 rounded-lg font-mono font-extrabold text-xs bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 shadow-2xs tabular-nums">
                                {item.high}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                                item.priority === 'High'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                  : item.priority === 'Moderate'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              }`}>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    item.priority === 'High'
                                      ? 'bg-rose-500'
                                      : item.priority === 'Moderate'
                                      ? 'bg-amber-500'
                                      : 'bg-[#10b981]'
                                  }`}
                                />
                                <span>{item.priority}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`w-20 inline-flex items-center justify-center py-1 rounded-full text-xs font-semibold border shadow-2xs ${need.pill}`}>
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

                  const cardTheme = isHigh
                    ? {
                        bg: 'bg-gradient-to-br from-rose-500/[0.07] via-rose-50/70 to-amber-500/[0.04] dark:from-rose-950/35 dark:via-slate-900/85 dark:to-amber-950/20',
                        border: 'border-rose-200/90 dark:border-rose-500/30',
                        pinBg: 'bg-rose-500/15 dark:bg-rose-500/25 border-rose-500/25 text-rose-600 dark:text-rose-400',
                        hover: 'hover:border-rose-400 hover:shadow-[0_12px_28px_rgba(244,63,94,0.18)] dark:hover:shadow-[0_12px_28px_rgba(244,63,94,0.25)] hover:from-rose-500/[0.12] hover:to-amber-500/[0.08]',
                        topBar: 'from-rose-500 via-rose-400 to-amber-500',
                        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 shadow-2xs',
                        pulse: 'bg-rose-500',
                      }
                    : isModerate
                    ? {
                        bg: 'bg-gradient-to-br from-amber-500/[0.07] via-amber-50/70 to-yellow-500/[0.04] dark:from-amber-950/35 dark:via-slate-900/85 dark:to-yellow-950/20',
                        border: 'border-amber-200/90 dark:border-amber-500/30',
                        pinBg: 'bg-amber-500/15 dark:bg-amber-500/25 border-amber-500/25 text-amber-600 dark:text-amber-400',
                        hover: 'hover:border-amber-400 hover:shadow-[0_12px_28px_rgba(245,158,11,0.18)] dark:hover:shadow-[0_12px_28px_rgba(245,158,11,0.25)] hover:from-amber-500/[0.12] hover:to-yellow-500/[0.08]',
                        topBar: 'from-amber-500 via-amber-400 to-yellow-400',
                        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-2xs',
                        pulse: 'bg-amber-500',
                      }
                    : {
                        bg: 'bg-gradient-to-br from-blue-500/[0.06] via-sky-50/70 to-emerald-500/[0.04] dark:from-blue-950/35 dark:via-slate-900/85 dark:to-emerald-950/20',
                        border: 'border-blue-200/90 dark:border-blue-500/30',
                        pinBg: 'bg-blue-500/15 dark:bg-blue-500/25 border-blue-500/25 text-[#0071E3] dark:text-sky-400',
                        hover: 'hover:border-blue-400 hover:shadow-[0_12px_28px_rgba(0,113,227,0.18)] dark:hover:shadow-[0_12px_28px_rgba(0,113,227,0.25)] hover:from-blue-500/[0.12] hover:to-sky-500/[0.08]',
                        topBar: 'from-[#0071E3] via-sky-400 to-emerald-400',
                        badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shadow-2xs',
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
                          <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${cardTheme.badge}`}>
                            <span className="relative flex h-2 w-2 items-center justify-center">
                              {isHigh && (
                                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60 animate-ping" />
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
                        <span className={`w-20 inline-flex items-center justify-center py-0.5 rounded-full border text-[11px] font-semibold shadow-2xs ${need.pill}`}>
                          <span>{need.label}</span>
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
