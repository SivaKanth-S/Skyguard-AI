"""
SkyGuard AI - Synthetic AWS Data Generator
Generates realistic weather station data with injected anomalies for training and testing.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import random


class AWSDataGenerator:
    """
    Generates synthetic Automatic Weather Station data with realistic
    temporal patterns and injected anomalies.
    """

    # Physical plausibility bounds (hard limits)
    BOUNDS = {
        "temperature": (-20.0, 60.0),       # °C
        "pressure": (870.0, 1084.0),         # hPa
        "humidity": (0.0, 100.0),            # %
    }

    # Normal seasonal baselines (Indian subcontinent context)
    SEASONAL_BASELINES = {
        "summer":  {"temp": 38.0, "pressure": 998.0, "humidity": 35.0},
        "monsoon": {"temp": 29.0, "pressure": 1002.0, "humidity": 88.0},
        "winter":  {"temp": 15.0, "pressure": 1015.0, "humidity": 60.0},
        "spring":  {"temp": 26.0, "pressure": 1008.0, "humidity": 50.0},
    }

    def __init__(self, station_id: str = "AWS_001", seed: int = 42):
        self.station_id = station_id
        np.random.seed(seed)
        random.seed(seed)

    def _get_season(self, month: int) -> str:
        if month in [3, 4, 5]:
            return "summer"
        elif month in [6, 7, 8, 9]:
            return "monsoon"
        elif month in [10, 11, 12]:
            return "winter"
        else:
            return "spring"

    def _diurnal_cycle(self, hour: int) -> dict:
        """Realistic diurnal (daily) variation."""
        # Temperature: peaks at 14:00, minimum at 05:00
        temp_offset = 8.0 * np.sin(np.pi * (hour - 5) / 12) if 5 <= hour <= 17 else -4.0
        # Pressure: semi-diurnal tide (peaks ~10:00 and 22:00)
        pressure_offset = 1.5 * np.sin(2 * np.pi * (hour - 10) / 12)
        # Humidity: inverse of temperature roughly
        humidity_offset = -10.0 * np.sin(np.pi * (hour - 5) / 12) if 5 <= hour <= 17 else 5.0
        return {
            "temp": temp_offset,
            "pressure": pressure_offset,
            "humidity": humidity_offset,
        }

    def generate_normal_data(
        self,
        start_date: datetime = None,
        n_hours: int = 8760,  # 1 year default
        freq_minutes: int = 10,
    ) -> pd.DataFrame:
        """Generate normal (clean) AWS observations."""
        if start_date is None:
            start_date = datetime(2024, 1, 1, 0, 0, 0)

        records = []
        steps_per_hour = 60 // freq_minutes
        total_steps = n_hours * steps_per_hour

        current_time = start_date
        # Previous values for temporal continuity
        prev_temp = self.SEASONAL_BASELINES["spring"]["temp"]
        prev_pressure = self.SEASONAL_BASELINES["spring"]["pressure"]
        prev_humidity = self.SEASONAL_BASELINES["spring"]["humidity"]

        for i in range(total_steps):
            month = current_time.month
            hour = current_time.hour
            season = self._get_season(month)
            baseline = self.SEASONAL_BASELINES[season]
            diurnal = self._diurnal_cycle(hour)

            # Target values with smooth transitions
            target_temp = baseline["temp"] + diurnal["temp"]
            target_pressure = baseline["pressure"] + diurnal["pressure"]
            target_humidity = baseline["humidity"] + diurnal["humidity"]

            # Smooth walk toward target (temporal autocorrelation)
            alpha = 0.05  # smoothing factor per 10-min step
            temp = prev_temp + alpha * (target_temp - prev_temp) + np.random.normal(0, 0.3)
            pressure = prev_pressure + alpha * (target_pressure - prev_pressure) + np.random.normal(0, 0.15)
            humidity = prev_humidity + alpha * (target_humidity - prev_humidity) + np.random.normal(0, 1.5)

            # Clamp to physical bounds
            temp = np.clip(temp, *self.BOUNDS["temperature"])
            pressure = np.clip(pressure, *self.BOUNDS["pressure"])
            humidity = np.clip(humidity, *self.BOUNDS["humidity"])

            records.append({
                "timestamp": current_time,
                "station_id": self.station_id,
                "temperature": round(temp, 2),
                "pressure": round(pressure, 2),
                "humidity": round(humidity, 2),
                "anomaly_label": 0,
                "anomaly_type": "normal",
            })

            prev_temp = temp
            prev_pressure = pressure
            prev_humidity = humidity
            current_time += timedelta(minutes=freq_minutes)

        return pd.DataFrame(records)

    def inject_anomalies(self, df: pd.DataFrame, anomaly_fraction: float = 0.05) -> pd.DataFrame:
        """
        Inject realistic anomalies into clean data.
        Anomaly types:
          1. spike           - sudden extreme value
          2. frozen_value    - sensor stuck at constant value
          3. drift           - gradual calibration drift
          4. out_of_range    - physically impossible value
          5. noise_burst     - high-frequency noise
          6. missing_data    - NaN values (communication loss)
          7. multivariate    - inconsistent combination (e.g., high temp + high pressure + high humidity)
        """
        df = df.copy()
        n = len(df)
        n_anomalies = int(n * anomaly_fraction)

        anomaly_types = [
            "spike", "frozen_value", "drift",
            "out_of_range", "noise_burst", "missing_data", "multivariate"
        ]

        injected = 0
        attempts = 0
        max_attempts = n_anomalies * 10

        while injected < n_anomalies and attempts < max_attempts:
            attempts += 1
            atype = random.choice(anomaly_types)
            # Need at least 20 rows of headroom for duration-based anomalies
            if n < 21:
                # Batch too small for the safe range — inject at row 0 only for point anomalies
                idx = 0
                atype = random.choice(["spike", "out_of_range", "multivariate"])
            else:
                idx = random.randint(0, n - 20)  # leave space for duration-based anomalies

            if df.iloc[idx]["anomaly_label"] != 0:
                continue  # skip already anomalous indices

            if atype == "spike":
                param = random.choice(["temperature", "pressure", "humidity"])
                original = df.iloc[idx][param]
                spike_mag = random.choice([-1, 1]) * random.uniform(15, 30)
                if param == "temperature":
                    spike_mag = random.choice([-1, 1]) * random.uniform(20, 35)
                elif param == "pressure":
                    spike_mag = random.choice([-1, 1]) * random.uniform(30, 60)
                df.at[df.index[idx], param] = round(original + spike_mag, 2)
                df.at[df.index[idx], "anomaly_label"] = 1
                df.at[df.index[idx], "anomaly_type"] = f"spike_{param}"
                injected += 1

            elif atype == "frozen_value":
                duration = random.randint(6, 18)  # 6-18 steps (1-3 hrs)
                param = random.choice(["temperature", "pressure", "humidity"])
                frozen_val = df.iloc[idx][param]
                end_idx = min(idx + duration, n - 1)
                for j in range(idx, end_idx):
                    df.at[df.index[j], param] = frozen_val
                    df.at[df.index[j], "anomaly_label"] = 1
                    df.at[df.index[j], "anomaly_type"] = f"frozen_{param}"
                injected += duration

            elif atype == "drift":
                duration = random.randint(12, 36)
                param = random.choice(["temperature", "pressure", "humidity"])
                drift_rate = random.uniform(0.3, 1.2) * random.choice([-1, 1])
                end_idx = min(idx + duration, n - 1)
                for j in range(idx, end_idx):
                    step = j - idx
                    df.at[df.index[j], param] = round(df.iloc[j][param] + drift_rate * step, 2)
                    df.at[df.index[j], "anomaly_label"] = 1
                    df.at[df.index[j], "anomaly_type"] = f"drift_{param}"
                injected += duration

            elif atype == "out_of_range":
                param = random.choice(["temperature", "pressure", "humidity"])
                if param == "temperature":
                    val = random.choice([random.uniform(65, 80), random.uniform(-40, -25)])
                elif param == "pressure":
                    val = random.choice([random.uniform(1100, 1200), random.uniform(700, 860)])
                else:
                    val = random.choice([random.uniform(105, 150), random.uniform(-20, -1)])
                df.at[df.index[idx], param] = round(val, 2)
                df.at[df.index[idx], "anomaly_label"] = 1
                df.at[df.index[idx], "anomaly_type"] = f"out_of_range_{param}"
                injected += 1

            elif atype == "noise_burst":
                duration = random.randint(3, 10)
                param = random.choice(["temperature", "pressure", "humidity"])
                end_idx = min(idx + duration, n - 1)
                for j in range(idx, end_idx):
                    noise = np.random.normal(0, random.uniform(5, 12))
                    df.at[df.index[j], param] = round(df.iloc[j][param] + noise, 2)
                    df.at[df.index[j], "anomaly_label"] = 1
                    df.at[df.index[j], "anomaly_type"] = f"noise_burst_{param}"
                injected += duration

            elif atype == "missing_data":
                duration = random.randint(1, 6)
                end_idx = min(idx + duration, n - 1)
                for j in range(idx, end_idx):
                    df.at[df.index[j], "temperature"] = np.nan
                    df.at[df.index[j], "pressure"] = np.nan
                    df.at[df.index[j], "humidity"] = np.nan
                    df.at[df.index[j], "anomaly_label"] = 1
                    df.at[df.index[j], "anomaly_type"] = "missing_data"
                injected += duration

            elif atype == "multivariate":
                # Physically inconsistent combination
                df.at[df.index[idx], "temperature"] = round(random.uniform(48, 58), 2)
                df.at[df.index[idx], "humidity"] = round(random.uniform(90, 100), 2)
                df.at[df.index[idx], "pressure"] = round(random.uniform(1040, 1080), 2)
                df.at[df.index[idx], "anomaly_label"] = 1
                df.at[df.index[idx], "anomaly_type"] = "multivariate_inconsistency"
                injected += 1

        print(f"[DataGenerator] Injected {injected} anomalous steps across {n} total records.")
        return df


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent / "configs"))
    import config as cfg

    gen = AWSDataGenerator(station_id="AWS_Chennai_001")
    print("Generating normal data...")
    df_clean = gen.generate_normal_data(n_hours=2160)  # 90 days
    print(f"Clean data shape: {df_clean.shape}")

    print("Injecting anomalies...")
    df_anomalous = gen.inject_anomalies(df_clean, anomaly_fraction=0.04)
    print(f"Anomaly distribution:\n{df_anomalous['anomaly_type'].value_counts()}")

    cfg.DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = cfg.DATA_DIR / "aws_sample_data.csv"
    df_anomalous.to_csv(out, index=False)
    print(f"Saved: {out}")
