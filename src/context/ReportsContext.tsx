// src/context/ReportsContext.tsx
// Unified state and live synchronization between IncidentReports, GeospatialMap, and Analytics
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
    fetchReports,
    subscribeToReports,
    updateIncidentReport,
    bulkUpdateIncidentReports,
    type Report,
    type ReportStatus,
} from '../services/incidentService';
import { useNotifications } from './NotificationContext';

interface ReportsContextValue {
    reports: Report[];
    setReports: React.Dispatch<React.SetStateAction<Report[]>>;
    loading: boolean;
    error: string | null;
    refreshReports: (showLoader?: boolean) => Promise<void>;
    updateReport: (id: string, updates: Partial<Report>) => Promise<boolean>;
    contextUpdateReport: (id: string, updates: Partial<Report>) => Promise<boolean>;
    bulkUpdateReports: (ids: string[], status: ReportStatus, action?: string) => Promise<boolean>;
    getVerifiedReports: () => Report[];
    getReportsByBarangay: () => Record<string, Report[]>;
}

const REPORTS_CACHE_KEY = 'responde_cached_reports';

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
    const [reports, setReports] = useState<Report[]>(() => {
        try {
            const raw = sessionStorage.getItem(REPORTS_CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {}
        return [];
    });
    const [loading, setLoading] = useState<boolean>(() => {
        try {
            const raw = sessionStorage.getItem(REPORTS_CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return false;
            }
        } catch {}
        return true;
    });
    const [error, setError] = useState<string | null>(null);
    const { triggerPriorityAlert } = useNotifications();
    const knownReportIdsRef = useRef<Set<string>>(new Set());
    const isFirstLoadRef = useRef<boolean>(true);

    const handleIncomingReports = useCallback((liveData: Report[]) => {
        if (!Array.isArray(liveData)) return;

        // If not initial mount, check for newly arrived high-urgency Search & Rescue reports
        if (!isFirstLoadRef.current) {
            const known = knownReportIdsRef.current;
            liveData.forEach((r) => {
                if (!known.has(r.id)) {
                    const uLower = (r.urgency || '').toLowerCase();
                    const isPriorityUrgency = uLower === 'high' || uLower === 'critical';
                    const isSearchAndRescue =
                        (r.type || '').toLowerCase().includes('rescue') ||
                        (r.type || '').toLowerCase().includes('search');

                    if (isPriorityUrgency || isSearchAndRescue) {
                        triggerPriorityAlert({
                            id: `priority-report-${r.id}`,
                            title: isSearchAndRescue
                                ? 'Search & Rescue'
                                : uLower === 'critical'
                                ? 'Critical Emergency Incident'
                                : 'High-Urgency Incident',
                            message:
                                r.description ||
                                r.originalText ||
                                'Critical or high-urgency emergency report received.',
                            barangay: r.barangay || 'Talisay',
                            type: isSearchAndRescue ? 'Search & Rescue' : r.type,
                            urgency: r.urgency || 'Critical',
                            targetPath: '/incident-reports',
                            reportId: r.id,
                        });
                    }
                }
            });
        }

        // Cache known IDs and update state
        knownReportIdsRef.current = new Set(liveData.map((r) => r.id));
        isFirstLoadRef.current = false;
        try {
            sessionStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(liveData));
        } catch {}
        setReports(liveData);
        setError(null);
    }, [triggerPriorityAlert]);

    const refreshReports = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const liveData = await fetchReports();
            if (Array.isArray(liveData)) {
                handleIncomingReports(liveData);
            }
        } catch (err) {
            console.warn('[ReportsContext] Could not load live reports:', err);
            setError(err instanceof Error ? err.message : 'Failed to load reports');
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [handleIncomingReports]);

    useEffect(() => {
        let mounted = true;
        const initialLoad = async () => {
            try {
                const liveData = await fetchReports();
                if (mounted && Array.isArray(liveData)) {
                    handleIncomingReports(liveData);
                }
            } catch (err) {
                console.warn('[ReportsContext] Initial load failed:', err);
                if (mounted) setError(err instanceof Error ? err.message : 'Failed to load reports');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initialLoad();

        // Debounce live database refresh to avoid rapid-fire API request storms during scraper batches
        let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
        const debouncedRefresh = () => {
            if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
            refreshDebounceTimer = setTimeout(() => {
                refreshReports(false);
            }, 1200);
        };

        // Subscribe to live database changes across conversations, fb_comments, and incident_reports
        const unsubscribe = subscribeToReports(() => {
            debouncedRefresh();
        });

        return () => {
            mounted = false;
            if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
            unsubscribe();
        };
    }, [refreshReports, handleIncomingReports]);

    const updateReport = useCallback(async (id: string, updates: Partial<Report>): Promise<boolean> => {
        // 1. Optimistic update: instantly reflects in IncidentReports, GeospatialMap, Dashboard
        setReports((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
        );

        // 2. Persist to database; on failure, re-fetch server truth to roll back
        // the optimistic update so the UI never shows a triage that wasn't saved.
        try {
            const ok = await updateIncidentReport(id, updates);
            if (!ok) {
                console.error('[ReportsContext] Persist reported failure, reconciling from server');
                await refreshReports(false);
            }
            return ok;
        } catch (err) {
            console.error('[ReportsContext] Failed to persist report update:', err);
            await refreshReports(false);
            return false;
        }
    }, [refreshReports]);

    // Alias kept for the review modal / restore hook / dashboard, which patch by id.
    const contextUpdateReport = updateReport;

    const bulkUpdateReports = useCallback(async (ids: string[], status: ReportStatus, action?: string): Promise<boolean> => {
        // 1. Optimistic update
        setReports((prev) =>
            prev.map((r) =>
                ids.includes(r.id)
                    ? { ...r, status, action: action || r.action, actionTaken: action || r.actionTaken }
                    : r
            )
        );

        // 2. Persist to database; on failure, re-fetch server truth to roll back
        // the optimistic update so the UI never shows a triage that wasn't saved.
        try {
            const ok = await bulkUpdateIncidentReports(ids, status, action);
            if (!ok) {
                console.error('[ReportsContext] Bulk persist reported failure, reconciling from server');
                await refreshReports(false);
            }
            return ok;
        } catch (err) {
            console.error('[ReportsContext] Failed to bulk update reports:', err);
            await refreshReports(false);
            return false;
        }
    }, [refreshReports]);

    const getVerifiedReports = useCallback(() => {
        return reports.filter((r) => r.status === 'verified');
    }, [reports]);

    const getReportsByBarangay = useCallback(() => {
        const map: Record<string, Report[]> = {};
        reports.forEach((r) => {
            const b = r.barangay || 'Unknown';
            if (!map[b]) map[b] = [];
            map[b].push(r);
        });
        return map;
    }, [reports]);

    return (
        <ReportsContext.Provider
            value={{
                reports,
                setReports,
                loading,
                error,
                refreshReports,
                updateReport,
                contextUpdateReport,
                bulkUpdateReports,
                getVerifiedReports,
                getReportsByBarangay,
            }}
        >
            {children}
        </ReportsContext.Provider>
    );
}

export function useReports() {
    const ctx = useContext(ReportsContext);
    if (!ctx) {
        throw new Error('useReports must be used within a ReportsProvider');
    }
    return ctx;
}