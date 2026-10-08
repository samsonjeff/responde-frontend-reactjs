// src/context/ReportsContext.tsx
// Unified state and live synchronization between IncidentReports, GeospatialMap, and Analytics
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { sampleReports, type Report } from '../data/sample-reports';
import { geospatialService } from '../services/geospatialService';

interface ReportsContextValue {
    reports: Report[];
    loading: boolean;
    refreshReports: () => Promise<void>;
    updateReport: (id: string, updates: Partial<Report>) => void;
    getVerifiedReports: () => Report[];
    getReportsByBarangay: () => Record<string, Report[]>;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
    const [reports, setReports] = useState<Report[]>(sampleReports);
    const [loading, setLoading] = useState<boolean>(true);

    const refreshReports = useCallback(async () => {
        try {
            const livePins = await geospatialService.getPins();
            if (Array.isArray(livePins) && livePins.length > 0) {
                setReports(livePins);
            }
        } catch (err) {
            console.warn('[ReportsContext] Could not load live reports, using resilient offline fallback:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshReports();
    }, [refreshReports]);

    const updateReport = useCallback((id: string, updates: Partial<Report>) => {
        setReports((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
        );
    }, []);

    const getVerifiedReports = useCallback(() => {
        return reports.filter((r) => r.status === 'verified');
    }, [reports]);

    const getReportsByBarangay = useCallback(() => {
        const map: Record<string, Report[]> = {};
        reports
            .filter((r) => r.status === 'verified' || r.status === 'under_review')
            .forEach((r) => {
                if (!map[r.barangay]) map[r.barangay] = [];
                map[r.barangay].push(r);
            });
        return map;
    }, [reports]);

    return (
        <ReportsContext.Provider value={{ reports, loading, refreshReports, updateReport, getVerifiedReports, getReportsByBarangay }}>
            {children}
        </ReportsContext.Provider>
    );
}

export function useReports() {
    const ctx = useContext(ReportsContext);
    if (!ctx) throw new Error('useReports must be used inside ReportsProvider');
    return ctx;
}