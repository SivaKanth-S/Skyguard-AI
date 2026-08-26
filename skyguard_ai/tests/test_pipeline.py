"""
SkyGuard AI — Unit & Integration Tests
Run with:  cd skyguard_ai && py -m pytest tests/ -v
"""

import sys
from pathlib import Path
import pytest
import numpy as np
import pandas as pd

# Make src/ and configs/ importable
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "configs"))


# ─── Data Generator Tests ─────────────────────────────────────

class TestAWSDataGenerator:
    def setup_method(self):
        from data_generator import AWSDataGenerator
        self.gen = AWSDataGenerator(station_id="TEST_001", seed=0)

    def test_generates_correct_shape(self):
        df = self.gen.generate_normal_data(n_hours=24, freq_minutes=10)
        assert len(df) == 24 * 6   # 144 rows
        assert set(["temperature", "pressure", "humidity", "timestamp"]).issubset(df.columns)

    def test_temperature_in_bounds(self):
        df = self.gen.generate_normal_data(n_hours=720)
        assert df["temperature"].between(-20, 60).all(), "Temperature out of physical bounds"

    def test_pressure_in_bounds(self):
        df = self.gen.generate_normal_data(n_hours=720)
        assert df["pressure"].between(870, 1084).all(), "Pressure out of physical bounds"

    def test_humidity_in_bounds(self):
        df = self.gen.generate_normal_data(n_hours=720)
        assert df["humidity"].between(0, 100).all(), "Humidity out of physical bounds"

    def test_anomaly_injection_adds_labels(self):
        df = self.gen.generate_normal_data(n_hours=720)
        df_a = self.gen.inject_anomalies(df, anomaly_fraction=0.05)
        assert df_a["anomaly_label"].sum() > 0, "No anomalies were injected"

    def test_anomaly_types_present(self):
        df = self.gen.generate_normal_data(n_hours=2160)
        df_a = self.gen.inject_anomalies(df, anomaly_fraction=0.05)
        types = df_a["anomaly_type"].unique().tolist()
        assert "normal" in types
        # At least 3 distinct anomaly types should appear
        assert len(types) >= 4, f"Too few anomaly types: {types}"


# ─── Feature Engineering Tests ────────────────────────────────

class TestAWSFeatureEngineer:
    def setup_method(self):
        from data_generator import AWSDataGenerator
        from feature_engineering import AWSFeatureEngineer
        gen = AWSDataGenerator(seed=1)
        self.df_raw = gen.generate_normal_data(n_hours=120)
        self.fe = AWSFeatureEngineer()

    def test_transform_increases_columns(self):
        df_feat = self.fe.transform(self.df_raw)
        assert len(df_feat.columns) > len(self.df_raw.columns)

    def test_no_inf_values(self):
        df_feat = self.fe.transform(self.df_raw)
        numeric = df_feat.select_dtypes(include=[np.number])
        assert not np.isinf(numeric.values).any(), "Inf values found in features"

    def test_no_nan_in_features(self):
        df_feat = self.fe.transform(self.df_raw)
        exclude = {"timestamp", "station_id", "anomaly_label", "anomaly_type"}
        feat_cols = [c for c in df_feat.columns if c not in exclude]
        assert not df_feat[feat_cols].isna().any().any(), "NaN values remain in features"

    def test_zscore_columns_exist(self):
        df_feat = self.fe.transform(self.df_raw)
        for param in ["temperature", "pressure", "humidity"]:
            assert f"{param}_zscore" in df_feat.columns

    def test_physics_features_exist(self):
        df_feat = self.fe.transform(self.df_raw)
        assert "physics_inconsistency" in df_feat.columns
        assert "vapor_pressure" in df_feat.columns
        assert "dewpoint_depression" in df_feat.columns

    def test_temporal_features_exist(self):
        df_feat = self.fe.transform(self.df_raw)
        for col in ["hour_sin", "hour_cos", "month_sin", "month_cos"]:
            assert col in df_feat.columns

    def test_frozen_features_exist(self):
        df_feat = self.fe.transform(self.df_raw)
        assert "temperature_frozen_18" in df_feat.columns


# ─── Anomaly Detector Tests ────────────────────────────────────

class TestRuleBasedDetector:
    def setup_method(self):
        from anomaly_detector import RuleBasedDetector
        self.det = RuleBasedDetector()

    def test_out_of_range_temp_caught(self):
        row = {"temperature": 75, "pressure": 1005, "humidity": 60}
        is_anom, rules = self.det.detect(row)
        assert is_anom
        assert "out_of_range_temp" in rules

    def test_impossible_hot_humid_caught(self):
        row = {"temperature": 55, "pressure": 1000, "humidity": 90}
        is_anom, rules = self.det.detect(row)
        assert is_anom
        assert "impossible_hot_humid" in rules

    def test_normal_reading_passes(self):
        row = {"temperature": 30, "pressure": 1005, "humidity": 65}
        is_anom, rules = self.det.detect(row)
        assert not is_anom
        assert rules == []

    def test_spike_detected(self):
        row = {"temperature": 30, "pressure": 1005, "humidity": 65, "temperature_roc1": 15}
        is_anom, rules = self.det.detect(row)
        assert is_anom
        assert "spike_temp" in rules


class TestSkyGuardEnsemble:
    def setup_method(self):
        from data_generator import AWSDataGenerator
        from feature_engineering import AWSFeatureEngineer
        from anomaly_detector import SkyGuardEnsemble

        gen = AWSDataGenerator(seed=42)
        df = gen.generate_normal_data(n_hours=360)
        df = gen.inject_anomalies(df, anomaly_fraction=0.05)

        fe = AWSFeatureEngineer()
        self.df_feat = fe.transform(df)
        self.labels = self.df_feat["anomaly_label"].reset_index(drop=True)

        self.model = SkyGuardEnsemble()
        self.model.fit(self.df_feat, self.labels)

    def test_fit_sets_feature_names(self):
        assert self.model.feature_names is not None
        assert len(self.model.feature_names) > 10

    def test_predict_returns_dataframe(self):
        results = self.model.predict(self.df_feat)
        assert isinstance(results, pd.DataFrame)

    def test_predict_has_required_columns(self):
        results = self.model.predict(self.df_feat)
        for col in ["anomaly_flag", "confidence_score", "severity", "root_cause"]:
            assert col in results.columns, f"Missing column: {col}"

    def test_confidence_in_range(self):
        results = self.model.predict(self.df_feat)
        assert results["confidence_score"].between(0, 1).all()

    def test_severity_valid_values(self):
        results = self.model.predict(self.df_feat)
        valid = {"NORMAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"}
        assert set(results["severity"].unique()).issubset(valid)

    def test_detects_anomalies(self):
        results = self.model.predict(self.df_feat)
        assert results["anomaly_flag"].sum() > 0, "Model detected zero anomalies"

    def test_evaluate_returns_metrics(self):
        metrics = self.model.evaluate(self.df_feat, self.labels)
        for key in ["precision", "recall", "f1_score", "accuracy", "roc_auc"]:
            assert key in metrics
            assert 0.0 <= metrics[key] <= 1.0


# ─── Imputation Tests ──────────────────────────────────────────

class TestAWSImputer:
    def setup_method(self):
        from data_generator import AWSDataGenerator
        from imputation import AWSImputer

        gen = AWSDataGenerator(seed=7)
        self.df = gen.generate_normal_data(n_hours=48)
        self.imputer = AWSImputer()

    def test_impute_fills_anomalous_rows(self):
        mask = pd.Series([False] * len(self.df))
        mask.iloc[20:25] = True  # mark 5 rows as anomalous

        df_c = self.imputer.impute(self.df, mask)
        assert "temperature_corrected" in df_c.columns
        assert df_c["imputed"].iloc[20:25].all()

    def test_impute_leaves_normal_unchanged(self):
        mask = pd.Series([False] * len(self.df))
        mask.iloc[30] = True

        df_c = self.imputer.impute(self.df, mask)
        # Normal rows should not be marked imputed
        assert not df_c["imputed"].iloc[:30].any()

    def test_corrected_values_finite(self):
        mask = pd.Series([False] * len(self.df))
        mask.iloc[10:15] = True
        df_c = self.imputer.impute(self.df, mask)
        corr = df_c["temperature_corrected"].dropna()
        assert np.isfinite(corr.values).all()


# ─── Config Tests ──────────────────────────────────────────────

class TestConfig:
    def test_paths_are_pathlib(self):
        import config as cfg
        from pathlib import Path
        assert isinstance(cfg.ROOT, Path)
        assert isinstance(cfg.MODEL_PATH, Path)
        assert isinstance(cfg.DATA_DIR, Path)

    def test_bounds_sensible(self):
        import config as cfg
        t_min, t_max = cfg.BOUNDS["temperature"]
        assert t_min < 0 < t_max
        p_min, p_max = cfg.BOUNDS["pressure"]
        assert 800 < p_min < p_max < 1200

    def test_severity_thresholds_ordered(self):
        import config as cfg
        thresholds = list(cfg.SEVERITY_THRESHOLDS.values())
        assert thresholds == sorted(thresholds, reverse=True)
