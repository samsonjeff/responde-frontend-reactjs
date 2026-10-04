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

const fromConversation = (row: ConversationRow): Report => ({
  id: `conv-${row.id}`,
  barangay: row.barangay ? titleCase(row.barangay) : 'Unknown',
  type: row.incident_type ? titleCase(row.incident_type) : 'Unclassified',
  urgency: normalizeUrgency(row.urgency),
  source: 'Bot',
  time: formatTime(row.timestamp),
  createdAt: row.timestamp,
  status: 'under_review',
  description: row.user_message ?? '',
  originalText: row.user_message ?? '',
  reporter: row.sender_name ?? 'Unknown',
  contact: formatContacts(row.contact_numbers),
  coordinates: '',
  landmark: row.location_status === 'not_found' ? '' : (row.location_status ?? ''),
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  possibleDuplicateOf: null,
});

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

  const reports = [
    ...((convRes.data ?? []) as ConversationRow[]).map(fromConversation),
    ...((fbRes.data ?? []) as FbCommentRow[]).map(fromFbComment),
  ];

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
