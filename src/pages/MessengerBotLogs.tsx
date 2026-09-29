import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Filter, AlertCircle, X, CheckCircle2, RefreshCw, MessageSquare, ChevronRight, Bot } from "lucide-react";
import DatePicker from "../components/DatePicker";
import FilterDropdown from "../components/DropDown";
import { StaggerContainer, StaggerItem } from "../components/Stagger";
import PageLoader from "../components/PageLoader";
import { useBotConversations, type BotConversation as Conversation } from "../context/BotConversationsContext";
import { TALISAY_BARANGAYS } from "../data/talisay-barangays";



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
  if (!timeStr) return "";
  if (timeStr.includes(" ")) {
    const parts = timeStr.split(" ");
    return parts[parts.length - 1];
  }
  return timeStr;
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


// -- Apple Notification Toast Component --
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === "success"
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
    : toast.type === "error"
      ? <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
      : <RefreshCw className="w-4 h-4 text-[#0071E3] dark:text-blue-400" />;

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

export default function MessengerBotLogs() {
  const {
    conversations,
    updateConversationStatus: setContextStatus,
    loading,
    error,
  } = useBotConversations();

  const [selectedId, setSelectedId] = useState<string>("conv_1");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("All Barangays");
  const [filterType, setFilterType] = useState("All Types");
  const [filterStatus, setFilterStatus] = useState("All Status");

  // Keep first conversation selected once loaded
  useEffect(() => {
    if (conversations.length > 0 && !selectedId) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

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

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    const target = conversations.find((c) => c.id === id);
    if (target && target.status === "Incomplete") {
      updateConversationStatus(id, "Complete", true);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (filterBarangay !== "All Barangays" && c.barangay !== filterBarangay) return false;
    if (filterType !== "All Types" && c.type !== filterType) return false;
    if (filterStatus !== "All Status" && c.status !== filterStatus && c.id !== selectedId) return false;
    return true;
  });

  const selectedConversation =
    filteredConversations.find((c) => c.id === selectedId) || filteredConversations[0];

  const selectedIndex = selectedConversation
    ? filteredConversations.findIndex((c) => c.id === selectedConversation.id)
    : -1;

  const selectedColor = selectedConversation
    ? getAvatarColor(selectedConversation.name, selectedIndex !== -1 ? selectedIndex : undefined)
    : "bg-[#1877F2]";

  const selectedInitials = selectedConversation
    ? getInitials(selectedConversation.name)
    : "U";

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
      {loading && <PageLoader variant="messenger" />}

      {/* Error state */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 max-w-md text-center">
            <AlertCircle className="w-8 h-8" />
            <p className="font-semibold text-sm">Failed to load conversations</p>
            <p className="text-xs text-red-400 font-mono">{error}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check your browser console and verify your Supabase credentials in <code>.env</code>.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          {/* Header & Filter Controls Bar */}
          <div className="bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] p-4 flex flex-col gap-4">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </div>
                <FilterDropdown
                  value={filterBarangay}
                  options={["All Barangays", ...TALISAY_BARANGAYS]}
                  onChange={(val) => { setFilterBarangay(val); setSelectedId(""); }}
                />
                <FilterDropdown
                  value={filterType}
                  options={["All Types", "Medical", "Search & Rescue", "Food & Water", "Infrastructure"]}
                  onChange={(val) => { setFilterType(val); setSelectedId(""); }}
                />
                <FilterDropdown
                  value={filterStatus}
                  options={["All Status", "Incomplete", "Complete"]}
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

          <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
            {/* LEFT: Conversation List — macOS Messages Sidebar Style */}
            <div className="lg:col-span-5 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col overflow-hidden min-h-[340px] lg:min-h-0">
              {/* Header Row */}
              <div className="px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/15">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base tracking-tight">
                    Messenger Bot Activities
                  </h3>
                </div>
                <span className="bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full px-2.5 py-0.5 tabular-nums">
                  {filteredConversations.length} active
                </span>
              </div>

              {/* Scrollable Conversation List with Apple-grade Edge Fade */}
              <div
                className="flex-1 overflow-y-auto min-h-0 p-2 pb-10 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                style={{
                  maskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 56px), transparent 100%)',
                }}
              >
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500 text-sm gap-2">
                    <MessageSquare className="w-8 h-8 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                    <span>No conversations found.</span>
                  </div>
                ) : (
                  <StaggerContainer className="space-y-1">
                    {filteredConversations.map((convo, index) => {
                      const isSelected = selectedId === convo.id;
                      const isIncomplete = convo.status === "Incomplete";
                      return (
                        <StaggerItem key={convo.id} className="w-full">
                          <button
                            type="button"
                            onClick={() => handleSelectConversation(convo.id)}
                            className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all duration-150 text-left relative group active:scale-[0.98] ${isSelected
                              ? "bg-blue-500/10 dark:bg-blue-500/20 shadow-xs border border-blue-500/25 dark:border-blue-500/30 text-slate-900 dark:text-white"
                              : isIncomplete
                                ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.08] hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.14] border border-amber-500/15 dark:border-amber-500/20 text-slate-950 dark:text-white"
                                : "hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent text-slate-700 dark:text-slate-300"
                              }`}
                          >
                            {/* Active pill accent bar */}
                            {isSelected && (
                              <motion.div
                                layoutId="activeConvoIndicator"
                                className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-[#0071E3] rounded-full"
                                transition={APPLE_SPRING}
                              />
                            )}

                            {/* Circular Avatar with status badge */}
                            <div className="relative shrink-0">
                              <div
                                className={`w-11 h-11 rounded-full ${getAvatarColor(
                                  convo.name,
                                  index
                                )} flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-white/80 dark:ring-slate-800`}
                              >
                                {getInitials(convo.name)}
                              </div>
                              <AnimatePresence>
                                {isIncomplete && (
                                  <motion.span
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={APPLE_SPRING}
                                    className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white dark:border-slate-800 rounded-full shadow-xs"
                                  />
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-1">
                              <h4
                                className={`text-sm tracking-tight truncate transition-all duration-200 ${isIncomplete
                                  ? "font-bold text-slate-950 dark:text-white"
                                  : isSelected
                                    ? "font-semibold text-slate-900 dark:text-white"
                                    : "font-medium text-slate-700 dark:text-slate-300"
                                  }`}
                              >
                                {convo.name}
                              </h4>
                              <p
                                className={`text-xs truncate mt-0.5 leading-snug transition-all duration-200 ${isIncomplete
                                  ? "font-semibold text-slate-900 dark:text-slate-100"
                                  : "font-normal text-slate-500 dark:text-slate-400"
                                  }`}
                              >
                                {getLastMessage(convo)}
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="inline-flex items-center text-[10px] font-medium bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 rounded-md px-2 py-0.5 border border-slate-200/50 dark:border-slate-700/50">
                                  {convo.type} · {convo.barangay}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-0.5 border transition-colors duration-200 ${isIncomplete
                                    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50 font-semibold"
                                    : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50"
                                    }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${isIncomplete
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
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[11px] tabular-nums transition-colors duration-200 ${isIncomplete
                                    ? "font-semibold text-amber-600 dark:text-amber-400"
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
                                      className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0"
                                      title="Incomplete conversation"
                                    />
                                  )}
                                </AnimatePresence>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150" />
                            </div>
                          </button>
                        </StaggerItem>
                      );
                    })}
                  </StaggerContainer>
                )}
              </div>
            </div>

            {/* RIGHT: Message Detail — Apple Messages Style */}
            <div className="lg:col-span-7 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col overflow-hidden min-h-[440px] lg:min-h-0">
              <AnimatePresence mode="wait">
                {selectedConversation ? (
                  <motion.div
                    key={selectedConversation.id}
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col h-full"
                  >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${selectedColor} flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm ring-2 ring-white/80 dark:ring-slate-800`}
                        >
                          {selectedInitials}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white text-base tracking-tight">
                            {selectedConversation.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{selectedConversation.barangay}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span>{selectedConversation.type}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">PSID: {selectedConversation.psid}</span>
                          </p>
                        </div>
                      </div>

                      {/* Apple Segmented 1-Click Status Switcher Capsule */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          role="group"
                          aria-label="Conversation Status"
                          className="inline-flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                        >
                          {/* Incomplete Option */}
                          <button
                            type="button"
                            onClick={() => updateConversationStatus(selectedConversation.id, "Incomplete")}
                            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-tight transition-colors duration-200 select-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${selectedConversation.status === "Incomplete"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              }`}
                            title="Mark conversation as Incomplete"
                          >
                            {selectedConversation.status === "Incomplete" && (
                              <motion.div
                                layoutId="activeStatusCapsule"
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
                            onClick={() => updateConversationStatus(selectedConversation.id, "Complete")}
                            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-tight transition-colors duration-200 select-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selectedConversation.status === "Complete"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              }`}
                            title="Mark conversation as Complete"
                          >
                            {selectedConversation.status === "Complete" && (
                              <motion.div
                                layoutId="activeStatusCapsule"
                                transition={APPLE_SPRING}
                                className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/10"
                              />
                            )}
                            <CheckCircle2 className="relative z-10 w-3.5 h-3.5 text-emerald-500" />
                            <span className="relative z-10">Complete</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Messages — Apple Messages Thread with Edge Fade */}
                    <div
                      className="flex-1 overflow-y-auto min-h-0 p-6 pb-12 bg-slate-50/40 dark:bg-[#0B0F17]/40 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
                      style={{
                        maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                      }}
                    >
                      <StaggerContainer className="space-y-4">
                        {(selectedConversation.messages ?? []).map((msg, idx) =>
                          msg.sender === "bot" ? (
                            <StaggerItem key={idx}>
                              <div className="flex items-end gap-2 justify-end">
                                <div className="flex flex-col items-end max-w-[82%] sm:max-w-[74%]">
                                  <div className="bg-[#0071E3] text-white rounded-[20px] rounded-br-[4px] px-4 py-2.5 shadow-[0_2px_10px_rgba(0,113,227,0.22)]">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 mr-1 font-medium flex items-center gap-1">
                                    <Bot className="w-3 h-3 text-[#0071E3]" />
                                    Responde Bot
                                  </span>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[11px] font-bold text-[#0071E3] dark:text-blue-400 shrink-0 mb-4 ring-1 ring-blue-500/20 shadow-2xs">
                                  <Bot className="w-3.5 h-3.5 text-[#0071E3]" />
                                </div>
                              </div>
                            </StaggerItem>
                          ) : (
                            <StaggerItem key={idx}>
                              <div className="flex items-end gap-2 justify-start">
                                <div
                                  className={`w-7 h-7 rounded-full ${selectedColor} flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-4 shadow-xs ring-1 ring-black/5`}
                                >
                                  {selectedInitials}
                                </div>
                                <div className="flex flex-col items-start max-w-[82%] sm:max-w-[74%]">
                                  <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-800 dark:text-slate-100 rounded-[20px] rounded-bl-[4px] px-4 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1 font-medium">
                                    {selectedConversation.name}
                                  </span>
                                </div>
                              </div>
                            </StaggerItem>
                          )
                        )}
                      </StaggerContainer>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="h-full flex-1 flex flex-col items-center justify-center p-8 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-inner">
                      <MessageSquare className="w-8 h-8 stroke-[1.5]" />
                    </div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                      No Conversation Selected
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[260px] mt-1">
                      Select an active conversation from the sidebar to inspect logs and AI bot exchanges.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}