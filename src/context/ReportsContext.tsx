// src/context/ReportsContext.tsx
// Unified state and live synchronization between IncidentReports, GeospatialMap, and Analytics
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { sampleReports } from '../data/sample-reports';
import {
    fetchReports,
    subscribeToReports,
    updateIncidentReport,
    bulkUpdateIncidentReports,
    type Report,
    type ReportStatus,
} from '../services/incidentService';

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

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
    const [reports, setReports] = useState<Report[]>(sampleReports);
    const [loading, setLoading] = useState<boolean>(true);

    const refreshReports = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const liveData = await fetchReports();
            if (Array.isArray(liveData) && liveData.length > 0) {
                setReports(liveData);
            }
        } catch (err) {
            console.warn('[ReportsContext] Could not load live reports, using resilient offline fallback:', err);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        const initialLoad = async () => {
            try {
                const liveData = await fetchReports();
                if (mounted && Array.isArray(liveData) && liveData.length > 0) {
                    setReports(liveData);
                }
            } catch (err) {
                console.warn('[ReportsContext] Initial load failed, using fallback:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initialLoad();

        // Subscribe to live database changes across conversations, fb_comments, and incident_reports
        const unsubscribe = subscribeToReports(() => {
            refreshReports(false);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [refreshReports]);

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
            console.error('[ReportsContext] Failed to persist bulk update:', err);
            return false;
        }
    }, []);

    const getVerifiedReports = useCallback(() => {
        return reports.filter((r) => r.status === 'verified');
    }, [reports]);

    const getReportsByBarangay = useCallback(() => {
        const map: Record<string, Report[]> = {};
        reports
            .filter((r) => r.status !== 'rejected')
            .forEach((r) => {
                const b = r.barangay || 'Unknown';
                if (!map[b]) map[b] = [];
                map[b].push(r);
            });
        return map;
    }, [reports]);

    return (
        <ReportsContext.Provider value={{
            reports,
            setReports,
            loading,
            refreshReports,
            updateReport,
            bulkUpdateReports,
            getVerifiedReports,
            getReportsByBarangay,
        }}>
            {children}
        </ReportsContext.Provider>
    );
}

export function useReports() {
    const ctx = useContext(ReportsContext);
    if (!ctx) throw new Error('useReports must be used inside ReportsProvider');
    return ctx;
}