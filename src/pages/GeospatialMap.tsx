import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft, ChevronRight, Filter, Navigation,
  Siren, HeartPulse, Droplets, HardHat, ShieldCheck,
  FileText, User, Phone, Clock, Layers, MapPin,
} from 'lucide-react';

import { useTheme } from '../components/ThemeContent';
import FilterDropdown from '../components/DropDown';
import MapContainer from '../components/MapContainer';
import { useReports } from '../context/ReportsContext';
import PageLoader from '../components/PageLoader';
import PageTransition from '../components/Transition';
import type { MapLayerState, SelectedFeature } from '../types/geospatial';
import type { Report } from '../data/sample-reports';

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
  'Search & Rescue': <Siren className="w-3.5 h-3.5" />,
  'Medical': <HeartPulse className="w-3.5 h-3.5" />,
  'Food & Water': <Droplets className="w-3.5 h-3.5" />,
  'Infrastructure': <HardHat className="w-3.5 h-3.5" />,
};

const URGENCY_BADGES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'High': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', dot: 'bg-red-500' },
  'Moderate': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  'Low': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

// Parse "lat, lng" → [lng, lat] for MapLibre
function parseCoords(coords: string): [number, number] | null {
  const parts = coords.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[1], parts[0]];
  }
  return null;
}

// ── Sub-components ──

function IncidentListItem({ report, index, onClick }: { report: Report; index: number; onClick: () => void }) {
  const badge = URGENCY_BADGES[report.urgency] || URGENCY_BADGES['Low'];

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...APPLE_SPRING, delay: Math.min(index * 0.02, 0.2) }}
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.98] border border-transparent"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot} shadow-2xs ${report.urgency === 'High' ? 'animate-pulse' : ''}`} />
        <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">#{report.id}</span>
        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate flex-1">
          {report.barangay}
        </span>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums shrink-0">{report.time}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 ml-4">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/40 dark:border-slate-700/40">
          <span className="scale-90 text-slate-400 dark:text-slate-500">{TYPE_ICONS[report.type] || <Siren className="w-3.5 h-3.5" />}</span>
          {report.type}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border} ml-auto`}>
          {report.urgency}
        </span>
      </div>
    </motion.button>
  );
}

function BarangayDetailCard({ name, reports, onClose, onViewList }: {
  name: string;
  reports: Report[];
  onClose: () => void;
  onViewList: () => void;
}) {
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
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      transition={APPLE_SPRING}
      className="absolute top-4 right-4 z-30 w-[min(340px,calc(100vw-2rem))] max-w-[340px] max-h-[75vh] overflow-y-auto rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 shadow-[0_16px_50px_rgba(0,0,0,0.15)] border border-slate-200/80 dark:border-white/10 border-t border-t-white/80 dark:border-t-white/20 transform-gpu will-change-transform"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#0071E3] dark:text-blue-400 flex items-center justify-center border border-blue-500/15">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{name}</h3>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Barangay Details</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Incidents</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{reports.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#0071E3] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">By Category</p>
          <div className="space-y-1.5">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                  <span className="text-slate-400 dark:text-slate-500">{TYPE_ICONS[type]}</span>
                  {type}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{count}</span>
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

        <button
          onClick={onViewList}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,113,227,0.25)] active:scale-[0.97]"
        >
          <FileText className="w-3.5 h-3.5" /> View in Incident Reports
        </button>
      </div>
    </motion.div>
  );
}

function IncidentDetailCard({ report, onClose, onViewInReports }: {
  report: Report;
  onClose: () => void;
  onViewInReports: () => void;
}) {
  const badge = URGENCY_BADGES[report.urgency] || URGENCY_BADGES['Low'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      transition={APPLE_SPRING}
      className="absolute top-4 right-4 z-30 w-[min(340px,calc(100vw-2rem))] max-w-[340px] max-h-[75vh] overflow-y-auto rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 shadow-[0_16px_50px_rgba(0,0,0,0.15)] border border-slate-200/80 dark:border-white/10 border-t border-t-white/80 dark:border-t-white/20 transform-gpu will-change-transform"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#0071E3] dark:text-blue-400 flex items-center justify-center border border-blue-500/15">
            {TYPE_ICONS[report.type] || <Siren className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{report.type}</h3>
            <span className="text-[10px] font-mono text-slate-400">ID: #{report.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {report.urgency}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            {report.barangay}
          </p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 pl-5">{report.coordinates}</p>
        </div>

        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">&ldquo;{report.description}&rdquo;</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            — {report.reporter}, <span className="tabular-nums">{report.time}</span>
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{report.reporter}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">{report.contact}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="tabular-nums">{report.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {report.status === 'verified' ? '✓ Verified' : report.status}
            </span>
          </div>
        </div>

        <button
          onClick={onViewInReports}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,113,227,0.25)] active:scale-[0.97]"
        >
          <FileText className="w-3.5 h-3.5" /> Open in Incident Reports
        </button>
      </div>
    </motion.div>
  );
}

function IncidentSidebarContent({
  count,
  drawerReports,
  onClose,
  onFlyToReport,
}: {
  count: number;
  drawerReports: Report[];
  onClose: () => void;
  onFlyToReport: (report: Report) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-[320px] h-full flex flex-col overflow-hidden min-h-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-white/5 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#0071E3]" />
          <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">Live Incidents</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold tabular-nums">
            {count}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors active:scale-90 cursor-pointer"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Apple HIG Severity Dot Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100/60 dark:border-white/5 shrink-0 bg-white/40 dark:bg-[#111827]/40 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Priority:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
          <span>Mod</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-500/20 animate-pulse" />
          <span>High</span>
        </div>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {drawerReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <MapPin className="w-5 h-5 opacity-60" />
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No matching incidents</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try loosening the filters above</p>
          </div>
        ) : (
          drawerReports.map((report, i) => (
            <IncidentListItem
              key={report.id}
              report={report}
              index={i}
              onClick={() => onFlyToReport(report)}
            />
          ))
        )}
      </div>
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
      className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-200 active:scale-[0.96] ${active
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
  const { reports, getReportsByBarangay } = useReports();
  const { theme } = useTheme();

  // Map theme follows the global app theme
  const mapTheme = theme;

  const [layers, setLayers] = useState<MapLayerState>(INITIAL_LAYERS);
  const [selected, setSelected] = useState<SelectedFeature>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [filterUrgency, setFilterUrgency] = useState<string>('All Urgency');
  const [filterType, setFilterType] = useState<string>('All Types');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  // Compute barangay max urgency level (High=3, Moderate=2, Low=1) reflecting active filters
  const URGENCY_WEIGHTS: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };
  const barangayCounts = useMemo(() => {
    const maxUrgency: Record<string, number> = {};
    reports
      .filter((r) => r.status === 'verified' || r.status === 'under_review')
      .filter((r) => filterUrgency === 'All Urgency' || filterUrgency === 'All' || r.urgency === filterUrgency)
      .filter((r) => filterType === 'All Types' || filterType === 'All' || r.type === filterType)
      .forEach((r) => {
        const weight = URGENCY_WEIGHTS[r.urgency] || 1;
        maxUrgency[r.barangay] = Math.max(maxUrgency[r.barangay] || 0, weight);
      });
    return maxUrgency;
  }, [reports, filterUrgency, filterType]);

  // Reports with coords for pin layer (verified + under_review — matches drawer)
  const pinReports = useMemo(() => {
    return reports
      .filter((r) => (r.status === 'verified' || r.status === 'under_review') && parseCoords(r.coordinates))
      .filter((r) => filterUrgency === 'All Urgency' || filterUrgency === 'All' || r.urgency === filterUrgency)
      .filter((r) => filterType === 'All Types' || filterType === 'All' || r.type === filterType);
  }, [reports, filterUrgency, filterType]);

  // Drawer list: verified + under_review with coords
  const drawerReports = useMemo(() => {
    return reports
      .filter((r) => (r.status === 'verified' || r.status === 'under_review') && parseCoords(r.coordinates))
      .filter((r) => filterUrgency === 'All Urgency' || filterUrgency === 'All' || r.urgency === filterUrgency)
      .filter((r) => filterType === 'All Types' || filterType === 'All' || r.type === filterType)
      .sort((a, b) => {
        const u = { High: 3, Moderate: 2, Low: 1 };
        return (u[b.urgency as keyof typeof u] || 0) - (u[a.urgency as keyof typeof u] || 0);
      });
  }, [reports, filterUrgency, filterType]);

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
      const report = reports.find((r) => r.id === focusId);
      if (report) {
        const coords = parseCoords(report.coordinates);
        if (coords) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { center: coords, zoom: 16 } }));
            setSelected({ type: 'incident', id: report.id });
          }, 500);
        }
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, reports, setSearchParams]);

  // Selected data
  const selectedReport = selected?.type === 'incident'
    ? reports.find((r) => r.id === selected.id)
    : null;

  const selectedBarangayReports = useMemo(() => {
    if (selected?.type !== 'barangay') return [];
    const all = getReportsByBarangay()[selected.name] || [];
    return all
      .filter((r) => filterUrgency === 'All Urgency' || filterUrgency === 'All' || r.urgency === filterUrgency)
      .filter((r) => filterType === 'All Types' || filterType === 'All' || r.type === filterType);
  }, [selected, getReportsByBarangay, filterUrgency, filterType]);

  if (loading) return <PageLoader variant="geospatial" />;

  return (
    <PageTransition>
      <div className="flex flex-col flex-1 min-h-0 gap-4">

        {/* ── Toolbar Row ── */}
        <div className="shrink-0">
          <div className="relative z-30 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] px-5 py-3 transition-all">
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">

              {/* Left: Filter Controls Capsule */}
              <div className="flex items-center gap-3 flex-wrap justify-start w-full md:w-auto relative z-20">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </div>
                <FilterDropdown
                  value={filterUrgency}
                  options={['All Urgency', 'High', 'Moderate', 'Low']}
                  onChange={setFilterUrgency}
                />

                <FilterDropdown
                  value={filterType}
                  options={['All Types', 'Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure']}
                  onChange={setFilterType}
                />
              </div>

              {/* Center: Apple Segmented Layer Toggle Capsule (Heatmap, Pins, Borders) */}
              <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center justify-center relative z-10 w-full md:w-auto">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-inner">
                  <div className="flex items-center gap-1 px-2 py-1 text-slate-400 dark:text-slate-500">
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
              </div>

              {/* Right: Plotted count chip for balanced symmetry */}
              <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 tabular-nums">
                  <strong className="text-slate-800 dark:text-slate-200">{pinReports.length}</strong> Plotted
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Map + Side Panel ── */}
        <div className="flex-1 min-h-0 flex flex-row relative h-full">

          {/* Desktop Sidebar (inline, animated width & margin) */}
          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                animate={{ width: 320, opacity: 1, marginRight: 16 }}
                exit={{ width: 0, opacity: 0, marginRight: 0 }}
                transition={{
                  width: PANEL_TRANSITION,
                  marginRight: PANEL_TRANSITION,
                  opacity: { duration: 0.18, ease: 'easeOut' },
                }}
                className="shrink-0 h-full overflow-hidden hidden lg:flex flex-col rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transform-gpu will-change-[width,opacity]"
              >
                <IncidentSidebarContent
                  count={drawerReports.length}
                  drawerReports={drawerReports}
                  onClose={() => setDrawerOpen(false)}
                  onFlyToReport={handleFlyToReport}
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
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={PANEL_TRANSITION}
                  className="fixed inset-y-0 left-0 z-50 w-[min(320px,85vw)] bg-white/95 dark:bg-[#111827]/95 backdrop-blur-2xl shadow-2xl border-r border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden"
                >
                  <IncidentSidebarContent
                    count={drawerReports.length}
                    drawerReports={drawerReports}
                    onClose={() => setDrawerOpen(false)}
                    onFlyToReport={(report) => {
                      handleFlyToReport(report);
                      setDrawerOpen(false);
                    }}
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Map Shell Container — White Card Shell with Framed Placeholder */}
          <div className="flex-1 min-w-0 h-full bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-3 sm:p-3.5 flex flex-col overflow-hidden min-h-0 relative transform-gpu">
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
                    className="absolute left-3 top-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl shadow-md border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-[0.95] text-xs font-semibold cursor-pointer"
                    title="Show incident list"
                  >
                    <ChevronRight className="w-4 h-4 text-[#0071E3]" />
                    <span>Show Incidents</span>
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
      </div>
    </PageTransition>
  );
} 