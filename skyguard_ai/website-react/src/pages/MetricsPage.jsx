import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';
import {
  METRICS_KPIS,
  RADAR_DATA,
  BAR_COMPARISON_DATA,
  DETAILED_SCORES,
  PER_TYPE_DETECTION,
  EVALUATION_CRITERIA,
  TEST_SUITE
} from '../data/metricsData';

export default function MetricsPage({ embed = false }) {
  const { isLight } = useTheme();
  const radarCanvasRef = useRef(null);
  const radarChartRef = useRef(null);
  const barCanvasRef = useRef(null);
  const barChartRef = useRef(null);

  useEffect(() => {
    const gridColor = isLight ? '#d0d7de' : 'rgba(48,54,61,.8)';
    const textColor = isLight ? '#57606a' : '#8b949e';

    // Radar Chart
    if (radarCanvasRef.current) {
      const ctx = radarCanvasRef.current.getContext('2d');
      if (radarChartRef.current) radarChartRef.current.destroy();

      radarChartRef.current = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: RADAR_DATA.labels,
          datasets: [
            {
              label: 'SkyGuard AI',
              data: RADAR_DATA.skyguard,
              backgroundColor: 'rgba(88,166,255,.14)',
              borderColor: '#0969da',
              borderWidth: 2,
              pointBackgroundColor: '#0969da',
              pointRadius: 4,
            },
            {
              label: 'Threshold Baseline',
              data: RADAR_DATA.baseline,
              backgroundColor: 'rgba(230,126,34,.08)',
              borderColor: '#e67e22',
              borderWidth: 1.5,
              pointBackgroundColor: '#e67e22',
              pointRadius: 3,
              borderDash: [4, 4],
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 11 }, padding: 14, color: textColor }
            }
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { display: false },
              grid: { color: gridColor },
              angleLines: { color: gridColor },
              pointLabels: { font: { size: 10 }, color: textColor }
            }
          }
        }
      });
    }

    // Bar Chart
    if (barCanvasRef.current) {
      const ctx = barCanvasRef.current.getContext('2d');
      if (barChartRef.current) barChartRef.current.destroy();

      barChartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: BAR_COMPARISON_DATA.labels,
          datasets: [
            {
              label: 'SkyGuard AI',
              data: BAR_COMPARISON_DATA.skyguard,
              backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#9b59b6', '#f39c12'],
              borderRadius: 6,
              borderSkipped: false,
            },
            {
              label: 'Threshold Baseline',
              data: BAR_COMPARISON_DATA.baseline,
              backgroundColor: isLight ? 'rgba(139,148,158,.3)' : 'rgba(139,148,158,.22)',
              borderRadius: 6,
              borderSkipped: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 11 }, padding: 14, color: textColor }
            },
            tooltip: {
              callbacks: {
                label: c => ` ${c.dataset.label}: ${c.parsed.y}%`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: textColor }
            },
            y: {
              min: 0,
              max: 110,
              grid: { color: gridColor },
              ticks: { callback: v => `${v}%`, font: { size: 11 }, color: textColor }
            }
          }
        }
      });
    }

    return () => {
      if (radarChartRef.current) radarChartRef.current.destroy();
      if (barChartRef.current) barChartRef.current.destroy();
    };
  }, [isLight]);

  return (
    <div>
      {/* PAGE HERO (hidden when embedded in the Insights page) */}
      {!embed && (
        <div className="page-hero">
          <div className="wrap page-hero-row">
            <div>
              <div className="label">Evaluation Results</div>
              <h1 className="page-title">Performance Metrics</h1>
              <p className="page-desc">
                Benchmarked on a 30-day held-out test set with 4% injected anomaly contamination. 30 / 30 unit tests passing.
              </p>
            </div>
            <div className="page-stat">
              <span className="big">98%</span>
              <small>ROC-AUC Score</small>
            </div>
          </div>
        </div>
      )}

      <div className="page-body">
        <div className="wrap">
          {/* BIG KPIS */}
          <div className="metrics-kpis" style={{ marginBottom: '32px' }}>
            {METRICS_KPIS.map((kpi, idx) => (
              <div key={idx} className="mkpi fi">
                <div className="mkpi-val" style={{ color: kpi.color }}>
                  {kpi.val}
                </div>
                <div className="mkpi-lbl">{kpi.lbl}</div>
                <div className="mkpi-sub">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* RADAR + BAR COMPARISON */}
          <div className="grid2" style={{ marginBottom: '36px' }}>
            <div className="chart-card fi">
              <div className="chart-hdr">
                <span>SkyGuard AI vs Threshold Baseline — Radar</span>
              </div>
              <div style={{ height: '340px', position: 'relative' }}>
                <canvas ref={radarCanvasRef}></canvas>
              </div>
            </div>
            <div className="chart-card fi">
              <div className="chart-hdr">
                <span>Detection Metrics — Bar Comparison</span>
              </div>
              <div style={{ height: '340px', position: 'relative' }}>
                <canvas ref={barCanvasRef}></canvas>
              </div>
            </div>
          </div>

          {/* DETAILED SCORE BARS */}
          <div className="m-bar-section fi" style={{ marginBottom: '36px' }}>
            <h3>Detailed Score Breakdown</h3>
            {DETAILED_SCORES.map((s, idx) => (
              <div key={idx} className="mrow">
                <span className="m-name">{s.name}</span>
                <div className="m-bar-wrap">
                  <div className="m-bar">
                    <div
                      className="m-fill"
                      style={{ background: s.color, width: `${s.val}%` }}
                    ></div>
                  </div>
                </div>
                <span className="m-val">{s.val}%</span>
              </div>
            ))}
          </div>

          {/* PER TYPE DETECTION TABLE */}
          <div className="tbl-wrap fi" style={{ marginBottom: '40px' }}>
            <h3>Per-Anomaly-Type Detection Rate</h3>
            <div className="tbl-scroll">
              <table className="stbl">
                <thead>
                  <tr>
                    <th>Anomaly Type</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>Avg Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {PER_TYPE_DETECTION.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`abadge ${row.badge}`}>{row.type}</span>
                      </td>
                      <td className="tg">{row.prec}</td>
                      <td className="tg">{row.rec}</td>
                      <td className="tg">{row.f1}</td>
                      <td>{row.conf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOES EVALUATION CRITERIA */}
          <h2 className="h2" style={{ margin: '52px 0 20px' }}>
            MoES Evaluation Criteria — SkyGuard Scores
          </h2>
          <div className="criteria-grid" style={{ marginBottom: '40px' }}>
            {EVALUATION_CRITERIA.map((crit, idx) => (
              <div key={idx} className="crit-card fi">
                <div className="crit-wt">{crit.wt}</div>
                <div className="crit-name">{crit.name}</div>
                <div className="crit-desc">{crit.desc}</div>
                <span className={`crit-score ${crit.scoreClass}`}>
                  {crit.score}
                </span>
              </div>
            ))}
          </div>

          {/* TEST RESULTS */}
          <div className="m-bar-section fi">
            <h3>Automated Test Suite — 30 / 30 Passing</h3>
            <div
              style={{
                marginTop: '18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px'
              }}
            >
              {TEST_SUITE.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--surface2)',
                    borderRadius: '8px',
                    padding: '14px'
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'var(--green)',
                      marginBottom: '8px'
                    }}
                  >
                    ✅ {t.title}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--muted)',
                      lineHeight: '1.8'
                    }}
                  >
                    {t.items}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
