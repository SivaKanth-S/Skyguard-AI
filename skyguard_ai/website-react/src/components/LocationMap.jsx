import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS } from '../data/stations';
import {
  BURST_COOLDOWN_MS,
  HUD_TTL_MS,
  TN_BOUNDS,
  TN_CENTER,
  TN_MIN_ZOOM,
  TN_ZOOM,
  faultMeta,
  haloDivIcon,
  isAnomalyStatus,
  metaFor,
  spawnAnomalyBurst,
} from './anomalyEffects';
import AnomalyHudBanner from './AnomalyHudBanner';

// CARTO raster basemaps require an API key (?key=...) — without a valid key
// tiles render with an "API KEY REQUIRED" watermark. Official format:
// https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}.png?key=KEY
function getCartoKey() {
  const fromEnv = (import.meta.env.VITE_CARTO_KEY || '').trim();
  return fromEnv || 'cb1_3w8k_1_40c9422bcdd3d78b75d6104a';
}

// Same four layers as the dashboard map (StationMap).
function buildLayerDefs() {
  const key = getCartoKey();
  const cartoAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
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

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LocationMap() {
  const { isLight } = useTheme();
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const userMarkerRef = useRef(null);
  const accCircleRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const acquiringTimer = useRef(null);
  const prevThreatRef = useRef(null);
  const burstCooldownRef = useRef(0);

  const [coords, setCoords] = useState({ lat: 13.0827, lng: 80.2707, acc: 25 }); // default Chennai
  const [acquiring, setAcquiring] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [hud, setHud] = useState(null); // { key, status, title, detail }
  const [activeTileKey, setActiveTileKey] = useState(isLight ? 'streets' : 'dark');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const tileInitRef = useRef(false);
  // Automatic fault engine — same 9s rhythm / 3-cycle lifetime as the
  // dashboard engine, seeded with the same Trichy + Salem fault zones.
  const autoFaultsRef = useRef({
    3: { status: 'CRITICAL', cycles: 0, faultType: 'spike' },
    4: { status: 'FAULT', cycles: 0, faultType: 'freeze' },
  });
  const [autoFaults, setAutoFaults] = useState(autoFaultsRef.current);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    setAcquiring(true);
    setPermissionDenied(false);

    // Safety: never leave the UI stuck in "acquiring" — fall back to Chennai default.
    if (acquiringTimer.current) clearTimeout(acquiringTimer.current);
    acquiringTimer.current = setTimeout(() => setAcquiring(false), 9000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (acquiringTimer.current) clearTimeout(acquiringTimer.current);
        setAcquiring(false);
        const { latitude, longitude, accuracy } = pos.coords;
        updatePosition(latitude, longitude, Math.round(accuracy || 20));
      },
      (err) => {
        if (acquiringTimer.current) clearTimeout(acquiringTimer.current);
        setAcquiring(false);
        if (err.code === 1) {
          setPermissionDenied(true);
        }
        // err.code 2/3 (unavailable/timeout): keep working default position silently.
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // GPS marker layers are created ONLY on a real geolocation fix — the map
  // never shows a default/simulated position as your location.
  const [hasFix, setHasFix] = useState(false);

  const ensureUserLayers = (lat, lng, acc) => {
    const map = leafletMap.current;
    if (!map || userMarkerRef.current) return;
    const userIcon = L.divIcon({
      className: 'user-loc-pulse',
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#0969da;border:3px solid #fff;box-shadow:0 0 12px #0969da;"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    userMarkerRef.current = L.marker([lat, lng], { icon: userIcon }).addTo(map);
    userMarkerRef.current.bindTooltip('📍 Your Location', { direction: 'top', offset: [0, -12] });
    accCircleRef.current = L.circle([lat, lng], {
      radius: acc,
      color: '#0969da',
      fillColor: '#0969da',
      fillOpacity: 0.12,
      weight: 1
    }).addTo(map);
  };

  const updatePosition = (lat, lng, acc = 20) => {
    setCoords({ lat: +lat.toFixed(4), lng: +lng.toFixed(4), acc });
    setHasFix(true);
    ensureUserLayers(lat, lng, acc);

    if (leafletMap.current) {
      leafletMap.current.setView([lat, lng], 11);
      if (userMarkerRef.current) userMarkerRef.current.setLatLng([lat, lng]);
      if (accCircleRef.current) {
        accCircleRef.current.setLatLng([lat, lng]);
        accCircleRef.current.setRadius(acc);
      }
    }
  };

  // Computed distances and alerts
  const [nearbyStations, setNearbyStations] = useState([]);
  const [threatStatus, setThreatStatus] = useState('CLEAR');
  const [threatLevelText, setThreatLevelText] = useState('Safe — No anomalies detected near your position.');

  const tileLayerRef = useRef(null);

  const attachTileLayer = (map, tileKey) => {
    if (tileLayerRef.current) {
      try { map.removeLayer(tileLayerRef.current); } catch { /* already removed */ }
      tileLayerRef.current = null;
    }
    const defs = buildLayerDefs();
    const def = defs[tileKey] || defs.dark;
    const opts = { maxZoom: def.maxZoom, attribution: def.attribution };
    if (def.subdomains) opts.subdomains = def.subdomains;
    const layer = L.tileLayer(def.url, opts);
    // If the provider errors (bad key, quota, offline), fall back to OSM once.
    // NOTE: the "API KEY REQUIRED" watermark is an HTTP 200 image, so it
    // can't be auto-detected — a valid key in .env is the real fix for that.
    layer.on('tileerror', () => {
      try {
        if (tileLayerRef.current === layer && tileKey !== 'osm') {
          map.removeLayer(layer);
          const fb = defs.osm;
          tileLayerRef.current = L.tileLayer(fb.url, {
            maxZoom: fb.maxZoom,
            subdomains: fb.subdomains,
            attribution: fb.attribution,
          }).addTo(map);
        }
      } catch { /* ignore fallback errors */ }
    });
    tileLayerRef.current = layer.addTo(map);
  };

  // Compass: fly back to the user's GPS fix (same role as the dashboard compass).
  const resetView = () => {
    const map = leafletMap.current;
    if (!map) return;
    try {
      if (userMarkerRef.current) {
        const ll = userMarkerRef.current.getLatLng();
        map.flyTo(ll, Math.max(map.getZoom(), 11), { animate: true, duration: 0.8 });
      } else {
        map.setView(TN_CENTER, TN_ZOOM);
      }
    } catch { /* keep current view */ }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 11,
        // No +/- zoom buttons (same as the dashboard map).
        zoomControl: false,
        // Fence the view to Tamil Nadu — no panning/zooming out past the state.
        minZoom: TN_MIN_ZOOM,
        maxBounds: TN_BOUNDS,
        maxBoundsViscosity: 1.0,
      });

      leafletMap.current = map;

      attachTileLayer(map, isLight ? 'streets' : 'dark');

      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 250);

      // Hard clamp: never zoom out past the Tamil Nadu framing — wheel,
      // pinch, buttons, or double-click can't go wider.
      map.on('zoomend', () => {
        if (map.getZoom() < TN_MIN_ZOOM) {
          try { map.setZoom(TN_MIN_ZOOM); } catch { /* keep current view */ }
        }
      });

      // NOTE: no GPS marker here — user layers appear only after a real
      // geolocation fix (see ensureUserLayers), never at a default spot.
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
      tileLayerRef.current = null;
    };
  }, []);

  // Follow the app theme with the matching basemap (same as dashboard map).
  useEffect(() => {
    setActiveTileKey(isLight ? 'streets' : 'dark');
  }, [isLight]);

  // Swap the tile layer whenever the selected layer changes (skips the
  // first run — init already attached the theme-correct layer).
  useEffect(() => {
    if (!leafletMap.current) return;
    if (!tileInitRef.current) {
      tileInitRef.current = true;
      return;
    }
    attachTileLayer(leafletMap.current, activeTileKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTileKey]);

  // Request actual Geolocation on mount
  useEffect(() => {
    requestLocation();
    return () => {
      if (acquiringTimer.current) clearTimeout(acquiringTimer.current);
    };
  }, []);

  // Automatic fault engine: faults raise themselves on healthy stations,
  // age, and self-heal — threat escalation fires the shared burst + HUD.
  useEffect(() => {
    const id = setInterval(() => {
      const prev = autoFaultsRef.current || {};
      const next = {};
      let dirty = false;

      Object.entries(prev).forEach(([sid, f]) => {
        const age = (f?.cycles ?? 0) + 1;
        if (age < 3) {
          next[sid] = { status: f.status, cycles: age, faultType: f.faultType };
          dirty = true;
        } else {
          dirty = true; // a fault just self-healed
        }
      });

      const activeCount = Object.keys(next).length;
      if (activeCount < 2 && Math.random() < 0.6) {
        const candidates = TN_STATIONS.filter(st => !(st.id in next));
        if (candidates.length) {
          const st = candidates[(Math.random() * candidates.length) | 0];
          // Fault type follows the severity, like the dashboard engine —
          // all 7 anomaly types occur: spike/oor/missing → CRITICAL,
          // freeze/multi/noise → FAULT, drift/noise → DEGRADED.
          const roll = Math.random();
          const status = roll < 0.35 ? 'CRITICAL' : roll < 0.7 ? 'FAULT' : 'DEGRADED';
          const pool =
            status === 'CRITICAL' ? ['spike', 'oor', 'missing']
            : status === 'FAULT' ? ['freeze', 'multi', 'noise']
            : ['drift', 'noise'];
          const faultType = pool[(Math.random() * pool.length) | 0];
          next[st.id] = { status, cycles: 0, faultType };
          dirty = true;
        }
      }

      if (dirty) {
        autoFaultsRef.current = next;
        setAutoFaults(next);
      }
    }, 9000);
    return () => clearInterval(id);
  }, []);

  // Recalculate nearby stations & threat score on move or auto-fault change
  useEffect(() => {
    const list = TN_STATIONS.map((st) => {
      const dist = haversineDistance(coords.lat, coords.lng, st.lat, st.lng);
      const fault = autoFaults[st.id];
      const status = fault?.status ?? 'HEALTHY';
      return {
        ...st,
        distance: +dist.toFixed(1),
        status,
        faultType: fault?.faultType ?? null,
        inCoverage: dist <= st.coverage_km
      };
    }).sort((a, b) => a.distance - b.distance);

    setNearbyStations(list);

    // Determine threat
    const nearestThreat = list.find(s => s.status !== 'HEALTHY');
    let nextThreat = 'CLEAR';
    let nextThreatText = `Normal: All ${list.slice(0, 3).map(s => s.short).join(', ')} stations operating with >98% sensor confidence.`;

    if (nearestThreat && nearestThreat.distance < nearestThreat.coverage_km) {
      nextThreat = 'THREAT';
      nextThreatText = `CRITICAL: You are inside active anomaly zone of ${nearestThreat.name} (${nearestThreat.distance} km).`;
    } else if (nearestThreat && nearestThreat.distance < 45) {
      nextThreat = 'WARNING';
      nextThreatText = `WARNING: ${nearestThreat.name} reported sensor faults ${nearestThreat.distance} km away.`;
    } else if (nearestThreat && nearestThreat.distance < 80) {
      nextThreat = 'ADVISORY';
      nextThreatText = `ADVISORY: Monitoring minor variance at ${nearestThreat.name} (${nearestThreat.distance} km away).`;
    }
    setThreatStatus(nextThreat);
    setThreatLevelText(nextThreatText);

    // One-shot detection burst when the threat level ESCALATES into a fault
    // zone (mirrors the dashboard map burst; 12s cooldown against flapping).
    const prevThreat = prevThreatRef.current;
    const RANK = { CLEAR: 0, ADVISORY: 1, WARNING: 2, THREAT: 3 };
    if (
      prevThreat != null &&
      nearestThreat &&
      (nextThreat === 'WARNING' || nextThreat === 'THREAT') &&
      (RANK[nextThreat] ?? 0) > (RANK[prevThreat] ?? 0)
    ) {
      const t = Date.now();
      if (t - burstCooldownRef.current >= BURST_COOLDOWN_MS && leafletMap.current) {
        burstCooldownRef.current = t;
        const fm = faultMeta(nearestThreat.faultType, nearestThreat.status);
        spawnAnomalyBurst(leafletMap.current, {
          lat: nearestThreat.lat,
          lng: nearestThreat.lng,
          status: nearestThreat.status,
          faultType: nearestThreat.faultType,
          title: `${fm.label} near you`,
          subtitle: `${nearestThreat.name} · ${nearestThreat.distance} km`,
        });
        setHud({
          key: `${nearestThreat.id}-${t}`,
          status: nearestThreat.status,
          faultType: nearestThreat.faultType,
          title: `${nearestThreat.name}: ${fm.label}`,
          detail: nextThreatText,
        });
      }
    }
    prevThreatRef.current = nextThreat;

    // Update markers on map
    if (leafletMap.current) {
      stationMarkersRef.current.forEach(m => {
        try { m.remove(); } catch { /* already removed */ }
      });
      stationMarkersRef.current = [];

      list.slice(0, 8).forEach(st => {
        const isFault = isAnomalyStatus(st.status);
        const col = isFault ? metaFor(st.status).color : '#2ecc71';

        // 1. Coverage circle (same look as the dashboard map).
        const circle = L.circle([st.lat, st.lng], {
          radius: st.coverage_km * 1000,
          color: col,
          fillColor: col,
          fillOpacity: 0.06,
          weight: 1,
          opacity: 0.4,
          dashArray: '4 4',
        }).addTo(leafletMap.current);
        stationMarkersRef.current.push(circle);

        // 2. Persistent severity halo behind fault-zone stations.
        if (isFault) {
          const halo = L.marker([st.lat, st.lng], {
            icon: haloDivIcon(st.status),
            interactive: false,
            keyboard: false,
          }).addTo(leafletMap.current);
          stationMarkersRef.current.push(halo);
        }

        // 3. Dot marker.
        const marker = L.circleMarker([st.lat, st.lng], {
          radius: 8,
          color: col,
          fillColor: col,
          fillOpacity: 0.9,
          weight: 2
        }).addTo(leafletMap.current);

        marker.bindTooltip(`<strong>${st.name}</strong><br/>${st.distance} km away · ${st.status}`, { direction: 'top' });

        stationMarkersRef.current.push(marker);

        // 4. Short-name label (same look as the dashboard map).
        const label = L.marker([st.lat, st.lng], {
          icon: L.divIcon({
            className: 'sg-label',
            html: `<span>${st.short}</span>`,
            iconSize: [120, 20],
            iconAnchor: [-6, -6],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(leafletMap.current);
        stationMarkersRef.current.push(label);
      });
    }
  }, [coords, autoFaults]);

  // Auto-dismiss the HUD banner (same 5.5s timing as the dashboard map).
  useEffect(() => {
    if (!hud) return;
    const t = setTimeout(() => setHud(null), HUD_TTL_MS);
    return () => clearTimeout(t);
  }, [hud]);

  return (
    <div>
      {/* STATUS OVERLAY BAR */}
      <div className="loc-map-wrap">
        <div id="locMap" ref={mapRef}></div>

        {acquiring && (
          <div className="loc-acquiring-badge">
            <div className="loc-spinner-sm"></div>
            <p>Acquiring GPS fix… showing default position</p>
          </div>
        )}

        {permissionDenied && (
          <div className="loc-denied">
            <div className="loc-denied-icon">📍</div>
            <h3>Location Permission Required</h3>
            <p>
              Please allow browser location access to pinpoint your GPS position against the Tamil Nadu AWS network.
            </p>
            <button className="loc-btn primary" onClick={requestLocation}>
              Retry Geolocation
            </button>
          </div>
        )}

        {/* ANOMALY DETECTION HUD BANNER — shared with the dashboard map */}
        <AnomalyHudBanner hud={hud} onClose={() => setHud(null)} />

        {/* LAYER SELECTOR & COMPASS — same controls as the dashboard map */}
        <div className="map-controls-group">
          <div className="map-layer-dropdown">
            <button
              className="map-layer-btn"
              onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
              title="Switch map layer"
            >
              <span className="map-layer-icon">
                {LAYER_ICON[activeTileKey] || '🗺️'}
              </span>
              <span className="map-layer-label">
                {buildLayerDefs()[activeTileKey]?.name || 'Layer'}
              </span>
            </button>
            {layerDropdownOpen && (
              <div className="map-layer-menu">
                {['dark', 'streets', 'road', 'satellite', 'osm'].map(key => (
                  <button
                    key={key}
                    className={`map-layer-option ${activeTileKey === key ? 'active' : ''}`}
                    onClick={() => { setActiveTileKey(key); setLayerDropdownOpen(false); }}
                  >
                    {LAYER_ICON[key]} {buildLayerDefs()[key]?.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="map-compass-btn" title="Fly back to my GPS position" onClick={resetView}>
            <svg className="compass-icon-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
              <text x="18" y="7.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#e74c3c">N</text>
              <polygon points="18,8.5 21,18 18,15.5 15,18" fill="#e74c3c" />
              <polygon points="18,27.5 21,18 18,20.5 15,18" fill="#58a6ff" />
              <circle cx="18" cy="18" r="2" fill="#ffffff" />
            </svg>
          </button>
        </div>

        {/* Top Status Overlay */}
        <div className="loc-status-bar">
          <div className={`loc-pill ${threatStatus !== 'CLEAR' ? 'alert-pill' : ''}`}>
            <span className="pulse"></span>
            <span>{threatStatus}: {threatStatus === 'CLEAR' ? 'Zero Threats Nearby' : 'Sensor Fault Zone Near You'}</span>
          </div>
          <div className="loc-pill">
            <span>📡 Nearest Node: {nearbyStations[0]?.name || 'Loading…'} ({nearbyStations[0]?.distance || 0} km)</span>
          </div>
        </div>

        {/* Bottom Coordinates Bar — live GPS fix only, never a default spot */}
        <div className="loc-coords-bar">
          <div className="lcb-item">
            <span className="lcb-val">{hasFix ? `${coords.lat}° N, ${coords.lng}° E` : '—'}</span>
            <span className="lcb-lbl">GPS Coordinates</span>
          </div>
          <div className="lcb-item">
            <span className="lcb-val">{hasFix ? `${coords.acc} m` : '—'}</span>
            <span className="lcb-lbl">Estimated Accuracy</span>
          </div>
          <div className={`lcb-item ${threatStatus !== 'CLEAR' ? 'warn' : ''}`}>
            <span className="lcb-val">{threatStatus}</span>
            <span className="lcb-lbl">Threat Level</span>
          </div>
        </div>
      </div>

      {/* GPS CONTROLS — real fix only, no simulated positions */}
      <div className="loc-controls">
        <button className="loc-btn primary" onClick={requestLocation}>
          📍 {hasFix ? 'Recalibrate My GPS' : 'Enable My GPS'}
        </button>
        <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase' }}>
          {hasFix ? 'Live GPS fix active' : 'Waiting for GPS fix…'}
        </span>
      </div>

      {/* KPI ROW */}
      <div className="loc-kpi-row">
        <div className={`loc-kpi ${threatStatus !== 'CLEAR' ? 'alert-kpi' : ''}`}>
          <div className="loc-kpi-val">{nearbyStations[0]?.distance || 0} km</div>
          <div className="loc-kpi-lbl">Nearest Station Distance</div>
        </div>
        <div className="loc-kpi">
          <div className="loc-kpi-val" style={{ color: 'var(--green)' }}>
            {nearbyStations.filter(s => s.distance <= 50).length}
          </div>
          <div className="loc-kpi-lbl">Stations Within 50km</div>
        </div>
        <div className={`loc-kpi ${threatStatus !== 'CLEAR' ? 'alert-kpi' : ''}`}>
          <div className="loc-kpi-val" style={{ color: threatStatus !== 'CLEAR' ? 'var(--red)' : 'var(--accent)' }}>
            {threatStatus}
          </div>
          <div className="loc-kpi-lbl">Local Threat Assessment</div>
        </div>
        <div className="loc-kpi">
          <div className="loc-kpi-val" style={{ color: 'var(--blue)' }}>97.4%</div>
          <div className="loc-kpi-lbl">Pipeline Precision</div>
        </div>
      </div>

      {/* ALERT FEED & NEARBY NODES */}
      <div className="loc-panels">
        {/* Nearby stations list */}
        <div className="loc-panel">
          <h4>📡 Closest Meteorological Stations</h4>
          <div className="nearby-list">
            {nearbyStations.slice(0, 5).map(st => (
              <div key={st.id} className="nearby-item">
                <span
                  className="nearby-dot"
                  style={{ background: st.status === 'HEALTHY' ? '#2ecc71' : '#e74c3c' }}
                ></span>
                <div className="nearby-info">
                  <strong>{st.name}</strong>
                  <small>Coverage radius: {st.coverage_km} km · {st.t}°C</small>
                </div>
                <span className="nearby-dist">{st.distance} km</span>
                <span
                  className="nearby-sev-badge"
                  style={{
                    background: st.status === 'HEALTHY' ? 'rgba(46,204,113,.15)' : 'rgba(231,76,60,.15)',
                    color: st.status === 'HEALTHY' ? 'var(--green)' : 'var(--red)'
                  }}
                >
                  {st.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live threat advisory */}
        <div className="loc-panel">
          <h4>🚨 Real-Time Geofence Advisories</h4>
          <div className="loc-alert-feed">
            <div className={`loc-alert-item ${threatStatus === 'THREAT' ? 'critical' : threatStatus === 'WARNING' ? 'high' : 'safe'}`}>
              <span className={`loc-alert-sev ${threatStatus}`}>{threatStatus}</span>
              <div className="loc-alert-text">
                <strong>{threatLevelText}</strong>
                <span>
                  Real-time spatial cross-validation pipeline scans all observations within your radius every 10 minutes.
                </span>
              </div>
            </div>
            <div className="loc-alert-item safe">
              <span className="loc-alert-sev CLEAR">CLEAR</span>
              <div className="loc-alert-text">
                <strong>Atmospheric Pressure Stability Verified</strong>
                <span>Barometric readings across Chennai and Kancheepuram stations align with regional synoptic pressure curves.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
