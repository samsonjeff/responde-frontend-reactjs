import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  LayoutDashboard, AlertTriangle, Brain,
  ArrowRight, X,
  MapPin, Clock, BarChart3, ListFilter, CheckCircle2, ShieldCheck, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import { formatReportCode, getTypeHexColor } from '../services/incidentService';
import PageLoader from '../components/PageLoader';
import AnimatedNumber from '../components/AnimatedNumber';
import { StaggerContainer, StaggerItem } from '../components/Stagger';

const APPLE_SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.8 } as const;

function formatDashboardTime(timeStr?: string, createdAt?: string): string {
  if (createdAt) {
    try {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
      }
    } catch {}
  }
  return timeStr || '—';
}


const risenChartKeys = new Set<string>();

function MinimalWaveBar(props: any) {
  const { x, y, width, height, payload, selectedType, routeKey = 'default' } = props;
  if (x == null || y == null || width == null || height == null || height <= 0 || !payload) {
    return null;
  }

  const entryName: string = payload.name || payload.type || 'General';
  const color = payload.color || getTypeHexColor(entryName);
  const isDimmed = selectedType && selectedType.toLowerCase() !== entryName.toLowerCase();

  const w = Math.max(width, 8);
  const h = Math.max(height, 4);
  const r = Math.min(5, w / 2, h / 2);
  const bottomY = y + h;

  // Fluid water wave amplitude (clearly visible liquid motion, gracefully restrained)
  const amp = Math.min(3.8, Math.max(1.8, Math.min(h * 0.1, w * 0.11)));
  const waveY = y + amp + 1;

  const clipId = `minimal-bar-clip-${entryName.replace(/[^a-zA-Z0-9]/g, '')}`;
  const shouldRise = !risenChartKeys.has(routeKey);

  // Rounded-top rectangle path matching the original minimalist 2D bar
  const clipRectPath = `
    M ${x},${bottomY}
    L ${x},${y + r}
    Q ${x},${y} ${x + r},${y}
    L ${x + w - r},${y}
    Q ${x + w},${y} ${x + w},${y + r}
    L ${x + w},${bottomY}
    Z
  `;

  // Two-cycle seamless sine wave along the top edge (width = 2 * w so translating by -w loops with 0 jump)
  const buildWavePath = (yLine: number, waveAmp: number) => `
    M ${x},${yLine}
    Q ${x + w * 0.25},${yLine - waveAmp} ${x + w * 0.5},${yLine}
    T ${x + w},${yLine}
    Q ${x + w * 1.25},${yLine - waveAmp} ${x + w * 1.5},${yLine}
    T ${x + w * 2},${yLine}
    L ${x + w * 2},${bottomY + 2}
    L ${x},${bottomY + 2}
    Z
  `;

  return (
    <g
      className="minimal-2d-bar-group"
      style={
        {
          opacity: isDimmed ? 0.35 : 1,
          '--bar-hover-shadow': `${color}55`,
        } as React.CSSProperties
      }
    >
      <defs>
        <clipPath id={clipId}>
          <path d={clipRectPath} />
        </clipPath>
      </defs>

      <g
        clipPath={`url(#${clipId})`}
        className={shouldRise ? 'minimal-2d-bar-riser' : undefined}
        onAnimationEnd={(e) => {
          risenChartKeys.add(routeKey);
          e.currentTarget.classList.remove('minimal-2d-bar-riser');
        }}
      >
        {/* Secondary counter-flowing water wave (creates clear visual depth and fluid undulation) */}
        <path d={buildWavePath(waveY - amp * 0.4, amp * 0.85)} fill={color} fillOpacity={0.42}>
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${-w} 0`}
            to="0 0"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </path>

        {/* Primary flowing wave surface */}
        <path d={buildWavePath(waveY, amp)} fill={color} fillOpacity={1}>
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to={`${-w} 0`}
            dur="2.4s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </g>
  );
}

interface TooltipPayloadItem {
  name: string;
  count: number;
  percentage: number;
  high: number;
  mod: number;
  low: number;
  topBrgy: string;
  color: string;
}

interface TypeTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayloadItem }>;
}

function TypeTooltip({ active, payload }: TypeTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="backdrop-blur-xl bg-white/95 dark:bg-[#111827]/95 border border-slate-200/80 dark:border-white/15 px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1.5 z-50">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</span>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">{item.percentage}%</span>
      </div>
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Total reports:</span>
          <span className="font-bold text-slate-900 dark:text-white tabular-nums">{item.count}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">Urgency:</span>
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
            <span className="text-rose-500">{item.high} High</span> · <span className="text-amber-500">{item.mod} Mod</span> · <span className="text-[#22c55e] dark:text-green-400">{item.low} Low</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const { reports, loading: reportsLoading } = useReports();
  const [filterUrgency, setFilterUrgency] = useState<'All' | 'Critical' | 'High' | 'Mod' | 'Low'>('All');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'bars'>('chart');

  const userGreeting = useMemo(() => {
    const fullName = user?.full_name?.trim();
    if (fullName) {
      const firstName = fullName.split(/\s+/)[0];
      return `Hello, ${firstName}`;
    }
    const username = user?.username?.trim();
    if (username) {
      return `Hello, ${username}`;
    }
    return 'Welcome back';
  }, [user]);

  useEffect(() => {
    if (reports.length > 0 && !risenChartKeys.has(location.key)) {
      const timer = setTimeout(() => {
        risenChartKeys.add(location.key);
      }, 1250);
      return () => clearTimeout(timer);
    }
  }, [reports.length, location.key]);

  // ── Stat metrics derived directly from reports (0 extra network calls) ──
  const totalIncidents = reports.length;

  const underReviewCount = useMemo(() => {
    return reports.filter((r) => {
      const s = (r.status || '').toLowerCase();
      return s === 'under_review' || s === 'pending';
    }).length;
  }, [reports]);

  const verifiedCount = useMemo(() => {
    return reports.filter((r) => (r.status || '').toLowerCase() === 'verified').length;
  }, [reports]);

  const highUrgencyCount = useMemo(() => {
    return reports.filter((r) => {
      const u = (r.urgency || '').toLowerCase();
      return u === 'high' || u === 'critical';
    }).length;
  }, [reports]);

  // Reports by Type Breakdown with Detailed Metrics
  const typeSummary = useMemo(() => {
    if (reports.length === 0) return [];
    const counts: Record<string, { count: number; critical: number; high: number; mod: number; low: number; brgys: Record<string, number> }> = {};

    reports.forEach((r) => {
      const raw = (r.type || 'General').trim();
      const norm =
        !raw || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'unclassified'
          ? 'General'
          : raw;

      if (!counts[norm]) {
        counts[norm] = { count: 0, critical: 0, high: 0, mod: 0, low: 0, brgys: {} };
      }
      counts[norm].count += 1;
      const u = (r.urgency || '').toLowerCase();
      if (u === 'critical') counts[norm].critical += 1;
      else if (u === 'high') counts[norm].high += 1;
      else if (u === 'moderate' || u === 'mod') counts[norm].mod += 1;
      else counts[norm].low += 1;

      const brgy = r.barangay || 'Unknown';
      counts[norm].brgys[brgy] = (counts[norm].brgys[brgy] || 0) + 1;
    });

    const total = reports.length;
    return Object.entries(counts)
      .map(([type, data]) => {
        const topBrgy = Object.entries(data.brgys).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
        return {
          name: type,
          type,
          count: data.count,
          percentage: Math.round((data.count / total) * 100),
          high: data.high,
          mod: data.mod,
          low: data.low,
          topBrgy,
          color: getTypeHexColor(type),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [reports]);


  // Selected Incident Type Details for Interactive Inspection
  const selectedTypeDetails = useMemo(() => {
    if (!selectedType) return null;
    const matching = reports.filter((r) => {
      const raw = (r.type || 'General').trim();
      const norm = !raw || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'unclassified' ? 'General' : raw;
      return norm.toLowerCase() === selectedType.toLowerCase();
    });

    const total = matching.length;
    const critical = matching.filter((r) => (r.urgency || '').toLowerCase() === 'critical').length;
    const high = matching.filter((r) => (r.urgency || '').toLowerCase() === 'high').length;
    const mod = matching.filter((r) => {
      const u = (r.urgency || '').toLowerCase();
      return u === 'moderate' || u === 'mod';
    }).length;
    const low = matching.filter((r) => (r.urgency || '').toLowerCase() === 'low').length;

    const verified = matching.filter((r) => r.status === 'verified').length;
    const underReview = matching.filter((r) => r.status === 'under_review' || r.status === 'pending').length;
    const resolved = matching.filter((r) => r.status === 'resolved').length;

    // Top barangay
    const brgyCounts: Record<string, number> = {};
    matching.forEach((r) => {
      const b = r.barangay || 'Unknown';
      brgyCounts[b] = (brgyCounts[b] || 0) + 1;
    });
    const topBarangay = Object.entries(brgyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // Latest report time
    const sortedTime = [...matching].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const latestReport = sortedTime[0];

    return {
      type: selectedType,
      total,
      percentage: reports.length ? Math.round((total / reports.length) * 100) : 0,
      critical,
      high,
      mod,
      low,
      verified,
      underReview,
      resolved,
      topBarangay,
      latestTime: latestReport ? formatDashboardTime(latestReport.time, latestReport.createdAt) : '—',
      color: getTypeHexColor(selectedType),
    };
  }, [reports, selectedType]);

  // Filtered Latest Reports for Table
  const displayReports = useMemo(() => {
    let list = [...reports];
    list.sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });

    if (filterUrgency === 'Critical') {
      list = list.filter((r) => (r.urgency || '').toLowerCase() === 'critical');
    } else if (filterUrgency === 'High') {
      list = list.filter((r) => (r.urgency || '').toLowerCase() === 'high');
    } else if (filterUrgency === 'Mod') {
      list = list.filter((r) => {
        const u = (r.urgency || '').toLowerCase();
        return u === 'moderate' || u === 'mod';
      });
    } else if (filterUrgency === 'Low') {
      list = list.filter((r) => (r.urgency || '').toLowerCase() === 'low');
    }

    if (selectedType) {
      list = list.filter((r) => {
        const raw = (r.type || 'General').trim();
        const norm = !raw || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'unclassified' ? 'General' : raw;
        return norm.toLowerCase() === selectedType.toLowerCase();
      });
    }

    return list.slice(0, 8);
  }, [reports, filterUrgency, selectedType]);

  const getUrgencyBadge = (urgency: string) => {
    switch ((urgency || '').toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0 animate-pulse" />
            <span>Critical</span>
          </span>
        );
      case 'high':
      case 'High':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>High</span>
          </span>
        );
      case 'moderate':
      case 'mod':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>Moderate</span>
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[82px] py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
            <span>Low</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'under_review':
      case 'pending':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span>Under Review</span>
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
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
        return (
          <span className="inline-flex items-center justify-center gap-1.5 w-[104px] py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>{status}</span>
          </span>
        );
    }
  };

  if (reportsLoading && reports.length === 0) {
    return <PageLoader variant="dashboard" />;
  }

  return (
    <div className="dashboard-soft flex flex-col flex-1 w-full lg:h-full lg:min-h-0 relative">
      <StaggerContainer className="flex flex-col flex-1 space-y-4 sm:space-y-5 w-full lg:h-full lg:min-h-0">
        {/* ── Top Header Bar (Matching IncidentReports, Analytics, Settings) ── */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-10.5 sm:h-10.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-2xs">
            <LayoutDashboard className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg sm:text-[22px] font-semibold tracking-[-0.025em] leading-tight text-slate-900 dark:text-white">
              {userGreeting}
            </h1>
            <p className="text-[11px] sm:text-xs font-normal tracking-[0.005em] text-slate-500/90 dark:text-slate-400/90 mt-0.5 leading-relaxed">
              Command center overview <span className="text-slate-300 dark:text-slate-600 mx-1">·</span> Real-time metrics &amp; incident triage
            </p>
          </div>
        </div>
          </div>
        </StaggerItem>

        {/* ── 1. Row 1: 4 Raised Stat Cards (Derived directly from reports) ── */}
        <StaggerItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 shrink-0">
        {/* Total Incidents */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-[transform,box-shadow,border-color,background-color] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:bg-white/95 dark:hover:bg-[#151e31]/95 hover:border-rose-500/35 dark:hover:border-rose-500/40 hover:shadow-[0_12px_28px_-6px_rgba(244,63,94,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(244,63,94,0.22)] min-w-0">
          <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.16)_0%,rgba(244,63,94,0.05)_45%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-gradient-to-r from-transparent via-rose-500/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]" />
          <div className="relative z-10 space-y-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-200 truncate">
              Total Incidents
            </p>
            <p className="text-lg sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              <AnimatedNumber key={`total-${location.key}`} value={totalIncidents} duration={2} />
            </p>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200 font-medium min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0 group-hover:shadow-[0_0_8px_rgba(244,63,94,0.85)] transition-shadow duration-200" />
              <span className="truncate">Active pipeline</span>
            </div>
          </div>
          <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-rose-500/10 group-hover:bg-rose-500/18 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:border-rose-500/35 shadow-[0_0_16px_rgba(244,63,94,0.15)] group-hover:shadow-[0_0_24px_rgba(244,63,94,0.3)] group-hover:scale-108 transition-[transform,background-color,border-color,box-shadow] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5 group-hover:scale-105" strokeWidth={1.75} />
          </div>
        </div>

        {/* Under Review */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-[transform,box-shadow,border-color,background-color] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:bg-white/95 dark:hover:bg-[#151e31]/95 hover:border-amber-500/35 dark:hover:border-amber-500/40 hover:shadow-[0_12px_28px_-6px_rgba(245,158,11,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(245,158,11,0.22)] min-w-0">
          <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.16)_0%,rgba(245,158,11,0.05)_45%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-gradient-to-r from-transparent via-amber-500/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]" />
          <div className="relative z-10 space-y-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-200 truncate">
              Under Review
            </p>
            <p className="text-lg sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              <AnimatedNumber key={`review-${location.key}`} value={underReviewCount} duration={2} />
            </p>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium min-w-0">
              {underReviewCount > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.85)] transition-shadow duration-200" />
                  <span className="text-amber-600 dark:text-amber-400 font-semibold truncate">
                    Needs triage
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 truncate">
                    All caught up
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/18 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:border-amber-500/35 shadow-[0_0_16px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_24px_rgba(245,158,11,0.3)] group-hover:scale-108 transition-[transform,background-color,border-color,box-shadow] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110" strokeWidth={1.75} />
          </div>
        </div>

        {/* Verified Incidents */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-[transform,box-shadow,border-color,background-color] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:bg-white/95 dark:hover:bg-[#151e31]/95 hover:border-emerald-500/35 dark:hover:border-emerald-500/40 hover:shadow-[0_12px_28px_-6px_rgba(16,185,129,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(16,185,129,0.22)] min-w-0">
          <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.16)_0%,rgba(16,185,129,0.05)_45%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]" />
          <div className="relative z-10 space-y-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-200 truncate">
              Verified Incidents
            </p>
            <p className="text-lg sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              <AnimatedNumber key={`verified-${location.key}`} value={verifiedCount} duration={2} />
            </p>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.85)] transition-shadow duration-200" />
              <span className="truncate">Confirmed on site</span>
            </div>
          </div>
          <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/18 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:border-emerald-500/35 shadow-[0_0_16px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_24px_rgba(16,185,129,0.3)] group-hover:scale-108 transition-[transform,background-color,border-color,box-shadow] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110" strokeWidth={1.75} />
          </div>
        </div>

        {/* High Urgency */}
        <div className="relative overflow-hidden bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-[transform,box-shadow,border-color,background-color] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:bg-white/95 dark:hover:bg-[#151e31]/95 hover:border-purple-500/35 dark:hover:border-purple-500/40 hover:shadow-[0_12px_28px_-6px_rgba(168,85,247,0.15),0_4px_12px_-2px_rgba(15,23,42,0.05)] dark:hover:shadow-[0_12px_30px_-6px_rgba(168,85,247,0.22)] min-w-0">
          <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.16)_0%,rgba(168,85,247,0.05)_45%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-gradient-to-r from-transparent via-purple-500/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]" />
          <div className="relative z-10 space-y-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-200 truncate">
              High Urgency
            </p>
            <p className="text-lg sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              <AnimatedNumber key={`high-${location.key}`} value={highUrgencyCount} duration={2} />
            </p>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-purple-600 dark:text-purple-400 font-medium min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 group-hover:shadow-[0_0_8px_rgba(168,85,247,0.85)] transition-shadow duration-200" />
              <span className="truncate">Critical priority</span>
            </div>
          </div>
          <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/18 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:border-purple-500/35 shadow-[0_0_16px_rgba(168,85,247,0.15)] group-hover:shadow-[0_0_24px_rgba(168,85,247,0.3)] group-hover:scale-108 transition-[transform,background-color,border-color,box-shadow] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center justify-center shrink-0">
            <Brain className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110" strokeWidth={1.75} />
          </div>
        </div>
          </div>
        </StaggerItem>

        {/* ── 2. Main 2-Column Section: Latest Reports Table (Left) & Reports by Type with Interactive Bar Chart (Right) ── */}
        <StaggerItem className="w-full flex flex-col flex-1 lg:min-h-0">
          <div className="grid grid-cols-12 gap-4 sm:gap-5 lg:gap-6 flex-1 lg:min-h-0 w-full items-stretch">
        {/* Left Column: Latest Reports Table (Col 8) */}
        <div className="order-2 md:order-1 col-span-12 lg:col-span-8 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden lg:h-full">
          {/* Header Row */}
          <div className="p-4 sm:p-5 border-b border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Latest reports
              </h2>
              {selectedType && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] dark:text-sky-400 border border-[#0071E3]/20">
                  <span>Type: {selectedType}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedType(null)}
                    className="hover:opacity-75 transition-opacity cursor-pointer p-0.5"
                    title="Clear type filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            {/* Segmented Urgency Filter: [All] [High] [Mod] [Low] */}
            <div className="inline-flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100/70 dark:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-1 px-2.5 py-1 text-[#0071E3] dark:text-sky-400 cursor-default select-none shrink-0">
                <Filter className="w-3.5 h-3.5 transition-transform duration-300 group-hover/filters:scale-110 text-[#0071E3] dark:text-sky-400" strokeWidth={1.8} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
              </div>
              <div className="inline-flex items-center gap-1">
                {(['All', 'Critical', 'High', 'Mod', 'Low'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFilterUrgency(opt)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none active:scale-[0.96] ${
                      filterUrgency === opt
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-white/10'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div
            className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
            style={{
              maskImage: 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)',
            }}
          >
            <table className="w-full min-w-[640px] text-sm text-left border-separate border-spacing-0">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-white/5 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Barangay</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Urgency</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Status</th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">Time</th>
                  <th className="px-3.5 py-3 w-28 min-w-[110px] text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 text-left whitespace-nowrap sticky top-0 right-0 z-40 bg-slate-50 dark:bg-slate-800 border-b border-slate-200/60 dark:border-white/5 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.07)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.35)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {displayReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No reports found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  displayReports.map((report) => {
                    const isTypeMatch = selectedType && report.type?.toLowerCase() === selectedType.toLowerCase();
                    return (
                      <tr
                        key={report.id}
                        onClick={() => {
                          const rType = report.type || 'General';
                          setSelectedType((prev) => (prev === rType ? null : rType));
                        }}
                        className={`transition-colors duration-150 group cursor-pointer ${
                          isTypeMatch
                            ? 'bg-blue-50/60 dark:bg-blue-900/20'
                            : 'hover:bg-blue-50/30 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 group-hover:border-blue-300/60 dark:group-hover:border-blue-600/40 group-hover:bg-white dark:group-hover:bg-slate-750 transition-all duration-150 truncate inline-block shadow-2xs"
                            title={`ID: ${report.id}`}
                          >
                            {formatReportCode(report.id, report.source)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm group-hover:text-[#0071E3] group-active:text-[#0071E3] dark:group-hover:text-sky-400 dark:group-active:text-sky-400 transition-colors duration-150">
                          {report.barangay || 'Unknown'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getUrgencyBadge(report.urgency)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getStatusBadge(report.status)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {formatDashboardTime(report.time, report.createdAt)}
                        </td>
                        <td className="px-3.5 py-3.5 w-28 min-w-[110px] text-left whitespace-nowrap sticky right-0 z-10 bg-white dark:bg-[#111827] group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-white/5 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.07)] dark:shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.35)]" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/incident-reports?focus=${report.id}`)}
                            className="group/btn px-3.5 py-1.5 text-xs font-bold text-[#0071E3] dark:text-sky-300 bg-[#0071E3]/18 hover:bg-[#0071E3]/28 active:bg-[#0071E3]/38 dark:bg-[#0071E3]/25 dark:hover:bg-[#0071E3]/38 border border-[#0071E3]/45 hover:border-[#0071E3]/75 dark:border-sky-400/40 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] shadow-[0_2px_10px_rgba(0,113,227,0.22)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.35)] backdrop-blur-sm cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" strokeWidth={1.75} />
                            <span>Review</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {displayReports.length > 0 && (
                  <tr aria-hidden="true" className="h-4 pointer-events-none border-none">
                    <td colSpan={6} className="p-0 border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with View All Link */}
          <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <span>
              Showing {displayReports.length} of {reports.length} reports
            </span>
            <button
              type="button"
              onClick={() => navigate('/incident-reports')}
              className="group/all inline-flex items-center gap-1.5 px-2.5 py-1 -mr-2 rounded-lg font-semibold text-[#0071E3] hover:text-[#0077ED] dark:text-sky-400 dark:hover:text-sky-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 transition-all duration-150 cursor-pointer"
            >
              <span>View all incident reports</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/all:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Right Column: Reports by Type with Interactive Bar Chart (Col 4) */}
        <div className="order-1 md:order-2 col-span-12 lg:col-span-4 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-4 sm:p-5 flex flex-col lg:h-full justify-between">
          {/* Header Row with View Mode Switcher and Clear Filter Pill */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/70 dark:border-white/10 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Reports by type
              </h2>
              {selectedType && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0071E3]/10 text-[#0071E3] dark:text-sky-400 border border-[#0071E3]/20 text-xs font-semibold shrink-0">
                  <span className="truncate max-w-[90px]">{selectedType}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedType(null)}
                    className="hover:opacity-75 transition-opacity cursor-pointer p-0.5"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Chart vs List view mode toggle */}
              <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/60 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setViewMode('chart')}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'chart'
                      ? 'bg-white dark:bg-slate-700 text-[#0071E3] dark:text-sky-400 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="Bar chart view"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('bars')}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    viewMode === 'bars'
                      ? 'bg-white dark:bg-slate-700 text-[#0071E3] dark:text-sky-400 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="Progress bars view"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                <AnimatedNumber key={`type-total-${location.key}`} value={reports.length} duration={2} /> total
              </span>
            </div>
          </div>

          {/* Interactive Chart or Progress Bars */}
          {typeSummary.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-12 text-center">
              No incident types reported yet.
            </p>
          ) : viewMode === 'chart' ? (
            /* ── Recharts Bar Chart (Same functionality as Analytics page) ── */
            <div className="w-full flex flex-col pt-2">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Click any bar to highlight incident and inspect details
              </p>
              <div className="w-full h-48 sm:h-52 min-h-[190px] relative mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={typeSummary}
                    margin={{ top: 12, right: 12, left: 8, bottom: 30 }}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clickedType = state.activePayload[0].payload.name;
                        setSelectedType((prev) => (prev === clickedType ? null : clickedType));
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
                      angle={-25}
                      textAnchor="end"
                      height={36}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9.5, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <Tooltip content={<TypeTooltip />} cursor={{ fill: 'rgba(0,113,227,0.06)' }} />
                    <Bar
                      dataKey="count"
                      cursor="pointer"
                      isAnimationActive={false}
                      shape={<MinimalWaveBar selectedType={selectedType} routeKey={location.key} />}
                    >
                      {typeSummary.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            /* ── Progress Bars List View (Minimalist 2D) ── */
            <div className="mt-4 space-y-3">
              {typeSummary.map((item, index) => {
                const isSelected = selectedType && selectedType.toLowerCase() === item.type.toLowerCase();
                return (
                  <button
                    key={`${item.type}-${location.key}`}
                    type="button"
                    onClick={() => setSelectedType((prev) => (prev === item.type ? null : item.type))}
                    className={`group w-full text-left p-2.5 rounded-xl transition-all duration-200 cursor-pointer border hover:-translate-y-0.5 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-500/30 shadow-2xs'
                        : 'border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.type}
                      </span>
                      <span className="font-bold text-slate-600 dark:text-slate-400 tabular-nums text-xs">
                        <AnimatedNumber key={`pct-${item.type}-${location.key}`} value={item.percentage} duration={2} />% (
                        <AnimatedNumber key={`cnt-${item.type}-${location.key}`} value={item.count} duration={2} />)
                      </span>
                    </div>

                    {/* Clean Minimalist 2D Horizontal Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(item.percentage, 3)}%` }}
                        transition={{
                          duration: 0.95,
                          delay: Math.min(index * 0.04, 0.28),
                          ease: [0.25, 1, 0.5, 1],
                        }}
                        className="h-full rounded-full transition-[filter] duration-200 group-hover:brightness-110"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Highlighted Incident Information Panel ── */}
          <AnimatePresence mode="wait">
            {selectedTypeDetails ? (
              <motion.div
                key={selectedTypeDetails.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={APPLE_SPRING}
                className="mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/70 dark:border-white/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedTypeDetails.color }}
                    />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {selectedTypeDetails.type} Overview
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0071E3] dark:text-sky-400 tabular-nums">
                    {selectedTypeDetails.total} incident{selectedTypeDetails.total > 1 ? 's' : ''} ({selectedTypeDetails.percentage}%)
                  </span>
                </div>

                {/* Urgency & Status Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                      Urgency Levels
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-medium">
                      {selectedTypeDetails.critical > 0 && (
                        <>
                          <span className="text-rose-700 dark:text-rose-400 font-bold">{selectedTypeDetails.critical} Crit</span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                        </>
                      )}
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">{selectedTypeDetails.high} High</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-amber-600 dark:text-amber-400">{selectedTypeDetails.mod} Mod</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-green-600 dark:text-green-400">{selectedTypeDetails.low} Low</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                      Status Flow
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-medium">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{selectedTypeDetails.underReview} Review</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{selectedTypeDetails.verified} Ver</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-blue-600 dark:text-blue-400">{selectedTypeDetails.resolved} Res</span>
                    </div>
                  </div>
                </div>

                {/* Location and Latest Timestamp */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-white/5">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]" title={`Top location: ${selectedTypeDetails.topBarangay}`}>
                    <MapPin className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
                    <span className="truncate">Top: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedTypeDetails.topBarangay}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="tabular-nums font-mono text-[11px]">{selectedTypeDetails.latestTime}</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span>Select an incident type to inspect distribution</span>
                <span className="font-medium text-slate-500 dark:text-slate-400">{typeSummary.length} categories</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
