// src/data/sample-reports.ts
// Data structures and initial empty state for Incident Reports
// Barangay names match talisay-barangays.ts GeoJSON
// Formatted in Philippine Standard Time (12-hour format with AM/PM)
// ─────────────────────────────────────────────────────────────────────────────

export type ReportStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'resolved';

export interface Report {
    id: string;
    barangay: string;
    type: string;
    urgency: string;
    source: string;
    time: string;
    status: ReportStatus;
    description: string;
    originalText: string;
    reporter: string;
    contact: string;
    coordinates: string; // "lat, lng"
    landmark: string;
    verifiedBy: string | null;
    verifiedAt: string | null;
    rejectionReason: string | null;
    possibleDuplicateOf: string | null;
}

// Initial empty reports array — populated dynamically via Supabase backend
export const sampleReports: Report[] = [];
