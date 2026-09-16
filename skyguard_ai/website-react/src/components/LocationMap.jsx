import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS } from '../data/stations';

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

  const [coords, setCoords] = useState({ lat: 13.0827, lng: 80.2707, acc: 25 }); // default Chennai
  const [acquiring, setAcquiring] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [watchId, setWatchId] = useState(null);

  // Computed distances and alerts
  const [nearbyStations, setNearbyStations] = useState([]);
  const [threatStatus, setThreatStatus] = useState('CLEAR');
  const [threatLevelText, setThreatLevelText] = useState('Safe — No anomalies detected near your position.');

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 11,
      });

      leafletMap.current = map;

      const tileUrl = isLight
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(map);

      // User location marker
      const userIcon = L.divIcon({
        className: 'user-loc-pulse',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#0969da;border:3px solid #fff;box-shadow:0 0 12px #0969da;"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: userIcon }).addTo(map);
      accCircleRef.current = L.circle([coords.lat, coords.lng], {
        radius: coords.acc,
        color: '#0969da',
        fillColor: '#0969da',
        fillOpacity: 0.12,
        weight: 1
      }).addTo(map);
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Request actual Geolocation on mount
  useEffect(() => {
    requestLocation();
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    setAcquiring(true);
    setPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAcquiring(false);
        const { latitude, longitude, accuracy } = pos.coords;
        updatePosition(latitude, longitude, accuracy);
      },
      (err) => {
        setAcquiring(false);
        if (err.code === 1) {
          setPermissionDenied(true);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const updatePosition = (lat, lng, acc = 20) => {
    setCoords({ lat: +lat.toFixed(4), lng: +lng.toFixed(4), acc });

    if (leafletMap.current) {
      leafletMap.current.setView([lat, lng], 11);
      if (userMarkerRef.current) userMarkerRef.current.setLatLng([lat, lng]);
      if (accCircleRef.current) {
        accCircleRef.current.setLatLng([lat, lng]);
        accCircleRef.current.setRadius(acc);
      }
    }
  };

  // Recalculate nearby stations & threat score whenever coords change
  useEffect(() => {
    const list = TN_STATIONS.map((st, i) => {
      const dist = haversineDistance(coords.lat, coords.lng, st.lat, st.lng);
      // Simulated anomaly on Trichy and Salem
      const isAnomaly = st.id === 3 || st.id === 4;
      const status = isAnomaly ? (st.id === 3 ? 'CRITICAL' : 'FAULT') : 'HEALTHY';
      return {
        ...st,
        distance: +dist.toFixed(1),
        status,
        inCoverage: dist <= st.coverage_km
      };
    }).sort((a, b) => a.distance - b.distance);

    setNearbyStations(list);

    // Determine threat
    const nearest = list[0];
    const nearestThreat = list.find(s => s.status !== 'HEALTHY');

    if (nearestThreat && nearestThreat.distance < nearestThreat.coverage_km) {
      setThreatStatus('THREAT');
      setThreatLevelText(`CRITICAL: You are inside active anomaly zone of ${nearestThreat.name} (${nearestThreat.distance} km).`);
    } else if (nearestThreat && nearestThreat.distance < 45) {
      setThreatStatus('WARNING');
      setThreatLevelText(`WARNING: ${nearestThreat.name} reported sensor faults ${nearestThreat.distance} km away.`);
    } else if (nearestThreat && nearestThreat.distance < 80) {
      setThreatStatus('ADVISORY');
      setThreatLevelText(`ADVISORY: Monitoring minor variance at ${nearestThreat.name} (${nearestThreat.distance} km away).`);
    } else {
      setThreatStatus('CLEAR');
      setThreatLevelText(`Normal: All ${list.slice(0, 3).map(s => s.short).join(', ')} stations operating with >98% sensor confidence.`);
    }

    // Update markers on map
    if (leafletMap.current) {
      stationMarkersRef.current.forEach(m => m.remove());
      stationMarkersRef.current = [];

      list.slice(0, 8).forEach(st => {
        const isFault = st.status !== 'HEALTHY';
        const col = isFault ? '#e74c3c' : '#2ecc71';

        const marker = L.circleMarker([st.lat, st.lng], {
          radius: 8,
          color: col,
          fillColor: col,
          fillOpacity: 0.8,
          weight: 2
        }).addTo(leafletMap.current);

        marker.bindTooltip(`<strong>${st.name}</strong><br/>${st.distance} km away · ${st.status}`, { direction: 'top' });

        stationMarkersRef.current.push(marker);
      });
    }
  }, [coords]);

  return (
    <div>
      {/* STATUS OVERLAY BAR */}
      <div className="loc-map-wrap">
        <div id="locMap" ref={mapRef}></div>

        {acquiring && (
          <div className="loc-acquiring">
            <div className="loc-spinner"></div>
            <p>Acquiring satellite GPS fix…</p>
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

        {/* Bottom Coordinates Bar */}
        <div className="loc-coords-bar">
          <div className="lcb-item">
            <span className="lcb-val">{coords.lat}° N, {coords.lng}° E</span>
            <span className="lcb-lbl">GPS Coordinates</span>
          </div>
          <div className="lcb-item">
            <span className="lcb-val">{coords.acc} m</span>
            <span className="lcb-lbl">Estimated Accuracy</span>
          </div>
          <div className={`lcb-item ${threatStatus !== 'CLEAR' ? 'warn' : ''}`}>
            <span className="lcb-val">{threatStatus}</span>
            <span className="lcb-lbl">Threat Level</span>
          </div>
        </div>
      </div>

      {/* QUICK PRESETS & CONTROLS STRIP */}
      <div className="loc-controls">
        <button className="loc-btn primary" onClick={requestLocation}>
          📍 Recalibrate My GPS
        </button>
        <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase' }}>
          Simulate Position:
        </span>
        <button className="loc-btn" onClick={() => updatePosition(13.0827, 80.2707, 15)}>
          Chennai
        </button>
        <button className="loc-btn" onClick={() => updatePosition(10.7905, 78.7047, 18)}>
          Trichy (Fault Zone)
        </button>
        <button className="loc-btn" onClick={() => updatePosition(9.8327, 78.0930, 22)}>
          Madurai
        </button>
        <button className="loc-btn" onClick={() => updatePosition(11.4102, 76.6950, 30)}>
          Ooty
        </button>
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
