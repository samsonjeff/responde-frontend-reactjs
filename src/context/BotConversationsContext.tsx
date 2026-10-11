import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';

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

export const initialBotConversations: BotConversation[] = [
  {
    id: "conv_1",
    psid: "1001",
    name: "Sedrick Opulencia",
    barangay: "Tumaway",
    type: "General",
    status: "Complete",
    time: "12:41",
    createdAt: "2026-10-11T12:41:00.000Z",
    messages: [
      { sender: "user", text: "May baha po ba sa Tumaway ngayon?" },
      { sender: "bot", text: "Magandang araw! Sa kasalukuyan, may bahagyang pagbaha sa mababang bahagi ng Tumaway dulot ng malakas na ulan. Pinapayuhan ang lahat na mag-ingat." },
    ],
  },
  {
    id: "conv_2",
    psid: "1002",
    name: "Maria Delos Santos",
    barangay: "Banga",
    type: "Emergency",
    status: "Complete",
    time: "12:36",
    createdAt: "2026-10-11T12:36:00.000Z",
    messages: [
      { sender: "user", text: "Nasira ang aming bubong sa lakas ng hangin" },
      { sender: "bot", text: "Nai-record na po ang inyong ulat. Ipinadala na po ito sa Talisay MDRRMO Emergency Response Team para sa agarang tulong." },
    ],
  },
  {
    id: "conv_3",
    psid: "1003",
    name: "Joshua Reyes",
    barangay: "Leynes",
    type: "Medical",
    status: "Complete",
    time: "12:30",
    createdAt: "2026-10-11T12:30:00.000Z",
    messages: [
      { sender: "user", text: "Kailangan po ng ambulance dito sa Leynes" },
      { sender: "bot", text: "Agad po naming ipinarating sa pinakamalapit na health center at rescue unit. Pakibantayan po ang inyong telepono para sa tawag ng responders." },
    ],
  },
  {
    id: "conv_4",
    psid: "1004",
    name: "Angeline Cruz",
    barangay: "Sampaloc",
    type: "General",
    status: "Incomplete",
    time: "12:22",
    createdAt: "2026-10-11T12:22:00.000Z",
    messages: [
      { sender: "user", text: "Saan po ang evacuation center dito sa Sampaloc?" },
      { sender: "bot", text: "Ang pinakamalapit na evacuation center para sa Sampaloc ay matatagpuan sa Sampaloc Elementary School Gymnasium." },
    ],
  },
  {
    id: "conv_5",
    psid: "1005",
    name: "Ferdinand Lim",
    barangay: "Santa Maria",
    type: "General",
    status: "Complete",
    time: "12:15",
    createdAt: "2026-10-11T12:15:00.000Z",
    messages: [
      { sender: "user", text: "May kuryente po ba sa Santa Maria ngayon?" },
      { sender: "bot", text: "Kasalukuyan pong may power interruption sa ilang bahagi ng Brgy. Santa Maria dahil sa natumbang linya ng kuryente. Inaayos na po ito ng BATELEC." },
    ],
  },
  {
    id: "conv_6",
    psid: "1006",
    name: "Divina Aquino",
    barangay: "Quiling",
    type: "Emergency",
    status: "Incomplete",
    time: "12:09",
    createdAt: "2026-10-11T12:09:00.000Z",
    messages: [
      { sender: "user", text: "Tulong po sa Quiling, may gumuguho na bahagi ng bundok" },
      { sender: "bot", text: "Naiulat na po ang landslide alert sa Incident Commander. Mangyaring lumikas agad sa mas ligtas na lugar." },
    ],
  },
  {
    id: "conv_7",
    psid: "1007",
    name: "Kenneth Bautista",
    barangay: "Poblacion Barangay 1",
    type: "Medical",
    status: "Complete",
    time: "11:58",
    createdAt: "2026-10-11T11:58:00.000Z",
    messages: [
      { sender: "user", text: "Humingi po kami ng first aid supplies para sa evacuation center sa Poblacion." },
      { sender: "bot", text: "Natanggap na po ang request para sa medical supplies sa Poblacion Barangay 1 Evacuation Center." },
    ],
  },
  {
    id: "conv_8",
    psid: "1008",
    name: "Rowena Alcantara",
    barangay: "Aya",
    type: "Food & Water",
    status: "Incomplete",
    time: "11:45",
    createdAt: "2026-10-11T11:45:00.000Z",
    messages: [
      { sender: "user", text: "Kailangan po ng malinis na inuming tubig sa Aya." },
      { sender: "bot", text: "Naitala na po ang inyong kahilingan para sa relief goods at inuming tubig sa Brgy. Aya." },
    ],
  },
  {
    id: "conv_9",
    psid: "1009",
    name: "Joel Hernandez",
    barangay: "Balas",
    type: "Search & Rescue",
    status: "Complete",
    time: "11:32",
    createdAt: "2026-10-11T11:32:00.000Z",
    messages: [
      { sender: "user", text: "Naanod po ang bangka malapit sa Balas Wharf, ligtas naman po ang mangingisda." },
      { sender: "bot", text: "Salamat sa impormasyon. Naipaalam na po sa MDRRMO Coast Guard Unit." },
    ],
  },
  {
    id: "conv_10",
    psid: "1010",
    name: "Patricia Lim",
    barangay: "Caloocan",
    type: "Infrastructure",
    status: "Incomplete",
    time: "11:15",
    createdAt: "2026-10-11T11:15:00.000Z",
    messages: [
      { sender: "user", text: "May natumbang puno sa kalsada ng Caloocan, hindi makadaan ang mga sasakyan." },
      { sender: "bot", text: "Ipinadala na po ang clearing team ng engineering department upang hawanin ang daan sa Caloocan." },
    ],
  },
  {
    id: "conv_11",
    psid: "1011",
    name: "Vicente Laurel",
    barangay: "Miranda",
    type: "Emergency",
    status: "Complete",
    time: "11:00",
    createdAt: "2026-10-11T11:00:00.000Z",
    messages: [
      { sender: "user", text: "May pagguho ng lupa sa gilid ng burol sa Miranda Ridge." },
      { sender: "bot", text: "Pumunta na po ang rescue team upang gabayan ang evacuation sa Miranda Ridge." },
    ],
  },
  {
    id: "conv_12",
    psid: "1012",
    name: "Marlon De Silva",
    barangay: "Buco",
    type: "Food & Water",
    status: "Complete",
    time: "10:45",
    createdAt: "2026-10-11T10:45:00.000Z",
    messages: [
      { sender: "user", text: "Nawalan po ng supply ng tubig sa Buco Outpost." },
      { sender: "bot", text: "Na-dispatch na po ang water tanker patungo sa Buco Outpost." },
    ],
  },
  {
    id: "conv_13",
    psid: "1013",
    name: "Rommel Catapang",
    barangay: "San Guillermo",
    type: "Search & Rescue",
    status: "Incomplete",
    time: "10:20",
    createdAt: "2026-10-11T10:20:00.000Z",
    messages: [
      { sender: "user", text: "May mga magsasaka pong naipit sa umapaw na sapa sa San Guillermo." },
      { sender: "bot", text: "Ipinapadala na po ang rescue boat team sa San Guillermo farmlands." },
    ],
  },
  {
    id: "conv_14",
    psid: "1014",
    name: "Lourdes Reyes",
    barangay: "Tranca",
    type: "Medical",
    status: "Complete",
    time: "10:05",
    createdAt: "2026-10-11T10:05:00.000Z",
    messages: [
      { sender: "user", text: "Kailangan po ng maintenance medicine para sa mga senior sa evacuation ng Tranca." },
      { sender: "bot", text: "Naihatid na po sa Municipal Health Office ang listahan ng gamot para sa Tranca." },
    ],
  },
];

const STORAGE_KEY = 'responde_bot_status_overrides_v2';
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
      barangay: string;
      type: string;
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
        : (row.intent && String(row.intent).trim() ? String(row.intent).trim() : '');
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
          barangay: rowBarangay,
          type: rowType,
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
        if (!session.barangay && rowBarangay) {
          session.barangay = rowBarangay;
        }
        if (!session.type && rowType) {
          session.type = rowType;
        }
        if (rowNeedsReview) {
          session.needsReview = true;
        }
      }

      if (row.user_message) session.messages.push({ sender: 'user', text: row.user_message, timestamp: row.timestamp });
      if (row.ai_reply) session.messages.push({ sender: 'bot', text: row.ai_reply, timestamp: row.timestamp });
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
          const calculatedStatus = session.needsReview || !session.barangay ? 'Incomplete' : 'Complete';

          return {
            id: session.id,
            psid: session.psid,
            name:
              session.senderName !== 'Unknown User'
                ? session.senderName
                : `PSID: ${session.psid.slice(-6)}`,
            barangay: session.barangay ? normalizeBarangayName(session.barangay) : 'General',
            type: session.type ? titleCase(session.type) : 'Emergency',
            status: override || calculatedStatus,
            time: timeFormatted,
            createdAt: new Date(session.lastTime).toISOString(),
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
