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
    refreshReports: (showLoader?: boolean) => Promise<void>;
    updateReport: (id: string, updates: Partial<Report>) => Promise<boolean>;
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
                    const isHigh = (r.urgency || '').toLowerCase() === 'high';
                    const isSearchAndRescue =
                        (r.type || '').toLowerCase().includes('rescue') ||
                        (r.type || '').toLowerCase().includes('search');

                    if (isHigh || isSearchAndRescue) {
                        triggerPriorityAlert({
                            id: `priority-report-${r.id}`,
                            title: isSearchAndRescue
                                ? 'Search & Rescue'
                                : 'High-Urgency Incident',
                            message:
                                r.description ||
                                r.originalText ||
                                'High-urgency Search and Rescue report received.',
                            barangay: r.barangay || 'Talisay',
                            type: isSearchAndRescue ? 'Search & Rescue' : r.type,
                            urgency: r.urgency || 'High',
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

        // 2. Persist to database
        try {
            return await updateIncidentReport(id, updates);
        } catch (err) {
            console.error('[ReportsContext] Failed to persist report update:', err);
            return false;
        }
    }, []);

    const bulkUpdateReports = useCallback(async (ids: string[], status: ReportStatus, action?: string): Promise<boolean> => {
        // 1. Optimistic update
        setReports((prev) =>
            prev.map((r) =>
                ids.includes(r.id)
                    ? { ...r, status, action: action || r.action, actionTaken: action || r.actionTaken }
                    : r
            )
        );

        // 2. Persist to database
        try {
            return await bulkUpdateIncidentReports(ids, status, action);
        } catch (err) {
            console.error('[ReportsContext] Failed to bulk update reports:', err);
            return false;
        }
    }, []);

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
                refreshReports,
                updateReport,
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