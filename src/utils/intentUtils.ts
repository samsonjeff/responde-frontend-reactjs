/**
 * src/utils/intentUtils.ts
 *
 * Canonical intent categorization for Responde incoming streams (Messenger Bot & Scraper Feed).
 *
 * Tab definitions:
 * - Incidents: Emergency Report, Resource Request
 * - All Logs / All Posts: Casual or Greeting, Other, Feedback or Thanks, Status Inquiry
 */

export const INCIDENT_INTENTS = ['Emergency Report', 'Resource Request'] as const;
export const GENERAL_LOG_INTENTS = [
  'Casual or Greeting',
  'Other',
  'Feedback or Thanks',
  'Status Inquiry',
] as const;

/**
 * Normalizes raw Supabase intent keys (e.g. 'EMERGENCY_REPORT') to human-readable titles.
 */
export function normalizeIntent(intent?: string | null): string {
  if (!intent) return 'Other';
  const clean = String(intent).trim().toUpperCase().replace(/[\s\/-]+/g, '_');
  if (clean === 'EMERGENCY_REPORT') return 'Emergency Report';
  if (clean === 'RESOURCE_REQUEST') return 'Resource Request';
  if (clean === 'CASUAL_OR_GREETING' || clean === 'GREETING' || clean === 'CASUAL') return 'Casual or Greeting';
  if (clean === 'FEEDBACK_OR_THANKS' || clean === 'FEEDBACK' || clean === 'THANKS') return 'Feedback or Thanks';
  if (clean === 'STATUS_INQUIRY' || clean === 'INQUIRY') return 'Status Inquiry';
  if (clean === 'OTHER') return 'Other';

  // Capitalize title
  const words = String(intent).trim().split(/[\s_]+/);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Returns true if the intent represents an emergency incident:
 * - Emergency Report
 * - Resource Request
 */
export function isIncidentIntent(intent?: string | null): boolean {
  if (!intent) return false;
  const clean = String(intent).trim().toUpperCase().replace(/[\s\/-]+/g, '_');
  return clean === 'EMERGENCY_REPORT' || clean === 'RESOURCE_REQUEST';
}

/**
 * Returns true if the intent belongs in the All Logs / All Posts feed:
 * - Casual or Greeting
 * - Other
 * - Feedback or Thanks
 * - Status Inquiry
 */
export function isGeneralLogIntent(intent?: string | null): boolean {
  if (!intent) return true;
  return !isIncidentIntent(intent);
}

