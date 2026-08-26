"""
SkyGuard AI - Explainability Module (SHAP-based)
Provides human-readable explanations for detected anomalies.
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # non-interactive backend for server use
import matplotlib.pyplot as plt
import warnings
from typing import Optional, List

warnings.filterwarnings("ignore")


class SkyGuardExplainer:
    """
    Wraps SHAP TreeExplainer for the RandomForest component
    and provides feature importance explanations.

    Falls back to feature-importance-based explanations when SHAP is unavailable.
    """

    # Human-readable feature descriptions
    FEATURE_DESCRIPTIONS = {
        "temperature": "Current temperature reading (°C)",
        "pressure": "Atmospheric pressure (hPa)",
        "humidity": "Relative humidity (%)",
        "temperature_zscore": "Temperature deviation from recent average (σ)",
        "pressure_zscore": "Pressure deviation from recent average (σ)",
        "humidity_zscore": "Humidity deviation from recent average (σ)",
        "temperature_roc1": "Temperature change in last 10 minutes",
        "pressure_roc1": "Pressure change in last 10 minutes",
        "humidity_roc1": "Humidity change in last 10 minutes",
        "temperature_frozen_18": "Temperature frozen for ~3 hours (count)",
        "humidity_frozen_18": "Humidity frozen for ~3 hours (count)",
        "physics_inconsistency": "Physical parameter combination plausibility",
        "any_oor": "Any parameter outside physical range",
        "missing_flag": "Data missing (communication error)",
        "s_temperature_std": "Short-window temperature variability",
        "s_humidity_std": "Short-window humidity variability",
        "vapor_pressure": "Actual vapor pressure (hPa)",
        "dewpoint_depression": "Dew-point depression (T - Td)",
        "heat_index": "Heat index (apparent temperature °C)",
        "pressure_24h_deviation": "Pressure deviation from 24-hour average",
    }

    def __init__(self, model: "SkyGuardEnsemble"):
        self.model = model
        self.shap_explainer = None
        self._init_shap()

    def _init_shap(self):
        """Initialize SHAP explainer if RF classifier is available."""
        try:
            import shap
            if self.model.rf_classifier is not None:
                self.shap_explainer = shap.TreeExplainer(self.model.rf_classifier)
                print("[Explainer] SHAP TreeExplainer initialized.")
            else:
                print("[Explainer] No RF classifier found; using feature importance fallback.")
        except ImportError:
            print("[Explainer] SHAP not installed; using feature importance fallback.")

    def explain_instance(
        self,
        df_features: pd.DataFrame,
        instance_idx: int,
        top_k: int = 10,
        plot: bool = False,
        save_path: Optional[str] = None,
    ) -> dict:
        """
        Generate explanation for a single anomalous instance.

        Returns:
            dict with:
            - feature_contributions: {feature: contribution_score}
            - top_reasons: human-readable explanation strings
            - shap_values: raw SHAP values (if available)
        """
        feature_names = self.model.feature_names
        if feature_names is None:
            return {"error": "Model not fitted"}

        row_data = df_features[feature_names].iloc[[instance_idx]].values

        # Get SHAP values if available
        shap_values = None
        if self.shap_explainer is not None:
            try:
                import shap
                sv = self.shap_explainer.shap_values(row_data)
                # shap_values shape varies by SHAP version:
                #   old API: list of 2 arrays each (n_samples, n_features)  → sv[1][0]
                #   new API: ndarray (n_samples, n_features, n_classes)      → sv[0, :, 1]
                #            or     (n_samples, n_features)                  → sv[0]
                if isinstance(sv, list):
                    # old API — list[class_idx] → (n_samples, n_features)
                    raw = np.asarray(sv[1])
                    shap_values = raw[0] if raw.ndim > 1 else raw
                else:
                    sv = np.asarray(sv)
                    if sv.ndim == 3:          # (n_samples, n_features, n_classes)
                        shap_values = sv[0, :, 1]
                    elif sv.ndim == 2:         # (n_samples, n_features)
                        shap_values = sv[0]
                    else:
                        shap_values = sv
                shap_values = shap_values.flatten().astype(float)
            except Exception as e:
                print(f"[Explainer] SHAP computation failed: {e}")
                shap_values = None

        # Fall back to RF feature importance
        if shap_values is None and self.model.rf_classifier is not None:
            importance = self.model.rf_classifier.feature_importances_
            row_vals = row_data[0]
            shap_values = (importance * row_vals).flatten().astype(float)  # proxy contribution

        if shap_values is None:
            # Last resort: use z-score-based contributions
            shap_values = np.zeros(len(feature_names))
            for i, fname in enumerate(feature_names):
                if fname in df_features.columns:
                    val = df_features[fname].iloc[instance_idx]
                    shap_values[i] = abs(float(val)) if "zscore" in fname else 0

        # Build explanation dict
        contributions = {
            fname: float(shap_values[i])
            for i, fname in enumerate(feature_names)
        }

        # Sort by absolute contribution
        sorted_contributions = sorted(
            contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:top_k]

        # Human-readable reasons
        reasons = []
        row = df_features.iloc[instance_idx]
        for feat_name, contrib in sorted_contributions[:5]:
            if abs(contrib) < 1e-6:
                continue
            desc = self.FEATURE_DESCRIPTIONS.get(feat_name, feat_name)
            val = row.get(feat_name, "N/A")
            direction = "↑ elevated" if contrib > 0 else "↓ depressed"
            reasons.append(f"{desc}: {val:.3f} ({direction}, impact={abs(contrib):.3f})")

        if not reasons:
            reasons = ["Multivariate pattern deviation detected by Isolation Forest"]

        result = {
            "instance_idx": instance_idx,
            "timestamp": row.get("timestamp", "N/A"),
            "temperature": row.get("temperature", "N/A"),
            "pressure": row.get("pressure", "N/A"),
            "humidity": row.get("humidity", "N/A"),
            "feature_contributions": dict(sorted_contributions),
            "top_reasons": reasons,
            "shap_values": shap_values.tolist() if shap_values is not None else [],
        }

        if plot:
            self._plot_explanation(sorted_contributions, result, save_path)

        return result

    def _plot_explanation(
        self,
        sorted_contributions: list,
        result: dict,
        save_path: Optional[str] = None,
    ):
        """Generate a horizontal bar chart of feature contributions."""
        features = [self.FEATURE_DESCRIPTIONS.get(f, f) for f, _ in sorted_contributions]
        values = [abs(v) for _, v in sorted_contributions]
        colors = ["#e74c3c" if v > 0 else "#3498db" for _, v in sorted_contributions]

        fig, ax = plt.subplots(figsize=(10, 6))
        bars = ax.barh(features[::-1], values[::-1], color=colors[::-1])
        ax.set_xlabel("Feature Contribution (|SHAP value|)", fontsize=11)
        ax.set_title(
            f"SkyGuard AI - Anomaly Explanation\n"
            f"T={result['temperature']:.1f}°C  P={result['pressure']:.1f}hPa  H={result['humidity']:.1f}%",
            fontsize=12, fontweight="bold"
        )
        ax.axvline(x=0, color="black", linewidth=0.8)

        for bar, val in zip(bars, values[::-1]):
            ax.text(bar.get_width() + 0.001, bar.get_y() + bar.get_height()/2,
                    f"{val:.3f}", va="center", fontsize=9)

        plt.tight_layout()
        if save_path:
            from pathlib import Path
            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
            plt.savefig(save_path, dpi=150, bbox_inches="tight")
            print(f"[Explainer] Plot saved to {save_path}")
        else:
            plt.savefig("explanation_plot.png", dpi=150, bbox_inches="tight")
        plt.close()

    def global_feature_importance(self, top_k: int = 20, save_path: Optional[str] = None) -> dict:
        """Return global feature importance from the RF classifier."""
        if self.model.rf_classifier is None:
            return {"error": "No RF classifier available"}

        importance = self.model.rf_classifier.feature_importances_
        feature_names = self.model.feature_names

        sorted_idx = np.argsort(importance)[::-1][:top_k]
        result = {
            feature_names[i]: float(importance[i])
            for i in sorted_idx
        }

        # Plot
        fig, ax = plt.subplots(figsize=(12, 7))
        names = [self.FEATURE_DESCRIPTIONS.get(feature_names[i], feature_names[i]) for i in sorted_idx]
        vals = [importance[i] for i in sorted_idx]
        ax.barh(names[::-1], vals[::-1], color="#2ecc71")
        ax.set_xlabel("Feature Importance (Gini)", fontsize=11)
        ax.set_title("SkyGuard AI - Global Feature Importance", fontsize=13, fontweight="bold")
        plt.tight_layout()
        path = save_path or "global_importance.png"
        from pathlib import Path as _Path
        _Path(path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(path, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"[Explainer] Global importance plot saved to {path}")

        return result

    def generate_report(self, detection_results: pd.DataFrame, df_features: pd.DataFrame) -> str:
        """
        Generate a text summary report for all detected anomalies.
        """
        anomalies = detection_results[detection_results["anomaly_flag"] == 1]

        lines = [
            "=" * 60,
            "   SKYGUARD AI - ANOMALY DETECTION REPORT",
            "=" * 60,
            f"Total records analyzed: {len(detection_results)}",
            f"Total anomalies detected: {len(anomalies)}",
            f"Anomaly rate: {len(anomalies)/len(detection_results)*100:.2f}%",
            "",
            "--- SEVERITY BREAKDOWN ---",
        ]

        for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            count = (anomalies["severity"] == sev).sum()
            lines.append(f"  {sev:8s}: {count}")

        lines += [
            "",
            "--- TOP ANOMALIES (by confidence) ---",
        ]

        top_anomalies = anomalies.nlargest(10, "confidence_score")
        for _, row in top_anomalies.iterrows():
            lines.append(
                f"  [{row['severity']:8s}] {str(row.get('timestamp', 'N/A'))[:19]} | "
                f"T={row['temperature']:.1f}°C P={row['pressure']:.1f}hPa H={row['humidity']:.1f}% | "
                f"Confidence={row['confidence_score']:.1%} | {row['root_cause'][:50]}"
            )

        lines += ["", "=" * 60]
        return "\n".join(lines)


if __name__ == "__main__":
    print("Run anomaly_detector.py first to train and save the model.")
    print("Then load and use explainability:\n")
    print("""
from anomaly_detector import SkyGuardEnsemble
from explainability import SkyGuardExplainer

model = SkyGuardEnsemble.load('models/skyguard_model.pkl')
explainer = SkyGuardExplainer(model)
explanation = explainer.explain_instance(df_features, idx=42, plot=True)
print(explanation['top_reasons'])
""")
