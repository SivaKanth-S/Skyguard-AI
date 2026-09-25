import React from 'react';
import { Link } from 'react-router-dom';
import HeroCanvas from '../components/HeroCanvas';
import StatCounter from '../components/StatCounter';
import SensorCards from '../components/SensorCards';

export default function HomePage() {
  const exploreCards = [
    {
      to: '/dashboard',
      title: 'Live Dashboard',
      desc: 'Real-time sensor monitoring, confidence scores, anomaly alerts, and station health panels.',
      grad: 'linear-gradient(135deg,#667eea,#764ba2)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      )
    },
    {
      to: '/insights#anomalies',
      title: 'Anomaly Types',
      desc: '7 fault patterns - spikes, frozen sensors, drift, out-of-range, multivariate, noise, missing data.',
      grad: 'linear-gradient(135deg,#f093fb,#f5576c)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
        </svg>
      )
    },
    {
      to: '/insights#architecture',
      title: 'Architecture',
      desc: '4-layer pipeline: ingestion, 75+ features, hybrid ensemble, explainable alerts.',
      grad: 'linear-gradient(135deg,#4facfe,#00f2fe)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      )
    },
    {
      to: '/insights#usecases',
      title: 'Use Cases',
      desc: 'Agriculture, aviation, flood forecasting, power grid, climate research, disaster management.',
      grad: 'linear-gradient(135deg,#43e97b,#38f9d7)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
      )
    },
    {
      to: '/insights#metrics',
      title: 'Performance Metrics',
      desc: '97.4% accuracy, 98% ROC-AUC, 30 tests passing - benchmarked against threshold baselines.',
      grad: 'linear-gradient(135deg,#fa709a,#fee140)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    },
    {
      to: '/insights#models',
      title: 'ML Models',
      desc: 'IsolationForest, RandomForest, Rule Engine, Z-Score - weighted ensemble fusion.',
      grad: 'linear-gradient(135deg,#a18cd1,#fbc2eb)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
      )
    },
    {
      to: '/location',
      title: 'Route Planner',
      desc: 'Search Tamil Nadu places, get road routes with fault-zone forecasts, and track your live GPS with real-time anomaly notifications.',
      grad: 'linear-gradient(135deg,#58a6ff,#0d5bdd)',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </svg>
      )
    }
  ];

  const features = [
    {
      title: 'Real-Time Detection',
      desc: 'Streaming pipeline processes every 10-min AWS observation with less than 5ms latency. Thread-safe, scales to 100+ stations.',
      grad: 'linear-gradient(135deg,#667eea,#764ba2)',
      icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    },
    {
      title: '7 Anomaly Types',
      desc: 'Spikes, frozen sensors, calibration drift, out-of-range, multivariate inconsistencies, noise bursts, communication failures.',
      grad: 'linear-gradient(135deg,#f093fb,#f5576c)',
      icon: (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
        </>
      )
    },
    {
      title: 'Hybrid Ensemble',
      desc: 'Rule Engine + IsolationForest + Z-Score + RandomForest. Weighted confidence fusion gives best accuracy.',
      grad: 'linear-gradient(135deg,#4facfe,#00f2fe)',
      icon: (
        <>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </>
      )
    },
    {
      title: 'SHAP Explainability',
      desc: 'Every alert includes SHAP-based feature contributions and human-readable root-cause text. Full transparency for operators.',
      grad: 'linear-gradient(135deg,#43e97b,#38f9d7)',
      icon: (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </>
      )
    },
    {
      title: 'Auto Imputation',
      desc: 'Cubic spline + rolling median correction for anomalous readings. Downstream systems receive clean, continuous data.',
      grad: 'linear-gradient(135deg,#fa709a,#fee140)',
      icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    },
    {
      title: 'Plotly Dash UI',
      desc: 'Full interactive dashboard with time-series charts, severity pie, station health, and live alert feed.',
      grad: 'linear-gradient(135deg,#a18cd1,#fbc2eb)',
      icon: (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </>
      )
    }
  ];

  return (
    <div>
      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-bg">
          <HeroCanvas />
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            Intelligent Real-Time<br />
            <span className="grad-text">Anomaly Detection</span><br />
            for Weather Stations
          </h1>
          <p className="hero-desc">
            SkyGuard AI uses a hybrid ensemble ML pipeline to detect sensor faults, spikes, frozen values, calibration drift, and multivariate inconsistencies in AWS data streams with SHAP explainability and auto-correction.
          </p>
          <div className="hero-btns">
            <Link to="/dashboard" className="btn btn-primary">
              Live Dashboard
            </Link>
            <Link to="/insights#architecture" className="btn btn-ghost">
              How It Works
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hstat">
              <span className="hstat-num">
                <StatCounter target={97.4} isFloat={true} />
              </span>
              <span className="hstat-unit">%</span>
              <span className="hstat-lbl">Detection Accuracy</span>
            </div>
            <div className="hstat">
              <span className="hstat-num">
                <StatCounter target={7} />
              </span>
              <span className="hstat-unit">+</span>
              <span className="hstat-lbl">Anomaly Types</span>
            </div>
            <div className="hstat">
              <span className="hstat-num">
                <StatCounter target={5} />
              </span>
              <span className="hstat-unit">ms</span>
              <span className="hstat-lbl">Alert Latency</span>
            </div>
            <div className="hstat">
              <span className="hstat-num">
                <StatCounter target={30} />
              </span>
              <span className="hstat-unit">+</span>
              <span className="hstat-lbl">Tests Passing</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <SensorCards />
        </div>
      </section>

      {/* EXPLORE / WHAT IS INSIDE */}
      <section className="qnav-section">
        <div className="wrap">
          <div className="label">Explore</div>
          <h2 className="h2">What Is Inside</h2>
          <div className="qgrid">
            {exploreCards.map((card, idx) => (
              <Link to={card.to} key={idx} className="qcard fi">
                <div className="qcard-icon" style={{ background: card.grad }}>
                  {card.icon}
                </div>
                <div className="qcard-body">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
                <div className="qcard-arr">&#8594;</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="section alt">
        <div className="wrap">
          <div className="label">Core Capabilities</div>
          <h2 className="h2">Why SkyGuard AI?</h2>
          <p className="sub">
            Built with real meteorological constraints — physics rules, explainable ML, and corrective imputation.
          </p>
          <div className="auto3">
            {features.map((feat, idx) => (
              <div key={idx} className="card fi">
                <div className="feat-icon" style={{ background: feat.grad }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    {feat.icon}
                  </svg>
                </div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
