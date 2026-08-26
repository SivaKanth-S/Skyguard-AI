"""
SkyGuard AI - Corrected Value Estimation (Imputation) Module
Suggests corrected/imputed values for anomalous sensor readings.
"""

import numpy as np
import pandas as pd
from scipy.interpolate import CubicSpline
from typing import Optional


class AWSImputer:
    """
    Estimates corrected values for anomalous AWS observations using:
    1. Linear interpolation (short gaps)
    2. Cubic spline (smooth curves)
    3. Seasonal + diurnal climatological baseline
    4. Rolling median (robust to spikes)
    """

    def __init__(self, context_window: int = 24):
        """
        Args:
            context_window: Number of clean readings on each side to use for estimation
        """
        self.context_window = context_window

    def impute(self, df: pd.DataFrame, anomaly_mask: pd.Series) -> pd.DataFrame:
        """
        Replace anomalous values with estimated corrected values.

        Args:
            df: DataFrame with [temperature, pressure, humidity, timestamp]
            anomaly_mask: Boolean series (True = anomalous)

        Returns:
            DataFrame with corrected values and 'imputed' flag column
        """
        df = df.copy()
        df["imputed"] = False

        for param in ["temperature", "pressure", "humidity"]:
            if param not in df.columns:
                continue

            series = df[param].copy()
            # Mark anomalous as NaN for interpolation
            series.loc[anomaly_mask.values] = np.nan

            # Strategy 1: Linear interpolation for gaps ≤ 6 steps
            interpolated = series.interpolate(method="linear", limit=6)

            # Strategy 2: Cubic spline for longer gaps
            valid_mask = ~series.isna()
            if valid_mask.sum() > 4:
                try:
                    valid_indices = np.where(valid_mask)[0]
                    valid_values = series[valid_mask].values
                    cs = CubicSpline(valid_indices, valid_values)
                    all_indices = np.arange(len(series))
                    spline_fill = cs(all_indices)
                    # Apply spline where linear interpolation couldn't fill (long gaps)
                    still_nan = interpolated.isna()
                    interpolated[still_nan] = spline_fill[still_nan]
                except Exception:
                    pass

            # Strategy 3: Rolling median fallback
            still_nan = interpolated.isna()
            if still_nan.any():
                rolling_median = df[param].rolling(
                    self.context_window * 2,
                    min_periods=4,
                    center=True
                ).median()
                interpolated[still_nan] = rolling_median[still_nan]

            # Apply corrections
            df[f"{param}_corrected"] = interpolated
            df.loc[anomaly_mask, "imputed"] = True

        return df

    def compute_correction_confidence(
        self,
        df: pd.DataFrame,
        anomaly_mask: pd.Series,
        param: str
    ) -> pd.Series:
        """
        Estimate confidence of the imputed value based on:
        - Gap length (shorter gap = higher confidence)
        - Variability of surrounding clean data
        """
        confidence = pd.Series(1.0, index=df.index)

        anomaly_indices = df.index[anomaly_mask].tolist()
        if not anomaly_indices:
            return confidence

        # Group consecutive anomalies
        groups = []
        start = anomaly_indices[0]
        prev = anomaly_indices[0]
        for idx in anomaly_indices[1:]:
            if idx - prev > 2:
                groups.append((start, prev))
                start = idx
            prev = idx
        groups.append((start, prev))

        for start_idx, end_idx in groups:
            gap_len = end_idx - start_idx + 1
            # Confidence decreases with gap length
            gap_confidence = max(0.3, 1.0 - (gap_len / (self.context_window * 2)))

            # Variability factor: high variability = lower confidence
            before_start = max(0, start_idx - self.context_window)
            after_end = min(len(df), end_idx + self.context_window)
            surrounding = pd.concat([
                df[param].iloc[before_start:start_idx],
                df[param].iloc[end_idx:after_end]
            ]).dropna()

            if len(surrounding) > 2:
                cv = surrounding.std() / (abs(surrounding.mean()) + 1e-6)
                variability_factor = max(0.4, 1.0 - cv)
            else:
                variability_factor = 0.5

            final_confidence = gap_confidence * variability_factor
            confidence.iloc[start_idx:end_idx + 1] = final_confidence

        return confidence


if __name__ == "__main__":
    from data_generator import AWSDataGenerator

    gen = AWSDataGenerator()
    df = gen.generate_normal_data(n_hours=240)
    df = gen.inject_anomalies(df, anomaly_fraction=0.05)

    imputer = AWSImputer()
    anomaly_mask = df["anomaly_label"] == 1
    df_corrected = imputer.impute(df, anomaly_mask)

    print("Imputation complete.")
    print(df_corrected[["timestamp", "temperature", "temperature_corrected", "imputed"]].head(30))
