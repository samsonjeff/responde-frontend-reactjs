import { apiFetch } from './authService';
import type { AnalyticsReport } from '../pages/Analytics';

export interface AnalyticsOverview {
  total: number;
  high: number;
  verified: number;
  resolvedToday: number;
  incomplete: number;
  bot: number;
  scraper: number;
  avgResponseTimeMinutes: number;
}

export interface IncidentTypeMetric {
  name: string;
  value: number;
  color: string;
}

export interface VolumeTrendPoint {
  date: string;
  count: number;
  bot: number;
  scraper: number;
}

export interface RiskAssessmentItem {
  barangay: string;
  incidents: number;
  score: number;
  high: number;
  dominantType: string;
  priority: 'High' | 'Moderate' | 'Low';
  recommendation: string;
}

export const analyticsService = {
  /**
   * Fetch KPI statistics for the analytics overview.
   */
  async getOverview(params?: Record<string, string>): Promise<AnalyticsOverview> {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    const res = await apiFetch(`/api/analytics/overview${qs}`);
    if (!res.ok) throw new Error('Failed to fetch analytics overview');
    const json = await res.json();
    return json.stats;
  },

  /**
   * Fetch incident type distribution for charts.
   */
  async getIncidentTypes(params?: Record<string, string>): Promise<IncidentTypeMetric[]> {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    const res = await apiFetch(`/api/analytics/incident-types${qs}`);
    if (!res.ok) throw new Error('Failed to fetch incident type metrics');
    const json = await res.json();
    return json.data ?? [];
  },

  /**
   * Fetch volume trends over time (range: 7d, 30d, 90d).
   */
  async getVolumeTrends(range: '7d' | '30d' | '90d' = '7d'): Promise<VolumeTrendPoint[]> {
    const res = await apiFetch(`/api/analytics/volume-trends?range=${range}`);
    if (!res.ok) throw new Error('Failed to fetch volume trends');
    const json = await res.json();
    return json.data ?? [];
  },

  /**
   * Fetch ranked risk assessment and resource recommendations.
   */
  async getRiskAssessment(): Promise<RiskAssessmentItem[]> {
    const res = await apiFetch('/api/analytics/risk-assessment');
    if (!res.ok) throw new Error('Failed to fetch risk assessment');
    const json = await res.json();
    return json.data ?? [];
  },

  /**
   * Fetch all reports with query filters for tables / CSV download.
   */
  async getReports(params?: Record<string, string>): Promise<AnalyticsReport[]> {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    const res = await apiFetch(`/api/analytics/reports${qs}`);
    if (!res.ok) throw new Error('Failed to fetch analytics reports');
    const json = await res.json();
    return json.data ?? [];
  },
};
