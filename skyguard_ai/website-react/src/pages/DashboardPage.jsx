import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS, fetchLiveWeatherForStations } from '../data/stations';
import StationMap from '../components/StationMap';

export default function DashboardPage() {
  const { isLight } = useTheme();
  const [selectedStationId, setSelectedStationId] = useState(0);
  const [liveWeather, setLiveWeather] = useState({});
  const [stationStates, setStationStates] = useState({});
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [anomalyLogs, setAnomalyLogs] = useState([
    {
      time: '10:14:20',
      station: 'Tiruchirappalli',
      type: 'SPIKE',
      sev: 'CRITICAL',
      msg: 'Temperature rate-of-change +12.4°C/10min exceeded physics bounds. Corrective cubic spline applied.',
      action: 'Check thermocouple wiring.'
    },
    {
      time: '10:02:10',
      station: 'Salem — Fairlands',
      type: 'DRIFT',
      sev: 'HIGH',
      msg: 'Barometric pressure showing sustained +0.4 hPa/hr drift over 6h window.',
      action: 'Schedule barometric recalibration.'
    }
  ]);

  // Chart refs
  const timeSeriesCanvasRef = useRef(null);
  const timeSeriesChartRef = useRef(null);
  const pieCanvasRef = useRef(null);
  const pieChartRef = useRef(null);

  // Fetch real weather data on mount
  useEffect(() => {
    fetchLiveWeatherForStations().then(data => {
      if (data) setLiveWeather(data);
    });
  }, []);

  // Selected station object
  const currentSt = TN_STATIONS.find(s => s.id === selectedStationId) || TN_STATIONS[0];
  const currentState = stationStates[selectedStationId] || {
    status: 'HEALTHY',
    conf: 0.985,
    temp: currentSt.t,
    pres: currentSt.p,
    hum: currentSt.h,
    activeAnomaly: null,
  };

  // Generate mock time-series when station changes or anomaly injected
  useEffect(() => {
    const points = 20;
    const baseTemp = liveWeather[selectedStationId]?.t ?? currentSt.t;
    const basePres = liveWeather[selectedStationId]?.p ?? currentSt.p;

    const data = Array.from({ length: points }, (_, i) => {
      const timeStr = `${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}`;
      let t = baseTemp + Math.sin(i / 3) * 1.5 + (Math.random() - 0.5) * 0.4;
      let p = basePres + Math.cos(i / 3) * 0.8 + (Math.random() - 0.5) * 0.3;

      if (currentState.activeAnomaly === 'spike' && i === points - 1) {
        t = 72.4;
      } else if (currentState.activeAnomaly === 'oor' && i === points - 1) {
        t = 76.0;
      } else if (currentState.activeAnomaly === 'freeze' && i > points - 6) {
        t = baseTemp;
      }

      return { time: timeStr, temp: +t.toFixed(1), pres: +p.toFixed(1) };
    });

    setTimeSeriesData(data);
  }, [selectedStationId, currentState.activeAnomaly, liveWeather]);

  // Render Time-Series Chart
  useEffect(() => {
    const cv = timeSeriesCanvasRef.current;
    if (!cv || !timeSeriesData.length) return;
    const ctx = cv.getContext('2d');

    if (timeSeriesChartRef.current) {
      timeSeriesChartRef.current.destroy();
    }

    const gridColor = isLight ? '#d0d7de' : '#30363d';
    const textColor = isLight ? '#57606a' : '#8b949e';

    timeSeriesChartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeSeriesData.map(d => d.time),
        datasets: [
          {
            label: 'Temperature (°C)',
            data: timeSeriesData.map(d => d.temp),
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231,76,60,0.08)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'Pressure (hPa)',
            data: timeSeriesData.map(d => d.pres),
            borderColor: '#3498db',
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: textColor, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#161b22',
            titleColor: isLight ? '#1f2328' : '#e6edf3',
            bodyColor: isLight ? '#57606a' : '#8b949e',
            borderColor: gridColor,
            borderWidth: 1,
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10 } }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: gridColor },
            ticks: { color: '#e74c3c', font: { size: 10 }, callback: v => `${v}°C` }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#3498db', font: { size: 10 }, callback: v => `${v} hPa` }
          }
        }
      }
    });

    return () => {
      if (timeSeriesChartRef.current) timeSeriesChartRef.current.destroy();
    };
  }, [timeSeriesData, isLight]);

  // Render Severity Donut Chart
  useEffect(() => {
    const cv = pieCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');

    if (pieChartRef.current) {
      pieChartRef.current.destroy();
    }

    const textColor = isLight ? '#57606a' : '#8b949e';

    pieChartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
        datasets: [
          {
            data: [3, 5, 8, 4],
            backgroundColor: ['#e74c3c', '#e67e22', '#f39c12', '#3498db'],
            borderWidth: 2,
            borderColor: isLight ? '#ffffff' : '#161b22',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { size: 10 }, boxWidth: 12 }
          }
        }
      }
    });

    return () => {
      if (pieChartRef.current) pieChartRef.current.destroy();
    };
  }, [isLight]);

  // Inject Anomaly Handler
  const handleInject = (type) => {
    const now = new Date().toLocaleTimeString();
    let newStatus = 'CRITICAL';
    let msg = '';
    let action = '';

    if (type === 'spike') {
      newStatus = 'CRITICAL';
      msg = `Extreme spike detected on ${currentSt.name}: 72.4°C (+38.2°C jump in 10 min).`;
      action = 'Rate-of-change physics rule triggered. Cross-validating with nearest AWS.';
    } else if (type === 'freeze') {
      newStatus = 'FAULT';
      msg = `Frozen sensor: Consecutive zero variance over past 18 steps on ${currentSt.name}.`;
      action = 'Rolling std < 0.001. Check mechanical sensor transducer.';
    } else if (type === 'drift') {
      newStatus = 'DEGRADED';
      msg = `Calibration drift: Long-term Z-score exceeded 3.2σ on ${currentSt.name}.`;
      action = 'Systematic offset detected. Auto-imputation active.';
    } else if (type === 'oor') {
      newStatus = 'CRITICAL';
      msg = `Hard physics bound violation: 76.0°C exceeds station maximum limit of 60.0°C.`;
      action = 'Immediate station quarantine. Fallback to spatial interpolation.';
    } else {
      // Clear
      newStatus = 'HEALTHY';
      msg = `Station ${currentSt.name} telemetry normalized. All checks green.`;
      action = 'Normal operational stream restored.';
    }

    setStationStates(prev => ({
      ...prev,
      [selectedStationId]: {
        ...prev[selectedStationId],
        status: newStatus,
        activeAnomaly: type === 'clear' ? null : type,
        conf: type === 'clear' ? 0.985 : 0.42
      }
    }));

    setAnomalyLogs(prev => [
      {
        time: now,
        station: currentSt.name,
        type: type.toUpperCase(),
        sev: newStatus,
        msg,
        action
      },
      ...prev.slice(0, 14)
    ]);
  };

  return (
    <div>
      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <h1 className="page-title">Live Anomaly Monitor</h1>
            <p className="page-desc">
              Tamil Nadu AWS network — 20 stations streaming live. Click any marker to select. Enable add-mode and tap the map to place a new station.
            </p>
          </div>
          <div className="live-pill">
            <span className="pulse"></span> STREAMING LIVE
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap">
          {/* STATION SELECTOR PILLS */}
          <div className="st-pill-wrap" style={{ marginBottom: '18px' }}>
            <label>Select Station</label>
            <div className="st-pill-group">
              {TN_STATIONS.map(st => {
                const isSel = st.id === selectedStationId;
                const state = stationStates[st.id] || {};
                const isFault = state.status && state.status !== 'HEALTHY';
                return (
                  <button
                    key={st.id}
                    className={`st-pill-btn ${isSel ? 'active' : ''}`}
                    onClick={() => setSelectedStationId(st.id)}
                  >
                    {isFault ? '⚠️ ' : ''}
                    {st.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LEAFLET MAP COMPONENT */}
          <StationMap
            selectedStationId={selectedStationId}
            onSelectStation={id => typeof id === 'number' && setSelectedStationId(id)}
            stationStates={stationStates}
            liveWeather={liveWeather}
            anomalyEvents={anomalyLogs}
          />

          {/* FAULT INJECTION SIMULATOR CONTROLS */}
          <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '13px', display: 'block' }}>
                  ⚡ Fault Injection Sandbox ({currentSt.short})
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Trigger real-time telemetry faults to test ML ensemble detection, SHAP explainability, and auto-imputation.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="loc-btn danger" onClick={() => handleInject('spike')}>
                  + Spike
                </button>
                <button className="loc-btn" onClick={() => handleInject('freeze')}>
                  + Freeze
                </button>
                <button className="loc-btn" onClick={() => handleInject('drift')}>
                  + Drift
                </button>
                <button className="loc-btn danger" onClick={() => handleInject('oor')}>
                  + Out-of-Range
                </button>
                <button className="loc-btn primary" onClick={() => handleInject('clear')}>
                  ✓ Clear / Reset
                </button>
              </div>
            </div>
          </div>

          {/* STATION HEALTH KPI SUMMARY */}
          <div className="loc-kpi-row">
            <div className={`loc-kpi ${currentState.status !== 'HEALTHY' ? 'alert-kpi' : ''}`}>
              <div className="loc-kpi-val" style={{ color: currentState.status !== 'HEALTHY' ? 'var(--red)' : 'var(--green)' }}>
                {currentState.status}
              </div>
              <div className="loc-kpi-lbl">Current Station Health</div>
            </div>
            <div className="loc-kpi">
              <div className="loc-kpi-val">
                {liveWeather[currentSt.id]?.t ?? currentState.temp}°C
              </div>
              <div className="loc-kpi-lbl">Temperature (2m)</div>
            </div>
            <div className="loc-kpi">
              <div className="loc-kpi-val">
                {liveWeather[currentSt.id]?.p ?? currentState.pres} hPa
              </div>
              <div className="loc-kpi-lbl">Atmospheric Pressure</div>
            </div>
            <div className="loc-kpi">
              <div className="loc-kpi-val" style={{ color: 'var(--blue)' }}>
                {(currentState.conf * 100).toFixed(1)}%
              </div>
              <div className="loc-kpi-lbl">ML Confidence Score</div>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div className="an-chart-grid" style={{ marginBottom: '24px' }}>
            <div className="an-chart-card">
              <div className="an-chart-hdr">
                <span className="an-chart-title">Real-Time Sensor Telemetry Stream — {currentSt.name}</span>
                <span className="an-chart-badge badge-temp">Dual Axis</span>
              </div>
              <div style={{ height: '260px', position: 'relative' }}>
                <canvas ref={timeSeriesCanvasRef}></canvas>
              </div>
            </div>
            <div className="an-chart-card">
              <div className="an-chart-hdr">
                <span className="an-chart-title">Anomaly Severity Distribution (Held-Out)</span>
                <span className="an-chart-badge badge-anom">Multi-Station</span>
              </div>
              <div style={{ height: '260px', position: 'relative' }}>
                <canvas ref={pieCanvasRef}></canvas>
              </div>
            </div>
          </div>

          {/* REAL-TIME ANOMALY LOGS */}
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚨</span> Live Detection & Corrective Imputation Log
            </h3>
            <div className="loc-alert-feed">
              {anomalyLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`loc-alert-item ${
                    log.sev === 'CRITICAL' ? 'critical' : log.sev === 'FAULT' || log.sev === 'HIGH' ? 'high' : 'safe'
                  }`}
                >
                  <span className={`loc-alert-sev ${log.sev}`}>{log.sev}</span>
                  <div className="loc-alert-text">
                    <strong>
                      [{log.time}] {log.station} — {log.type}
                    </strong>
                    <span>{log.msg}</span>
                    <small style={{ display: 'block', color: 'var(--accent)', marginTop: '4px' }}>
                      Recommended Action: {log.action}
                    </small>
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
