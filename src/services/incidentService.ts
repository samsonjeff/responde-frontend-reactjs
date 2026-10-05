import { supabase } from '../lib/supabaseClient';

export type ReportStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'resolved';

export interface Report {
  id: string;
  barangay: string;
  type: string;
  urgency: string;
  source: string;
  time: string;
  createdAt: string;
  senderPsid?: string;
  conversationId?: string;
  threadMessages?: Array<{ sender: 'user' | 'bot'; text: string; timestamp?: string }>;
  status: ReportStatus;
  description: string;
  originalText: string;
  reporter: string;
  contact: string;
  coordinates: string;
  landmark: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  possibleDuplicateOf: string | null;
}

// ── Raw rows ──
interface ConversationRow {
  id: number;
  conversation_id: string;
  sender_psid: string;
  user_message: string | null;
  ai_reply: string | null;
  timestamp: string;
  sender_name: string | null;
  ml_status: string | null;
  location_status: string | null;
  barangay: string | null;
  contact_numbers: string | string[] | null;
  intent: string | null;
  urgency: string | null;
  incident_type: string | null;
  needs_review: boolean | null;
}

interface FbCommentRow {
  id: string;
  post_id: string;
  user_name: string | null;
  comment_text: string | null;
  comment_date: string | null;
  comment_time: string | null;
  barangay: string | null;
  incident_type: string | null;
  created_at: string;
  status: string | null;
}

// ── Helpers ──
const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};

const normalizeUrgency = (value: string | null): string => {
  const v = (value ?? '').toLowerCase();
  if (v === 'high' || v === 'critical') return 'High';
  if (v === 'moderate' || v === 'medium') return 'Moderate';
  if (v === 'low') return 'Low';
  return 'Low';
};

const formatContacts = (value: string | string[] | null): string => {
  if (!value) return '—';
  return Array.isArray(value) ? value.join(', ') : value;
};

// ── Group Conversation Rows into One Incident Report Per Session ──
const groupConversationRows = (convRows: ConversationRow[]): Report[] => {
  if (!convRows || convRows.length === 0) return [];

  // Sort chronologically (earliest to latest)
  const sorted = [...convRows].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const groups: ConversationRow[][] = [];
  const groupMap = new Map<string, number>();

  for (const row of sorted) {
    const psid = String(row.sender_psid || 'unknown');
    const convId = row.conversation_id ? String(row.conversation_id) : null;
    const time = new Date(row.timestamp).getTime();

    // 1. If conversation_id is provided, group strictly by conversation_id
    if (convId && groupMap.has(convId)) {
      groups[groupMap.get(convId)!].push(row);
      continue;
    }

    // 2. Otherwise check for an active session with this sender_psid within 1 hour
    let matchedIndex = -1;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      const lastRow = g[g.length - 1];
      if (String(lastRow.sender_psid) === psid) {
        const lastTime = new Date(lastRow.timestamp).getTime();
        if (Math.abs(time - lastTime) <= 60 * 60 * 1000) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex !== -1) {
      groups[matchedIndex].push(row);
      if (convId) groupMap.set(convId, matchedIndex);
    } else {
      const newIndex = groups.length;
      groups.push([row]);
      if (convId) groupMap.set(convId, newIndex);
    }
  }

  // Transform each group into a single consolidated Report
  return groups.map((rows) => {
    const firstRow = rows[0];
    const latestRow = rows[rows.length - 1];

    // Build ordered chat thread messages
    const threadMessages: Array<{ sender: 'user' | 'bot'; text: string; timestamp?: string }> = [];
    for (const r of rows) {
      if (r.user_message && r.user_message.trim()) {
        threadMessages.push({
          sender: 'user',
          text: r.user_message.trim(),
          timestamp: r.timestamp,
        });
      }
      if (r.ai_reply && r.ai_reply.trim()) {
        threadMessages.push({
          sender: 'bot',
          text: r.ai_reply.trim(),
          timestamp: r.timestamp,
        });
      }
    }

    // Filter out trivial confirmations ("tama", "yes", "oki", etc.) to extract meaningful report text
    const isTrivial = (txt: string) =>
      /^(tama|yes|oo|opo|ok|oki|sige|yes po|opo tama|salamat|thanks)$/i.test(txt.trim());

    const userMsgs = rows
      .map((r) => r.user_message?.trim())
      .filter((m): m is string => Boolean(m && m.length > 0));

    const substantiveMsg =
      userMsgs.find((m) => !isTrivial(m) && m.length > 10) ||
      userMsgs.find((m) => !isTrivial(m)) ||
      userMsgs[0] ||
      '';

    // Find best extracted values across conversation rows
    const foundBarangay = rows
      .slice()
      .reverse()
      .find((r) => r.barangay && r.barangay.trim().length > 0)?.barangay;

    const foundType = rows
      .slice()
      .reverse()
      .find((r) => r.incident_type && r.incident_type.trim().length > 0)?.incident_type;

    const foundUrgency = rows
      .slice()
      .reverse()
      .find((r) => r.urgency && r.urgency.trim().length > 0)?.urgency;

    const foundContact = rows
      .slice()
      .reverse()
      .find(
        (r) =>
          r.contact_numbers &&
          (Array.isArray(r.contact_numbers)
            ? r.contact_numbers.length > 0
            : String(r.contact_numbers).trim().length > 0)
      )?.contact_numbers;

    const foundLocation = rows
      .slice()
      .reverse()
      .find(
        (r) =>
          r.location_status &&
          r.location_status !== 'not_found' &&
          r.location_status.trim().length > 0
      )?.location_status;

    const reporterName =
      rows.find((r) => r.sender_name && r.sender_name !== 'Unknown User')?.sender_name ||
      firstRow.sender_name ||
      (firstRow.sender_psid ? `PSID: ${String(firstRow.sender_psid).slice(-6)}` : 'Unknown User');

    // Use latest row ID so it references the final turn of this conversation session
    const reportId = `conv-${latestRow.id}`;

    return {
      id: reportId,
      barangay: foundBarangay ? titleCase(foundBarangay) : 'Unknown',
      type: foundType ? titleCase(foundType) : 'Unclassified',
      urgency: normalizeUrgency(foundUrgency || null),
      source: 'Bot',
      time: formatTime(latestRow.timestamp),
      createdAt: latestRow.timestamp,
      senderPsid: firstRow.sender_psid,
      conversationId: firstRow.conversation_id,
      threadMessages,
      status: 'under_review',
      description: substantiveMsg,
      originalText: substantiveMsg,
      reporter: reporterName,
      contact: formatContacts(foundContact || null),
      coordinates: '',
      landmark: foundLocation ?? '',
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null,
      possibleDuplicateOf: null,
    };
  });
};

const fromFbComment = (row: FbCommentRow): Report => {
  const created = row.comment_date && row.comment_time
    ? `${row.comment_date}T${row.comment_time}`
    : row.created_at;
  return {
    id: `fb-${row.id}`,
    barangay: row.barangay ? titleCase(row.barangay) : 'Unknown',
    type: row.incident_type ? titleCase(row.incident_type) : 'Unclassified',
    urgency: 'Low',
    source: 'Scraper',
    time: formatTime(created),
    createdAt: created,
    status: 'under_review',
    description: row.comment_text ?? '',
    originalText: row.comment_text ?? '',
    reporter: row.user_name ?? 'Unknown',
    contact: '—',
    coordinates: '',
    landmark: '',
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: null,
    possibleDuplicateOf: null,
  };
};

/** Fetch Messenger-bot conversations and Facebook comments, merged newest first. */
export async function fetchReports(): Promise<Report[]> {
  const [convRes, fbRes] = await Promise.all([
    supabase.from('conversations').select('*').order('timestamp', { ascending: false }),
    supabase.from('fb_comments').select('*').order('created_at', { ascending: false }),
  ]);

  if (convRes.error) throw convRes.error;
  if (fbRes.error) throw fbRes.error;

  const botReports = groupConversationRows((convRes.data ?? []) as ConversationRow[]);
  const fbReports = ((fbRes.data ?? []) as FbCommentRow[]).map(fromFbComment);

  const reports = [...botReports, ...fbReports];

  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Subscribe to inserts/updates on both tables. Returns an unsubscribe function. */
export function subscribeToReports(onChange: () => void): () => void {
  const channel = supabase
    .channel('incident-reports-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fb_comments' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
