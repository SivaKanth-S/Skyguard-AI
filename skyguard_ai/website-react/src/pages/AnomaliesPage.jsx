import React, { useState } from 'react';
import { ANOMALY_TYPES, DETECTION_SUMMARY_TABLE } from '../data/anomaliesData';
import MiniChart from '../components/MiniChart';

export default function AnomaliesPage({ embed = false }) {
  const [filter, setFilter] = useState('all');

  const filteredAnomalies = ANOMALY_TYPES.filter(a => {
    if (filter === 'all') return true;
    return a.cat === filter;
  });

  return (
    <div>
      {/* PAGE HERO (hidden when embedded in the Insights page) */}
      {!embed && (
        <div className="page-hero">
          <div className="wrap page-hero-row">
            <div>
              <div className="label">Detection Coverage</div>
              <h1 className="page-title">Anomaly Type Reference</h1>
              <p className="page-desc">
                SkyGuard AI detects 7 distinct AWS fault patterns, each with dedicated strategies, severity levels, and recommended actions.
              </p>
            </div>
            <div className="page-stat">
              <span className="big">7</span>
              <small>Anomaly Types</small>
            </div>
          </div>
        </div>
      )}

      <div className="page-body">
        <div className="wrap">
          {/* FILTER TABS */}
          <div className="ftabs">
            <button
              className={`ftab ${filter === 'all' ? 'on' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`ftab ${filter === 'sensor' ? 'on' : ''}`}
              onClick={() => setFilter('sensor')}
            >
              Sensor Fault
            </button>
            <button
              className={`ftab ${filter === 'data' ? 'on' : ''}`}
              onClick={() => setFilter('data')}
            >
              Data Quality
            </button>
            <button
              className={`ftab ${filter === 'multi' ? 'on' : ''}`}
              onClick={() => setFilter('multi')}
            >
              Multivariate
            </button>
          </div>

          {/* ANOMALY CARDS GRID */}
          <div className="auto3" id="anomGrid" style={{ marginBottom: '40px' }}>
            {filteredAnomalies.map((a) => (
              <div key={a.id} className="card fi" data-cat={a.cat}>
                <div className="anom-hdr">
                  <span className={`abadge ${a.badgeClass}`}>{a.badge}</span>
                  <span className="anom-sev">{a.severity}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
                <div className="anom-example">
                  <span className="lbl">Example:</span>
                  <code>{a.example}</code>
                </div>
                <div className="anom-mini">
                  <MiniChart
                    data={a.generatePoints()}
                    color={a.chartColor}
                    isMulti={a.multiSeries}
                  />
                </div>
                <div className="anom-detect">
                  <strong>Detection:</strong> {a.detection}
                </div>
                <div className="anom-action">
                  <strong>Action:</strong> {a.action}
                </div>
              </div>
            ))}
          </div>

          {/* SUMMARY TABLE */}
          <div className="tbl-wrap">
            <h3>Detection Method Summary</h3>
            <div className="tbl-scroll">
              <table className="stbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Primary Detector</th>
                    <th>Key Feature</th>
                    <th>Confidence</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {DETECTION_SUMMARY_TABLE.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`abadge ${row.badge}`}>{row.type}</span>
                      </td>
                      <td>{row.detector}</td>
                      <td>{row.feature}</td>
                      <td>{row.conf}</td>
                      <td>
                        <span
                          style={{
                            color: row.sevColor,
                            fontWeight: '700',
                            fontSize: '11px'
                          }}
                        >
                          {row.sev}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
