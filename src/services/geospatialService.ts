import { apiFetch } from './authService';
import type { Report } from '../data/sample-reports';
import type { BarangayFeatureCollection, BarangayIncidentCount } from '../types/geospatial';

export interface GeospatialSummary {
  totalIncidents: number;
  highUrgencyTotal: number;
  activeBarangays: number;
  totalBarangays: number;
  topBarangays: BarangayIncidentCount[];
}

export interface BarangayCountsResponse {
  success: boolean;
  barangayCounts: Record<string, number>;
  summary: BarangayIncidentCount[];
  totalIncidents: number;
  highUrgencyTotal: number;
}

export const geospatialService = {
  /**
   * Fetch incident pins with coordinates for map display and side drawer.
   */
  async getPins(params?: {
    status?: string;
    urgency?: string;
    type?: string;
    barangay?: string;
    limit?: number;
  }): Promise<Report[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiFetch(`/api/geospatial/pins${qs}`);
    if (!res.ok) throw new Error('Failed to fetch geospatial incident pins');
    const json = await res.json();
    return json.data ?? [];
  },

  /**
   * Fetch live barangay max-urgency weights and incident counts for choropleth rendering.
   */
  async getBarangayCounts(params?: {
    urgency?: string;
    type?: string;
  }): Promise<BarangayCountsResponse> {
    const query = new URLSearchParams();
    if (params?.urgency) query.append('urgency', params.urgency);
    if (params?.type) query.append('type', params.type);
    const qs = query.toString() ? `?${query.toString()}` : '';

    const res = await apiFetch(`/api/geospatial/barangay-counts${qs}`);
    if (!res.ok) throw new Error('Failed to fetch barangay counts');
    return res.json();
  },

  /**
   * Fetch Talisay GeoJSON boundaries with live incident counts embedded in properties.
   */
  async getGeoJSON(): Promise<BarangayFeatureCollection> {
    const res = await apiFetch('/api/geospatial/geojson');
    if (!res.ok) throw new Error('Failed to fetch geospatial GeoJSON boundaries');
    return res.json();
  },

  /**
   * Fetch high-level summary of geospatial coverage.
   */
  async getSummary(): Promise<GeospatialSummary> {
    const res = await apiFetch('/api/geospatial/summary');
    if (!res.ok) throw new Error('Failed to fetch geospatial summary');
    return res.json();
  },
};
