import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Filter, Globe, MessageCircle, AlertTriangle, MapPin, Clock,
  CheckCircle, XCircle, Brain, Users, ExternalLink,
  Loader2, Radio, X,
} from "lucide-react";
import DatePicker from "../components/DatePicker";
import FilterDropdown from "../components/DropDown";
import { StaggerContainer, StaggerItem } from "../components/Stagger";
import { supabase } from "../lib/supabaseClient";
import PageLoader from "../components/PageLoader";

interface ScrapedPost {
  id: string;
  source: "Facebook Page" | "Facebook Comment" | "Group Post";
  author: string;
  avatar: string;
  rawText: string;
  barangay: string;
  type: "Search & Rescue" | "Medical" | "Food & Water" | "Infrastructure";
  urgency: "High" | "Moderate" | "Low";
  status: "New" | "Verified" | "Flagged" | "Resolved";
  timestamp: string;
  confidence: number;
  extractedEntities: {
    location: string;
    contact?: string;
    peopleAffected?: number;
    needs?: string[];
  };
}

// -- Toast Type --
interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

// -- Apple Design Spring Physics & Motion --
const APPLE_SPRING = { type: "spring", stiffness: 400, damping: 32 } as const;

const contentVariants: Variants = {
  hidden: { opacity: 0, x: 12, scale: 0.99 },
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

// -- Apple Notification Toast Component --
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === "success"
    ? <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
    : toast.type === "error"
      ? <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
      : <Loader2 className="w-4 h-4 text-[#0071E3] dark:text-blue-400 animate-spin" />;

  const badgeBg = toast.type === "success"
    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-500/20"
    : toast.type === "error"
      ? "bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-500/20"
      : "bg-blue-50 dark:bg-blue-950/40 text-[#0071E3] border border-blue-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-2xl bg-white/90 dark:bg-[#1C2433]/90 border border-slate-200/80 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-t border-t-white/80 dark:border-t-white/20 min-w-[300px] max-w-[400px]"
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

// ── Heuristic: map DB incident_type + text to UI type ──
function inferType(incidentType: string, text: string): ScrapedPost["type"] {
  const t = (incidentType || "").toLowerCase();
  const txt = (text || "").toLowerCase();

  if (t === "casualty" || t === "medical" || txt.includes("sugat") || txt.includes("ospital") || txt.includes("ambulansya") || txt.includes("medic") || txt.includes("nabalian") || txt.includes("nasaktan")) return "Medical";
  if (t === "evacuation" || txt.includes("evacuate") || txt.includes("stranded") || txt.includes("nakaipit") || txt.includes("natabunan") || txt.includes("rescue")) return "Search & Rescue";
  if (t === "flood" || t === "landslide" || t === "earthquake" || t === "fire" || txt.includes("gumuhong") || txt.includes("bumagsak") || txt.includes("putol") || txt.includes("poste") || txt.includes("kuryente")) return "Infrastructure";
  if (txt.includes("food") || txt.includes("tubig") || txt.includes("relief") || txt.includes("gatas") || txt.includes("gamot") || txt.includes("supply")) return "Food & Water";

  return "Medical"; // default
}

// ── Heuristic: derive urgency from incident_type + text ──
function inferUrgency(incidentType: string, text: string): ScrapedPost["urgency"] {
  const t = (incidentType || "").toLowerCase();
  const txt = (text || "").toLowerCase();

  const highKeywords = ["emergency", "casualty", "fire", "now", "asap", "urgent", "naipit", "natabunan", "patay", "matanda", "bata", "nawawala"];
  const moderateKeywords = ["flood", "evacuation", "landslide", "earthquake", "baha", "gumuhong", "tumumba", "putol"];

  if (highKeywords.some(k => t.includes(k) || txt.includes(k))) return "High";
  if (moderateKeywords.some(k => t.includes(k) || txt.includes(k))) return "Moderate";
  return "Low";
}

// ── Format Supabase timestamp → "M/D HH:mm" ──
function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return `${d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export default function ScraperFeed() {
  const [posts, setPosts] = useState<ScrapedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [activeTable, setActiveTable] = useState<string>("fb_comments");
  const [discoveredTables, setDiscoveredTables] = useState<string[]>([]);

  // Filter states
  const [filterBarangay, setFilterBarangay] = useState("All Barangays");
  const [filterType, setFilterType] = useState("All Types");
  const [filterUrgency, setFilterUrgency] = useState("All Urgency");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
      const confidence = typeof row.confidence === "number" ? row.confidence : 0;
      const status = row.status || "New";

      const extractedEntities = row.extracted_entities || row.extractedEntities || {
        location: barangay !== "Unknown" ? barangay : "Unknown",
        needs: row.needs ? (Array.isArray(row.needs) ? row.needs : [row.needs]) : []
      };

      return {
        id: String(idVal),
        source: source as ScrapedPost["source"],
        author: userName,
        avatar: userName.charAt(0).toUpperCase(),
        rawText: text,
        barangay,
        type: inferType(row.incident_type || row.type, text),
        urgency: inferUrgency(row.incident_type || row.type, text),
        status: status as ScrapedPost["status"],
        timestamp: formatTimestamp(row.created_at || row.timestamp),
        confidence,
        extractedEntities: {
          location: extractedEntities.location || (barangay !== "Unknown" ? barangay : "Unknown"),
          contact: row.contact || row.contact_number || extractedEntities.contact,
          peopleAffected: row.people_affected || row.peopleAffected || extractedEntities.peopleAffected,
          needs: Array.isArray(extractedEntities.needs) ? extractedEntities.needs : [],
        },
      };
    });

    setPosts(mapped);
    if (mapped.length > 0) setSelectedId(mapped[0].id);
    setLoading(false);

    if (!hasShownInitialToast.current) {
      hasShownInitialToast.current = true;
      showToast(`${mapped.length} scraped posts loaded`, "success");
    }
  };

  // -- Fetch from Supabase with self-healing table detection --
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);

      try {
        let tableName = "fb_comments";
        let availableTables: string[] = [];

        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
            headers: {
              "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            }
          });
          if (res.ok) {
            const schema = await res.json();
            const paths = Object.keys(schema.paths || {});
            availableTables = paths
              .map(p => p.replace(/^\//, ""))
              .filter(name => name && name !== "rpc");

            setDiscoveredTables(availableTables);
            console.log("[ScraperFeed] Discovered Supabase tables:", availableTables);

            const candidates = ["fb_comments", "comments", "scraped_comments", "facebook_comments", "scraper_feed", "scraped_posts", "posts"];
            const found = candidates.find(c => availableTables.includes(c)) ||
              availableTables.find(t => t.includes("comment") || t.includes("scraper") || t.includes("scraped") || t.includes("fb"));

            if (found) {
              tableName = found;
              console.log("[ScraperFeed] Selected active table:", tableName);
            }
          }
        } catch (schemaErr) {
          console.warn("[ScraperFeed] Could not list database tables via OpenAPI:", schemaErr);
        }

        const { data, error: sbError } = await supabase
          .from(tableName)
          .select("*")
          .limit(100);

        if (sbError) {
          console.error(`[ScraperFeed] Failed to fetch from "${tableName}":`, sbError.message);
          showToast(`Failed to load: ${sbError.message}`, "error");

          let fallbackData: any[] | null = null;
          let fallbackError: string | null = sbError.message;

          if (availableTables.length === 0) {
            const fallbacks = ["comments", "facebook_comments", "scraped_posts", "posts"].filter(f => f !== tableName);
            for (const fbTable of fallbacks) {
              const { data: fbData, error: fbErr } = await supabase
                .from(fbTable)
                .select("*")
                .limit(100);

              if (!fbErr) {
                fallbackData = fbData;
                tableName = fbTable;
                fallbackError = null;
                break;
              }
            }
          }

          if (fallbackError) {
            setError(`${sbError.message} (Attempted table: "${tableName}"${availableTables.length > 0 ? `. Discovered tables: ${availableTables.join(", ")}` : ""})`);
            setLoading(false);
          } else {
            setActiveTable(tableName);
            processData(fallbackData, tableName);
          }
        } else {
          setActiveTable(tableName);
          processData(data, tableName);
        }
      } catch (err: any) {
        console.error("[ScraperFeed] Fetch error:", err);
        setError(err.message || "An unexpected error occurred");
        showToast(err.message || "An unexpected error occurred", "error");
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const handleUpdateStatus = async (postId: string, newStatus: ScrapedPost["status"]) => {
    const prevStatus = posts.find(p => p.id === postId)?.status;

    // Optimistically update status locally
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p))
    );

    try {
      const { error: updateError } = await supabase
        .from(activeTable)
        .update({ status: newStatus })
        .eq("id", postId);

      if (updateError) {
        console.error(`[ScraperFeed] Failed to update status in Supabase table "${activeTable}":`, updateError.message);
        showToast(`Update failed: ${updateError.message}`, "error");
        // Revert on error
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, status: prevStatus || p.status } : p))
        );
      } else {
        showToast(`Post marked as ${newStatus.toLowerCase()}`, "success");
      }
    } catch (err: any) {
      console.error("[ScraperFeed] Status update error:", err);
      showToast(`Update failed: ${err.message}`, "error");
      // Revert on error
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, status: prevStatus || p.status } : p))
      );
    }
  };

  // Filter logic
  const filteredPosts = posts.filter((p) => {
    if (filterBarangay !== "All Barangays" && p.barangay !== filterBarangay) return false;
    if (filterType !== "All Types" && p.type !== filterType) return false;
    if (filterUrgency !== "All Urgency" && p.urgency !== filterUrgency) return false;
    if (filterStatus !== "All Status" && p.status !== filterStatus) return false;
    return true;
  });

  const selectedPost = filteredPosts.find((p) => p.id === selectedId) || filteredPosts[0];

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

  const renderUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "High":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            High
          </span>
        );
      case "Moderate":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Moderate
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Low
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
            {urgency}
          </span>
        );
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "New":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse" />
            New
          </span>
        );
      case "Verified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified
          </span>
        );
      case "Flagged":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Flagged
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
            {status}
          </span>
        );
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Facebook Page": return <ExternalLink className="w-3 h-3 text-blue-500" />;
      case "Facebook Comment": return <MessageCircle className="w-3 h-3 text-[#0071E3]" />;
      case "Group Post": return <Users className="w-3 h-3 text-emerald-500" />;
      default: return <Globe className="w-3 h-3 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col relative">
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

      {/* Skeleton — shown on first load, replaced by real content */}
      {loading && <PageLoader variant="scraper" />}

      {/* Error State */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 max-w-md text-center">
            <AlertTriangle className="w-8 h-8" />
            <p className="font-semibold text-sm">Failed to load scraped posts</p>
            <p className="text-xs text-red-400 font-mono">{error}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check your Supabase credentials and RLS policies.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <>
          {/* Filters Bar — Frosted Glass with Specular Edge */}
          <div className="relative z-30 backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] border-t border-t-white/80 dark:border-t-white/10 p-4 transition-all">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                  <Filter className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span>Filters</span>
                </div>

                <FilterDropdown
                  value={filterBarangay}
                  options={[
                    "All Barangays", "Leynes", "Poblacion", "Sampaloc",
                    "Cawit", "Banga", "San Isidro", "Miranda", "Aya",
                    "Tranca", "Tumaway", "Caloocan", "Buco", "Balas",
                    "Quiling", "Laurel", "Sta. Maria", "Ayala",
                  ]}
                  onChange={(val) => { setFilterBarangay(val); setSelectedId(""); }}
                />

                <FilterDropdown
                  value={filterType}
                  options={["All Types", "Search & Rescue", "Medical", "Food & Water", "Infrastructure"]}
                  onChange={(val) => { setFilterType(val); setSelectedId(""); }}
                />

                <FilterDropdown
                  value={filterUrgency}
                  options={["All Urgency", "High", "Moderate", "Low"]}
                  onChange={(val) => { setFilterUrgency(val); setSelectedId(""); }}
                />

                <FilterDropdown
                  value={filterStatus}
                  options={["All Status", "New", "Verified", "Flagged", "Resolved"]}
                  onChange={(val) => { setFilterStatus(val); setSelectedId(""); }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 xl:ml-auto w-full xl:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">From:</span>
                  <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">To:</span>
                  <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
            {/* LEFT: Post List — macOS Feed Sidebar Style */}
            <div className="lg:col-span-5 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col overflow-hidden min-h-[340px] lg:min-h-0">
              <div className="px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/15">
                    <Radio className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base tracking-tight">
                    Scraped Posts
                  </h3>
                </div>
                <span className="bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full px-2.5 py-0.5 tabular-nums">
                  {filteredPosts.length} posts
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
                {filteredPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-400 dark:text-slate-500 text-sm gap-3">
                    <Radio className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                    <span className="font-medium text-slate-600 dark:text-slate-400">No scraped posts found.</span>
                    <div className="w-full text-xs bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-left font-mono mt-2 space-y-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
                        Database Query Diagnostics
                      </p>
                      <p>
                        <span className="text-slate-500">Queried Table:</span>{" "}
                        <span className="text-blue-500 font-semibold bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                          "{activeTable}"
                        </span>
                      </p>
                      {discoveredTables.length > 0 ? (
                        <div>
                          <span className="text-slate-500">All Database Tables:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {discoveredTables.map(t => (
                              <span key={t} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No schema tables discovered. Make sure your Supabase anon key permits reading the Postgrest API schema.</p>
                      )}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal pt-2 border-t border-slate-100 dark:border-slate-800">
                        * Note: If the queried table exists but this screen is blank, the database table may have 0 rows.
                      </p>
                    </div>
                  </div>
                ) : (
                  <StaggerContainer className="space-y-1">
                    {filteredPosts.map((post) => {
                      const isSelected = selectedId === post.id;
                      return (
                        <StaggerItem key={post.id} className="w-full">
                          <button
                            type="button"
                            onClick={() => setSelectedId(post.id)}
                            className={`w-full text-left p-3 rounded-xl transition-all duration-150 relative group active:scale-[0.98] ${isSelected
                                ? "bg-blue-500/10 dark:bg-blue-500/20 shadow-xs border border-blue-500/25 dark:border-blue-500/30 text-slate-900 dark:text-white"
                                : "hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent text-slate-700 dark:text-slate-300"
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

                            <div className="flex items-start gap-3 pl-1">
                              <div
                                className={`w-9 h-9 rounded-full ${getAvatarColor(
                                  post.author
                                )} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm ring-2 ring-white/80 dark:ring-slate-800`}
                              >
                                {post.avatar || (post.author ? post.author.charAt(0).toUpperCase() : "U")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {post.author}
                                  </span>
                                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap ml-2">
                                    {post.timestamp}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/40 dark:border-slate-700/40">
                                    {getSourceIcon(post.source)}
                                    {post.source}
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-600 text-[10px]">•</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    {post.barangay}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2 leading-relaxed">
                                  {post.rawText}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {renderUrgencyBadge(post.urgency)}
                                  {renderStatusBadge(post.status)}
                                  {post.confidence > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                                      <Brain className="w-3 h-3" />
                                      {post.confidence}%
                                    </span>
                                  )}
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
            </div>

            {/* RIGHT: Post Detail — macOS Inspector Style */}
            <div className="lg:col-span-7 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col overflow-hidden min-h-[440px] lg:min-h-0">
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
                    <div className="px-6 py-4.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-start justify-between shrink-0 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${getAvatarColor(
                            selectedPost.author
                          )} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm ring-2 ring-white/80 dark:ring-slate-800`}
                        >
                          {selectedPost.avatar || (selectedPost.author ? selectedPost.author.charAt(0).toUpperCase() : "U")}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white text-base tracking-tight">
                            {selectedPost.author}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              {getSourceIcon(selectedPost.source)}
                              {selectedPost.source}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="tabular-nums">{selectedPost.timestamp}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {renderUrgencyBadge(selectedPost.urgency)}
                        {renderStatusBadge(selectedPost.status)}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5 bg-slate-50/40 dark:bg-[#0B0F17]/40">
                      <StaggerContainer className="space-y-5">
                        {/* Original Post Card */}
                        <StaggerItem>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                              Original Scraped Post
                            </h4>
                            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-700/70 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed italic">
                                &ldquo;{selectedPost.rawText}&rdquo;
                              </p>
                            </div>
                          </div>
                        </StaggerItem>

                        {/* NLP Extraction */}
                        <StaggerItem>
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                                <Brain className="w-4 h-4" />
                              </div>
                              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                NLP AI Extraction
                              </h4>
                              {selectedPost.confidence > 0 && (
                                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-0.5 ml-auto">
                                  Confidence: {selectedPost.confidence}%
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <MapPin className="w-3.5 h-3.5" />
                                  </div>
                                  <span>Detected Location</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 pl-8">
                                  {selectedPost.extractedEntities.location}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </div>
                                  <span>Incident Category</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 pl-8">
                                  {selectedPost.type}
                                </p>
                              </div>
                            </div>
                          </div>
                        </StaggerItem>
                      </StaggerContainer>
                    </div>

                    {/* Action Bar */}
                    <div className="px-6 py-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md shrink-0 flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPost.id, "Verified")}
                        className="px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center gap-2 active:scale-[0.97] transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPost.id, "Flagged")}
                        className="px-4 py-2.5 bg-orange-500/10 hover:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-semibold rounded-xl flex items-center gap-2 active:scale-[0.97] transition-all"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Flag
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPost.id, "Resolved")}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold rounded-xl flex items-center gap-2 ml-auto active:scale-[0.97] transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
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
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-inner">
                      <Radio className="w-8 h-8 stroke-[1.5]" />
                    </div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                      No Post Selected
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[260px] mt-1">
                      Select a scraped post from the feed stream to inspect NLP extraction and verify incidents.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </div>
  );
}