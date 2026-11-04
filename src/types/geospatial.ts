// src/types/geospatial.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface BarangayFeature {
    type: 'Feature';
    properties: {
        id: number;
        name: string;
        centroid: [number, number]; // [lng, lat]
        psgc?: number;
        area_km2?: number;
        len_km?: number;
        part?: number;
    };
    geometry: {
        type: 'Polygon';
        coordinates: number[][][];
    };
}

export interface BarangayFeatureCollection {
    type: 'FeatureCollection';
    name: string;
    description: string;
    features: BarangayFeature[];
}

export interface BarangayIncidentCount {
    name: string;
    count: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
}

export interface MapLayerState {
    choropleth: boolean;
    pins: boolean;
    boundaries: boolean;
    dispatchArcs?: boolean;
}

export interface MapTheme {
    style: 'light' | 'dark';
    tileUrl: string;
}

export type SelectedFeature =
    | { type: 'barangay'; id: number; name: string }
    | { type: 'incident'; id: string }
    | { type: 'mdrrmo' }
    | null;
