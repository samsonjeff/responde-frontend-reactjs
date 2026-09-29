import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, ExternalLink, MapPin, Clock, User,
  AlertCircle, CheckCircle, HelpCircle, AlertTriangle,
  MessageSquare, Radio, Zap, Sparkles, Bot, ChevronRight, ChevronLeft
} from 'lucide-react';
import { StaggerContainer, StaggerItem } from '../components/Stagger';
import { useTheme } from '../components/ThemeContent';
import { supabase } from '../lib/supabaseClient';
import MapContainer from '../components/MapContainer';
import { useReports } from '../context/ReportsContext';
import { useBotConversations, type BotConversation } from '../context/BotConversationsContext';
import type { MapLayerState } from '../types/geospatial';
import PageLoader from '../components/PageLoader';
import { BarangayBarChart } from './Analytics';

// ── Types ──
interface ScraperItem {
  id: string; text: string; barangay: string; type: string;
  urgency: 'High' | 'Moderate' | 'Low'; source: string; time: string;
  status: 'Pending Review' | 'Verified' | 'False Alarm';
  reporter: string; confidence: number;
}


// ── Toast Type ──
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Apple Design Physics ──
const APPLE_SPRING = { type: 'spring', stiffness: 400, damping: 32 } as const;

// ── Exact Avatar Palette & Name Map from MessengerBotLogs ──
const AVATAR_PALETTE = [
  "bg-[#1877F2]", // Sedrick Opulencia (Blue)
  "bg-[#E53935]", // Maria Delos Santos (Red)
  "bg-[#00897B]", // Joshua Reyes (Teal)
  "bg-[#1E88E5]", // Angeline Cruz (Blue)
  "bg-[#039BE5]", // Ferdinand Lim (Sky Blue)
  "bg-[#E53935]", // Divina Aquino (Red)
  "bg-[#43A047]", // 7th (Green)
  "bg-[#5E35B1]", // Purple
  "bg-[#FB8C00]", // Orange
];

const NAME_COLOR_MAP: Record<string, string> = {
  "Sedrick Opulencia": "bg-[#1877F2]",
  "Maria Delos Santos": "bg-[#E53935]",
  "Joshua Reyes": "bg-[#00897B]",
  "Angeline Cruz": "bg-[#1E88E5]",
  "Ferdinand Lim": "bg-[#039BE5]",
  "Divina Aquino": "bg-[#E53935]",
  "Kenneth Bautista": "bg-[#43A047]",
};

function getAvatarColor(name: string, index?: number): string {
  if (name && NAME_COLOR_MAP[name]) {
    return NAME_COLOR_MAP[name];
  }
  if (typeof index === "number" && index >= 0) {
    return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  }
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getLastMessage(convo: BotConversation): string {
  if (!convo.messages || convo.messages.length === 0) return "No messages yet";
  const userMsg = [...convo.messages].reverse().find((m) => m.sender === "user");
  return userMsg ? userMsg.text : convo.messages[convo.messages.length - 1].text;
}

function formatDisplayTime(timeStr: string): string {
  if (!timeStr) return "";
  if (timeStr.includes(" ")) {
    const parts = timeStr.split(" ");
    return parts[parts.length - 1];
  }
  return timeStr;
}

// ── Helpers ──
function formatTimestamp(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return `${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function inferType(incidentType: string, text: string): string {
  const t = (incidentType || '').toLowerCase();
  const txt = (text || '').toLowerCase();
  if (t === 'casualty' || t === 'medical' || txt.includes('sugat') || txt.includes('ospital') || txt.includes('ambulansya') || txt.includes('medic')) return 'Medical';
  if (t === 'evacuation' || txt.includes('evacuate') || txt.includes('stranded') || txt.includes('nakaipit') || txt.includes('rescue')) return 'Search & Rescue';
  if (t === 'flood' || t === 'landslide' || t === 'earthquake' || t === 'fire' || txt.includes('gumuhong') || txt.includes('bumagsak') || txt.includes('putol') || txt.includes('poste') || txt.includes('kuryente')) return 'Infrastructure';
  if (txt.includes('food') || txt.includes('tubig') || txt.includes('relief') || txt.includes('gatas') || txt.includes('gamot') || txt.includes('supply')) return 'Food & Water';
  return 'Medical';
}

function inferUrgency(incidentType: string, text: string): ScraperItem['urgency'] {
  const t = (incidentType || '').toLowerCase();
  const txt = (text || '').toLowerCase();
  const high = ['emergency', 'casualty', 'fire', 'now', 'asap', 'naipit', 'natabunan', 'patay', 'matanda', 'bata', 'nawawala'];
  const mod = ['flood', 'evacuation', 'landslide', 'earthquake', 'baha', 'gumuhong', 'tumumba', 'putol'];
  if (high.some(k => t.includes(k) || txt.includes(k))) return 'High';
  if (mod.some(k => t.includes(k) || txt.includes(k))) return 'Moderate';
  return 'Low';
}

// ── Toast Item Component (Apple Notification Banner) ──
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === 'success'
    ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
    : toast.type === 'error'
      ? <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
      : <Sparkles className="w-4 h-4 text-[#0071E3] shrink-0" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={APPLE_SPRING}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] bg-white/90 dark:bg-[#182234]/90 backdrop-blur-2xl min-w-[280px] max-w-[380px]"
    >
      {icon}
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { reports } = useReports();

  // Global Bot Conversations Context (synchronized with MessengerBotLogs & localStorage)
  const {
    conversations: botConversations,
    updateConversationStatus: setContextStatus,
    incompleteCount,
  } = useBotConversations();

  const [scraperItems, setScraperItems] = useState<ScraperItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [activeConv, setActiveConv] = useState<BotConversation | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string>('conv_1');
  const [activeScraper, setActiveScraper] = useState<ScraperItem | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastIdCounter, setToastIdCounter] = useState(0);
  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = toastIdCounter + 1;
    setToastIdCounter(id);
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Ref to prevent Strict Mode duplicate toasts
  const hasShownInitialToast = useRef(false);

  const updateBotConversationStatus = (id: string, newStatus: 'Incomplete' | 'Complete', silent = false) => {
    setContextStatus(id, newStatus);
    if (!silent) {
      const target = botConversations.find((c) => c.id === id);
      const name = target?.name || 'Conversation';
      showToast(
        `Marked ${name} as ${newStatus}`,
        newStatus === 'Complete' ? 'success' : 'info'
      );
    }
  };

  // Fetch Scraper posts from Supabase (Bot conversations are fetched & maintained via BotConversationsContext)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const scraperRes = await supabase
        .from('fb_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Process Scraper Posts
      const mappedScraper: ScraperItem[] = [];
      if (!scraperRes.error && scraperRes.data) {
        for (const row of scraperRes.data) {
          const text = row.comment_text || '';
          mappedScraper.push({
            id: String(row.id),
            text,
            barangay: row.barangay || 'Unknown',
            type: inferType(row.incident_type, text),
            urgency: inferUrgency(row.incident_type, text),
            source: 'Facebook Comment',
            time: formatTimestamp(row.created_at),
            status: 'Pending Review',
            reporter: row.user_name || 'Unknown',
            confidence: 0,
          });
        }
      }

      setScraperItems(mappedScraper);
      setLoading(false);

      if (!hasShownInitialToast.current) {
        hasShownInitialToast.current = true;
        const total = botConversations.length + mappedScraper.length;
        if (total > 0) {
          showToast(`${total} items loaded — ${botConversations.length} bot, ${mappedScraper.length} scraper`, 'success');
        }
      }

      if (scraperRes.error) {
        showToast(`Scraper data error: ${scraperRes.error.message}`, 'error');
      }
    };

    fetchData();
  }, [botConversations.length]);

  // Stats
  const totalIncidents = botConversations.length + scraperItems.length;
  const avgResponse = 0;

  // Dashboard Map Data
  const URGENCY_WEIGHTS: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

  const dashboardMapLayers: MapLayerState = { choropleth: true, pins: true, boundaries: true };

  const dashboardBarangayCounts = useMemo(() => {
    const maxUrgency: Record<string, number> = {};
    reports
      .filter((r) => r.status === 'verified' || r.status === 'under_review')
      .forEach((r) => {
        const weight = URGENCY_WEIGHTS[r.urgency] || 1;
        maxUrgency[r.barangay] = Math.max(maxUrgency[r.barangay] || 0, weight);
      });
    return maxUrgency;
  }, [reports]);

  const dashboardPinReports = useMemo(() => {
    return reports.filter((r) =>
      (r.status === 'verified' || r.status === 'under_review') &&
      r.coordinates && r.coordinates.includes(',')
    );
  }, [reports]);

  const openConversation = (conv: BotConversation) => {
    setSelectedConvId(conv.id);
    setActiveConv(conv);
    setShowMobileList(false);
    if (conv.status === 'Incomplete') {
      updateBotConversationStatus(conv.id, 'Complete', true);
    }
  };

  const handleModalSelectConv = (id: string) => {
    setSelectedConvId(id);
    setShowMobileList(false);
    const target = botConversations.find((c) => c.id === id);
    if (target && target.status === 'Incomplete') {
      updateBotConversationStatus(id, 'Complete', true);
    }
  };

  const selectedConversation = botConversations.find(c => c.id === selectedConvId) || botConversations[0] || activeConv;

  const modalSelectedIndex = selectedConversation
    ? botConversations.findIndex((c) => c.id === selectedConversation.id)
    : -1;

  const modalSelectedColor = selectedConversation
    ? getAvatarColor(selectedConversation.name, modalSelectedIndex !== -1 ? modalSelectedIndex : undefined)
    : "bg-[#1877F2]";

  const modalSelectedInitials = selectedConversation
    ? getInitials(selectedConversation.name)
    : "U";

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'High': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'Moderate': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Low': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Search & Rescue': return 'text-orange-600 dark:text-orange-400';
      case 'Medical': return 'text-emerald-600 dark:text-emerald-400';
      case 'Food & Water': return 'text-blue-600 dark:text-blue-400';
      case 'Infrastructure': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Verified': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'False Alarm': return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      default: return <HelpCircle className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verified': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'False Alarm': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default: return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
  };

  if (loading) return <PageLoader variant="dashboard" />;

  return (
    <>
      {/* Toast Notifications — Top Right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      <StaggerContainer className="grid grid-cols-12 gap-4 sm:gap-5 lg:gap-6 pb-20 md:pb-8 overflow-x-hidden w-full">

        {/* ── 1. Row 1: 4 Stat Cards (2x2 on mobile, 4-col on tablet and desktop) ── */}
        <StaggerItem className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Total Incidents */}
            <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Total Incidents</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{totalIncidents}</p>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span className="truncate">Active pipeline</span>
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-[0_0_16px_rgba(244,63,94,0.15)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>

            {/* Bot Conversations */}
            <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Bot Conversations</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{botConversations.length}</p>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium truncate">
                  {incompleteCount > 0 ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="text-amber-600 dark:text-amber-400 font-semibold truncate">{incompleteCount} incomplete</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-emerald-600 dark:text-emerald-400 truncate">All complete</span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-[#0071E3]/10 text-[#0071E3] dark:text-sky-400 border border-[#0071E3]/20 shadow-[0_0_16px_rgba(0,113,227,0.15)] flex items-center justify-center shrink-0">
                <MessageSquare className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>

            {/* Scraped Comments */}
            <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Scraped Comments</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{scraperItems.length}</p>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">Social streams</span>
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-[0_0_16px_rgba(245,158,11,0.15)] flex items-center justify-center shrink-0">
                <Radio className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>

            {/* Avg Response Time */}
            <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3.5 sm:p-4 md:p-5 flex items-center justify-between group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">Avg Response Time</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{avgResponse}s</p>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">Instant latency</span>
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.15)] flex items-center justify-center shrink-0">
                <Zap className="w-4.5 h-4.5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* ── 2. Row 2: Messenger Bot Activities (Col 4 on tablet/desktop) & Bar Chart (Col 8 on tablet/desktop) ── */}
        <StaggerItem className="col-span-12 md:col-span-4 lg:col-span-4 h-auto md:h-[480px] lg:h-[480px] flex flex-col">
          {/* Messenger Bot Activities — Apple System Card */}
          <div className="bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {/* Header Row */}
            <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02] gap-2">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#0071E3]/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-[#0071E3]/20 shadow-2xs">
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm tracking-tight truncate">
                  Messenger Bot Activities
                </h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {incompleteCount > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {incompleteCount} incomplete
                  </span>
                )}
                <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.06] tabular-nums">
                  {botConversations.length} total
                </span>
                <button
                  onClick={() => navigate('/messenger-bot-logs')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] transition-colors ml-0.5 active:scale-[0.97] shrink-0 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">View Logs</span>
                  <span className="sm:hidden">Logs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Conversation List with Apple-grade Edge Fade (max 3 rows on mobile) */}
            <div
              className="flex-1 overflow-hidden md:overflow-y-auto min-h-0 p-2 sm:p-2.5 pb-2 md:pb-10 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
              style={{
                maskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
              }}
            >
              {botConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-xs gap-2">
                  <MessageSquare className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                  <span>No conversations yet.</span>
                </div>
              ) : (
                botConversations.map((convo, index) => {
                  const isIncomplete = convo.status === "Incomplete";
                  const avatarColor = getAvatarColor(convo.name, index);
                  const initials = getInitials(convo.name);
                  return (
                    <button
                      key={convo.id}
                      type="button"
                      onClick={() => openConversation(convo)}
                      className={`w-full ${index >= 3 ? 'hidden md:flex' : 'flex'} items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all duration-150 text-left relative group active:scale-[0.985] ${isIncomplete
                          ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.08] hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.13] border border-amber-500/20 dark:border-amber-500/30"
                          : "hover:bg-slate-100/70 dark:hover:bg-white/[0.04] border border-transparent hover:border-slate-200/50 dark:hover:border-white/[0.05]"
                        }`}
                    >
                      {/* Circular Avatar with soft depth */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${avatarColor} flex items-center justify-center font-semibold text-xs text-white shadow-xs ring-1 ring-black/5 dark:ring-white/15`}
                        >
                          {initials}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className="text-[12px] sm:text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                            {convo.name}
                          </h4>
                          <span
                            className={`text-[10px] sm:text-[11px] tabular-nums font-medium shrink-0 ${isIncomplete
                                ? "text-amber-600 dark:text-amber-400 font-semibold"
                                : "text-slate-400 dark:text-slate-500"
                              }`}
                          >
                            {formatDisplayTime(convo.time)}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
                          {getLastMessage(convo)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center text-[10px] font-medium bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 rounded-md px-1.5 sm:px-2 py-0.5 border border-slate-200/50 dark:border-white/[0.06] truncate max-w-[140px] sm:max-w-none">
                            {convo.type} · {convo.barangay}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 sm:px-2 py-0.5 border ${isIncomplete
                                ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/20 font-semibold"
                                : "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isIncomplete ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                                }`}
                            />
                            {convo.status}
                          </span>
                        </div>
                      </div>

                      {/* Right Chevron */}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </StaggerItem>

        {/* Right Incident Frequency Bar Chart (Col 8 on tablet and desktop, internal horizontal scroll on mobile) */}
        <StaggerItem className="col-span-12 md:col-span-8 lg:col-span-8 h-[380px] sm:h-[420px] md:h-[480px] lg:h-[480px] flex flex-col">
          <BarangayBarChart interactive={false} className="h-full flex-1" />
        </StaggerItem>

        {/* ── 3. Row 3: Talisay Geospatial Map & Scraper Activities (Full width on tablet, 7/5 on desktop) ── */}
        {/* Talisay Geospatial Map — Fixed 250px on mobile, full width on tablet, 7-col on desktop */}
        <StaggerItem className="col-span-12 md:col-span-12 lg:col-span-7 h-[250px] md:h-[480px] lg:h-[580px] bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-3 sm:p-4 flex flex-col min-h-0 overflow-hidden">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-3 shrink-0 gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#0071E3]/10 dark:bg-[#0071E3]/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-[#0071E3]/20 shadow-2xs">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0071E3] dark:text-sky-400" />
              </div>
              <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight truncate">Talisay Geospatial Map</h3>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Monitor
              </span>
            </div>
            <button
              onClick={() => navigate('/geospatial-map')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] transition-colors active:scale-[0.97] shrink-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">View Full Map</span>
              <span className="sm:hidden">Full Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Framed Placeholder Map Canvas Box */}
          <div className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-[#0B0F17]">
            <MapContainer
              theme={theme}
              layers={dashboardMapLayers}
              barangayCounts={dashboardBarangayCounts}
              pinReports={dashboardPinReports}
              onSelectFeature={() => { }}
            />

            {/* Floating Apple-grade Severity Capsule inside map */}
            <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 z-10 pointer-events-none max-w-[calc(100%-16px)]">
              <div className="inline-flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-md text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 pointer-events-auto">
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider font-semibold text-slate-400">Severity:</span>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                  <span className="text-[10px] sm:text-[11px] font-medium">Low</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
                  <span className="text-[10px] sm:text-[11px] font-medium">Moderate</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 ring-2 ring-red-500/20 animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-medium">High</span>
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Scraper Activities — Limit 2 on mobile, full width on tablet, 5-col on desktop */}
        <StaggerItem className="col-span-12 md:col-span-12 lg:col-span-5 h-auto md:h-[480px] lg:h-[580px] flex flex-col">
          <div className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between bg-slate-50/40 dark:bg-white/[0.02] shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                  <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 tracking-tight truncate">Scraper Activities</h3>
                <span className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 font-medium tabular-nums border border-slate-200/60 dark:border-white/[0.06] shrink-0">
                  {scraperItems.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/scraper-feed')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] transition-colors active:scale-[0.97] shrink-0 whitespace-nowrap"
              >
                <span className="hidden sm:inline">View Feed</span>
                <span className="sm:hidden">Feed</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              className="p-2.5 sm:p-3 pb-2 md:pb-10 space-y-2 overflow-hidden md:overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
              style={{
                maskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
              }}
            >
              {scraperItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-xs gap-2">
                  <Radio className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                  <span>No scraped posts yet.</span>
                </div>
              ) : (
                scraperItems.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveScraper(item)}
                    className={`w-full ${index >= 2 ? 'hidden md:block' : 'block'} text-left p-3 sm:p-3.5 bg-slate-50/70 dark:bg-white/[0.03] rounded-xl border border-slate-200/60 dark:border-white/[0.06] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:shadow-xs transition-all duration-150 group active:scale-[0.985]`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed flex-1 font-normal">
                        &ldquo;{item.text}&rdquo;
                      </p>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}{item.status}
                      </span>
                      <span className={`text-[10px] sm:text-[11px] font-semibold ${getTypeColor(item.type)}`}>{item.type}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto tabular-nums font-medium">{item.time}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </StaggerItem>

      </StaggerContainer>

      {/* ════════════════════════════════════════
          CONVERSATION MODAL — Exact Match with MessengerBotLogs Chat Layout
         ════════════════════════════════════════ */}
      <AnimatePresence>
        {activeConv && selectedConversation && (
          <motion.div
            key="conv-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xl"
            onClick={() => setActiveConv(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={APPLE_SPRING}
              className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/40 dark:border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.25)] w-full max-w-4xl h-[90vh] sm:h-[80vh] flex overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left: Conversation List — adaptive drawer on mobile, static split column on tablet/desktop */}
              <div className={`${showMobileList ? 'flex' : 'hidden'} md:flex w-full md:w-72 lg:w-80 border-r border-slate-200/60 dark:border-slate-800/60 flex-col shrink-0 h-full bg-slate-50/40 dark:bg-[#111827]/40`}>
                <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/15">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Conversations</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {incompleteCount > 0 && (
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold rounded-full px-2 py-0.5 tabular-nums flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {incompleteCount}
                        </span>
                      )}
                      <span className="bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold rounded-full px-2 py-0.5 tabular-nums">
                        {botConversations.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMobileList(false)}
                      className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                      title="Return to message"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  className="flex-1 overflow-y-auto min-h-0 p-2 pb-10 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                  style={{
                    maskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                  }}
                >
                  {botConversations.map((convo, index) => {
                    const isSelected = selectedConvId === convo.id;
                    const isIncomplete = convo.status === "Incomplete";
                    const avatarColor = getAvatarColor(convo.name, index);
                    const initials = getInitials(convo.name);
                    return (
                      <button
                        key={convo.id}
                        type="button"
                        onClick={() => handleModalSelectConv(convo.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 text-left relative group active:scale-[0.98] ${isSelected
                          ? "bg-blue-500/10 dark:bg-blue-500/20 shadow-xs border border-blue-500/25 dark:border-blue-500/30 text-slate-900 dark:text-white"
                          : isIncomplete
                            ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.08] hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.14] border border-amber-500/15 dark:border-amber-500/20 text-slate-950 dark:text-white"
                            : "hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="modalActiveConvoIndicator"
                            className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-[#0071E3] rounded-full"
                            transition={APPLE_SPRING}
                          />
                        )}
                        <div className="relative shrink-0">
                          <div
                            className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-white/80 dark:ring-slate-800`}
                          >
                            {initials}
                          </div>
                          {isIncomplete && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 border-2 border-white dark:border-slate-800 rounded-full shadow-xs" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4
                              className={`text-xs truncate transition-all duration-200 ${isIncomplete
                                ? "font-bold text-slate-950 dark:text-white"
                                : isSelected
                                  ? "font-semibold text-slate-900 dark:text-white"
                                  : "font-medium text-slate-700 dark:text-slate-300"
                                }`}
                            >
                              {convo.name}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <span
                                className={`text-[10px] tabular-nums transition-colors duration-200 ${isIncomplete
                                  ? "font-semibold text-amber-600 dark:text-amber-400"
                                  : "font-normal text-slate-400 dark:text-slate-500"
                                  }`}
                              >
                                {formatDisplayTime(convo.time)}
                              </span>
                              {isIncomplete && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] shrink-0" />
                              )}
                            </div>
                          </div>
                          <p
                            className={`text-[11px] truncate mt-0.5 leading-snug transition-all duration-200 ${isIncomplete
                              ? "font-semibold text-slate-900 dark:text-slate-100"
                              : "font-normal text-slate-500 dark:text-slate-400"
                              }`}
                          >
                            {getLastMessage(convo)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Chat View — Exact MessengerBotLogs Message Detail */}
              <div className={`${showMobileList ? 'hidden' : 'flex'} md:flex flex-1 flex-col min-w-0 overflow-hidden`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedConvId}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={APPLE_SPRING}
                    className="flex-1 flex flex-col min-w-0 h-full"
                  >
                    {/* Header */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {/* Mobile back to list button */}
                        <button
                          type="button"
                          onClick={() => setShowMobileList(true)}
                          className="md:hidden inline-flex items-center gap-0.5 text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] py-1 px-1.5 -ml-1 rounded-lg hover:bg-[#0071E3]/10 transition-colors shrink-0"
                          title="View all conversations"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>List</span>
                        </button>
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${modalSelectedColor} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm ring-2 ring-white/80 dark:ring-slate-800`}
                        >
                          {modalSelectedInitials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-base tracking-tight truncate">
                            {selectedConversation.name}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5 mt-0.5 truncate">
                            <span className="truncate">{selectedConversation.barangay}</span>
                            <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                            <span className="truncate">{selectedConversation.type}</span>
                            <span className="hidden sm:inline text-slate-300 dark:text-slate-600 shrink-0">•</span>
                            <span className="hidden sm:inline font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">PSID: {selectedConversation.psid}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        {/* Apple Segmented 1-Click Status Switcher Capsule */}
                        <div
                          role="group"
                          aria-label="Conversation Status"
                          className="inline-flex items-center p-0.5 sm:p-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                        >
                          {/* Incomplete Option */}
                          <button
                            type="button"
                            onClick={() => updateBotConversationStatus(selectedConversation.id, 'Incomplete')}
                            className={`relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-tight transition-colors duration-200 select-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${selectedConversation.status === 'Incomplete'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                              }`}
                            title="Mark conversation as Incomplete"
                          >
                            {selectedConversation.status === 'Incomplete' && (
                              <motion.div
                                layoutId="modalActiveStatusCapsule"
                                transition={APPLE_SPRING}
                                className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/10"
                              />
                            )}
                            <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="relative z-10">Incomplete</span>
                          </button>

                          {/* Complete Option */}
                          <button
                            type="button"
                            onClick={() => updateBotConversationStatus(selectedConversation.id, 'Complete')}
                            className={`relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-tight transition-colors duration-200 select-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selectedConversation.status === 'Complete'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                              }`}
                            title="Mark conversation as Complete"
                          >
                            {selectedConversation.status === 'Complete' && (
                              <motion.div
                                layoutId="modalActiveStatusCapsule"
                                transition={APPLE_SPRING}
                                className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/10"
                              />
                            )}
                            <CheckCircle className="relative z-10 w-3.5 h-3.5 text-emerald-500" />
                            <span className="relative z-10">Complete</span>
                          </button>
                        </div>

                        <button
                          onClick={() => setActiveConv(null)}
                          className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
                          title="Close dialog"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Messages — Apple Messages Thread */}
                    <div
                      className="flex-1 overflow-y-auto min-h-0 p-3.5 sm:p-6 pb-12 bg-slate-50/40 dark:bg-[#0B0F17]/40 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                      style={{
                        maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                      }}
                    >
                      {selectedConversation.messages.map((msg, idx) =>
                        msg.sender === "bot" ? (
                          <div key={idx} className="flex items-end gap-2 justify-end">
                            <div className="flex flex-col items-end max-w-[85%] sm:max-w-[74%]">
                              <div className="bg-[#0071E3] text-white rounded-[18px] sm:rounded-[20px] rounded-br-[4px] px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-[0_2px_10px_rgba(0,113,227,0.22)]">
                                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 mr-1 font-medium flex items-center gap-1">
                                <Bot className="w-3 h-3 text-[#0071E3]" />
                                Responde Bot
                              </span>
                            </div>
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-[#0071E3] dark:text-blue-400 shrink-0 mb-4 ring-1 ring-blue-500/20 shadow-2xs">
                              <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0071E3]" />
                            </div>
                          </div>
                        ) : (
                          <div key={idx} className="flex items-end gap-2 justify-start">
                            <div
                              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${modalSelectedColor} flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-4 shadow-xs ring-1 ring-black/5`}
                            >
                              {modalSelectedInitials}
                            </div>
                            <div className="flex flex-col items-start max-w-[85%] sm:max-w-[74%]">
                              <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-800 dark:text-slate-100 rounded-[18px] sm:rounded-[20px] rounded-bl-[4px] px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1 font-medium">
                                {selectedConversation.name}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-3.5 sm:p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-[#111827]/80 flex justify-end">
                      <button
                        onClick={() => { setActiveConv(null); showToast('Navigating to Messenger Bot Logs', 'info'); navigate('/messenger-bot-logs'); }}
                        className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] active:scale-[0.97]"
                      >
                        Open in Messenger Bot Logs<ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════
          SCRAPER MODAL — Apple Inspector Sheet
         ════════════════════════════════════════ */}
      <AnimatePresence>
        {activeScraper && (
          <motion.div
            key="scraper-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xl"
            onClick={() => setActiveScraper(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={APPLE_SPRING}
              className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/40 dark:border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.25)] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">#{activeScraper.id.slice(-10)}</span>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getUrgencyColor(activeScraper.urgency)}`}>
                    {activeScraper.urgency} Priority
                  </span>
                </div>
                <button
                  onClick={() => setActiveScraper(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
                <div>
                  <h3 className={`text-base sm:text-lg font-bold tracking-tight ${getTypeColor(activeScraper.type)}`}>{activeScraper.type}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">{activeScraper.barangay}, Talisay</p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-3.5 sm:p-4 border border-slate-100 dark:border-white/5">
                  <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed italic">&ldquo;{activeScraper.text}&rdquo;</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold tracking-wider">
                      <User className="w-3.5 h-3.5" />
                      <span>Original Poster</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">{activeScraper.reporter}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Scraped At</span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 tabular-nums truncate">{activeScraper.time}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold tracking-wider">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Source</span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">{activeScraper.source}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold tracking-wider">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>NLP Confidence</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 tabular-nums">
                      {activeScraper.confidence > 0 ? `${(activeScraper.confidence * 100).toFixed(0)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium border ${getStatusColor(activeScraper.status)}`}>
                    {getStatusIcon(activeScraper.status)}{activeScraper.status}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
                <button
                  onClick={() => setActiveScraper(null)}
                  className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                >
                  Close
                </button>
                <button
                  onClick={() => { setActiveScraper(null); showToast('Navigating to Scraper Feed', 'info'); navigate('/scraper-feed'); }}
                  className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] active:scale-[0.97]"
                >
                  Go to Scraper Feed<ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}