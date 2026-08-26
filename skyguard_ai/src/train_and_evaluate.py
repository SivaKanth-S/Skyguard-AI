"""
SkyGuard AI - Full Training & Evaluation Pipeline
Run this script to train the model, evaluate it, and generate detection_results.csv

Usage:
    cd skyguard_ai/src
    python train_and_evaluate.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "configs"))

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import json
from datetime import datetime

import config as cfg
from data_generator import AWSDataGenerator
from feature_engineering import AWSFeatureEngineer
from anomaly_detector import SkyGuardEnsemble
from explainability import SkyGuardExplainer
from imputation import AWSImputer

# Ensure output dirs exist
cfg.DATA_DIR.mkdir(parents=True, exist_ok=True)
cfg.MODELS_DIR.mkdir(parents=True, exist_ok=True)
cfg.PLOTS_DIR.mkdir(parents=True, exist_ok=True)
cfg.DOCS_DIR.mkdir(parents=True, exist_ok=True)


def run_full_pipeline():
    print("\n" + "=" * 65)
    print("   SKYGUARD AI — FULL TRAINING & EVALUATION PIPELINE")
    print("=" * 65)

    # ─── Step 1: Generate Data ───────────────────────────────────────
    print("\n[1/6] Generating synthetic AWS data...")
    gen = AWSDataGenerator(station_id="AWS_Chennai_001", seed=42)
    df_train_raw = gen.generate_normal_data(
        start_date=datetime(2024, 1, 1),
        n_hours=cfg.TRAIN_HOURS,
    )
    df_train_raw = gen.inject_anomalies(df_train_raw, anomaly_fraction=cfg.ANOMALY_FRACTION)

    gen_test = AWSDataGenerator(station_id="AWS_Chennai_001", seed=123)
    df_test_raw = gen_test.generate_normal_data(
        start_date=datetime(2024, 7, 1),
        n_hours=cfg.TEST_HOURS,
    )
    df_test_raw = gen_test.inject_anomalies(df_test_raw, anomaly_fraction=cfg.ANOMALY_FRACTION)

    print(f"    Train: {len(df_train_raw):,} records | Anomaly rate: {df_train_raw['anomaly_label'].mean():.2%}")
    print(f"    Test:  {len(df_test_raw):,} records  | Anomaly rate: {df_test_raw['anomaly_label'].mean():.2%}")

    # ─── Step 2: Feature Engineering ─────────────────────────────────
    print("\n[2/6] Engineering features...")
    fe = AWSFeatureEngineer()
    df_train_feat = fe.transform(df_train_raw)
    df_test_feat  = fe.transform(df_test_raw)
    print(f"    Features generated: {len(fe.get_feature_names())}")

    # ─── Step 3: Train Ensemble ───────────────────────────────────────
    print("\n[3/6] Training SkyGuard Ensemble Detector...")
    detector = SkyGuardEnsemble()
    detector.fit(df_train_feat, df_train_feat["anomaly_label"].reset_index(drop=True))

    # ─── Step 4: Evaluate ─────────────────────────────────────────────
    print("\n[4/6] Evaluating on test set...")
    metrics = detector.evaluate(df_test_feat, df_test_feat["anomaly_label"].reset_index(drop=True))

    # ─── Step 5: Generate Results ──────────────────────────────────────
    print("\n[5/6] Generating detection results...")
    results_df = detector.predict(df_test_feat)
    results_df["station_id"] = "AWS_Chennai_001"
    results_df["anomaly_label"] = df_test_feat["anomaly_label"].values
    results_df["anomaly_type"] = df_test_feat["anomaly_type"].values if "anomaly_type" in df_test_feat.columns else "unknown"
    results_df.to_csv(cfg.DETECTION_RESULTS, index=False)
    print(f"    Saved: {cfg.DETECTION_RESULTS}")

    # ─── Step 6: Save Model ────────────────────────────────────────────
    print("\n[6/6] Saving model and visualizations...")
    detector.save(str(cfg.MODEL_PATH))

    # Generate plots
    _generate_evaluation_plots(results_df, df_test_raw, metrics)

    # Explainability report
    explainer = SkyGuardExplainer(detector)
    anomaly_indices = results_df[results_df["anomaly_flag"] == 1].index.tolist()
    if anomaly_indices:
        explanation = explainer.explain_instance(
            df_test_feat,
            instance_idx=anomaly_indices[0],
            top_k=10,
            plot=True,
            save_path=str(cfg.PLOTS_DIR / "anomaly_explanation.png"),
        )
        print(f"\n    Sample Anomaly Explanation (index {anomaly_indices[0]}):")
        for reason in explanation["top_reasons"]:
            print(f"      → {reason}")

    global_imp = explainer.global_feature_importance(save_path=str(cfg.PLOTS_DIR / "global_importance.png"))
    print(f"\n    Top 5 Important Features:")
    for feat, imp in list(global_imp.items())[:5]:
        print(f"      {feat}: {imp:.4f}")

    # Text report
    report = explainer.generate_report(results_df, df_test_feat)
    print("\n" + report)

    with open(cfg.DETECTION_REPORT, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"    Saved: {cfg.DETECTION_REPORT}")

    # Imputation demo
    imputer = AWSImputer()
    anomaly_mask = results_df["anomaly_flag"] == 1
    df_corrected = imputer.impute(df_test_raw.reset_index(drop=True), anomaly_mask.reset_index(drop=True))
    df_corrected.to_csv(cfg.CORRECTED_DATA_CSV, index=False)
    print(f"    Saved: {cfg.CORRECTED_DATA_CSV}")

    print("\n" + "=" * 65)
    print("   PIPELINE COMPLETE!")
    print("=" * 65)
    print(f"\n   Detection Metrics:")
    for k, v in metrics.items():
        print(f"     {k:12s}: {v:.4f}")
    print("\n   Output files: detection_results.csv, models/, plots/")
    print("   Start dashboard: python dashboard.py")
    print("=" * 65 + "\n")

    return detector, results_df, metrics


def _generate_evaluation_plots(results_df: pd.DataFrame, df_raw: pd.DataFrame, metrics: dict):
    """Generate comprehensive evaluation visualizations."""
    cfg.PLOTS_DIR.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(18, 14), facecolor="#1a1a2e")
    gs = gridspec.GridSpec(3, 3, figure=fig, hspace=0.45, wspace=0.35)

    colors = {
        "CRITICAL": "#e74c3c", "HIGH": "#e67e22",
        "MEDIUM": "#f39c12",   "LOW": "#3498db",
        "NORMAL": "#2ecc71",
    }

    # ── Plot 1: Temperature with anomaly markers ──────────────────────
    ax1 = fig.add_subplot(gs[0, :])
    ax1.set_facecolor("#16213e")
    results_df["timestamp"] = pd.to_datetime(results_df["timestamp"])

    if "temperature" in results_df.columns:
        ax1.plot(results_df["timestamp"], results_df["temperature"],
                 color="#e74c3c", alpha=0.8, linewidth=0.8, label="Temperature")

        for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            mask = (results_df["severity"] == sev)
            if mask.any():
                ax1.scatter(results_df.loc[mask, "timestamp"],
                            results_df.loc[mask, "temperature"],
                            color=colors[sev], s=40, zorder=5, label=sev, alpha=0.9)

    ax1.set_title("Temperature Time Series with Anomaly Detection", color="white", fontsize=12, fontweight="bold")
    ax1.tick_params(colors="white")
    ax1.set_facecolor("#16213e")
    for spine in ax1.spines.values():
        spine.set_color("#2c3e50")
    legend = ax1.legend(loc="upper right", fontsize=8)
    plt.setp(legend.get_texts(), color="white")
    legend.get_frame().set_facecolor("#16213e")

    # ── Plot 2: Confidence Score Distribution ─────────────────────────
    ax2 = fig.add_subplot(gs[1, 0])
    ax2.set_facecolor("#16213e")
    normal_scores = results_df[results_df["anomaly_label"] == 0]["confidence_score"]
    anomaly_scores = results_df[results_df["anomaly_label"] == 1]["confidence_score"]
    ax2.hist(normal_scores, bins=30, color="#2ecc71", alpha=0.7, label="Normal", density=True)
    ax2.hist(anomaly_scores, bins=30, color="#e74c3c", alpha=0.7, label="Anomaly", density=True)
    ax2.set_title("Confidence Score Distribution", color="white", fontsize=10)
    ax2.tick_params(colors="white")
    for spine in ax2.spines.values():
        spine.set_color("#2c3e50")
    legend2 = ax2.legend(fontsize=8)
    plt.setp(legend2.get_texts(), color="white")
    legend2.get_frame().set_facecolor("#16213e")

    # ── Plot 3: Severity Pie ──────────────────────────────────────────
    ax3 = fig.add_subplot(gs[1, 1])
    ax3.set_facecolor("#16213e")
    sev_counts = results_df[results_df["severity"] != "NORMAL"]["severity"].value_counts()
    if not sev_counts.empty:
        wedge_colors = [colors.get(s, "gray") for s in sev_counts.index]
        wedges, texts, autotexts = ax3.pie(
            sev_counts.values, labels=sev_counts.index,
            colors=wedge_colors, autopct="%1.0f%%",
            pctdistance=0.8, startangle=140,
        )
        for t in texts + autotexts:
            t.set_color("white")
            t.set_fontsize(8)
    ax3.set_title("Anomaly Severity Breakdown", color="white", fontsize=10)

    # ── Plot 4: Metrics Bar ───────────────────────────────────────────
    ax4 = fig.add_subplot(gs[1, 2])
    ax4.set_facecolor("#16213e")
    metric_names = ["Precision", "Recall", "F1-Score", "Accuracy", "ROC-AUC"]
    metric_vals = [metrics.get(k, 0) for k in ["precision", "recall", "f1_score", "accuracy", "roc_auc"]]
    bar_colors = ["#3498db", "#2ecc71", "#e74c3c", "#f39c12", "#9b59b6"]
    bars = ax4.bar(metric_names, metric_vals, color=bar_colors, alpha=0.85)
    ax4.set_ylim(0, 1.1)
    ax4.set_title("Detection Performance", color="white", fontsize=10)
    ax4.tick_params(colors="white", axis="both")
    ax4.set_xticklabels(metric_names, rotation=20, ha="right", fontsize=8)
    for spine in ax4.spines.values():
        spine.set_color("#2c3e50")
    for bar, val in zip(bars, metric_vals):
        ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                 f"{val:.2f}", ha="center", va="bottom", color="white", fontsize=9)

    # ── Plot 5: Anomaly Type Breakdown ────────────────────────────────
    ax5 = fig.add_subplot(gs[2, :2])
    ax5.set_facecolor("#16213e")
    if "anomaly_type" in results_df.columns:
        type_counts = results_df[results_df["anomaly_flag"] == 1]["anomaly_type"].value_counts().head(8)
        if not type_counts.empty:
            ax5.barh(type_counts.index, type_counts.values, color="#3498db", alpha=0.85)
            ax5.set_title("Detected Anomaly Types", color="white", fontsize=10)
            ax5.tick_params(colors="white")
            for spine in ax5.spines.values():
                spine.set_color("#2c3e50")

    # ── Plot 6: Pressure vs Humidity Scatter ──────────────────────────
    ax6 = fig.add_subplot(gs[2, 2])
    ax6.set_facecolor("#16213e")
    if all(c in results_df.columns for c in ["pressure", "humidity"]):
        normal_mask = results_df["anomaly_flag"] == 0
        ax6.scatter(results_df.loc[normal_mask, "pressure"],
                    results_df.loc[normal_mask, "humidity"],
                    c="#2ecc71", s=3, alpha=0.4, label="Normal")
        ax6.scatter(results_df.loc[~normal_mask, "pressure"],
                    results_df.loc[~normal_mask, "humidity"],
                    c="#e74c3c", s=15, alpha=0.8, label="Anomaly")
    ax6.set_xlabel("Pressure (hPa)", color="white", fontsize=9)
    ax6.set_ylabel("Humidity (%)", color="white", fontsize=9)
    ax6.set_title("Pressure vs Humidity", color="white", fontsize=10)
    ax6.tick_params(colors="white")
    for spine in ax6.spines.values():
        spine.set_color("#2c3e50")
    leg6 = ax6.legend(fontsize=8)
    plt.setp(leg6.get_texts(), color="white")
    leg6.get_frame().set_facecolor("#16213e")

    # Add overall title
    fig.suptitle(
        "SkyGuard AI — Anomaly Detection Evaluation Dashboard",
        color="white", fontsize=16, fontweight="bold", y=0.98,
    )

    plt.savefig(cfg.PLOTS_DIR / "evaluation_dashboard.png", dpi=150, bbox_inches="tight", facecolor="#1a1a2e")
    plt.close()
    print(f"    Saved: {cfg.PLOTS_DIR / 'evaluation_dashboard.png'}")


if __name__ == "__main__":
    detector, results_df, metrics = run_full_pipeline()
