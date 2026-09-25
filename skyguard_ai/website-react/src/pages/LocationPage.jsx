import React from 'react';
import RoutePlannerMap from '../components/RoutePlannerMap';

export default function LocationPage() {
  return (
    <div>
      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">Trip Intelligence</div>
            <h1 className="page-title">Route Planner &amp; Anomaly Alerts</h1>
            <p className="page-desc">
              Search a start and destination in Tamil Nadu like Google Maps —
              get a road route across the AWS network, see which sensor fault
              zones it crosses, and get live notifications while tracking
              your real GPS position.
            </p>
          </div>
          <div className="live-pill">
            <span className="pulse"></span> ROUTE GUARD ACTIVE
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <div className="threat-legend">
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#1a73e8' }}></span>
              <strong>ROUTE</strong>: Your road path (A → B)
            </div>
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#e74c3c' }}></span>
              <strong>FAULT ZONE</strong>: Anomalous AWS station on your path
            </div>
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#2ecc71' }}></span>
              <strong>CLEAR</strong>: No faults touching the route
            </div>
            <div className="tl-row">
              <span className="tl-dot" style={{ background: '#58a6ff' }}></span>
              <strong>ROAD</strong>: Esri road basemap in the layer menu
            </div>
          </div>

          <RoutePlannerMap />
        </div>
      </div>
    </div>
  );
}
