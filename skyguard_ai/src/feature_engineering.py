"""
SkyGuard AI - Feature Engineering Module
Creates temporal, statistical, and physics-based features for anomaly detection.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Optional


class AWSFeatureEngineer:
    """
    Transforms raw AWS time-series data into rich feature sets for ML models.
    Features include:
    - Rolling statistics (mean, std, min, max, range)
    - Rate-of-change (first derivative approximation)
    - Physics-based consistency features
    - Temporal encoding (hour, month, season)
    - Z-scores and deviation from expected
    - Frozen value detection features
    """

    PARAMS = ["temperature", "pressure", "humidity"]

    def __init__(
        self,
        short_window: int = 6,   # ~1 hour at 10-min intervals
        medium_window: int = 18,  # ~3 hours
        long_window: int = 72,    # ~12 hours
    ):
        self.short_window = short_window
        self.medium_window = medium_window
        self.long_window = long_window

    def _rolling_stats(self, df: pd.DataFrame, param: str, window: int, prefix: str) -> pd.DataFrame:
        """Add rolling mean, std, min, max, range for a parameter."""
        s = df[param]
        df[f"{prefix}_{param}_mean"] = s.rolling(window, min_periods=1).mean()
        df[f"{prefix}_{param}_std"] = s.rolling(window, min_periods=1).std().fillna(0)
        df[f"{prefix}_{param}_min"] = s.rolling(window, min_periods=1).min()
        df[f"{prefix}_{param}_max"] = s.rolling(window, min_periods=1).max()
        df[f"{prefix}_{param}_range"] = df[f"{prefix}_{param}_max"] - df[f"{prefix}_{param}_min"]
        return df

    def _rate_of_change(self, df: pd.DataFrame, param: str) -> pd.DataFrame:
        """First and second derivative features."""
        df[f"{param}_roc1"] = df[param].diff(1).fillna(0)      # 10-min change
        df[f"{param}_roc2"] = df[param].diff(3).fillna(0)      # 30-min change
        df[f"{param}_roc6"] = df[param].diff(6).fillna(0)      # 1-hr change
        df[f"{param}_accel"] = df[f"{param}_roc1"].diff(1).fillna(0)  # acceleration
        return df

    def _frozen_value_features(self, df: pd.DataFrame, param: str) -> pd.DataFrame:
        """Detect frozen (stuck) sensor values."""
        # Count consecutive identical values
        is_same = (df[param].diff().fillna(0) == 0).astype(int)
        # Rolling sum = how many of last N readings are unchanged
        df[f"{param}_frozen_6"] = is_same.rolling(6, min_periods=1).sum()
        df[f"{param}_frozen_18"] = is_same.rolling(18, min_periods=1).sum()
        df[f"{param}_unique_ratio"] = (
            df[param].rolling(12, min_periods=1).apply(lambda x: len(np.unique(x)) / len(x), raw=True)
        )
        return df

    def _zscore_features(self, df: pd.DataFrame, param: str) -> pd.DataFrame:
        """Z-score deviation from rolling mean."""
        mu = df[param].rolling(self.medium_window, min_periods=1).mean()
        sigma = df[param].rolling(self.medium_window, min_periods=1).std().fillna(1).replace(0, 1)
        df[f"{param}_zscore"] = (df[param] - mu) / sigma
        # Long-window z-score
        mu_long = df[param].rolling(self.long_window, min_periods=1).mean()
        sigma_long = df[param].rolling(self.long_window, min_periods=1).std().fillna(1).replace(0, 1)
        df[f"{param}_zscore_long"] = (df[param] - mu_long) / sigma_long
        return df

    def _physics_consistency_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Physics-based cross-parameter consistency checks.

        Key meteorological relationships:
        1. Magnus formula: saturation vapor pressure from temperature
           es = 6.112 * exp(17.67*T / (T + 243.5))
        2. Wet-bulb depression: high temp + very high humidity → suspicious
        3. Pressure-altitude consistency (if station elevation known)
        4. Humidex-like comfort index
        """
        T = df["temperature"].fillna(df["temperature"].median())
        H = df["humidity"].fillna(df["humidity"].median())
        P = df["pressure"].fillna(df["pressure"].median())

        # Saturation vapor pressure (Magnus formula)
        es = 6.112 * np.exp(17.67 * T / (T + 243.5))
        # Actual vapor pressure
        e = (H / 100.0) * es
        df["vapor_pressure"] = e.round(3)
        df["sat_vapor_pressure"] = es.round(3)

        # Dew point depression (T - Td); very small = saturated = possible sensor error
        # Approximation: Td ≈ T - ((100 - H) / 5)
        Td = T - ((100 - H) / 5.0)
        df["dew_point"] = Td.round(2)
        df["dewpoint_depression"] = (T - Td).round(2)

        # Physics impossibility score: high temp + high humidity + high pressure
        # Normalize each to 0-1 scale
        T_norm = (T - (-20)) / (60 - (-20))
        H_norm = H / 100.0
        P_norm = (P - 870) / (1084 - 870)
        # Physically, high T → lower P (thermal expansion) and moderate H
        # Score close to 1 = suspicious combination
        df["physics_inconsistency"] = (T_norm * H_norm * P_norm).round(4)

        # Temp-Humidity interaction: heat index relevant only when T > 27°C, H > 40%
        heat_idx_condition = (T > 27) & (H > 40)
        HI = -8.784695 + 1.61139411 * T + 2.338549 * H - 0.14611605 * T * H \
             - 0.01230809 * T**2 - 0.01642482 * H**2 \
             + 0.00221173 * T**2 * H + 0.00072546 * T * H**2 \
             - 0.00000358 * T**2 * H**2
        df["heat_index"] = np.where(heat_idx_condition, HI.round(2), T)

        # Pressure deviation from 24-hour rolling mean
        df["pressure_24h_deviation"] = P - P.rolling(144, min_periods=1).mean()

        return df

    def _temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Cyclic temporal encoding."""
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            hour = ts.dt.hour
            month = ts.dt.month
            dow = ts.dt.dayofweek

            # Cyclic encoding using sin/cos to avoid discontinuity (23 → 0)
            df["hour_sin"] = np.sin(2 * np.pi * hour / 24)
            df["hour_cos"] = np.cos(2 * np.pi * hour / 24)
            df["month_sin"] = np.sin(2 * np.pi * month / 12)
            df["month_cos"] = np.cos(2 * np.pi * month / 12)
            df["dow_sin"] = np.sin(2 * np.pi * dow / 7)
            df["dow_cos"] = np.cos(2 * np.pi * dow / 7)
        return df

    def _out_of_range_flags(self, df: pd.DataFrame) -> pd.DataFrame:
        """Hard physical limit violation flags."""
        df["temp_oor"] = ((df["temperature"] < -20) | (df["temperature"] > 60)).astype(int)
        df["pressure_oor"] = ((df["pressure"] < 870) | (df["pressure"] > 1084)).astype(int)
        df["humidity_oor"] = ((df["humidity"] < 0) | (df["humidity"] > 100)).astype(int)
        df["any_oor"] = (df["temp_oor"] | df["pressure_oor"] | df["humidity_oor"]).astype(int)
        df["missing_flag"] = (
            df["temperature"].isna() | df["pressure"].isna() | df["humidity"].isna()
        ).astype(int)
        return df

    def transform(self, df: pd.DataFrame, drop_raw: bool = False) -> pd.DataFrame:
        """
        Apply all feature engineering steps.

        Args:
            df: Raw AWS dataframe with columns [timestamp, temperature, pressure, humidity]
            drop_raw: If True, drop original parameter columns (keep only features)

        Returns:
            Feature-enriched DataFrame
        """
        df = df.copy()

        # Handle missing values for feature computation
        for col in self.PARAMS:
            df[col] = df[col].interpolate(method="linear", limit=6)

        # Out of range flags (before anything else)
        df = self._out_of_range_flags(df)

        # Per-parameter features
        for param in self.PARAMS:
            df = self._rolling_stats(df, param, self.short_window, "s")
            df = self._rolling_stats(df, param, self.medium_window, "m")
            df = self._rolling_stats(df, param, self.long_window, "l")
            df = self._rate_of_change(df, param)
            df = self._frozen_value_features(df, param)
            df = self._zscore_features(df, param)

        # Cross-parameter physics features
        df = self._physics_consistency_features(df)

        # Temporal encoding
        df = self._temporal_features(df)

        # Fill remaining NaNs
        feature_cols = [c for c in df.columns if c not in
                        ["timestamp", "station_id", "anomaly_label", "anomaly_type"]]
        df[feature_cols] = df[feature_cols].fillna(0)

        return df

    def get_feature_names(self) -> List[str]:
        """Return expected feature column names (requires fitting on sample data)."""
        dummy = pd.DataFrame({
            "timestamp": pd.date_range("2024-01-01", periods=100, freq="10min"),
            "temperature": np.random.uniform(20, 35, 100),
            "pressure": np.random.uniform(995, 1010, 100),
            "humidity": np.random.uniform(40, 80, 100),
        })
        transformed = self.transform(dummy)
        non_feature = {"timestamp", "station_id", "anomaly_label", "anomaly_type",
                       "temperature", "pressure", "humidity"}
        return [c for c in transformed.columns if c not in non_feature]


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from data_generator import AWSDataGenerator

    gen = AWSDataGenerator()
    df = gen.generate_normal_data(n_hours=720)
    df = gen.inject_anomalies(df, anomaly_fraction=0.04)

    fe = AWSFeatureEngineer()
    df_features = fe.transform(df)

    print(f"Original columns: {len(df.columns)}")
    print(f"Feature columns: {len(df_features.columns)}")
    print(f"\nSample features:\n{df_features.columns.tolist()[:20]}")
    print(f"\nShape: {df_features.shape}")
