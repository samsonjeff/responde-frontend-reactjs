// src/lib/dispatch-arcs.ts
// Precision coordinates, true 3D upward parabolic arcs, and light pulse generators
// connecting MDRRMO Talisay Command Center to barangays with active incidents
// ─────────────────────────────────────────────────────────────────────────────

import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import type { BarangayFeatureCollection } from '../types/geospatial';
import { normalizeBarangayName } from '../data/talisay-barangays';
import { formatReportUrgency } from '../services/incidentService';

/**
 * Exact Coordinates of MDRRMO Talisay (Municipal Disaster Risk Reduction & Management Office)
 * Located at the Talisay Municipal Hall Complex, W. Trinidad St, Talisay, Batangas
 * [Longitude, Latitude] for MapLibre / GeoJSON
 */
export const MDRRMO_TALISAY_COORDS: [number, number] = [121.02128, 14.09303];

export const MDRRMO_TALISAY_INFO = {
  name: 'MDRRMO Talisay',
  callsign: 'EOC CHARLIE-1',
  fullName: 'Municipal Disaster Risk Reduction and Management Office',
  complex: 'Talisay Municipal Hall Complex, W. Trinidad St.',
  municipality: 'Talisay, Batangas',
  coordinates: MDRRMO_TALISAY_COORDS,
  latitude: 14.09303,
  longitude: 121.02128,
};

export interface ActiveBarangayTarget {
  name: string;
  normalizedName: string;
  centroid: [number, number]; // [lng, lat]
  incidentCount: number;
  highestUrgency: 'Critical' | 'High' | 'Moderate' | 'Low';
  color: string;
  glowColor: string;
}

export interface ArcCameraState {
  pitch?: number;
  bearing?: number;
}

export interface ProjectedArcScreenData {
  target: ActiveBarangayTarget;
  points: { x: number; y: number }[];
}

/**
 * Groups active reports by barangay to ensure exactly ONE clean line
 * connects MDRRMO Talisay to each affected barangay (avoiding clutter).
 */
export function getActiveBarangaysFromReports(
  reports: Array<{ barangay?: string; urgency?: string; coordinates?: string }>,
  allBarangays: BarangayFeatureCollection
): ActiveBarangayTarget[] {
  const barangayMap = new Map<
    string,
    { count: number; highestUrgency: 'Critical' | 'High' | 'Moderate' | 'Low' }
  >();

  const URGENCY_PRIORITY: Record<string, number> = { Critical: 4, High: 3, Moderate: 2, Low: 1 };

  for (const report of reports) {
    if (!report.barangay) continue;
    const norm = normalizeBarangayName(report.barangay);
    if (!norm) continue;

    const current = barangayMap.get(norm) || { count: 0, highestUrgency: 'Low' };
    current.count += 1;

    const reportUrgency = (formatReportUrgency(report.urgency) || 'Low') as 'Critical' | 'High' | 'Moderate' | 'Low';
    if ((URGENCY_PRIORITY[reportUrgency] || 1) > (URGENCY_PRIORITY[current.highestUrgency] || 1)) {
      current.highestUrgency = reportUrgency;
    }

    barangayMap.set(norm, current);
  }

  const results: ActiveBarangayTarget[] = [];

  for (const [normName, data] of barangayMap.entries()) {
    const feat = allBarangays.features.find(
      (f) => normalizeBarangayName(f.properties.name) === normName
    );
    if (!feat || !feat.properties.centroid) continue;

    // Must be within Talisay mainland bounds
    if (feat.properties.centroid[1] < 14.075) continue;

    // Urgency Color Palette
    // High Urgency = Rose Red (#f43f5e)
    // Moderate Urgency = Amber (#f59e0b)
    // Low Urgency = Cyan (#06b6d4)
    // Urgency Color Palette:
    // Critical = Purple (#9333ea)
    // High = Rose Red (#f43f5e)
    // Moderate = Amber (#f59e0b)
    // Low = Green (#22c55e)
    const color =
      data.highestUrgency === 'Critical'
        ? '#9333ea'
        : data.highestUrgency === 'High'
        ? '#f43f5e'
        : data.highestUrgency === 'Moderate'
        ? '#f59e0b'
        : '#22c55e';

    const glowColor =
      data.highestUrgency === 'Critical'
        ? 'rgba(147, 51, 234, 0.55)'
        : data.highestUrgency === 'High'
        ? 'rgba(244, 63, 94, 0.55)'
        : data.highestUrgency === 'Moderate'
        ? 'rgba(245, 158, 11, 0.55)'
        : 'rgba(34, 197, 94, 0.55)';

    results.push({
      name: feat.properties.name,
      normalizedName: normName,
      centroid: feat.properties.centroid,
      incidentCount: data.count,
      highestUrgency: data.highestUrgency,
      color,
      glowColor,
    });
  }

  // Sort by urgency then name for stable layer ordering
  return results.sort((a, b) => {
    return (URGENCY_PRIORITY[b.highestUrgency] || 0) - (URGENCY_PRIORITY[a.highestUrgency] || 0);
  });
}

/**
 * Projects a 3D geographic point (lng, lat, altitudeMeters) to exact screen pixel coordinates
 * using MapLibre's internal 3D perspective camera transform matrix (_pixelMatrix).
 */
export function project3DToScreen(
  map: maplibregl.Map,
  lng: number,
  lat: number,
  altitudeMeters: number
): { x: number; y: number } {
  const tr = (map as any).transform;
  if (tr && typeof tr.coordinatePoint === 'function') {
    const merc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat]);
    const pt = tr.coordinatePoint(merc, altitudeMeters);
    if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
      return { x: pt.x, y: pt.y };
    }
  }

  // Fallback perspective projection
  const base = map.project([lng, lat]);
  if (altitudeMeters === 0) {
    return { x: base.x, y: base.y };
  }
  const pitchRad = (map.getPitch() * Math.PI) / 180;
  const worldSize = 512 * Math.pow(2, map.getZoom());
  const pixelPerMeter =
    maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 1).z * worldSize;
  return {
    x: base.x,
    y: base.y - altitudeMeters * pixelPerMeter * Math.sin(pitchRad),
  };
}

/**
 * Creates a smooth quadratic bezier ground curve between start and end.
 */
export function createCurvedArcCoordinates(
  start: [number, number],
  end: [number, number],
  steps = 48,
  curvatureFactor = 0.2,
  camera?: ArcCameraState
): [number, number][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dist = Math.hypot(dx, dy);

  if (dist === 0) return [start, end];

  const mx = (start[0] + end[0]) / 2;
  const my = (start[1] + end[1]) / 2;

  // Perpendicular unit vector for 2D lateral curve
  let nx = -dy / dist;
  let ny = dx / dist;

  if (ny < 0 || (Math.abs(ny) < 0.15 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }

  const pitch = camera?.pitch ?? 0;
  const pitchFactor = Math.sin((pitch * Math.PI) / 180);

  // Subtle lateral curve on the ground; in 3D view the primary arch is vertical in 3D altitude
  const perpDist = dist * curvatureFactor * (1 - pitchFactor * 0.65);

  const cx = mx + nx * perpDist;
  const cy = my + ny * perpDist;

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const px = inv * inv * start[0] + 2 * inv * t * cx + t * t * end[0];
    const py = inv * inv * start[1] + 2 * inv * t * cy + t * t * end[1];
    points.push([px, py]);
  }

  return points;
}

/**
 * Renders the true 3D upward parabolic arcs and flowing white-centered light pulses
 * on a high-DPI 2D canvas overlay synchronized with MapLibre's camera.
 * - In 2D mode (pitch = 0): renders the smooth lateral curved glowing line + circle pulses.
 * - In 3D mode (pitch > 0): projects each arc point with true 3D elevation (meters above ground)
 *   so the exact same smooth line & pulses rise vertically out of the map in a 3D parabolic arch,
 *   maintaining crisp constant screen-pixel thickness at every zoom level with zero lag.
 */
export function renderDispatchArcsOverlay(
  map: maplibregl.Map,
  overlayCanvas: HTMLCanvasElement,
  targets: ActiveBarangayTarget[],
  now: number,
  isVisible = true
): ProjectedArcScreenData[] {
  const mapCanvas = map.getCanvas();
  const width = mapCanvas.clientWidth;
  const height = mapCanvas.clientHeight;
  if (width === 0 || height === 0) return [];

  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(width * dpr);
  const targetH = Math.round(height * dpr);

  if (overlayCanvas.width !== targetW || overlayCanvas.height !== targetH) {
    overlayCanvas.width = targetW;
    overlayCanvas.height = targetH;
  }

  const ctx = overlayCanvas.getContext('2d');
  if (!ctx) return [];

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!isVisible || targets.length === 0) {
    ctx.restore();
    return [];
  }

  const pitch = map.getPitch();
  const zoom = map.getZoom();
  const pitchRad = (pitch * Math.PI) / 180;
  const pitchFactor = Math.sin(pitchRad); // 0 in 2D, ~0.91 at 65° 3D tilt

  // Adapt 3D peak height when zooming in closely (> 13.3) so the arch stays gracefully framed
  const zoomAdapt = Math.pow(2, Math.min(0, 13.3 - zoom));

  // Throbbing glow cycle (matches 2D glow breathing between 0.45 and 0.80)
  const pulsePhase = Math.sin(now / 380);
  const glowOpacity = 0.45 + 0.35 * pulsePhase;
  const globalProgress = (now % 2800) / 2800;

  const steps = 56;
  const projectedArcs: ProjectedArcScreenData[] = [];

  targets.forEach((target, idx) => {
    const start = MDRRMO_TALISAY_COORDS;
    const end = target.centroid;
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const mx = (start[0] + end[0]) / 2;
    const my = (start[1] + end[1]) / 2;

    let nx = -dy / dist;
    let ny = dx / dist;
    if (ny < 0 || (Math.abs(ny) < 0.15 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }

    const curvature = 0.18 + (idx % 3) * 0.05;
    const perpDist = dist * curvature * (1 - pitchFactor * 0.65);
    const cx = mx + nx * perpDist;
    const cy = my + ny * perpDist;

    // True 3D vertical arch peak altitude in meters (matches Image 1 parabolic 3D arch)
    const basePeakMeters = 820 + Math.min(dist * 2200000, 780);
    const peakAltitudeMeters = basePeakMeters * pitchFactor * zoomAdapt;

    const screenPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const inv = 1 - t;
      const lng = inv * inv * start[0] + 2 * inv * t * cx + t * t * end[0];
      const lat = inv * inv * start[1] + 2 * inv * t * cy + t * t * end[1];
      const elevationMeters = peakAltitudeMeters * Math.sin(t * Math.PI);
      screenPts.push(project3DToScreen(map, lng, lat, elevationMeters));
    }

    projectedArcs.push({ target, points: screenPts });

    // 1. Outer Throbbing Ambient Glow Line (matches DISPATCH_ARCS_GLOW_LAYER_ID)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) {
      ctx.lineTo(screenPts[i].x, screenPts[i].y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = target.color;
    ctx.shadowColor = target.color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 7.5;
    ctx.globalAlpha = glowOpacity * 0.78;
    ctx.stroke();
    ctx.restore();

    // 2. Inner Crisp Laser Core Line (matches DISPATCH_ARCS_CORE_LAYER_ID)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) {
      ctx.lineTo(screenPts[i].x, screenPts[i].y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = target.color;
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.96;
    ctx.stroke();
    ctx.restore();

    // 3. Flowing Light Photon Pulses along the 3D arc (matches DISPATCH_PULSES_GLOW & CORE)
    const speedMult = 1 + (idx % 2) * 0.15;
    const offsets = [0, 0.5];

    offsets.forEach((offset) => {
      const u = (globalProgress * speedMult + offset + idx * 0.12) % 1;
      const exact = u * (screenPts.length - 1);
      const baseIdx = Math.floor(exact);
      const nextIdx = Math.min(screenPts.length - 1, baseIdx + 1);
      const frac = exact - baseIdx;

      const p1 = screenPts[baseIdx];
      const p2 = screenPts[nextIdx];
      const px = p1.x + (p2.x - p1.x) * frac;
      const py = p1.y + (p2.y - p1.y) * frac;

      // Outer glowing circle halo (radius 11px)
      const grad = ctx.createRadialGradient(px, py, 1, px, py, 11);
      grad.addColorStop(0, target.color);
      grad.addColorStop(0.45, target.glowColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner crisp white core circle with urgency-colored border (radius 3.6px, stroke 2px)
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = target.color;
      ctx.stroke();
      ctx.restore();
    });
  });

  ctx.restore();
  return projectedArcs;
}

/**
 * Hit-tests screen coordinates against projected 3D arcs for hover tooltips.
 */
export function hitTestProjectedArcs(
  projectedArcs: ProjectedArcScreenData[],
  point: { x: number; y: number },
  thresholdPx = 8
): ActiveBarangayTarget | null {
  const maxDistSq = thresholdPx * thresholdPx;

  for (const arc of projectedArcs) {
    const pts = arc.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby;
      let t = 0;
      if (lenSq > 0) {
        t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lenSq));
      }
      const cx = a.x + t * abx;
      const cy = a.y + t * aby;
      const dx = point.x - cx;
      const dy = point.y - cy;
      if (dx * dx + dy * dy <= maxDistSq) {
        return arc.target;
      }
    }
  }
  return null;
}

/**
 * Builds flat ground-shadow lines directly between MDRRMO and each active barangay
 * to reinforce the 3D floating depth illusion when the map is tilted.
 */
export function buildGroundShadowsGeoJSON(
  targets: ActiveBarangayTarget[]
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: targets.map((target, idx) => {
      const curvature = (0.18 + (idx % 3) * 0.05) * 0.35;
      const shadowPoints = createCurvedArcCoordinates(
        MDRRMO_TALISAY_COORDS,
        target.centroid,
        24,
        curvature,
        { pitch: 0, bearing: 0 }
      );
      return {
        type: 'Feature',
        id: `shadow-${target.normalizedName}`,
        properties: {
          barangay: target.name,
          color: target.color,
        },
        geometry: {
          type: 'LineString',
          coordinates: shadowPoints,
        },
      };
    }),
  };
}

/**
 * Builds target destination rings at active barangay centroids.
 */
export function buildTargetRingsGeoJSON(
  targets: ActiveBarangayTarget[]
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: targets.map((target) => ({
      type: 'Feature',
      id: `target-${target.normalizedName}`,
      properties: {
        barangay: target.name,
        color: target.color,
        urgency: target.highestUrgency,
        incidentCount: target.incidentCount,
      },
      geometry: {
        type: 'Point',
        coordinates: target.centroid,
      },
    })),
  };
}
