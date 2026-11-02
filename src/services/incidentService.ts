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

/** Check if report has missing barangay or out-of-scope type */
export function isReportIncomplete(report?: { barangay?: string | null; type?: string | null } | null): boolean {
  if (!report) return true;
  const b = (report.barangay || '').trim().toLowerCase();
  const t = (report.type || '').trim().toLowerCase();
  const isUnknownBarangay = !b || b === 'unknown' || b === 'none' || b.includes('missing');
  const isNoneType = !t || t === 'none' || t === 'unclassified' || t.includes('not mentioned') || t.includes('out of scope');
  return isUnknownBarangay || isNoneType;
}

/** Returns list of human-readable missing/incomplete reasons */
export function getIncompleteReasons(report?: { barangay?: string | null; type?: string | null } | null): string[] {
  if (!report) return ['Missing Information'];
  const reasons: string[] = [];
  const b = (report.barangay || '').trim().toLowerCase();
  const t = (report.type || '').trim().toLowerCase();
  if (!b || b === 'unknown' || b === 'none' || b.includes('missing')) reasons.push('Missing Barangay');
  if (!t || t === 'none' || t === 'unclassified' || t.includes('not mentioned') || t.includes('out of scope')) reasons.push('Missing Type');
  return reasons;
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
 * Maps disaster/incident types to their canonical brand hex colors.
 * Synchronized with the Dashboard "Reports by type" bar chart.
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
  if (norm.includes('search') || norm.includes('rescue')) return '#14B8A6';
  if (norm.includes('food') || norm.includes('water')) return '#0EA5E9';
  if (norm.includes('infrastructure')) return '#A855F7';
  return '#64748B';
}

/**
 * Fetch unified emergency incident reports from the backend REST API.
 * Backend aggregates Messenger bot conversations, Facebook comments, and persisted officer triages.
 */
export async function fetchReports(): Promise<Report[]> {
  const json = await apiRequest<{ data?: Report[] }>('/api/auth/data/incident-reports', {
    cacheTtlMs: 8000,
  });
  const rawReports: Report[] = json?.data ?? [];
  return rawReports
    .map((r: any) => ({
      ...r,
      time: (r.createdAt ? formatTimestampPHT(r.createdAt) : null) || (r.time ? formatTimestampPHT(r.time) : '') || r.time,
      verifiedAt: r.verifiedAt ? (formatTimestampPHT(r.verifiedAt) || r.verifiedAt) : null,
    }))
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
