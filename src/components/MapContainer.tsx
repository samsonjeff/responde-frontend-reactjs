// src/components/MapContainer.tsx
// MapLibre base map + Choropleth + Incident Pins + Boundaries
// + MDRRMO Talisay HQ Beacon + True 3D Upward Curved Throbbing Dispatch Arcs
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
import mdrrmoLogoUrl from '../assets/mdrrmo-talisay-logo.png';
import {
    MDRRMO_TALISAY_COORDS,
    getActiveBarangaysFromReports,
    buildGroundShadowsGeoJSON,
    buildTargetRingsGeoJSON,
    renderDispatchArcsOverlay,
    hitTestProjectedArcs,
    type ActiveBarangayTarget,
    type ProjectedArcScreenData,
} from '../lib/dispatch-arcs';

interface MapContainerProps {
    theme: 'light' | 'dark';
    layers: MapLayerState;
    barangayCounts: Record<string, number>;
    pinReports: Report[];
    onSelectFeature: (feature: SelectedFeature) => void;
    selectedFeature?: SelectedFeature;
}

const SOURCE_ID = 'barangays';
const FILL_LAYER_ID = 'barangays-choropleth';
const LINE_LAYER_ID = 'barangays-boundary';
const HIGHLIGHT_FILL_LAYER_ID = 'barangays-highlight-fill';
const HIGHLIGHT_GLOW_LAYER_ID = 'barangays-highlight-glow';
const HIGHLIGHT_LAYER_ID = 'barangays-highlight';
const PIN_SOURCE_ID = 'pins';
const PIN_LAYER_ID = 'incident-pins';

// ── Dispatch Ground Shadow & Destination Target Layer IDs ──
const DISPATCH_TARGETS_SOURCE_ID = 'dispatch-targets-source';
const DISPATCH_SHADOWS_SOURCE_ID = 'dispatch-shadows-source';
const DISPATCH_SHADOWS_LAYER_ID = 'dispatch-shadows-layer';
const DISPATCH_TARGETS_RING_LAYER_ID = 'dispatch-targets-ring';
const DISPATCH_TARGETS_DOT_LAYER_ID = 'dispatch-targets-dot';

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
        // Ignore non-mainland feature
        if (centroid[1] < 14.075) continue;
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
    isSummary = false,
    onHover?: (isHovering: boolean) => void
): { wrapper: HTMLDivElement; pill: HTMLDivElement } {
    const wrapper = document.createElement('div');
    wrapper.className = 'barangay-map-label-wrapper';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.cursor = 'pointer';

    const pill = document.createElement('div');
    pill.className = `barangay-map-pill px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-tight whitespace-nowrap select-none transition-all duration-200 shadow-xs bg-white/92 dark:bg-slate-900/92 backdrop-blur-xs text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700/80 ${
        isSummary ? 'ring-1 ring-blue-500/50 text-blue-700 dark:text-blue-300 font-bold' : ''
    }`;
    pill.textContent = text;
    wrapper.appendChild(pill);

    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });

    if (onHover) {
        wrapper.addEventListener('mouseenter', () => onHover(true));
        wrapper.addEventListener('mouseleave', () => onHover(false));
    }

    return { wrapper, pill };
}

/**
 * Creates the high-tech glowing MDRRMO Talisay Command Center HTML beacon
 * Uses the official MDRRMO Talisay logo seal (NO text), anchored on top with pinpoint.
 */
function createMdrrmoMarkerElement(onClick: () => void): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'mdrrmo-marker-wrapper relative cursor-pointer select-none';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.zIndex = '999999';

    // Ambient radar pulse waves
    const ring1 = document.createElement('div');
    ring1.className = 'mdrrmo-radar-ring';

    const ring2 = document.createElement('div');
    ring2.className = 'mdrrmo-radar-ring-delayed';

    // Central circular logo seal emblem - Pure logo, NO TEXT
    const emblem = document.createElement('div');
    emblem.className = 'mdrrmo-logo-emblem';
    emblem.title = 'MDRRMO Talisay HQ • Municipal Command Center (Click to inspect)';

    const img = document.createElement('img');
    img.src = mdrrmoLogoUrl;
    img.alt = 'MDRRMO Talisay HQ';
    img.className = 'mdrrmo-logo-img';
    img.draggable = false;
    emblem.appendChild(img);

    // Precise pinpoint arrow pointing down to municipal hall coordinates
    const pinPointer = document.createElement('div');
    pinPointer.className = 'mdrrmo-pin-pointer';

    wrapper.appendChild(ring1);
    wrapper.appendChild(ring2);
    wrapper.appendChild(emblem);
    wrapper.appendChild(pinPointer);

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
    if (!coords || typeof coords !== 'string') return null;
    const parts = coords.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        let lat: number;
        let lng: number;
        if (parts[0] > 50) {
            lng = parts[0];
            lat = parts[1];
        } else {
            lat = parts[0];
            lng = parts[1];
        }
        return [lng, lat];
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
                    geometry: { type: 'Point' as const, coordinates: c || [121.022, 14.095] },
                };
            })
            .filter((f) => f.geometry.coordinates[0] !== 0 && f.geometry.coordinates[1] >= 14.075),
    };
}

function buildChoroplethPaint(theme: 'light' | 'dark'): maplibregl.FillLayerSpecification['paint'] {
    const colors =
        theme === 'light'
            ? ['#e2e8f0', '#22c55e', '#eab308', '#dc2626']
            : ['#334155', '#4ade80', '#facc15', '#f87171'];

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

export default function MapContainer({
    theme,
    layers,
    barangayCounts,
    pinReports,
    onSelectFeature,
    selectedFeature,
}: MapContainerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const isLoadedRef = useRef(false);

    // Label markers references
    const regularMarkersRef = useRef<maplibregl.Marker[]>([]);
    const poblacionSummaryMarkerRef = useRef<maplibregl.Marker | null>(null);
    const poblacionDetailMarkersRef = useRef<maplibregl.Marker[]>([]);
    const labelPillsRef = useRef<Map<number, HTMLDivElement>>(new Map());
    const hoveredBarangayIdRef = useRef<number | null>(null);
    const selectedBarangayIdRef = useRef<number | null>(null);

    const setHoveredBarangay = useCallback((id: number | null) => {
        const map = mapRef.current;
        if (!map || !isLoadedRef.current) return;
        if (hoveredBarangayIdRef.current === id) return;
        hoveredBarangayIdRef.current = id;

        const effectiveId = id !== null ? id : (selectedBarangayIdRef.current ?? -1);
        const isShowing = effectiveId !== -1;

        if (map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
            map.setFilter(HIGHLIGHT_FILL_LAYER_ID, ['==', ['get', 'id'], effectiveId]);
            map.setPaintProperty(HIGHLIGHT_FILL_LAYER_ID, 'fill-opacity', isShowing ? 0.22 : 0);
        }
        if (map.getLayer(HIGHLIGHT_GLOW_LAYER_ID)) {
            map.setFilter(HIGHLIGHT_GLOW_LAYER_ID, ['==', ['get', 'id'], effectiveId]);
            map.setPaintProperty(HIGHLIGHT_GLOW_LAYER_ID, 'line-opacity', isShowing ? 0.85 : 0);
        }
        if (map.getLayer(HIGHLIGHT_LAYER_ID)) {
            map.setFilter(HIGHLIGHT_LAYER_ID, ['==', ['get', 'id'], effectiveId]);
            map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-opacity', isShowing ? 1.0 : 0);
        }

        labelPillsRef.current.forEach((pill, pillId) => {
            if (isShowing && pillId === effectiveId) {
                pill.classList.add('is-hovered');
            } else {
                pill.classList.remove('is-hovered');
            }
        });
    }, []);

    useEffect(() => {
        if (selectedFeature?.type === 'barangay' && typeof selectedFeature.id === 'number') {
            selectedBarangayIdRef.current = selectedFeature.id;
        } else {
            selectedBarangayIdRef.current = null;
        }
        if (hoveredBarangayIdRef.current === null) {
            setHoveredBarangay(null);
        }
    }, [selectedFeature, setHoveredBarangay]);

    // MDRRMO Marker & 3D Dispatch Arcs Canvas Overlay references
    const mdrrmoMarkerRef = useRef<maplibregl.Marker | null>(null);
    const arcCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeTargetsRef = useRef<ActiveBarangayTarget[]>([]);
    const projectedArcsRef = useRef<ProjectedArcScreenData[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const lastAnimTimeRef = useRef<number>(0);

    // Keep refs to avoid stale closures
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

    const drawArcsCanvas = useCallback((now = performance.now()) => {
        const map = mapRef.current;
        const overlay = arcCanvasRef.current;
        if (!map || !overlay || !isLoadedRef.current) return;

        const isArcsVisible = layersRef.current.dispatchArcs !== false;
        projectedArcsRef.current = renderDispatchArcsOverlay(
            map,
            overlay,
            activeTargetsRef.current,
            now,
            isArcsVisible
        );
    }, []);

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

    // ── Throbbing & Photon Light Pulse Animation Loop ──
    const startPulseAnimation = useCallback(() => {
        if (animFrameRef.current !== null) return;

        const animateLoop = (now: number) => {
            animFrameRef.current = requestAnimationFrame(animateLoop);

            const map = mapRef.current;
            if (!map || !isLoadedRef.current) return;

            // Pause calculations if dispatchArcs layer is disabled or tab is hidden
            if (layersRef.current.dispatchArcs === false || document.hidden) return;

            // Throttle to ~40fps (every ~24ms) to keep CPU overhead negligible
            if (now - lastAnimTimeRef.current < 24) return;
            lastAnimTimeRef.current = now;

            drawArcsCanvas(now);
        };

        animFrameRef.current = requestAnimationFrame(animateLoop);
    }, [drawArcsCanvas]);

    const stopPulseAnimation = useCallback(() => {
        if (animFrameRef.current !== null) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
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
                    (canvas as HTMLElement).style.filter =
                        'invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1)';
                }
            }

            // Create High-DPI 2D Canvas Overlay for True 3D Curved Arcs & Pulses
            const arcOverlayCanvas = document.createElement('canvas');
            arcOverlayCanvas.className = 'dispatch-arcs-overlay-canvas';
            arcOverlayCanvas.style.position = 'absolute';
            arcOverlayCanvas.style.inset = '0';
            arcOverlayCanvas.style.width = '100%';
            arcOverlayCanvas.style.height = '100%';
            arcOverlayCanvas.style.pointerEvents = 'none';
            arcOverlayCanvas.style.zIndex = '5';
            map.getCanvasContainer().appendChild(arcOverlayCanvas);
            arcCanvasRef.current = arcOverlayCanvas;

            map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
            map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

            const ro = new ResizeObserver(() => {
                map.resize();
            });
            ro.observe(mapContainerRef.current);

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

                // ── Glowing Blue Barangay Highlight & Hover Layers ──
                const blueGlowTone = themeRef.current === 'light' ? '#0071E3' : '#38bdf8';

                // 1. Translucent glowing electric blue fill
                map.addLayer({
                    id: HIGHLIGHT_FILL_LAYER_ID,
                    type: 'fill',
                    source: SOURCE_ID,
                    paint: {
                        'fill-color': blueGlowTone,
                        'fill-opacity': 0,
                    },
                    filter: ['==', ['get', 'id'], -1],
                });

                // 2. Wide blurred neon bloom halo
                map.addLayer({
                    id: HIGHLIGHT_GLOW_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    paint: {
                        'line-color': blueGlowTone,
                        'line-width': 8,
                        'line-blur': 4,
                        'line-opacity': 0,
                    },
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round',
                    },
                    filter: ['==', ['get', 'id'], -1],
                });

                // 3. Crisp luminous electric blue inner core stroke
                map.addLayer({
                    id: HIGHLIGHT_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    paint: {
                        'line-color': blueGlowTone,
                        'line-width': 2.75,
                        'line-opacity': 0,
                    },
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round',
                    },
                    filter: ['==', ['get', 'id'], -1],
                });

                // ── MDRRMO Dispatch Ground Shadows & Target Rings ──
                const activeTargets = getActiveBarangaysFromReports(
                    pinReportsRef.current,
                    talisayBarangays
                );
                activeTargetsRef.current = activeTargets;

                const shadowsGeoJSON = buildGroundShadowsGeoJSON(activeTargets);
                const targetsGeoJSON = buildTargetRingsGeoJSON(activeTargets);

                // Add Ground Shadow Source (for 3D floating depth cue)
                map.addSource(DISPATCH_SHADOWS_SOURCE_ID, {
                    type: 'geojson',
                    data: shadowsGeoJSON as any,
                });

                // Add Target Rings Source
                map.addSource(DISPATCH_TARGETS_SOURCE_ID, {
                    type: 'geojson',
                    data: targetsGeoJSON as any,
                });

                const isArcsVisible = layersRef.current.dispatchArcs !== false;

                // Layer 0: Subtle Ground Shadow Trace (visible when tilted in 3D view)
                map.addLayer({
                    id: DISPATCH_SHADOWS_LAYER_ID,
                    type: 'line',
                    source: DISPATCH_SHADOWS_SOURCE_ID,
                    paint: {
                        'line-color': '#0f172a',
                        'line-width': 2.2,
                        'line-blur': 1.5,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0,
                    },
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round',
                        visibility: isArcsVisible ? 'visible' : 'none',
                    },
                });

                // Layer 1: Destination Target Rings
                map.addLayer({
                    id: DISPATCH_TARGETS_RING_LAYER_ID,
                    type: 'circle',
                    source: DISPATCH_TARGETS_SOURCE_ID,
                    paint: {
                        'circle-radius': 14,
                        'circle-color': 'transparent',
                        'circle-stroke-color': ['get', 'color'],
                        'circle-stroke-width': 2,
                        'circle-stroke-opacity': 0.85,
                    },
                    layout: {
                        visibility: isArcsVisible ? 'visible' : 'none',
                    },
                });

                // Layer 2: Destination Target Center Dot
                map.addLayer({
                    id: DISPATCH_TARGETS_DOT_LAYER_ID,
                    type: 'circle',
                    source: DISPATCH_TARGETS_SOURCE_ID,
                    paint: {
                        'circle-radius': 3.5,
                        'circle-color': ['get', 'color'],
                        'circle-opacity': 0.95,
                    },
                    layout: {
                        visibility: isArcsVisible ? 'visible' : 'none',
                    },
                });

                // ── 3D/2D Arc Hover Tooltip ──
                const arcPopup = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: 10,
                    className: 'dispatch-arc-popup',
                });
                let isHoveringArc = false;

                map.on('mousemove', (e: any) => {
                    if (layersRef.current.dispatchArcs === false) {
                        if (isHoveringArc) {
                            isHoveringArc = false;
                            arcPopup.remove();
                        }
                        return;
                    }
                    const hitTarget = hitTestProjectedArcs(projectedArcsRef.current, e.point, 8);
                    if (hitTarget) {
                        isHoveringArc = true;
                        map.getCanvas().style.cursor = 'pointer';
                        arcPopup
                            .setLngLat(e.lngLat)
                            .setHTML(`
                                <div style="font-family: inherit; padding: 4px 6px; font-size: 11px; line-height: 1.35;">
                                    <div style="font-weight: 700; color: #0284c7;">MDRRMO ➔ ${hitTarget.name} Corridor</div>
                                    <div style="color: #64748b; font-size: 10px; margin-top: 2px;">
                                        ${hitTarget.incidentCount} active ${hitTarget.incidentCount === 1 ? 'incident' : 'incidents'} • <span style="font-weight:700; color:${hitTarget.color};">${hitTarget.highestUrgency} Urgency</span>
                                    </div>
                                </div>
                            `)
                            .addTo(map);
                    } else if (isHoveringArc) {
                        isHoveringArc = false;
                        map.getCanvas().style.cursor = '';
                        arcPopup.remove();
                    }
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

                // ── Interactions: Pins ──
                map.on('mouseenter', PIN_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', PIN_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
                map.on('click', PIN_LAYER_ID, (e: any) => {
                    if (e.originalEvent) {
                        e.originalEvent._pinHandled = true;
                    }
                    if (e.features?.length > 0) {
                        const id = e.features[0].properties?.id;
                        onSelectFeatureRef.current({ type: 'incident', id });
                    }
                });

                // ── Interactions: Barangay ──
                map.on('mouseenter', FILL_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mousemove', FILL_LAYER_ID, (e: any) => {
                    if (e.features?.length > 0) {
                        const id = e.features[0].properties?.id;
                        setHoveredBarangay(typeof id === 'number' ? id : parseInt(id, 10));
                    }
                });
                map.on('mouseleave', FILL_LAYER_ID, () => {
                    map.getCanvas().style.cursor = '';
                    setHoveredBarangay(null);
                });
                map.on('click', FILL_LAYER_ID, (e: any) => {
                    if (e.originalEvent?._pinHandled) return;
                    if (e.features?.length > 0) {
                        const props = e.features[0].properties;
                        onSelectFeatureRef.current({ type: 'barangay', id: props.id, name: props.name });
                    }
                });

                // ── MDRRMO Talisay HQ Beacon Marker (Always on top with anchor: bottom) ──
                const mdrrmoEl = createMdrrmoMarkerElement(() => {
                    onSelectFeatureRef.current({ type: 'mdrrmo' });
                });

                const mdrrmoMarker = new maplibregl.Marker({ element: mdrrmoEl, anchor: 'bottom' })
                    .setLngLat(MDRRMO_TALISAY_COORDS)
                    .addTo(map);
                mdrrmoMarkerRef.current = mdrrmoMarker;

                // Ensure marker DOM element is on top of all pins & 3D arcs
                const markerDom = mdrrmoMarker.getElement();
                if (markerDom) {
                    markerDom.style.zIndex = '999999';
                }

                // ── Barangay Center Name Labels ──
                const { regularBarangays, poblacionBarangays, poblacionCenter } = getBarangayLabels();

                // 1. Regular barangays
                regularBarangays.forEach((item) => {
                    const { wrapper, pill } = createLabelElement(
                        item.displayName,
                        () => {
                            onSelectFeatureRef.current({ type: 'barangay', id: item.id, name: item.name });
                        },
                        false,
                        (isHovering) => {
                            setHoveredBarangay(isHovering ? item.id : null);
                        }
                    );
                    labelPillsRef.current.set(item.id, pill);
                    const marker = new maplibregl.Marker({ element: wrapper, anchor: 'center' })
                        .setLngLat(item.centroid)
                        .addTo(map);
                    regularMarkersRef.current.push(marker);
                });

                // 2. Poblacion overview cluster label
                const { wrapper: summaryEl } = createLabelElement(
                    'Poblacion',
                    () => {
                        map.flyTo({ center: poblacionCenter, zoom: 15, duration: 800, essential: true });
                    },
                    true,
                    (isHovering) => {
                        setHoveredBarangay(isHovering ? 1 : null);
                    }
                );
                poblacionSummaryMarkerRef.current = new maplibregl.Marker({ element: summaryEl, anchor: 'center' })
                    .setLngLat(poblacionCenter)
                    .addTo(map);

                // 3. Poblacion individual detail labels
                poblacionBarangays.forEach((item) => {
                    const { wrapper, pill } = createLabelElement(
                        item.displayName,
                        () => {
                            onSelectFeatureRef.current({ type: 'barangay', id: item.id, name: item.name });
                        },
                        false,
                        (isHovering) => {
                            setHoveredBarangay(isHovering ? item.id : null);
                        }
                    );
                    labelPillsRef.current.set(item.id, pill);
                    const marker = new maplibregl.Marker({ element: wrapper, anchor: 'center' })
                        .setLngLat(item.centroid)
                        .addTo(map);
                    poblacionDetailMarkersRef.current.push(marker);
                });

                map.on('zoom', updateLabelsVisibility);
                updateLabelsVisibility();

                // Initial 3D/2D arc draw & start animation loop
                drawArcsCanvas(performance.now());
                startPulseAnimation();
            });

            map.on('error', (e: any) => console.error('❌ MapLibre error:', e.error));

            // Synchronously redraw 3D arcs whenever MapLibre renders a frame (pan/zoom/tilt/rotate)
            const handleMapRender = () => {
                drawArcsCanvas(performance.now());
            };
            map.on('render', handleMapRender);

            // ── FlyTo Event Listener ──
            const handleFlyTo = (e: any) => {
                const { center, zoom = 15 } = e.detail;
                map.flyTo({ center, zoom, duration: 1500, essential: true });
            };
            window.addEventListener('map-fly-to', handleFlyTo);

            const handleToggle3D = (e: any) => {
                const is3D = !!e.detail?.is3D;
                if (is3D) {
                    map.easeTo({ pitch: 65, bearing: -25, center: [121.02, 14.075], duration: 1200 });
                } else {
                    map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
                }
            };
            window.addEventListener('map-toggle-3d', handleToggle3D);

            const handlePitch = () => {
                const pitch = map.getPitch();
                if (map.getLayer(DISPATCH_SHADOWS_LAYER_ID)) {
                    const shadowOpacity = Math.sin((pitch * Math.PI) / 180) * 0.25;
                    map.setPaintProperty(DISPATCH_SHADOWS_LAYER_ID, 'line-opacity', shadowOpacity);
                }
                window.dispatchEvent(new CustomEvent('map-pitch-changed', { detail: { pitch } }));
            };
            map.on('pitch', handlePitch);

            const handleResize = () => map.resize();
            window.addEventListener('resize', handleResize);

            let resizeRaf: number | null = null;
            const resizeObserver = new ResizeObserver(() => {
                if (resizeRaf !== null) return;
                resizeRaf = requestAnimationFrame(() => {
                    resizeRaf = null;
                    map.resize();
                });
            });
            resizeObserver.observe(mapContainerRef.current);

            return () => {
                if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('map-fly-to', handleFlyTo);
                window.removeEventListener('map-toggle-3d', handleToggle3D);
                map.off('render', handleMapRender);
                map.off('pitch', handlePitch);
                resizeObserver.disconnect();
                isLoadedRef.current = false;

                // Stop pulse animation
                stopPulseAnimation();

                if (arcCanvasRef.current) {
                    arcCanvasRef.current.remove();
                    arcCanvasRef.current = null;
                }

                // Cleanup markers
                labelPillsRef.current.clear();
                regularMarkersRef.current.forEach((m) => m.remove());
                regularMarkersRef.current = [];
                if (poblacionSummaryMarkerRef.current) {
                    poblacionSummaryMarkerRef.current.remove();
                    poblacionSummaryMarkerRef.current = null;
                }
                poblacionDetailMarkersRef.current.forEach((m) => m.remove());
                poblacionDetailMarkersRef.current = [];

                if (mdrrmoMarkerRef.current) {
                    mdrrmoMarkerRef.current.remove();
                    mdrrmoMarkerRef.current = null;
                }

                ro.disconnect();
                map.remove();
                mapRef.current = null;
            };
        } catch (err) {
            console.error('❌ MapLibre init failed:', err);
        }
    }, [drawArcsCanvas, startPulseAnimation, stopPulseAnimation, updateLabelsVisibility]);

    // ── 2. Update Pins & Dispatch Arcs when pinReports change ──
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isLoadedRef.current) return;

        // Update Pins
        const pinSource = map.getSource(PIN_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (pinSource) {
            pinSource.setData(buildPinGeoJSON(pinReports) as any);
        }

        // Recompute active barangay targets (exactly 1 line per active barangay)
        const activeTargets = getActiveBarangaysFromReports(pinReports, talisayBarangays);
        activeTargetsRef.current = activeTargets;

        const shadowsGeoJSON = buildGroundShadowsGeoJSON(activeTargets);
        const targetsGeoJSON = buildTargetRingsGeoJSON(activeTargets);

        // Update Ground Shadows Source
        const shadowsSource = map.getSource(DISPATCH_SHADOWS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (shadowsSource) {
            shadowsSource.setData(shadowsGeoJSON as any);
        }

        // Update Targets Source
        const targetsSource = map.getSource(DISPATCH_TARGETS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (targetsSource) {
            targetsSource.setData(targetsGeoJSON as any);
        }

        drawArcsCanvas(performance.now());
    }, [pinReports, drawArcsCanvas]);

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
        const blueTone = theme === 'light' ? '#0071E3' : '#38bdf8';
        if (map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
            map.setPaintProperty(HIGHLIGHT_FILL_LAYER_ID, 'fill-color', blueTone);
        }
        if (map.getLayer(HIGHLIGHT_GLOW_LAYER_ID)) {
            map.setPaintProperty(HIGHLIGHT_GLOW_LAYER_ID, 'line-color', blueTone);
        }
        if (map.getLayer(HIGHLIGHT_LAYER_ID)) {
            map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-color', blueTone);
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

        const isArcsVisible = layers.dispatchArcs !== false;

        const arcLayerIds = [
            DISPATCH_SHADOWS_LAYER_ID,
            DISPATCH_TARGETS_RING_LAYER_ID,
            DISPATCH_TARGETS_DOT_LAYER_ID,
        ];

        arcLayerIds.forEach((id) => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, 'visibility', isArcsVisible ? 'visible' : 'none');
            }
        });
        if (arcCanvasRef.current) {
            arcCanvasRef.current.style.display = isArcsVisible ? 'block' : 'none';
        }

        drawArcsCanvas(performance.now());
        updateLabelsVisibility();
    }, [layers, drawArcsCanvas, updateLabelsVisibility]);

    return (
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0 isolate" style={{ minHeight: '100%' }} />
    );
}
