import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { useNotify } from '../context/NotifyContext';
import { TN_STATIONS } from '../data/stations';
import {
  TN_BOUNDS,
  TN_CENTER,
  TN_MIN_ZOOM,
  faultMeta,
  haloDivIcon,
  isAnomalyStatus,
  metaFor,
} from './anomalyEffects';
import {
  analyzeRouteAnomalies,
  closestPointOnRoute,
  fetchRoute,
  formatDist,
  formatDur,
  haversineKm,
  sampleAlongRoute,
  searchPlaces,
} from '../lib/geo';
import {
  ensureNotifyPermission,
  notifyPermission,
  permissionHint,
  sendNotify,
} from '../lib/notify';

function getCartoKey() {
  const fromEnv = (import.meta.env.VITE_CARTO_KEY || '').trim();
  return fromEnv || 'cb1_3w8k_1_40c9422bcdd3d78b75d6104a';
}

// Google-Maps-style layer list — includes an explicit Road map
// (Esri World Street Map) alongside Cyber / Streets / Satellite / OSM.
function buildLayerDefs() {
  const key = getCartoKey();
  const cartoAttr =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  return {
    dark: {
      url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${key}`,
      maxZoom: 20, subdomains: 'abcd', attribution: cartoAttr, name: 'Cyber',
    },
    streets: {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${key}`,
      maxZoom: 20, subdomains: 'abcd', attribution: cartoAttr, name: 'Streets',
    },
    road: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, subdomains: undefined,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
      name: 'Road',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, subdomains: undefined,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      name: 'Satellite',
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19, subdomains: 'abc',
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      name: 'OSM',
    },
  };
}

const LAYER_ICON = { dark: '🌙', streets: '☀️', road: '🛣️', satellite: '🛰️', osm: '🗺️' };
const LAYER_ORDER = ['dark', 'streets', 'road', 'satellite', 'osm'];

const RISK_COL = { CLEAR: '#2ecc71', LOW: '#f39c12', MODERATE: '#e67e22', HIGH: '#e74c3c' };

function pointIcon(kind) {
  const bg = kind === 'start' ? '#2ecc71' : '#e74c3c';
  const letter = kind === 'start' ? 'A' : 'B';
  return L.divIcon({
    className: 'route-pt-wrap',
    html: `<div class="route-pt" style="background:${bg}">${letter}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function travelerIcon() {
  return L.divIcon({
    className: 'route-trav-wrap',
    html: '<div class="route-trav"><div class="route-trav-dot"></div></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Turn-by-turn guidance helpers (Google-Maps-style navigation banner).
function stepBounds(steps) {
  let acc = 0;
  return (steps || []).map((s) => { acc += s.distanceKm || 0; return acc; });
}
function navInfo(routeObj, progressKm) {
  const steps = routeObj?.steps || [];
  if (!steps.length) return null;
  const bounds = stepBounds(steps);
  let idx = bounds.findIndex((b) => b > progressKm);
  if (idx === -1) idx = steps.length - 1;
  return {
    idx,
    step: steps[idx],
    remainingInStepKm: Math.max(0, bounds[idx] - progressKm),
    total: steps.length,
  };
}
function maneuverIcon(instruction = '') {
  const t = (instruction || '').toLowerCase();
  if (t.includes('arrive')) return '🏁';
  if (t.includes('u-turn') || t.includes('uturn')) return '↩️';
  if (t.includes('left')) return '⬅️';
  if (t.includes('right')) return '➡️';
  if (t.includes('roundabout') || t.includes('rotary') || t.includes('circle')) return '🔄';
  if (t.includes('merge') || t.includes('slight')) return '↗️';
  if (t.includes('continue') || t.includes('head') || t.includes('straight')) return '⬆️';
  return '🧭';
}

export default function RoutePlannerMap() {
  const { isLight } = useTheme();
  const { notify: siteNotify } = useNotify();
  const mapRef = useRef(null);
  const map = useRef(null);
  const tileLayer = useRef(null);
  const routeLayers = useRef([]);
  const startMarker = useRef(null);
  const endMarker = useRef(null);
  const userMarker = useRef(null);
  const accCircle = useRef(null);
  const stationLayers = useRef([]);
  const alertedRef = useRef(new Set());
  const tileInit = useRef(false);
  const watchId = useRef(null);
  const firstFix = useRef(true);

  // The one location option: search a place for start + destination.
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [suggFor, setSuggFor] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  // Setup-first flow: the map stays closed until the user submits a
  // start + destination (Get Route). Keeps focus on the two inputs first.
  const [mapOpened, setMapOpened] = useState(false);
  const pendingRouteRef = useRef(null);

  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [analysis, setAnalysis] = useState({ warnings: [], advisories: [], exposedKm: 0, risk: 'CLEAR' });

  // Live fault engine — same 9s rhythm as Live Location so anomalies
  // seen here match the rest of the app. Starts empty; the engine raises
  // live fault zones on its own (no hardcoded demo faults).
  const faultsRef = useRef({});
  const [faults, setFaults] = useState(faultsRef.current);

  // Live GPS tracking (real device position — no simulation).
  const [tracking, setTracking] = useState(false);
  const [gps, setGps] = useState(null); // { lat, lng, acc, speedKmh }
  const [gpsError, setGpsError] = useState('');
  const [alerts, setAlerts] = useState([]); // notified alert history
  const [progressKm, setProgressKm] = useState(0); // closest route km to GPS
  const [arrived, setArrived] = useState(false);
  const [offRoute, setOffRoute] = useState(false);
  const followRef = useRef(true);
  const [activeTileKey, setActiveTileKey] = useState(isLight ? 'streets' : 'dark');
  const [layerOpen, setLayerOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  useEffect(() => { followRef.current = follow; }, [follow]);
  const [stepsOpen, setStepsOpen] = useState(false);
  // System notifications for every alert/fault (replaces voice alerts).
  const [notifyOn, setNotifyOn] = useState(true);
  const [notifyPerm, setNotifyPerm] = useState(() => notifyPermission());
  const notifyHint = notifyOn ? permissionHint(notifyPerm) : '🔕 Notifications off — turn on to get alerts on your device.';
  const notifyRef = useRef(notifyOn);
  useEffect(() => { notifyRef.current = notifyOn; }, [notifyOn]);

  const totalKm = route?.distanceKm || 0;

  // ── map init — runs only after start+end are submitted (map opens) ──
  useEffect(() => {
    if (!mapOpened) return;
    if (!mapRef.current || map.current) return;
    const m = L.map(mapRef.current, {
      center: TN_CENTER, zoom: 7, zoomControl: false,
      minZoom: TN_MIN_ZOOM, maxBounds: TN_BOUNDS, maxBoundsViscosity: 1.0,
    });
    map.current = m;
    attachTiles(m, isLight ? 'streets' : 'dark');
    setTimeout(() => { try { m.invalidateSize(); } catch {} }, 250);
    m.on('zoomend', () => {
      if (m.getZoom() < TN_MIN_ZOOM) { try { m.setZoom(TN_MIN_ZOOM); } catch {} }
    });
    // A route planned in the same tick as opening still needs drawing.
    if (pendingRouteRef.current) {
      const { r, s, e } = pendingRouteRef.current;
      pendingRouteRef.current = null;
      drawRoute(r, s, e);
      try {
        m.fitBounds(L.latLngBounds(r.coords.map(([la, ln]) => [la, ln])).pad(0.15));
      } catch {}
    }
    return () => {
      try { m.remove(); } catch {}
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpened]);

  function attachTiles(m, key) {
    const defs = buildLayerDefs();
    const def = defs[key] || defs.dark;
    if (tileLayer.current) { try { m.removeLayer(tileLayer.current); } catch {} tileLayer.current = null; }
    const opts = { maxZoom: def.maxZoom, attribution: def.attribution };
    if (def.subdomains) opts.subdomains = def.subdomains;
    const layer = L.tileLayer(def.url, opts);
    layer.on('tileerror', () => {
      try {
        if (tileLayer.current === layer && key !== 'osm') {
          m.removeLayer(layer);
          const fb = defs.osm;
          tileLayer.current = L.tileLayer(fb.url, {
            maxZoom: fb.maxZoom, subdomains: fb.subdomains, attribution: fb.attribution,
          }).addTo(m);
        }
      } catch {}
    });
    tileLayer.current = layer.addTo(m);
  }

  useEffect(() => { setActiveTileKey(isLight ? 'streets' : 'dark'); }, [isLight]);
  useEffect(() => {
    if (!map.current) return;
    if (!tileInit.current) { tileInit.current = true; return; }
    attachTiles(map.current, activeTileKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTileKey]);

  // ── live faults ──
  useEffect(() => {
    const id = setInterval(() => {
      const prev = { ...faultsRef.current };
      // age out randomly to keep 1–2 active zones
      const ids = Object.keys(prev);
      if (ids.length >= 2 && Math.random() < 0.5) delete prev[ids[(Math.random() * ids.length) | 0]];
      if (Object.keys(prev).length < 2 && Math.random() < 0.7) {
        const cands = TN_STATIONS.filter((s) => !(s.id in prev));
        if (cands.length) {
          const st = cands[(Math.random() * cands.length) | 0];
          const roll = Math.random();
          const status = roll < 0.35 ? 'CRITICAL' : roll < 0.7 ? 'FAULT' : 'DEGRADED';
          const pool = status === 'CRITICAL' ? ['spike', 'oor', 'missing'] : status === 'FAULT' ? ['freeze', 'multi', 'noise'] : ['drift', 'noise'];
          prev[st.id] = { status, faultType: pool[(Math.random() * pool.length) | 0] };
        }
      }
      faultsRef.current = prev;
      setFaults({ ...prev });
    }, 9000);
    return () => clearInterval(id);
  }, []);

  // Place search (single location option) — type to find start/destination.
  const onType = (field, text) => {
    if (field === 'start') setStartText(text); else setEndText(text);
    if (field === 'start' && start) setStart(null);
    if (field === 'end' && end) setEnd(null);
    const mySeq = ++searchSeq.current;
    if (text.trim().length < 3) { setSuggestions([]); setSuggFor(null); setSearching(false); return; }
    setSearching(true); setSuggFor(field);
    searchPlaces(text, 5)
      .then((list) => { if (searchSeq.current === mySeq) setSuggestions(list); })
      .catch(() => { if (searchSeq.current === mySeq) setSuggestions([]); })
      .finally(() => { if (searchSeq.current === mySeq) setSearching(false); });
  };

  const pickSuggestion = (field, s) => {
    const pt = { lat: s.lat, lng: s.lng, label: s.label };
    if (field === 'start') { setStart(pt); setStartText(s.short); }
    else { setEnd(pt); setEndText(s.short); }
    setSuggFor(null); setSuggestions([]);
  };

  const swapPoints = () => {
    if (route) return; // route is locked once generated — delete it to re-plan
    setStart(end); setEnd(start);
    setStartText(endText); setEndText(startText);
  };

  // ── route ──
  const planRoute = async (s = start, e = end) => {
    setRouteError('');
    if (!s || !e) { setRouteError('Search and choose a start and a destination above first.'); return; }
    if (s.lat === e.lat && s.lng === e.lng) { setRouteError('Start and destination are the same place — pick two different places.'); return; }
    setRouting(true);
    try {
      const r = await fetchRoute(s, e);
      stopTracking(true);
      setAlerts([]);
      setProgressKm(0);
      setArrived(false);
      setOffRoute(false);
      setRoute(r);
      alertedRef.current = new Set();
      if (map.current) {
        drawRoute(r, s, e);
        try {
          const bounds = L.latLngBounds(r.coords.map(([la, ln]) => [la, ln]));
          map.current.fitBounds(bounds.pad(0.15));
        } catch {}
      } else {
        // Map opens right after — init effect draws this pending route.
        pendingRouteRef.current = { r, s, e };
      }
      setMapOpened(true);
      // Instant anomaly-forecast notification for the generated route.
      if (notifyRef.current) {
        const a = analyzeRouteAnomalies(sampleAlongRoute(r.coords, 2), faultsRef.current);
        if (a.warnings.length) {
          sendNotify(
            'SkyGuard AI — Route anomaly forecast',
            `${a.warnings.length} fault zone${a.warnings.length === 1 ? '' : 's'} on this route: ${a.warnings.map((w) => w.short).join(', ')}. Risk ${a.risk}.`,
            'skyguard-forecast',
          );
        } else {
          sendNotify(
            'SkyGuard AI — Route ready',
            `${formatDist(r.distanceKm)} · ${formatDur(r.durationMin)} · no fault zones on route.`,
            'skyguard-forecast',
          );
        }
      }
      if (!r.viaRoad) setRouteError('No drivable road found between these points — showing a straight-line preview. Search nearby places for turn-by-turn roads.');
    } catch {
      setRouteError('Routing failed — check your connection and try again.');
    } finally {
      setRouting(false);
    }
  };

  // Delete the locked route (user-confirmed) — closes the map, back to setup.
  const deleteRoute = () => {
    if (!window.confirm('Delete this route and close the map? Tracking will stop.')) return;
    removeRoute();
  };

  // Silent core: drop route + tracking + map, back to the setup form.
  function removeRoute() {
    stopTracking(true);
    setRoute(null);
    setAlerts([]);
    setProgressKm(0);
    setArrived(false);
    setOffRoute(false);
    alertedRef.current = new Set();
    setMapOpened(false);
  }

  // Delete a single location (✕ in the A/B field). Works even when the
  // route is locked — clearing a field invalidates the route, so the user
  // confirms its removal first.
  const clearField = (field) => {
    if (route) {
      if (!window.confirm('Clearing this location will delete the current route and stop tracking. Continue?')) return;
      removeRoute();
    }
    if (field === 'start') { setStart(null); setStartText(''); }
    else { setEnd(null); setEndText(''); }
    setSuggFor(null);
    setSuggestions([]);
  };

  function drawRoute(r, s, e) {
    const m = map.current;
    if (!m) return;
    routeLayers.current.forEach((l) => { try { m.removeLayer(l); } catch {} });
    routeLayers.current = [];
    if (startMarker.current) { try { m.removeLayer(startMarker.current); } catch {} startMarker.current = null; }
    if (endMarker.current) { try { m.removeLayer(endMarker.current); } catch {} endMarker.current = null; }
    startMarker.current = L.marker([s.lat, s.lng], { icon: pointIcon('start') })
      .addTo(m).bindTooltip(`<strong>A · Start</strong><br/>${s.label}`, { direction: 'top' });
    endMarker.current = L.marker([e.lat, e.lng], { icon: pointIcon('end') })
      .addTo(m).bindTooltip(`<strong>B · End</strong><br/>${e.label}`, { direction: 'top' });
    const casing = L.polyline(r.coords, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(m);
    const main = L.polyline(r.coords, { color: '#1a73e8', weight: 5, opacity: 1 }).addTo(m);
    routeLayers.current = [casing, main];
  }

  // analysis whenever route or faults change
  useEffect(() => {
    if (!route) { setAnalysis({ warnings: [], advisories: [], exposedKm: 0, risk: 'CLEAR' }); return; }
    const sampled = sampleAlongRoute(route.coords, 2);
    setAnalysis(analyzeRouteAnomalies(sampled, faults));
  }, [route, faults]);

  // ── stations on map ──
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    stationLayers.current.forEach((l) => { try { m.removeLayer(l); } catch {} });
    stationLayers.current = [];
    const warnIds = new Set(analysis.warnings.map((w) => w.stationId));
    TN_STATIONS.forEach((st) => {
      const f = faults[st.id];
      const status = f?.status || 'HEALTHY';
      const anomalous = isAnomalyStatus(status);
      const onRoute = warnIds.has(st.id);
      const col = anomalous ? metaFor(status).color : '#2ecc71';
      if (anomalous || onRoute) {
        stationLayers.current.push(L.circle([st.lat, st.lng], {
          radius: st.coverage_km * 1000, color: col, fillColor: col,
          fillOpacity: 0.08, weight: 1, opacity: 0.5, dashArray: '4 4',
        }).addTo(m));
      }
      if (anomalous) {
        stationLayers.current.push(L.marker([st.lat, st.lng], {
          icon: haloDivIcon(status), interactive: false, keyboard: false,
        }).addTo(m));
      }
      const dot = L.circleMarker([st.lat, st.lng], {
        radius: onRoute ? 10 : 6, color: col, fillColor: col, fillOpacity: 0.9, weight: 2,
      }).addTo(m);
      const fm = f?.faultType ? faultMeta(f.faultType, status) : null;
      dot.bindTooltip(
        `<strong>${st.name}</strong><br/>${status}${fm ? ` · ${fm.label}` : ''}${onRoute ? '<br/>⚠️ ON YOUR ROUTE' : ''}`,
        { direction: 'top' },
      );
      stationLayers.current.push(dot);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faults, analysis.warnings, mapOpened]);

  // ── live GPS tracking (real device position — no simulation) ──
  // Every alert goes to the website-wide floating overlay (+ system
  // notification) — nothing pops up trapped inside the map.
  const KIND_SEV = { info: 'info', success: 'success', advisory: 'warning', medium: 'warning', high: 'warning', critical: 'critical' };
  function pushAlert(kind, title, detail, atKm) {
    if (notifyRef.current) {
      siteNotify({
        severity: KIND_SEV[kind] || 'info',
        title: `SkyGuard AI — ${title}`,
        detail: atKm != null ? `${detail} (route km ${(+atKm).toFixed(1)})` : detail,
        tag: `skyguard-${kind}`,
      });
    }
    setAlerts((log) => [{
      id: Date.now() + Math.random(), kind, title, detail,
      atKm: atKm != null ? +(+atKm).toFixed(1) : null,
      time: new Date().toLocaleTimeString(),
    }, ...log].slice(0, 30));
  }

  function stopTracking(removeMarker = false) {
    if (watchId.current != null) {
      try { navigator.geolocation.clearWatch(watchId.current); } catch { /* noop */ }
      watchId.current = null;
    }
    if (removeMarker && map.current) {
      if (userMarker.current) { try { map.current.removeLayer(userMarker.current); } catch {} userMarker.current = null; }
      if (accCircle.current) { try { map.current.removeLayer(accCircle.current); } catch {} accCircle.current = null; }
    }
    setTracking(false);
    setGps(null);
  }

  // Stop the GPS watch when leaving the page/tab.
  useEffect(() => () => {
    if (watchId.current != null) {
      try { navigator.geolocation.clearWatch(watchId.current); } catch { /* noop */ }
      watchId.current = null;
    }
  }, []);

  const startTracking = async () => {
    if (!route || tracking) return;
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported on this device — tracking needs GPS.');
      return;
    }
    // Ask for notification permission on Start (user gesture) so every
    // alert/fault pops up on the screen.
    if (notifyRef.current) {
      try { setNotifyPerm(await ensureNotifyPermission()); } catch { /* keep current */ }
    }
    alertedRef.current = new Set();
    firstFix.current = true;
    setFollow(true);
    setArrived(false);
    setOffRoute(false);
    setProgressKm(0);
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError('');
          const { latitude, longitude, accuracy, speed } = pos.coords;
          setGps({
            lat: +latitude.toFixed(5),
            lng: +longitude.toFixed(5),
            acc: Math.round(accuracy || 20),
            speedKmh: speed != null && speed >= 0 ? +(speed * 3.6).toFixed(1) : null,
          });
        },
        (err) => {
          if (err?.code === 1) setGpsError('Location permission denied — allow location access, then press Start Tracking again.');
          else setGpsError('Waiting for GPS fix… stay outdoors with a clear sky view.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
      setTracking(true);
      pushAlert(
        'info',
        'Tracking started',
        analysis.warnings.length
          ? `Live GPS on. Caution: ${analysis.warnings.length} fault zone${analysis.warnings.length === 1 ? '' : 's'} on this route.`
          : 'Live GPS on. Route is clear of known fault zones.',
        null,
      );
    } catch {
      setGpsError('Could not start GPS tracking on this device.');
    }
  };

  function fireAnomalyAlert(st, distKm, atKm) {
    const fm = faultMeta(st.faultType, st.status);
    // No in-map popups — real on-screen notification + history entry only.
    pushAlert(
      st.severity,
      `${st.station} — ${fm.label}`,
      `You are inside its ${TN_STATIONS.find((x) => x.id === st.stationId)?.coverage_km} km fault radius. Drive carefully — sensor data here is unreliable.`,
      atKm,
    );
  }

  // Every GPS fix: move the live marker, follow, and evaluate the route.
  useEffect(() => {
    if (!tracking || !route || !gps || !map.current) return;
    const m = map.current;
    // Live position marker + accuracy circle.
    if (!userMarker.current) {
      userMarker.current = L.marker([gps.lat, gps.lng], { icon: travelerIcon(), zIndexOffset: 500 })
        .addTo(m).bindTooltip('📍 You (live GPS)', { direction: 'top' });
      accCircle.current = L.circle([gps.lat, gps.lng], {
        radius: gps.acc, color: '#1a73e8', fillColor: '#1a73e8', fillOpacity: 0.12, weight: 1,
      }).addTo(m);
    } else {
      userMarker.current.setLatLng([gps.lat, gps.lng]);
      if (accCircle.current) {
        accCircle.current.setLatLng([gps.lat, gps.lng]);
        accCircle.current.setRadius(gps.acc);
      }
    }
    if (firstFix.current) {
      firstFix.current = false;
      try { m.setView([gps.lat, gps.lng], Math.max(m.getZoom(), 12)); } catch { /* keep view */ }
    } else if (followRef.current) {
      try { m.panTo([gps.lat, gps.lng], { animate: false }); } catch { /* keep view */ }
    }
    // Ignore wildly inaccurate fixes for route evaluation.
    if (gps.acc > 200) return;
    const c = closestPointOnRoute(route.coords, gps.lat, gps.lng);
    if (!c) return;
    setProgressKm(c.km);
    // Off-route / back-on-route (route itself never changes).
    if (c.distKm > 1) {
      if (!offRoute) {
        setOffRoute(true);
        pushAlert('high', 'Off route', `You are ${c.distKm.toFixed(1)} km away from the blue route. Return to it to resume guidance — the route itself is unchanged.`, c.km);
      }
    } else if (offRoute) {
      setOffRoute(false);
      pushAlert('info', 'Back on route', 'Guidance resumed along the planned route.', c.km);
    }
    // Fault zones along the route (real on-screen notification each).
    [...analysis.warnings, ...analysis.advisories].forEach((w) => {
      if (alertedRef.current.has(w.stationId)) return;
      const st = TN_STATIONS.find((x) => x.id === w.stationId);
      if (!st) return;
      const d = haversineKm(gps.lat, gps.lng, st.lat, st.lng);
      if (d <= st.coverage_km) {
        alertedRef.current.add(w.stationId);
        fireAnomalyAlert(w, d, c.km);
      } else if (d <= 5 && w.severity !== 'advisory' && !alertedRef.current.has(`near-${w.stationId}`)) {
        alertedRef.current.add(`near-${w.stationId}`);
        const fm = faultMeta(w.faultType, w.status);
        pushAlert('advisory', `Approaching ${w.short} fault zone`, `${fm.label} ${d.toFixed(1)} km ahead — stay alert.`, c.km);
      }
    });
    // Arrival at destination.
    if (!arrived && end) {
      const dEnd = haversineKm(gps.lat, gps.lng, end.lat, end.lng);
      if (dEnd <= 0.5) {
        setArrived(true);
        pushAlert('info', 'Arrived', 'You reached your destination. Tracking continues until you stop it.', c.km);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps]);

  const resetView = () => {
    const m = map.current;
    if (!m) return;
    try {
      if (route) m.fitBounds(L.latLngBounds(route.coords.map(([la, ln]) => [la, ln])).pad(0.15));
      else m.setView(TN_CENTER, 7);
    } catch {}
  };

  // Navigation banner data from the live GPS position on the route.
  const nav = route ? navInfo(route, progressKm) : null;
  const remainKm = Math.max(0, totalKm - progressKm);
  const liveSpeed = gps?.speedKmh != null && gps.speedKmh > 5 ? gps.speedKmh : 40;
  const etaMin = liveSpeed > 0 ? (remainKm / liveSpeed) * 60 : 0;
  let etaStr = '';
  try {
    etaStr = new Date(Date.now() + etaMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { etaStr = ''; }
  const pct = totalKm ? Math.min(100, (progressKm / totalKm) * 100) : 0;

  return (
    <div>
      <div className={`route-layout${mapOpened ? '' : ' setup'}`}>
        {/* ── Directions panel (Google-Maps style) ── */}
        <div className="route-panel">
          {!mapOpened && (
            <div className="route-setup-head">
              <h3>🗺️ Where to?</h3>
              <p>Search your start and destination below — the map and your route appear after.</p>
            </div>
          )}
          <div className="route-pts">
            <div className="route-field">
              <span className="route-dot" style={{ background: '#2ecc71' }}>A</span>
              <input
                value={startText}
                placeholder="Search starting place in Tamil Nadu…"
                disabled={!!route}
                onChange={(e) => onType('start', e.target.value)}
                onFocus={() => { if (startText.trim().length >= 3) setSuggFor('start'); }}
              />
              {(start || startText) && (
                <button className="route-clear" title="Delete start location" onClick={() => clearField('start')}>✕</button>
              )}
            </div>
            <button className="route-swap" title="Swap start / end" onClick={swapPoints} disabled={!!route}>⇅</button>
            <div className="route-field">
              <span className="route-dot" style={{ background: '#e74c3c' }}>B</span>
              <input
                value={endText}
                placeholder="Search destination place in Tamil Nadu…"
                disabled={!!route}
                onChange={(e) => onType('end', e.target.value)}
                onFocus={() => { if (endText.trim().length >= 3) setSuggFor('end'); }}
              />
              {(end || endText) && (
                <button className="route-clear" title="Delete destination" onClick={() => clearField('end')}>✕</button>
              )}
            </div>
            {(suggFor && (searching || suggestions.length > 0)) && (
              <div className="route-sugg">
                {searching && <div className="route-sugg-load">Searching places…</div>}
                {!searching && suggestions.map((s, i) => (
                  <button key={i} onClick={() => pickSuggestion(suggFor, s)} title={s.label}>
                    📍 {s.short}
                  </button>
                ))}
                {!searching && suggestions.length === 0 && (
                  <div className="route-sugg-load">No matches in Tamil Nadu — try another place name inside the state.</div>
                )}
              </div>
            )}
          </div>

          <div className="route-actions">
            <button className="loc-btn primary" disabled={routing || !start || !end || !!route} onClick={() => planRoute()}>
              {routing ? '⏳ Finding roads…' : mapOpened ? '🗺️ Get Route' : '🗺️ Open Map & Get Route'}
            </button>
            {route && (
              <button className="loc-btn danger" onClick={deleteRoute}>🗑 Delete route</button>
            )}
          </div>
          {route && (
            <p className="route-note">🔒 Route is locked — it will not change. Delete a location (✕) or the whole route to plan a new one.</p>
          )}
          {!mapOpened && (
            <p className="route-note">👆 The map opens after you enter a start and destination above.</p>
          )}

          {routeError && <div className="route-error">⚠️ {routeError}</div>}

          {route && (
            <>
              <div className="route-summary">
                <div>
                  <strong>{formatDist(route.distanceKm)}</strong>
                  <small>{formatDur(route.durationMin)} drive</small>
                </div>
                <span
                  className="route-risk"
                  style={{ background: `${RISK_COL[analysis.risk]}22`, color: RISK_COL[analysis.risk] }}
                >
                  {analysis.risk === 'CLEAR' ? '✅ CLEAR' : `⚠️ ${analysis.risk} RISK`}
                </span>
              </div>
              {!route.viaRoad && <small className="route-note">Straight-line preview (no road geometry).</small>}

              <div className="route-warn-block">
                <h5>🚨 Anomaly forecast on this route</h5>
                {analysis.warnings.length === 0 && analysis.advisories.length === 0 && (
                  <p className="route-ok">No active fault zones touch this route. Safe to travel.</p>
                )}
                {analysis.warnings.map((w) => {
                  const fm = faultMeta(w.faultType, w.status);
                  return (
                    <div key={w.stationId} className={`route-warn ${w.severity}`}>
                      <span>{fm.icon}</span>
                      <div>
                        <strong>{w.station} · {fm.label}</strong>
                        <small>Crosses route at km {w.atKm} · {RISK_COL ? '' : ''}{w.status}</small>
                      </div>
                    </div>
                  );
                })}
                {analysis.advisories.map((w) => (
                  <div key={`adv-${w.stationId}`} className="route-warn advisory">
                    <span>👁️</span>
                    <div>
                      <strong>{w.station} nearby</strong>
                      <small>{w.distanceToRouteKm} km off route at km {w.atKm} · {w.status}</small>
                    </div>
                  </div>
                ))}
                {analysis.exposedKm > 0.1 && (
                  <small className="route-note">⚠️ {analysis.exposedKm.toFixed(1)} km of this route passes inside fault coverage.</small>
                )}
              </div>

              <div className="route-trip">
                <h5>📍 Live GPS tracking</h5>
                {!tracking ? (
                  <>
                    <button className="loc-btn primary route-start-btn" onClick={startTracking}>▶ Start Tracking</button>
                    <small className="route-note">Allow location + notifications — your real GPS position is tracked along the blue route with live anomaly alerts on your screen.</small>
                  </>
                ) : (
                  <>
                    <div className="route-trip-row">
                      <button className="loc-btn danger" onClick={() => stopTracking(false)}>⏹ Stop Tracking</button>
                    </div>
                    <div className="route-progress">
                      <div className="route-progress-bar"><span style={{ width: `${pct}%` }} /></div>
                      <small>
                        {gps
                          ? `${progressKm.toFixed(1)} / ${totalKm.toFixed(1)} km · ±${gps.acc} m${gps.speedKmh != null ? ` · ${gps.speedKmh} km/h` : ''}`
                          : 'Waiting for GPS fix…'}
                        {arrived ? ' · Arrived ✅' : offRoute ? ' · Off route ⚠️' : ''}
                      </small>
                    </div>
                  </>
                )}
                {gpsError && <div className="route-error">⚠️ {gpsError}</div>}
                <label className="route-check">
                  <input type="checkbox" checked={notifyOn} onChange={(e) => setNotifyOn(e.target.checked)} /> 🔔 Notifications
                </label>
                {notifyHint && <small className="route-note">{notifyHint}</small>}
                <label className="route-check">
                  <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 🎯 Follow me
                </label>
              </div>

              {route.steps.length > 0 && (
                <div className="route-steps">
                  <button className="route-steps-toggle" onClick={() => setStepsOpen((v) => !v)}>
                    {stepsOpen ? '▾' : '▸'} {route.steps.length} turn-by-turn directions
                  </button>
                  {stepsOpen && (
                    <ol>{route.steps.map((s, i) => (
                      <li key={i}><span>{s.instruction}</span><small>{formatDist(s.distanceKm)}</small></li>
                    ))}</ol>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Map (appears only after start + end are submitted) ── */}
        {mapOpened && (
        <div className="route-map-wrap">
          <div id="routeMap" ref={mapRef} />

          <div className="map-controls-group">
            <div className="map-layer-dropdown">
              <button className="map-layer-btn" onClick={() => setLayerOpen((v) => !v)} title="Switch map layer">
                <span className="map-layer-icon">{LAYER_ICON[activeTileKey]}</span>
                <span className="map-layer-label">{buildLayerDefs()[activeTileKey]?.name || 'Layer'}</span>
              </button>
              {layerOpen && (
                <div className="map-layer-menu">
                  {LAYER_ORDER.map((k) => (
                    <button
                      key={k}
                      className={`map-layer-option ${activeTileKey === k ? 'active' : ''}`}
                      onClick={() => { setActiveTileKey(k); setLayerOpen(false); }}
                    >
                      {LAYER_ICON[k]} {buildLayerDefs()[k]?.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="map-compass-btn" title="Fit route / reset view" onClick={resetView}>
              <svg className="compass-icon-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
                <text x="18" y="7.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#e74c3c">N</text>
                <polygon points="18,8.5 21,18 18,15.5 15,18" fill="#e74c3c" />
                <polygon points="18,27.5 21,18 18,20.5 15,18" fill="#58a6ff" />
                <circle cx="18" cy="18" r="2" fill="#ffffff" />
              </svg>
            </button>
          </div>

          <div className="loc-status-bar">
            <div className={`loc-pill ${analysis.risk !== 'CLEAR' ? 'alert-pill' : ''}`}>
              <span className="pulse" />
              <span>{route ? `${analysis.risk} · ${analysis.warnings.length} fault zone${analysis.warnings.length === 1 ? '' : 's'} on route` : 'Plan a route to see anomaly forecast'}</span>
            </div>
            {tracking && gps && (
              <div className="loc-pill">📍 {gps.lat.toFixed(3)}°N {gps.lng.toFixed(3)}°E · ±{gps.acc} m</div>
            )}
          </div>

          {/* Navigation guidance header from live GPS — real on-screen
              notifications carry the alerts; nothing pops up inside the map. */}
          {tracking && (
            <div className="route-nav-banner">
              <span className="route-nav-ico">{arrived ? '🏁' : maneuverIcon(nav?.step?.instruction)}</span>
              <div className="route-nav-text">
                <strong>{arrived ? 'Arrived at destination' : nav ? nav.step.instruction : 'Follow the blue route'}</strong>
                <small>
                  {arrived
                    ? `${formatDist(totalKm)} trip complete`
                    : `${nav ? `In ${formatDist(nav.remainingInStepKm)} · ` : ''}${formatDist(remainKm)} left · ETA ${etaStr}`}
                </small>
              </div>
              <button className="route-nav-exit" title="Stop tracking" onClick={() => stopTracking(false)}>✕</button>
            </div>
          )}

          <div className="loc-coords-bar">
            <div className="lcb-item">
              <span className="lcb-val">{route ? formatDist(route.distanceKm) : '—'}</span>
              <span className="lcb-lbl">Distance</span>
            </div>
            <div className="lcb-item">
              <span className="lcb-val">{route ? formatDur(route.durationMin) : '—'}</span>
              <span className="lcb-lbl">Drive time</span>
            </div>
            <div className={`lcb-item ${analysis.risk !== 'CLEAR' ? 'warn' : ''}`}>
              <span className="lcb-val">{route ? analysis.risk : '—'}</span>
              <span className="lcb-lbl">Route risk</span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ── bottom panels (appear with the generated route) ── */}
      {route && (
      <div className="loc-panels" style={{ marginTop: '18px' }}>
        <div className="loc-panel">
          <h4>🚨 Live travel alerts</h4>
          <div className="loc-alert-feed">
            {alerts.length === 0 && analysis.warnings.length === 0 && (
              <div className="loc-alert-empty">Start tracking — every anomaly arrives as a real notification on your screen and is logged here.</div>
            )}
            {alerts.map((a) => (
              <div key={a.id} className={`loc-alert-item ${a.kind === 'critical' ? 'critical' : a.kind === 'high' ? 'high' : a.kind === 'advisory' || a.kind === 'medium' ? 'medium' : 'safe'}`}>
                <span className={`loc-alert-sev ${a.kind === 'info' ? 'CLEAR' : 'THREAT'}`}>{a.kind.toUpperCase()}</span>
                <div className="loc-alert-text">
                  <strong>{a.title}{a.atKm != null ? ` · km ${a.atKm}` : ''}</strong>
                  <span>{a.detail}</span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && analysis.warnings.map((w) => {
              const fm = faultMeta(w.faultType, w.status);
              return (
                <div key={w.stationId} className="loc-alert-item high">
                  <span className="loc-alert-sev WARNING">AHEAD</span>
                  <div className="loc-alert-text">
                    <strong>{w.station} — {fm.label}</strong>
                    <span>On route at km {w.atKm}. {analysis.exposedKm.toFixed(1)} km of route inside fault coverage.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="loc-panel">
          <h4>📍 Route summary</h4>
          {!route && <div className="loc-alert-empty">No route yet — enter a start and destination above, then press Open Map &amp; Get Route.</div>}
          {route && (
            <div className="nearby-list">
              <div className="nearby-item">
                <span className="nearby-dot" style={{ background: '#2ecc71' }} />
                <div className="nearby-info"><strong>A · {start?.label}</strong><small>Start</small></div>
              </div>
              <div className="nearby-item">
                <span className="nearby-dot" style={{ background: '#e74c3c' }} />
                <div className="nearby-info"><strong>B · {end?.label}</strong><small>Destination</small></div>
              </div>
              <div className="nearby-item">
                <span className="nearby-dot" style={{ background: '#58a6ff' }} />
                <div className="nearby-info">
                  <strong>{formatDist(route.distanceKm)} · {formatDur(route.durationMin)}</strong>
                  <small>{route.viaRoad ? 'Road route via OSRM' : 'Straight-line preview'} · {route.coords.length} points</small>
                </div>
                <span className="nearby-dist">{analysis.risk}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
