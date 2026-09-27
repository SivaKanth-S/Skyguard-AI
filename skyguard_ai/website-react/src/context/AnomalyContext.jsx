import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { TN_STATIONS } from '../data/stations';

// ── Single global live-anomaly engine ─────────────────────────────────────
// Dashboard, Route Planner (and Live Location) all read THE SAME fault zones
// from here, so every map shows identical anomaly/fault readings. One 9s
// tick raises/ages/self-heals faults; consumers only render + react to it.
//
// Canonical entry: { status: 'CRITICAL'|'FAULT'|'DEGRADED', faultType,
// cycles, conf }. Healthy stations are simply absent from the map.

export const ENGINE_INTERVAL_MS = 9000;
export const MAX_ACTIVE_FAULTS = 3;
const FAULT_LIFETIME_CYCLES = 3;

const CONF_BY_TYPE = {
  spike: 0.42,
  freeze: 0.42,
  drift: 0.42,
  oor: 0.42,
  multi: 0.78,
  noise: 0.6,
  missing: 0.95,
};

function rollFault() {
  const roll = Math.random();
  const status = roll < 0.35 ? 'CRITICAL' : roll < 0.7 ? 'FAULT' : 'DEGRADED';
  const pool =
    status === 'CRITICAL'
      ? ['spike', 'oor', 'missing']
      : status === 'FAULT'
        ? ['freeze', 'multi', 'noise']
        : ['drift', 'noise'];
  const faultType = pool[(Math.random() * pool.length) | 0];
  return { status, faultType, cycles: 0, conf: CONF_BY_TYPE[faultType] ?? 0.6 };
}

// Seeded with the Trichy spike + Salem freeze so the first paint matches the
// dashboard's initial detection log on every map.
function seedAnomalies() {
  return {
    3: { status: 'CRITICAL', faultType: 'spike', cycles: 0, conf: 0.42 },
    4: { status: 'FAULT', faultType: 'freeze', cycles: 0, conf: 0.42 },
  };
}

const AnomalyContext = createContext({ anomalies: {}, anomaliesRef: { current: {} } });

export function AnomalyProvider({ children }) {
  const anomaliesRef = useRef(seedAnomalies());
  const [anomalies, setAnomalies] = useState(anomaliesRef.current);

  useEffect(() => {
    const id = setInterval(() => {
      const prev = anomaliesRef.current || {};
      const next = {};
      let dirty = false;

      // 1. Age active faults; self-heal past their lifetime.
      Object.entries(prev).forEach(([sid, f]) => {
        if (!f || f.status === 'HEALTHY') return;
        const age = (f.cycles ?? 0) + 1;
        if (age < FAULT_LIFETIME_CYCLES) next[sid] = { ...f, cycles: age };
        dirty = true; // aged or just healed
      });

      // 2. Raise a new fault on a healthy station (capped concurrency).
      const activeCount = Object.keys(next).length;
      if (activeCount < MAX_ACTIVE_FAULTS && Math.random() < 0.6) {
        const candidates = TN_STATIONS.filter((st) => !(st.id in next));
        if (candidates.length) {
          const st = candidates[(Math.random() * candidates.length) | 0];
          next[st.id] = rollFault();
          dirty = true;
        }
      }

      if (dirty) {
        anomaliesRef.current = next;
        setAnomalies({ ...next });
      }
    }, ENGINE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <AnomalyContext.Provider value={{ anomalies, anomaliesRef }}>
      {children}
    </AnomalyContext.Provider>
  );
}

export function useAnomaly() {
  return useContext(AnomalyContext);
}
