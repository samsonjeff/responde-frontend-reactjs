import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Filter, Navigation, RotateCcw,
  Siren, HeartPulse, Droplets, HardHat, ShieldCheck,
  FileText, User, Phone, Clock, Layers, MapPin,
  AlertTriangle, ChevronRight, Search, Bot, MessageSquare, Compass,
  MapPinOff, AlertCircle, CheckCircle2, Trash2,
} from 'lucide-react';

import { useTheme } from '../components/ThemeContent';
import FilterDropdown from '../components/DropDown';
import MapContainer from '../components/MapContainer';
import { useReports } from '../context/ReportsContext';
import PageLoader from '../components/PageLoader';
import PageTransition from '../components/Transition';
import type { MapLayerState, SelectedFeature } from '../types/geospatial';
import { isReportIncomplete, getIncompleteReasons, formatReportCode, type Report } from '../services/incidentService';
import { getBarangayMeta, normalizeBarangayName, clampPointToBarangay } from '../data/talisay-barangays';

const INITIAL_LAYERS: MapLayerState = {
  choropleth: true,
  pins: true,
  boundaries: true,
};

// -- Apple Design Spring & Smooth Easing Curves --
const APPLE_SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.8 } as const;
const PANEL_TRANSITION = { duration: 0.28, ease: [0.16, 1, 0.3, 1] } as const;

// Type icons
const TYPE_ICONS: Record<string, React.ReactNode> = {
  'Search & Rescue': <Siren className="w-4 h-4" />,
  'Medical': <HeartPulse className="w-4 h-4" />,
  'Food & Water': <Droplets className="w-4 h-4" />,
  'Infrastructure': <HardHat className="w-4 h-4" />,
};

const CATEGORY_STYLES: Record<string, { text: string; iconBg: string }> = {
  'Search & Rescue': {
    text: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  'Medical': {
    text: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  'Food & Water': {
    text: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  'Infrastructure': {
    text: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
};

const URGENCY_BADGES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'High': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', dot: 'bg-red-500' },
  'Moderate': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  'Low': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

// Parse "lat, lng" or "lng, lat" → [lng, lat] for MapLibre
function parseCoords(coords: string): [number, number] | null {
  if (!coords || typeof coords !== 'string') return null;
  const parts = coords.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    let lat: number;
    let lng: number;
    // In the Philippines / Batangas, Longitude is ~120-122 and Latitude is ~13-15
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

// ── Sub-components ──

function IncidentListItem({ report, index, onClick }: { report: Report; index: number; onClick: () => void }) {
  const badge = URGENCY_BADGES[report.urgency] || URGENCY_BADGES['Low'];
  const formattedCode = formatReportCode(report.id, report.source);
  const catStyle = CATEGORY_STYLES[report.type] || {
    text: 'text-[#0071E3] dark:text-blue-400',
    iconBg: 'bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border-blue-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...APPLE_SPRING, delay: Math.min(index * 0.02, 0.18) }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 bg-white/95 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_10px_28px_rgba(0,0,0,0.4)] hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all duration-200 cursor-pointer active:scale-[0.98] text-left space-y-2.5"
    >
      {/* Top row: Type Icon + Barangay + Priority */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${catStyle.iconBg}`}>
            {TYPE_ICONS[report.type] || <Siren className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate tracking-tight flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="truncate">{report.barangay}</span>
            </h4>
            <span className={`text-[10px] font-semibold tracking-tight ${catStyle.text}`}>
              {report.type}
            </span>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${report.urgency === 'High' ? 'animate-pulse' : ''}`} />
          {report.urgency}
        </span>
      </div>

      {/* Quoted description snippet */}
      {report.description && (
        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 italic leading-relaxed pl-2 border-l-2 border-blue-500/30 dark:border-blue-400/30">
          &ldquo;{report.description}&rdquo;
        </p>
      )}

      {/* Middle row: Code Badge + Reporter & Time */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/40 shrink-0"
            title={`Source ID: ${report.id}`}
          >
            {formattedCode}
          </span>
          <span className="text-slate-600 dark:text-slate-300 truncate font-medium text-xs">{report.reporter}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums font-mono">{report.time}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071E3] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
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
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 12 }}
      transition={APPLE_SPRING}
      className="absolute z-30 flex flex-col overflow-hidden rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 shadow-[0_16px_50px_rgba(0,0,0,0.22)] border border-slate-200/80 dark:border-white/10 border-t-white/90 dark:border-t-white/20 transform-gpu will-change-transform bottom-2 left-2 right-2 max-h-[calc(100%-1rem)] sm:bottom-auto sm:top-3 sm:right-3 sm:left-auto sm:w-[350px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100%-1.5rem)]"
    >
      {/* Mobile sheet grab handle */}
      <div className="w-10 h-1 rounded-full bg-slate-300/80 dark:bg-slate-600/80 mx-auto mt-2 -mb-1 sm:hidden shrink-0" />

      {/* Pinned Header */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#0071E3] dark:text-blue-400 flex items-center justify-center border border-blue-500/15 shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight truncate">{name}</h3>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Barangay Details</span>
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
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-3 sm:p-3.5 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Incidents</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{reports.length}</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-[#0071E3] flex items-center justify-center">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {meta && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">PSGC Code</p>
              <p className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">{meta.psgc}</p>
            </div>
            <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Land Area</p>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{meta.area_km2} km²</p>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">By Category</p>
          <div className="space-y-1.5">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium truncate">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">{TYPE_ICONS[type] || <Siren className="w-3.5 h-3.5" />}</span>
                  <span className="truncate">{type}</span>
                </span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">By Urgency</p>
          <div className="space-y-1.5">
            {Object.entries(urgencyCounts).map(([urgency, count]) => {
              const b = URGENCY_BADGES[urgency] || URGENCY_BADGES['Low'];
              return (
                <div key={urgency} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40">
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${b.dot}`} />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{urgency}</span>
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {reports.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Incidents in Barangay</p>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
              {reports.map((r) => {
                const b = URGENCY_BADGES[r.urgency] || URGENCY_BADGES['Low'];
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.dot}`} />
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">{formatReportCode(r.id, r.source)}</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium truncate">{r.type}</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${b.bg} ${b.text} shrink-0 ml-2`}>
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
      <div className="shrink-0 p-3 sm:p-3.5 border-t border-slate-200/60 dark:border-white/10 bg-slate-50/90 dark:bg-[#111827]/90 backdrop-blur-md">
        <button
          type="button"
          onClick={onViewList}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,113,227,0.25)] active:scale-[0.97] cursor-pointer"
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
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 12 }}
      transition={APPLE_SPRING}
      className="absolute z-30 flex flex-col overflow-hidden rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 shadow-[0_16px_50px_rgba(0,0,0,0.22)] border border-slate-200/80 dark:border-white/10 border-t-white/90 dark:border-t-white/20 transform-gpu will-change-transform bottom-2 left-2 right-2 max-h-[calc(100%-1rem)] sm:bottom-auto sm:top-3 sm:right-3 sm:left-auto sm:w-[350px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100%-1.5rem)]"
    >
      {/* Mobile sheet grab handle */}
      <div className="w-10 h-1 rounded-full bg-slate-300/80 dark:bg-slate-600/80 mx-auto mt-2 -mb-1 sm:hidden shrink-0" />

      {/* Pinned Header */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#0071E3] dark:text-blue-400 flex items-center justify-center border border-blue-500/15 shrink-0">
            {TYPE_ICONS[report.type] || <Siren className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight truncate">{report.type}</h3>
            <span className="text-[10px] font-mono text-slate-400 block truncate" title={`Original ID: ${report.id}`}>
              ID: {formatReportCode(report.id, report.source)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 sm:px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
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
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 sm:space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-2.5 sm:p-3 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">{report.barangay}</span>
          </p>
          <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 pl-5 truncate">{report.coordinates}</p>
        </div>

        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-slate-200/50 dark:border-slate-700/50">
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic break-words">&ldquo;{report.description}&rdquo;</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            — {report.reporter}, <span className="tabular-nums">{report.time}</span>
          </p>
        </div>

        <div className="space-y-1.5 sm:space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{report.reporter}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono truncate">{report.contact}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="tabular-nums">{report.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
              {report.status === 'verified'
                ? '✓ Verified'
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
      <div className="shrink-0 p-3 sm:p-3.5 border-t border-slate-200/60 dark:border-white/10 bg-slate-50/90 dark:bg-[#111827]/90 backdrop-blur-md space-y-2">
        {report.status !== 'resolved' ? (
          <button
            type="button"
            onClick={() => onResolve(report)}
            className="w-full py-2 sm:py-2.5 px-3 sm:px-4 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.35)] active:scale-[0.97] cursor-pointer"
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
            className="py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>

          <button
            type="button"
            onClick={onViewInReports}
            className="py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-white/5 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> In Reports
          </button>
        </div>

        {/* Remove Confirmation Inline Drawer */}
        <AnimatePresence>
          {showRemoveConfirm && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
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
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...APPLE_SPRING, delay: Math.min(index * 0.02, 0.18) }}
      className="group relative overflow-hidden rounded-2xl p-4 bg-white/95 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)] hover:border-amber-400/60 dark:hover:border-amber-500/50 transition-all duration-200 text-left space-y-3"
    >
      {/* Subtle top indicator bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 opacity-80" />

      {/* Top Header Row: Avatar + Reporter + Ticket Badge */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-2xs ${
              isBot
                ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white'
                : 'bg-gradient-to-tr from-sky-500 via-cyan-600 to-blue-600 text-white'
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
          className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#0071E3] to-[#0077ED] hover:from-[#0077ED] hover:to-[#0085FF] shadow-[0_2px_10px_rgba(0,113,227,0.25)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.35)] transition-all duration-150 flex items-center justify-between group active:scale-[0.97] cursor-pointer"
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
            className="py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center justify-center shrink-0 active:scale-[0.97] cursor-pointer"
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
  const [searchQuery, setSearchQuery] = useState('');
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) =>
        (r.barangay && r.barangay.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q)) ||
        (r.reporter && r.reporter.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q)) ||
        formatReportCode(r.id, r.source).toLowerCase().includes(q)
      );
    }
    return list;
  }, [drawerReports, searchQuery, sourceFilter]);

  // Filter incomplete reports
  const filteredIncomplete = useMemo(() => {
    let list = incompleteReports;
    if (sourceFilter !== 'all') {
      list = list.filter((r) => r.source === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) =>
        (r.barangay && r.barangay.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q)) ||
        (r.reporter && r.reporter.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q)) ||
        formatReportCode(r.id, r.source).toLowerCase().includes(q)
      );
    }
    return list;
  }, [incompleteReports, searchQuery, sourceFilter]);

  const activeTotal = activeSidebarTab === 'plotted' ? drawerReports.length : incompleteReports.length;
  const filteredTotal = activeSidebarTab === 'plotted' ? filteredPlotted.length : filteredIncomplete.length;
  const isFiltered = searchQuery.trim() !== '' || sourceFilter !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-full flex flex-col overflow-hidden min-h-0 bg-slate-50/50 dark:bg-[#0f172a]/50"
    >
      {/* ── Header ── */}
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
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 tabular-nums font-mono shrink-0">
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

      {/* ── Apple Segmented Control: Plotted vs Incomplete ── */}
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
                transition={APPLE_SPRING}
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
                transition={APPLE_SPRING}
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

        {/* ── Search Bar & Quick Source Filter Pills ── */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticket, barangay, text..."
              className="w-full pl-8.5 pr-7 py-2 text-xs bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-white/5 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1">Source:</span>
              {(['all', 'Bot', 'Scraper'] as const).map((src) => {
                const isSelected = sourceFilter === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-bold'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    {src === 'all' ? 'All' : src === 'Bot' ? '🤖 Bot' : '🌐 FB'}
                  </button>
                );
              })}
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSourceFilter('all'); }}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Reset ({filteredTotal}/{activeTotal})
              </button>
            )}
          </div>
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
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                <span className="text-[10px]">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
                <span className="text-[10px]">Mod</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-500/20 animate-pulse" />
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
                  {searchQuery ? 'Try adjusting your search query or filters' : 'Try loosening the filters in the top toolbar'}
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSourceFilter('all'); }}
                    className="text-xs text-[#0071E3] dark:text-blue-400 font-semibold hover:underline pt-1 cursor-pointer"
                  >
                    Clear Filters
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
                  {searchQuery ? 'No matching incomplete reports' : 'All incidents are mapped!'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px]">
                  {searchQuery ? 'Try adjusting your search criteria' : 'All incoming reports have been classified and plotted.'}
                </p>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSourceFilter('all'); }}
                    className="text-xs text-[#0071E3] dark:text-blue-400 font-semibold hover:underline pt-1 cursor-pointer"
                  >
                    Clear Filters
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

// ── Apple Segmented Layer Toggle ──
function LayerToggle({ active, label, activeDot, onClick }: {
  active: boolean;
  label: string;
  activeDot: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold tracking-tight transition-all duration-200 active:scale-[0.96] cursor-pointer ${active
        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-950/5 dark:ring-white/10'
        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40'
        }`}
    >
      <span className={`w-2 h-2 rounded-full transition-all ${active ? activeDot : 'bg-slate-300 dark:bg-slate-600'}`} />
      <span>{label}</span>
    </button>
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

      // If valid coordinates within Batangas/Talisay region (~14.075 - 14.16, 120.93 - 121.08)
      if (
        parsed &&
        parsed[1] >= 14.075 &&
        parsed[1] <= 14.16 &&
        parsed[0] >= 120.93 &&
        parsed[0] <= 121.08
      ) {
        finalLngLat = clampPointToBarangay(parsed, r.barangay);
      } else {
        // Fallback to barangay centroid (since complete, r.barangay is a known, valid barangay)
        const meta = getBarangayMeta(r.barangay);
        if (meta?.centroid && meta.centroid[1] >= 14.075) {
          const hash = (r.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const latOff = (((hash % 7) - 3) * 0.0006);
          const lngOff = ((((hash >> 2) % 7) - 3) * 0.0006);
          const rawCand: [number, number] = [meta.centroid[0] + lngOff, meta.centroid[1] + latOff];
          finalLngLat = clampPointToBarangay(rawCand, r.barangay);
        } else {
          // Poblacion fallback if name matches
          const pobCenter: [number, number] = [121.022, 14.0925];
          const hash = (r.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const latOff = (((hash % 7) - 3) * 0.0005);
          const lngOff = ((((hash >> 2) % 7) - 3) * 0.0005);
          finalLngLat = clampPointToBarangay([pobCenter[0] + lngOff, pobCenter[1] + latOff], r.barangay);
        }
      }

      // Collision avoidance micro spiral displacement (~25m) so coincident pins don't overlap into one
      const coordKey = `${finalLngLat[0].toFixed(4)},${finalLngLat[1].toFixed(4)}`;
      const count = coordSeenCount[coordKey] || 0;
      coordSeenCount[coordKey] = count + 1;

      if (count > 0) {
        const angle = count * 2.39996; // Golden angle
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
      // Handle "Poblacion" matching "Poblacion Barangay X"
      if ((targetName === 'poblacion' || targetNormalized === 'poblacion') && rNormalized.startsWith('poblacion')) return true;
      if ((rName === 'poblacion' || rNormalized === 'poblacion') && targetNormalized.startsWith('poblacion')) return true;
      return false;
    });
  }, [selected, pinReports]);

  if (loading) return <PageLoader variant="geospatial" />;

  return (
    <PageTransition>
      <div className="flex flex-col flex-1 min-h-0 gap-3 sm:gap-4 h-full">

        {/* ── Toolbar Row ── */}
        <div className="shrink-0">
          <div className="relative z-30 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] px-3 sm:px-5 py-2.5 sm:py-3 transition-all">
            <div className="flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap items-stretch md:items-center justify-between gap-2.5 sm:gap-3">

              {/* Left: Filter Controls Capsule */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                  <Filter className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span>Filters</span>
                </div>

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

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0071E3] hover:text-blue-700 dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all duration-150 active:scale-[0.97] cursor-pointer shrink-0"
                    title="Reset filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Right: Apple Segmented Layer Toggle Capsule & Plotted Count */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
                <div className="inline-flex items-center gap-0.5 sm:gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-inner">
                  <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-slate-400 dark:text-slate-500">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline">Layers</span>
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
                    activeDot="bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.7)]"
                    onClick={() => toggleLayer('pins')}
                  />
                  <LayerToggle
                    active={layers.boundaries}
                    label="Borders"
                    activeDot="bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]"
                    onClick={() => toggleLayer('boundaries')}
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 tabular-nums">
                    <strong className="text-slate-800 dark:text-slate-200">{pinReports.length}</strong> Plotted
                  </span>
                  {incompleteReports.length > 0 && (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 tabular-nums">
                      <strong>{incompleteReports.length}</strong> Incomplete
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Map + Side Panel ── */}
        <div className="flex-1 min-h-[340px] sm:min-h-[440px] md:min-h-0 h-[calc(100dvh-18rem-env(safe-area-inset-bottom,0px))] md:h-full flex flex-row relative">

          {/* Desktop Sidebar (inline, animated width & margin) */}
          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                animate={{ width: 364, opacity: 1, marginRight: 16 }}
                exit={{ width: 0, opacity: 0, marginRight: 0 }}
                transition={{
                  width: PANEL_TRANSITION,
                  marginRight: PANEL_TRANSITION,
                  opacity: { duration: 0.18, ease: 'easeOut' },
                }}
                className="shrink-0 h-full overflow-hidden hidden lg:flex flex-col rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/85 dark:bg-[#0f172a]/85 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)] border-t-white/90 dark:border-t-white/20 transform-gpu will-change-[width,opacity]"
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
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  onClick={() => setDrawerOpen(false)}
                  className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-xs"
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={PANEL_TRANSITION}
                  className="fixed inset-y-0 left-0 z-[150] w-[min(364px,88vw)] bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl shadow-2xl border-r border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]"
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

          {/* Map Shell Container — White Card Shell with Framed Placeholder */}
          <div className="flex-1 min-w-0 h-full bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-2.5 sm:p-3.5 flex flex-col overflow-hidden min-h-0 relative transform-gpu">
            <div className="relative flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-slate-200/70 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-slate-900">

              {/* Drawer re-open button (Apple Floating Capsule) */}
              <AnimatePresence>
                {!drawerOpen && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.92, x: -8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.92, x: -8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setDrawerOpen(true)}
                    className="absolute left-3 top-3 z-20 flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl shadow-md border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.95] text-xs font-semibold cursor-pointer"
                    title="Show incident list"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#0071E3]" />
                    <span>Incidents</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-[#0071E3] dark:text-blue-400 font-bold text-[10px] tabular-nums">
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

              {/* Detail Cards (Inspector Sheets overlaid on map) */}
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
              </AnimatePresence>

              {/* Map Canvas */}
              <MapContainer
                theme={mapTheme}
                layers={layers}
                barangayCounts={barangayCounts}
                pinReports={pinReports}
                onSelectFeature={handleSelectFeature}
              />
            </div>
          </div>
        </div>

        {/* Floating Action Feedback Toast (Apple Design Floating Capsule) */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
    </PageTransition>
  );
} 