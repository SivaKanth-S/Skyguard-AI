import React from 'react';

export default function ArchitecturePage() {
  const pipelineSteps = [
    {
      num: '01',
      icon: '📡',
      title: 'Data Ingestion',
      desc: 'Raw AWS observations arrive as 10-min interval streams. Per-station rolling buffers (144 steps = 24 hr) maintain temporal context.',
      tags: ['SensorReading', 'StationBuffer', 'deque(144)']
    },
    {
      num: '02',
      icon: '⚙️',
      title: 'Feature Engineering',
      desc: '75+ features: rolling stats (3 windows × 5 stats × 3 params), rate-of-change, frozen detection, Z-scores, Magnus physics, cyclic time encoding.',
      tags: ['75+ features', 'Magnus formula', 'sin/cos time']
    },
    {
      num: '03',
      icon: '🧠',
      title: 'Hybrid Ensemble',
      desc: '4-model weighted fusion: Rule Engine (40%) + IsolationForest (40%) + Statistical Z-score (20%) + optional supervised RF bonus.',
      tags: ['IsolationForest', 'RandomForest', 'Rule Engine']
    },
    {
      num: '04',
      icon: '🚨',
      title: 'Alert + Explanation',
      desc: 'Severity classification (LOW / MEDIUM / HIGH / CRITICAL), SHAP feature contributions, corrected value estimation, recommended maintenance action.',
      tags: ['SHAP', 'Imputation', 'Actions']
    }
  ];

  const featureGroups = [
    {
      icon: '📊',
      name: 'Rolling Statistics',
      count: '30 feats',
      desc: 'Short (1hr), medium (3hr), long (12hr) window mean, std, min, max, range for all 3 parameters.',
      tags: ['s_temp_mean', 'm_pressure_std', 'l_humidity_range']
    },
    {
      icon: '⚡',
      name: 'Rate of Change',
      count: '12 feats',
      desc: 'First and second derivatives: 10-min, 30-min, 1-hr change and acceleration for each parameter.',
      tags: ['temp_roc1', 'pressure_roc6', 'humidity_accel']
    },
    {
      icon: '🧊',
      name: 'Frozen Detection',
      count: '9 feats',
      desc: 'Count of consecutive unchanged values over 1-hr and 3-hr windows, plus unique-value ratio.',
      tags: ['temp_frozen_6', 'humidity_frozen_18', 'unique_ratio']
    },
    {
      icon: '📈',
      name: 'Z-Score Deviation',
      count: '6 feats',
      desc: 'Short and long-window Z-scores per parameter for statistical deviation from seasonal norms.',
      tags: ['temp_zscore', 'pressure_zscore_long', 'humidity_zscore']
    },
    {
      icon: '🌡️',
      name: 'Physics Features',
      count: '8 feats',
      desc: 'Magnus formula vapor pressure, dew-point depression, heat index, and physics inconsistency score.',
      tags: ['vapor_pressure', 'dewpoint_depression', 'physics_inconsistency']
    },
    {
      icon: '🕒',
      name: 'Temporal Encoding',
      count: '6 feats',
      desc: 'Cyclic sin/cos encoding for hour, month, and day-of-week — no discontinuity at day/year boundaries.',
      tags: ['hour_sin', 'month_cos', 'dow_sin']
    }
  ];

  const models = [
    {
      name: 'Rule Engine',
      weight: '40%',
      fillWidth: '40%',
      color: '#e74c3c',
      desc: '12 physics rules. Zero-latency, 100% transparent. Catches out-of-range, spikes, frozen sensors definitively.',
      pro: '✓ No false negatives on OOR',
      con: '✗ Misses subtle drift'
    },
    {
      name: 'Isolation Forest',
      weight: '40%',
      fillWidth: '40%',
      color: '#3498db',
      desc: 'Unsupervised multivariate detector. 200 trees on clean data. Excels at multivariate inconsistencies invisible to univariate checks.',
      pro: '✓ Catches multivariate',
      con: '✗ Higher false positives'
    },
    {
      name: 'Statistical Z-Score',
      weight: '20%',
      fillWidth: '20%',
      color: '#2ecc71',
      desc: 'Rolling 3-hr and 12-hr Z-scores. Lightweight, catches slow calibration drift and seasonal deviations.',
      pro: '✓ Catches slow drift',
      con: '✗ Seasonal blind spots'
    },
    {
      name: 'RandomForest (+)',
      weight: 'Bonus',
      fillWidth: '60%',
      color: '#9b59b6',
      desc: 'Supervised component when labeled data available. 300 trees, balanced class weights. Provides SHAP values for full explainability.',
      pro: '✓ SHAP explainability',
      con: '✗ Needs labeled data'
    }
  ];

  return (
    <div>
      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">System Design</div>
            <h1 className="page-title">How SkyGuard AI Works</h1>
            <p className="page-desc">
              A four-layer pipeline from raw sensor readings to SHAP-explained, severity-classified alerts with corrective imputation.
            </p>
          </div>
          <div className="page-stat">
            <span className="big">75+</span>
            <small>Features Engineered</small>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {/* DETECTION PIPELINE */}
          <h2 className="h2" style={{ marginBottom: '28px' }}>
            Detection Pipeline
          </h2>
          <div className="pipeline">
            {pipelineSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="pip-step fi">
                  <div className="pip-num">{step.num}</div>
                  <div className="pip-icon">{step.icon}</div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                  <div className="pip-tags">
                    {step.tags.map((tag, tIdx) => (
                      <span key={tIdx}>{tag}</span>
                    ))}
                  </div>
                </div>
                {idx < pipelineSteps.length - 1 && <div className="pip-arrow">→</div>}
              </React.Fragment>
            ))}
          </div>

          {/* FEATURE GROUPS */}
          <h2 className="h2" style={{ margin: '52px 0 24px' }}>
            Feature Engineering Groups
          </h2>
          <div className="auto3">
            {featureGroups.map((group, idx) => (
              <div key={idx} className="fg-card fi">
                <div className="fg-hdr">
                  <span className="fg-icon">{group.icon}</span>
                  <strong>{group.name}</strong>
                  <span className="fg-count">{group.count}</span>
                </div>
                <p>{group.desc}</p>
                <div className="fg-tags">
                  {group.tags.map((t, tIdx) => (
                    <span key={tIdx}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* MODEL CARDS */}
          <h2 className="h2" id="models" style={{ margin: '52px 0 24px' }}>
            Ensemble Model Weights
          </h2>
          <div className="grid4">
            {models.map((m, idx) => (
              <div key={idx} className="model-card fi">
                <div className="mc-name">{m.name}</div>
                <div className="mc-weight">{m.weight}</div>
                <div className="prog-bar">
                  <div
                    className="prog-fill"
                    style={{ background: m.color, width: m.fillWidth }}
                  ></div>
                </div>
                <p>{m.desc}</p>
                <div className="mc-pro">{m.pro}</div>
                <div className="mc-con">{m.con}</div>
              </div>
            ))}
          </div>

          {/* FUSION FORMULA */}
          <div className="fusion fi" style={{ marginTop: '40px' }}>
            <h3>Confidence Score Fusion Formula</h3>
            <div className="formula-list">
              <div className="formula-row">
                <span className="f-label">With RF:</span>
                <span className="f-code">
                  confidence = 0.35×rule + 0.30×IF + 0.15×stat + 0.20×RF
                </span>
              </div>
              <div className="formula-row">
                <span className="f-label">Without RF:</span>
                <span className="f-code">
                  confidence = 0.40×rule + 0.40×IF + 0.20×stat
                </span>
              </div>
              <div className="formula-row">
                <span className="f-label">Override:</span>
                <span className="f-code">
                  missing_flag = 1 → confidence = max(score, 0.95)
                </span>
              </div>
            </div>
            <div className="sev-pills">
              <div className="sev-pill">
                <span className="sev-dot" style={{ background: '#e74c3c' }}></span>
                <strong>CRITICAL</strong> ≥ 0.85
              </div>
              <div className="sev-pill">
                <span className="sev-dot" style={{ background: '#e67e22' }}></span>
                <strong>HIGH</strong> ≥ 0.65
              </div>
              <div className="sev-pill">
                <span className="sev-dot" style={{ background: '#f39c12' }}></span>
                <strong>MEDIUM</strong> ≥ 0.45
              </div>
              <div className="sev-pill">
                <span className="sev-dot" style={{ background: '#3498db' }}></span>
                <strong>LOW</strong> ≥ 0.25
              </div>
              <div className="sev-pill">
                <span className="sev-dot" style={{ background: '#2ecc71' }}></span>
                <strong>NORMAL</strong> &lt; 0.25
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
