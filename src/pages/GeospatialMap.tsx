import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  X,
  Navigation,
  RotateCcw,
  Siren,
  HeartPulse,
  Droplets,
  HardHat,
  ShieldCheck,
  FileText,
  User,
  Phone,
  Clock,
  Layers,
  Map,
  MapPin,
  AlertTriangle,
  ChevronRight,
  Bot,
  Globe,
  MessageSquare,
  Compass,
  MapPinOff,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Box,
} from 'lucide-react';

import { useTheme } from '../components/ThemeContent';
import FilterDropdown from '../components/DropDown';
import MapContainer from '../components/MapContainer';
import { useReports } from '../context/ReportsContext';
import PageLoader from '../components/PageLoader';
import { StaggerContainer, StaggerItem } from '../components/Stagger';
import type { MapLayerState, SelectedFeature } from '../types/geospatial';
import { isReportIncomplete, getIncompleteReasons, formatReportCode, type Report } from '../services/incidentService';
import { talisayBarangays, getBarangayMeta, normalizeBarangayName, clampPointToBarangay } from '../data/talisay-barangays';
import { MDRRMO_TALISAY_COORDS, getActiveBarangaysFromReports, type ActiveBarangayTarget } from '../lib/dispatch-arcs';
import mdrrmoLogoUrl from '../assets/mdrrmo-talisay-logo.png';

const INITIAL_LAYERS: MapLayerState = {
  choropleth: true,
  pins: true,
  boundaries: true,
  dispatchArcs: true,
};

// ── Soft UI Evolution / Emil Kowalski Spring & Panel Transitions ──
const SOFT_SPRING = { type: 'spring', stiffness: 240, damping: 26, mass: 0.9 } as const;
const PANEL_TRANSITION = { duration: 0.38, ease: [0.16, 1, 0.3, 1] } as const;

// Standard Line Icons for Incident Types
const TYPE_ICONS: Record<string, React.ReactNode> = {
  'Search & Rescue': <Siren className="w-4 h-4 stroke-[1.75]" />,
  'Medical': <HeartPulse className="w-4 h-4 stroke-[1.75]" />,
  'Food & Water': <Droplets className="w-4 h-4 stroke-[1.75]" />,
  'Infrastructure': <HardHat className="w-4 h-4 stroke-[1.75]" />,
};

// Calm, non-glaring pastel tones
const CATEGORY_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  'Search & Rescue': {
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/20',
  },
  'Medical': {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/20',
  },
  'Food & Water': {
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    border: 'border-sky-500/20',
  },
  'Infrastructure': {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/20',
  },
};

// Semantic Micro-Dot Urgency Badges (Calm, non-glaring)
const URGENCY_BADGES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'High': {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-900/40',
    dot: 'bg-rose-500',
  },
  'Moderate': {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-900/40',
    dot: 'bg-amber-500',
  },
  'Low': {
    bg: 'bg-green-500/15 dark:bg-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-500/30 dark:border-green-500/30',
    dot: 'bg-[#22c55e]',
  },
};

// Parse "lat, lng" or "lng, lat" → [lng, lat] for MapLibre
function parseCoords(coords: string): [number, number] | null {
  if (!coords || typeof coords !== 'string') return null;
  const parts = coords.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    let lat: number;
    let lng: number;
    if (parts[0] > 50) {
      lng = parts[0];
      lat = parts[1];
    } else {
      lat = parts[0];
      lng = parts[1];
    }
    return [lng, lat];
  }
  return null;
}

// ── Soft Card Shell Component ──
function SoftPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative backdrop-blur-2xl bg-white/90 dark:bg-[#111827]/90 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-t-white/90 dark:border-t-white/15 transition-all ${className}`}
    >
      {children}
    </div>
  );
}

// ── Sub-components ──

function IncidentListItem({ report, index, onClick }: { report: Report; index: number; onClick: () => void }) {
  const badge = URGENCY_BADGES[report.urgency] || URGENCY_BADGES['Low'];
  const formattedCode = formatReportCode(report.id, report.source);
  const catStyle = CATEGORY_STYLES[report.type] || {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-blue-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SOFT_SPRING, delay: Math.min(index * 0.03, 0.25) }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 bg-white/95 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.18)] dark:hover:shadow-[0_12px_32px_rgba(0,113,227,0.30)] hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-[0.98] text-left space-y-3"
    >
      {/* Top row: Category icon, Barangay title, Urgency pill */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}>
            {TYPE_ICONS[report.type] || <Siren className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0071E3] dark:group-hover:text-sky-400 truncate tracking-tight flex items-center gap-1.5 transition-colors">
              <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="truncate">{report.barangay}</span>
            </h4>
            <span className={`text-[10px] font-semibold tracking-tight uppercase ${catStyle.text}`}>
              {report.type}
            </span>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${report.urgency === 'High' ? 'animate-pulse' : ''}`} />
          {report.urgency}
        </span>
      </div>

      {/* Quoted description snippet in soft well */}
      {report.description && (
        <div className="rounded-xl p-2.5 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/5 pl-3 border-l-2 border-l-blue-500/40">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 italic leading-relaxed">
            &ldquo;{report.description}&rdquo;
          </p>
        </div>
      )}

      {/* Bottom metadata row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-white/5 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 shrink-0"
            title={`Source ID: ${report.id}`}
          >
            {formattedCode}
          </span>
          <span className="text-slate-500 dark:text-slate-400 truncate font-medium text-xs">{report.reporter}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums font-mono flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {report.time}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
            <Compass className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function BarangayDetailCard({ name, reports, onClose, onViewList }: {
  name: string;
  reports: Report[];
  onClose: () => void;
  onViewList: () => void;
}) {
  const meta = useMemo(() => getBarangayMeta(name), [name]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => { counts[r.type] = (counts[r.type] || 0) + 1; });
    return counts;
  }, [reports]);

  const urgencyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => { counts[r.urgency] = (counts[r.urgency] || 0) + 1; });
    return counts;
  }, [reports]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 14 }}
      transition={SOFT_SPRING}
      className="absolute z-50 flex flex-col overflow-hidden rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.65)] border border-slate-200/80 dark:border-white/10 border-t-white/90 dark:border-t-white/20 transform-gpu will-change-transform bottom-2 left-2 right-2 max-h-[calc(100%-1rem)] sm:bottom-auto sm:top-3 sm:right-3 sm:left-auto sm:w-[360px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100%-1.5rem)]"
    >
      {/* Mobile sheet grab handle */}
      <div className="w-10 h-1 rounded-full bg-slate-300/80 dark:bg-slate-600/80 mx-auto mt-2 -mb-1 sm:hidden shrink-0" />

      {/* Pinned Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8.5 h-8.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">{name}</h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Barangay Profile</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90 cursor-pointer shrink-0"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {/* Bento Top Metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Reports</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{reports.length}</p>
          </div>
          <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Land Area</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {meta ? `${meta.area_km2}` : '—'} <span className="text-xs font-normal text-slate-400">km²</span>
            </p>
          </div>
        </div>

        {meta && (
          <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-2.5 border border-slate-200/50 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">PSGC Code</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{meta.psgc}</span>
          </div>
        )}

        {/* Urgency 3-Column Bento Grid */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Urgency Breakdown</p>
          <div className="grid grid-cols-3 gap-2">
            {(['High', 'Moderate', 'Low'] as const).map((level) => {
              const b = URGENCY_BADGES[level];
              const count = urgencyCounts[level] || 0;
              return (
                <div key={level} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-semibold mb-1 text-slate-500 dark:text-slate-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                    <span>{level}</span>
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown with Soft Visual Progress Bars */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">By Emergency Category</p>
          <div className="space-y-2">
            {Object.entries(typeCounts).map(([type, count]) => {
              const pct = reports.length > 0 ? Math.round((count / reports.length) * 100) : 0;
              return (
                <div key={type} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">{TYPE_ICONS[type] || <Siren className="w-3.5 h-3.5" />}</span>
                      <span>{type}</span>
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="font-bold text-slate-900 dark:text-white">{count}</span>
                      <span className="text-slate-400 text-[10px]">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-slate-200/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Incidents in Barangay list */}
        {reports.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Incidents in Barangay</p>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
              {reports.map((r) => {
                const b = URGENCY_BADGES[r.urgency] || URGENCY_BADGES['Low'];
                return (
                  <div key={r.id} className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.dot}`} />
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">{formatReportCode(r.id, r.source)}</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium truncate">{r.type}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${b.bg} ${b.text} ${b.border} shrink-0`}>
                      {r.urgency}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pinned Action Footer */}
      <div className="shrink-0 p-3.5 border-t border-slate-200/60 dark:border-white/10 bg-slate-50/90 dark:bg-[#111827]/90 backdrop-blur-md">
        <button
          type="button"
          onClick={onViewList}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,113,227,0.25)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.4)] hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" /> View in Incident Reports
        </button>
      </div>
    </motion.div>
  );
}

function IncidentDetailCard({
  report,
  onClose,
  onResolve,
  onRemove,
  onViewInReports,
}: {
  report: Report;
  onClose: () => void;
  onResolve: (report: Report) => void;
  onRemove: (report: Report) => void;
  onViewInReports: () => void;
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const badge = URGENCY_BADGES[report.urgency] || URGENCY_BADGES['Low'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 14 }}
      transition={SOFT_SPRING}
      className="absolute z-50 flex flex-col overflow-hidden rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.65)] border border-slate-200/80 dark:border-white/10 border-t-white/90 dark:border-t-white/20 transform-gpu will-change-transform bottom-2 left-2 right-2 max-h-[calc(100%-1rem)] sm:bottom-auto sm:top-3 sm:right-3 sm:left-auto sm:w-[360px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100%-1.5rem)]"
    >
      {/* Mobile sheet grab handle */}
      <div className="w-10 h-1 rounded-full bg-slate-300/80 dark:bg-slate-600/80 mx-auto mt-2 -mb-1 sm:hidden shrink-0" />

      {/* Pinned Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8.5 h-8.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
            {TYPE_ICONS[report.type] || <Siren className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">{report.type}</h3>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block truncate" title={`Original ID: ${report.id}`}>
              ID: {formatReportCode(report.id, report.source)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {report.urgency}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">{report.barangay}</span>
          </p>
          <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 pl-5 truncate">{report.coordinates}</p>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-3.5 border border-slate-200/50 dark:border-white/5 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Citizen Report</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic break-words">&ldquo;{report.description}&rdquo;</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            — {report.reporter}, <span className="tabular-nums">{report.time}</span>
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-medium">{report.reporter}</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono truncate">{report.contact}</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="tabular-nums">{report.time}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
              {report.status === 'verified'
                ? '✓ Verified by Officer'
                : report.status === 'under_review'
                ? 'Under Review'
                : report.status === 'pending'
                ? 'Pending'
                : report.status === 'resolved'
                ? 'Resolved'
                : report.status}
            </span>
          </div>
        </div>
      </div>

      {/* Pinned Action Footer */}
      <div className="shrink-0 p-3.5 border-t border-slate-200/60 dark:border-white/10 bg-slate-50/90 dark:bg-[#111827]/90 backdrop-blur-md space-y-2">
        {report.status !== 'resolved' ? (
          <button
            type="button"
            onClick={() => onResolve(report)}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(16,185,129,0.25)] active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" /> Mark as Resolved
          </button>
        ) : (
          <div className="py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Incident is Resolved</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowRemoveConfirm(true)}
            className="py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>

          <button
            type="button"
            onClick={onViewInReports}
            className="py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 hover:text-[#0071E3] dark:hover:text-sky-300 border border-slate-200/60 dark:border-white/5 hover:border-blue-400/40 dark:hover:border-blue-500/40 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer hover:shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" /> In Reports
          </button>
        </div>

        {/* Remove Confirmation Drawer */}
        <AnimatePresence>
          {showRemoveConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-500/30 text-left space-y-2 mt-2"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200">Remove from Map?</h5>
                  <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 leading-relaxed mt-0.5">
                    This incident will be moved to the Rejected queue in Incident Reports. You can restore it anytime.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    onRemove(report);
                  }}
                  className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-all active:scale-[0.97] cursor-pointer"
                >
                  Confirm Remove
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function IncompleteListItem({
  report,
  index,
  onReview,
  onRemove,
}: {
  report: Report;
  index: number;
  onReview: () => void;
  onRemove?: () => void;
}) {
  const reasons = getIncompleteReasons(report);
  const formattedCode = formatReportCode(report.id, report.source);
  const initials = (report.reporter || 'U').trim().slice(0, 2).toUpperCase();
  const isBot = report.source === 'Bot';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SOFT_SPRING, delay: Math.min(index * 0.03, 0.25) }}
      className="group relative overflow-hidden rounded-2xl p-4 bg-white/95 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(0,113,227,0.16)] dark:hover:shadow-[0_12px_32px_rgba(0,113,227,0.28)] hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/25 hover:-translate-y-0.5 transition-all duration-200 text-left space-y-3"
    >
      {/* Subtle top indicator bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 opacity-80" />

      {/* Top Header Row: Avatar + Reporter + Ticket Badge */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center text-xs font-bold shadow-2xs ${
              isBot
                ? 'bg-blue-600 text-white'
                : 'bg-sky-600 text-white'
            }`}>
              {initials}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 text-[8px] ${
              isBot ? 'bg-blue-600 text-white' : 'bg-sky-600 text-white'
            }`}>
              {isBot ? <Bot className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
            </div>
          </div>

          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate tracking-tight">
              {report.reporter || 'Anonymous Citizen'}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
              <Clock className="w-2.5 h-2.5" />
              <span>{report.time}</span>
            </div>
          </div>
        </div>

        {/* Formatted Ticket Badge */}
        <div className="flex flex-col items-end shrink-0">
          <span
            className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs"
            title={`Source ID: ${report.id}`}
          >
            {formattedCode}
          </span>
          <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
            {report.source || 'Report'}
          </span>
        </div>
      </div>

      {/* Diagnostics / Missing Reason Pills */}
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((reason) => {
          const isUnknownBarangay = reason.toLowerCase().includes('barangay');
          return (
            <span
              key={reason}
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border shadow-2xs ${
                isUnknownBarangay
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
              }`}
            >
              {isUnknownBarangay ? (
                <MapPinOff className="w-3 h-3 text-rose-500 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
              )}
              <span>{reason}</span>
            </span>
          );
        })}
      </div>

      {/* Quoted Dispatch Message Transcript Bubble */}
      {report.description && (
        <div className="relative rounded-xl p-3 bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-2.5 h-2.5 text-blue-500" />
            <span>Citizen Report Transcript</span>
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-200 italic font-normal leading-relaxed line-clamp-3">
            &ldquo;{report.description}&rdquo;
          </p>
          {report.contact && report.contact !== 'N/A' && (
            <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              <Phone className="w-2.5 h-2.5 text-slate-400" />
              <span>{report.contact}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReview}
          className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-[0_2px_10px_rgba(37,99,235,0.25)] transition-all duration-150 flex items-center justify-between group active:scale-[0.98] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Assign & Review</span>
          </span>
          <ChevronRight className="w-4 h-4 opacity-80 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
        </button>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center justify-center shrink-0 active:scale-[0.98] cursor-pointer"
            title="Reject / Remove from Queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function IncidentSidebarContent({
  count,
  drawerReports,
  incompleteReports,
  activeSidebarTab,
  onTabChange,
  onClose,
  onFlyToReport,
  onRemoveReport,
  onReviewInReports,
}: {
  count: number;
  drawerReports: Report[];
  incompleteReports: Report[];
  activeSidebarTab: 'plotted' | 'incomplete';
  onTabChange: (tab: 'plotted' | 'incomplete') => void;
  onClose: () => void;
  onFlyToReport: (report: Report) => void;
  onRemoveReport?: (report: Report) => void;
  onReviewInReports: (report: Report) => void;
}) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'Bot' | 'Scraper'>('all');

  // Breakdown metrics for incomplete queue
  const incompleteStats = useMemo(() => {
    let missingBarangay = 0;
    let missingCategory = 0;
    incompleteReports.forEach((r) => {
      const reasons = getIncompleteReasons(r);
      if (reasons.some((x) => x.toLowerCase().includes('barangay'))) missingBarangay++;
      if (reasons.some((x) => x.toLowerCase().includes('scope') || x.toLowerCase().includes('category') || x.toLowerCase().includes('type'))) missingCategory++;
    });
    return { missingBarangay, missingCategory };
  }, [incompleteReports]);

  // Filter plotted reports
  const filteredPlotted = useMemo(() => {
    let list = drawerReports;
    if (sourceFilter !== 'all') {
      list = list.filter((r) => r.source === sourceFilter);
    }
    return list;
  }, [drawerReports, sourceFilter]);

  // Filter incomplete reports
  const filteredIncomplete = useMemo(() => {
    let list = incompleteReports;
    if (sourceFilter !== 'all') {
      list = list.filter((r) => r.source === sourceFilter);
    }
    return list;
  }, [incompleteReports, sourceFilter]);

  const activeTotal = activeSidebarTab === 'plotted' ? drawerReports.length : incompleteReports.length;
  const filteredTotal = activeSidebarTab === 'plotted' ? filteredPlotted.length : filteredIncomplete.length;
  const isFiltered = sourceFilter !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-full flex flex-col overflow-hidden min-h-0 bg-slate-50/60 dark:bg-[#0f172a]/60"
    >
      {/* ── Header: Live Dispatch Feed ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-white/5 shrink-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Live Incidents
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 tabular-nums font-mono shrink-0">
                {count + incompleteReports.length} Total
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
              Real-Time Talisay Dispatch Stream
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90 cursor-pointer shrink-0"
          title="Close incident list"
          aria-label="Close incident list"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Soft Segmented Control: Plotted vs Incomplete ── */}
      <div className="p-3 border-b border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-[#0f172a]/40 shrink-0 space-y-2.5">
        <div className="relative p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl flex items-center gap-1 text-xs font-semibold shadow-inner">
          <button
            type="button"
            onClick={() => onTabChange('plotted')}
            className={`relative flex-1 py-1.5 px-3 rounded-xl transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer z-10 select-none ${
              activeSidebarTab === 'plotted'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {activeSidebarTab === 'plotted' && (
              <motion.div
                layoutId="sidebarActiveTabPill"
                transition={SOFT_SPRING}
                className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-xl shadow-xs border border-black/5 dark:border-white/10"
              />
            )}
            <MapPin className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10 font-bold">Plotted</span>
            <span
              className={`relative z-10 text-[10px] px-2 py-0.2 rounded-full tabular-nums font-bold ${
                activeSidebarTab === 'plotted'
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
              }`}
            >
              {count}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('incomplete')}
            className={`relative flex-1 py-1.5 px-3 rounded-xl transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer z-10 select-none ${
              activeSidebarTab === 'incomplete'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {activeSidebarTab === 'incomplete' && (
              <motion.div
                layoutId="sidebarActiveTabPill"
                transition={SOFT_SPRING}
                className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-xl shadow-xs border border-black/5 dark:border-white/10"
              />
            )}
            <AlertTriangle className="w-3.5 h-3.5 relative z-10 text-amber-500" />
            <span className="relative z-10 font-bold">Incomplete</span>
            <span
              className={`relative z-10 text-[10px] px-2 py-0.2 rounded-full tabular-nums font-bold ${
                activeSidebarTab === 'incomplete'
                  ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
              }`}
            >
              {incompleteReports.length}
            </span>
          </button>
        </div>

        {/* ── Quick Source Filter Pills ── */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1">Source:</span>
            {(['all', 'Bot', 'Scraper'] as const).map((src) => {
              const isSelected = sourceFilter === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0071E3] text-white shadow-xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                  }`}
                >
                  {src === 'all' ? (
                    <span>All</span>
                  ) : src === 'Bot' ? (
                    <>
                      <Bot className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#0071E3]'}`} strokeWidth={1.75} />
                      <span>Bot</span>
                    </>
                  ) : (
                    <>
                      <Globe className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-purple-500'}`} strokeWidth={1.75} />
                      <span>Scraper</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Reset ({filteredTotal}/{activeTotal})
            </button>
          )}
        </div>
      </div>

      {/* ── Body Content ── */}
      {activeSidebarTab === 'plotted' ? (
        <>
          {/* Priority Legend */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/40 dark:border-white/5 shrink-0 bg-white/40 dark:bg-[#0f172a]/40 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Priority Levels:</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] ring-2 ring-green-500/20" />
                <span className="text-[10px]">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
                <span className="text-[10px]">Mod</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20 animate-pulse" />
                <span className="text-[10px]">High</span>
              </div>
            </div>
          </div>

          {/* Plotted Incident List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {filteredPlotted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-2xs">
                  <MapPin className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No matching incidents</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px]">
                  {isFiltered ? 'Try switching the source filter to All' : 'Try loosening the filters in the top toolbar'}
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => setSourceFilter('all')}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline pt-1 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              filteredPlotted.map((report, i) => (
                <IncidentListItem
                  key={report.id}
                  report={report}
                  index={i}
                  onClick={() => onFlyToReport(report)}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Incomplete Queue Callout Banner */}
          <div className="p-3 border-b border-slate-200/40 dark:border-white/5 shrink-0 bg-white/20 dark:bg-transparent">
            <div className="rounded-2xl p-3.5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 shadow-xs space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      Unmapped Incident Queue
                    </h5>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300">
                      {incompleteReports.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed mt-0.5">
                    These incoming reports lack a verified barangay or emergency category. Assign details to plot them onto the map.
                  </p>
                </div>
              </div>

              {/* Breakdown chips */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-amber-500/15">
                {incompleteStats.missingBarangay > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                    <MapPinOff className="w-2.5 h-2.5" />
                    <span>{incompleteStats.missingBarangay} Missing Barangay</span>
                  </span>
                )}
                {incompleteStats.missingCategory > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>{incompleteStats.missingCategory} Out of Scope</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Incomplete Reports List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            {filteredIncomplete.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center shadow-2xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isFiltered ? 'No matching incomplete reports for this source' : 'All incidents are mapped!'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px]">
                  {isFiltered ? 'Try switching the source filter to All' : 'All incoming reports have been classified and plotted.'}
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => setSourceFilter('all')}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline pt-1 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              filteredIncomplete.map((report, i) => (
                <IncompleteListItem
                  key={report.id}
                  report={report}
                  index={i}
                  onReview={() => onReviewInReports(report)}
                  onRemove={onRemoveReport ? () => onRemoveReport(report) : undefined}
                />
              ))
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── Soft Segmented Layer Toggle ──
function LayerToggle({ active, label, activeDot, onClick }: {
  active: boolean;
  label: string;
  activeDot: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1, scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer shrink-0 select-none ${
        active
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-[0_2px_8px_rgba(0,113,227,0.14)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] ring-1 ring-[#0071E3]/25 dark:ring-blue-400/30'
          : 'text-slate-500 dark:text-slate-400 hover:text-[#0071E3] dark:hover:text-sky-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:shadow-xs'
      }`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        {active && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${
              activeDot.split(' ')[0]
            }`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full transition-all duration-300 ${
            active
              ? `${activeDot} scale-110`
              : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-[#0071E3] group-hover:scale-110'
          }`}
        />
      </span>
      <span className="transition-colors duration-200 whitespace-nowrap">{label}</span>
    </motion.button>
  );
}

// ── MDRRMO Talisay HQ Inspector Detail Card ──
function MdrrmoDetailCard({
  onClose,
  activeTargets,
  onFlyToMdrrmo,
}: {
  onClose: () => void;
  activeTargets: ActiveBarangayTarget[];
  onFlyToMdrrmo: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="absolute bottom-5 sm:bottom-6 left-3 sm:left-6 z-[120] w-[min(380px,calc(100vw-24px))] rounded-3xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={mdrrmoLogoUrl}
            alt="MDRRMO Talisay"
            className="w-11 h-11 rounded-xl object-contain border border-sky-400/50 shadow-[0_0_14px_rgba(56,189,248,0.35)] shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                MDRRMO Talisay
              </h3>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 uppercase tracking-wider">
                EOC HQ
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Municipal Emergency Operations Center
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.03] p-3 rounded-2xl border border-slate-200/60 dark:border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Location:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">Talisay Municipal Hall Complex</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Coordinates:</span>
          <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">14.09303° N, 121.02128° E</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Active Corridors:</span>
          <span className="font-bold text-slate-900 dark:text-white tabular-nums">
            {activeTargets.length} Connected {activeTargets.length === 1 ? 'Sector' : 'Sectors'}
          </span>
        </div>
      </div>

      {activeTargets.length > 0 && (
        <div className="space-y-1.5 max-h-36 overflow-y-auto dropdown-scroll">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Incident Corridors
          </p>
          {activeTargets.map((target) => (
            <div
              key={target.normalizedName}
              className="flex items-center justify-between py-1 px-2 rounded-xl bg-white/80 dark:bg-slate-800/60 text-xs border border-slate-200/50 dark:border-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: target.color }} />
                <span className="font-medium text-slate-800 dark:text-slate-200">{target.name}</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                {target.incidentCount} {target.incidentCount === 1 ? 'incident' : 'incidents'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onFlyToMdrrmo}
        className="w-full py-2 px-3 flex items-center justify-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
      >
        <Navigation className="w-3.5 h-3.5" />
        <span>Center on MDRRMO HQ</span>
      </button>
    </motion.div>
  );
}

// ── Main Page ──

export default function GeospatialMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { reports, updateReport } = useReports();
  const { theme } = useTheme();

  // Floating feedback notification toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const handleResolveReport = useCallback(async (report: Report) => {
    setSelected(null);
    const code = formatReportCode(report.id, report.source);
    showToast(`Incident ${code} marked as Resolved. Vanished from active map (viewable under Resolved filter).`, 'success');
    await updateReport(report.id, {
      status: 'resolved',
      action: 'Resolved on Geospatial Map',
      actionTaken: 'Resolved on Geospatial Map',
    });
  }, [updateReport, showToast]);

  const handleRemoveReport = useCallback(async (report: Report) => {
    setSelected(null);
    const code = formatReportCode(report.id, report.source);
    showToast(`Incident ${code} removed from map and moved to Rejected queue.`, 'error');
    await updateReport(report.id, {
      status: 'rejected',
      rejectionReason: 'Removed by Dispatcher on Map',
      action: 'Removed from Map to Rejected queue',
      actionTaken: 'Removed from Map to Rejected queue',
    });
  }, [updateReport, showToast]);

  // Map theme follows the global app theme
  const mapTheme = theme;

  const [layers, setLayers] = useState<MapLayerState>(INITIAL_LAYERS);
  const [selected, setSelected] = useState<SelectedFeature>(null);
  const [drawerOpen, setDrawerOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [sidebarTab, setSidebarTab] = useState<'plotted' | 'incomplete'>('plotted');
  const [filterStatus, setFilterStatus] = useState<string>('Verified Only');
  const [filterUrgency, setFilterUrgency] = useState<string>('All Urgency');
  const [filterType, setFilterType] = useState<string>('All Types');
  const [loading, setLoading] = useState(true);

  // 3D Perspective View State & Pitch Listener
  const [is3DMode, setIs3DMode] = useState(false);

  const handleToggle3D = useCallback(() => {
    const nextState = !is3DMode;
    setIs3DMode(nextState);
    window.dispatchEvent(new CustomEvent('map-toggle-3d', { detail: { is3D: nextState } }));
  }, [is3DMode]);

  useEffect(() => {
    const handlePitchChange = (e: any) => {
      const pitch = e.detail?.pitch ?? 0;
      setIs3DMode(pitch > 10);
    };
    window.addEventListener('map-pitch-changed', handlePitchChange);
    return () => window.removeEventListener('map-pitch-changed', handlePitchChange);
  }, []);

  const hasActiveFilters =
    filterStatus !== 'Verified Only' ||
    (filterUrgency !== 'All Urgency' && filterUrgency !== 'All') ||
    (filterType !== 'All Types' && filterType !== 'All');

  const resetFilters = () => {
    setFilterStatus('Verified Only');
    setFilterUrgency('All Urgency');
    setFilterType('All Types');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  const availableIncidentTypes = useMemo(() => {
    const set = new Set<string>(['Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure']);
    reports.forEach((r) => {
      if (
        r.type &&
        r.type.trim() &&
        r.type !== 'All Types' &&
        r.type.toLowerCase() !== 'unclassified' &&
        r.type.toLowerCase() !== 'none'
      ) {
        set.add(r.type);
      }
    });
    return ['All Types', ...Array.from(set).sort()];
  }, [reports]);

  const matchStatus = useCallback((itemStatus?: string) => {
    if (!filterStatus || filterStatus === 'Verified Only' || filterStatus === 'Verified') {
      return itemStatus?.trim().toLowerCase() === 'verified';
    }
    if (filterStatus === 'All Reports' || filterStatus === 'All') {
      return itemStatus?.trim().toLowerCase() !== 'rejected';
    }
    const target = filterStatus.trim().toLowerCase().replace(/\s+/g, '_');
    return itemStatus?.trim().toLowerCase() === target;
  }, [filterStatus]);

  const matchUrgency = useCallback((itemUrgency?: string) => {
    if (!filterUrgency || filterUrgency === 'All Urgency' || filterUrgency === 'All') return true;
    return itemUrgency?.trim().toLowerCase() === filterUrgency.trim().toLowerCase();
  }, [filterUrgency]);

  const matchType = useCallback((itemType?: string) => {
    if (!filterType || filterType === 'All Types' || filterType === 'All') return true;
    return itemType?.trim().toLowerCase() === filterType.trim().toLowerCase();
  }, [filterType]);

  // Partition matching reports into complete (plottable) and incomplete
  const { completeReports, incompleteReports } = useMemo(() => {
    const matching = reports
      .filter((r) => r.status !== 'rejected')
      .filter((r) => matchStatus(r.status))
      .filter((r) => matchUrgency(r.urgency))
      .filter((r) => matchType(r.type));

    const complete: Report[] = [];
    const incomplete: Report[] = [];

    matching.forEach((r) => {
      if (isReportIncomplete(r)) {
        incomplete.push(r);
      } else {
        complete.push(r);
      }
    });

    return { completeReports: complete, incompleteReports: incomplete };
  }, [reports, matchStatus, matchUrgency, matchType]);

  // Reports for pin layer (only complete reports are plotted)
  const pinReports = useMemo(() => {
    const coordSeenCount: Record<string, number> = {};

    return completeReports.map((r) => {
      let finalLngLat: [number, number] | null = null;
      const parsed = parseCoords(r.coordinates);

      if (
        parsed &&
        parsed[1] >= 14.075 &&
        parsed[1] <= 14.16 &&
        parsed[0] >= 120.93 &&
        parsed[0] <= 121.08
      ) {
        finalLngLat = clampPointToBarangay(parsed, r.barangay);
      } else {
        const meta = getBarangayMeta(r.barangay);
        if (meta?.centroid && meta.centroid[1] >= 14.075) {
          const hash = (r.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const latOff = (((hash % 7) - 3) * 0.0006);
          const lngOff = ((((hash >> 2) % 7) - 3) * 0.0006);
          const rawCand: [number, number] = [meta.centroid[0] + lngOff, meta.centroid[1] + latOff];
          finalLngLat = clampPointToBarangay(rawCand, r.barangay);
        } else {
          const pobCenter: [number, number] = [121.022, 14.0925];
          const hash = (r.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const latOff = (((hash % 7) - 3) * 0.0005);
          const lngOff = ((((hash >> 2) % 7) - 3) * 0.0005);
          finalLngLat = clampPointToBarangay([pobCenter[0] + lngOff, pobCenter[1] + latOff], r.barangay);
        }
      }

      const coordKey = `${finalLngLat[0].toFixed(4)},${finalLngLat[1].toFixed(4)}`;
      const count = coordSeenCount[coordKey] || 0;
      coordSeenCount[coordKey] = count + 1;

      if (count > 0) {
        const angle = count * 2.39996;
        const dist = 0.00025 * Math.sqrt(count);
        const dLng = dist * Math.cos(angle);
        const dLat = dist * Math.sin(angle);
        finalLngLat = [finalLngLat[0] + dLng, finalLngLat[1] + dLat];
      }

      return {
        ...r,
        coordinates: `${finalLngLat[1].toFixed(5)}, ${finalLngLat[0].toFixed(5)}`,
      };
    });
  }, [completeReports]);

  // Compute barangay max urgency level (High=3, Moderate=2, Low=1) reflecting active filters and pins
  const URGENCY_WEIGHTS: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };
  const barangayCounts = useMemo(() => {
    const maxUrgency: Record<string, number> = {};
    pinReports.forEach((r) => {
      const weight = URGENCY_WEIGHTS[r.urgency] || 1;
      const bName = normalizeBarangayName(r.barangay) || r.barangay;
      maxUrgency[bName] = Math.max(maxUrgency[bName] || 0, weight);
    });
    return maxUrgency;
  }, [pinReports]);

  // Active Barangays with incident corridors connected to MDRRMO Talisay
  const activeBarangayTargets = useMemo(
    () => getActiveBarangaysFromReports(pinReports, talisayBarangays),
    [pinReports]
  );

  // Drawer list: synchronized exactly with the visible pins on the map
  const drawerReports = useMemo(() => {
    return [...pinReports].sort((a, b) => {
      const u = { High: 3, Moderate: 2, Low: 1 };
      return (u[b.urgency as keyof typeof u] || 0) - (u[a.urgency as keyof typeof u] || 0);
    });
  }, [pinReports]);

  const toggleLayer = useCallback((key: keyof MapLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSelectFeature = useCallback((feature: SelectedFeature) => {
    setSelected(feature);
  }, []);

  const handleFlyToReport = useCallback((report: Report) => {
    const coords = parseCoords(report.coordinates);
    if (coords) {
      setSelected({ type: 'incident', id: report.id });
      window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { center: coords, zoom: 16 } }));
    }
  }, []);

  // Handle URL ?focus= param
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (focusId) {
      const targetReport = reports.find((r) => r.id === focusId);
      if (targetReport && targetReport.status !== 'verified' && filterStatus === 'Verified Only') {
        setFilterStatus('All Reports');
      }
      if (targetReport && isReportIncomplete(targetReport)) {
        setSidebarTab('incomplete');
        setDrawerOpen(true);
      } else {
        const report = pinReports.find((r) => r.id === focusId) || targetReport;
        if (report) {
          const coords = parseCoords(report.coordinates);
          if (coords) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { center: coords, zoom: 16 } }));
              setSelected({ type: 'incident', id: report.id });
            }, 500);
          }
        }
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, pinReports, reports, filterStatus, setSearchParams]);

  // Selected data
  const selectedReport = selected?.type === 'incident'
    ? pinReports.find((r) => r.id === selected.id) || reports.find((r) => r.id === selected.id) || null
    : null;

  const selectedBarangayReports = useMemo(() => {
    if (selected?.type !== 'barangay') return [];
    const targetName = selected.name.trim().toLowerCase();
    const targetNormalized = normalizeBarangayName(selected.name).trim().toLowerCase();

    return pinReports.filter((r) => {
      const rName = (r.barangay || '').trim().toLowerCase();
      const rNormalized = normalizeBarangayName(r.barangay).trim().toLowerCase();
      if (rName === targetName || rNormalized === targetNormalized) return true;
      if ((targetName === 'poblacion' || targetNormalized === 'poblacion') && rNormalized.startsWith('poblacion')) return true;
      if ((rName === 'poblacion' || rNormalized === 'poblacion') && targetNormalized.startsWith('poblacion')) return true;
      return false;
    });
  }, [selected, pinReports]);

  if (loading) return <PageLoader variant="geospatial" />;

  return (
    <div className="geospatial-soft flex flex-col flex-1 min-h-0 gap-3 sm:gap-4 h-full">
      <StaggerContainer className="flex flex-col flex-1 min-h-0 gap-3 sm:gap-4 h-full">
        {/* ── Floating Command Toolbar Capsule with Soft Header ── */}
        <StaggerItem className="shrink-0">
          <SoftPanel className="p-4 sm:p-5 relative z-30 space-y-4">
            {/* ── Page Header (Soft UI Evolution) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-sky-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Map className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h1 className="text-lg sm:text-[22px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em] leading-tight">
                    Geospatial Map
                  </h1>
                  <p className="text-[11px] sm:text-xs font-normal tracking-[0.005em] text-slate-500/90 dark:text-slate-400/90 mt-0.5 leading-relaxed">
                    Real-time incident mapping <span className="text-slate-300 dark:text-slate-600 mx-1">·</span> Barangay density &amp; dispatch
                  </p>
                </div>
              </div>

              {/* Plotted & Unmapped live counters */}
              <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-white/5 tabular-nums text-slate-700 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white font-bold">{pinReports.length}</strong> Plotted
                </span>
                {incompleteReports.length > 0 && (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 tabular-nums flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <strong>{incompleteReports.length}</strong> Unmapped
                  </span>
                )}
              </div>
            </div>

            {/* ── Filters & Layer Controls ── */}
            <div className="pt-3.5 border-t border-slate-200/60 dark:border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Left Side: Filter Dropdowns + Reset */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 text-xs font-semibold shrink-0 border border-blue-500/25 dark:border-blue-400/25 shadow-2xs">
                  <Filter className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
                  <span>Filters</span>
                </div>
                {/* Filter Pills */}
                <div className="flex-1 sm:flex-initial min-w-[130px]">
                  <FilterDropdown
                    value={filterStatus}
                    options={['Verified Only', 'All Reports', 'Under Review', 'Resolved']}
                    onChange={setFilterStatus}
                  />
                </div>

                <div className="flex-1 sm:flex-initial min-w-[120px]">
                  <FilterDropdown
                    value={filterUrgency}
                    options={['All Urgency', 'High', 'Moderate', 'Low']}
                    onChange={setFilterUrgency}
                  />
                </div>

                <div className="flex-1 sm:flex-initial min-w-[130px]">
                  <FilterDropdown
                    value={filterType}
                    options={availableIncidentTypes}
                    onChange={setFilterType}
                  />
                </div>

                {/* Animated Reset Button */}
                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all active:scale-[0.97] cursor-pointer shrink-0 border border-blue-500/20"
                      title="Reset filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Side: Segmented Layer Control */}
              <div className="w-full xl:w-auto overflow-x-auto no-scrollbar scroll-smooth flex items-center justify-start xl:justify-end py-0.5 shrink-0">
                <div className="inline-flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-inner min-w-max">
                  <div className="group/layers flex items-center gap-1 px-2 py-1 text-slate-400 dark:text-slate-500 hover:text-[#0071E3] dark:hover:text-sky-400 transition-colors cursor-default select-none shrink-0">
                    <Layers className="w-3.5 h-3.5 transition-transform duration-300 group-hover/layers:rotate-12 group-hover/layers:scale-110 text-current" strokeWidth={1.8} />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Layers</span>
                  </div>
                  <LayerToggle
                    active={layers.choropleth}
                    label="Heatmap"
                    activeDot="bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                    onClick={() => toggleLayer('choropleth')}
                  />
                  <LayerToggle
                    active={layers.pins}
                    label="Pins"
                    activeDot="bg-[#0071E3] shadow-[0_0_8px_rgba(0,113,227,0.7)]"
                    onClick={() => toggleLayer('pins')}
                  />
                  <LayerToggle
                    active={layers.boundaries}
                    label="Borders"
                    activeDot="bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]"
                    onClick={() => toggleLayer('boundaries')}
                  />
                  <LayerToggle
                    active={layers.dispatchArcs ?? true}
                    label="Arcs"
                    activeDot="bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    onClick={() => toggleLayer('dispatchArcs')}
                  />
                  <div className="w-[1px] h-4 bg-slate-300 dark:bg-white/10 mx-0.5 shrink-0" />
                  <motion.button
                    type="button"
                    whileHover={{ y: -1, scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={handleToggle3D}
                    className={`group/btn inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 select-none ${
                      is3DMode
                        ? 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-[0_4px_14px_rgba(0,113,227,0.4)] ring-1 ring-[#0071E3]/40'
                        : 'bg-white/80 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:text-[#0071E3] dark:hover:text-sky-300 ring-1 ring-slate-950/5 dark:ring-white/10 hover:ring-[#0071E3]/25 shadow-xs hover:shadow-[0_2px_10px_rgba(0,113,227,0.18)]'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:rotate-12 group-hover/btn:scale-110 text-current" strokeWidth={1.8} />
                    <span className="whitespace-nowrap">{is3DMode ? '3D View' : '2D View'}</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </SoftPanel>
        </StaggerItem>

        {/* ── Main Canvas: Map + Side Panel ── */}
        <StaggerItem className="flex-1 min-h-[360px] sm:min-h-[460px] md:min-h-0 h-[calc(100dvh-18rem-env(safe-area-inset-bottom,0px))] md:h-full flex flex-row relative">

          {/* Desktop Sidebar (inline, animated width & margin) */}
          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                animate={{ width: 370, opacity: 1, marginRight: 16 }}
                exit={{ width: 0, opacity: 0, marginRight: 0 }}
                transition={{
                  width: PANEL_TRANSITION,
                  marginRight: PANEL_TRANSITION,
                  opacity: { duration: 0.22, ease: 'easeOut' },
                }}
                className="shrink-0 h-full overflow-hidden hidden lg:flex flex-col rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-2xl shadow-[0_16px_50px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)] border-t-white/90 dark:border-t-white/20 transform-gpu will-change-[width,opacity]"
              >
                <IncidentSidebarContent
                  count={pinReports.length}
                  drawerReports={drawerReports}
                  incompleteReports={incompleteReports}
                  activeSidebarTab={sidebarTab}
                  onTabChange={setSidebarTab}
                  onClose={() => setDrawerOpen(false)}
                  onFlyToReport={handleFlyToReport}
                  onReviewInReports={(report) => navigate(`/incident-reports?focus=${report.id}`)}
                  onRemoveReport={handleRemoveReport}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile / Tablet Slide-Over Drawer (< lg) */}
          <AnimatePresence>
            {drawerOpen && (
              <div className="lg:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => setDrawerOpen(false)}
                  className="fixed inset-0 z-[140] bg-slate-900/50 backdrop-blur-xs"
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={PANEL_TRANSITION}
                  className="fixed inset-y-0 left-0 z-[150] w-[min(370px,88vw)] bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl shadow-2xl border-r border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]"
                >
                  <IncidentSidebarContent
                    count={pinReports.length}
                    drawerReports={drawerReports}
                    incompleteReports={incompleteReports}
                    activeSidebarTab={sidebarTab}
                    onTabChange={setSidebarTab}
                    onClose={() => setDrawerOpen(false)}
                    onFlyToReport={(report) => {
                      handleFlyToReport(report);
                      setDrawerOpen(false);
                    }}
                    onReviewInReports={(report) => {
                      navigate(`/incident-reports?focus=${report.id}`);
                      setDrawerOpen(false);
                    }}
                    onRemoveReport={handleRemoveReport}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Map Shell Container — Elevated Soft Deck Frame */}
          <div className="flex-1 min-w-0 h-full bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)] p-2.5 sm:p-3 flex flex-col overflow-hidden min-h-0 relative transform-gpu border-t-white/80 dark:border-t-white/15">
            <div className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden border border-slate-200/70 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-slate-900">

              {/* Re-open Incidents Drawer Floating Button */}
              <AnimatePresence>
                {!drawerOpen && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.92, x: -8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.92, x: -8 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setDrawerOpen(true)}
                    className="group absolute left-3 top-3 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl shadow-lg hover:shadow-[0_4px_16px_rgba(0,113,227,0.22)] border border-slate-200/80 dark:border-white/10 hover:border-blue-400/50 dark:hover:border-blue-500/40 text-slate-700 dark:text-slate-200 hover:text-[#0071E3] dark:hover:text-sky-300 transition-all text-xs font-semibold cursor-pointer"
                    title="Show incident list"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400 transition-transform duration-200 group-hover:scale-110" />
                    <span>Incidents</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] tabular-nums">
                      {pinReports.length}
                    </span>
                    {incompleteReports.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px] tabular-nums">
                        {incompleteReports.length}
                      </span>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Map Canvas (Underlay) */}
              <MapContainer
                theme={mapTheme}
                layers={layers}
                barangayCounts={barangayCounts}
                pinReports={pinReports}
                onSelectFeature={handleSelectFeature}
                selectedFeature={selected}
              />

              {/* Overlaid Floating Detail Inspector Sheets (Overlay) */}
              <AnimatePresence>
                {selected?.type === 'barangay' && (
                  <BarangayDetailCard
                    name={selected.name}
                    reports={selectedBarangayReports}
                    onClose={() => setSelected(null)}
                    onViewList={() => navigate(`/incident-reports?barangay=${selected.name}`)}
                  />
                )}
                {selected?.type === 'incident' && selectedReport && (
                  <IncidentDetailCard
                    report={selectedReport}
                    onClose={() => setSelected(null)}
                    onViewInReports={() => navigate(`/incident-reports?focus=${selectedReport.id}`)}
                    onResolve={handleResolveReport}
                    onRemove={handleRemoveReport}
                  />
                )}
                {selected?.type === 'mdrrmo' && (
                  <MdrrmoDetailCard
                    onClose={() => setSelected(null)}
                    activeTargets={activeBarangayTargets}
                    onFlyToMdrrmo={() => {
                      window.dispatchEvent(
                        new CustomEvent('map-fly-to', {
                          detail: { center: MDRRMO_TALISAY_COORDS, zoom: 16 },
                        })
                      );
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Floating Action Feedback Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto z-[200] max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 pointer-events-auto"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  toastMessage.type === 'success'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : toastMessage.type === 'error'
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                }`}
              />
              <span className="text-xs font-medium text-slate-800 dark:text-slate-100 flex-1 leading-snug">
                {toastMessage.text}
              </span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold px-1 py-0.5 rounded transition-colors cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}