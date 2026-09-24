import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS } from '../data/stations';
import {
  BURST_COOLDOWN_MS,
  BURST_TTL_MS,
  HUD_TTL_MS,
  TN_BOUNDS,
  TN_CENTER,
  TN_MIN_ZOOM,
  TN_ZOOM,
  faultMeta,
  haloDivIcon,
  isAnomalyStatus,
  spawnAnomalyBurst,
} from './anomalyEffects';
import AnomalyHudBanner from './AnomalyHudBanner';

// CARTO raster basemaps require an API key (?key=...) — without a valid key
// tiles render with an "API KEY REQUIRED" watermark (HTTP 200, so no tileerror).
// Key is read from Vite env, with the project key as fallback so the map works
// even if the dev server wasn't restarted after editing .env.
// Official format: https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}.png?key=KEY
function getCartoKey() {
  const fromEnv = (import.meta.env.VITE_CARTO_KEY || '').trim();
  return fromEnv || 'cb1_3w8k_1_40c9422bcdd3d78b75d6104a';
}

function buildTiles() {
  const CARTO_KEY = getCartoKey();
  return {
    dark: {
      url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      name: 'Cyber'
    },
    streets: {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      name: 'Streets'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      subdomains: undefined,
      maxZoom: 19,
      name: 'Satellite'
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
      name: 'OSM Backup'
    }
  };
}

const SEV_COL = {
  HEALTHY: '#2ecc71',
  NORMAL: '#2ecc71',
  DEGRADED: '#f39c12',
  FAULT: '#e67e22',
  CRITICAL: '#e74c3c',
  CUSTOM: '#58a6ff'
};

export default function StationMap({
  selectedStationId = 0,
  onSelectStation,
  stationStates = {},
  liveWeather = {},
  anomalyEvents = []
}) {
  const { isLight } = useTheme();
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const customMarkersRef = useRef([]);

  const [activeTileKey, setActiveTileKey] = useState(isLight ? 'streets' : 'dark');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [hud, setHud] = useState(null); // { key, status, title, detail } — anomaly HUD banner
  const [modalData, setModalData] = useState(null); // { lat, lng, name, radius }
  const burstCleanupsRef = useRef([]);
  const prevStatusRef = useRef(null);
  const burstCooldownRef = useRef({});
  const [customStations, setCustomStations] = useState(() => {
    try {
      const raw = localStorage.getItem('skyguard_custom_stations');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Sync default tile theme with app theme if user hasn't overridden
  useEffect(() => {
    setActiveTileKey(isLight ? 'streets' : 'dark');
  }, [isLight]);

  // Attach a tile layer with one-time OSM fallback if CARTO/Esri errors out.
  // (The "API KEY REQUIRED" watermark is an HTTP 200 image, so it can't be
  // auto-detected — a valid key in .env is the real fix for that.)
  const attachTileLayer = (map, tileKey) => {
    const defs = buildTiles();
    const tileDef = defs[tileKey] || defs.dark;
    const layerOpts = {
      attribution: tileDef.attribution,
      maxZoom: tileDef.maxZoom,
    };
    if (tileDef.subdomains) layerOpts.subdomains = tileDef.subdomains;
    const layer = L.tileLayer(tileDef.url, layerOpts);
    // If the provider 4xx/5xx (bad key, quota, offline), fall back to OSM once.
    layer.on('tileerror', () => {
      try {
        if (tileLayerRef.current === layer && tileKey !== 'osm' && map) {
          map.removeLayer(layer);
          const fb = defs.osm;
          tileLayerRef.current = L.tileLayer(fb.url, {
            attribution: fb.attribution,
            maxZoom: fb.maxZoom,
            subdomains: fb.subdomains,
          }).addTo(map);
        }
      } catch { /* ignore fallback errors */ }
    });
    tileLayerRef.current = layer.addTo(map);
  };

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        center: TN_CENTER,
        zoom: TN_ZOOM,
        // No +/- zoom buttons — zoom via scroll / pinch / double-click only.
        zoomControl: false,
        // Fence the view to Tamil Nadu — no panning/zooming out past the state.
        minZoom: TN_MIN_ZOOM,
        maxBounds: TN_BOUNDS,
        maxBoundsViscosity: 1.0,
      });

      leafletMap.current = map;

      // Use theme-correct layer on first paint (avoids stale closure on activeTileKey).
      attachTileLayer(map, isLight ? 'streets' : 'dark');

      // Fix half-rendered tiles when the map container becomes visible late
      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 250);

      // Hard clamp: never zoom out past the Tamil Nadu framing in your
      // screenshot — wheel, pinch, buttons, or double-click can't go wider.
      map.on('zoomend', () => {
        if (map.getZoom() < TN_MIN_ZOOM) {
          try { map.setZoom(TN_MIN_ZOOM); } catch { /* keep current view */ }
        }
      });

      // Handle map click in add mode
      map.on('click', (e) => {
        if (!addModeRef.current) return;
        setModalData({
          lat: +e.latlng.lat.toFixed(4),
          lng: +e.latlng.lng.toFixed(4),
          name: '',
          radius: 25
        });
      });
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Keep ref for click handler
  const addModeRef = useRef(addMode);
  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  // Update Tile Layer
  useEffect(() => {
    if (!leafletMap.current) return;
    if (tileLayerRef.current) {
      try { leafletMap.current.removeLayer(tileLayerRef.current); } catch { /* already removed */ }
      tileLayerRef.current = null;
    }
    attachTileLayer(leafletMap.current, activeTileKey);
  }, [activeTileKey]);

  // Render station markers
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach(m => {
      m.circle.remove();
      m.dot.remove();
      m.label.remove();
      if (m.halo) m.halo.remove();
    });
    markersRef.current = [];

    TN_STATIONS.forEach((st) => {
      const isSel = st.id === selectedStationId;
      const state = stationStates[st.id] || {};
      const status = state.status || 'HEALTHY';
      const col = SEV_COL[status] || SEV_COL.HEALTHY;
      const wx = liveWeather[st.id] || {};

      const currentTemp = wx.t ?? state.temp ?? st.t;
      const currentPres = wx.p ?? state.pres ?? st.p;
      const currentHum = wx.h ?? state.hum ?? st.h;

      // 1. Coverage circle
      const circle = L.circle([st.lat, st.lng], {
        radius: st.coverage_km * 1000,
        color: col,
        fillColor: col,
        fillOpacity: isSel ? 0.14 : 0.05,
        weight: isSel ? 2 : 0.8,
        opacity: isSel ? 0.85 : 0.35,
        dashArray: isSel ? null : '4 4',
      }).addTo(map);

      // 2. Dot marker
      const dot = L.circleMarker([st.lat, st.lng], {
        radius: isSel ? 12 : 8,
        color: isSel ? '#ffffff' : col,
        fillColor: col,
        fillOpacity: 0.92,
        weight: isSel ? 2.5 : 1.5,
      }).addTo(map);

      // Tooltip
      dot.bindTooltip(
        `<strong>${st.name}</strong><br/>Status: <span style="color:${col};font-weight:700">${status}</span><br/>Temp: ${currentTemp}°C | Pres: ${currentPres} hPa | Hum: ${currentHum}%`,
        { direction: 'top', offset: [0, -6] }
      );

      dot.on('click', () => {
        if (onSelectStation) onSelectStation(st.id);
      });

      // 2b. Persistent severity halo behind anomalous dots — continuous
      // "under detection" cue; pulse speed encodes severity (see haloDivIcon).
      const halo = isAnomalyStatus(status)
        ? L.marker([st.lat, st.lng], {
            icon: haloDivIcon(status),
            interactive: false,
            keyboard: false,
          }).addTo(map)
        : null;

      // 3. Label
      const labelIcon = L.divIcon({
        className: `sg-label ${isSel ? 'sel' : ''}`,
        html: `<span>${st.short}</span>`,
        iconSize: [120, 20],
        iconAnchor: [-6, -6],
      });
      const label = L.marker([st.lat, st.lng], { icon: labelIcon, interactive: false }).addTo(map);

      markersRef.current.push({ id: st.id, circle, dot, label, halo });
    });
  }, [selectedStationId, stationStates, liveWeather, onSelectStation]);

  // One-shot detection burst + HUD banner when a station NEWLY turns anomalous.
  // Ports b3c0408's SG.triggerInjectAnimation to React: shockwave rings +
  // cyber reticle + floating badge (spawnAnomalyBurst) with a 12s per-station
  // cooldown so background flapping can't spam the map.
  useEffect(() => {
    const prev = prevStatusRef.current;
    const now = {};
    TN_STATIONS.forEach((st) => {
      now[st.id] = stationStates[st.id]?.status || 'HEALTHY';
    });
    if (prev) {
      const t = Date.now();
      TN_STATIONS.forEach((st) => {
        const next = now[st.id];
        if (!isAnomalyStatus(next) || isAnomalyStatus(prev[st.id])) return;
        if (t - (burstCooldownRef.current[st.id] || 0) < BURST_COOLDOWN_MS) return;
        burstCooldownRef.current[st.id] = t;
        // Fault-specific effect: spike / freeze / drift / out-of-range each
        // get their own burst color, reticle, badge, and HUD styling.
        const faultType = stationStates[st.id]?.activeAnomaly ?? null;
        const fm = faultMeta(faultType, next);
        const map = leafletMap.current;
        if (map) {
          try { map.panTo([st.lat, st.lng], { animate: true, duration: 0.6 }); } catch { /* pan optional */ }
          const cleanup = spawnAnomalyBurst(map, {
            lat: st.lat,
            lng: st.lng,
            status: next,
            faultType,
            title: fm.label,
            subtitle: st.name,
          });
          if (cleanup) {
            burstCleanupsRef.current.push(cleanup);
            setTimeout(() => {
              burstCleanupsRef.current = burstCleanupsRef.current.filter((c) => c !== cleanup);
            }, BURST_TTL_MS + 100);
          }
        }
        const wx = liveWeather[st.id] || {};
        setHud({
          key: `${st.id}-${t}`,
          status: next,
          faultType,
          title: `${st.name}: ${fm.label}`,
          detail: `T ${wx.t ?? st.t}°C · P ${wx.p ?? st.p} hPa · H ${wx.h ?? st.h}% — cross-validating with nearest AWS`,
        });
      });
    }
    prevStatusRef.current = now;
  }, [stationStates, liveWeather]);

  // Auto-dismiss the HUD banner like the vanilla implementation (5.5s).
  useEffect(() => {
    if (!hud) return;
    const t = setTimeout(() => setHud(null), HUD_TTL_MS);
    return () => clearTimeout(t);
  }, [hud]);

  // Tear down pending burst markers alongside the map (map.remove() drops
  // their layers anyway; this only clears their TTL timers).
  useEffect(() => {
    const pending = burstCleanupsRef;
    return () => {
      pending.current.forEach((fn) => { try { fn(); } catch { /* already removed */ } });
    };
  }, []);

  // Render Custom User Stations
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    customMarkersRef.current.forEach(m => {
      m.circle.remove();
      m.dot.remove();
      m.label.remove();
    });
    customMarkersRef.current = [];

    customStations.forEach((cst, i) => {
      const col = '#58a6ff';
      const isSel = selectedStationId === `custom-${i}`;

      const circle = L.circle([cst.lat, cst.lng], {
        radius: (cst.radius || 25) * 1000,
        color: col,
        fillColor: col,
        fillOpacity: isSel ? 0.15 : 0.06,
        weight: 1.5,
        dashArray: '3 3'
      }).addTo(map);

      const dot = L.circleMarker([cst.lat, cst.lng], {
        radius: isSel ? 12 : 8,
        color: '#ffffff',
        fillColor: col,
        fillOpacity: 0.95,
        weight: 2
      }).addTo(map);

      dot.bindTooltip(`<strong>${cst.name} (Custom)</strong><br/>Radius: ${cst.radius} km`, { direction: 'top' });

      dot.on('click', () => {
        if (onSelectStation) onSelectStation(`custom-${i}`);
      });

      const labelIcon = L.divIcon({
        className: 'sg-label',
        html: `<span>${cst.name}</span>`,
        iconSize: [120, 20],
        iconAnchor: [-6, -6]
      });
      const label = L.marker([cst.lat, cst.lng], { icon: labelIcon, interactive: false }).addTo(map);

      customMarkersRef.current.push({ id: `custom-${i}`, circle, dot, label });
    });
  }, [customStations, selectedStationId, onSelectStation]);

  // Handle adding custom station
  const handleConfirmStation = (e) => {
    e.preventDefault();
    if (!modalData || !modalData.name.trim()) return;

    const newStation = {
      name: modalData.name.trim(),
      lat: modalData.lat,
      lng: modalData.lng,
      radius: modalData.radius,
      addedAt: new Date().toLocaleTimeString()
    };

    const updated = [...customStations, newStation];
    setCustomStations(updated);
    try {
      localStorage.setItem('skyguard_custom_stations', JSON.stringify(updated));
    } catch {}

    setModalData(null);
    setAddMode(false);
  };

  const handleDeleteCustomStation = (index) => {
    const updated = customStations.filter((_, idx) => idx !== index);
    setCustomStations(updated);
    try {
      localStorage.setItem('skyguard_custom_stations', JSON.stringify(updated));
    } catch {}
  };

  const resetCompass = () => {
    if (leafletMap.current) {
      leafletMap.current.setView(TN_CENTER, TN_ZOOM);
    }
  };

  // Active selected station details for info popup
  const isCustom = typeof selectedStationId === 'string' && selectedStationId.startsWith('custom-');
  const customIdx = isCustom ? parseInt(selectedStationId.replace('custom-', ''), 10) : null;
  const currentSt = isCustom
    ? customStations[customIdx]
    : TN_STATIONS.find(s => s.id === selectedStationId) || TN_STATIONS[0];
  const currentState = (!isCustom && stationStates[currentSt?.id]) || {};
  const currentWx = (!isCustom && liveWeather[currentSt?.id]) || {};

  return (
    <div className="map-section">
      {/* MAP TOOLBAR */}
      <div className="map-toolbar">
        <button
          className={`btn-toggle-add ${addMode ? 'active' : ''}`}
          id="toggleAddMode"
          onClick={() => setAddMode(!addMode)}
        >
          {addMode ? '✕ Cancel Add Mode' : '＋ Add Station (tap map)'}
        </button>
        <span className="toolbar-label">
          {addMode ? 'Tap anywhere on the map to position station' : 'Interactive Tamil Nadu AWS Grid'}
        </span>
      </div>

      {/* CUSTOM STATIONS LIST */}
      {customStations.length > 0 && (
        <div className="custom-list">
          {customStations.map((c, idx) => (
            <div key={idx} className="cst-item">
              <span className="cst-dot"></span>
              <span className="cst-name">{c.name}</span>
              <span className="cst-meta">{c.lat}, {c.lng} ({c.radius} km)</span>
              <button
                className="cst-del"
                title="Remove Station"
                onClick={() => handleDeleteCustomStation(idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MAP WRAPPER */}
      <div className="map-wrap">
        <div id="tnMap" ref={mapRef} className={addMode ? 'add-mode' : ''} style={{ height: '520px' }}></div>

        {addMode && (
          <div className="add-hint-banner show">
            📍 Click anywhere on the map to place a new station
          </div>
        )}

        {/* OVERLAYS */}
        <div className="map-overlay">
          <div className="map-title-pill">
            <span className="pulse"></span>
            <span>Tamil Nadu AWS · {TN_STATIONS.length + customStations.length} Stations</span>
          </div>
          <div className="map-title-pill" style={{ fontSize: '10px', gap: '5px', padding: '5px 11px', opacity: 0.92 }}>
            ⚡ Open-Meteo Live Synced
          </div>
          <div className="map-legend">
            <div className="map-legend-row"><span className="ml-dot" style={{ background: '#2ecc71' }}></span>HEALTHY</div>
            <div className="map-legend-row"><span className="ml-dot" style={{ background: '#f39c12' }}></span>DEGRADED</div>
            <div className="map-legend-row"><span className="ml-dot" style={{ background: '#e67e22' }}></span>FAULT</div>
            <div className="map-legend-row"><span className="ml-dot" style={{ background: '#e74c3c' }}></span>CRITICAL</div>
            {customStations.length > 0 && (
              <div className="map-legend-row" style={{ marginTop: '4px', paddingTop: '5px', borderTop: '1px solid var(--border)' }}>
                <span className="ml-dot" style={{ background: '#58a6ff' }}></span>Custom
              </div>
            )}
          </div>
        </div>

        {/* ANOMALY DETECTION HUD BANNER — shared with the location map */}
        <AnomalyHudBanner hud={hud} onClose={() => setHud(null)} />

        {/* Selected Station Info Popup */}
        {currentSt && (
          <div className="map-info-popup" style={{ top: '56px', display: 'block' }}>
            <div className="mip-name">
              📍 {currentSt.name}
            </div>
            <div className="mip-rows">
              <div className="mip-row">
                <span className="mip-label">🌡 Temperature</span>
                <span className="mip-val">{currentWx.t ?? currentState.temp ?? currentSt.t}°C</span>
              </div>
              <div className="mip-row">
                <span className="mip-label">🔵 Pressure</span>
                <span className="mip-val">{currentWx.p ?? currentState.pres ?? currentSt.p} hPa</span>
              </div>
              <div className="mip-row">
                <span className="mip-label">💧 Humidity</span>
                <span className="mip-val">{currentWx.h ?? currentState.hum ?? currentSt.h}%</span>
              </div>
              <div className="mip-row">
                <span className="mip-label">📊 Confidence</span>
                <span className="mip-val">{currentState.conf ? `${(currentState.conf * 100).toFixed(0)}%` : '98.5%'}</span>
              </div>
              <div className="mip-row">
                <span className="mip-label">📡 Coverage</span>
                <span className="mip-val">{currentSt.coverage_km || currentSt.radius || 25} km</span>
              </div>
              <div className="mip-row">
                <span className="mip-label">🚦 Status</span>
                <span
                  className="mip-sev"
                  style={{
                    background: `${SEV_COL[currentState.status || 'HEALTHY']}22`,
                    color: SEV_COL[currentState.status || 'HEALTHY']
                  }}
                >
                  {currentState.status || 'HEALTHY'}
                </span>
              </div>
            </div>
            {isCustom && (
              <button
                className="mip-delete-btn"
                onClick={() => handleDeleteCustomStation(customIdx)}
              >
                🗑 Delete This Station
              </button>
            )}
          </div>
        )}

        {/* LAYER SELECTOR & COMPASS */}
        <div className="map-controls-group">
          <div className="map-layer-dropdown">
            <button
              className="map-layer-btn"
              onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
              title="Switch map layer"
            >
              <span className="map-layer-icon">
                {activeTileKey === 'dark' ? '🌙' : activeTileKey === 'streets' ? '☀️' : activeTileKey === 'osm' ? '🗺️' : '🛰️'}
              </span>
              <span className="map-layer-label">
                {buildTiles()[activeTileKey]?.name || 'Layer'}
              </span>
            </button>
            {layerDropdownOpen && (
              <div className="map-layer-menu">
                <button
                  className={`map-layer-option ${activeTileKey === 'dark' ? 'active' : ''}`}
                  onClick={() => { setActiveTileKey('dark'); setLayerDropdownOpen(false); }}
                >
                  🌙 Cyber
                </button>
                <button
                  className={`map-layer-option ${activeTileKey === 'streets' ? 'active' : ''}`}
                  onClick={() => { setActiveTileKey('streets'); setLayerDropdownOpen(false); }}
                >
                  ☀️ Streets
                </button>
                <button
                  className={`map-layer-option ${activeTileKey === 'satellite' ? 'active' : ''}`}
                  onClick={() => { setActiveTileKey('satellite'); setLayerDropdownOpen(false); }}
                >
                  🛰️ Satellite
                </button>
                <button
                  className={`map-layer-option ${activeTileKey === 'osm' ? 'active' : ''}`}
                  onClick={() => { setActiveTileKey('osm'); setLayerDropdownOpen(false); }}
                >
                  🗺️ OSM Backup
                </button>
              </div>
            )}
          </div>

          <button className="map-compass-btn" title="Reset view to North" onClick={resetCompass}>
            <svg className="compass-icon-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
              <text x="18" y="7.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#e74c3c">N</text>
              <polygon points="18,8.5 21,18 18,15.5 15,18" fill="#e74c3c" />
              <polygon points="18,27.5 21,18 18,20.5 15,18" fill="#58a6ff" />
              <circle cx="18" cy="18" r="2" fill="#ffffff" />
            </svg>
          </button>
        </div>

        {/* BOTTOM STATS BAR */}
        <div className="map-stats-bar">
          <div className="msb-item">
            <span className="msb-val" style={{ color: 'var(--accent)' }}>
              {1240 + anomalyEvents.length * 12}
            </span>
            <span className="msb-lbl">Readings</span>
          </div>
          <div className="msb-item">
            <span className="msb-val" style={{ color: 'var(--green)' }}>
              {TN_STATIONS.length - Object.values(stationStates).filter(s => s.status && s.status !== 'HEALTHY').length}
            </span>
            <span className="msb-lbl">Healthy</span>
          </div>
          <div className="msb-item">
            <span className="msb-val" style={{ color: 'var(--red)' }}>
              {Object.values(stationStates).filter(s => s.status === 'CRITICAL' || s.status === 'FAULT').length}
            </span>
            <span className="msb-lbl">Anomalies</span>
          </div>
          <div className="msb-item">
            <span className="msb-val" style={{ color: 'var(--blue)' }}>
              &lt; 5ms
            </span>
            <span className="msb-lbl">Latency</span>
          </div>
        </div>
      </div>

      {/* ADD STATION MODAL */}
      {modalData && (
        <div className="radius-modal-overlay show">
          <div className="radius-modal">
            <h3 className="rm-title">📍 Add New Weather Station</h3>
            <p className="rm-sub">Specify a name and sensing radius for this custom monitoring node.</p>
            <div className="rm-coords">
              <span>Lat: {modalData.lat}</span> · <span>Lng: {modalData.lng}</span>
            </div>
            <form onSubmit={handleConfirmStation}>
              <div className="rm-field">
                <label>Station Name</label>
                <input
                  type="text"
                  placeholder="e.g. Thiruvanmiyur Coast"
                  required
                  autoFocus
                  value={modalData.name}
                  onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                />
              </div>
              <div className="rm-radius-row">
                <label>Coverage</label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={modalData.radius}
                  onChange={(e) => setModalData({ ...modalData, radius: +e.target.value })}
                />
                <span className="rm-radius-val">{modalData.radius} km</span>
              </div>
              <div className="rm-actions">
                <button type="button" className="rm-cancel" onClick={() => setModalData(null)}>
                  Cancel
                </button>
                <button type="submit" className="rm-confirm">
                  Place Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
