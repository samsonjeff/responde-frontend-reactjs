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

/** Standard base incident disaster types recognized across Responde pages */
export const BASE_INCIDENT_TYPES = [
  'Earthquake',
  'Fire',
  'Flood',
  'General',
  'Landslide',
  'Typhoon',
  'Volcanic Eruption',
  'None',
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
  if (lower === 'moderate' || lower === 'medium') return 'Moderate';
  if (lower === 'low') return 'Low';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Standardize incident type strings to match canonical categories.
 * Maps 'none', 'null', 'unclassified' to 'None', and normalizes known disasters.
 */
export function formatReportType(t?: string | null): string {
  if (!t) return 'None';
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
    return 'None';
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

/** Check if report is incomplete (missing a valid barangay) */
export function isReportIncomplete(report?: { barangay?: string | null; type?: string | null } | null): boolean {
  if (!report) return true;
  const b = (report.barangay || '').trim().toLowerCase();
  const isUnknownBarangay = !b || b === 'unknown' || b === 'none' || b === 'unspecified' || b === 'n/a' || b === 'null';
  return isUnknownBarangay;
}

/** Returns list of human-readable missing/incomplete reasons */
export function getIncompleteReasons(report?: { barangay?: string | null; type?: string | null } | null): string[] {
  if (!report) return ['Missing Barangay'];
  const reasons: string[] = [];
  const b = (report.barangay || '').trim().toLowerCase();
  if (!b || b === 'unknown' || b === 'none' || b === 'unspecified' || b === 'n/a' || b === 'null') {
    reasons.push('Missing Barangay');
  }
  return reasons.length > 0 ? reasons : ['Missing Barangay'];
}

/**
 * Maps disaster/incident types to their canonical brand hex colors.
 * Synchronized with Dashboard "Reports by type" bar chart and Analytics.
 */
export function getTypeHexColor(type: string): string {
  const norm = (type || '').toLowerCase().trim();
  if (!norm || norm === 'general' || norm === 'none' || norm === 'unclassified') return '#64748B';
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
  // 1. Concurrently fetch aggregated reports from backend and underlying Supabase source-of-truth records
  const [backendResult, supabaseIncResult, supabaseConvResult, supabaseFbResult] = await Promise.allSettled([
    apiRequest<{ data?: Report[] }>('/api/auth/data/incident-reports', {
      cacheTtlMs: 8000,
    }),
    supabase.from('incident_reports').select('*'),
    supabase.from('conversations').select('id, incident_type, barangay, urgency, status'),
    supabase.from('fb_comments').select('id, incident_type, barangay, urgency, status'),
  ]);

  const rawReports: Report[] = (backendResult.status === 'fulfilled' ? backendResult.value?.data : []) ?? [];
  const triagedRows: any[] = (supabaseIncResult.status === 'fulfilled' ? supabaseIncResult.value?.data : []) ?? [];
  const convRows: any[] = (supabaseConvResult.status === 'fulfilled' ? supabaseConvResult.value?.data : []) ?? [];
  const fbRows: any[] = (supabaseFbResult.status === 'fulfilled' ? supabaseFbResult.value?.data : []) ?? [];

  // 2. Build quick lookup maps for triaged reports, conversations, and fb_comments
  const triagedMap = new Map<string, any>();
  if (Array.isArray(triagedRows)) {
    for (const row of triagedRows) {
      if (row.id) {
        triagedMap.set(String(row.id).trim(), row);
      }
    }
  }

  const convMap = new Map<string, any>();
  if (Array.isArray(convRows)) {
    for (const c of convRows) {
      if (c.id !== undefined && c.id !== null) {
        convMap.set(`conv-${c.id}`, c);
      }
    }
  }

  const fbMap = new Map<string, any>();
  if (Array.isArray(fbRows)) {
    for (const f of fbRows) {
      if (f.id !== undefined && f.id !== null) {
        fbMap.set(`fb-${f.id}`, f);
        fbMap.set(String(f.id).trim(), f);
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
      };

      // A. If saved in Supabase incident_reports, officer triage is the authoritative source of truth
      const triaged = triagedMap.get(report.id);
      if (triaged) {
        if (triaged.type !== undefined && triaged.type !== null) {
          report.type = formatReportType(triaged.type);
        }
        if (triaged.barangay !== undefined && triaged.barangay !== null) {
          report.barangay = triaged.barangay;
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
      const conv = convMap.get(report.id);
      const fb = fbMap.get(report.id) || fbMap.get(String(report.id).replace(/^fb[-_]/i, ''));
      const rawSupabaseType = conv ? conv.incident_type : (fb ? fb.incident_type : null);
      const rawSupabaseUrgency = conv ? conv.urgency : (fb ? fb.urgency : null);

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

      return report;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/** Update an incident report action, triage status, notes, and coordinates via backend API. */
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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
