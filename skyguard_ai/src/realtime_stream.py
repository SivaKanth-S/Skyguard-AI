"""
SkyGuard AI - Real-Time Streaming Pipeline
Simulates real-time sensor data ingestion and anomaly detection.
Supports multi-station scalable deployment.

Usage:
    cd skyguard_ai/src
    python realtime_stream.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "configs"))

import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

import numpy as np
import pandas as pd
import time
import json
import threading
import queue
from datetime import datetime
from typing import Optional, Callable, Dict
from collections import deque

import config as cfg
from feature_engineering import AWSFeatureEngineer
from anomaly_detector import SkyGuardEnsemble
from imputation import AWSImputer


class SensorReading:
    """Represents a single sensor observation."""

    def __init__(
        self,
        station_id: str,
        timestamp: datetime,
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
    ):
        self.station_id = station_id
        self.timestamp = timestamp
        self.temperature = temperature
        self.pressure = pressure
        self.humidity = humidity

    def to_dict(self) -> dict:
        return {
            "station_id": self.station_id,
            "timestamp": self.timestamp,
            "temperature": self.temperature,
            "pressure": self.pressure,
            "humidity": self.humidity,
        }


class AnomalyAlert:
    """Represents a generated anomaly alert."""

    def __init__(
        self,
        station_id: str,
        timestamp: datetime,
        temperature: float,
        pressure: float,
        humidity: float,
        severity: str,
        confidence: float,
        root_cause: str,
        rule_triggers: list,
        corrected_values: Optional[dict] = None,
    ):
        self.station_id = station_id
        self.timestamp = timestamp
        self.temperature = temperature
        self.pressure = pressure
        self.humidity = humidity
        self.severity = severity
        self.confidence = confidence
        self.root_cause = root_cause
        self.rule_triggers = rule_triggers
        self.corrected_values = corrected_values or {}
        self.alert_time = datetime.now()

    def to_dict(self) -> dict:
        return {
            "alert_id": f"{self.station_id}_{int(self.alert_time.timestamp())}",
            "station_id": self.station_id,
            "observation_time": str(self.timestamp),
            "alert_generated_at": str(self.alert_time),
            "readings": {
                "temperature": self.temperature,
                "pressure": self.pressure,
                "humidity": self.humidity,
            },
            "severity": self.severity,
            "confidence_pct": f"{self.confidence * 100:.1f}%",
            "root_cause": self.root_cause,
            "rule_triggers": self.rule_triggers,
            "corrected_values": self.corrected_values,
            "action_required": self._recommended_action(),
        }

    def _recommended_action(self) -> str:
        if self.severity == "CRITICAL":
            return "IMMEDIATE: Dispatch maintenance team. Verify sensor calibration and physical condition."
        elif self.severity == "HIGH":
            return "URGENT: Cross-validate with neighboring stations. Schedule inspection within 24 hours."
        elif self.severity == "MEDIUM":
            return "MONITOR: Flag observation for manual review. Check data transmission integrity."
        else:
            return "LOG: Record for trend analysis. No immediate action required."

    def __str__(self) -> str:
        return (
            f"[{self.severity}] {self.station_id} @ {self.timestamp} | "
            f"T={self.temperature}°C P={self.pressure}hPa H={self.humidity}% | "
            f"Confidence={self.confidence:.1%} | {self.root_cause}"
        )


class StationBuffer:
    """
    Maintains a rolling buffer of recent observations per station.
    Required for temporal feature computation.
    """

    def __init__(self, station_id: str, buffer_size: int = 144):  # 144 = 24hr at 10-min
        self.station_id = station_id
        self.buffer_size = buffer_size
        self.buffer: deque = deque(maxlen=buffer_size)

    def add(self, reading: SensorReading):
        self.buffer.append(reading.to_dict())

    def get_dataframe(self) -> pd.DataFrame:
        if len(self.buffer) == 0:
            return pd.DataFrame()
        return pd.DataFrame(list(self.buffer))

    def is_ready(self, min_readings: int = 12) -> bool:
        return len(self.buffer) >= min_readings


class SkyGuardRealTimeEngine:
    """
    Real-time anomaly detection engine for multi-station deployment.

    Features:
    - Per-station rolling buffers
    - Feature engineering on sliding windows
    - Ensemble anomaly scoring
    - Alert generation with corrected value suggestions
    - Configurable alert callbacks
    """

    def __init__(
        self,
        model: SkyGuardEnsemble,
        alert_callback: Optional[Callable[[AnomalyAlert], None]] = None,
        buffer_size: int = 144,
        min_confidence_to_alert: float = 0.25,
    ):
        self.model = model
        self.fe = AWSFeatureEngineer()
        self.imputer = AWSImputer()
        self.alert_callback = alert_callback or self._default_alert_handler
        self.buffer_size = buffer_size
        self.min_confidence = min_confidence_to_alert
        self.station_buffers: Dict[str, StationBuffer] = {}
        self.alert_log = []
        self.stats = {
            "total_processed": 0,
            "total_anomalies": 0,
            "by_station": {},
            "by_severity": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        }
        self._lock = threading.Lock()

    def _default_alert_handler(self, alert: AnomalyAlert):
        """Default: print alert to console."""
        print(f"\n🚨 ANOMALY ALERT: {alert}")

    def _get_or_create_buffer(self, station_id: str) -> StationBuffer:
        if station_id not in self.station_buffers:
            self.station_buffers[station_id] = StationBuffer(station_id, self.buffer_size)
        return self.station_buffers[station_id]

    def process_reading(self, reading: SensorReading) -> Optional[AnomalyAlert]:
        """
        Process a single sensor reading.

        Returns:
            AnomalyAlert if anomaly detected, None otherwise
        """
        station_id = reading.station_id

        with self._lock:
            buffer = self._get_or_create_buffer(station_id)
            buffer.add(reading)

            # Need enough history for features
            if not buffer.is_ready(min_readings=6):
                return None

            df = buffer.get_dataframe()

            # Feature engineering — only transform enough rows for rolling windows
            # (long_window=72 is the largest window; keep at least 80 rows for accuracy)
            TRANSFORM_LIMIT = 80
            if len(df) > TRANSFORM_LIMIT:
                df_transform = df.tail(TRANSFORM_LIMIT).reset_index(drop=True)
            else:
                df_transform = df

            # Feature engineering
            try:
                df_feat = self.fe.transform(df_transform)
            except Exception as e:
                print(f"[Engine] Feature engineering failed for {station_id}: {e}")
                return None

            # Ensure model features are present
            if self.model.feature_names is None:
                return None

            missing_cols = [c for c in self.model.feature_names if c not in df_feat.columns]
            for col in missing_cols:
                df_feat[col] = 0.0

            # Analyze only the latest reading
            latest_feat = df_feat.iloc[[-1]]

            try:
                result = self.model.predict(latest_feat).iloc[0]
            except Exception as e:
                print(f"[Engine] Prediction failed: {e}")
                return None

            self.stats["total_processed"] += 1
            self.stats["by_station"].setdefault(station_id, {"processed": 0, "anomalies": 0})
            self.stats["by_station"][station_id]["processed"] += 1

            if result["anomaly_flag"] == 0 or result["confidence_score"] < self.min_confidence:
                return None

            # Generate corrected values if anomalous
            anomaly_mask = pd.Series([False] * len(df))
            anomaly_mask.iloc[-1] = True
            corrected_df = self.imputer.impute(df, anomaly_mask)

            corrected_values = {}
            latest_corrected = corrected_df.iloc[-1]
            for param in ["temperature", "pressure", "humidity"]:
                corr_col = f"{param}_corrected"
                if corr_col in corrected_df.columns and pd.notna(latest_corrected.get(corr_col)):
                    corrected_values[param] = round(float(latest_corrected[corr_col]), 2)

            alert = AnomalyAlert(
                station_id=station_id,
                timestamp=reading.timestamp,
                temperature=reading.temperature or 0.0,
                pressure=reading.pressure or 0.0,
                humidity=reading.humidity or 0.0,
                severity=result["severity"],
                confidence=result["confidence_score"],
                root_cause=result["root_cause"],
                rule_triggers=result["rule_triggers"],
                corrected_values=corrected_values,
            )

            self.alert_log.append(alert)
            self.stats["total_anomalies"] += 1
            self.stats["by_station"][station_id]["anomalies"] += 1
            sev = result["severity"]
            if sev in self.stats["by_severity"]:
                self.stats["by_severity"][sev] += 1

            self.alert_callback(alert)
            return alert

    def get_station_health(self, station_id: str) -> dict:
        """Return health status summary for a station."""
        stats = self.stats["by_station"].get(station_id, {})
        processed = stats.get("processed", 0)
        anomalies = stats.get("anomalies", 0)
        rate = anomalies / processed if processed > 0 else 0.0

        if rate < 0.02:
            status = "HEALTHY"
        elif rate < 0.08:
            status = "DEGRADED"
        elif rate < 0.20:
            status = "FAULT"
        else:
            status = "CRITICAL_FAILURE"

        return {
            "station_id": station_id,
            "status": status,
            "readings_processed": processed,
            "anomalies_detected": anomalies,
            "anomaly_rate_pct": f"{rate * 100:.2f}%",
            "recent_alerts": [
                a.to_dict() for a in self.alert_log[-5:]
                if a.station_id == station_id
            ],
        }

    def get_system_summary(self) -> dict:
        """Return overall system health summary."""
        return {
            "total_processed": self.stats["total_processed"],
            "total_anomalies": self.stats["total_anomalies"],
            "overall_anomaly_rate": (
                f"{self.stats['total_anomalies'] / max(1, self.stats['total_processed']) * 100:.2f}%"
            ),
            "severity_breakdown": self.stats["by_severity"],
            "active_stations": list(self.station_buffers.keys()),
            "station_health": {
                sid: self.get_station_health(sid)["status"]
                for sid in self.station_buffers
            },
        }


def simulate_realtime(model: SkyGuardEnsemble, n_readings: int = 200, delay: float = 0.05):
    """Simulate real-time data ingestion from multiple stations."""
    from data_generator import AWSDataGenerator

    print(f"\n{'='*60}")
    print("   SkyGuard AI - Real-Time Simulation")
    print(f"{'='*60}\n")

    stations = ["AWS_Chennai_001", "AWS_Mumbai_002", "AWS_Delhi_003"]
    generators = {sid: AWSDataGenerator(station_id=sid, seed=i) for i, sid in enumerate(stations)}
    engine = SkyGuardRealTimeEngine(model, min_confidence_to_alert=0.45)

    alerts_collected = []

    def collect_alert(alert: AnomalyAlert):
        alerts_collected.append(alert)
        print(f"  ⚠  {alert}")

    engine.alert_callback = collect_alert

    start_time = datetime(2024, 6, 1, 0, 0, 0)

    # Pre-generate full datasets for each station upfront (more efficient)
    station_data = {}
    for sid, gen in generators.items():
        n_hours = (n_readings * 10) // 60 + 2  # +2 hr buffer
        df_full = gen.generate_normal_data(
            start_date=start_time,
            n_hours=n_hours,
            freq_minutes=10,
        )
        df_full = gen.inject_anomalies(df_full, anomaly_fraction=0.05)
        station_data[sid] = df_full.reset_index(drop=True)

    for step in range(n_readings):
        ts = start_time + pd.Timedelta(minutes=10 * step)

        for sid in stations:
            df_station = station_data[sid]
            if step >= len(df_station):
                continue
            row = df_station.iloc[step]
            reading = SensorReading(
                station_id=sid,
                timestamp=ts,
                temperature=row["temperature"],
                pressure=row["pressure"],
                humidity=row["humidity"],
            )
            engine.process_reading(reading)

        if step % 20 == 0:
            print(f"\n[Step {step+1}/{n_readings}] Processing... {ts.strftime('%Y-%m-%d %H:%M')}")

        time.sleep(delay)

    print(f"\n{'='*60}")
    print("   SIMULATION COMPLETE - SYSTEM SUMMARY")
    print(f"{'='*60}")
    summary = engine.get_system_summary()
    print(json.dumps(summary, indent=2))

    return alerts_collected, engine


if __name__ == "__main__":
    print("Loading model...")
    try:
        model = SkyGuardEnsemble.load()
    except FileNotFoundError:
        print("Model not found. Training a quick model first...")
        from data_generator import AWSDataGenerator
        from feature_engineering import AWSFeatureEngineer

        gen = AWSDataGenerator()
        df = gen.generate_normal_data(n_hours=1440)
        df = gen.inject_anomalies(df, anomaly_fraction=0.04)
        fe = AWSFeatureEngineer()
        df_feat = fe.transform(df)
        model = SkyGuardEnsemble()
        model.fit(df_feat, df_feat["anomaly_label"])
        model.save()

    alerts, engine = simulate_realtime(model, n_readings=100, delay=0.02)
    print(f"\nTotal alerts generated: {len(alerts)}")
