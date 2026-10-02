import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

// ── Types ──
export interface BotMessage {
  sender: 'bot' | 'user';
  text: string;
}

export interface BotConversation {
  id: string;
  psid: string;
  name: string;
  barangay: string;
  type: string;
  status: 'Incomplete' | 'Complete';
  time: string;
  messages: BotMessage[];
}

export const initialBotConversations: BotConversation[] = [
  {
    id: "conv_1",
    psid: "1001",
    name: "Sedrick Opulencia",
    barangay: "Tumaway",
    type: "General",
    status: "Complete",
    time: "12:41",
    messages: [
      { sender: "user", text: "May baha po ba sa Tumaway ngayon?" },
      { sender: "bot", text: "Magandang araw! Sa kasalukuyan, may bahagyang pagbaha sa mababang bahagi ng Tumaway dulot ng malakas na ulan. Pinapayuhan ang lahat na mag-ingat." },
    ],
  },
  {
    id: "conv_2",
    psid: "1002",
    name: "Maria Delos Santos",
    barangay: "San Pascual",
    type: "Emergency",
    status: "Complete",
    time: "12:36",
    messages: [
      { sender: "user", text: "Nasira ang aming bubong sa lakas ng hangin" },
      { sender: "bot", text: "Nai-record na po ang inyong ulat. Ipinadala na po ito sa Talisay MDRRMO Emergency Response Team para sa agarang tulong." },
    ],
  },
  {
    id: "conv_3",
    psid: "1003",
    name: "Joshua Reyes",
    barangay: "Burol",
    type: "Medical",
    status: "Complete",
    time: "12:30",
    messages: [
      { sender: "user", text: "Kailangan po ng ambulance dito sa Burol" },
      { sender: "bot", text: "Agad po naming ipinarating sa pinakamalapit na health center at rescue unit. Pakibantayan po ang inyong telepono para sa tawag ng responders." },
    ],
  },
  {
    id: "conv_4",
    psid: "1004",
    name: "Angeline Cruz",
    barangay: "San Isidro",
    type: "General",
    status: "Incomplete",
    time: "12:22",
    messages: [
      { sender: "user", text: "Saan po ang evacuation center?" },
      { sender: "bot", text: "Ang pinakamalapit na evacuation center para sa San Isidro ay matatagpuan sa San Isidro Elementary School Gymnasium." },
    ],
  },
  {
    id: "conv_5",
    psid: "1005",
    name: "Ferdinand Lim",
    barangay: "Dahlia",
    type: "General",
    status: "Complete",
    time: "12:15",
    messages: [
      { sender: "user", text: "May kuryente po ba sa ibabaw ng burol?" },
      { sender: "bot", text: "Kasalukuyan pong may power interruption sa ilang bahagi ng Brgy. Dahlia dahil sa natumbang linya ng kuryente. Inaayos na po ito ng BATELEC." },
    ],
  },
  {
    id: "conv_6",
    psid: "1006",
    name: "Divina Aquino",
    barangay: "Sampaguita",
    type: "Emergency",
    status: "Incomplete",
    time: "12:09",
    messages: [
      { sender: "user", text: "Tulong po, may gumuguho na bahagi ng bundok" },
      { sender: "bot", text: "Naiulat na po ang landslide alert sa Incident Commander. Mangyaring lumikas agad sa mas ligtas na lugar." },
    ],
  },
  {
    id: "conv_7",
    psid: "1007",
    name: "Kenneth Bautista",
    barangay: "Poblacion",
    type: "Medical",
    status: "Complete",
    time: "11:58",
    messages: [
      { sender: "user", text: "Humingi po kami ng first aid supplies para sa evacuation center." },
      { sender: "bot", text: "Natanggap na po ang request para sa medical supplies sa Poblacion Evacuation Center." },
    ],
  },
];

const STORAGE_KEY = 'responde_bot_status_overrides';
const INACTIVITY_GAP_MS = 60 * 60 * 1000;
const POLL_INTERVAL_MS = 30_000;

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
    return initialBotConversations.map((c) => ({
      ...c,
      status: overrides[c.id] || c.status,
    }));
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchConversations = useCallback(async (isFirst = false) => {
    if (isFirst) setLoading(true);
    setError(null);

    // Use authenticated backend API instead of direct Supabase anon access
    const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
    const storedToken = (() => { try { return localStorage.getItem('responde_session_token'); } catch { return null; } })();
    const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
    if (storedToken) hdrs['Authorization'] = `Bearer ${storedToken}`;

    let data: any[] | null = null;
    try {
      const res = await fetch(`${API_BASE}/api/auth/data/conversations?limit=500`, {
        credentials: 'include',
        headers: hdrs,
      });
      if (res.ok) {
        const json = await res.json();
        data = json.data ?? [];
      } else {
        const errJson = await res.json().catch(() => ({ error: res.statusText }));
        console.error('[BotConversationsContext] API error:', errJson.error);
        setError(errJson.error || 'Failed to fetch conversations');
        if (isFirst) setLoading(false);
        return;
      }
    } catch (netErr: any) {
      console.error('[BotConversationsContext] Network error:', netErr.message);
      setError(netErr.message || 'Network error');
      if (isFirst) setLoading(false);
      return;
    }

    const sbError = null; // kept for type compatibility below
    if (sbError) {
      if (isFirst) setLoading(false);
      return;
    }

    type Session = {
      id: string;
      psid: string;
      senderName: string;
      lastTime: number;
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

    const sessions: Session[] = [];
    const psidToLastIdx = new Map<string, number>();

    for (const row of data ?? []) {
      const psid = String(row.sender_psid || row.id || 'unknown');
      const rowTime = new Date(row.timestamp).getTime();
      const lastIdx = psidToLastIdx.get(psid);
      const resolvedName = psidNameMap.get(psid) ?? 'Unknown User';

      let session: Session;
      if (lastIdx === undefined || rowTime - sessions[lastIdx].lastTime > INACTIVITY_GAP_MS) {
        session = {
          id: `${psid}_${rowTime}`,
          psid,
          senderName: resolvedName,
          lastTime: rowTime,
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
      }

      if (row.user_message) session.messages.push({ sender: 'user', text: row.user_message });
      if (row.ai_reply) session.messages.push({ sender: 'bot', text: row.ai_reply });
    }

    if (sessions.length > 0) {
      const mapped: BotConversation[] = sessions
        .sort((a, b) => b.lastTime - a.lastTime)
        .map((session) => {
          const lastDate = new Date(session.lastTime);
          const timeFormatted = `${lastDate.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
          })} ${lastDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}`;

          const override = statusOverridesRef.current[session.id];
          return {
            id: session.id,
            psid: session.psid,
            name:
              session.senderName !== 'Unknown User'
                ? session.senderName
                : `PSID: ${session.psid.slice(-6)}`,
            barangay: 'General',
            type: 'Emergency',
            status: override || 'Complete',
            time: timeFormatted,
            messages: session.messages,
          };
        });

      setConversations(mapped);
    } else {
      // Keep sample conversations merged with latest overrides
      const overrides = statusOverridesRef.current;
      setConversations(
        initialBotConversations.map((c) => ({
          ...c,
          status: overrides[c.id] || c.status,
        }))
      );
    }

    if (isFirst) setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations(true);
    const interval = setInterval(() => fetchConversations(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
