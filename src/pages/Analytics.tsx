import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
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
  XCircle,
  Bot,
  Globe2,
  Clock3,
  Filter,
  X,
  Layers,
  Sparkles,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
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
import PageTransition from '../components/Transition';

// ── Types ───────────────────────────────────────────────────────────────────
export type AnalyticsReport = {
  id: string;
  barangay: string;
  type: string;
  urgency: string;
  source: string;
  time: string;
  status: string;
  verifiedAt?: string | null;
};

// ── Apple Design Physics & Stagger Variants (critically damped, zero wobble) ──
const APPLE_SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.8 } as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.03,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 340,
      damping: 34,
      mass: 0.8,
    },
  },
};

// ── Design tokens ────────────────────────────────────────────────────────────
const ACCENT_BLUE = '#0071E3';
const RED = '#DC2626';

const TYPE_CONFIG: Record<
  string,
  { icon: LucideIcon; iconClass: string; color: string; bg: string }
> = {
  'Search & Rescue': { icon: Siren, iconClass: 'text-amber-500', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Medical: { icon: HeartPulse, iconClass: 'text-rose-500', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'Food & Water': { icon: Droplets, iconClass: 'text-emerald-500', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  Infrastructure: { icon: HardHat, iconClass: 'text-indigo-500', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
};

const URGENCY_BAR_COLOR: Record<string, string> = {
  High: RED,
  Moderate: '#F59E0B',
  Low: '#10B981',
};

const URGENCY_CLASS: Record<string, string> = {
  High: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  Moderate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

const URGENCY_WEIGHT: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseReportTime(value: string) {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  return m ? { month: +m[1], day: +m[2], hour: +m[3], minute: +m[4] } : null;
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

// ── Apple Card Component with Translucent Materials & Specular Border ────────
function AppleCard({
  children,
  className = '',
  specular = true,
}: {
  children: ReactNode;
  className?: string;
  specular?: boolean;
}) {
  return (
    <div
      className={`relative backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${specular ? 'border-t border-t-white/80 dark:border-t-white/10' : ''
        } transition-all ${className}`}
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
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs"
          style={{
            background: iconBg ?? `${iconColor}14`,
            borderColor: `${iconColor}24`,
            color: iconColor,
          }}
        >
          <Icon className="w-4 h-4" />
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

// ── Apple-grade Custom Tooltips ───────────────────────────────────────────────
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
    <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-850/95 border border-slate-200/80 dark:border-white/15 px-3.5 py-2.5 rounded-xl shadow-xl text-xs">
      <p className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{val}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{val === 1 ? 'incident' : 'incidents'}</span>
      </div>
    </div>
  );
}

function BarangayTooltip({ active, payload }: CTP) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as { name?: string; count?: number; dominantUrgency?: string } | undefined;
  if (!item) return null;
  const barColor = URGENCY_BAR_COLOR[item.dominantUrgency ?? ''] ?? ACCENT_BLUE;
  return (
    <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-850/95 border border-slate-200/80 dark:border-white/15 px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1">
      <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-700/60">
        <span className="text-slate-500 dark:text-slate-400">Total reports:</span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">{item.count}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500 dark:text-slate-400">Dominant:</span>
        <span className="font-semibold text-[11px] px-1.5 py-0.5 rounded" style={{ color: barColor, background: `${barColor}18` }}>
          {item.dominantUrgency} Urgency
        </span>
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: CTP) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as { name?: string; value?: number; color?: string } | undefined;
  if (!d) return null;
  return (
    <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-850/95 border border-slate-200/80 dark:border-white/15 px-3.5 py-2.5 rounded-xl shadow-xl text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="font-semibold text-slate-800 dark:text-slate-100">{d.name}</span>
      </div>
      <p className="font-bold text-sm mt-1 text-slate-900 dark:text-white tabular-nums">
        {d.value} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{d.value === 1 ? 'report' : 'reports'}</span>
      </p>
    </div>
  );
}

export interface BarangayBarChartProps {
  reports?: AnalyticsReport[];
  interactive?: boolean;
  activeBarangay?: string | null;
  onSelectBarangay?: (barangay: string | null) => void;
  className?: string;
}

export function BarangayBarChart({
  reports: propReports,
  interactive = true,
  activeBarangay = null,
  onSelectBarangay,
  className = '',
}: BarangayBarChartProps) {
  const { reports: contextReports } = useReports();
  const rawReports = propReports ?? (contextReports as unknown as AnalyticsReport[]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { count: number; urgencyCounts: Record<string, number> }> = {};
    (rawReports || []).forEach((r) => {
      const n = r.barangay || 'Unknown';
      if (!grouped[n]) grouped[n] = { count: 0, urgencyCounts: {} };
      grouped[n].count++;
      const urg = r.urgency || 'Low';
      grouped[n].urgencyCounts[urg] = (grouped[n].urgencyCounts[urg] || 0) + 1;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, v]) => {
        const dominantUrgency = Object.entries(v.urgencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Low';
        return { name, count: v.count, dominantUrgency };
      });
  }, [rawReports]);

  return (
    <AppleCard className={`p-4 sm:p-5 lg:p-6 flex flex-col ${className}`}>
      <SectionHeader
        icon={MapPin}
        title="Incident Frequency per Barangay"
        description={
          interactive
            ? 'Click any bar to filter all analytics to that specific location'
            : 'Distribution of reported incidents across Talisay barangays'
        }
        iconColor="#0071E3"
        badge={
          interactive && activeBarangay ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0071E3]/10 text-[#0071E3] dark:text-sky-400 border border-[#0071E3]/20 text-xs font-semibold">
              <span>Filtered: {activeBarangay}</span>
              <button
                onClick={() => onSelectBarangay?.(null)}
                className="hover:opacity-75 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : null
        }
      />

      {chartData.length ? (
        <div className="w-full flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <div className="min-w-[500px] md:min-w-0 w-full h-full" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -14, bottom: 44 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-slate-200/50 dark:text-slate-800/60"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.2 }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BarangayTooltip />} cursor={{ fill: 'rgba(0,113,227,0.06)' }} />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  barSize={26}
                  cursor={interactive ? 'pointer' : 'default'}
                  onClick={
                    interactive
                      ? (d: { name?: string }) => {
                          if (!d?.name) return;
                          onSelectBarangay?.(activeBarangay === d.name ? null : (d.name ?? null));
                        }
                      : undefined
                  }
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={URGENCY_BAR_COLOR[entry.dominantUrgency] ?? ACCENT_BLUE}
                      opacity={interactive && activeBarangay && activeBarangay !== entry.name ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-xs gap-2 flex-1">
          <BarChart3 className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
          <span>No incident records match current filters.</span>
        </div>
      )}

      {/* Urgency Color Legend */}
      <div className="flex items-center justify-between gap-4 mt-4 pt-3.5 border-t border-slate-100 dark:border-white/5">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Urgency Legend
        </span>
        <div className="flex items-center gap-4">
          {Object.entries(URGENCY_BAR_COLOR).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </AppleCard>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Analytics() {
  const { reports } = useReports();
  const data = reports as AnalyticsReport[];

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

  const allBarangays = useMemo(() => {
    const unique = Array.from(new Set(data.map(r => r.barangay).filter(Boolean))).sort();
    return ['All Barangays', ...unique];
  }, [data]);

  const allTypes = useMemo(() => ['All Types', 'Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure'], []);
  const allSources = useMemo(() => ['All Sources', 'Bot', 'Scraper'], []);

  // Effective filters (header dropdowns override chart clicks)
  const effectiveBarangay = barangayFilter !== 'All Barangays' ? barangayFilter : activeBarangay;
  const effectiveType = typeFilter !== 'All Types' ? typeFilter : activeType;

  // ── Filtered data ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (effectiveBarangay && r.barangay !== effectiveBarangay) return false;
      if (effectiveType && r.type !== effectiveType) return false;
      if (sourceFilter !== 'All Sources' && !r.source?.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (fromDate) {
        const p = parseReportTime(r.time);
        if (p) {
          const d = new Date(new Date().getFullYear(), p.month - 1, p.day);
          const from = new Date(fromDate);
          if (d < from) return false;
        }
      }
      if (toDate) {
        const p = parseReportTime(r.time);
        if (p) {
          const d = new Date(new Date().getFullYear(), p.month - 1, p.day);
          const to = new Date(toDate);
          if (d > to) return false;
        }
      }
      return true;
    });
  }, [data, effectiveBarangay, effectiveType, sourceFilter, fromDate, toDate]);

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
      incomplete: filtered.filter(r => r.status === 'under_review' || r.status === 'pending').length,
      bot: filtered.filter(r => r.source?.toLowerCase().includes('bot')).length,
      scraper: filtered.filter(r => r.source?.toLowerCase().includes('scraper')).length,
      avgResponse: responseTimes.length
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0,
    };
  }, [filtered]);

  // ── Donut chart ──────────────────────────────────────────────────────────
  const typeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    return ['Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure']
      .map(type => ({
        name: type,
        value: counts[type] || 0,
        color: TYPE_CONFIG[type]?.color ?? '#64748b',
      }))
      .filter(d => d.value > 0);
  }, [filtered]);

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
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full space-y-6 pb-8"
      >
        {/* ── 1. PAGE HEADER & FILTER BAR (Frosted Glass Specular) ── */}
        <motion.div variants={itemVariants} className="relative z-50">
          <AppleCard className="p-5 md:p-6 space-y-5 relative z-50">
            {/* Title and Primary Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#0071E3]/10 dark:bg-[#0071E3]/20 text-[#0071E3] dark:text-sky-400 border border-[#0071E3]/20 shadow-[0_0_16px_rgba(0,113,227,0.15)] flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Analytics
                    </h1>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#0071E3]/10 text-[#0071E3] dark:text-blue-400 border border-[#0071E3]/20">
                      <Sparkles className="w-3 h-3" /> Live Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Incident trends, response patterns, and prescriptive resource recommendations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl shadow-xs transition-all duration-150 active:scale-[0.97]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={downloadPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-xl shadow-md shadow-blue-500/20 transition-all duration-150 active:scale-[0.97]"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Filter Bar with DatePicker and FilterDropdown */}
            <div className="pt-4 border-t border-slate-200/60 dark:border-white/5 flex flex-col xl:flex-row xl:items-center gap-3 relative z-50">
              <div className="flex flex-wrap items-center gap-2.5 relative z-50">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                  <Filter className="w-3.5 h-3.5 text-[#0071E3]" />
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

              {/* Date Pickers */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 xl:ml-auto w-full xl:w-auto relative z-40">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    From:
                  </span>
                  <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    To:
                  </span>
                  <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0071E3] hover:text-blue-700 dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all duration-150 active:scale-[0.97]"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </AppleCard>
        </motion.div>

        {/* ── 2. 5-STAT APPLE METRIC CARDS ── */}
        <motion.div variants={itemVariants} className="relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {[
              {
                icon: Layers,
                bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border-blue-500/20',
                value: stats.total,
                label: 'Total Reports',
                desc: 'Across all streams',
              },
              {
                icon: AlertTriangle,
                bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20',
                value: stats.high,
                label: 'High Urgency',
                desc: 'Immediate dispatch',
              },
              {
                icon: CheckCircle2,
                bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                value: stats.verified,
                label: 'Verified Reports',
                desc: 'Confirmed on field',
              },
              {
                icon: Clock3,
                bg: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/20',
                value: stats.resolvedToday,
                label: 'Resolved Today',
                desc: 'Completed actions',
              },
              {
                icon: XCircle,
                bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20',
                value: stats.incomplete,
                label: 'Pending Review',
                desc: 'Under triage',
              },
            ].map(({ icon: Icon, bg, value, label, desc }) => (
              <AppleCard
                key={label}
                className="p-5 flex flex-col justify-between group hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                    {value}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                    {desc}
                  </p>
                </div>
              </AppleCard>
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
              reports={filtered}
              className="h-full"
            />
          </motion.div>

          {/* Breakdown by Incident Type */}
          <motion.div variants={itemVariants} className="h-full">
            <AppleCard className="p-6 h-full flex flex-col">
              <SectionHeader
                icon={PieChartIcon}
                title="Breakdown by Incident Type"
                description="Click any category to filter the entire view by disaster type"
                iconColor="#8B5CF6"
                badge={
                  activeType ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
                      <span>Filtered: {activeType}</span>
                      <button
                        onClick={() => setActiveType(null)}
                        className="hover:opacity-75 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center flex-1">
                {/* Donut Graphic */}
                <div className="sm:col-span-5 relative flex items-center justify-center" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<PieTooltip />} />
                      <Pie
                        data={typeChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={4}
                        cornerRadius={4}
                        cursor="pointer"
                        onClick={(d: { name?: string }) => {
                          if (!d?.name) return;
                          setActiveType(prev => (prev === d.name ? null : (d.name ?? null)));
                          setTypeFilter('All Types');
                        }}
                      >
                        {typeChartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.color}
                            opacity={activeType && activeType !== entry.name ? 0.3 : 1}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {stats.total}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-widest mt-0.5">
                      Total
                    </span>
                  </div>
                </div>

                {/* Legend with interactive buttons */}
                <div className="sm:col-span-7 space-y-2">
                  {['Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure'].map(type => {
                    const c = TYPE_CONFIG[type];
                    const Icon = c.icon;
                    const count = typeChartData.find(d => d.name === type)?.value ?? 0;
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    const isActive = activeType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setActiveType(prev => (prev === type ? null : type));
                          setTypeFilter('All Types');
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-150 text-left active:scale-[0.98] border ${isActive
                          ? 'bg-slate-100/90 dark:bg-slate-800/90 border-slate-300 dark:border-slate-600 ring-2'
                          : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                          }`}
                        style={isActive ? ({ '--tw-ring-color': c.color } as React.CSSProperties) : {}}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                            style={{ background: c.bg, borderColor: `${c.color}25` }}
                          >
                            <Icon className={`w-4 h-4 ${c.iconClass}`} />
                          </div>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {count}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            ({pct}%)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </AppleCard>
          </motion.div>
        </div>

        {/* ── 4. INCIDENT VOLUME TIME-SERIES (Area Curve with Apple Sliding Pill) ── */}
        <motion.div variants={itemVariants} className="relative z-10">
          <AppleCard className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <SectionHeader
                icon={TrendingUp}
                title="Incident Volume Over Time"
                description="Daily incident intake volume and rate of submissions"
                iconColor="#0071E3"
              />

              {/* Apple Sliding Pill Segmented Control */}
              <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl shrink-0 border border-slate-200/50 dark:border-white/5 self-start sm:self-auto">
                {(['7d', '30d', '3m'] as const).map((r) => {
                  const isActive = volumeRange === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setVolumeRange(r)}
                      className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-200 active:scale-[0.97] ${isActive
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="volumeRangePill"
                          className="absolute inset-0 bg-[#0071E3] rounded-lg shadow-sm"
                          transition={APPLE_SPRING}
                        />
                      )}
                      <span className="relative z-10">
                        {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'Last 3 Months'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {volumeChartData.length ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeChartData} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appleBlueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0071E3" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0} />
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
                      stroke="#0071E3"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#appleBlueGradient)"
                      dot={{ r: 3.5, fill: '#0071E3', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: '#0071E3', stroke: '#fff', strokeWidth: 2 }}
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
          </AppleCard>
        </motion.div>

        {/* ── 5. SOURCE CHANNELS BREAKDOWN ── */}
        <motion.div variants={itemVariants} className="relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Bot,
                label: 'Messenger Chatbot',
                count: stats.bot,
                desc: 'Direct citizen conversational submissions',
                bg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                gradient: 'from-blue-600 to-indigo-600',
              },
              {
                icon: Globe2,
                label: 'Social Media Scraper',
                count: stats.scraper,
                desc: 'AI-mined community social feeds and groups',
                bg: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/20',
                gradient: 'from-sky-500 to-blue-600',
              },
            ].map(({ icon: Icon, label, count, desc, bg, gradient }) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <AppleCard key={label} className="p-6 flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {label}
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                        {count}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {pct}% of total intake
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{desc}</p>
                    {/* Apple Smooth Progress Bar */}
                    <div className="mt-3.5 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full bg-linear-to-r ${gradient}`}
                      />
                    </div>
                  </div>
                </AppleCard>
              );
            })}
          </div>
        </motion.div>

        {/* ── 6. HIGH-RISK RANKINGS & AVERAGE RESPONSE TIME ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 relative z-10">
          {/* Average Response Time per Barangay */}
          <motion.div variants={itemVariants} className="xl:col-span-2">
            <AppleCard className="p-6 h-full flex flex-col justify-between">
              <div>
                <SectionHeader
                  icon={Clock3}
                  title="Response Time Benchmark"
                  description="Average verification latency per community"
                  iconColor="#0EA5E9"
                />
                <div className="space-y-2.5 mt-2">
                  {riskData.map((item) => {
                    const times = data
                      .filter((r) => r.barangay === item.barangay)
                      .map(responseMinutes)
                      .filter((v): v is number => v !== null);
                    const avg = times.length
                      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
                      : null;
                    return (
                      <div
                        key={item.barangay}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.barangay}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums shrink-0 ml-2">
                          {avg !== null ? `${avg} min` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-400 dark:text-slate-500">
                *Calculated from submission timestamp to field verification stamp.
              </div>
            </AppleCard>
          </motion.div>

          {/* High-Risk Priority Table */}
          <motion.div variants={itemVariants} className="xl:col-span-3">
            <AppleCard className="p-6 h-full flex flex-col">
              <SectionHeader
                icon={AlertTriangle}
                title="High-Risk Barangays"
                description="Priority ranking determined by cumulative volume & urgency score"
                iconColor="#DC2626"
              />
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-125">
                  <thead>
                    <tr className="border-b border-slate-200/60 dark:border-slate-800/80">
                      {['Barangay', 'Reports', 'High Urgency', 'Priority', 'Dominant Need'].map((h, i) => (
                        <th
                          key={h}
                          className={`${i === 0 || i === 4 ? 'text-left' : 'text-center'
                            } py-3 px-2 text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {riskData.map((item) => (
                      <tr
                        key={item.barangay}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors duration-150"
                      >
                        <td className="py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.barangay}
                        </td>
                        <td className="py-3 px-2 text-center text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                          {item.incidents}
                        </td>
                        <td className="py-3 px-2 text-center text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {item.high}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${URGENCY_CLASS[item.priority]
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${item.priority === 'High'
                                ? 'bg-rose-500'
                                : item.priority === 'Moderate'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                                }`}
                            />
                            {item.priority}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {item.dominantType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppleCard>
          </motion.div>
        </div>

        {/* ── 7. PRESCRIPTIVE RECOMMENDATIONS ── */}
        <motion.div variants={itemVariants} className="relative z-10">
          <AppleCard className="p-6">
            <SectionHeader
              icon={Lightbulb}
              title="Prescriptive Action Recommendations"
              description="Automated resource pre-positioning intelligence based on real-time incident density"
              iconColor="#F59E0B"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {recommendations.map((item) => (
                <div
                  key={item.barangay}
                  className="rounded-2xl border border-slate-200/70 dark:border-white/10 p-5 bg-white/40 dark:bg-slate-850/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.barangay}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${URGENCY_CLASS[item.priority]
                          }`}
                      >
                        {item.priority} Urgency
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.text}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      Dominant: {item.dominantType}
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {item.incidents} events
                    </span>
                  </div>
                </div>
              ))}
              {!recommendations.length && (
                <div className="lg:col-span-3 text-center py-10 text-xs text-slate-400">
                  Prescriptive dispatch recommendations will populate dynamically as reports are verified.
                </div>
              )}
            </div>
          </AppleCard>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
}