import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNotify } from './NotifyContext';
import { useAnomaly } from './AnomalyContext';
import { TN_STATIONS } from '../data/stations';
import {
  analyzeRouteAnomalies,
  closestPointOnRoute,
  haversineKm,
  sampleAlongRoute,
} from '../lib/geo';
import { faultMeta } from '../components/anomalyEffects';
import { ensureNotifyPermission, notifyPermission } from '../lib/notify';

// ── Persistent route planner ─────────────────────────────────────────────
// Once the user opens the planner, its state lives HERE (app lifetime) and
// in sessionStorage (survives reloads until the program/tab is closed).
// Navigating to other pages unmounts the Leaflet map view only — the route,
// inputs, alerts and live GPS tracking keep running in the background and
// the planner resumes exactly where it left off (never restarts from start).

const SESSION_KEY = 'skyguard_route_planner_v1';

function loadSnapshot() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return s;
  } catch {
    return null;
  }
}

function saveSnapshot(snap) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap));
  } catch {
    /* storage full / unavailable — in-memory state still persists */
  }
}

const RoutePlannerContext = createContext(null);

const EMPTY_ANALYSIS = { warnings: [], advisories: [], exposedKm: 0, risk: 'CLEAR' };
const KIND_SEV = {
  info: 'info',
  success: 'success',
  advisory: 'warning',
  medium: 'warning',
  high: 'warning',
  critical: 'critical',
};

export function RoutePlannerProvider({ children }) {
  const { notify: siteNotify } = useNotify();

  // Lazy init from sessionStorage so a reload / remount resumes instantly.
  const initial = useRef(null);
  if (initial.current === null) initial.current = loadSnapshot() || {};

  const [startText, setStartText] = useState(initial.current.startText || '');
  const [endText, setEndText] = useState(initial.current.endText || '');
  const [start, setStart] = useState(initial.current.start || null);
  const [end, setEnd] = useState(initial.current.end || null);
  const [mapOpened, setMapOpened] = useState(!!initial.current.mapOpened);
  const [route, setRoute] = useState(initial.current.route || null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [alerts, setAlerts] = useState(
    Array.isArray(initial.current.alerts) ? initial.current.alerts : [],
  );
  const [progressKm, setProgressKm] = useState(initial.current.progressKm || 0);
  const [arrived, setArrived] = useState(!!initial.current.arrived);
  const [offRoute, setOffRoute] = useState(!!initial.current.offRoute);
  const [tracking, setTracking] = useState(!!initial.current.tracking);
  const [gps, setGps] = useState(null); // live fix is transient — not persisted
  const [gpsError, setGpsError] = useState('');
  const [notifyOn, setNotifyOn] = useState(
    initial.current.notifyOn !== undefined ? !!initial.current.notifyOn : true,
  );
  const [follow, setFollow] = useState(
    initial.current.follow !== undefined ? !!initial.current.follow : true,
  );
  const [stepsOpen, setStepsOpen] = useState(false);
  const [activeTileKey, setActiveTileKey] = useState(initial.current.activeTileKey || null);

  // Shared live anomalies — THE SAME fault zones the dashboard shows.
  // One global engine (AnomalyContext) feeds every map, so readings match.
  const { anomalies: faults, anomaliesRef: faultsRef } = useAnomaly();

  const watchId = useRef(null);
  const alertedRef = useRef(new Set());
  const firstFix = useRef(true);
  const followRef = useRef(follow);
  const notifyRef = useRef(notifyOn);
  const siteNotifyRef = useRef(siteNotify);
  useEffect(() => { followRef.current = follow; }, [follow]);
  useEffect(() => { notifyRef.current = notifyOn; }, [notifyOn]);
  useEffect(() => { siteNotifyRef.current = siteNotify; }, [siteNotify]);

  // Keep refs in sync for background evaluation after a reload-remount.
  const routeRef = useRef(route);
  const endRef = useRef(end);
  const analysisRef = useRef(EMPTY_ANALYSIS);
  useEffect(() => { routeRef.current = route; }, [route]);
  useEffect(() => { endRef.current = end; }, [end]);

  const analysis = useMemo(() => {
    if (!route) return EMPTY_ANALYSIS;
    try {
      return analyzeRouteAnomalies(sampleAlongRoute(route.coords, 2), faults);
    } catch {
      return EMPTY_ANALYSIS;
    }
  }, [route, faults]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);

  // ── persist (sessionStorage = cleared when the program/tab closes) ──
  // NOTE: faults are NOT persisted — they come from the shared live engine,
  // so the planner always shows the same zones as the dashboard.
  useEffect(() => {
    saveSnapshot({
      startText,
      endText,
      start,
      end,
      mapOpened,
      route,
      alerts: (alerts || []).slice(0, 30),
      progressKm,
      arrived,
      offRoute,
      tracking,
      notifyOn,
      follow,
      activeTileKey,
    });
  }, [
    startText, endText, start, end, mapOpened, route, alerts,
    progressKm, arrived, offRoute, tracking, notifyOn, follow,
    activeTileKey,
  ]);

  const pushAlert = useCallback((kind, title, detail, atKm) => {
    if (notifyRef.current && siteNotifyRef.current) {
      try {
        siteNotifyRef.current({
          severity: KIND_SEV[kind] || 'info',
          title: `SkyGuard AI — ${title}`,
          detail: atKm != null ? `${detail} (route km ${(+atKm).toFixed(1)})` : detail,
          tag: `skyguard-${kind}`,
        });
      } catch { /* history entry below still records it */ }
    }
    setAlerts((log) =>
      [
        {
          id: Date.now() + Math.random(),
          kind,
          title,
          detail,
          atKm: atKm != null ? +(+atKm).toFixed(1) : null,
          time: new Date().toLocaleTimeString(),
        },
        ...log,
      ].slice(0, 30),
    );
  }, []);

  const fireAnomalyAlert = useCallback(
    (st, atKm) => {
      const fm = faultMeta(st.faultType, st.status);
      const cov = TN_STATIONS.find((x) => x.id === st.stationId)?.coverage_km;
      pushAlert(
        st.severity,
        `${st.station} — ${fm.label}`,
        `You are inside its ${cov} km fault radius. Drive carefully — sensor data here is unreliable.`,
        atKm,
      );
    },
    [pushAlert],
  );

  const stopTracking = useCallback((silent = false) => {
    if (watchId.current != null) {
      try {
        navigator.geolocation.clearWatch(watchId.current);
      } catch { /* noop */ }
      watchId.current = null;
    }
    setTracking(false);
    if (!silent) setGps(null);
    else setGps(null);
  }, []);

  const startTracking = useCallback(async () => {
    const r = routeRef.current;
    if (!r || watchId.current != null) return false;
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported on this device — tracking needs GPS.');
      return false;
    }
    setGpsError('');
    if (notifyRef.current) {
      try {
        await ensureNotifyPermission();
      } catch { /* keep current */ }
    }
    alertedRef.current = new Set();
    firstFix.current = true;
    setFollow(true);
    setArrived(false);
    setOffRoute(false);
    setProgressKm(0);
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError('');
          const { latitude, longitude, accuracy, speed } = pos.coords;
          setGps({
            lat: +latitude.toFixed(5),
            lng: +longitude.toFixed(5),
            acc: Math.round(accuracy || 20),
            speedKmh: speed != null && speed >= 0 ? +(speed * 3.6).toFixed(1) : null,
          });
        },
        (err) => {
          if (err?.code === 1)
            setGpsError('Location permission denied — allow location access, then press Start Tracking again.');
          else setGpsError('Waiting for GPS fix… stay outdoors with a clear sky view.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
      setTracking(true);
      const a = analysisRef.current;
      pushAlert(
        'info',
        'Tracking started',
        a.warnings.length
          ? `Live GPS on. Caution: ${a.warnings.length} fault zone${a.warnings.length === 1 ? '' : 's'} on this route.`
          : 'Live GPS on. Route is clear of known fault zones.',
        null,
      );
      return true;
    } catch {
      setGpsError('Could not start GPS tracking on this device.');
      return false;
    }
  }, [pushAlert]);

  // If the app reloads while tracking was on, the native watch is gone —
  // mark tracking off so the user can press Start again (route itself stays).
  useEffect(() => {
    if (tracking && watchId.current == null) setTracking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── background route evaluation (no map needed) ──
  // Runs on every GPS fix even when the user is on another page: progress,
  // off-route detection, fault-zone alerts and arrival keep working.
  useEffect(() => {
    const r = routeRef.current;
    if (!gps || !r) return;
    if (gps.acc > 200) return; // ignore wildly inaccurate fixes
    let c = null;
    try {
      c = closestPointOnRoute(r.coords, gps.lat, gps.lng);
    } catch { return; }
    if (!c) return;
    setProgressKm(c.km);

    const a = analysisRef.current;
    const dest = endRef.current;

    if (c.distKm > 1) {
      setOffRoute((was) => {
        if (!was) {
          pushAlert(
            'high',
            'Off route',
            `You are ${c.distKm.toFixed(1)} km away from the blue route. Return to it to resume guidance — the route itself is unchanged.`,
            c.km,
          );
        }
        return true;
      });
    } else {
      setOffRoute((was) => {
        if (was) pushAlert('info', 'Back on route', 'Guidance resumed along the planned route.', c.km);
        return false;
      });
    }

    [...a.warnings, ...a.advisories].forEach((w) => {
      if (alertedRef.current.has(w.stationId)) return;
      const st = TN_STATIONS.find((x) => x.id === w.stationId);
      if (!st) return;
      const d = haversineKm(gps.lat, gps.lng, st.lat, st.lng);
      if (d <= st.coverage_km) {
        alertedRef.current.add(w.stationId);
        fireAnomalyAlert(w, c.km);
      } else if (d <= 5 && w.severity !== 'advisory' && !alertedRef.current.has(`near-${w.stationId}`)) {
        alertedRef.current.add(`near-${w.stationId}`);
        const fm = faultMeta(w.faultType, w.status);
        pushAlert(
          'advisory',
          `Approaching ${w.short} fault zone`,
          `${fm.label} ${d.toFixed(1)} km ahead — stay alert.`,
          c.km,
        );
      }
    });

    if (dest) {
      const dEnd = haversineKm(gps.lat, gps.lng, dest.lat, dest.lng);
      setArrived((was) => {
        if (!was && dEnd <= 0.5) {
          pushAlert('info', 'Arrived', 'You reached your destination. Tracking continues until you stop it.', c.km);
          return true;
        }
        return was;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps]);

  // Full reset — delete route + stop tracking + clear saved session.
  // Only runs on explicit user delete, never on navigation.
  const resetPlanner = useCallback(() => {
    if (watchId.current != null) {
      try {
        navigator.geolocation.clearWatch(watchId.current);
      } catch { /* noop */ }
      watchId.current = null;
    }
    alertedRef.current = new Set();
    firstFix.current = true;
    setTracking(false);
    setGps(null);
    setGpsError('');
    setRoute(null);
    routeRef.current = null;
    setAlerts([]);
    setProgressKm(0);
    setArrived(false);
    setOffRoute(false);
    setRouteError('');
    setMapOpened(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch { /* noop */ }
  }, []);

  const value = {
    startText, setStartText,
    endText, setEndText,
    start, setStart,
    end, setEnd,
    mapOpened, setMapOpened,
    route, setRoute,
    routing, setRouting,
    routeError, setRouteError,
    alerts, setAlerts, pushAlert,
    progressKm, setProgressKm,
    arrived, setArrived,
    offRoute, setOffRoute,
    tracking,
    gps, setGps,
    gpsError, setGpsError,
    notifyOn, setNotifyOn, notifyRef,
    follow, setFollow, followRef,
    stepsOpen, setStepsOpen,
    activeTileKey, setActiveTileKey,
    faults, faultsRef,
    analysis,
    startTracking, stopTracking,
    resetPlanner,
    alertedRef, firstFix, watchId,
    notifyPermInitial: notifyPermission(),
  };

  return <RoutePlannerContext.Provider value={value}>{children}</RoutePlannerContext.Provider>;
}

export function useRoutePlanner() {
  const ctx = useContext(RoutePlannerContext);
  if (!ctx) throw new Error('useRoutePlanner must be used within a RoutePlannerProvider');
  return ctx;
}
