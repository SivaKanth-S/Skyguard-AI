import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS } from '../data/stations';

const TILES = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    name: 'Cyber'
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    name: 'Streets'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    name: 'Satellite'
  }
};

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
  const { theme, isLight } = useTheme();
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const customMarkersRef = useRef([]);

  const [activeTileKey, setActiveTileKey] = useState(isLight ? 'streets' : 'dark');
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [modalData, setModalData] = useState(null); // { lat, lng, name, radius }
  const [customStations, setCustomStations] = useState(() => {
    try {
      const raw = localStorage.getItem('skyguard_custom_stations');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  // Sync default tile theme with app theme if user hasn't overridden
  useEffect(() => {
    setActiveTileKey(isLight ? 'streets' : 'dark');
  }, [isLight]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        center: [11.1271, 78.6569],
        zoom: 7,
        zoomControl: true,
      });

      leafletMap.current = map;

      const tileDef = TILES[activeTileKey] || TILES.dark;
      tileLayerRef.current = L.tileLayer(tileDef.url, {
        attribution: tileDef.attribution,
        maxZoom: 18,
      }).addTo(map);

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
      leafletMap.current.removeLayer(tileLayerRef.current);
    }
    const tileDef = TILES[activeTileKey] || TILES.dark;
    tileLayerRef.current = L.tileLayer(tileDef.url, {
      attribution: tileDef.attribution,
      maxZoom: 18,
    }).addTo(leafletMap.current);
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

      // 3. Label
      const labelIcon = L.divIcon({
        className: `sg-label ${isSel ? 'sel' : ''}`,
        html: `<span>${st.short}</span>`,
        iconSize: [120, 20],
        iconAnchor: [-6, -6],
      });
      const label = L.marker([st.lat, st.lng], { icon: labelIcon, interactive: false }).addTo(map);

      markersRef.current.push({ id: st.id, circle, dot, label });
    });
  }, [selectedStationId, stationStates, liveWeather, onSelectStation]);

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
    } catch (e) {}

    setModalData(null);
    setAddMode(false);
  };

  const handleDeleteCustomStation = (index) => {
    const updated = customStations.filter((_, idx) => idx !== index);
    setCustomStations(updated);
    try {
      localStorage.setItem('skyguard_custom_stations', JSON.stringify(updated));
    } catch (e) {}
  };

  const resetCompass = () => {
    if (leafletMap.current) {
      leafletMap.current.setView([11.1271, 78.6569], 7);
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
                {activeTileKey === 'dark' ? '🌙' : activeTileKey === 'streets' ? '☀️' : '🛰️'}
              </span>
              <span className="map-layer-label">
                {TILES[activeTileKey]?.name || 'Layer'}
              </span>
              <svg className="map-layer-chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
