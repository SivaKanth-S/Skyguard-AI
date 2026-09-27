// Route planner geo helpers — Nominatim geocoding + OSRM routing +
// SkyGuard anomaly-on-route analysis. All free, no API keys needed.
import { TN_STATIONS } from '../data/stations';

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDist(km) {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatDur(mins) {
  if (mins == null || Number.isNaN(mins)) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// ── Place search (OpenStreetMap data, free). Tamil Nadu ONLY — results are
// bounded to the state box and filtered by state name, so other states
// never appear. Triple fallback chain so suggestions ALWAYS show something:
// Nominatim → Photon → built-in AWS station names (works fully offline).
const TN_VIEWBOX = '76.05,13.55,80.35,8.07'; // left,top,right,bottom (lng/lat)
const TN_BBOX_PHOTON = '76.05,8.07,80.35,13.55'; // min_lng,min_lat,max_lng,max_lat

function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function searchNominatim(q, limit) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit * 2}` +
    `&countrycodes=in&viewbox=${TN_VIEWBOX}&bounded=1` +
    `&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`;
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const json = await res.json();
  return (Array.isArray(json) ? json : [])
    .filter((r) => {
      const state = (r.address?.state || '').toLowerCase();
      if (state) return state.includes('tamil nadu');
      return (r.display_name || '').toLowerCase().includes('tamil nadu');
    })
    .slice(0, limit)
    .map((r) => ({
      label: r.display_name,
      short: (r.display_name || '').split(',').slice(0, 2).join(',').trim() || q,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

async function searchPhoton(q, limit) {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&bbox=${TN_BBOX_PHOTON}&limit=${limit * 2}&lang=en`;
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
  const json = await res.json();
  const feats = Array.isArray(json?.features) ? json.features : [];
  const seen = new Set();
  return feats
    .filter((f) => {
      const p = f?.properties || {};
      const state = (p.state || '').toLowerCase();
      // Photon already constrains to the TN bbox; keep TN matches plus
      // Indian hits with no state field rather than dropping everything.
      if (state) return state.includes('tamil nadu');
      return (p.country || '').toLowerCase() === 'india';
    })
    .map((f) => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry?.coordinates || [];
      const place = p.name || p.city || p.town || p.village || '';
      const area = p.city || p.town || p.village || p.district || '';
      const parts = [place, area, p.state || 'Tamil Nadu', p.country || 'India']
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
      return {
        label: parts.join(', '),
        short: parts.slice(0, 2).join(', ') || q,
        lat: +lat,
        lng: +lng,
      };
    })
    .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .filter((r) => {
      const key = `${r.label}|${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

// Instant offline fallback — matches the built-in AWS station cities so the
// dropdown never comes up empty for major Tamil Nadu places.
function searchLocalStations(q, limit) {
  const needle = q.trim().toLowerCase();
  return TN_STATIONS.filter(
    (st) =>
      st.name.toLowerCase().includes(needle) ||
      (st.short || '').toLowerCase().includes(needle),
  )
    .slice(0, limit)
    .map((st) => ({
      label: `${st.name}, Tamil Nadu, India`,
      short: st.short || st.name.split('—')[0].trim(),
      lat: st.lat,
      lng: st.lng,
    }));
}

export async function searchPlaces(query, limit = 5) {
  const q = (query || '').trim();
  if (q.length < 3) return [];
  try {
    const primary = await searchNominatim(q, limit);
    if (primary.length) return primary;
  } catch { /* blocked / rate-limited — try Photon */ }
  try {
    const fallback = await searchPhoton(q, limit);
    if (fallback.length) return fallback;
  } catch { /* offline — use built-in stations */ }
  return searchLocalStations(q, limit);
}

export async function reverseGeocode(lat, lng) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&zoom=12&addressdetails=1&accept-language=en`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.display_name || null;
  } catch {
    return null;
  }
}

// ── OSRM driving route (public demo server, free). Falls back to straight
// line when the road graph has no path (e.g. ocean points) or is unreachable.
export async function fetchRoute(start, end) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson&steps=true&annotations=false`;
  let osrm = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json?.code === 'Ok' && json.routes?.[0]) osrm = json.routes[0];
    }
  } catch {
    osrm = null;
  }

  if (osrm) {
    const coords = (osrm.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    const steps = (osrm.legs?.[0]?.steps || []).map((s) => ({
      name: s.name || '',
      instruction: stepInstruction(s),
      distanceKm: (s.distance || 0) / 1000,
      durationMin: (s.duration || 0) / 60,
    }));
    return {
      coords,
      distanceKm: (osrm.distance || 0) / 1000,
      durationMin: (osrm.duration || 0) / 60,
      steps,
      viaRoad: true,
    };
  }

  // Fallback: straight line (great-circle interpolation).
  const km = haversineKm(start.lat, start.lng, end.lat, end.lng);
  const N = Math.max(2, Math.min(100, Math.ceil(km / 2)));
  const coords = [];
  for (let i = 0; i <= N; i++) {
    coords.push([
      start.lat + ((end.lat - start.lat) * i) / N,
      start.lng + ((end.lng - start.lng) * i) / N,
    ]);
  }
  return {
    coords,
    distanceKm: km,
    // ~40 km/h blended average for the straight-line fallback.
    durationMin: (km / 40) * 60,
    steps: [],
    viaRoad: false,
  };
}

function stepInstruction(s) {
  const m = s?.maneuver || {};
  const type = m.type || '';
  const mod = m.modifier ? ` ${m.modifier}` : '';
  const road = s?.name ? ` onto ${s.name}` : '';
  if (type === 'depart') return `Head out${road}`;
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'new name') return `Continue${road}`;
  return `${cap(type)}${mod}${road}`.trim() || 'Continue';
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Walk the polyline, emitting a sample point every stepKm (+ endpoints).
export function sampleAlongRoute(coords, stepKm = 2) {
  if (!coords || coords.length < 2) return (coords || []).map(([lat, lng]) => ({ lat, lng, km: 0 }));
  const out = [{ lat: coords[0][0], lng: coords[0][1], km: 0 }];
  let acc = 0;
  let nextAt = stepKm;
  for (let i = 1; i < coords.length; i++) {
    const [aLat, aLng] = coords[i - 1];
    const [bLat, bLng] = coords[i];
    const seg = haversineKm(aLat, aLng, bLat, bLng);
    while (acc + seg >= nextAt) {
      const t = (nextAt - acc) / seg;
      out.push({ lat: aLat + (bLat - aLat) * t, lng: aLng + (bLng - aLng) * t, km: nextAt });
      nextAt += stepKm;
    }
    acc += seg;
  }
  const last = coords[coords.length - 1];
  out.push({ lat: last[0], lng: last[1], km: acc });
  return out;
}

// For every sample point, find fault stations covering it. Returns deduped
// per-station warnings ordered by first appearance along the route.
export function analyzeRouteAnomalies(sampled, stationStatus = {}) {
  const warnings = [];
  const seen = new Set();
  const advisories = [];
  const seenAdv = new Set();

  sampled.forEach((pt) => {
    TN_STATIONS.forEach((st) => {
      const status = stationStatus[st.id]?.status || 'HEALTHY';
      const faultType = stationStatus[st.id]?.faultType || null;
      const d = haversineKm(pt.lat, pt.lng, st.lat, st.lng);
      if (status !== 'HEALTHY' && d <= st.coverage_km && !seen.has(st.id)) {
        seen.add(st.id);
        warnings.push({
          stationId: st.id,
          station: st.name,
          short: st.short,
          status,
          faultType,
          distanceToRouteKm: +d.toFixed(1),
          atKm: +pt.km.toFixed(1),
          severity: status === 'CRITICAL' ? 'critical' : status === 'FAULT' ? 'high' : 'medium',
        });
      } else if (status !== 'HEALTHY' && d < 45 && !seen.has(st.id) && !seenAdv.has(st.id)) {
        seenAdv.add(st.id);
        advisories.push({
          stationId: st.id,
          station: st.name,
          short: st.short,
          status,
          faultType,
          distanceToRouteKm: +d.toFixed(1),
          atKm: +pt.km.toFixed(1),
          severity: 'advisory',
        });
      }
    });
  });

  // Route km exposed to any fault coverage (for the risk meter).
  let exposedKm = 0;
  if (sampled.length > 1) {
    for (let i = 1; i < sampled.length; i++) {
      const segKm = sampled[i].km - sampled[i - 1].km;
      const mid = {
        lat: (sampled[i].lat + sampled[i - 1].lat) / 2,
        lng: (sampled[i].lng + sampled[i - 1].lng) / 2,
      };
      const inside = TN_STATIONS.some((st) => {
        const status = stationStatus[st.id]?.status || 'HEALTHY';
        return status !== 'HEALTHY' && haversineKm(mid.lat, mid.lng, st.lat, st.lng) <= st.coverage_km;
      });
      if (inside) exposedKm += segKm;
    }
  }

  const risk =
    warnings.some((w) => w.status === 'CRITICAL')
      ? 'HIGH'
      : warnings.length > 0
        ? 'MODERATE'
        : advisories.length > 0
          ? 'LOW'
          : 'CLEAR';

  return { warnings, advisories, exposedKm, risk };
}

// Closest point on the polyline to a GPS fix — returns the projected
// position, km along the route, and distance off the route.
export function closestPointOnRoute(coords, lat, lng) {
  if (!coords || coords.length < 2) return null;
  const meanLat = ((coords[0][0] + coords[coords.length - 1][0]) / 2 * Math.PI) / 180;
  const kx = Math.cos(meanLat);
  const px = lng * kx;
  const py = lat;
  let best = null;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const [aLat, aLng] = coords[i - 1];
    const [bLat, bLng] = coords[i];
    const seg = haversineKm(aLat, aLng, bLat, bLng);
    const ax = aLng * kx;
    const ay = aLat;
    const bx = bLng * kx;
    const by = bLat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qLat = aLat + (bLat - aLat) * t;
    const qLng = aLng + (bLng - aLng) * t;
    const d = haversineKm(lat, lng, qLat, qLng);
    if (!best || d < best.distKm) {
      best = { lat: qLat, lng: qLng, km: acc + seg * t, distKm: d };
    }
    acc += seg;
  }
  return best;
}

// Position along the polyline at a given travelled km.
export function positionAtKm(coords, km) {
  if (!coords?.length) return null;
  if (km <= 0) return { lat: coords[0][0], lng: coords[0][1] };
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = haversineKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    if (acc + seg >= km) {
      const t = seg === 0 ? 0 : (km - acc) / seg;
      return {
        lat: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
        lng: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
      };
    }
    acc += seg;
  }
  const last = coords[coords.length - 1];
  return { lat: last[0], lng: last[1] };
}
