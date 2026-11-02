import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Filter, AlertCircle, X, Minus, CheckCircle2, RefreshCw, MessageSquare,
  ChevronRight, ChevronLeft, ChevronDown, Bot, RotateCcw,
  Layers, AlertTriangle, ArrowUp, ArrowDown
} from "lucide-react";
import DatePicker from "../components/DatePicker";
import FilterDropdown from "../components/DropDown";
import PageLoader from "../components/PageLoader";
import { StaggerContainer, StaggerItem } from "../components/Stagger";
import { useBotConversations, type BotConversation as Conversation } from "../context/BotConversationsContext";
import { TALISAY_BARANGAYS } from "../data/talisay-barangays";
import { extractDisplayTime, formatPhilippineTimeOnly, formatPhilippineDateOnly } from "../utils/dateUtils";
import { BASE_INCIDENT_TYPES, formatReportUrgency } from "../services/incidentService";
import { useDebounce } from "../hooks/useDebounce";

// Canonical incident type choices matching Responde Talisay taxonomy
export const INCIDENT_TYPE_CHOICES = [
  "General",
  "Flood",
  "Volcanic Eruption",
  "Typhoon",
  "Landslide",
  "Fire",
  "Earthquake",
] as const;

// -- NLP Analysis for Messenger Conversations --
export interface ConvoNLPAnalysis {
  isIncident: boolean;
  confidence: number;
  nlpCategory: "Incident" | "Inquiry / Chatter";
  incidentType: string;
  urgency: "Critical" | "High" | "Moderate" | "Low";
  nlpReason: string;
  actionableNeeds: string[];
  extractedLocation: string;
  distressMessageIdx: number;
  distressMessageIndices: number[];
}

export type AnalyzedConversation = Conversation & {
  nlp: ConvoNLPAnalysis;
};

export function analyzeConvoNLP(convo: Conversation): ConvoNLPAnalysis {
  const allUserText = (convo.messages || [])
    .filter((m) => m.sender === "user")
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();

  const typeLower = (convo.type || "").toLowerCase();

  const highKeywords = [
    "saklolo", "rescue", "baha", "nasira", "bubong", "ambulance", "sugat",
    "emergency", "pagguho", "landslide", "tulong", "naipit", "naanod", "nabalian", "sunog", "apoy"
  ];
  const moderateKeywords = [
    "tubig", "supply", "puno", "kalsada", "daan", "poste", "interruption",
    "first aid", "gamot", "food", "pagkain", "evacuate", "lumikas"
  ];
  const noiseKeywords = [
    "may baha po ba", "may kuryente po ba", "saan po ang", "ano po hotline",
    "bukas po ba", "good morning", "magandang", "hello", "hi po", "salamat", "thank you", "test", "ingat"
  ];

  const hasHigh = highKeywords.some((k) => allUserText.includes(k));
  const hasModerate = moderateKeywords.some((k) => allUserText.includes(k));
  const isExplicitNoise = noiseKeywords.some((k) => allUserText.includes(k)) && !hasHigh;

  let incidentType = "General";
  if (allUserText.includes("bulkan") || allUserText.includes("volcan") || allUserText.includes("ash") || allUserText.includes("abo") || typeLower.includes("volcan")) {
    incidentType = "Volcanic Eruption";
  } else if (allUserText.includes("baha") || allUserText.includes("flood") || allUserText.includes("lubog") || allUserText.includes("anod") || typeLower.includes("flood")) {
    incidentType = "Flood";
  } else if (allUserText.includes("bagyo") || allUserText.includes("typhoon") || allUserText.includes("hangin") || typeLower.includes("typhoon")) {
    incidentType = "Typhoon";
  } else if (allUserText.includes("landslide") || allUserText.includes("pagguho") || allUserText.includes("guho") || typeLower.includes("landslide")) {
    incidentType = "Landslide";
  } else if (allUserText.includes("sunog") || allUserText.includes("apoy") || allUserText.includes("fire") || typeLower.includes("fire")) {
    incidentType = "Fire";
  } else if (allUserText.includes("lindol") || allUserText.includes("earthquake") || allUserText.includes("yanig") || typeLower.includes("earthquake") || typeLower.includes("quake")) {
    incidentType = "Earthquake";
  } else if (convo.type && convo.type.toLowerCase() !== "none") {
    const matched = INCIDENT_TYPE_CHOICES.find((c) => c.toLowerCase() === convo.type.toLowerCase());
    incidentType = matched || convo.type;
  }

  const actionableNeeds: string[] = [];
  if (allUserText.includes("ambulance") || allUserText.includes("sugat")) actionableNeeds.push("Ambulance & Paramedics");
  if (allUserText.includes("first aid")) actionableNeeds.push("First Aid Supplies");
  if (allUserText.includes("rescue") || allUserText.includes("boat")) actionableNeeds.push("Rescue Boat Unit");
  if (allUserText.includes("bubong")) actionableNeeds.push("Shelter Repair Kit");
  if (allUserText.includes("puno") || allUserText.includes("daan")) actionableNeeds.push("Road Clearing Crew");
  if (allUserText.includes("tubig")) actionableNeeds.push("Potable Drinking Water");
  if (allUserText.includes("pagguho") || allUserText.includes("landslide")) actionableNeeds.push("Evacuation Assistance");
  if (actionableNeeds.length === 0 && (hasHigh || hasModerate)) {
    actionableNeeds.push("On-Site Verification");
  }

  const distressMessageIndices: number[] = [];
  (convo.messages || []).forEach((m, idx) => {
    if (m.sender === "user") {
      const text = m.text.toLowerCase();
      const isDistress =
        highKeywords.some((k) => text.includes(k)) ||
        moderateKeywords.some((k) => text.includes(k));
      if (isDistress) {
        distressMessageIndices.push(idx);
      }
    }
  });

  const distressMessageIdx = distressMessageIndices.length > 0 ? distressMessageIndices[0] : -1;

  const criticalKeywords = ["critical", "trapped", "dying", "saklolo", "tulong", "buhay", "delikado", "lubog", "nasusunog", "evacuate now"];
  const hasCritical = criticalKeywords.some((k) => allUserText.includes(k)) || (convo.urgency || "").toLowerCase().includes("critical");
  const isIncident = (hasCritical || hasHigh || hasModerate || typeLower === "emergency" || typeLower === "medical" || typeLower === "search & rescue") && !isExplicitNoise;
  const urgency: "Critical" | "High" | "Moderate" | "Low" = hasCritical
    ? "Critical"
    : convo.urgency
      ? (formatReportUrgency(convo.urgency) as "Critical" | "High" | "Moderate" | "Low")
      : (hasHigh ? "High" : hasModerate ? "Moderate" : "Low");
  const confidence = isIncident ? (hasCritical ? 98 : (hasHigh ? 96 : 89)) : 18;

  let nlpReason = "";
  if (isIncident) {
    nlpReason = hasHigh
      ? "Distress intent detected: critical emergency event requiring immediate dispatch of rescue or medical responders."
      : "Community hazard or relief request detected requiring municipal response.";
  } else {
    nlpReason = "Routine informational inquiry / FAQ chat exchange without actionable emergency incident.";
  }

  return {
    isIncident,
    confidence,
    nlpCategory: isIncident ? "Incident" : "Inquiry / Chatter",
    incidentType,
    urgency,
    nlpReason,
    actionableNeeds,
    extractedLocation: convo.barangay || "Talisay",
    distressMessageIdx,
    distressMessageIndices,
  };
}

// -- Helpers for Avatar and Message Previews --
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

function getLastMessage(convo: Conversation): string {
  if (!convo.messages || convo.messages.length === 0) return "No messages yet";
  const userMsg = [...convo.messages].reverse().find((m) => m.sender === "user");
  return userMsg ? userMsg.text : convo.messages[convo.messages.length - 1].text;
}

function formatDisplayTime(timeStr: string): string {
  return extractDisplayTime(timeStr);
}

function formatMsgDate(timestamp?: string, convoTime?: string): string {
  if (timestamp) {
    const formatted = formatPhilippineDateOnly(timestamp);
    if (formatted) return formatted;
  }
  if (convoTime) {
    const formatted = formatPhilippineDateOnly(convoTime);
    if (formatted) return formatted;
    const m = convoTime.match(/^(\d{1,2})\/(\d{1,2})/);
    if (m) {
      const year = new Date().getFullYear();
      const d = new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
      if (!isNaN(d.getTime())) {
        return formatPhilippineDateOnly(d);
      }
    }
  }
  return '';
}

function formatMsgTime(timestamp?: string, convoTime?: string): string {
  if (timestamp) {
    const formatted = formatPhilippineTimeOnly(timestamp);
    if (formatted) return formatted;
    const extracted = extractDisplayTime(timestamp);
    if (extracted) return extracted;
  }
  if (convoTime) {
    const extracted = extractDisplayTime(convoTime);
    if (extracted) return extracted;
    const formatted = formatPhilippineTimeOnly(convoTime);
    if (formatted) return formatted;
  }
  return '3:07 AM';
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
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

// -- Apple Notification Toast Component --
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === "success"
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
    : toast.type === "error"
      ? <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
      : <RefreshCw className="w-4 h-4 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />;

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
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.92] transition-all cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export default function MessengerBotLogs() {
  const {
    conversations,
    updateConversationStatus: setContextStatus,
    loading,
    error,
    refetchConversations,
  } = useBotConversations();

  // Structured (NLP Incident Reports only) vs Unstructured (Raw Chat Logs)
  const [viewMode, setViewMode] = useState<"structured" | "unstructured">(() => {
    try {
      return (localStorage.getItem("responde_messenger_view_mode") as any) || "structured";
    } catch {
      return "structured";
    }
  });

  const handleViewModeChange = (mode: "structured" | "unstructured") => {
    setViewMode(mode);
    try {
      localStorage.setItem("responde_messenger_view_mode", mode);
    } catch {}
  };

  const [selectedId, setSelectedId] = useState<string>("");
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("All Barangays");
  const [filterType, setFilterType] = useState("All Types");
  const [filterUrgency, setFilterUrgency] = useState("All Urgency");
  const [filterStatus, setFilterStatus] = useState("All Status");

  // Pagination state (20 conversations per page)
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
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [highlightedDistressIdx, setHighlightedDistressIdx] = useState<number | null>(null);
  const preferredDirectionRef = useRef<'up' | 'down'>('up');
  const [distressNav, setDistressNav] = useState<{
    show: boolean;
    direction: 'up' | 'down';
    targetIdx: number;
    total: number;
    currentNumber: number;
    hasAbove: boolean;
    hasBelow: boolean;
    prevTargetIdx: number;
    nextTargetIdx: number;
    firstDistressIdx: number;
    canScrollUp: boolean;
  }>({
    show: false,
    direction: 'up',
    targetIdx: -1,
    total: 0,
    currentNumber: 0,
    hasAbove: false,
    hasBelow: false,
    prevTargetIdx: -1,
    nextTargetIdx: -1,
    firstDistressIdx: -1,
    canScrollUp: false,
  });

  // Track seen conversations (persisted in localStorage)
  const [seenConvoIds, setSeenConvoIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('responde_seen_messenger_convos');
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const markConvoSeen = (id: string) => {
    if (!id) return;
    setSeenConvoIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('responde_seen_messenger_convos', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllSeen = () => {
    const allIds = new Set(conversations.map((c) => c.id));
    setSeenConvoIds(allIds);
    try {
      localStorage.setItem('responde_seen_messenger_convos', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  // Attach NLP analysis to conversations
  const analyzedConversations: AnalyzedConversation[] = useMemo(() => {
    return conversations.map((c) => {
      const baseNLP = analyzeConvoNLP(c);
      return {
        ...c,
        nlp: baseNLP,
      };
    });
  }, [conversations]);

  const incidentCount = useMemo(() => analyzedConversations.filter(c => c.nlp.isIncident).length, [analyzedConversations]);
  const rawCount = analyzedConversations.length;

  const unseenCount = useMemo(() => {
    return analyzedConversations.filter((c) => {
      if (viewMode === "structured" && !c.nlp.isIncident) return false;
      return !seenConvoIds.has(c.id);
    }).length;
  }, [analyzedConversations, viewMode, seenConvoIds]);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    markConvoSeen(id);
    setMobileView('chat');
  };

  const handleCloseConversation = useCallback(() => {
    setSelectedId("");
    setMobileView('list');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId) {
        handleCloseConversation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, handleCloseConversation]);

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

  const updateConversationStatus = (id: string, newStatus: "Incomplete" | "Complete", silent = false) => {
    setContextStatus(id, newStatus);
    if (!silent) {
      const target = conversations.find((c) => c.id === id);
      const name = target?.name || "Conversation";
      showToast(
        `Marked ${name} as ${newStatus}`,
        newStatus === "Complete" ? "success" : "info"
      );
    }
  };

  const activeFilterCount =
    (filterBarangay !== "All Barangays" ? 1 : 0) +
    (filterType !== "All Types" ? 1 : 0) +
    (filterUrgency !== "All Urgency" ? 1 : 0) +
    (filterStatus !== "All Status" ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const availableBarangays = useMemo(() => {
    const fromConversations = conversations
      .map((c) => c.barangay)
      .filter((b): b is string => Boolean(b && !['all barangays', 'none', 'unknown', 'general', 'unspecified', 'n/a', 'null'].includes(b.toLowerCase().trim())));
    const sorted = Array.from(new Set([...TALISAY_BARANGAYS, ...fromConversations])).sort();
    return ["All Barangays", "None", "Unknown", ...sorted];
  }, [conversations]);

  const availableTypes = useMemo(() => {
    const fromConversations = conversations.map((c) => c.type).filter(Boolean);
    const sorted = Array.from(new Set([...BASE_INCIDENT_TYPES, ...fromConversations]))
      .filter((t): t is string => Boolean(t && t.toLowerCase() !== 'all types' && t.toLowerCase() !== 'unclassified' && t.toLowerCase() !== 'none'))
      .sort();
    return ["All Types", "None", ...sorted];
  }, [conversations]);

  const resetFilters = () => {
    setFilterBarangay("All Barangays");
    setFilterType("All Types");
    setFilterUrgency("All Urgency");
    setFilterStatus("All Status");
    setFromDate("");
    setToDate("");
    setSelectedId("");
    setCurrentPage(1);
  };

  const getConvoDateString = (c: Conversation): string | null => {
    if (c.createdAt) {
      try {
        const d = new Date(c.createdAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {}
    }
    if (c.messages && c.messages.length > 0) {
      for (let i = c.messages.length - 1; i >= 0; i--) {
        const ts = c.messages[i].timestamp;
        if (ts) {
          try {
            const d = new Date(ts);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
          } catch {}
        }
      }
    }
    if (c.time) {
      if (c.time.includes('-')) {
        const p = c.time.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
      }
      const parts = c.time.split(' ')[0].split('/');
      if (parts.length === 2) {
        const mm = parts[0].padStart(2, '0');
        const dd = parts[1].padStart(2, '0');
        const yyyy = new Date().getFullYear();
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return null;
  };

  const filteredConversations = useMemo(() => {
    return analyzedConversations.filter((c) => {
      if (viewMode === "structured" && !c.nlp.isIncident) return false;
      if (debouncedBarangay !== "All Barangays") {
        const normFilter = debouncedBarangay.toLowerCase().trim();
        const cBarangay = (c.barangay || "").toLowerCase().trim();
        if (normFilter === "none" || normFilter === "unknown") {
          if (cBarangay && cBarangay !== "none" && cBarangay !== "unknown" && cBarangay !== "general" && cBarangay !== "unspecified" && cBarangay !== "n/a" && cBarangay !== "null") {
            return false;
          }
        } else if (cBarangay !== normFilter) {
          return false;
        }
      }
      if (debouncedType !== "All Types") {
        const query = debouncedType.toLowerCase().trim();
        const cType = (c.type || "").toLowerCase().trim();
        const nlpType = (c.nlp?.incidentType || "").toLowerCase().trim();
        if (query === "none") {
          const isNone = (!cType || cType === "none" || cType === "unclassified" || cType === "null") && (!nlpType || nlpType === "none" || nlpType === "unclassified" || nlpType === "null");
          if (!isNone) return false;
        } else {
          const matches = cType === query || nlpType === query || cType.includes(query) || nlpType.includes(query);
          if (!matches) return false;
        }
      }
      if (debouncedUrgency !== "All Urgency") {
        const u = (c.nlp?.urgency || "").toLowerCase();
        const du = debouncedUrgency.toLowerCase();
        if (du === "critical" && u !== "critical") return false;
        if (du === "high" && u !== "high") return false;
        if (du === "moderate" && u !== "moderate" && u !== "mod") return false;
        if (du === "low" && u !== "low") return false;
      }
      if (debouncedStatus !== "All Status" && c.status?.toLowerCase() !== debouncedStatus.toLowerCase()) {
        return false;
      }
      if (debouncedFromDate) {
        const dStr = getConvoDateString(c);
        if (dStr && dStr < debouncedFromDate) return false;
      }
      if (debouncedToDate) {
        const dStr = getConvoDateString(c);
        if (dStr && dStr > debouncedToDate) return false;
      }
      return true;
    });
  }, [analyzedConversations, viewMode, debouncedBarangay, debouncedType, debouncedUrgency, debouncedStatus, debouncedFromDate, debouncedToDate]);

  const totalPages = Math.max(1, Math.ceil(filteredConversations.length / PAGE_SIZE));

  const paginatedConversations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredConversations.slice(start, start + PAGE_SIZE);
  }, [filteredConversations, currentPage]);

  const selectedConversation = selectedId
    ? filteredConversations.find((c) => c.id === selectedId) || null
    : null;

  // Sync selectedId when active filter excludes previous selection
  useEffect(() => {
    if (selectedId && filteredConversations.length > 0) {
      const exists = filteredConversations.some((c) => c.id === selectedId);
      if (!exists) {
        setSelectedId("");
      }
    }
  }, [filteredConversations, selectedId]);

  // Auto-scroll chat to bottom strictly within the message panel (never scroll parent containers)
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [selectedConversation?.id, selectedConversation?.messages?.length]);

  const selectedIndex = selectedConversation
    ? filteredConversations.findIndex((c) => c.id === selectedConversation.id)
    : -1;

  const selectedColor = selectedConversation
    ? getAvatarColor(selectedConversation.name, selectedIndex !== -1 ? selectedIndex : undefined)
    : "bg-[#1877F2]";

  const selectedInitials = selectedConversation
    ? getInitials(selectedConversation.name)
    : "U";

  // Semantic Urgency Badge (Matches Scraper styling)
  const renderUrgencyBadge = (urgency?: string) => {
    switch ((urgency || "").toLowerCase()) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse shrink-0" />
            <span>Critical</span>
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span>High</span>
          </span>
        );
      case "moderate":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>Moderate</span>
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>Low</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Skeleton — shown only on initial cold load before any conversations exist
  if (loading && conversations.length === 0) {
    return <PageLoader variant="messenger" />;
  }

  // Error state only if zero conversations exist to show
  if (!loading && error && conversations.length === 0) {
    return (
      <div className="messenger-soft flex flex-col flex-1 w-full lg:h-full lg:min-h-0 space-y-3 sm:space-y-3.5 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
              <MessageSquare className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Messenger Bot Logs
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Resident intake chat logs, automated triage dialogues, and emergency extraction timeline
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 text-rose-600 dark:text-rose-400 bg-rose-500/[0.06] dark:bg-rose-500/[0.10] border border-rose-500/20 rounded-2xl p-6 sm:p-8 max-w-md text-center shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">Failed to load conversations</p>
            <p className="text-xs text-rose-500 dark:text-rose-400 font-mono">{error}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please check your network connection or try refreshing the page.
            </p>
            <button
              type="button"
              onClick={() => refetchConversations && refetchConversations()}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Retry Now</span>
            </button>
          </div>
        </div>
      </div>
    );
  }


  const updateDistressNav = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container || !selectedConversation?.nlp?.isIncident) {
      setDistressNav((prev) => (prev.show ? { ...prev, show: false } : prev));
      return;
    }

    const indices = selectedConversation.nlp.distressMessageIndices || [];
    if (indices.length === 0) {
      setDistressNav((prev) => (prev.show ? { ...prev, show: false } : prev));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerCenter = (containerRect.top + containerRect.bottom) / 2;

    const elements = indices
      .map((idx, order) => {
        const el = container.querySelector<HTMLElement>(`[data-distress-idx="${idx}"]`);
        if (!el) return null;
        const elRect = el.getBoundingClientRect();
        const elCenter = (elRect.top + elRect.bottom) / 2;
        const offsetFromCenter = elCenter - containerCenter;

        const isAbove = elRect.bottom < containerRect.top + 36;
        const isBelow = elRect.top > containerRect.bottom - 36;
        const isVisible = !isAbove && !isBelow;
        const isCentered = isVisible && Math.abs(offsetFromCenter) < 130;

        return {
          idx,
          order: order + 1,
          offsetFromCenter,
          isAbove,
          isBelow,
          isVisible,
          isCentered,
        };
      })
      .filter(Boolean) as Array<{
        idx: number;
        order: number;
        offsetFromCenter: number;
        isAbove: boolean;
        isBelow: boolean;
        isVisible: boolean;
        isCentered: boolean;
      }>;

    if (elements.length === 0) {
      setDistressNav((prev) => (prev.show ? { ...prev, show: false } : prev));
      return;
    }

    const visibleElements = elements.filter((e) => e.isVisible);
    const currentDistress = visibleElements.sort(
      (a, b) => Math.abs(a.offsetFromCenter) - Math.abs(b.offsetFromCenter)
    )[0];

    const itemsAbove = elements.filter((e) => e.isAbove);
    const itemsBelow = elements.filter((e) => e.isBelow);

    const nearestAbove = itemsAbove.length > 0 ? itemsAbove[itemsAbove.length - 1] : null;
    const nearestBelow = itemsBelow.length > 0 ? itemsBelow[0] : null;

    let targetIdx = -1;
    let direction: 'up' | 'down' = 'up';
    let currentNumber = 1;

    if (currentDistress) {
      currentNumber = currentDistress.order;
      const currIndexInList = elements.findIndex((e) => e.idx === currentDistress.idx);
      const prevInList = currIndexInList > 0 ? elements[currIndexInList - 1] : null;
      const nextInList = currIndexInList < elements.length - 1 ? elements[currIndexInList + 1] : null;

      if (preferredDirectionRef.current === 'down' && nextInList) {
        direction = 'down';
        targetIdx = nextInList.idx;
      } else if (prevInList) {
        direction = 'up';
        targetIdx = prevInList.idx;
      } else if (nextInList) {
        direction = 'down';
        targetIdx = nextInList.idx;
      } else {
        targetIdx = currentDistress.idx;
      }
    } else {
      if (itemsAbove.length > 0) {
        direction = 'up';
        targetIdx = nearestAbove!.idx;
        currentNumber = nearestAbove!.order;
      } else if (itemsBelow.length > 0) {
        direction = 'down';
        targetIdx = nearestBelow!.idx;
        currentNumber = nearestBelow!.order;
      }
    }

    const currentOrder = currentDistress
      ? currentDistress.order
      : direction === 'up'
      ? nearestAbove
        ? nearestAbove.order + 1
        : 1
      : nearestBelow
      ? nearestBelow.order - 1
      : 1;

    const hasAbove = elements.some((e) => e.order < currentOrder || e.isAbove);
    const hasBelow = elements.some((e) => e.order > currentOrder || e.isBelow);

    const prevTarget = nearestAbove
      ? nearestAbove.idx
      : currentDistress && elements.findIndex((e) => e.idx === currentDistress.idx) > 0
      ? elements[elements.findIndex((e) => e.idx === currentDistress.idx) - 1].idx
      : -1;

    const nextTarget = nearestBelow
      ? nearestBelow.idx
      : currentDistress && elements.findIndex((e) => e.idx === currentDistress.idx) < elements.length - 1
      ? elements[elements.findIndex((e) => e.idx === currentDistress.idx) + 1].idx
      : -1;

    const canScrollUp = (container.scrollTop > 15) || hasAbove;
    const firstDistressIdx = indices.length > 0 ? indices[0] : -1;

    setDistressNav({
      show: true,
      direction,
      targetIdx,
      total: indices.length,
      currentNumber: Math.min(Math.max(1, currentNumber), indices.length),
      hasAbove,
      hasBelow,
      prevTargetIdx: prevTarget,
      nextTargetIdx: nextTarget,
      firstDistressIdx,
      canScrollUp,
    });
  }, [selectedConversation]);

  // Re-check distress positions when selected conversation changes or on resize
  useEffect(() => {
    const timer = setTimeout(() => {
      updateDistressNav();
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedConversation?.id, updateDistressNav]);

  const jumpToMessageIndex = useCallback(
    (targetIdx: number) => {
      const container = chatScrollRef.current;
      if (!container || targetIdx === -1) return;
      const targetEl = container.querySelector<HTMLElement>(`[data-distress-idx="${targetIdx}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedDistressIdx(targetIdx);
        setTimeout(() => {
          setHighlightedDistressIdx((prev) => (prev === targetIdx ? null : prev));
        }, 2500);
        setTimeout(() => {
          updateDistressNav();
        }, 200);
        setTimeout(() => {
          updateDistressNav();
        }, 500);
      }
    },
    [updateDistressNav]
  );

  const canGoUp = useMemo(() => {
    if (distressNav.total <= 1) {
      return distressNav.direction === 'up' || distressNav.hasAbove;
    }
    return distressNav.currentNumber > 1;
  }, [distressNav.total, distressNav.direction, distressNav.hasAbove, distressNav.currentNumber]);

  const canGoDown = useMemo(() => {
    if (distressNav.total <= 1) {
      return distressNav.direction === 'down' || distressNav.hasBelow;
    }
    return distressNav.currentNumber < distressNav.total;
  }, [distressNav.total, distressNav.direction, distressNav.hasBelow, distressNav.currentNumber]);

  // Step strictly distress by distress (1/N -> 2/N -> 3/N -> ...) so NO distress word is missed!
  const handleJumpDirection = useCallback(
    (dir: 'up' | 'down') => {
      preferredDirectionRef.current = dir;
      const container = chatScrollRef.current;
      if (!container) return;

      const indices = selectedConversation?.nlp?.distressMessageIndices || [];
      if (indices.length === 0) return;

      if (indices.length === 1) {
        // Single distress message: jump directly to it
        jumpToMessageIndex(indices[0]);
        return;
      }

      const currentOrder = distressNav.currentNumber; // 1-based order

      if (dir === 'down') {
        if (currentOrder < indices.length) {
          // Advance strictly to the next distress message
          const nextIdx = indices[currentOrder];
          jumpToMessageIndex(nextIdx);
        } else {
          // At the last distress message: STOP THERE! Keep last distress message in view.
          jumpToMessageIndex(indices[indices.length - 1]);
        }
      } else {
        // dir === 'up'
        if (currentOrder > 1) {
          // Step strictly back to the previous distress message
          const prevIdx = indices[currentOrder - 2];
          jumpToMessageIndex(prevIdx);
        } else {
          // At the first distress message: STOP THERE! Keep first distress message in view.
          jumpToMessageIndex(indices[0]);
        }
      }
    },
    [selectedConversation, distressNav.currentNumber, jumpToMessageIndex]
  );

  const handleJumpToDistress = useCallback(() => {
    const indices = selectedConversation?.nlp?.distressMessageIndices || [];
    if (indices.length === 0) return;

    if (indices.length === 1) {
      jumpToMessageIndex(indices[0]);
      return;
    }

    if (distressNav.currentNumber < indices.length) {
      handleJumpDirection('down');
    } else {
      // Reached the bottom distress: stop there!
      jumpToMessageIndex(indices[indices.length - 1]);
    }
  }, [selectedConversation, distressNav.currentNumber, jumpToMessageIndex, handleJumpDirection]);

  return (
    <div className="messenger-soft flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-3.5 w-full h-full relative">
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
        {/* ── Top Page Header (Unified Soft UI Design) ── */}
        <StaggerItem>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
            <MessageSquare className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg sm:text-[22px] font-semibold tracking-[-0.025em] leading-tight text-slate-900 dark:text-white">
              Messenger Bot Logs
            </h1>
            <p className="text-[11px] sm:text-xs font-normal tracking-[0.005em] text-slate-500/90 dark:text-slate-400/90 mt-0.5 leading-relaxed">
              Resident intake dialogues <span className="text-slate-300 dark:text-slate-600 mx-1">·</span> Automated triage &amp; extraction timeline
            </p>
          </div>
        </div>

          </div>
        </StaggerItem>

        {/* Header & Filter Controls Bar — hidden on mobile chat view so chat gets 100% height */}
        <StaggerItem>
          <div
            className={`
              ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
              relative z-30 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-3 sm:px-4 sm:py-3.5 md:px-4.5 flex-col gap-3 transition-all duration-200 shrink-0
            `}
          >
            {/* Mobile Header Toggle (< md) */}
            <div className="flex md:hidden items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/25 dark:border-blue-400/25 text-xs font-semibold cursor-pointer select-none active:scale-[0.98] transition-transform shadow-2xs"
              >
                <Filter className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
                <span>Filter Conversations</span>
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

            {/* Filter Controls Row */}
            <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center justify-between gap-2.5 sm:gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-white/5`}>
              {/* Left Filter Scope Container */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:inline-flex md:items-center gap-2.5 sm:gap-3 md:gap-2.5 md:p-1.5 md:px-2 md:bg-slate-100/70 md:dark:bg-white/[0.05] md:backdrop-blur-xl md:rounded-2xl md:border md:border-slate-200/70 md:dark:border-white/10 md:shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] w-full md:w-auto relative z-20">
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[#0071E3] dark:text-sky-400 cursor-default select-none shrink-0">
                  <Filter className="w-3.5 h-3.5 transition-transform duration-300 group-hover/filters:scale-110 text-[#0071E3] dark:text-sky-400" strokeWidth={1.8} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
                </div>
                <div className="col-span-1 md:col-span-auto min-w-0 md:min-w-[135px] w-full md:w-auto">
                  <FilterDropdown
                    labelPrefix="Barangay"
                    value={filterBarangay}
                    options={availableBarangays}
                    onChange={(val) => { setFilterBarangay(val); setSelectedId(""); }}
                  />
                </div>
                <div className="col-span-1 md:col-span-auto min-w-0 md:min-w-[125px] w-full md:w-auto">
                  <FilterDropdown
                    labelPrefix="Type"
                    value={filterType}
                    options={availableTypes}
                    onChange={(val) => { setFilterType(val); setSelectedId(""); }}
                  />
                </div>
                <div className="col-span-1 md:col-span-auto min-w-0 md:min-w-[125px] w-full md:w-auto">
                  <FilterDropdown
                    labelPrefix="Urgency"
                    value={filterUrgency}
                    options={["All Urgency", "Critical", "High", "Moderate", "Low"]}
                    onChange={(val) => { setFilterUrgency(val); setSelectedId(""); }}
                  />
                </div>
                <div className="col-span-1 md:col-span-auto min-w-0 md:min-w-[125px] w-full md:w-auto">
                  <FilterDropdown
                    labelPrefix="Status"
                    value={filterStatus}
                    options={["All Status", "Incomplete", "Complete"]}
                    onChange={(val) => { setFilterStatus(val); setSelectedId(""); }}
                  />
                </div>
              </div>

              {/* Right Date Scope Container + Preserved Reset Option */}
              <div className="col-span-2 md:col-span-auto flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 md:ml-auto w-full md:w-auto relative z-10">
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
          </div>
        </StaggerItem>

        {/* Two Column Layout / Responsive Split-Pane */}
        <StaggerItem className="flex-1 lg:min-h-0 flex flex-col">
          <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 lg:gap-6 lg:min-h-0 lg:h-full">
            {/* LEFT: Conversation List — Soft Messages Sidebar */}
            <div
              className={`
                ${mobileView === 'chat' && selectedConversation ? 'hidden md:flex' : 'flex'}
                ${selectedConversation ? 'md:col-span-5 lg:col-span-5' : 'md:col-span-12 w-full'}
                bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-col overflow-hidden
                min-h-[460px] md:min-h-0 h-[calc(100vh-12rem)] md:h-full transition-all duration-200
              `}
            >
              {/* Apple Segmented Stream Switcher Header */}
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02] gap-2">
                <div
                  role="tablist"
                  aria-label="View Mode"
                  className="inline-flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "structured"}
                    onClick={() => handleViewModeChange("structured")}
                    className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 select-none cursor-pointer active:scale-[0.98] ${
                      viewMode === "structured"
                        ? "text-[#0071E3] dark:text-sky-400 font-bold"
                        : "text-slate-500 hover:text-[#0071E3] dark:text-slate-400 dark:hover:text-sky-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                    }`}
                  >
                    {viewMode === "structured" && (
                      <motion.div
                        layoutId="activeMessengerSidebarTab"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 bg-white dark:bg-slate-700/90 border border-slate-200/80 dark:border-white/10 rounded-lg shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 transition-all duration-200 ease-out group-hover:scale-115 ${
                          viewMode === "structured"
                            ? "text-[#0071E3] dark:text-sky-400"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-[#0071E3] dark:group-hover:text-sky-300"
                        }`}
                        strokeWidth={2}
                      />
                      <span className="transition-colors duration-150">Incidents</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums transition-all duration-200 group-hover:scale-105 ${
                          viewMode === "structured"
                            ? "bg-[#0071E3] text-white shadow-xs"
                            : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-[#0071E3] dark:group-hover:text-sky-300"
                        }`}
                      >
                        {incidentCount}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "unstructured"}
                    onClick={() => handleViewModeChange("unstructured")}
                    className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 select-none cursor-pointer active:scale-[0.98] ${
                      viewMode === "unstructured"
                        ? "text-[#0071E3] dark:text-sky-400 font-bold"
                        : "text-slate-500 hover:text-[#0071E3] dark:text-slate-400 dark:hover:text-sky-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                    }`}
                  >
                    {viewMode === "unstructured" && (
                      <motion.div
                        layoutId="activeMessengerSidebarTab"
                        transition={APPLE_SPRING}
                        className="absolute inset-0 bg-white dark:bg-slate-700/90 border border-slate-200/80 dark:border-white/10 rounded-lg shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Layers
                        className={`w-3.5 h-3.5 transition-all duration-200 ease-out group-hover:scale-115 ${
                          viewMode === "unstructured"
                            ? "text-[#0071E3] dark:text-sky-400"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-[#0071E3] dark:group-hover:text-sky-300"
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="transition-colors duration-150">All Logs</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums transition-all duration-200 group-hover:scale-105 ${
                          viewMode === "unstructured"
                            ? "bg-[#0071E3] text-white shadow-xs"
                            : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-[#0071E3] dark:group-hover:text-sky-300"
                        }`}
                      >
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
                      className="text-[11px] font-semibold text-[#0071E3] dark:text-sky-400 hover:underline hover:text-blue-700 dark:hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Conversation List with Apple-grade Edge Fade */}
              <div
                className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-2.5 pb-8 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                style={{
                  maskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                }}
              >
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-slate-400 dark:text-slate-500 text-xs sm:text-sm gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 stroke-[1.5] text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>{viewMode === "structured" ? "No emergency incident reports match filters." : "No conversations found."}</span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-1 text-xs font-semibold text-[#0071E3] dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {paginatedConversations.map((convo, index) => {
                      const isSelected = selectedConversation?.id === convo.id;
                      const isSeen = seenConvoIds.has(convo.id);
                      const isIncomplete = convo.status === "Incomplete";
                      return (
                        <div key={convo.id} className="w-full">
                          <button
                            type="button"
                            onClick={() => handleSelectConversation(convo.id)}
                            className={`w-full flex items-center gap-2.5 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl transition-all duration-200 text-left relative group active:scale-[0.985] cursor-pointer ${
                              isSelected
                                ? "bg-blue-500/[0.12] dark:bg-blue-500/[0.22] shadow-[0_2px_12px_rgba(0,113,227,0.14)] border border-blue-500/40 dark:border-blue-400/50 text-slate-900 dark:text-white"
                                : !isSeen
                                ? "bg-blue-50/50 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-900/50 hover:bg-blue-50/90 dark:hover:bg-blue-950/45 hover:border-blue-400/60 dark:hover:border-blue-400/50 hover:shadow-[0_4px_16px_rgba(0,113,227,0.12)] hover:-translate-y-0.5 text-slate-900 dark:text-white"
                                : "hover:bg-blue-50/40 dark:hover:bg-blue-950/30 border border-transparent hover:border-blue-300/40 dark:hover:border-blue-500/30 hover:shadow-[0_2px_10px_rgba(0,113,227,0.08)] hover:-translate-y-0.5 text-slate-600 dark:text-slate-400 opacity-90"
                            }`}
                          >
                            {/* Active pill accent bar */}
                            {isSelected && (
                              <motion.div
                                layoutId="activeConvoIndicator"
                                className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-[#0071E3] dark:bg-sky-400 shadow-[0_0_8px_rgba(0,113,227,0.6)] rounded-full"
                                transition={APPLE_SPRING}
                              />
                            )}

                            {/* Circular Avatar with soft ring */}
                            <div className="relative shrink-0">
                              <div
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${getAvatarColor(
                                  convo.name,
                                  index
                                )} flex items-center justify-center font-bold text-xs text-white shadow-xs ring-1 group-hover:scale-105 group-hover:ring-2 group-hover:ring-blue-400/70 dark:group-hover:ring-blue-400/70 transition-all duration-200 ${
                                  !isSeen ? "ring-blue-400/80 dark:ring-blue-500/80" : "ring-black/5 dark:ring-white/10 opacity-80"
                                }`}
                              >
                                {getInitials(convo.name)}
                              </div>

                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <h4
                                  className={`text-xs sm:text-[13px] tracking-tight truncate transition-colors group-hover:text-[#0071E3] dark:group-hover:text-sky-400 ${
                                    !isSeen
                                      ? "font-bold text-slate-900 dark:text-white"
                                      : "font-semibold text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {convo.name}
                                </h4>
                              </div>
                              <p
                                className={`text-[11px] sm:text-xs truncate mt-0.5 leading-snug transition-colors ${
                                  !isSeen
                                    ? "font-medium text-slate-800 dark:text-slate-200"
                                    : "font-normal text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {getLastMessage(convo)}
                              </p>
                              <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                <span className="truncate max-w-[140px] sm:max-w-none flex items-center gap-1">
                                  <span>{convo.nlp?.incidentType && convo.nlp.incidentType.toLowerCase() !== "none" ? convo.nlp.incidentType : (convo.type && convo.type.toLowerCase() !== "none" ? convo.type : "General")}</span>
                                  <span className="text-slate-300 dark:text-slate-600">•</span>
                                  <span className={convo.barangay === "Unknown" ? "italic text-slate-400" : ""}>{convo.barangay}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {renderUrgencyBadge(convo.nlp?.urgency)}

                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors duration-200 ${
                                    isIncomplete
                                      ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                      : "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isIncomplete
                                        ? "bg-amber-500 animate-pulse"
                                        : "bg-emerald-500"
                                    }`}
                                  />
                                  {convo.status}
                                </span>
                              </div>
                            </div>

                            {/* Timestamp & Right Chevron with Incomplete Dot */}
                            <div className="flex flex-col items-end justify-between self-stretch shrink-0 py-0.5 pl-1">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-[10px] sm:text-[11px] tabular-nums transition-colors duration-200 ${
                                    !isSeen
                                      ? "font-semibold text-blue-600 dark:text-blue-400"
                                      : "font-normal text-slate-400 dark:text-slate-500"
                                  }`}
                                >
                                  {formatDisplayTime(convo.time)}
                                </span>
                                <AnimatePresence>
                                  {isIncomplete && (
                                    <motion.span
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={APPLE_SPRING}
                                      className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)] shrink-0"
                                      title="Incomplete conversation"
                                    />
                                  )}
                                </AnimatePresence>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-[#0071E3] dark:group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all duration-150" />
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination Controls Footer */}
              {filteredConversations.length > PAGE_SIZE && (
                <div className="px-3.5 py-2.5 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredConversations.length)} of {filteredConversations.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-blue-500/25 dark:border-blue-400/25 bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 disabled:opacity-30 disabled:pointer-events-none hover:bg-[#0071E3] hover:text-white dark:hover:bg-[#0071E3] dark:hover:text-white active:scale-95 transition-all cursor-pointer shadow-2xs"
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
                      className="p-1.5 rounded-lg border border-blue-500/25 dark:border-blue-400/25 bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 disabled:opacity-30 disabled:pointer-events-none hover:bg-[#0071E3] hover:text-white dark:hover:bg-[#0071E3] dark:hover:text-white active:scale-95 transition-all cursor-pointer shadow-2xs"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Message Detail — macOS Soft Messages Style */}
            <AnimatePresence mode="wait">
              {selectedConversation && (
                <motion.div
                  key="convo-detail-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`
                    ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
                    md:col-span-7 lg:col-span-7 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-col overflow-hidden
                    min-h-[480px] md:min-h-0 h-[calc(100vh-12rem)] md:h-full
                  `}
                >
                  <motion.div
                    key={selectedConversation.id}
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col h-full min-h-0"
                  >
                    {/* Header */}
                    <div className="px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/40 dark:bg-white/[0.02] gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {/* Mobile Back Button to Conversation List (< md) */}
                        <button
                          type="button"
                          onClick={handleCloseConversation}
                          className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#0071E3] dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 active:scale-95 transition-all shrink-0 cursor-pointer"
                          aria-label="Back to conversations list"
                        >
                          <ChevronLeft className="w-4 h-4 -ml-1" strokeWidth={1.75} />
                          <span>Chats</span>
                        </button>

                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${selectedColor} flex items-center justify-center font-bold text-[11px] sm:text-xs text-white shrink-0 shadow-xs ring-1 ring-black/5 dark:ring-white/10`}
                        >
                          {selectedInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-base tracking-tight truncate">
                            {selectedConversation.name}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 sm:gap-1.5 mt-0.5 truncate">
                            <span className="truncate">{selectedConversation.barangay}</span>
                            <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                            <span className="truncate">{selectedConversation.nlp?.incidentType && selectedConversation.nlp.incidentType.toLowerCase() !== "none" ? selectedConversation.nlp.incidentType : (selectedConversation.type && selectedConversation.type.toLowerCase() !== "none" ? selectedConversation.type : "General")}</span>
                            
                          </p>
                        </div>
                      </div>

                      {/* Urgency Badge + Apple Segmented 1-Click Status Switcher Capsule */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {renderUrgencyBadge(selectedConversation.nlp?.urgency)}

                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                          <span className="hidden sm:inline-flex items-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                            Status
                          </span>
                          <div
                            role="group"
                            aria-label="Conversation Status"
                            className="inline-flex items-center p-0.5 sm:p-1 bg-slate-100/90 dark:bg-slate-800/80 backdrop-blur-md rounded-full border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
                          >
                            {/* Incomplete Option */}
                            <button
                              type="button"
                              onClick={() => updateConversationStatus(selectedConversation.id, "Incomplete")}
                              className={`relative flex items-center gap-1.5 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs tracking-tight transition-all duration-200 select-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer ${
                                selectedConversation.status === "Incomplete"
                                  ? "text-amber-700 dark:text-amber-300 font-bold"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium"
                              }`}
                              title="Mark conversation as Incomplete"
                            >
                              {selectedConversation.status === "Incomplete" && (
                                <motion.div
                                  layoutId="activeStatusCapsule"
                                  transition={APPLE_SPRING}
                                  className="absolute inset-0 bg-amber-500/18 dark:bg-amber-500/25 border border-amber-500/40 dark:border-amber-400/40 rounded-full shadow-[0_2px_8px_rgba(245,158,11,0.18)] backdrop-blur-md"
                                />
                              )}
                              <span
                                className={`relative z-10 w-2 h-2 rounded-full transition-colors ${
                                  selectedConversation.status === "Incomplete"
                                    ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"
                                    : "bg-amber-500/60"
                                }`}
                              />
                              <span className="relative z-10">Incomplete</span>
                            </button>

                            {/* Complete Option */}
                            <button
                              type="button"
                              onClick={() => updateConversationStatus(selectedConversation.id, "Complete")}
                              className={`relative flex items-center gap-1.5 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs tracking-tight transition-all duration-200 select-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer ${
                                selectedConversation.status === "Complete"
                                  ? "text-emerald-700 dark:text-emerald-300 font-bold"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium"
                              }`}
                              title="Mark conversation as Complete"
                            >
                              {selectedConversation.status === "Complete" && (
                                <motion.div
                                  layoutId="activeStatusCapsule"
                                  transition={APPLE_SPRING}
                                  className="absolute inset-0 bg-emerald-500/18 dark:bg-emerald-500/25 border border-emerald-500/40 dark:border-emerald-400/40 rounded-full shadow-[0_2px_8px_rgba(16,185,129,0.18)] backdrop-blur-md"
                                />
                              )}
                              <CheckCircle2
                                className={`relative z-10 w-3.5 h-3.5 transition-colors ${
                                  selectedConversation.status === "Complete"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-emerald-500/60"
                                }`}
                                strokeWidth={2.25}
                              />
                              <span className="relative z-10">Complete</span>
                            </button>
                          </div>
                        </div>

                        {/* Minimize / Close Conversation Buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-slate-200/60 dark:border-white/10">
                          <button
                            type="button"
                            onClick={handleCloseConversation}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150 flex items-center justify-center active:scale-95 cursor-pointer"
                            title="Minimize conversation (Esc)"
                            aria-label="Minimize conversation"
                          >
                            <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseConversation}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-150 flex items-center justify-center active:scale-95 cursor-pointer"
                            title="Close conversation (Esc)"
                            aria-label="Close conversation"
                          >
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Messages — Apple Messages Thread with Edge Fade */}
                    <div
                      ref={chatScrollRef}
                      onScroll={updateDistressNav}
                      className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-6 pb-16 bg-slate-50/50 dark:bg-[#0B0F17]/50 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                      style={{
                        maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                      }}
                    >
                      <div className="space-y-3 sm:space-y-4">
                        {([...(selectedConversation.messages ?? [])].reverse()).map((msg, idx) => {
                          const msgDate = formatMsgDate(msg.timestamp, selectedConversation.time);
                          const msgTime = formatMsgTime(msg.timestamp, selectedConversation.time);
                          return msg.sender === "bot" ? (
                            <div key={idx}>
                              <div className="flex items-end gap-1.5 sm:gap-2 justify-end">
                                <div className="flex flex-col items-end max-w-[85%] sm:max-w-[74%] min-w-0">
                                  <div className="bg-[#0071E3] text-white rounded-[20px] rounded-br-[4px] px-4 py-3 shadow-[0_2px_10px_rgba(0,113,227,0.22)] transition-all">
                                    <p className="text-xs sm:text-[13.5px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] font-normal">{msg.text}</p>
                                  </div>
                                  <div className="flex flex-col items-end mt-1 mr-1">
                                    <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                                      <Bot className="w-3 h-3 text-[#0071E3] dark:text-sky-400 shrink-0" strokeWidth={1.75} />
                                      <span>Responde Bot</span>
                                      {msgTime && (
                                        <>
                                          <span className="text-slate-300 dark:text-slate-600">•</span>
                                          <span className="tabular-nums">{msgTime}</span>
                                        </>
                                      )}
                                    </span>
                                    {msgDate && (
                                      <span className="text-[9.5px] sm:text-[10px] text-slate-400/80 dark:text-slate-500/80 font-normal tabular-nums mt-0.5">
                                        {msgDate}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-[#0071E3] dark:text-blue-400 shrink-0 mb-3 sm:mb-4 ring-1 ring-blue-500/20 shadow-2xs">
                                  <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0071E3]" strokeWidth={1.75} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={idx}
                              data-distress-idx={selectedConversation.nlp.isIncident && (selectedConversation.nlp.distressMessageIndices?.includes(idx) || idx === selectedConversation.nlp.distressMessageIdx) ? idx : undefined}
                              className="relative"
                            >
                              <div className="flex items-end gap-1.5 sm:gap-2 justify-start">
                                <div
                                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${selectedColor} flex items-center justify-center text-[10px] sm:text-[11px] font-bold text-white shrink-0 mb-3 sm:mb-4 shadow-xs ring-1 ring-black/5`}
                                >
                                  {selectedInitials}
                                </div>
                                <div className="flex flex-col items-start max-w-[85%] sm:max-w-[74%] min-w-0">
                                  {/* Emergency Distress Tag on User Message */}
                                  {selectedConversation.nlp.isIncident && (selectedConversation.nlp.distressMessageIndices?.includes(idx) || idx === selectedConversation.nlp.distressMessageIdx) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2.5 py-0.5 mb-1.5 shadow-2xs">
                                      <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" strokeWidth={2} />
                                      <span>Distress Detected</span>
                                    </span>
                                  )}
                                  <div className={`bg-white dark:bg-[#1e293b] text-slate-800 dark:text-slate-100 rounded-[20px] rounded-bl-[4px] px-4 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border transition-all duration-200 ${
                                    highlightedDistressIdx === idx
                                      ? "border-rose-500/80 ring-2 ring-rose-500/50 shadow-[0_0_18px_rgba(244,63,94,0.35)] scale-[1.01]"
                                      : "border-slate-200/80 dark:border-white/10"
                                  }`}>
                                    <p className="text-xs sm:text-[13.5px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] font-normal">{msg.text}</p>
                                  </div>
                                  <div className="flex flex-col items-start mt-1 ml-1">
                                    <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                                      <span>{selectedConversation.name}</span>
                                      {msgTime && (
                                        <>
                                          <span className="text-slate-300 dark:text-slate-600">•</span>
                                          <span className="tabular-nums">{msgTime}</span>
                                        </>
                                      )}
                                    </span>
                                    {msgDate && (
                                      <span className="text-[9.5px] sm:text-[10px] text-slate-400/80 dark:text-slate-500/80 font-normal tabular-nums mt-0.5">
                                        {msgDate}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Floating Jump to Distress Signal Pill Button */}
                    <AnimatePresence>
                      {distressNav.show && (
                        <motion.div
                          initial={{ opacity: 0, y: 14, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.94 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
                        >
                          <div className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl border border-rose-500/30 dark:border-rose-500/40 shadow-[0_8px_24px_rgba(244,63,94,0.18)] dark:shadow-[0_8px_24px_rgba(244,63,94,0.28)] text-xs font-semibold select-none">
                            {/* Scroll up / Previous distress signal */}
                            {distressNav.total > 1 && (
                              <button
                                type="button"
                                onClick={() => handleJumpDirection('up')}
                                disabled={!canGoUp}
                                className={`flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer ${
                                  canGoUp
                                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 active:scale-90'
                                    : 'text-rose-300/40 dark:text-rose-500/30 cursor-not-allowed opacity-35'
                                }`}
                                title={canGoUp ? 'Previous distress signal' : 'At topmost distress signal'}
                                aria-label="Previous distress signal"
                              >
                                <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.2} />
                              </button>
                            )}

                            {/* Main action pill */}
                            <button
                              type="button"
                              onClick={handleJumpToDistress}
                              className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 active:scale-95 transition-all cursor-pointer"
                              title="Jump to distress signal"
                            >
                              {distressNav.total <= 1 && (
                                <ArrowUp className="w-3.5 h-3.5 text-rose-500 shrink-0" strokeWidth={2.2} />
                              )}
                              <span>Go to Distress</span>
                              {distressNav.total > 1 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 tabular-nums ml-0.5">
                                  {distressNav.currentNumber}/{distressNav.total}
                                </span>
                              )}
                            </button>

                            {/* Scroll down to next distress signal */}
                            {distressNav.total > 1 && (
                              <button
                                type="button"
                                onClick={() => handleJumpDirection('down')}
                                disabled={!canGoDown}
                                className={`flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer ${
                                  canGoDown
                                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 active:scale-90'
                                    : 'text-rose-300/40 dark:text-rose-500/30 cursor-not-allowed opacity-35'
                                }`}
                                title={canGoDown ? 'Next distress signal' : 'At bottommost distress signal'}
                                aria-label="Next distress signal"
                              >
                                <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.2} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
