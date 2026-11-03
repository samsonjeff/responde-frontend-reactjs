import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  MapPin,
  AlertTriangle,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Globe,
  Map as MapIcon,
  BarChart3,
  Settings,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useBotConversations } from '../context/BotConversationsContext';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';
import { formatReportCode } from '../services/incidentService';
import { useAuth } from '../context/AuthContext';

// Ambatubazz smooth Apple quadratic deceleration curve
const APPLE_DECEL_EASE = [0.25, 0.46, 0.45, 0.94] as const;

interface SearchItem {
  id: string;
  category: 'Barangay' | 'Incident' | 'Page' | 'Message';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  action: () => void;
}

/** Helper component to highlight matching search characters */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100 font-semibold rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reports } = useReports();
  const { conversations } = useBotConversations();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // App Pages definition with icons & access roles
  const appPages = useMemo(() => {
    const list = [
      {
        id: 'page-overview',
        title: 'Overview',
        subtitle: 'Emergency feed & operational overview',
        path: '/dashboard',
        icon: <LayoutDashboard className="w-4 h-4 text-blue-500" strokeWidth={1.75} />,
      },
      {
        id: 'page-incidents',
        title: 'Incident Reports',
        subtitle: 'Review & verify field emergency reports',
        path: '/incident-reports',
        icon: <FileText className="w-4 h-4 text-indigo-500" strokeWidth={1.75} />,
      },
      {
        id: 'page-logs',
        title: 'Messenger Logs',
        subtitle: 'Chatbot transcripts & resident communications',
        path: '/messenger-bot-logs',
        icon: <MessageSquare className="w-4 h-4 text-sky-500" strokeWidth={1.75} />,
      },
      {
        id: 'page-feed',
        title: 'Scraper Feed',
        subtitle: 'Social media hazard & disaster monitor',
        path: '/scraper-feed',
        icon: <Globe className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />,
      },
      {
        id: 'page-map',
        title: 'Geospatial Map',
        subtitle: 'Talisay hazard heatmap & GPS pins',
        path: '/geospatial-map',
        icon: <MapIcon className="w-4 h-4 text-amber-500" strokeWidth={1.75} />,
      },
      {
        id: 'page-analytics',
        title: 'Analytics',
        subtitle: 'Incident trends & barangay statistics',
        path: '/analytics',
        icon: <BarChart3 className="w-4 h-4 text-purple-500" strokeWidth={1.75} />,
      },
    ];

    if (user?.role === 'admin' || user?.role === 'super_admin') {
      list.push({
        id: 'page-settings',
        title: 'Settings',
        subtitle: 'Team members, security & access controls',
        path: '/settings',
        icon: <Settings className="w-4 h-4 text-slate-500" strokeWidth={1.75} />,
      });
    }

    return list;
  }, [user?.role]);

  // Execute a selected result
  const handleSelect = useCallback((item: SearchItem) => {
    item.action();
    setIsOpen(false);
    setIsMobileOpen(false);
    setQuery('');
  }, []);

  // Compute search results across 4 structured categories in memory
  const results = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: SearchItem[] = [];

    // 1. BARANGAYS (Max 3)
    const matchingBarangays = TALISAY_BARANGAYS.filter((b) =>
      b.toLowerCase().includes(q)
    ).slice(0, 3);

    matchingBarangays.forEach((b) => {
      items.push({
        id: `brgy-${b}`,
        category: 'Barangay',
        title: b,
        subtitle: 'Talisay, Batangas • View on Geospatial Map',
        icon: <MapPin className="w-4 h-4 text-blue-500" strokeWidth={1.75} />,
        action: () => navigate(`/geospatial-map?barangay=${encodeURIComponent(b)}`),
      });
    });

    // 2. INCIDENT REPORTS (Max 3)
    const matchingReports = (reports || [])
      .filter((r) => {
        const code = formatReportCode(r.id).toLowerCase();
        const type = (r.type || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        const reporter = (r.reporter || '').toLowerCase();
        const landmark = (r.landmark || '').toLowerCase();
        const brgy = (r.barangay || '').toLowerCase();
        return (
          code.includes(q) ||
          type.includes(q) ||
          desc.includes(q) ||
          reporter.includes(q) ||
          landmark.includes(q) ||
          brgy.includes(q)
        );
      })
      .slice(0, 3);

    matchingReports.forEach((r) => {
      const code = formatReportCode(r.id);
      const isHigh = (r.urgency || '').toLowerCase() === 'high';
      const badgeColor = isHigh
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

      const detail = r.landmark || r.description ? ` — ${(r.landmark || r.description).slice(0, 48)}...` : '';

      items.push({
        id: `inc-${r.id}`,
        category: 'Incident',
        title: `${code}: ${r.type || 'Incident Report'}`,
        subtitle: `${r.barangay || 'Talisay'} • ${r.reporter || 'Anonymous'}${detail}`,
        badge: r.urgency || r.status || 'Active',
        badgeColor,
        icon: <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={1.75} />,
        action: () => navigate(`/incident-reports?focus=${r.id}`),
      });
    });

    // 3. PAGES (Max 3)
    const matchingPages = appPages
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q)
      )
      .slice(0, 3);

    matchingPages.forEach((p) => {
      items.push({
        id: p.id,
        category: 'Page',
        title: p.title,
        subtitle: p.subtitle,
        icon: p.icon,
        action: () => navigate(p.path),
      });
    });

    // 4. MESSENGER LOGS (Max 2 — searches caller, barangay & latest message snippet only)
    const matchingConvs = (conversations || [])
      .filter((c) => {
        const name = (c.name || '').toLowerCase();
        const brgy = (c.barangay || '').toLowerCase();
        const type = (c.type || '').toLowerCase();
        const lastMsg = (c.messages?.[c.messages.length - 1]?.text || '').toLowerCase();
        return name.includes(q) || brgy.includes(q) || type.includes(q) || lastMsg.includes(q);
      })
      .slice(0, 2);

    matchingConvs.forEach((c) => {
      const lastMsg = c.messages?.[c.messages.length - 1]?.text;
      items.push({
        id: `conv-${c.id}`,
        category: 'Message',
        title: `${c.name || 'Resident'} (${c.barangay || 'General'})`,
        subtitle: lastMsg ? `"${lastMsg.slice(0, 52)}..."` : 'Messenger Conversation',
        badge: c.type || c.status,
        badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
        icon: <MessageSquare className="w-4 h-4 text-sky-500" strokeWidth={1.75} />,
        action: () => navigate(`/messenger-bot-logs?focus=${c.id}`),
      });
    });

    return items;
  }, [query, reports, conversations, appPages, navigate]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Global Ctrl+K / Cmd+K listener & open-global-search custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setIsMobileOpen(true);
        } else {
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
    };

    const handleOpenEvent = () => {
      if (window.innerWidth < 640) {
        setIsMobileOpen(true);
      } else {
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-global-search', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-global-search', handleOpenEvent);
    };
  }, []);

  // Handle keyboard navigation within results
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus mobile input when mobile modal opens
  useEffect(() => {
    if (isMobileOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 80);
    }
  }, [isMobileOpen]);

  // Group results by category for display
  const categorized = useMemo(() => {
    const groups: { name: string; items: SearchItem[] }[] = [];
    const catMap = new Map<string, SearchItem[]>();

    results.forEach((item) => {
      const existing = catMap.get(item.category) || [];
      existing.push(item);
      catMap.set(item.category, existing);
    });

    const categoryOrder: ('Barangay' | 'Incident' | 'Page' | 'Message')[] = [
      'Barangay',
      'Incident',
      'Page',
      'Message',
    ];

    categoryOrder.forEach((cat) => {
      const items = catMap.get(cat);
      if (items && items.length > 0) {
        let label = 'Locations';
        if (cat === 'Incident') label = 'Incident Reports';
        if (cat === 'Page') label = 'Pages & Navigation';
        if (cat === 'Message') label = 'Messenger Logs';
        groups.push({ name: label, items });
      }
    });

    return groups;
  }, [results]);

  return (
    <>
      {/* ── DESKTOP SEARCH BAR (sm and up) ── */}
      <div ref={containerRef} className="hidden sm:flex items-center relative flex-1 max-w-sm">
        <div
          className={`
            w-full flex items-center gap-2 px-3 py-1.5
            bg-white/50 dark:bg-slate-800/60
            border border-white/60 dark:border-white/10
            shadow-sm
            rounded-xl
            backdrop-blur-md
            transition-all duration-200
            focus-within:bg-white/80 dark:focus-within:bg-slate-800/90
            focus-within:border-blue-400/60 dark:focus-within:border-blue-500/50
            focus-within:shadow-[0_4px_16px_rgba(59,130,246,0.14),inset_0_1px_2px_rgba(255,255,255,0.8)]
            dark:focus-within:shadow-[0_4px_16px_rgba(59,130,246,0.22)]
            ${isOpen && query.trim() ? 'ring-2 ring-blue-500/20 border-blue-500/70' : ''}
          `}
        >
          <Search className="shrink-0 w-4 h-4 text-slate-400 dark:text-slate-500" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search incidents, logs, or barangays..."
            className="w-full bg-transparent border-0 text-xs sm:text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />

          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer shrink-0"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          ) : (
            <kbd
              onClick={() => inputRef.current?.focus()}
              className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-white/10 rounded-md shadow-2xs select-none shrink-0 cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-colors"
              title="Press ⌘K or Ctrl+K to search"
            >
              <span className="text-[11px] leading-none">⌘</span>
              <span>K</span>
            </kbd>
          )}
        </div>

        {/* ── DESKTOP DROPDOWN FLYOUT ── */}
        <AnimatePresence>
          {isOpen && query.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: APPLE_DECEL_EASE }}
              className="absolute left-0 top-full mt-2 w-full sm:w-[460px] max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_24px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)] rounded-2xl overflow-hidden z-[150]"
            >
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1.5 bg-white dark:bg-slate-900">
                {results.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No matches found for <strong className="text-slate-700 dark:text-slate-200 font-semibold">&ldquo;{query}&rdquo;</strong>
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Try searching by barangay (e.g. <em>Tranca</em>), report code (e.g. <em>INC-</em>), or page name.
                    </p>
                  </div>
                ) : (
                  categorized.map((group) => (
                    <div key={group.name} className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {group.name}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const flatIndex = results.findIndex((r) => r.id === item.id);
                          const isSelected = flatIndex === selectedIndex;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(flatIndex)}
                              className={`
                                w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer
                                ${isSelected ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'}
                              `}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                  {item.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs sm:text-sm font-semibold truncate leading-tight">
                                    <HighlightMatch text={item.title} query={query} />
                                  </div>
                                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-mono">
                                    <HighlightMatch text={item.subtitle} query={query} />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {item.badge && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                                    {item.badge}
                                  </span>
                                )}
                                <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-0.5 text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Status Footer */}
              <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <span>
                  {results.length} {results.length === 1 ? 'match' : 'matches'}
                </span>
                <span className="flex items-center gap-2">
                  <span>↑↓ navigate</span>
                  <span>↵ select</span>
                  <span>esc close</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MOBILE FULL-SCREEN / SHEET SEARCH MODAL ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[150] bg-slate-950/50 dark:bg-black/75 backdrop-blur-md p-3 sm:hidden flex flex-col justify-start"
          >
            <motion.div
              initial={{ scale: 0.96, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: -10 }}
              transition={{ duration: 0.22, ease: APPLE_DECEL_EASE }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden mt-2"
            >
              {/* Header input bar */}
              <div className="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <Search className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search incidents, barangays, pages..."
                  className="w-full bg-transparent border-0 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>

              {/* Scrollable results container */}
              <div className="overflow-y-auto flex-1 p-2 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {!query.trim() ? (
                  <div className="py-8 px-4 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Type anything to search across Talisay barangays, incident reports, and pages.
                    </p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No matches found for &ldquo;{query}&rdquo;
                    </p>
                  </div>
                ) : (
                  categorized.map((group) => (
                    <div key={group.name} className="py-1.5">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {group.name}
                      </div>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl text-left bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 active:bg-blue-50 dark:active:bg-blue-950/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                {item.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                  <HighlightMatch text={item.title} query={query} />
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-mono">
                                  <HighlightMatch text={item.subtitle} query={query} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${item.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                                  {item.badge}
                                </span>
                              )}
                              <CornerDownLeft className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
