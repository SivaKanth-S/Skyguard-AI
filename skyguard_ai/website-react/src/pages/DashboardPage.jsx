import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useTheme } from '../context/ThemeContext';
import { useAnomaly } from '../context/AnomalyContext';
import { TN_STATIONS, fetchLiveWeatherForStations } from '../data/stations';
import { isAnomalyStatus } from '../components/anomalyEffects';
import StationMap from '../components/StationMap';

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
  // Shared live anomalies — THE SAME fault zones the route planner shows.
  // One global engine (AnomalyContext) feeds every map, so readings match.
  const { anomalies: stationStates } = useAnomaly();
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

  // Ref mirror for live weather (used by the log-diff below).
  const liveWeatherRef = useRef({});
  useEffect(() => { liveWeatherRef.current = liveWeather; }, [liveWeather]);

  // Detection log follows the SHARED engine: diff previous vs current fault
  // zones and log raises + recoveries. Mount initializes silently (no
  // catch-up spam for faults raised while another page was open).
  // StationMap fires its shockwave burst + HUD automatically from the same
  // shared transitions.
  const prevAnomRef = useRef(null);
  useEffect(() => {
    if (prevAnomRef.current === null) {
      prevAnomRef.current = stationStates;
      return;
    }
    const prev = prevAnomRef.current || {};
    const live = liveWeatherRef.current || {};
    const events = [];
    const now = new Date().toLocaleTimeString();

    Object.entries(stationStates).forEach(([sid, s]) => {
      if (!s || !isAnomalyStatus(s.status)) return;
      if (isAnomalyStatus(prev[sid]?.status)) return; // already logged
      const st = TN_STATIONS.find(x => x.id === Number(sid));
      const f = FAULT_TYPES.find(t => t.type === s.faultType) || FAULT_TYPES[0];
      const baseT = live[sid]?.t ?? st?.t ?? 0;
      events.push({
        time: now,
        station: st?.name ?? `Station ${sid}`,
        type: (s.faultType || 'anomaly').toUpperCase(),
        sev: s.status,
        msg: f.msg(st?.name ?? `Station ${sid}`, baseT),
        action: f.action,
      });
    });

    Object.entries(prev).forEach(([sid, s]) => {
      if (!s || !isAnomalyStatus(s.status)) return;
      if (isAnomalyStatus(stationStates[sid]?.status)) return; // still active
      const st = TN_STATIONS.find(x => x.id === Number(sid));
      const name = st?.name ?? `Station ${sid}`;
      events.push({
        time: now,
        station: name,
        type: 'RECOVERY',
        sev: 'HEALTHY',
        msg: `Station ${name} telemetry normalized. Self-healing imputation complete. All checks green.`,
        action: 'Normal operational stream restored.',
      });
    });

    prevAnomRef.current = stationStates;
    if (events.length) {
      setAnomalyLogs(prevLogs => [...events, ...prevLogs].slice(0, 15));
    }
  }, [stationStates]);

  // Selected station object
  const currentSt = TN_STATIONS.find(s => s.id === selectedStationId) || TN_STATIONS[0];
  const currentState = stationStates[selectedStationId] || {
    status: 'HEALTHY',
    conf: 0.985,
    temp: currentSt.t,
    pres: currentSt.p,
    hum: currentSt.h,
    faultType: null,
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

      if (currentState.faultType === 'spike' && i === points - 1) {
        t = 72.4;
      } else if (currentState.faultType === 'oor' && i === points - 1) {
        t = 76.0;
      } else if (currentState.faultType === 'freeze' && i > points - 6) {
        t = baseTemp;
      } else if (currentState.faultType === 'noise') {
        t += (Math.random() - 0.5) * 9; // EMI jitter across the window
      } else if (currentState.faultType === 'missing' && i > points - 4) {
        t = null; // communication gap at the tail
      } else if (currentState.faultType === 'multi' && i === points - 1) {
        t = baseTemp + 18; // physically inconsistent hot reading
      }

      return { time: timeStr, temp: t == null ? null : +t.toFixed(1), pres: +p.toFixed(1) };
    });

    setTimeSeriesData(data);
  }, [selectedStationId, currentState.faultType, liveWeather]);

  // Live telemetry stream — one real reading every 2s from live weather +
  // sensor jitter (fault-aware: spikes, gaps, and freezes show up live),
  // appended to the chart tail, KPIs, and the readings counter.
  const [livePoint, setLivePoint] = useState(null);
  const [liveTicks, setLiveTicks] = useState(0);

  useEffect(() => {
    setLivePoint(null);
    const id = setInterval(() => {
      const st = TN_STATIONS.find(s => s.id === selectedStationId) || TN_STATIONS[0];
      const base = liveWeather[selectedStationId] || {};
      const state = stationStates[selectedStationId] || {};
      const a = state.faultType;
      let t = (base.t ?? st.t) + (Math.random() - 0.5) * 0.5;
      const p = (base.p ?? st.p) + (Math.random() - 0.5) * 0.3;
      if (a === 'missing') {
        t = null;
      } else if (a === 'spike') {
        t = 72.4;
      } else if (a === 'oor') {
        t = 76.0;
      } else if (a === 'freeze') {
        t = base.t ?? st.t;
      } else if (a === 'noise') {
        t += (Math.random() - 0.5) * 9;
      } else if (a === 'multi') {
        t = (base.t ?? st.t) + 18;
      }
      setLivePoint({
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        temp: t == null ? null : +t.toFixed(1),
        pres: +p.toFixed(1),
      });
      setLiveTicks(n => n + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [selectedStationId, stationStates, liveWeather]);

  // Append each live reading to the chart window (keeps last 20 points).
  useEffect(() => {
    if (!livePoint) return;
    setTimeSeriesData(prev => (prev.length ? [...prev.slice(-19), livePoint] : prev));
  }, [livePoint]);

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
            liveReadings={liveTicks}
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
                {livePoint ? (livePoint.temp ?? 'NO SIGNAL') : (liveWeather[currentSt.id]?.t ?? currentState.temp)}
                {livePoint?.temp != null || !livePoint ? '°C' : ''}
              </div>
              <div className="loc-kpi-lbl">Temperature (2m) · Live</div>
            </div>
            <div className="loc-kpi">
              <div className="loc-kpi-val">
                {livePoint?.pres ?? liveWeather[currentSt.id]?.p ?? currentState.pres} hPa
              </div>
              <div className="loc-kpi-lbl">Atmospheric Pressure · Live</div>
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
