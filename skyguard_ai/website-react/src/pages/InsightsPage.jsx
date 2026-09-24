import React from 'react';
import AnomaliesPage from './AnomaliesPage';
import ArchitecturePage from './ArchitecturePage';
import UseCasesPage from './UseCasesPage';
import MetricsPage from './MetricsPage';

// Single combined page for Anomalies + Architecture + Use Cases + Metrics.
// Each section reuses its page component with `embed` (hero suppressed) so
// content and chart logic stay in one place.
const SECTIONS = [
  { id: 'anomalies', label: 'Anomalies', icon: '🚨' },
  { id: 'architecture', label: 'Architecture', icon: '🏗️' },
  { id: 'usecases', label: 'Use Cases', icon: '🌍' },
  { id: 'metrics', label: 'Metrics', icon: '📊' },
];

export default function InsightsPage() {
  return (
    <div>
      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">Deep Dive</div>
            <h1 className="page-title">Detection Insights</h1>
            <p className="page-desc">
              Anomaly reference, system architecture, real-world use cases, and evaluation metrics — everything about how SkyGuard AI detects, explains, and corrects sensor faults, on one page.
            </p>
            <div className="ftabs" style={{ marginTop: '16px' }}>
              {SECTIONS.map(s => (
                <a key={s.id} href={`#${s.id}`} className="ftab" style={{ textDecoration: 'none' }}>
                  {s.icon} {s.label}
                </a>
              ))}
            </div>
          </div>
          <div className="page-stat">
            <span className="big">4-in-1</span>
            <small>Combined Guide</small>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          <section id="anomalies" style={{ scrollMarginTop: '90px' }}>
            <AnomaliesPage embed />
          </section>
          <section id="architecture" style={{ scrollMarginTop: '90px', marginTop: '56px' }}>
            <ArchitecturePage embed />
          </section>
          <section id="usecases" style={{ scrollMarginTop: '90px', marginTop: '56px' }}>
            <UseCasesPage embed />
          </section>
          <section id="metrics" style={{ scrollMarginTop: '90px', marginTop: '56px' }}>
            <MetricsPage embed />
          </section>
        </div>
      </div>
    </div>
  );
}
