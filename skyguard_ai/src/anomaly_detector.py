"""
SkyGuard AI - Hybrid Anomaly Detection Engine
Combines a physics Rule Engine, Isolation Forest, rolling Z-score statistics,
and an optional supervised Random Forest classifier.
Produces ensemble confidence scores with root-cause classification.
"""

import numpy as np
import pandas as pd
import joblib
import warnings
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, precision_recall_curve, f1_score
)
from scipy import stats

warnings.filterwarnings("ignore")


class RuleBasedDetector:
    """
    Fast, explainable rule-based checks for obvious anomalies.
    Acts as the first line of defense (low latency, high precision for clear cases).
    """

    RULES = {
        "out_of_range_temp":       lambda r: r["temperature"] < -20 or r["temperature"] > 60,
        "out_of_range_pressure":   lambda r: r["pressure"] < 870 or r["pressure"] > 1084,
        "out_of_range_humidity":   lambda r: r["humidity"] < 0 or r["humidity"] > 100,
        "impossible_hot_humid":    lambda r: r["temperature"] > 50 and r["humidity"] > 85,
        "impossible_cold_pressure":lambda r: r["temperature"] < -10 and r["pressure"] > 1070,
        "frozen_temp":             lambda r: abs(r.get("s_temperature_std", 1)) < 0.001 and r.get("temperature_frozen_18", 0) > 15,
        "frozen_humidity":         lambda r: abs(r.get("s_humidity_std", 1)) < 0.001 and r.get("humidity_frozen_18", 0) > 15,
        "spike_temp":              lambda r: abs(r.get("temperature_roc1", 0)) > 10,
        "spike_pressure":          lambda r: abs(r.get("pressure_roc1", 0)) > 15,
        "extreme_zscore_temp":     lambda r: abs(r.get("temperature_zscore", 0)) > 4.5,
        "extreme_zscore_humidity": lambda r: abs(r.get("humidity_zscore", 0)) > 4.5,
        "extreme_zscore_pressure": lambda r: abs(r.get("pressure_zscore", 0)) > 4.5,
    }

    def detect(self, row: dict) -> Tuple[bool, List[str]]:
        """Returns (is_anomaly, triggered_rules)."""
        triggered = [name for name, rule in self.RULES.items() if rule(row)]
        return len(triggered) > 0, triggered


class StatisticalDetector:
    """
    Rolling Z-score and IQR-based statistical anomaly detector.
    Trained on historical normal data.
    """

    def __init__(self, window: int = 144, z_threshold: float = 3.5):
        self.window = window
        self.z_threshold = z_threshold
        self.params = ["temperature", "pressure", "humidity"]

    def score(self, df: pd.DataFrame) -> np.ndarray:
        """Returns per-row anomaly score (higher = more anomalous)."""
        scores = np.zeros(len(df))
        for param in self.params:
            if param not in df.columns:
                continue
            s = df[param].ffill().bfill()
            mu = s.rolling(self.window, min_periods=6).mean().fillna(s.mean())
            sigma = s.rolling(self.window, min_periods=6).std().fillna(s.std()).replace(0, 0.001)
            z = np.abs((s - mu) / sigma)
            scores += z.values
        return scores / len(self.params)


class IsolationForestDetector:
    """Isolation Forest for multivariate anomaly detection."""

    def __init__(self, contamination: float = 0.04, n_estimators: int = 200, random_state: int = 42):
        self.model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=random_state,
            max_samples="auto",
            n_jobs=-1,
        )
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_names = None

    def fit(self, X: np.ndarray, feature_names: List[str] = None):
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.feature_names = feature_names
        self.is_fitted = True
        return self

    def score_samples(self, X: np.ndarray) -> np.ndarray:
        """Returns anomaly scores (lower = more anomalous → we invert)."""
        X_scaled = self.scaler.transform(X)
        raw_scores = self.model.score_samples(X_scaled)
        # Normalize to 0-1 where 1 = most anomalous
        min_s, max_s = raw_scores.min(), raw_scores.max()
        normalized = 1 - (raw_scores - min_s) / (max_s - min_s + 1e-9)
        return normalized

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        return (self.model.predict(X_scaled) == -1).astype(int)


class SkyGuardEnsemble:
    """
    Hybrid ensemble combining:
    1. Rule-based detector (fast, explainable)
    2. Statistical Z-score detector
    3. Isolation Forest (multivariate)
    4. Supervised RandomForest classifier (when labeled data available)

    Produces:
    - Binary anomaly flag
    - Confidence score (0-100%)
    - Root cause classification
    - Severity level (LOW/MEDIUM/HIGH/CRITICAL)
    """

    SEVERITY_THRESHOLDS = {
        "CRITICAL": 0.85,
        "HIGH":     0.65,
        "MEDIUM":   0.45,
        "LOW":      0.25,
    }

    ROOT_CAUSE_LABELS = {
        "out_of_range_temp":        "Physical Impossibility - Temperature",
        "out_of_range_pressure":    "Physical Impossibility - Pressure",
        "out_of_range_humidity":    "Physical Impossibility - Humidity",
        "impossible_hot_humid":     "Multivariate Inconsistency (Hot+Humid)",
        "impossible_cold_pressure": "Multivariate Inconsistency (Cold+High Pressure)",
        "frozen_temp":              "Sensor Frozen - Temperature",
        "frozen_humidity":          "Sensor Frozen - Humidity",
        "spike_temp":               "Spike / Transient Fault - Temperature",
        "spike_pressure":           "Spike / Transient Fault - Pressure",
        "extreme_zscore_temp":      "Statistical Outlier - Temperature",
        "extreme_zscore_humidity":  "Statistical Outlier - Humidity",
        "extreme_zscore_pressure":  "Statistical Outlier - Pressure",
    }

    def __init__(self):
        self.rule_detector = RuleBasedDetector()
        self.stat_detector = StatisticalDetector()
        self.if_detector = IsolationForestDetector()
        self.rf_classifier = None  # Optional supervised component
        self.feature_names = None
        self.is_fitted = False

    def fit(self, df_features: pd.DataFrame, labels: Optional[pd.Series] = None):
        """
        Train the ensemble detectors.

        Args:
            df_features: Feature-engineered DataFrame
            labels: Optional binary labels (0=normal, 1=anomaly) for supervised component
        """
        exclude = {"timestamp", "station_id", "anomaly_label", "anomaly_type",
                   "temperature", "pressure", "humidity"}
        self.feature_names = [c for c in df_features.columns if c not in exclude]
        X = df_features[self.feature_names].values

        # Fit Isolation Forest on clean data only (if labels available)
        if labels is not None:
            X_normal = X[labels == 0]
        else:
            X_normal = X

        print(f"[SkyGuard] Training Isolation Forest on {len(X_normal)} normal samples...")
        self.if_detector.fit(X_normal, self.feature_names)

        # Optional supervised classifier
        if labels is not None and labels.sum() > 10:
            print(f"[SkyGuard] Training supervised RandomForest...")
            self.rf_classifier = RandomForestClassifier(
                n_estimators=300,
                class_weight="balanced",
                max_depth=12,
                random_state=42,
                n_jobs=-1,
            )
            self.rf_classifier.fit(X, labels.values)

        self.is_fitted = True
        print("[SkyGuard] Training complete.")
        return self

    def predict(self, df_features: pd.DataFrame) -> pd.DataFrame:
        """
        Run anomaly detection on new data.

        Returns DataFrame with:
        - anomaly_flag (0/1)
        - confidence_score (0-1)
        - severity (LOW/MEDIUM/HIGH/CRITICAL)
        - root_cause (string)
        - rule_triggers (list)
        - if_score (isolation forest contribution)
        - stat_score (statistical contribution)
        - rf_score (supervised RF contribution, if available)
        """
        results = []
        X = df_features[self.feature_names].values if self.feature_names else None

        # Pre-compute IF scores
        if_scores = self.if_detector.score_samples(X) if self.is_fitted else np.zeros(len(df_features))

        # Pre-compute statistical scores
        # Use raw params if available in df_features
        stat_scores = np.zeros(len(df_features))
        for i, param in enumerate(["temperature", "pressure", "humidity"]):
            if param in df_features.columns:
                zscore_col = f"{param}_zscore"
                if zscore_col in df_features.columns:
                    stat_scores += np.abs(df_features[zscore_col].fillna(0).values)
        stat_scores = np.clip(stat_scores / 3.0 / 4.5, 0, 1)  # normalize

        # Pre-compute RF scores
        rf_scores = np.zeros(len(df_features))
        if self.rf_classifier is not None:
            rf_scores = self.rf_classifier.predict_proba(X)[:, 1]

        for idx in range(len(df_features)):
            row = df_features.iloc[idx].to_dict()

            # Rule-based check
            rule_triggered, triggered_rules = self.rule_detector.detect(row)

            # Ensemble score (weighted combination)
            rule_score = 1.0 if rule_triggered else 0.0

            # Weights: rules=0.35, IF=0.30, stat=0.15, RF=0.20 (with RF)
            #          rules=0.40, IF=0.40, stat=0.20            (without RF)
            if self.rf_classifier is not None:
                confidence = (
                    0.35 * rule_score +
                    0.30 * if_scores[idx] +
                    0.15 * stat_scores[idx] +
                    0.20 * rf_scores[idx]
                )
            else:
                confidence = (
                    0.40 * rule_score +
                    0.40 * if_scores[idx] +
                    0.20 * stat_scores[idx]
                )

            # Missing data override
            if row.get("missing_flag", 0) == 1:
                confidence = max(confidence, 0.95)
                triggered_rules = ["missing_data"]

            # Severity classification
            severity = "NORMAL"
            for sev, thresh in self.SEVERITY_THRESHOLDS.items():
                if confidence >= thresh:
                    severity = sev
                    break

            anomaly_flag = 1 if confidence >= self.SEVERITY_THRESHOLDS["LOW"] else 0

            # Root cause
            if triggered_rules:
                root_cause = " | ".join(
                    self.ROOT_CAUSE_LABELS.get(r, r) for r in triggered_rules[:3]
                )
            elif if_scores[idx] > 0.7:
                root_cause = "Multivariate Statistical Outlier (Isolation Forest)"
            elif stat_scores[idx] > 0.6:
                root_cause = "Univariate Statistical Deviation"
            elif rf_scores[idx] > 0.7:
                root_cause = "Pattern-Based Anomaly (Learned)"
            else:
                root_cause = "None"

            results.append({
                "timestamp": row.get("timestamp"),
                "station_id": row.get("station_id"),
                "temperature": row.get("temperature"),
                "pressure": row.get("pressure"),
                "humidity": row.get("humidity"),
                "anomaly_flag": anomaly_flag,
                "confidence_score": round(float(confidence), 4),
                "severity": severity if anomaly_flag else "NORMAL",
                "root_cause": root_cause if anomaly_flag else "None",
                "rule_triggers": triggered_rules,
                "if_score": round(float(if_scores[idx]), 4),
                "stat_score": round(float(stat_scores[idx]), 4),
                "rf_score": round(float(rf_scores[idx]), 4),
            })

        return pd.DataFrame(results)

    def evaluate(self, df_features: pd.DataFrame, true_labels: pd.Series) -> dict:
        """Evaluate detection performance against ground truth labels."""
        results = self.predict(df_features)
        y_pred = results["anomaly_flag"].values
        y_true = true_labels.values
        y_scores = results["confidence_score"].values

        report = classification_report(y_true, y_pred, target_names=["Normal", "Anomaly"], output_dict=True)

        metrics = {
            "precision": report["Anomaly"]["precision"],
            "recall": report["Anomaly"]["recall"],
            "f1_score": report["Anomaly"]["f1-score"],
            "accuracy": report["accuracy"],
            "roc_auc": roc_auc_score(y_true, y_scores) if len(np.unique(y_true)) > 1 else 0.0,
        }

        print("\n=== SkyGuard AI - Detection Performance ===")
        print(classification_report(y_true, y_pred, target_names=["Normal", "Anomaly"]))
        print(f"ROC-AUC Score: {metrics['roc_auc']:.4f}")
        print(f"Confusion Matrix:\n{confusion_matrix(y_true, y_pred)}")

        return metrics

    def save(self, path: str = None):
        """Serialize the trained model."""
        if path is None:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent / "configs"))
            import config as cfg
            path = str(cfg.MODEL_PATH)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)
        print(f"[SkyGuard] Model saved to {path}")

    @classmethod
    def load(cls, path: str = None) -> "SkyGuardEnsemble":
        """Load serialized model."""
        if path is None:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent / "configs"))
            import config as cfg
            path = str(cfg.MODEL_PATH)
        model = joblib.load(path)
        print(f"[SkyGuard] Model loaded from {path}")
        return model


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from data_generator import AWSDataGenerator
    from feature_engineering import AWSFeatureEngineer

    print("Generating training data...")
    gen = AWSDataGenerator()
    df_raw = gen.generate_normal_data(n_hours=2160)
    df_raw = gen.inject_anomalies(df_raw, anomaly_fraction=0.04)

    print("Engineering features...")
    fe = AWSFeatureEngineer()
    df_feat = fe.transform(df_raw)

    labels = df_feat["anomaly_label"]

    print("Training ensemble detector...")
    detector = SkyGuardEnsemble()
    detector.fit(df_feat, labels)

    print("Evaluating...")
    metrics = detector.evaluate(df_feat, labels)

    detector.save("models/skyguard_model.pkl")
    print("\nDone! Model saved.")
