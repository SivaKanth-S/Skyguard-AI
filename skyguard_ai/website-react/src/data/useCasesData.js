export const USE_CASES = [
  {
    icon: '🌾',
    badge: 'Agriculture',
    title: 'Precision Irrigation Protection',
    desc: 'Detect faulty humidity and temperature sensors before they feed incorrect data into automated irrigation systems. Protect crop yield forecasting during critical growing seasons.',
    scenario: 'Humidity sensor freezes at 0% → SkyGuard flags frozen_humidity MEDIUM → Irrigation controller prevented from triggering emergency dry-run → Crop saved.',
    impacts: ['🌱 Crop yield protected', '💧 Water waste prevented']
  },
  {
    icon: '✈️',
    badge: 'Aviation',
    title: 'Airport METAR Data Quality',
    desc: 'Ensure meteorological aerodrome reports contain clean observations. A faulty pressure reading directly affects altimeter settings for landing aircraft — a safety-critical failure.',
    scenario: 'Pressure spike to 1085 hPa detected at Chennai airport AWS → CRITICAL alert before ATIS broadcast → ATC notified → Aircraft altimeter safety maintained.',
    impacts: ['✈️ Altimeter safety', '🛬 Zero false METARs']
  },
  {
    icon: '🌊',
    badge: 'Flood Management',
    title: 'Flood Early Warning Integrity',
    desc: 'Pressure and temperature feed NWP flood models. Corrupt sensor data causes false early warnings — or missed real events — both with catastrophic consequences.',
    scenario: 'Calibration drift identified 6 hours early → Corrected values auto-imputed via cubic spline → NWP model accuracy preserved → Flood forecast issued on clean data.',
    impacts: ['🏠 Evacuation accuracy', '📡 NWP model integrity']
  },
  {
    icon: '⚡',
    badge: 'Power Grid',
    title: 'Grid Demand Forecasting',
    desc: 'Extreme temperature readings directly affect power demand forecasting. Faulty sensors can cause grid operators to over-provision (costly) or under-provision (blackout risk).',
    scenario: 'Temperature spike to 72°C detected at urban AWS → out_of_range_temp CRITICAL alert → Grid dispatch uses corrected value (34°C) → No false peak demand trigger.',
    impacts: ['💡 Blackout prevention', '💰 Cost optimization']
  },
  {
    icon: '🏔️',
    badge: 'Climate Research',
    title: 'Long-Term Dataset Quality',
    desc: 'Climate datasets need clean historical records for trend analysis. Retrospective anomaly detection identifies systematic sensor errors that biased multi-year datasets.',
    scenario: 'Batch scan on 5-year AWS archive → 3 sensors with +0.8°C positive drift from 2021 identified → Data quality flags added → Climate trend analysis corrected retroactively.',
    impacts: ['📊 Archive integrity', '🔬 Research accuracy']
  },
  {
    icon: '🚨',
    badge: 'Grand Challenge',
    isGrand: true,
    title: 'Self-Healing Observation Network',
    desc: 'The grand challenge: distinguish genuine meteorological extremes from sensor faults. During Cyclone Biparjoy, a real 55°C hot air surge must not be suppressed. Spatial consistency with neighbouring stations resolves the ambiguity — only SkyGuard AI checks both dimensions.',
    scenario: 'Cyclone: AWS reports 52°C → Spatial check: 4 neighbours also show 48–54°C → SkyGuard confirms genuine event → No false suppression → Disaster alert correctly issued.',
    impacts: ['🛡️ Self-aware network', '🔄 Self-healing data', '🌐 National coverage']
  }
];

export const DEPLOYMENT_TABLE = [
  { sector: '🌾 Agriculture', benefit: 'Irrigation protection', anom: 'Frozen humidity sensor', source: 'Field AWS network', latency: '< 10 min' },
  { sector: '✈️ Aviation', benefit: 'METAR data quality', anom: 'Pressure spike / OOR', source: 'Airport AWS', latency: '< 1 min' },
  { sector: '🌊 Flood Mgmt', benefit: 'NWP model integrity', anom: 'Calibration drift', source: 'River basin AWS', latency: '< 10 min' },
  { sector: '⚡ Power Grid', benefit: 'Demand forecasting', anom: 'Temperature spike', source: 'Urban AWS grid', latency: '< 10 min' },
  { sector: '🏔️ Climate Res.', benefit: 'Archive accuracy', anom: 'Long-term drift', source: 'Historical batch', latency: 'Offline' },
  { sector: '🚨 Disaster Mgmt', benefit: 'Self-healing network', anom: 'All types + spatial', source: 'National AWS', latency: '< 5 min' },
];
