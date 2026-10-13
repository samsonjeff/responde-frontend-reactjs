// src/lib/map-styles.ts
// MapLibre style configurations — OpenStreetMap tiles (free, no API key)
// Dark mode achieved via CSS filter on the map canvas
// ─────────────────────────────────────────────────────────────────────────────

import type { MapTheme } from '../types/geospatial';

/** OpenStreetMap — free, no API key, always available */
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_THEMES: Record<string, MapTheme> = {
    light: {
        style: 'light',
        tileUrl: OSM_TILE_URL,
    },
    dark: {
        style: 'dark',
        tileUrl: OSM_TILE_URL,
    },
};

/**
 * Build a minimal MapLibre style JSON for raster tiles.
 */
export function buildRasterStyle(tileUrl: string): any {
    return {
        version: 8,
        sources: {
            'osm-raster': {
                type: 'raster',
                tiles: [tileUrl],
                tileSize: 256,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxzoom: 19,
            },
        },
        layers: [
            {
                id: 'osm-raster-layer',
                type: 'raster',
                source: 'osm-raster',
                minzoom: 0,
                maxzoom: 22,
            },
        ],
    };
}

/** Default map center: Talisay Municipal Hall area */
export const DEFAULT_CENTER: [number, number] = [121.0214, 14.0966];

/** Default zoom: shows Talisay municipality */
export const DEFAULT_ZOOM = 12;

/** Max bounds allowing natural viewing and panning of Talisay and Taal Lake area */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
    [120.88, 13.96], // SW — allows Taal Lake and Volcano Island to be naturally visible on the base map
    [121.14, 14.22], // NE — generous padding north/east for Tranca & Aya
];