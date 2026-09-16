import React from 'react';
import LocationMap from '../components/LocationMap';

export default function LocationPage() {
  return (
    <div>
      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">Geospatial Intelligence</div>
            <h1 className="page-title">Live Location &amp; Threat Proximity</h1>
            <p className="page-desc">
              Track your real-time GPS position across the Tamil Nadu AWS network, compute distance to sensor fault zones, and receive automated geofenced safety alerts.
            </p>
          </div>
          <div className="live-pill">
            <span className="pulse"></span> GPS ACTIVE
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {/* THREAT LEGEND */}
          <div className="threat-legend">
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#e74c3c' }}></span>
              <strong>THREAT</strong>: Inside active anomaly radius
            </div>
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#e67e22' }}></span>
              <strong>WARNING</strong>: Fault station within 45 km
            </div>
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#f39c12' }}></span>
              <strong>ADVISORY</strong>: Minor variance within 80 km
            </div>
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#2ecc71' }}></span>
              <strong>CLEAR</strong>: Regional meteorological network nominal
            </div>
          </div>

          {/* MAIN LOCATION COMPONENT */}
          <LocationMap />
        </div>
      </div>
    </div>
  );
}
