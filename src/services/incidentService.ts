import { supabase } from '../lib/supabaseClient';
import { apiFetch } from './authService';
import { apiRequest } from './apiClient';
import { formatTimestampPHT } from '../utils/dateUtils';

export type ReportStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'resolved';

export interface Report {
  id: string;
  barangay: string;
  type: string;
  urgency: string;
  source: string;
  time: string;
  createdAt?: string;
  senderPsid?: string;
  conversationId?: string;
  sessionId?: string;
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
  resolvedBy: string | null;
  resolvedAt: string | null;
  possibleDuplicateOf: string | null;
}

/** Standard base incident disaster types recognized across Responde pages */
export const BASE_INCIDENT_TYPES = [
  'Earthquake',
  'Fire',
  'Flood',
  'General',
  'Landslide',
  'Typhoon',
  'Volcanic Eruption',
  'Unknown',
] as const;

/** Canonical urgency levels recognized across Responde */
export const BASE_URGENCY_LEVELS = ['Low', 'Moderate', 'High', 'Critical'] as const;

/**
 * Standardize urgency level strings to match canonical categories.
 * Maps 'CRITICAL', 'critical' to 'Critical', 'medium' to 'Moderate', etc.
 */
export function formatReportUrgency(u?: string | null): string {
  if (!u) return 'Low';
  const clean = String(u).trim();
  const lower = clean.toLowerCase();
  if (lower === 'critical') return 'Critical';
  if (lower === 'high') return 'High';
  if (lower === 'moderate' || lower === 'medium' || lower === 'mod') return 'Moderate';
  if (lower === 'low') return 'Low';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Standardize incident type strings to match canonical categories.
 * Maps missing/placeholder values ('none', 'null', 'unclassified', 'unknown') to 'Unknown'.
 */
export function formatReportType(t?: string | null): string {
  if (!t) return 'Unknown';
  const clean = String(t).trim();
  const lower = clean.toLowerCase();
  if (
    lower === 'none' ||
    lower === 'null' ||
    lower === 'unclassified' ||
    lower === 'unknown' ||
    lower === 'n/a' ||
    lower === 'unspecified' ||
    lower === 'undefined'
  ) {
    return 'Unknown';
  }
  if (lower === 'earthquake') return 'Earthquake';
  if (lower === 'fire') return 'Fire';
  if (lower === 'flood') return 'Flood';
  if (lower === 'landslide') return 'Landslide';
  if (lower === 'general') return 'General';
  if (lower === 'typhoon') return 'Typhoon';
  if (lower === 'volcanic_eruption' || lower === 'volcanic eruption') return 'Volcanic Eruption';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Returns the barangay only when it names a real place.
 * Placeholders ('Unknown', 'None', 'n/a', ...) and blanks resolve to null
 * so callers can fall back to the raw recorded value.
 */
function realBarangayOrNull(v?: string | null): string | null {
  if (v === undefined || v === null) return null;
  const clean = String(v).trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  if (lower === 'unknown' || lower === 'none' || lower === 'unspecified' || lower === 'n/a' || lower === 'null' || lower === 'undefined') return null;
  return clean;
}

/** Incomplete-queue rule lives in ./reportTriage (dependency-free, unit-tested). */
export { isReportIncomplete, getIncompleteReasons } from './reportTriage';

/**
 * Maps disaster/incident types to their canonical brand hex colors.
 * Synchronized with Dashboard "Reports by type" bar chart and Analytics.
 */
export function getTypeHexColor(type: string): string {
  const norm = (type || '').toLowerCase().trim();
  if (!norm || norm === 'general' || norm === 'none' || norm === 'unknown' || norm === 'unclassified') return '#64748B';
  if (norm.includes('flood')) return '#3B82F6';
  if (norm.includes('typhoon') || norm.includes('storm')) return '#6366F1';
  if (norm.includes('volcan')) return '#F97316';
  if (norm.includes('landslide')) return '#EAB308';
  if (norm.includes('fire')) return '#F43F5E';
  if (norm.includes('earthquake') || norm.includes('quake')) return '#F59E0B';
  if (norm.includes('medic')) return '#10B981';
  if (norm.includes('search') || norm.includes('rescue')) return '#F97316';
  if (norm.includes('food') || norm.includes('water')) return '#0071E3';
  if (norm.includes('infra') || norm.includes('kuryente')) return '#A855F7';
  return '#64748B';
}

/**
 * Formats raw/database IDs (e.g. "fb-122115019251367137_3014922105566730", "conv-377")
 * into clean, standard incident ticket codes (e.g. "#FB-6730", "#BOT-0377", "#INC-0042").
 */
export function formatReportCode(id?: string | null, source?: string | null): string {
  if (!id) return '#INC-0000';
  const cleanId = String(id).trim();

  // 1. Bot conversation: "conv-377" -> "#BOT-0377"
  const convMatch = cleanId.match(/^conv-(\d+)$/i);
  if (convMatch) {
    return `#BOT-${convMatch[1].padStart(4, '0')}`;
  }

  // 2. Facebook scraper: "fb-122115019251367137_3014922105566730" -> "#FB-6730"
  if (cleanId.startsWith('fb-') || cleanId.startsWith('fb_') || source === 'Scraper') {
    const rawNum = cleanId.replace(/^fb[-_]/i, '');
    const segments = rawNum.split('_');
    const commentOrSuffix = segments[segments.length - 1] || segments[0];
    const digitsOnly = commentOrSuffix.replace(/\D/g, '');
    const shortDigits = digitsOnly.slice(-4) || commentOrSuffix.slice(-4);
    return `#FB-${shortDigits.toUpperCase()}`;
  }

  // 3. Pure numeric ID: "42" -> "#INC-0042"
  if (/^\d+$/.test(cleanId)) {
    return `#INC-${cleanId.padStart(4, '0')}`;
  }

  // 4. Other IDs
  if (cleanId.length > 8) {
    return `#INC-${cleanId.slice(-4).toUpperCase()}`;
  }

  return cleanId.startsWith('#') ? cleanId : `#${cleanId.toUpperCase()}`;
}

/**
 * Fetch unified emergency incident reports from the backend REST API
 * reconciled against live Supabase incident_reports, conversations, and fb_comments tables.
 * Backend aggregates Messenger bot conversations, Facebook comments, and persisted officer triages.
 */
export async function fetchReports(): Promise<Report[]> {
  // 1. Concurrently fetch aggregated reports from backend, live triage overrides, and source records
  // Concurrently queries both direct Supabase and authenticated backend APIs so that data is resilient against RLS restrictions.
  const [
    backendResult,
    supabaseIncResult,
    supabaseConvResult,
    supabaseFbResult,
    apiConvResult,
    apiFbResult,
  ] = await Promise.allSettled([
    apiRequest<{ data?: Report[] }>('/api/auth/data/incident-reports', {
      cacheTtlMs: 8000,
    }),
    supabase.from('incident_reports').select('id, source, reporter, contact, barangay, type, urgency, description, landmark, coordinates, status, action, action_taken, verified_by, verified_at, resolved_by, resolved_at, rejection_reason, possible_duplicate_of, created_at').order('created_at', { ascending: false }).limit(2000),
    supabase.from('conversations').select('id, sender_name, sender_psid, conversation_id, incident_type, barangay, urgency, status').order('timestamp', { ascending: false }).limit(500),
    supabase.from('fb_comments').select('id, post_id, incident_type, barangay, urgency, status').order('created_at', { ascending: false }).limit(500),
    apiRequest<{ data?: any[] }>('/api/auth/data/conversations?limit=500', {
      cacheTtlMs: 8000,
    }),
    apiRequest<{ data?: any[] }>('/api/auth/data/fb-comments?limit=500', {
      cacheTtlMs: 8000,
    }),
  ]);

  const rawReports: Report[] = (backendResult.status === 'fulfilled' ? backendResult.value?.data : []) ?? [];
  const triagedRows: any[] = (supabaseIncResult.status === 'fulfilled' ? supabaseIncResult.value?.data : []) ?? [];

  // Use direct Supabase rows if available; otherwise use authenticated backend fallback
  const convRows: any[] = (supabaseConvResult.status === 'fulfilled' && Array.isArray(supabaseConvResult.value?.data) && supabaseConvResult.value.data.length > 0)
    ? supabaseConvResult.value.data
    : (apiConvResult.status === 'fulfilled' && Array.isArray(apiConvResult.value?.data))
    ? apiConvResult.value.data
    : [];

  const fbRows: any[] = (supabaseFbResult.status === 'fulfilled' && Array.isArray(supabaseFbResult.value?.data) && supabaseFbResult.value.data.length > 0)
    ? supabaseFbResult.value.data
    : (apiFbResult.status === 'fulfilled' && Array.isArray(apiFbResult.value?.data))
    ? apiFbResult.value.data
    : [];

  // 2. Build quick lookup maps for triaged reports, conversations, and fb_comments
  const triagedMap = new Map<string, any>();
  if (Array.isArray(triagedRows)) {
    for (const row of triagedRows) {
      if (row.id) {
        const idStr = String(row.id).trim();
        triagedMap.set(idStr, row);
        triagedMap.set(idStr.toLowerCase(), row);
        const rawNum = idStr.replace(/^[a-z]+[-_]/i, '');
        triagedMap.set(rawNum, row);
      }
    }
  }

  const convMap = new Map<string, any>();
  if (Array.isArray(convRows)) {
    for (const c of convRows) {
      if (c.id !== undefined && c.id !== null) {
        const idStr = String(c.id).trim();
        convMap.set(idStr, c);
        convMap.set(`conv-${idStr}`, c);
        convMap.set(`bot-${idStr}`, c);
        const padded4 = idStr.padStart(4, '0');
        convMap.set(padded4, c);
        convMap.set(`conv-${padded4}`, c);
        convMap.set(`bot-${padded4}`, c);
      }
      if (c.conversation_id) {
        convMap.set(String(c.conversation_id).trim(), c);
      }
      if (c.conversationId) {
        convMap.set(String(c.conversationId).trim(), c);
      }
      if (c.sender_psid) {
        const psidKey = `psid-${String(c.sender_psid).trim()}`;
        const existing = convMap.get(psidKey);
        const cUrg = String(c.urgency || '').toLowerCase();
        const exUrg = existing ? String(existing.urgency || '').toLowerCase() : '';
        if (!existing || cUrg === 'critical' || (cUrg === 'high' && exUrg !== 'critical')) {
          convMap.set(psidKey, c);
        }
      }
    }
  }

  const fbMap = new Map<string, any>();
  if (Array.isArray(fbRows)) {
    for (const f of fbRows) {
      if (f.id !== undefined && f.id !== null) {
        const idStr = String(f.id).trim();
        const rawNum = idStr.replace(/^fb[-_]/i, '');
        fbMap.set(idStr, f);
        fbMap.set(rawNum, f);
        fbMap.set(`fb-${rawNum}`, f);
        fbMap.set(`fb_${rawNum}`, f);
        const segments = rawNum.split('_');
        if (segments.length > 1) {
          fbMap.set(segments[segments.length - 1], f);
        }
      }
      if (f.post_id) {
        fbMap.set(String(f.post_id).trim(), f);
      }
    }
  }

  // 3. Map reports, overlaying verified Supabase data so officer triages & raw disaster classifications are 1:1 with Supabase
  return rawReports
    .map((r: any) => {
      const report: Report = {
        ...r,
        time: (r.createdAt ? formatTimestampPHT(r.createdAt) : null) || (r.time ? formatTimestampPHT(r.time) : '') || r.time,
        verifiedAt: r.verifiedAt ? (formatTimestampPHT(r.verifiedAt) || r.verifiedAt) : null,
        resolvedBy: r.resolvedBy ?? null,
        resolvedAt: r.resolvedAt ? (formatTimestampPHT(r.resolvedAt) || r.resolvedAt) : null,
      };

      // A. If saved in Supabase incident_reports, officer triage is the authoritative source of truth
      const triaged = triagedMap.get(report.id);

      // Raw-source barangay lookup, used only when the triaged row carries no
      // explicit value. An officer-saved 'Unknown' is intentional (marked
      // incomplete) and must be preserved — never restore the raw value over it.
      const resolveRawBarangay = (): string | null => {
        const cleanId = String(report.id || '').trim();
        const rawDigits = cleanId.replace(/^[a-z]+[-_]/i, '');
        const segments = rawDigits.split('_');
        const lastSegment = segments[segments.length - 1] || rawDigits;
        const conv =
          convMap.get(cleanId) ||
          convMap.get(rawDigits) ||
          (report.conversationId ? convMap.get(report.conversationId) : null) ||
          (report.senderPsid ? convMap.get(`psid-${report.senderPsid}`) : null);
        const fb =
          fbMap.get(cleanId) ||
          fbMap.get(rawDigits) ||
          fbMap.get(`fb-${rawDigits}`) ||
          fbMap.get(lastSegment);
        const raw = conv ? conv.barangay : (fb ? fb.barangay : null);
        return realBarangayOrNull(raw);
      };
      if (triaged) {
        if (triaged.type !== undefined && triaged.type !== null) {
          report.type = formatReportType(triaged.type);
        }
        if (triaged.barangay !== undefined && triaged.barangay !== null && String(triaged.barangay).trim() !== '') {
          report.barangay = String(triaged.barangay).trim();
        } else {
          report.barangay = resolveRawBarangay() ?? realBarangayOrNull(report.barangay) ?? 'Unknown';
        }
        if (triaged.urgency !== undefined && triaged.urgency !== null) {
          report.urgency = formatReportUrgency(triaged.urgency);
        }
        if (triaged.status !== undefined && triaged.status !== null) {
          report.status = triaged.status;
        }
        if (triaged.action !== undefined && triaged.action !== null) {
          report.action = triaged.action;
          report.actionTaken = triaged.action;
        }
        if (triaged.verified_by !== undefined) {
          report.verifiedBy = triaged.verified_by;
        }
        if (triaged.verified_at !== undefined) {
          report.verifiedAt = triaged.verified_at ? formatTimestampPHT(triaged.verified_at) : null;
        }
        if (triaged.rejection_reason !== undefined) {
          report.rejectionReason = triaged.rejection_reason;
        }
        if (triaged.resolved_by !== undefined) {
          report.resolvedBy = triaged.resolved_by;
        }
        if (triaged.resolved_at !== undefined) {
          report.resolvedAt = triaged.resolved_at ? formatTimestampPHT(triaged.resolved_at) : null;
        }
        if (triaged.possible_duplicate_of !== undefined) {
          report.possibleDuplicateOf = triaged.possible_duplicate_of;
        }
        if (triaged.coordinates !== undefined && triaged.coordinates !== null) {
          report.coordinates = triaged.coordinates;
        }
        if (triaged.landmark !== undefined && triaged.landmark !== null) {
          report.landmark = triaged.landmark;
        }
        return report;
      }

      // B. For un-triaged records, check Supabase conversations or fb_comments to restore actual classification & urgency
      const cleanId = String(report.id || '').trim();
      const rawDigits = cleanId.replace(/^[a-z]+[-_]/i, '');
      const segments = rawDigits.split('_');
      const lastSegment = segments[segments.length - 1] || rawDigits;

      const conv =
        convMap.get(cleanId) ||
        convMap.get(rawDigits) ||
        (report.conversationId ? convMap.get(report.conversationId) : null) ||
        (report.senderPsid ? convMap.get(`psid-${report.senderPsid}`) : null);

      const fb =
        fbMap.get(cleanId) ||
        fbMap.get(rawDigits) ||
        fbMap.get(`fb-${rawDigits}`) ||
        fbMap.get(lastSegment);

      const rawSupabaseType = conv ? (conv.incident_type || conv.type) : (fb ? (fb.incident_type || fb.type) : null);
      const rawSupabaseUrgency = conv ? conv.urgency : (fb ? fb.urgency : null);
      const rawSupabaseBarangay = conv ? conv.barangay : (fb ? fb.barangay : null);

      if (rawSupabaseBarangay !== undefined && rawSupabaseBarangay !== null && String(rawSupabaseBarangay).trim() !== '') {
        const bTrim = String(rawSupabaseBarangay).trim();
        const bLower = bTrim.toLowerCase();
        if (bLower !== 'none' && bLower !== 'null' && bLower !== 'unknown' && bLower !== 'undefined') {
          report.barangay = bTrim;
        }
      }

      if (rawSupabaseType !== undefined && rawSupabaseType !== null) {
        report.type = formatReportType(rawSupabaseType);
      } else {
        report.type = formatReportType(report.type);
      }

      if (rawSupabaseUrgency !== undefined && rawSupabaseUrgency !== null) {
        report.urgency = formatReportUrgency(rawSupabaseUrgency);
      } else {
        report.urgency = formatReportUrgency(report.urgency);
      }

      const bLower = (report.barangay || '').trim().toLowerCase();
      if (!bLower || bLower === 'none' || bLower === 'unknown' || bLower === 'unspecified' || bLower === 'n/a' || bLower === 'null') {
        report.barangay = 'Unknown';
      }

      return report;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/**
 * Build the PATCH body for an incident report, mapping camelCase Report fields
 * to the snake_case columns the backend persists.
 * Attribution (verified_by/at) is intentionally omitted: the backend stamps it
 * from the authenticated session, which is authoritative.
 */
export function buildIncidentPatchBody(
  payload: Partial<Report> & { action?: string; actionTaken?: string }
): Record<string, unknown> {
  const actionText = payload.action || payload.actionTaken || '';
  return {
    ...payload,
    action: actionText,
    action_taken: actionText,
    ...(payload.rejectionReason !== undefined ? { rejection_reason: payload.rejectionReason } : {}),
    ...(payload.possibleDuplicateOf !== undefined ? { possible_duplicate_of: payload.possibleDuplicateOf } : {}),
  };
}

/** Update an incident report action, triage status, notes, and coordinates via backend API. */
export async function updateIncidentReport(
  id: string,
  payload: Partial<Report> & { action?: string; actionTaken?: string }
): Promise<boolean> {
  const body = buildIncidentPatchBody(payload);

  const res = await apiFetch(`/api/auth/data/incident-reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error(`[incidentService] Failed to update incident report ${id}:`, errData);
    return false;
  }

  return true;
}

/** Bulk update incident reports status and action via backend API. */
export async function bulkUpdateIncidentReports(
  ids: string[],
  status: ReportStatus,
  action?: string
): Promise<boolean> {
  const res = await apiFetch('/api/auth/data/incident-reports/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, status, action: action || '' }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error('[incidentService] Bulk update via API failed:', errData);
    return false;
  }

  return true;
}

/** Subscribe to realtime database changes across conversations, fb_comments, and incident_reports tables. */
export function subscribeToReports(onChange: () => void): () => void {
  const channel = supabase
    .channel('incident-reports-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fb_comments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_reports' }, onChange)
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED' && import.meta.env.DEV) {
        console.warn(`[incidentService] Realtime incident-reports-changes: ${status}`);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
