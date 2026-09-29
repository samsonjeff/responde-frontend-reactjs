// src/components/MapContainer.tsx
// MapLibre base map + Choropleth (real data) + Pin layer + Boundaries
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

import { buildRasterStyle, DEFAULT_CENTER, DEFAULT_ZOOM, MAX_BOUNDS } from '../lib/map-styles';
import type { BarangayFeatureCollection, MapLayerState, SelectedFeature } from '../types/geospatial';
import type { Report } from '../data/sample-reports';

import { talisayBarangays } from '../data/talisay-barangays';

interface MapContainerProps {
    theme: 'light' | 'dark';
    layers: MapLayerState;
    barangayCounts: Record<string, number>;
    pinReports: Report[];
    onSelectFeature: (feature: SelectedFeature) => void;
}

const SOURCE_ID = 'barangays';
const FILL_LAYER_ID = 'barangays-choropleth';
const LINE_LAYER_ID = 'barangays-boundary';
const HIGHLIGHT_LAYER_ID = 'barangays-highlight';
const PIN_SOURCE_ID = 'pins';
const PIN_LAYER_ID = 'incident-pins';

interface BarangayLabelInfo {
    id: number;
    name: string;
    displayName: string;
    centroid: [number, number];
}

function getBarangayLabels(): {
    regularBarangays: BarangayLabelInfo[];
    poblacionBarangays: BarangayLabelInfo[];
    poblacionCenter: [number, number];
} {
    const seen = new Set<string>();
    const regular: BarangayLabelInfo[] = [];
    const poblacion: BarangayLabelInfo[] = [];

    for (const feature of talisayBarangays.features) {
        const { id, name, centroid } = feature.properties;
        // Poblacion Barangay 6 has 4 polygon parts in data; use the town center centroid
        if (name === 'Poblacion Barangay 6' && (centroid[0] < 121.01 || centroid[1] < 14.08)) {
            continue;
        }
        if (seen.has(name)) continue;
        seen.add(name);

        if (name.startsWith('Poblacion Barangay ')) {
            const num = name.replace('Poblacion Barangay ', '').trim();
            poblacion.push({
                id,
                name,
                displayName: `Poblacion ${num}`,
                centroid,
            });
        } else {
            regular.push({
                id,
                name,
                displayName: name,
                centroid,
            });
        }
    }

    // Centroid of the Poblacion cluster in Talisay
    const poblacionCenter: [number, number] = [121.022, 14.0925];
    return { regularBarangays: regular, poblacionBarangays: poblacion, poblacionCenter };
}

function createLabelElement(
    text: string,
    onClick: () => void,
    isSummary = false
): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'barangay-map-label-wrapper';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.cursor = 'pointer';

    const pill = document.createElement('div');
    pill.className = `px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-tight whitespace-nowrap select-none transition-all duration-150 shadow-xs hover:shadow-md hover:scale-105 active:scale-95 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700/80 ${
        isSummary ? 'ring-1 ring-blue-500/40 text-blue-700 dark:text-blue-300 font-bold' : ''
    }`;
    pill.textContent = text;
    wrapper.appendChild(pill);

    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });

    return wrapper;
}

function enrichGeoJSONWithCounts(
    geojson: BarangayFeatureCollection,
    scores: Record<string, number>
): BarangayFeatureCollection {
    return {
        ...geojson,
        features: geojson.features.map((f) => ({
            ...f,
            properties: {
                ...f.properties,
                severityScore: scores[f.properties.name] ?? 0,
            },
        })),
    };
}

function parseCoords(coords: string): [number, number] | null {
    const parts = coords.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[1], parts[0]];
    }
    return null;
}

function buildPinGeoJSON(reports: Report[]) {
    return {
        type: 'FeatureCollection' as const,
        features: reports
            .map((r) => {
                const c = parseCoords(r.coordinates);
                return {
                    type: 'Feature' as const,
                    properties: { id: r.id, urgency: r.urgency, type: r.type },
                    geometry: { type: 'Point' as const, coordinates: c || [0, 0] },
                };
            })
            .filter((f) => f.geometry.coordinates[0] !== 0),
    };
}

function buildChoroplethPaint(theme: 'light' | 'dark'): maplibregl.FillLayerSpecification['paint'] {
    // [none, low, moderate, high]
    const colors =
        theme === 'light'
            ? ['#e2e8f0', '#22c55e', '#eab308', '#dc2626']
            : ['#334155', '#4ade80', '#facc15', '#f87171'];

    // Max urgency per barangay: Low=1, Moderate=2, High=3
    return {
        'fill-color': [
            'step',
            ['get', 'severityScore'],
            colors[0], // 0 — no reports
            1, colors[1], // 1 — Low urgency (green)
            2, colors[2], // 2 — Moderate urgency (yellow)
            3, colors[3], // 3 — High urgency (red)
        ],
        'fill-opacity': theme === 'light' ? 0.55 : 0.6,
    };
}

function buildBoundaryPaint(theme: 'light' | 'dark'): maplibregl.LineLayerSpecification['paint'] {
    return {
        'line-color': theme === 'light' ? '#64748b' : '#94a3b8',
        'line-width': 1.5,
        'line-opacity': 0.8,
    };
}

export default function MapContainer({ theme, layers, barangayCounts, pinReports, onSelectFeature }: MapContainerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const isLoadedRef = useRef(false);

    // Label markers references
    const regularMarkersRef = useRef<maplibregl.Marker[]>([]);
    const poblacionSummaryMarkerRef = useRef<maplibregl.Marker | null>(null);
    const poblacionDetailMarkersRef = useRef<maplibregl.Marker[]>([]);

    // Keep refs to avoid stale closures or race conditions during map load
    const layersRef = useRef(layers);
    layersRef.current = layers;

    const themeRef = useRef(theme);
    themeRef.current = theme;

    const barangayCountsRef = useRef(barangayCounts);
    barangayCountsRef.current = barangayCounts;

    const pinReportsRef = useRef(pinReports);
    pinReportsRef.current = pinReports;

    const onSelectFeatureRef = useRef(onSelectFeature);
    onSelectFeatureRef.current = onSelectFeature;

    const updateLabelsVisibility = useCallback(() => {
        const map = mapRef.current;
        if (!map || !isLoadedRef.current) return;
        const isLayerVisible = layersRef.current.boundaries || layersRef.current.choropleth;
        const isZoomedIn = map.getZoom() >= 13.5;

        regularMarkersRef.current.forEach((marker) => {
            const el = marker.getElement();
            el.style.display = isLayerVisible ? 'block' : 'none';
        });

        if (poblacionSummaryMarkerRef.current) {
            const el = poblacionSummaryMarkerRef.current.getElement();
            el.style.display = isLayerVisible && !isZoomedIn ? 'block' : 'none';
        }

        poblacionDetailMarkersRef.current.forEach((marker) => {
            const el = marker.getElement();
            el.style.display = isLayerVisible && isZoomedIn ? 'block' : 'none';
        });
    }, []);

    // ── 1. Initialize Map Once ──
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        try {
            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style: buildRasterStyle('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                center: DEFAULT_CENTER,
                zoom: DEFAULT_ZOOM,
                maxBounds: MAX_BOUNDS,
                attributionControl: false,
            });

            // Dark mode CSS filter
            if (themeRef.current === 'dark') {
                const canvas = mapContainerRef.current.querySelector('.maplibregl-canvas');
                if (canvas) {
                    (canvas as HTMLElement).style.filter = 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1)';
                }
            }

            map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
            map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

            mapRef.current = map;

            map.on('load', () => {
                isLoadedRef.current = true;

                // ── Barangay GeoJSON Source & Layers ──
                const enriched = enrichGeoJSONWithCounts(talisayBarangays, barangayCountsRef.current);
                map.addSource(SOURCE_ID, { type: 'geojson', data: enriched as any });

                map.addLayer({
                    id: FILL_LAYER_ID,
                    type: 'fill',
                    source: SOURCE_ID,
                    paint: buildChoroplethPaint(themeRef.current),
                    layout: { visibility: layersRef.current.choropleth ? 'visible' : 'none' },
                });

                map.addLayer({
                    id: LINE_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    paint: buildBoundaryPaint(themeRef.current),
                    layout: { visibility: layersRef.current.boundaries ? 'visible' : 'none' },
                });

                map.addLayer({
                    id: HIGHLIGHT_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    paint: {
                        'line-color': themeRef.current === 'light' ? '#0f172a' : '#f8fafc',
                        'line-width': 2.5,
                        'line-opacity': 0,
                    },
                    filter: ['==', ['get', 'id'], -1],
                });

                // ── Pin Source & Layer ──
                const pinGeoJSON = buildPinGeoJSON(pinReportsRef.current);
                map.addSource(PIN_SOURCE_ID, { type: 'geojson', data: pinGeoJSON as any });

                map.addLayer({
                    id: PIN_LAYER_ID,
                    type: 'circle',
                    source: PIN_SOURCE_ID,
                    paint: {
                        'circle-radius': 10,
                        'circle-color': [
                            'match',
                            ['get', 'urgency'],
                            'High', '#ef4444',
                            'Moderate', '#eab308',
                            'Low', '#22c55e',
                            '#94a3b8',
                        ],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2,
                        'circle-opacity': 0.9,
                    },
                    layout: { visibility: layersRef.current.pins ? 'visible' : 'none' },
                });

                // ── Interactions: Barangay ──
                map.on('mouseenter', FILL_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mousemove', FILL_LAYER_ID, (e: any) => {
                    if (e.features?.length > 0) {
                        const id = e.features[0].properties?.id;
                        map.setFilter(HIGHLIGHT_LAYER_ID, ['==', ['get', 'id'], id]);
                        map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-opacity', 0.9);
                    }
                });
                map.on('mouseleave', FILL_LAYER_ID, () => {
                    map.getCanvas().style.cursor = '';
                    map.setFilter(HIGHLIGHT_LAYER_ID, ['==', ['get', 'id'], -1]);
                    map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-opacity', 0);
                });
                map.on('click', FILL_LAYER_ID, (e: any) => {
                    if (e.features?.length > 0) {
                        const props = e.features[0].properties;
                        onSelectFeatureRef.current({ type: 'barangay', id: props.id, name: props.name });
                    }
                });

                // ── Interactions: Pins ──
                map.on('mouseenter', PIN_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', PIN_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
                map.on('click', PIN_LAYER_ID, (e: any) => {
                    if (e.features?.length > 0) {
                        const id = e.features[0].properties?.id;
                        onSelectFeatureRef.current({ type: 'incident', id });
                    }
                });

                // ── Barangay Center Name Labels ──
                const { regularBarangays, poblacionBarangays, poblacionCenter } = getBarangayLabels();

                // 1. Regular barangays (always centered in their boundary)
                regularBarangays.forEach((item) => {
                    const el = createLabelElement(item.displayName, () => {
                        onSelectFeatureRef.current({ type: 'barangay', id: item.id, name: item.name });
                    });
                    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                        .setLngLat(item.centroid)
                        .addTo(map);
                    regularMarkersRef.current.push(marker);
                });

                // 2. Poblacion overview cluster label (shown when zoomed out < 13.5)
                const summaryEl = createLabelElement(
                    'Poblacion',
                    () => {
                        map.flyTo({ center: poblacionCenter, zoom: 15, duration: 800, essential: true });
                    },
                    true
                );
                poblacionSummaryMarkerRef.current = new maplibregl.Marker({ element: summaryEl, anchor: 'center' })
                    .setLngLat(poblacionCenter)
                    .addTo(map);

                // 3. Poblacion individual detail labels (shown when zoomed in >= 13.5)
                poblacionBarangays.forEach((item) => {
                    const el = createLabelElement(item.displayName, () => {
                        onSelectFeatureRef.current({ type: 'barangay', id: item.id, name: item.name });
                    });
                    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                        .setLngLat(item.centroid)
                        .addTo(map);
                    poblacionDetailMarkersRef.current.push(marker);
                });

                map.on('zoom', updateLabelsVisibility);
                updateLabelsVisibility();
            });

            map.on('error', (e: any) => console.error('❌ MapLibre error:', e.error));

            // ── FlyTo Event Listener ──
            const handleFlyTo = (e: any) => {
                const { center, zoom = 15 } = e.detail;
                map.flyTo({ center, zoom, duration: 1500, essential: true });
            };
            window.addEventListener('map-fly-to', handleFlyTo);

            const handleResize = () => map.resize();
            window.addEventListener('resize', handleResize);

            const resizeObserver = new ResizeObserver(() => {
                map.resize();
            });
            resizeObserver.observe(mapContainerRef.current);

            return () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('map-fly-to', handleFlyTo);
                resizeObserver.disconnect();
                isLoadedRef.current = false;

                // Cleanup markers
                regularMarkersRef.current.forEach((m) => m.remove());
                regularMarkersRef.current = [];
                if (poblacionSummaryMarkerRef.current) {
                    poblacionSummaryMarkerRef.current.remove();
                    poblacionSummaryMarkerRef.current = null;
                }
                poblacionDetailMarkersRef.current.forEach((m) => m.remove());
                poblacionDetailMarkersRef.current = [];

                map.remove();
                mapRef.current = null;
            };
        } catch (err) {
            console.error('❌ MapLibre init failed:', err);
        }
    }, []);

    // ── 2. Update Pins via setData() when pinReports change ──
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isLoadedRef.current) return;

        const pinSource = map.getSource(PIN_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (pinSource) {
            pinSource.setData(buildPinGeoJSON(pinReports) as any);
        }
    }, [pinReports]);

    // ── 3. Update Choropleth via setData() when barangayCounts change ──
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isLoadedRef.current) return;

        const brgySource = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (brgySource) {
            brgySource.setData(enrichGeoJSONWithCounts(talisayBarangays, barangayCounts) as any);
        }
    }, [barangayCounts]);

    // ── 4. React to Theme Changes via Canvas Filter & Paint Properties ──
    useEffect(() => {
        const map = mapRef.current;
        const container = mapContainerRef.current;
        if (container) {
            const canvas = container.querySelector('.maplibregl-canvas') as HTMLElement;
            if (canvas) {
                canvas.style.filter = theme === 'dark'
                    ? 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1)'
                    : 'none';
            }
        }

        if (!map || !isLoadedRef.current) return;

        if (map.getLayer(FILL_LAYER_ID)) {
            const paint = buildChoroplethPaint(theme);
            if (paint) {
                map.setPaintProperty(FILL_LAYER_ID, 'fill-color', paint['fill-color']);
                map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', paint['fill-opacity']);
            }
        }
        if (map.getLayer(LINE_LAYER_ID)) {
            map.setPaintProperty(LINE_LAYER_ID, 'line-color', theme === 'light' ? '#64748b' : '#94a3b8');
        }
        if (map.getLayer(HIGHLIGHT_LAYER_ID)) {
            map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-color', theme === 'light' ? '#0f172a' : '#f8fafc');
        }
    }, [theme]);

    // ── 5. React to Layer Toggles ──
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isLoadedRef.current) return;

        if (map.getLayer(FILL_LAYER_ID)) {
            map.setLayoutProperty(FILL_LAYER_ID, 'visibility', layers.choropleth ? 'visible' : 'none');
        }
        if (map.getLayer(LINE_LAYER_ID)) {
            map.setLayoutProperty(LINE_LAYER_ID, 'visibility', layers.boundaries ? 'visible' : 'none');
        }
        if (map.getLayer(PIN_LAYER_ID)) {
            map.setLayoutProperty(PIN_LAYER_ID, 'visibility', layers.pins ? 'visible' : 'none');
        }

        updateLabelsVisibility();
    }, [layers, updateLabelsVisibility]);

    return (
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ minHeight: '100%' }} />
    );
}