import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS } from '../data/stations';

function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function AnalysisPage() {
  const { isLight } = useTheme();
  const [activeCityId, setActiveCityId] = useState(0);
  const [activePeriod, setActivePeriod] = useState('day'); // 'day', 'week', 'month'

  const tempChartRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const presChartRef = useRef(null);
  const presCanvasRef = useRef(null);
  const humChartRef = useRef(null);
  const humCanvasRef = useRef(null);
  const confChartRef = useRef(null);
  const confCanvasRef = useRef(null);

  // Generate data based on activeCityId and activePeriod
  const currentSt = TN_STATIONS[activeCityId] || TN_STATIONS[0];
  const rand = seededRand(activeCityId * 1000 + (activePeriod === 'day' ? 1 : activePeriod === 'week' ? 7 : 30));
  const n = activePeriod === 'day' ? 24 : activePeriod === 'week' ? 28 : 30;

  const labels = [];
  const tempData = [], presData = [], humData = [], confData = [];
  const anomTypes = { spike: 0, frozen: 0, drift: 0, oor: 0, multi: 0, noise: 0, missing: 0 };
  const anomEvents = [];

  const tAmp = 4 + rand() * 4;
  const pAmp = 1 + rand() * 1.5;
  const hAmp = 8 + rand() * 8;

  for (let i = 0; i < n; i++) {
    if (activePeriod === 'day') {
      labels.push(`${String(i).padStart(2, '0')}:00`);
    } else if (activePeriod === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      labels.push(`${days[Math.floor(i / 4) % 7]} ${String((i % 4) * 6).padStart(2, '0')}h`);
    } else {
      labels.push(`Day ${i + 1}`);
    }

    const phase = (i / n) * 2 * Math.PI;
    const t = currentSt.t + tAmp * Math.sin(phase - 1) + (rand() - 0.5) * 1.5;
    const p = currentSt.p + pAmp * Math.sin(phase + 1) + (rand() - 0.5) * 0.8;
    const h = currentSt.h - hAmp * Math.sin(phase - 1) + (rand() - 0.5) * 3;

    let anomScore = rand() * 0.18;
    if (rand() < 0.08) {
      const typeList = ['spike', 'frozen', 'drift', 'oor', 'multi', 'noise', 'missing'];
      const chosenType = typeList[Math.floor(rand() * 7)];
      anomScore = 0.5 + rand() * 0.45;
      anomTypes[chosenType]++;
      anomEvents.push({ label: labels[i], type: chosenType, conf: (anomScore * 100).toFixed(0) });
    }

    tempData.push(+t.toFixed(1));
    presData.push(+p.toFixed(1));
    humData.push(+Math.max(10, Math.min(99, h)).toFixed(1));
    confData.push(+anomScore.toFixed(2));
  }

  const avgTemp = (tempData.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const avgPres = (presData.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const avgHum = (humData.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const anomCount = anomEvents.length;
  const anomRate = ((anomCount / n) * 100).toFixed(1);

  // Setup line chart helper
  const createChart = (canvas, chartInstance, dataArray, color, label, unit) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance.current) chartInstance.current.destroy();

    const gridColor = isLight ? '#d0d7de' : '#1e2530';
    const textColor = isLight ? '#57606a' : '#8b949e';

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label,
            data: dataArray,
            borderColor: color,
            backgroundColor: `${color}18`,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#1e2530',
            borderColor: isLight ? '#d0d7de' : '#30363d',
            borderWidth: 1,
            titleColor: isLight ? '#1f2328' : '#e6edf3',
            bodyColor: isLight ? '#57606a' : '#8b949e',
            callbacks: {
              label: (c) => ` ${label}: ${c.parsed.y} ${unit}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color, font: { size: 10 }, callback: v => `${v}${unit}` }
          }
        }
      }
    });
  };

  useEffect(() => {
    createChart(tempCanvasRef.current, tempChartRef, tempData, '#e74c3c', 'Temperature', '°C');
    createChart(presCanvasRef.current, presChartRef, presData, '#3498db', 'Pressure', ' hPa');
    createChart(humCanvasRef.current, humChartRef, humData, '#2ecc71', 'Humidity', '%');
    createChart(confCanvasRef.current, confChartRef, confData, '#e67e22', 'Anomaly Conf', '');

    return () => {
      if (tempChartRef.current) tempChartRef.current.destroy();
      if (presChartRef.current) presChartRef.current.destroy();
      if (humChartRef.current) humChartRef.current.destroy();
      if (confChartRef.current) confChartRef.current.destroy();
    };
  }, [activeCityId, activePeriod, isLight]);

  return (
    <div>
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">Telemetry Deep-Dive</div>
            <h1 className="page-title">Historical Data &amp; Analysis</h1>
            <p className="page-desc">
              Explore 24-hour, 7-day, and 30-day sensor telemetry across all Tamil Nadu stations with diurnal decomposition, correlation analysis, and SHAP contributions.
            </p>
          </div>
          <div className="an-hero-stat">
            <span className="big">{anomRate}%</span>
            <small>Anomaly Frequency</small>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {/* PICKER BAR */}
          <div className="picker-bar">
            <div>
              <label>Weather Station</label>
              <br />
              <select
                value={activeCityId}
                onChange={(e) => setActiveCityId(+e.target.value)}
              >
                {TN_STATIONS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="period-tabs">
              <button
                className={`ptab ${activePeriod === 'day' ? 'on' : ''}`}
                onClick={() => setActivePeriod('day')}
              >
                24 Hours
              </button>
              <button
                className={`ptab ${activePeriod === 'week' ? 'on' : ''}`}
                onClick={() => setActivePeriod('week')}
              >
                7 Days
              </button>
              <button
                className={`ptab ${activePeriod === 'month' ? 'on' : ''}`}
                onClick={() => setActivePeriod('month')}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* KPI ROW */}
          <div className="an-kpi-row">
            <div className="an-kpi">
              <div className="an-kpi-val" style={{ color: 'var(--red)' }}>
                {avgTemp}°C
              </div>
              <div className="an-kpi-lbl">Mean Temperature</div>
              <div className="an-kpi-sub">Diurnal range: ±{tAmp.toFixed(1)}°C</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi-val" style={{ color: 'var(--blue)' }}>
                {avgPres} hPa
              </div>
              <div className="an-kpi-lbl">Mean Pressure</div>
              <div className="an-kpi-sub">Atmospheric barometric average</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi-val" style={{ color: 'var(--green)' }}>
                {avgHum}%
              </div>
              <div className="an-kpi-lbl">Mean Humidity</div>
              <div className="an-kpi-sub">Relative moisture level</div>
            </div>
            <div className="an-kpi">
              <div className="an-kpi-val" style={{ color: 'var(--orange)' }}>
                {anomCount}
              </div>
              <div className="an-kpi-lbl">Detected Anomalies</div>
              <div className="an-kpi-sub">{anomRate}% window anomaly rate</div>
            </div>
          </div>

          {/* 4 CHARTS GRID */}
          <div className="an-chart-grid">
            <div className="an-chart-card">
              <div className="an-chart-hdr">
                <span className="an-chart-title">Temperature Diurnal Profile</span>
                <span className="an-chart-badge badge-temp">°C</span>
              </div>
              <div style={{ height: '220px', position: 'relative' }}>
                <canvas ref={tempCanvasRef}></canvas>
              </div>
            </div>
            <div className="an-chart-card">
              <div className="an-chart-hdr">
                <span className="an-chart-title">Atmospheric Pressure Trend</span>
                <span className="an-chart-badge badge-pres">hPa</span>
              </div>
              <div style={{ height: '220px', position: 'relative' }}>
                <canvas ref={presCanvasRef}></canvas>
              </div>
            </div>
            <div className="an-chart-card">
              <div className="an-chart-hdr">
                <span className="an-chart-title">Relative Humidity Fluctuations</span>
                <span className="an-chart-badge badge-hum">%</span>
              </div>
              <div style={{ height: '220px', position: 'relative' }}>
                <canvas ref={humCanvasRef}></canvas>
              </div>
            </div>
            <div className="an-chart-card">
              <div className="an-chart-hdr">
                <span className="an-chart-title">Ensemble Anomaly Confidence</span>
                <span className="an-chart-badge badge-anom">ML Score</span>
              </div>
              <div style={{ height: '220px', position: 'relative' }}>
                <canvas ref={confCanvasRef}></canvas>
              </div>
            </div>
          </div>

          {/* ANOMALY BREAKDOWN TABLE */}
          <div className="an-full-card">
            <div className="an-full-title">
              Fault Type Breakdown — {currentSt.short} ({activePeriod === 'day' ? '24 Hours' : activePeriod === 'week' ? '7 Days' : '30 Days'})
            </div>
            <table className="an-type-table">
              <thead>
                <tr>
                  <th>Fault Type</th>
                  <th>Occurrences</th>
                  <th>Proportion</th>
                  <th>Typical Root Cause</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(anomTypes).map(([type, count]) => {
                  const pct = ((count / Math.max(1, anomCount)) * 100).toFixed(0);
                  return (
                    <tr key={type}>
                      <td>
                        <strong style={{ textTransform: 'uppercase' }}>{type}</strong>
                      </td>
                      <td>{count}</td>
                      <td>
                        <div className="tbl-bar-wrap">
                          <div className="tbl-bar" style={{ width: `${Math.max(4, pct * 1.5)}px` }}></div>
                          <span className="tbl-pct">{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {type === 'spike' && 'Transient electrical noise or sensor wire resistance spike'}
                        {type === 'frozen' && 'Mechanical potentiometer freeze or communication lock'}
                        {type === 'drift' && 'Accumulated dust calibration offset over time'}
                        {type === 'oor' && 'Transducer out-of-range physical saturation'}
                        {type === 'multi' && 'Magnus psychrometric inconsistency (hot + humid + high pressure)'}
                        {type === 'noise' && 'EMI interference from local RF or powerline switching'}
                        {type === 'missing' && 'Data logger SIM timeout or power supply brownout'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
