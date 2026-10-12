import { supabase } from '../lib/supabaseClient';
import { apiFetch } from './authService';

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
  action?: string;
  actionTaken?: string;
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
  status?: string | null;
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
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.filter((p) => p && p !== '—').join(', ');
  }
  return value === '—' ? '' : value;
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

    // Resolve status from latestRow or any turn in the session
    const statusRow = rows.slice().reverse().find((r) => r.status && r.status.trim().length > 0);
    const rawStatus = (statusRow?.status || latestRow.status || '').toLowerCase().trim();
    const resolvedStatus: ReportStatus =
      rawStatus === 'verified' ? 'verified' :
      rawStatus === 'resolved' ? 'resolved' :
      rawStatus === 'rejected' ? 'rejected' :
      rawStatus === 'pending' ? 'pending' : 'under_review';

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
      status: resolvedStatus,
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
  const rawStatus = (row.status || '').toLowerCase().trim();
  const resolvedStatus: ReportStatus =
    rawStatus === 'verified' ? 'verified' :
    rawStatus === 'resolved' ? 'resolved' :
    rawStatus === 'flagged' || rawStatus === 'rejected' ? 'rejected' :
    rawStatus === 'pending' ? 'pending' : 'under_review';

  return {
    id: `fb-${row.id}`,
    barangay: row.barangay ? titleCase(row.barangay) : 'Unknown',
    type: row.incident_type ? titleCase(row.incident_type) : 'Unclassified',
    urgency: 'Low',
    source: 'Scraper',
    time: formatTime(created),
    createdAt: created,
    status: resolvedStatus,
    description: row.comment_text ?? '',
    originalText: row.comment_text ?? '',
    reporter: row.user_name ?? 'Unknown',
    contact: '',
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
  const [convRes, fbRes, incRes] = await Promise.all([
    supabase.from('conversations').select('*').order('timestamp', { ascending: false }),
    supabase.from('fb_comments').select('*').order('created_at', { ascending: false }),
    supabase.from('incident_reports').select('*').order('created_at', { ascending: false }),
  ]);

  if (convRes.error) throw convRes.error;
  if (fbRes.error) throw fbRes.error;

  const botReports = groupConversationRows((convRes.data ?? []) as ConversationRow[]);
  const fbReports = ((fbRes.data ?? []) as FbCommentRow[]).map(fromFbComment);

  const baseReports = [...botReports, ...fbReports];

  // If incident_reports table exists and has rows, overlay saved reviews & actions
  if (incRes.data && Array.isArray(incRes.data) && incRes.data.length > 0) {
    const incMap = new Map<string, Record<string, unknown>>(
      incRes.data.map((r: Record<string, unknown>) => [String(r.id), r])
    );

    const merged = baseReports.map((rep) => {
      const saved = incMap.get(rep.id);
      if (!saved) return rep;
      return {
        ...rep,
        status: (saved.status as ReportStatus) || rep.status,
        action: (saved.action as string) || (saved.action_taken as string) || rep.action || '',
        actionTaken: (saved.action_taken as string) || (saved.action as string) || rep.actionTaken || '',
        barangay: (saved.barangay as string) || rep.barangay,
        type: (saved.type as string) || rep.type,
        urgency: (saved.urgency as string) || rep.urgency,
        coordinates: (saved.coordinates as string) || rep.coordinates,
        landmark: (saved.landmark as string) || rep.landmark,
        contact:
          (saved.contact as string) !== undefined &&
          (saved.contact as string) !== null &&
          (saved.contact as string) !== '' &&
          (saved.contact as string) !== '—'
            ? (saved.contact as string)
            : rep.contact,
        description: (saved.description as string) || rep.description,
        verifiedBy: (saved.verified_by as string | null) ?? rep.verifiedBy,
        verifiedAt: saved.verified_at ? formatTime(saved.verified_at as string) : rep.verifiedAt,
        resolvedBy: (saved.resolved_by as string | null) ?? null,
        resolvedAt: saved.resolved_at ? formatTime(saved.resolved_at as string) : null,
        rejectionReason: (saved.rejection_reason as string | null) ?? rep.rejectionReason,
      };
    });

    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return baseReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Update an incident report action, triage status, notes, and coordinates. */
export async function updateIncidentReport(
  id: string,
  payload: Partial<Report> & { action?: string; actionTaken?: string }
): Promise<boolean> {
  const actionText = payload.action || payload.actionTaken || '';
  const body = {
    ...payload,
    action: actionText,
    action_taken: actionText,
  };

  try {
    const res = await apiFetch(`/api/auth/data/incident-reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return true;
    }
  } catch (apiErr) {
    console.warn('[incidentService] Backend API request failed, trying direct Supabase:', apiErr);
  }

  // Direct Supabase fallback
  try {
    if (id.startsWith('conv-')) {
      const rawId = parseInt(id.replace(/^conv-/, ''), 10);
      if (!isNaN(rawId)) {
        const { data: convRow } = await supabase
          .from('conversations')
          .select('id, conversation_id')
          .eq('id', rawId)
          .maybeSingle();

        const convUpdates: Record<string, unknown> = {};
        if (payload.status) convUpdates.status = payload.status;
        if (payload.barangay) convUpdates.barangay = payload.barangay;
        if (payload.type) convUpdates.incident_type = payload.type;
        if (payload.urgency) convUpdates.urgency = payload.urgency;
        if (payload.contact !== undefined && payload.contact !== null) {
          const cleanPhones = Array.isArray(payload.contact)
            ? payload.contact
            : String(payload.contact)
                .split(/[,;\/]+/)
                .map((p) => p.trim())
                .filter((p) => p.length > 0 && p !== '—');
          convUpdates.contact_numbers = cleanPhones;
        }
        if (payload.landmark !== undefined && payload.landmark !== null) {
          convUpdates.location_status = payload.landmark;
        }
        if (Object.keys(convUpdates).length > 0) {
          if (convRow?.conversation_id) {
            await supabase.from('conversations').update(convUpdates).eq('conversation_id', convRow.conversation_id);
          } else {
            await supabase.from('conversations').update(convUpdates).eq('id', rawId);
          }
        }
      }
    } else if (id.startsWith('fb-')) {
      const rawId = id.replace(/^fb-/, '');
      const fbStatusMap: Record<string, string> = {
        verified: 'Verified',
        resolved: 'Resolved',
        rejected: 'Flagged',
        under_review: 'New',
        pending: 'New',
      };
      const fbUpdates: Record<string, unknown> = {};
      if (payload.status && fbStatusMap[payload.status]) fbUpdates.status = fbStatusMap[payload.status];
      if (payload.barangay) fbUpdates.barangay = payload.barangay;
      if (payload.type) fbUpdates.incident_type = payload.type;
      if (Object.keys(fbUpdates).length > 0) {
        await supabase.from('fb_comments').update(fbUpdates).eq('id', rawId);
      }
    }

    try {
      await supabase.from('incident_reports').upsert(
        {
          id,
          status: payload.status || 'under_review',
          action: actionText,
          action_taken: actionText,
          coordinates: payload.coordinates || '',
          barangay: payload.barangay || 'Unknown',
          type: payload.type || 'Unclassified',
          urgency: payload.urgency || 'Low',
          landmark: payload.landmark || '',
          contact: payload.contact === '—' ? '' : (payload.contact || ''),
          verified_by: payload.verifiedBy,
          verified_at: payload.verifiedAt,
          rejection_reason: payload.rejectionReason,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {}

    return true;
  } catch (err) {
    console.error('[incidentService] Failed to persist report action to database:', err);
    return false;
  }
}

/** Bulk update incident reports status and action. */
export async function bulkUpdateIncidentReports(
  ids: string[],
  status: ReportStatus,
  action?: string
): Promise<boolean> {
  try {
    const res = await apiFetch('/api/auth/data/incident-reports/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, status, action: action || '' }),
    });
    if (res.ok) return true;
  } catch (apiErr) {
    console.warn('[incidentService] Bulk update via API failed, running individually:', apiErr);
  }

  await Promise.allSettled(ids.map((id) => updateIncidentReport(id, { status, action })));
  return true;
}

/** Subscribe to inserts/updates on conversations, fb_comments, and incident_reports tables. */
export function subscribeToReports(onChange: () => void): () => void {
  const channel = supabase
    .channel('incident-reports-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fb_comments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_reports' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
