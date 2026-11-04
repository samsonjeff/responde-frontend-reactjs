/**
 * Pure report-triage helpers: incomplete detection and human-readable reasons.
 * Dependency-free so the incomplete-queue rule stays unit-testable
 * (see tests/reportTriage.test.ts). Re-exported from incidentService
 * for all existing import sites.
 */

export interface IncompleteReportLike {
  barangay?: string | null;
  type?: string | null;
}

/**
 * Check if report is incomplete (missing a valid barangay or incident type).
 * Either dimension counts: the review modal's "Mark as Incomplete" flow offers
 * "Missing Barangay", "No Incident Stated", and "Both Missing", and officers
 * cannot verify until both are resolved — so an unknown barangay OR an
 * unknown/unclassified type belongs in the Incomplete queue.
 */
export function isReportIncomplete(report?: IncompleteReportLike | null): boolean {
  if (!report) return true;
  const b = (report.barangay || '').trim().toLowerCase();
  const isUnknownBarangay = !b || b === 'unknown' || b === 'none' || b === 'unspecified' || b === 'n/a' || b === 'null';
  const t = (report.type || '').trim().toLowerCase();
  const isUnknownType = !t || t === 'unknown' || t === 'none' || t === 'unclassified' || t === 'unspecified' || t === 'n/a' || t === 'null' || t === 'undefined';
  return isUnknownBarangay || isUnknownType;
}

/** Returns list of human-readable missing/incomplete reasons */
export function getIncompleteReasons(report?: IncompleteReportLike | null): string[] {
  if (!report) return ['Missing Barangay'];
  const reasons: string[] = [];
  const b = (report.barangay || '').trim().toLowerCase();
  if (!b || b === 'unknown' || b === 'none' || b === 'unspecified' || b === 'n/a' || b === 'null') {
    reasons.push('Missing Barangay');
  }
  const t = (report.type || '').trim().toLowerCase();
  if (!t || t === 'none' || t === 'unclassified' || t === 'unknown' || t === 'unspecified' || t === 'n/a' || t === 'null' || t === 'undefined') {
    reasons.push('Missing Incident Type');
  }
  return reasons.length > 0 ? reasons : ['Incomplete Details'];
}
