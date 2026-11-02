import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Filter, Globe, MessageCircle, AlertTriangle, MapPin, Clock,
  CheckCircle, XCircle, Brain, Users, ExternalLink,
  Loader2, Radio, X, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, RefreshCw,
  Sparkles, CheckCircle2, Layers
} from "lucide-react";
import DatePicker from "../components/DatePicker";
import FilterDropdown from "../components/DropDown";
import { StaggerContainer, StaggerItem } from "../components/Stagger";
import { supabase } from "../lib/supabaseClient";
import { authService } from "../services/authService";
import { apiRequest } from "../services/apiClient";
import { useDebounce } from "../hooks/useDebounce";
import PageLoader from "../components/PageLoader";
import { TALISAY_BARANGAYS } from "../data/talisay-barangays";
import { BASE_INCIDENT_TYPES, formatReportType, formatReportUrgency } from "../services/incidentService";
import { formatTimestampPHT } from "../utils/dateUtils";
import { isIncidentIntent, isGeneralLogIntent, normalizeIntent } from "../utils/intentUtils";

interface ScrapedPost {
  id: string;
  source: "Facebook Page" | "Facebook Comment" | "Group Post";
  author: string;
  avatar: string;
  rawText: string;
  barangay: string;
  type: string;
  urgency: "Critical" | "High" | "Moderate" | "Low";
  intent?: string;
  status: "New" | "Verified" | "Flagged" | "Resolved";
  timestamp: string;
  createdAt?: string;
  confidence: number;
  isIncident: boolean;
  nlpCategory?: "Incident" | "Non-Incident";
  nlpReason?: string;
  extractedEntities: {
    location: string;
    contact?: string;
    peopleAffected?: number;
    needs?: string[];
  };
}

// ── Toast Type ──
interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

// ── Apple Design Spring Physics & Motion ──
const APPLE_SPRING = { type: "spring", stiffness: 400, damping: 32 } as const;

const contentVariants: Variants = {
  hidden: { opacity: 0, x: 10, scale: 0.99 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: APPLE_SPRING,
  },
  exit: {
    opacity: 0,
    x: -8,
    scale: 0.99,
    transition: { duration: 0.15, ease: "easeOut" },
  },
};

export const INACTIVITY_GAP_MS = 60 * 60 * 1000;

// ── Apple Notification Toast Component ──
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === "success"
    ? <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
    : toast.type === "error"
      ? <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
      : <Loader2 className="w-4 h-4 text-[#0071E3] dark:text-sky-400 animate-spin" />;

  const badgeBg = toast.type === "success"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
    : toast.type === "error"
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
      : "bg-blue-500/10 text-[#0071E3] dark:text-sky-400 border border-blue-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={APPLE_SPRING}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#111827]/95 border border-slate-200/80 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] min-w-[300px] max-w-[400px]"
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${badgeBg}`}>
        {icon}
      </div>
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-1 leading-snug">
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.92] transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ── Format Supabase timestamp → Philippine Standard Time "M/D h:mm A" ──
function formatTimestamp(ts: string | null): string {
  return formatTimestampPHT(ts);
}

const SCRAPER_FEED_CACHE_KEY = 'responde_cached_scraper_feed_posts';

function getInitialCachedPosts(): ScrapedPost[] {
  try {
    const raw = sessionStorage.getItem(SCRAPER_FEED_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export default function ScraperFeed() {
  const initialCached = useMemo(() => getInitialCachedPosts(), []);
  const [posts, setPosts] = useState<ScrapedPost[]>(initialCached);
  const [loading, setLoading] = useState<boolean>(() => initialCached.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => initialCached[0]?.id || "");

  // Structured (NLP Incidents only) vs Unstructured (Raw Stream with Noise)
  const [viewMode, setViewMode] = useState<"structured" | "unstructured">(() => {
    try {
      return (localStorage.getItem("responde_scraper_view_mode") as any) || "structured";
    } catch {
      return "structured";
    }
  });

  const handleViewModeChange = (mode: "structured" | "unstructured") => {
    setViewMode(mode);
    try {
      localStorage.setItem("responde_scraper_view_mode", mode);
    } catch {}
  };

  // Track seen comments (persisted in localStorage)
  const [seenPostIds, setSeenPostIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('responde_seen_scraper_posts');
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const markPostSeen = (id: string) => {
    if (!id) return;
    setSeenPostIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('responde_seen_scraper_posts', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Mobile navigation & filter states
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter states
  const [filterBarangay, setFilterBarangay] = useState("All Barangays");
  const [filterType, setFilterType] = useState("All Types");
  const [filterUrgency, setFilterUrgency] = useState("All Urgency");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination state (20 comments per page)
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // 300ms debounce on filter inputs to eliminate rapid filter stutter
  const debouncedBarangay = useDebounce(filterBarangay, 300);
  const debouncedType = useDebounce(filterType, 300);
  const debouncedUrgency = useDebounce(filterUrgency, 300);
  const debouncedStatus = useDebounce(filterStatus, 300);
  const debouncedFromDate = useDebounce(fromDate, 300);
  const debouncedToDate = useDebounce(toDate, 300);

  // Reset to first page when any debounced filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedBarangay, debouncedType, debouncedUrgency, debouncedStatus, debouncedFromDate, debouncedToDate]);

  // -- Toast State --
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastIdCounter, setToastIdCounter] = useState(0);
  const showToast = (message: string, type: Toast["type"] = "info") => {
    const id = toastIdCounter + 1;
    setToastIdCounter(id);
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // -- Ref to prevent Strict Mode duplicate toasts --
  const hasShownInitialToast = useRef(false);

  // Operator manual override: promote/demote between incident and noise
  const togglePostIncidentOverride = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextVal = !p.isIncident;
        return {
          ...p,
          isIncident: nextVal,
          nlpCategory: nextVal ? "Incident" : "Non-Incident",
          nlpReason: nextVal
            ? "Manually marked by operator as an actionable emergency incident."
            : "Manually reclassified by operator as non-incident chatter / general noise.",
          confidence: nextVal ? Math.max(p.confidence, 90) : 15,
        };
      })
    );
    showToast("Classification updated", "success");
  };

  const processData = (data: any[] | null, tableName: string) => {
    const sorted = (data ?? []).sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    const mapped: ScrapedPost[] = sorted.map((row: any) => {
      const idVal = row.id || row.comment_id || row.post_id;
      const userName = row.user_name || row.username || row.author || "Unknown";
      const barangay = row.barangay || row.location || "Unknown";
      const text = row.comment_text || row.commentText || row.text || row.raw_text || row.rawText || "";
      const source = row.source || (tableName.toLowerCase().includes("comment") ? "Facebook Comment" : "Facebook Page");
      const status = row.status || "New";

      const extractedEntities = row.extracted_entities || row.extractedEntities || {
        location: barangay !== "Unknown" ? barangay : "Unknown",
        needs: row.needs ? (Array.isArray(row.needs) ? row.needs : [row.needs]) : []
      };

      const rawIntent = row.intent ? String(row.intent).trim() : '';
      const isIncident = isIncidentIntent(rawIntent);
      const normIntent = normalizeIntent(rawIntent);

      const nlpCategory: "Incident" | "Non-Incident" = isIncident ? "Incident" : "Non-Incident";
      const nlpReason = isIncident
        ? (normIntent === "Resource Request"
            ? "Resource request intent detected requiring dispatch of supplies or assistance."
            : "Emergency report intent detected from citizen social media post.")
        : `Non-emergency citizen post (Intent: ${normIntent}).`;

      // Prioritize ML classified urgency and confidence stored in Supabase
      const nlpConfidence = typeof row.confidence === "number" && row.confidence > 0
        ? row.confidence
        : (row.urgency_confidence ? Math.round(row.urgency_confidence * 100) : (row.incident_type_confidence ? Math.round(row.incident_type_confidence * 100) : 0));

      const rawUrgency = row.urgency ? String(row.urgency).trim() : '';
      const resolvedUrgency = formatReportUrgency(rawUrgency) as ScrapedPost["urgency"];

      return {
        id: String(idVal),
        source: source as ScrapedPost["source"],
        author: userName,
        avatar: userName.charAt(0).toUpperCase(),
        rawText: text,
        barangay,
        type: formatReportType(row.incident_type || row.type),
        urgency: resolvedUrgency,
        intent: normIntent,
        status: status as ScrapedPost["status"],
        timestamp: formatTimestamp(row.created_at || row.timestamp),
        createdAt: row.created_at || row.timestamp || "",
        confidence: nlpConfidence > 0 ? nlpConfidence : (isIncident ? 92 : 20),
        isIncident,
        nlpCategory,
        nlpReason,
        extractedEntities: {
          location: extractedEntities.location || (barangay !== "Unknown" ? barangay : "Unknown"),
          contact: row.contact || row.contact_number || extractedEntities.contact,
          peopleAffected: row.people_affected || row.peopleAffected || extractedEntities.peopleAffected,
          needs: Array.isArray(extractedEntities.needs) ? extractedEntities.needs : [],
        },
      };
    });

    try {
      sessionStorage.setItem(SCRAPER_FEED_CACHE_KEY, JSON.stringify(mapped));
    } catch {}

    setPosts(mapped);
    if (mapped.length > 0) {
      setSelectedId((prev) => prev || mapped[0].id);
      markPostSeen(mapped[0].id);
    }
    setLoading(false);

    if (!hasShownInitialToast.current) {
      hasShownInitialToast.current = true;
      showToast(`${mapped.length} scraped comments loaded`, "success");
    }
  };

  const postsCountRef = useRef(posts.length);
  postsCountRef.current = posts.length;

  // -- Fetch directly from Supabase with resilient API fallback --
  const fetchPosts = useCallback(async (isFirst = false, signal?: AbortSignal, forceRefresh = false) => {
    if (isFirst && postsCountRef.current === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Fetch directly from Supabase fb_comments table
      const { data: supaRows, error: supaErr } = await supabase
        .from('fb_comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (!supaErr && Array.isArray(supaRows) && supaRows.length > 0) {
        processData(supaRows, 'fb_comments');
      } else {
        // Fallback to backend API
        const json = await apiRequest<{ data?: any[] }>(
          '/api/auth/data/fb-comments?limit=500',
          {
            signal,
            forceRefresh,
            cacheTtlMs: 8000,
          }
        );

        const data: any[] = json.data ?? [];
        processData(data, 'fb_comments');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (import.meta.env.DEV) {
          console.log('[ScraperFeed] Fetch aborted cleanly');
        }
        return;
      }
      console.warn('[ScraperFeed] Fetch warning:', err.message);
      setError((prev) => (postsCountRef.current === 0 ? (err.message || 'An unexpected error occurred') : prev));
      if (postsCountRef.current === 0) {
        showToast(err.message || 'An unexpected error occurred', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(true, controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchPosts]);

  const handleUpdateStatus = async (postId: string, newStatus: ScrapedPost["status"]) => {
    // Optimistically update status locally
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p))
    );

    try {
      await authService.updateFbCommentStatus(postId, newStatus);
      showToast(`Comment marked as ${newStatus.toLowerCase()}`, "success");
    } catch (err: any) {
      console.error("[ScraperFeed] Status update error:", err);
      showToast(`Status updated locally (${newStatus.toLowerCase()})`, "success");
    }
  };

  const handleSelectPost = (id: string) => {
    setSelectedId(id);
    markPostSeen(id);
    setMobileView('detail');
  };

  const activeFilterCount =
    (filterBarangay !== "All Barangays" ? 1 : 0) +
    (filterType !== "All Types" ? 1 : 0) +
    (filterUrgency !== "All Urgency" ? 1 : 0) +
    (filterStatus !== "All Status" ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setFilterBarangay("All Barangays");
    setFilterType("All Types");
    setFilterUrgency("All Urgency");
    setFilterStatus("All Status");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  const availableBarangays = useMemo(() => {
    const fromPosts = posts
      .map((p) => p.barangay)
      .filter((b): b is string => Boolean(b && !['all barangays', 'unknown', 'none', 'unspecified', 'n/a'].includes(b.toLowerCase().trim())));
    const sorted = Array.from(new Set([...TALISAY_BARANGAYS, ...fromPosts])).sort();
    return ["All Barangays", "Unknown", ...sorted];
  }, [posts]);

  const availableTypes = useMemo(() => {
    const fromPosts = posts.map((p) => p.type).filter(Boolean);
    const sorted = Array.from(new Set([...BASE_INCIDENT_TYPES, ...fromPosts]))
      .filter((t): t is string => Boolean(t && t.toLowerCase() !== 'all types' && t.toLowerCase() !== 'unclassified'))
      .sort();
    return ["All Types", ...sorted];
  }, [posts]);

  const getPostDateString = (p: ScrapedPost): string | null => {
    if (p.createdAt) {
      try {
        const d = new Date(p.createdAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {}
    }
    if (p.timestamp) {
      const parts = p.timestamp.split(' ')[0].split('/');
      if (parts.length === 2) {
        const mm = parts[0].padStart(2, '0');
        const dd = parts[1].padStart(2, '0');
        const yyyy = new Date().getFullYear();
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return null;
  };

  const incidentCount = useMemo(() => posts.filter((p) => isIncidentIntent(p.intent)).length, [posts]);
  const rawCount = useMemo(() => posts.filter((p) => isGeneralLogIntent(p.intent)).length, [posts]);

  // Filter logic
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (viewMode === "structured") {
        if (!isIncidentIntent(p.intent)) return false;
      } else {
        if (!isGeneralLogIntent(p.intent)) return false;
      }
      if (filterBarangay !== "All Barangays") {
        const normFilter = filterBarangay.toLowerCase().trim();
        const postBarangay = (p.barangay || "").toLowerCase().trim();
        if (normFilter === "unknown" || normFilter === "none") {
          if (postBarangay && postBarangay !== "unknown" && postBarangay !== "none" && postBarangay !== "unspecified" && postBarangay !== "n/a") {
            return false;
          }
        } else if (postBarangay !== normFilter) {
          return false;
        }
      }
      if (filterType !== "All Types") {
        const normFilter = filterType.toLowerCase().trim();
        const postType = (p.type || "none").toLowerCase().trim();
        if (normFilter === "none" || normFilter === "unknown") {
          if (postType !== "none" && postType !== "unclassified" && postType !== "unknown") return false;
        } else if (postType !== normFilter) {
          return false;
        }
      }
      if (filterUrgency !== "All Urgency" && p.urgency?.toLowerCase() !== filterUrgency.toLowerCase()) return false;
      if (filterStatus !== "All Status" && p.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (fromDate) {
        const dStr = getPostDateString(p);
        if (dStr && dStr < fromDate) return false;
      }
      if (toDate) {
        const dStr = getPostDateString(p);
        if (dStr && dStr > toDate) return false;
      }
      return true;
    });
  }, [posts, viewMode, filterBarangay, filterType, filterUrgency, filterStatus, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, currentPage]);

  const selectedPost = filteredPosts.find((p) => p.id === selectedId) || paginatedPosts[0] || null;

  const markAllSeen = () => {
    const allIds = new Set(filteredPosts.map((p) => p.id));
    setSeenPostIds(allIds);
    try {
      localStorage.setItem('responde_seen_scraper_posts', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const unseenCount = useMemo(() => {
    return filteredPosts.filter((p) => !seenPostIds.has(p.id) && p.status === 'New').length;
  }, [filteredPosts, seenPostIds]);

  useEffect(() => {
    if (filteredPosts.length > 0) {
      const exists = filteredPosts.some((p) => p.id === selectedId);
      if (!exists) {
        setSelectedId(filteredPosts[0].id);
        markPostSeen(filteredPosts[0].id);
      }
    } else {
      setSelectedId("");
    }
  }, [filteredPosts, selectedId]);

  const AVATAR_PALETTE = [
    "bg-[#1877F2]", // Blue
    "bg-[#E53935]", // Red
    "bg-[#00897B]", // Teal
    "bg-[#1E88E5]", // Sky
    "bg-[#43A047]", // Green
    "bg-[#5E35B1]", // Purple
    "bg-[#FB8C00]", // Orange
  ];

  const getAvatarColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  };

  // ── Semantic Micro-Dot Status System (No Glaring Neon Blocks) ──
  const renderUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping shrink-0" />
            Critical
          </span>
        );
      case "High":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            High
          </span>
        );
      case "Moderate":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Moderate
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.06] tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Low
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.06] tabular-nums">
            {urgency}
          </span>
        );
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "New":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-[#0071E3] dark:text-sky-400 border border-blue-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse shrink-0" />
            New
          </span>
        );
      case "Verified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Verified
          </span>
        );
      case "Flagged":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Flagged
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100/90 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.06] tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/[0.06] tabular-nums">
            {status}
          </span>
        );
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Facebook Page": return <ExternalLink className="w-3 h-3 text-blue-500" strokeWidth={1.75} />;
      case "Facebook Comment": return <MessageCircle className="w-3 h-3 text-[#0071E3]" strokeWidth={1.75} />;
      case "Group Post": return <Users className="w-3 h-3 text-emerald-500" strokeWidth={1.75} />;
      default: return <Globe className="w-3 h-3 text-slate-500" strokeWidth={1.75} />;
    }
  };

  // Early return loading skeleton on initial cold load
  if (loading && posts.length === 0) {
    return <PageLoader variant="scraper" />;
  }

  // Early return error state if initial load failed and no cached posts
  if (!loading && error && posts.length === 0) {
    return (
      <div className="scraper-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative">
        <div className="flex-1 flex items-center justify-center p-4">
          {error.includes("Too many requests") || error.includes("429") || error.includes("503") || error.toLowerCase().includes("unavailable") || error.toLowerCase().includes("timeout") ? (
            <div className="flex flex-col items-center gap-3 text-amber-600 dark:text-amber-400 bg-amber-500/[0.06] dark:bg-amber-500/[0.10] border border-amber-500/20 rounded-2xl p-6 sm:p-8 max-w-md text-center shadow-sm">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={1.75} />
              </div>
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Server is warming up...</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                The scraper feed service is warming up or handling a temporary rate-limit delay. Stored comments will appear shortly.
              </p>
              <button
                type="button"
                onClick={() => fetchPosts(true, undefined, true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-rose-600 dark:text-rose-400 bg-rose-500/[0.06] dark:bg-rose-500/[0.10] border border-rose-500/20 rounded-2xl p-6 sm:p-8 max-w-md text-center shadow-sm">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Failed to load scraped comments</p>
              <p className="text-xs text-rose-500 dark:text-rose-400 font-mono">{error}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The system experienced a temporary connection delay. Click retry below.
              </p>
              <button
                type="button"
                onClick={() => fetchPosts(true, undefined, true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Retry Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="scraper-soft flex flex-col flex-1 w-full lg:h-full lg:min-h-0 space-y-3 sm:space-y-3.5 relative">
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

      <StaggerContainer className="flex flex-col flex-1 space-y-3 sm:space-y-3.5 w-full lg:h-full lg:min-h-0">
        {/* Stage 1: Top Page Header */}
        <StaggerItem>
      {/* ── Top Page Header (Unified Soft UI Design) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
            <Globe className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Scraper Feed
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Social media ingestion, public comment monitoring, and automated NLP incident extraction
            </p>
          </div>
        </div>

      </div>
        </StaggerItem>

        {/* Stage 2: Filters Bar */}
        <StaggerItem>
          {/* Filters Bar — Soft tactile elevation with responsive collapsible filter drawer */}
          <div className={`${mobileView === 'detail' ? 'hidden md:block' : 'block'} relative z-30 backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-3 sm:p-4 transition-all`}>
            {/* Mobile Header Bar with Toggle & Active Filter Count (< md) */}
            <div className="flex items-center justify-between md:hidden mb-2.5">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none active:scale-[0.98] transition-transform"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-[#0071E3] dark:text-sky-400 flex items-center justify-center border border-blue-500/20">
                  <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
                </div>
                <span>Filter Comments</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0071E3] text-white tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${mobileFiltersOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center w-7 h-7 text-[#0071E3] hover:text-blue-700 dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-lg border border-blue-500/20 transition-all duration-150 active:scale-95 cursor-pointer shrink-0"
                  title="Reset all filters"
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Filter Controls Row — collapsible on mobile, always visible on tablet & desktop */}
            <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center justify-between gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-white/5`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto relative z-20">
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 border border-slate-200/50 dark:border-white/10">
                  <Filter className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
                  <span>Filters</span>
                </div>

                <FilterDropdown
                  value={filterBarangay}
                  options={availableBarangays}
                  onChange={(val) => { setFilterBarangay(val); setSelectedId(""); }}
                />

                <FilterDropdown
                  value={filterType}
                  options={availableTypes}
                  onChange={(val) => { setFilterType(val); setSelectedId(""); }}
                />

                <FilterDropdown
                  value={filterUrgency}
                  options={["All Urgency", "Low", "Moderate", "High", "Critical"]}
                  onChange={(val) => { setFilterUrgency(val); setSelectedId(""); }}
                />

                <FilterDropdown
                  value={filterStatus}
                  options={["All Status", "New", "Verified", "Flagged", "Resolved"]}
                  onChange={(val) => { setFilterStatus(val); setSelectedId(""); }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2.5 sm:gap-3 md:ml-auto w-full md:w-auto relative z-10">
                <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[130px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">From:</span>
                  <div className="flex-1 sm:w-36">
                    <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[130px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">To:</span>
                  <div className="flex-1 sm:w-36">
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
          </div>

        </StaggerItem>

        {/* Stage 3: Two Column Layout / Responsive Split-Pane */}
        <StaggerItem className="flex-1 lg:min-h-0 flex flex-col">
          {/* Two Column Layout / Responsive Split-Pane */}
          <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 lg:gap-6 lg:min-h-0 lg:h-full">
            {/* LEFT: Post List — Soft Feed Sidebar */}
            <div
              className={`
                ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}
                md:col-span-5 lg:col-span-5 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-col overflow-hidden
                min-h-[460px] md:min-h-0 h-full
              `}
            >
              {/* Apple Segmented Switcher Header */}
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02] gap-2">
                <div
                  role="tablist"
                  aria-label="Feed View Mode"
                  className="inline-flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "structured"}
                    onClick={() => handleViewModeChange("structured")}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-colors duration-150 select-none cursor-pointer active:scale-[0.98] ${
                      viewMode === "structured"
                        ? "text-[#0071E3] dark:text-sky-300"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {viewMode === "structured" && (
                      <motion.div
                        layoutId="activeScraperSidebarTab"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 bg-white dark:bg-slate-700/90 border border-slate-200/80 dark:border-white/10 rounded-lg shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
                      <span>Incidents</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        viewMode === "structured"
                          ? "bg-[#0071E3] text-white"
                          : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}>
                        {incidentCount}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "unstructured"}
                    onClick={() => handleViewModeChange("unstructured")}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-colors duration-150 select-none cursor-pointer active:scale-[0.98] ${
                      viewMode === "unstructured"
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {viewMode === "unstructured" && (
                      <motion.div
                        layoutId="activeScraperSidebarTab"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 bg-white dark:bg-slate-700/90 border border-slate-200/80 dark:border-white/10 rounded-lg shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                      <span>All Posts</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        viewMode === "unstructured"
                          ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                          : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}>
                        {rawCount}
                      </span>
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {unseenCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllSeen}
                      className="text-[11px] font-medium text-[#0071E3] dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Post Cards List */}
              <div
                className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-2.5 pb-3 md:pb-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                style={{
                  maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                }}
              >
                {filteredPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-400 dark:text-slate-500 text-xs gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 flex items-center justify-center">
                      <Radio className="w-6 h-6 stroke-[1.5] text-slate-400 dark:text-slate-500" />
                    </div>
                    <span className="font-medium text-slate-600 dark:text-slate-400 text-center">
                      {viewMode === "structured" ? "No structured incidents match current filters." : "No raw comments found."}
                    </span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="text-xs font-semibold text-[#0071E3] dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <StaggerContainer className="space-y-1.5">
                    {paginatedPosts.map((post) => {
                      const isSelected = selectedId === post.id;
                      const isSeen = seenPostIds.has(post.id) || post.status !== 'New';

                      return (
                        <StaggerItem key={post.id} className="w-full">
                          <button
                            type="button"
                            onClick={() => handleSelectPost(post.id)}
                            className={`w-full text-left p-2.5 sm:p-3 rounded-xl transition-all duration-150 relative group active:scale-[0.985] cursor-pointer ${
                              isSelected
                                ? "bg-blue-500/[0.08] dark:bg-blue-500/[0.14] shadow-xs border border-blue-500/30 text-slate-900 dark:text-white"
                                : !isSeen
                                ? "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-slate-900 dark:text-white"
                                : "hover:bg-slate-100/70 dark:hover:bg-white/[0.04] border border-transparent hover:border-slate-200/50 dark:hover:border-white/[0.05] text-slate-600 dark:text-slate-400 opacity-90"
                            }`}
                          >
                            {/* Sliding active indicator bar */}
                            {isSelected && (
                              <motion.div
                                layoutId="activePostIndicator"
                                className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-[#0071E3] rounded-full"
                                transition={APPLE_SPRING}
                              />
                            )}

                            <div className="flex items-start gap-2.5 sm:gap-3 pl-1">
                              <div
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${getAvatarColor(
                                  post.author
                                )} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ring-1 ${
                                  !isSeen ? "ring-blue-400/80 dark:ring-blue-500/80" : "ring-black/5 dark:ring-white/10 opacity-80"
                                }`}
                              >
                                {post.avatar || (post.author ? post.author.charAt(0).toUpperCase() : "U")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {!isSeen && (
                                      <span
                                        className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"
                                        title="New unread comment"
                                      />
                                    )}
                                    <span
                                      className={`text-xs sm:text-[13px] truncate tracking-tight transition-colors ${
                                        !isSeen
                                          ? "font-bold text-slate-900 dark:text-white"
                                          : "font-semibold text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      {post.author}
                                    </span>
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap ml-2">
                                    {post.timestamp}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-white/[0.06] px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-white/[0.06] truncate max-w-[120px] sm:max-w-none">
                                    {getSourceIcon(post.source)}
                                    {post.source}
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">•</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                    {post.barangay}
                                  </span>
                                  {post.intent && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600 text-[10px]">•</span>
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                        isIncidentIntent(post.intent)
                                          ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10'
                                          : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                                      }`}>
                                        {post.intent}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p
                                  className={`text-xs line-clamp-2 mb-2 leading-relaxed transition-colors ${
                                    !isSeen
                                      ? "font-medium text-slate-900 dark:text-slate-100"
                                      : "font-normal text-slate-500 dark:text-slate-400"
                                  }`}
                                >
                                  {post.rawText}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {renderUrgencyBadge(post.urgency)}
                                  {renderStatusBadge(post.status)}
                                </div>
                              </div>
                            </div>
                          </button>
                        </StaggerItem>
                      );
                    })}
                  </StaggerContainer>
                )}
              </div>

              {/* Pagination Controls Footer */}
              {filteredPosts.length > PAGE_SIZE && (
                <div className="px-3.5 py-2.5 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02] flex items-center justify-between gap-2 shrink-0">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredPosts.length)} of {filteredPosts.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 px-1.5 tabular-nums">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Post Detail — macOS Soft Inspector Style */}
            <div
              className={`
                ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
                md:col-span-7 lg:col-span-7 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-col overflow-hidden
                min-h-[480px] md:min-h-0 h-[calc(100vh-10rem)] md:h-full
              `}
            >
              <AnimatePresence mode="wait">
                {selectedPost ? (
                  <motion.div
                    key={selectedPost.id}
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col h-full"
                  >
                    {/* Header */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02] gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {/* Mobile Back Button (Apple iOS style < md) */}
                        <button
                          type="button"
                          onClick={() => setMobileView('list')}
                          className="md:hidden flex items-center gap-0.5 text-[#0071E3] dark:text-sky-400 text-xs font-semibold px-2 py-1 -ml-1 rounded-lg hover:bg-blue-500/10 active:scale-95 transition-all shrink-0 cursor-pointer"
                          aria-label="Back to scraper feed list"
                        >
                          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                          <span>Feed</span>
                        </button>

                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${getAvatarColor(
                            selectedPost.author
                          )} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ring-1 ring-black/5 dark:ring-white/10`}
                        >
                          {selectedPost.avatar || (selectedPost.author ? selectedPost.author.charAt(0).toUpperCase() : "U")}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight truncate">
                            {selectedPost.author}
                          </h3>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                              {getSourceIcon(selectedPost.source)}
                              {selectedPost.source}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3 text-slate-400" strokeWidth={1.75} />
                              <span className="tabular-nums">{selectedPost.timestamp}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {renderUrgencyBadge(selectedPost.urgency)}
                        {renderStatusBadge(selectedPost.status)}
                      </div>
                    </div>

                    {/* Body */}
                    <div
                      className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50/40 dark:bg-[#0B0F17]/40 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                      style={{
                        maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                      }}
                    >
                      <StaggerContainer className="space-y-4 sm:space-y-5">
                        {/* STRUCTURED VIEW: Highlight Extracted Entities First */}
                        {viewMode === "structured" ? (
                          <>
                            {/* Extracted Entities Grid */}
                            <StaggerItem>
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                  <Brain className="w-3.5 h-3.5 text-purple-500" strokeWidth={1.75} />
                                  <span>Extracted Incident Details</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-[#0071E3] dark:text-sky-400 flex items-center justify-center border border-blue-500/20">
                                        <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
                                      </div>
                                      <span>Extracted Location</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white break-words mt-1">
                                      {selectedPost.extractedEntities.location}
                                    </p>
                                  </div>

                                  <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                                        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                                      </div>
                                      <span>Incident Category</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white break-words mt-1">
                                      {selectedPost.type}
                                    </p>
                                  </div>

                                  <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                                        <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                                      </div>
                                      <span>Detected Intent</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white break-words mt-1">
                                      {selectedPost.intent || 'Other'}
                                    </p>
                                  </div>

                                  {selectedPost.extractedEntities.contact && (
                                    <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                                          <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                                        </div>
                                        <span>Emergency Contact</span>
                                      </div>
                                      <p className="text-sm font-bold text-slate-900 dark:text-white font-mono break-words mt-1">
                                        {selectedPost.extractedEntities.contact}
                                      </p>
                                    </div>
                                  )}

                                  {selectedPost.extractedEntities.peopleAffected ? (
                                    <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                        <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                                          <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                                        </div>
                                        <span>Estimated Victims / Affected</span>
                                      </div>
                                      <p className="text-sm font-bold text-slate-900 dark:text-white break-words mt-1">
                                        {selectedPost.extractedEntities.peopleAffected} persons
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </StaggerItem>

                            {/* Extracted Needs Pills */}
                            {selectedPost.extractedEntities.needs && selectedPost.extractedEntities.needs.length > 0 && (
                              <StaggerItem>
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                                    Urgent Resources &amp; Needs Detected
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedPost.extractedEntities.needs.map((need, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                      >
                                        <AlertTriangle className="w-3 h-3" strokeWidth={1.75} />
                                        <span>{need}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </StaggerItem>
                            )}

                            {/* Original Source Quote */}
                            <StaggerItem>
                              <div>
                                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                  Raw Post Source Reference
                                </h4>
                                <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed italic break-words">
                                    &ldquo;{selectedPost.rawText}&rdquo;
                                  </p>
                                </div>
                              </div>
                            </StaggerItem>
                          </>
                        ) : (
                          /* RAW UNSTRUCTURED VIEW: Raw stream audit & technical details */
                          <>
                            {/* Raw Stream Post Box */}
                            <StaggerItem>
                              <div>
                                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                  Raw Unstructured Scraped Text
                                </h4>
                                <div className="bg-white/90 dark:bg-[#111827]/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans break-words">
                                    {selectedPost.rawText}
                                  </p>
                                </div>
                              </div>
                            </StaggerItem>

                            {/* Raw Technical Payload Inspection */}
                            <StaggerItem>
                              <div>
                                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                  Raw Ingestion Metadata
                                </h4>
                                <div className="bg-slate-100/90 dark:bg-[#0B0F17]/90 rounded-2xl p-3.5 sm:p-4 border border-slate-200/70 dark:border-white/10 font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 overflow-x-auto">
                                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                                    <span className="text-slate-400 dark:text-slate-500">entry_id:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{selectedPost.id}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                                    <span className="text-slate-400 dark:text-slate-500">author:</span>
                                    <span>{selectedPost.author}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                                    <span className="text-slate-400 dark:text-slate-500">source_platform:</span>
                                    <span>{selectedPost.source}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                                    <span className="text-slate-400 dark:text-slate-500">barangay_parsed:</span>
                                    <span>{selectedPost.barangay}</span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-slate-400 dark:text-slate-500">status:</span>
                                    <span>{selectedPost.status}</span>
                                  </div>
                                </div>
                              </div>
                            </StaggerItem>
                          </>
                        )}
                      </StaggerContainer>
                    </div>

                    {/* Action Bar */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02] shrink-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {viewMode === "structured" && (
                          <button
                            type="button"
                            onClick={() => togglePostIncidentOverride(selectedPost.id)}
                            className="px-3 py-2 min-h-[38px] sm:min-h-[40px] bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl active:scale-[0.97] transition-all cursor-pointer border border-slate-200/60 dark:border-white/5"
                          >
                            Demote to Noise
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedPost.status !== "Verified" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(selectedPost.id, "Verified")}
                            className="px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[38px] sm:min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs active:scale-[0.97] transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Verify Incident</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(selectedPost.id, "Resolved")}
                          className="px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[38px] sm:min-h-[40px] bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 text-xs font-semibold rounded-xl flex items-center gap-2 active:scale-[0.97] transition-all cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Dismiss / Resolve</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 flex flex-col items-center justify-center p-8 text-center"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-inner">
                      <Radio className="w-7 h-7 stroke-[1.5]" />
                    </div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                      No Comment Selected
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[260px] mt-1">
                      Select a scraped comment from the feed stream to inspect NLP extraction and triage details.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
