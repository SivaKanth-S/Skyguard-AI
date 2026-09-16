import React from 'react';
import { USE_CASES, DEPLOYMENT_TABLE } from '../data/useCasesData';

export default function UseCasesPage() {
  return (
    <div>
      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">Real-World Applications</div>
            <h1 className="page-title">Use Cases</h1>
            <p className="page-desc">
              From agriculture to aviation — SkyGuard AI protects every system that depends on trustworthy meteorological data.
            </p>
          </div>
          <div className="page-stat">
            <span className="big">6</span>
            <small>Sectors Covered</small>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {/* USE CASES GRID */}
          <div className="auto2" id="ucGrid" style={{ marginBottom: '40px' }}>
            {USE_CASES.map((uc, idx) => (
              <div
                key={idx}
                className={`card usecase-card ${uc.isGrand ? 'grand-card' : ''} fi`}
              >
                <div className="uc-hdr">
                  <div className="uc-icon">{uc.icon}</div>
                  <span className={`uc-badge ${uc.isGrand ? 'grand' : ''}`}>
                    {uc.badge}
                  </span>
                </div>
                <h3>{uc.title}</h3>
                <p>{uc.desc}</p>
                <div className="uc-scene">
                  <div className="uc-scene-lbl">Scenario</div>
                  {uc.scenario}
                </div>
                <div className="uc-impacts">
                  {uc.impacts.map((imp, iIdx) => (
                    <span key={iIdx} className="uc-impact">
                      {imp}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* DEPLOYMENT TABLE */}
          <div className="tbl-wrap">
            <h3>Deployment Scenarios</h3>
            <div className="tbl-scroll">
              <table className="stbl">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Key Benefit</th>
                    <th>Primary Anomaly</th>
                    <th>Data Source</th>
                    <th>Alert Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPLOYMENT_TABLE.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.sector}</td>
                      <td>{row.benefit}</td>
                      <td>{row.anom}</td>
                      <td>{row.source}</td>
                      <td>{row.latency}</td>
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
