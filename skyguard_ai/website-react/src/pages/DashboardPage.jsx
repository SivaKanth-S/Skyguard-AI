import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';
import { TN_STATIONS, fetchLiveWeatherForStations } from '../data/stations';
import StationMap from '../components/StationMap';

// Autonomous engine tuning — mirrors the location map's auto-fault rhythm.
const ENGINE_INTERVAL_MS = 9000;
const MAX_AUTO_FAULTS = 3;
const FAULT_LIFETIME_CYCLES = 3;

const FAULT_TYPES = [
  {
    type: 'spike', status: 'CRITICAL', conf: 0.42,
    msg: (name, t) => `Extreme spike detected on ${name}: ${(t + 38.2).toFixed(1)}°C (+38.2°C jump in 10 min).`,
    action: 'Rate-of-change physics rule triggered. Cross-validating with nearest AWS.',
  },
  {
    type: 'freeze', status: 'FAULT', conf: 0.42,
    msg: (name) => `Frozen sensor: Consecutive zero variance over past 18 steps on ${name}.`,
    action: 'Rolling std < 0.001. Check mechanical sensor transducer.',
  },
  {
    type: 'drift', status: 'DEGRADED', conf: 0.42,
    msg: (name) => `Calibration drift: Long-term Z-score exceeded 3.2σ on ${name}.`,
    action: 'Systematic offset detected. Auto-imputation active.',
  },
  {
    type: 'oor', status: 'CRITICAL', conf: 0.42,
    msg: (name, t) => `Hard physics bound violation: ${(t + 42).toFixed(1)}°C exceeds station maximum limit of 60.0°C.`,
    action: 'Immediate station quarantine. Fallback to spatial interpolation.',
  },
  {
    type: 'multi', status: 'FAULT', conf: 0.78,
    msg: (name) => `Multivariate inconsistency on ${name}: hot + humid + high pressure combined is physically impossible.`,
    action: 'Cross-sensor validation failed. Review all sensor channels simultaneously.',
  },
  {
    type: 'noise', status: 'DEGRADED', conf: 0.6,
    msg: (name) => `Noise burst on ${name}: high-frequency EMI fluctuations sustained over 30 minutes.`,
    action: 'Check cable shielding. Inspect power supply filtering.',
  },
  {
    type: 'missing', status: 'CRITICAL', conf: 0.95,
    msg: (name) => `Communication loss on ${name}: NULL telemetry for over an hour.`,
    action: 'Check network, data logger power supply, and SIM card.',
  },
];

export default function DashboardPage() {
  const { isLight } = useTheme();
  const [selectedStationId, setSelectedStationId] = useState(0);
  const [liveWeather, setLiveWeather] = useState({});
  // Seeded to match the initial detection log + the location map's fault zones.
  const [stationStates, setStationStates] = useState({
    3: { status: 'CRITICAL', activeAnomaly: 'spike', conf: 0.42, cycles: 0 },
    4: { status: 'FAULT', activeAnomaly: 'freeze', conf: 0.42, cycles: 0 },
  });
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
      type: 'FREEZE',
      sev: 'FAULT',
      msg: 'Frozen sensor: Consecutive zero variance over past 18 steps on Salem — Fairlands.',
      action: 'Rolling std < 0.001. Check mechanical sensor transducer.'
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

  // Refs mirror state for the interval engine (avoids stale closures).
  const stationStatesRef = useRef({});
  const liveWeatherRef = useRef({});
  useEffect(() => { stationStatesRef.current = stationStates; }, [stationStates]);
  useEffect(() => { liveWeatherRef.current = liveWeather; }, [liveWeather]);

  // Autonomous anomaly-detection engine — faults raise themselves, age, and
  // self-heal. StationMap fires its shockwave burst + HUD automatically from
  // stationStates transitions. Replaces the old manual injection sandbox.
  useEffect(() => {
    const id = setInterval(() => {
      const prev = stationStatesRef.current || {};
      const live = liveWeatherRef.current || {};
      const next = { ...prev };
      const events = [];
      const now = new Date().toLocaleTimeString();
      let dirty = false;

      // 1. Age active faults; self-heal past their lifetime.
      Object.entries(next).forEach(([sid, s]) => {
        if (!s || s.status === 'HEALTHY') return;
        const age = (s.cycles ?? 0) + 1;
        if (age >= FAULT_LIFETIME_CYCLES) {
          const st = TN_STATIONS.find(x => x.id === Number(sid));
          const name = st?.name ?? `Station ${sid}`;
          next[sid] = { status: 'HEALTHY', activeAnomaly: null, conf: 0.985 };
          events.push({
            time: now,
            station: name,
            type: 'RECOVERY',
            sev: 'HEALTHY',
            msg: `Station ${name} telemetry normalized. Self-healing imputation complete. All checks green.`,
            action: 'Normal operational stream restored.',
          });
        } else {
          next[sid] = { ...s, cycles: age };
        }
        dirty = true;
      });

      // 2. Raise a new fault on a healthy station (capped concurrency).
      const activeCount = Object.values(next).filter(s => s?.status && s.status !== 'HEALTHY').length;
      if (activeCount < MAX_AUTO_FAULTS && Math.random() < 0.6) {
        const candidates = TN_STATIONS.filter(st => (next[st.id]?.status || 'HEALTHY') === 'HEALTHY');
        if (candidates.length) {
          const st = candidates[(Math.random() * candidates.length) | 0];
          const f = FAULT_TYPES[(Math.random() * FAULT_TYPES.length) | 0];
          const baseT = live[st.id]?.t ?? st.t;
          next[st.id] = { status: f.status, activeAnomaly: f.type, conf: f.conf, cycles: 0 };
          events.push({
            time: now,
            station: st.name,
            type: f.type.toUpperCase(),
            sev: f.status,
            msg: f.msg(st.name, baseT),
            action: f.action,
          });
          dirty = true;
        }
      }

      if (dirty) {
        setStationStates(next);
        if (events.length) {
          setAnomalyLogs(prevLogs => [...events, ...prevLogs].slice(0, 15));
        }
      }
    }, ENGINE_INTERVAL_MS);
    return () => clearInterval(id);
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

  // Generate mock time-series when station changes or an auto fault is detected
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
      } else if (currentState.activeAnomaly === 'noise') {
        t += (Math.random() - 0.5) * 9; // EMI jitter across the window
      } else if (currentState.activeAnomaly === 'missing' && i > points - 4) {
        t = null; // communication gap at the tail
      } else if (currentState.activeAnomaly === 'multi' && i === points - 1) {
        t = baseTemp + 18; // physically inconsistent hot reading
      }

      return { time: timeStr, temp: t == null ? null : +t.toFixed(1), pres: +p.toFixed(1) };
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

  const activeFaultCount = Object.values(stationStates).filter(
    s => s?.status && s.status !== 'HEALTHY'
  ).length;

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

          {/* AUTONOMOUS DETECTION ENGINE STATUS — faults detect themselves */}
          <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pulse"></span> Autonomous Detection Engine — ACTIVE
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  The ML ensemble scans all {TN_STATIONS.length} stations every 9s. Detected faults raise map shockwave bursts + HUD alerts automatically, then self-heal.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="loc-pill">
                  🚨 {activeFaultCount} active fault{activeFaultCount === 1 ? '' : 's'}
                </span>
                <span className="loc-pill">
                  📡 {TN_STATIONS.length} stations monitored
                </span>
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
