import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';
import { formatTimestampPHT } from '../utils/dateUtils';
import { apiRequest } from '../services/apiClient';
import { isIncidentIntent, normalizeIntent } from '../utils/intentUtils';
import { formatReportType, formatReportUrgency } from '../services/incidentService';

// ── Types ──
export interface BotMessage {
  sender: 'bot' | 'user';
  text: string;
  timestamp?: string;
}

export interface BotConversation {
  id: string;
  psid: string;
  name: string;
  barangay: string;
  type: string;
  urgency?: string;
  intent?: string;
  status: 'Incomplete' | 'Complete';
  time: string;
  createdAt?: string;
  messages: BotMessage[];
}

function titleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeBarangayName(name: string): string {
  if (!name) return 'General';
  const trimmed = name.trim();
  const matched = TALISAY_BARANGAYS.find(
    (b) => b.toLowerCase() === trimmed.toLowerCase()
  );
  if (matched) return matched;
  const cleaned = trimmed.replace(/^(brgy\.?|barangay)\s+/i, '');
  const matchedCleaned = TALISAY_BARANGAYS.find(
    (b) => b.toLowerCase() === cleaned.toLowerCase()
  );
  if (matchedCleaned) return matchedCleaned;
  return titleCase(trimmed);
}

export const initialBotConversations: BotConversation[] = [];

const STORAGE_KEY = 'responde_bot_status_overrides_v2';
const BOT_CONVERSATIONS_CACHE_KEY = 'responde_cached_bot_conversations';
const INACTIVITY_GAP_MS = 60 * 60 * 1000;
const POLL_INTERVAL_MS = 60_000; // 60s standard poll interval to reduce server pressure
const BACKOFF_INTERVAL_MS = 120_000; // 2 min backoff when rate-limited

const getInitialOverrides = (): Record<string, 'Incomplete' | 'Complete'> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

interface BotConversationsContextValue {
  conversations: BotConversation[];
  updateConversationStatus: (id: string, newStatus: 'Incomplete' | 'Complete') => void;
  loading: boolean;
  error: string | null;
  refetchConversations: () => Promise<void>;
  incompleteCount: number;
}

const BotConversationsContext = createContext<BotConversationsContextValue | null>(null);

export function BotConversationsProvider({ children }: { children: ReactNode }) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'Incomplete' | 'Complete'>>(getInitialOverrides);
  const statusOverridesRef = useRef(statusOverrides);
  statusOverridesRef.current = statusOverrides;

  const [conversations, setConversations] = useState<BotConversation[]>(() => {
    const overrides = getInitialOverrides();
    try {
      const cached = sessionStorage.getItem(BOT_CONVERSATIONS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as BotConversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c) => ({
            ...c,
            status: overrides[c.id] || c.status,
          }));
        }
      }
    } catch {}
    return initialBotConversations.map((c) => ({
      ...c,
      status: overrides[c.id] || c.status,
    }));
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const updateConversationStatus = useCallback((id: string, newStatus: 'Incomplete' | 'Complete') => {
    setStatusOverrides((prev) => {
      const updated = { ...prev, [id]: newStatus };
      statusOverridesRef.current = updated;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save status override to localStorage:', err);
      }
      return updated;
    });

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );
  }, []);

  const fetchConversations = useCallback(async (isFirst = false, signal?: AbortSignal, forceRefresh = false) => {
    if (isFirst) setLoading(true);

    let data: any[] | null = null;
    try {
      // 1. Fetch directly from Supabase conversations table
      const { data: supaRows, error: supaErr } = await supabase
        .from('conversations')
        .select('*')
        .order('timestamp', { ascending: true });

      if (!supaErr && Array.isArray(supaRows) && supaRows.length > 0) {
        data = supaRows;
        setError(null);
      } else {
        // Fallback to backend API
        const json = await apiRequest<{ data?: any[] }>(
          '/api/auth/data/conversations?limit=500',
          {
            signal,
            forceRefresh,
            cacheTtlMs: 8000,
          }
        );
        data = (json.data ?? []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setError(null);
      }
    } catch (netErr: any) {
      if (netErr.name === 'AbortError') return;
      console.warn('[BotConversationsContext] Fetch warning:', netErr.message);
      // Only set error state if we have no conversations yet to prevent screen-blanking
      setError((prev) => (conversationsRef.current.length === 0 ? (netErr.message || 'Failed to fetch conversations') : prev));
      if (isFirst) setLoading(false);
      return;
    }

    type Session = {
      id: string;
      psid: string;
      senderName: string;
      lastTime: number;
      barangay: string;
      type: string;
      urgency: string;
      intent: string;
      hasIncidentIntent: boolean;
      needsReview: boolean;
      messages: BotMessage[];
    };

    const psidNameMap = new Map<string, string>();
    for (const row of data ?? []) {
      const psid = String(row.sender_psid || row.id || 'unknown');
      const name = row.sender_name;
      if (name && name !== 'Unknown User' && !psidNameMap.has(psid)) {
        psidNameMap.set(psid, name);
      }
    }

    function isRealType(t?: string | null): boolean {
      if (!t) return false;
      const l = t.trim().toLowerCase();
      return !['none', 'null', 'undefined', 'unclassified', 'unknown', 'n/a'].includes(l);
    }

    function isRealBarangay(b?: string | null): boolean {
      if (!b) return false;
      const l = b.trim().toLowerCase();
      return !['unknown', 'none', 'null', 'unspecified', 'n/a', 'general'].includes(l);
    }

    const sessions: Session[] = [];
    const psidToLastIdx = new Map<string, number>();

    for (const row of data ?? []) {
      const psid = String(row.sender_psid || row.id || 'unknown');
      const rowTime = new Date(row.timestamp).getTime();
      const lastIdx = psidToLastIdx.get(psid);
      const resolvedName = psidNameMap.get(psid) ?? 'Unknown User';
      const rowBarangay = row.barangay && String(row.barangay).trim() ? String(row.barangay).trim() : '';
      const rowType = row.incident_type && String(row.incident_type).trim()
        ? String(row.incident_type).trim()
        : '';
      const rowIntent = row.intent && String(row.intent).trim() ? String(row.intent).trim() : 'OTHER';
      const isRowIncident = isIncidentIntent(rowIntent);
      const rowUrgency = row.urgency && String(row.urgency).trim() ? String(row.urgency).trim() : 'Low';

      const rowNeedsReview = Boolean(
        row.needs_review === true ||
        row.location_status === 'not_found' ||
        (!rowBarangay || rowBarangay.toLowerCase() === 'unknown')
      );

      let session: Session;
      if (lastIdx === undefined || rowTime - sessions[lastIdx].lastTime > INACTIVITY_GAP_MS) {
        session = {
          id: `${psid}_${rowTime}`,
          psid,
          senderName: resolvedName,
          lastTime: rowTime,
          barangay: isRealBarangay(rowBarangay) ? rowBarangay : '',
          type: isRealType(rowType) ? rowType : '',
          urgency: rowUrgency,
          intent: rowIntent,
          hasIncidentIntent: isRowIncident,
          needsReview: rowNeedsReview,
          messages: [],
        };
        sessions.push(session);
        psidToLastIdx.set(psid, sessions.length - 1);
      } else {
        session = sessions[lastIdx];
        session.lastTime = rowTime;
        if (session.senderName === 'Unknown User' && resolvedName !== 'Unknown User') {
          session.senderName = resolvedName;
        }
        if (isRowIncident) {
          session.hasIncidentIntent = true;
          session.intent = rowIntent;
          if (rowUrgency) session.urgency = rowUrgency;
        } else if (!session.hasIncidentIntent && rowIntent) {
          session.intent = rowIntent;
        }
        if (isRealBarangay(rowBarangay)) {
          if (!isRealBarangay(session.barangay) || isRowIncident) {
            session.barangay = rowBarangay;
          }
        }
        if (isRealType(rowType)) {
          if (!isRealType(session.type) || isRowIncident) {
            session.type = rowType;
          }
        }
        if (rowNeedsReview) {
          session.needsReview = true;
        }
      }

      if (row.user_message) session.messages.push({ sender: 'user', text: row.user_message, timestamp: row.timestamp });
      if (row.ai_reply) {
        session.messages.push({ sender: 'bot', text: row.ai_reply, timestamp: row.timestamp });
      } else if (row.reply_status === 'pending') {
        session.messages.push({ sender: 'bot', text: '(Replying...)', timestamp: row.timestamp });
      } else if (row.reply_status === 'failed') {
        session.messages.push({ sender: 'bot', text: '[Failed to send reply]', timestamp: row.timestamp });
      }
    }

    if (sessions.length > 0) {
      const mapped: BotConversation[] = sessions
        .sort((a, b) => b.lastTime - a.lastTime)
        .map((session) => {
          const timeFormatted = formatTimestampPHT(session.lastTime);

          const override = statusOverridesRef.current[session.id];
          const calculatedStatus = session.needsReview || !session.barangay ? 'Incomplete' : 'Complete';

          return {
            id: session.id,
            psid: session.psid,
            name:
              session.senderName !== 'Unknown User'
                ? session.senderName
                : `PSID: ${session.psid.slice(-6)}`,
            barangay: isRealBarangay(session.barangay) ? normalizeBarangayName(session.barangay) : 'General',
            type: isRealType(session.type) ? formatReportType(session.type) : 'None',
            urgency: session.urgency ? formatReportUrgency(session.urgency) : 'Low',
            intent: normalizeIntent(session.intent),
            status: override || calculatedStatus,
            time: timeFormatted,
            createdAt: new Date(session.lastTime).toISOString(),
            messages: session.messages,
          };
        });

      try {
        sessionStorage.setItem(BOT_CONVERSATIONS_CACHE_KEY, JSON.stringify(mapped));
      } catch {}

      setConversations(mapped);
    } else {
      setConversations([]);
    }

    if (isFirst) setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchConversations(conversationsRef.current.length === 0, controller.signal);

    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const schedulePoll = (delay: number) => {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(async () => {
        // Pause polling when browser tab is hidden to save rate limit and bandwidth
        if (document.visibilityState !== 'visible') {
          schedulePoll(POLL_INTERVAL_MS);
          return;
        }

        try {
          await fetchConversations(false, controller.signal);
          schedulePoll(POLL_INTERVAL_MS);
        } catch (err: any) {
          const isRateLimit = err?.status === 429 || err?.isRateLimit;
          schedulePoll(isRateLimit ? BACKOFF_INTERVAL_MS : POLL_INTERVAL_MS);
        }
      }, delay);
    };

    schedulePoll(POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations(false, controller.signal);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      controller.abort();
      if (pollTimer) clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchConversations]);

  const incompleteCount = conversations.filter((c) => c.status === 'Incomplete').length;

  return (
    <BotConversationsContext.Provider
      value={{
        conversations,
        updateConversationStatus,
        loading,
        error,
        refetchConversations: () => fetchConversations(false),
        incompleteCount,
      }}
    >
      {children}
    </BotConversationsContext.Provider>
  );
}

export function useBotConversations() {
  const ctx = useContext(BotConversationsContext);
  if (!ctx) {
    throw new Error('useBotConversations must be used within a BotConversationsProvider');
  }
  return ctx;
}
