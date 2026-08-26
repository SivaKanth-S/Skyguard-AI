"""
SkyGuard AI - Interactive Visualization Dashboard
Built with Plotly Dash — runs in browser at http://localhost:8050

Usage:
    cd skyguard_ai/src
    python dashboard.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "configs"))

import numpy as np
import pandas as pd
import json
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, Input, Output, State, dash_table
import dash_bootstrap_components as dbc
import config as cfg

# ─────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────
app = dash.Dash(
    __name__,
    external_stylesheets=[dbc.themes.DARKLY],
    title="SkyGuard AI — AWS Anomaly Detection",
    suppress_callback_exceptions=True,
)

# ─────────────────────────────────────────
# Color Palette
# ─────────────────────────────────────────
COLORS = {
    "CRITICAL": "#e74c3c",
    "HIGH":     "#e67e22",
    "MEDIUM":   "#f39c12",
    "LOW":      "#3498db",
    "NORMAL":   "#2ecc71",
    "bg":       "#1a1a2e",
    "card":     "#16213e",
    "text":     "#ecf0f1",
    "accent":   "#0f3460",
    "temp":     "#e74c3c",
    "pressure": "#3498db",
    "humidity": "#2ecc71",
}

SEVERITY_ORDER = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "NORMAL": 0}

# ─────────────────────────────────────────
# Layout
# ─────────────────────────────────────────
def severity_badge(severity: str) -> html.Span:
    color = COLORS.get(severity, "#7f8c8d")
    return html.Span(
        severity,
        style={
            "background": color,
            "color": "white",
            "padding": "2px 10px",
            "borderRadius": "12px",
            "fontSize": "12px",
            "fontWeight": "bold",
        }
    )


app.layout = dbc.Container(
    fluid=True,
    style={"backgroundColor": COLORS["bg"], "minHeight": "100vh", "padding": "20px"},
    children=[

        # Header
        dbc.Row([
            dbc.Col([
                html.Div([
                    html.H1("🌩 SkyGuard AI", style={"color": COLORS["text"], "margin": 0}),
                    html.P(
                        "Intelligent Real-Time Anomaly Detection for Automatic Weather Stations",
                        style={"color": "#7f8c8d", "margin": 0, "fontSize": "14px"},
                    ),
                ])
            ], width=8),
            dbc.Col([
                html.Div([
                    dbc.Badge("● LIVE", color="success", className="me-2", style={"fontSize": "14px"}),
                    html.Span(id="last-update-time", style={"color": "#7f8c8d", "fontSize": "12px"}),
                ], style={"textAlign": "right", "paddingTop": "10px"})
            ], width=4),
        ], className="mb-4"),

        # Station Selector + Controls
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.Label("Select Station", style={"color": COLORS["text"]}),
                        dcc.Dropdown(
                            id="station-dropdown",
                            options=[
                                {"label": "AWS Chennai 001", "value": "AWS_Chennai_001"},
                                {"label": "AWS Mumbai 002", "value": "AWS_Mumbai_002"},
                                {"label": "AWS Delhi 003",   "value": "AWS_Delhi_003"},
                                {"label": "All Stations",   "value": "ALL"},
                            ],
                            value="AWS_Chennai_001",
                            style={"color": "#000"},
                        ),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=4),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.Label("Time Range", style={"color": COLORS["text"]}),
                        dcc.Dropdown(
                            id="time-range-dropdown",
                            options=[
                                {"label": "Last 6 Hours",  "value": 36},
                                {"label": "Last 24 Hours", "value": 144},
                                {"label": "Last 3 Days",   "value": 432},
                                {"label": "Last 7 Days",   "value": 1008},
                            ],
                            value=144,
                            style={"color": "#000"},
                        ),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=4),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.Label("Auto Refresh", style={"color": COLORS["text"]}),
                        dbc.Switch(id="auto-refresh-switch", value=True, label="Enable"),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=4),
        ], className="mb-3"),

        # KPI Cards
        dbc.Row([
            dbc.Col(dbc.Card(id="kpi-total",    style={"backgroundColor": COLORS["card"], "border": "none", "textAlign": "center"}), width=3),
            dbc.Col(dbc.Card(id="kpi-anomalies",style={"backgroundColor": COLORS["card"], "border": "none", "textAlign": "center"}), width=3),
            dbc.Col(dbc.Card(id="kpi-critical", style={"backgroundColor": COLORS["card"], "border": "none", "textAlign": "center"}), width=3),
            dbc.Col(dbc.Card(id="kpi-health",   style={"backgroundColor": COLORS["card"], "border": "none", "textAlign": "center"}), width=3),
        ], className="mb-3"),

        # Main Charts
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.H5("📈 Sensor Time Series with Anomaly Markers",
                                style={"color": COLORS["text"]}),
                        dcc.Graph(id="timeseries-chart", style={"height": "400px"}),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=12),
        ], className="mb-3"),

        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.H5("🎯 Anomaly Confidence Score", style={"color": COLORS["text"]}),
                        dcc.Graph(id="confidence-chart", style={"height": "250px"}),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=8),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.H5("📊 Severity Breakdown", style={"color": COLORS["text"]}),
                        dcc.Graph(id="severity-pie", style={"height": "250px"}),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=4),
        ], className="mb-3"),

        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.H5("🔗 Parameter Correlation (3D Scatter)", style={"color": COLORS["text"]}),
                        dcc.Graph(id="scatter-3d", style={"height": "380px"}),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=6),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.H5("🏥 Station Health Status", style={"color": COLORS["text"]}),
                        html.Div(id="station-health-panel"),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=6),
        ], className="mb-3"),

        # Anomaly Alert Table
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.H5("🚨 Recent Anomaly Alerts", style={"color": COLORS["text"]}),
                        html.Div(id="alert-table"),
                    ])
                ], style={"backgroundColor": COLORS["card"], "border": "none"}),
            ], width=12),
        ]),

        # Auto-refresh interval
        dcc.Interval(id="refresh-interval", interval=10_000, n_intervals=0),

        # Data store
        dcc.Store(id="detection-data-store"),
    ]
)

# ─────────────────────────────────────────
# Data Loading Helper
# ─────────────────────────────────────────
def load_detection_data(station_id: str, n_steps: int) -> pd.DataFrame:
    """Load pre-computed detection results or generate fresh ones."""
    try:
        df = pd.read_csv(cfg.DETECTION_RESULTS, parse_dates=["timestamp"])
        if station_id != "ALL":
            df = df[df["station_id"] == station_id]
        return df.tail(n_steps).reset_index(drop=True)
    except FileNotFoundError:
        # Generate demo data
        return _generate_demo_data(station_id, n_steps)


def _generate_demo_data(station_id: str, n_steps: int) -> pd.DataFrame:
    """Generate demo detection results for dashboard preview."""
    np.random.seed(42)
    from data_generator import AWSDataGenerator
    from feature_engineering import AWSFeatureEngineer

    sid = station_id if station_id != "ALL" else "AWS_Demo"
    gen = AWSDataGenerator(station_id=sid, seed=42)
    df_raw = gen.generate_normal_data(
        start_date=datetime.now() - timedelta(minutes=10 * n_steps),
        n_hours=n_steps // 6 + 1,
    )
    df_raw = gen.inject_anomalies(df_raw, anomaly_fraction=0.04)

    # Create mock detection results
    df_raw["anomaly_flag"] = df_raw["anomaly_label"]
    df_raw["confidence_score"] = np.where(
        df_raw["anomaly_label"] == 1,
        np.random.uniform(0.5, 0.98, len(df_raw)),
        np.random.uniform(0.0, 0.20, len(df_raw)),
    )
    df_raw["severity"] = "NORMAL"
    df_raw.loc[df_raw["confidence_score"] > 0.85, "severity"] = "CRITICAL"
    df_raw.loc[(df_raw["confidence_score"] > 0.65) & (df_raw["confidence_score"] <= 0.85), "severity"] = "HIGH"
    df_raw.loc[(df_raw["confidence_score"] > 0.45) & (df_raw["confidence_score"] <= 0.65), "severity"] = "MEDIUM"
    df_raw.loc[(df_raw["confidence_score"] > 0.25) & (df_raw["confidence_score"] <= 0.45), "severity"] = "LOW"
    df_raw["root_cause"] = df_raw["anomaly_type"].map({
        "normal": "None",
        "spike_temperature": "Spike / Transient Fault - Temperature",
        "frozen_temperature": "Sensor Frozen - Temperature",
        "drift_temperature": "Calibration Drift - Temperature",
        "out_of_range_temperature": "Physical Impossibility - Temperature",
        "noise_burst_temperature": "Noise Burst - Temperature",
        "missing_data": "Communication Error",
        "multivariate_inconsistency": "Multivariate Inconsistency",
    }).fillna("Unknown Anomaly")

    return df_raw.tail(n_steps).reset_index(drop=True)


# ─────────────────────────────────────────
# Callbacks
# ─────────────────────────────────────────
@app.callback(
    Output("refresh-interval", "disabled"),
    Input("auto-refresh-switch", "value"),
)
def toggle_refresh(enabled):
    return not enabled


@app.callback(
    Output("detection-data-store", "data"),
    Input("refresh-interval", "n_intervals"),
    Input("station-dropdown", "value"),
    Input("time-range-dropdown", "value"),
)
def update_data_store(n, station_id, n_steps):
    df = load_detection_data(station_id, n_steps)
    return df.to_json(date_format="iso", orient="records")


@app.callback(
    Output("last-update-time", "children"),
    Input("refresh-interval", "n_intervals"),
)
def update_time(n):
    return f"Last updated: {datetime.now().strftime('%H:%M:%S')}"


@app.callback(
    [Output("kpi-total", "children"),
     Output("kpi-anomalies", "children"),
     Output("kpi-critical", "children"),
     Output("kpi-health", "children")],
    Input("detection-data-store", "data"),
)
def update_kpis(data):
    if not data:
        return [html.Div("—")] * 4

    df = pd.DataFrame(json.loads(data))
    total = len(df)
    anomalies = df["anomaly_flag"].sum() if "anomaly_flag" in df.columns else 0
    critical = (df["severity"] == "CRITICAL").sum() if "severity" in df.columns else 0
    rate = anomalies / total if total > 0 else 0
    health = "🟢 HEALTHY" if rate < 0.02 else "🟡 DEGRADED" if rate < 0.08 else "🔴 FAULT"

    def make_kpi(title, value, color="#ecf0f1", subtitle=""):
        return dbc.CardBody([
            html.P(title, style={"color": "#7f8c8d", "fontSize": "12px", "margin": 0}),
            html.H3(str(value), style={"color": color, "margin": "4px 0"}),
            html.P(subtitle, style={"color": "#7f8c8d", "fontSize": "11px", "margin": 0}),
        ])

    return [
        make_kpi("Total Readings", total, subtitle="in selected window"),
        make_kpi("Anomalies", f"{anomalies} ({rate:.1%})", COLORS["HIGH"]),
        make_kpi("Critical Alerts", critical, COLORS["CRITICAL"]),
        make_kpi("Station Health", health),
    ]


@app.callback(
    Output("timeseries-chart", "figure"),
    Input("detection-data-store", "data"),
)
def update_timeseries(data):
    if not data:
        return go.Figure()

    df = pd.DataFrame(json.loads(data))
    if "timestamp" not in df.columns:
        return go.Figure()

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    fig = make_subplots(
        rows=3, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.05,
        subplot_titles=["Temperature (°C)", "Pressure (hPa)", "Humidity (%)"],
    )

    param_config = [
        ("temperature", COLORS["temp"],     1),
        ("pressure",    COLORS["pressure"], 2),
        ("humidity",    COLORS["humidity"], 3),
    ]

    anomaly_df = df[df.get("anomaly_flag", pd.Series(0, index=df.index)) == 1] if "anomaly_flag" in df.columns else pd.DataFrame()

    for param, color, row in param_config:
        if param not in df.columns:
            continue

        # Normal line
        fig.add_trace(go.Scatter(
            x=df["timestamp"], y=df[param],
            mode="lines", name=param.capitalize(),
            line=dict(color=color, width=1.5),
            showlegend=(row == 1),
        ), row=row, col=1)

        # Anomaly markers
        if not anomaly_df.empty and param in anomaly_df.columns:
            sev_colors = anomaly_df.get("severity", pd.Series("HIGH", index=anomaly_df.index)).map(COLORS).fillna(COLORS["HIGH"])
            fig.add_trace(go.Scatter(
                x=anomaly_df["timestamp"], y=anomaly_df[param],
                mode="markers", name="Anomaly",
                marker=dict(color=sev_colors.tolist(), size=8, symbol="circle-open", line=dict(width=2)),
                showlegend=(row == 1),
                hovertemplate=(
                    f"<b>%{{x}}</b><br>{param}: %{{y}}<br>"
                    "Severity: %{customdata[0]}<br>"
                    "Confidence: %{customdata[1]:.1%}<br>"
                    "Cause: %{customdata[2]}<extra></extra>"
                ),
                customdata=np.column_stack([
                    anomaly_df.get("severity", ["?"] * len(anomaly_df)),
                    anomaly_df.get("confidence_score", [0] * len(anomaly_df)),
                    anomaly_df.get("root_cause", ["?"] * len(anomaly_df)),
                ]),
            ), row=row, col=1)

    fig.update_layout(
        plot_bgcolor=COLORS["card"],
        paper_bgcolor=COLORS["card"],
        font=dict(color=COLORS["text"]),
        margin=dict(l=50, r=20, t=40, b=20),
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    for i in range(1, 4):
        fig.update_xaxes(gridcolor="#2c3e50", row=i, col=1)
        fig.update_yaxes(gridcolor="#2c3e50", row=i, col=1)

    return fig


@app.callback(
    Output("confidence-chart", "figure"),
    Input("detection-data-store", "data"),
)
def update_confidence(data):
    if not data:
        return go.Figure()

    df = pd.DataFrame(json.loads(data))
    if "timestamp" not in df.columns or "confidence_score" not in df.columns:
        return go.Figure()

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    sev_color = df.get("severity", pd.Series("NORMAL", index=df.index)).map(COLORS).fillna(COLORS["NORMAL"])

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df["timestamp"], y=df["confidence_score"],
        fill="tozeroy",
        mode="lines",
        line=dict(color="#3498db", width=1),
        fillcolor="rgba(52, 152, 219, 0.15)",
        name="Confidence",
    ))
    # Threshold lines
    for level, thresh in [("Critical", 0.85), ("High", 0.65), ("Medium", 0.45)]:
        fig.add_hline(y=thresh, line_dash="dot", line_color=COLORS.get(level.upper(), "gray"),
                      annotation_text=level, annotation_position="right")

    # Anomaly points
    anoms = df[df.get("anomaly_flag", pd.Series(0, index=df.index)) == 1] if "anomaly_flag" in df.columns else pd.DataFrame()
    if not anoms.empty:
        fig.add_trace(go.Scatter(
            x=anoms["timestamp"], y=anoms["confidence_score"],
            mode="markers",
            marker=dict(color=anoms.get("severity", pd.Series("HIGH")).map(COLORS).fillna(COLORS["HIGH"]).tolist(),
                        size=7, symbol="diamond"),
            name="Anomaly",
        ))

    fig.update_layout(
        plot_bgcolor=COLORS["card"], paper_bgcolor=COLORS["card"],
        font=dict(color=COLORS["text"]),
        margin=dict(l=50, r=60, t=20, b=40),
        yaxis=dict(range=[0, 1], title="Confidence"),
        showlegend=False,
    )
    fig.update_xaxes(gridcolor="#2c3e50")
    fig.update_yaxes(gridcolor="#2c3e50")
    return fig


@app.callback(
    Output("severity-pie", "figure"),
    Input("detection-data-store", "data"),
)
def update_severity_pie(data):
    if not data:
        return go.Figure()

    df = pd.DataFrame(json.loads(data))
    if "severity" not in df.columns:
        return go.Figure()

    counts = df[df["severity"] != "NORMAL"]["severity"].value_counts()
    if counts.empty:
        fig = go.Figure()
        fig.add_annotation(text="No anomalies detected", showarrow=False,
                           font=dict(color=COLORS["NORMAL"], size=14))
    else:
        fig = go.Figure(go.Pie(
            labels=counts.index,
            values=counts.values,
            marker=dict(colors=[COLORS.get(s, "#gray") for s in counts.index]),
            hole=0.4,
            textfont=dict(size=12),
        ))

    fig.update_layout(
        plot_bgcolor=COLORS["card"], paper_bgcolor=COLORS["card"],
        font=dict(color=COLORS["text"]),
        margin=dict(l=10, r=10, t=10, b=10),
        showlegend=True,
        legend=dict(font=dict(size=10)),
    )
    return fig


@app.callback(
    Output("scatter-3d", "figure"),
    Input("detection-data-store", "data"),
)
def update_scatter3d(data):
    if not data:
        return go.Figure()

    df = pd.DataFrame(json.loads(data))
    required = {"temperature", "pressure", "humidity"}
    if not required.issubset(df.columns):
        return go.Figure()

    df = df.dropna(subset=["temperature", "pressure", "humidity"])
    color_vals = df.get("confidence_score", pd.Series(0, index=df.index))
    marker_symbols = df.get("anomaly_flag", pd.Series(0, index=df.index)).map(
        {0: "circle", 1: "diamond"}
    ).fillna("circle")

    fig = go.Figure(go.Scatter3d(
        x=df["temperature"],
        y=df["pressure"],
        z=df["humidity"],
        mode="markers",
        marker=dict(
            size=4,
            color=color_vals,
            colorscale=[[0, "#2ecc71"], [0.5, "#f39c12"], [1, "#e74c3c"]],
            colorbar=dict(title="Anomaly<br>Score", len=0.6),
            opacity=0.7,
            symbol=marker_symbols.tolist(),
        ),
        hovertemplate=(
            "T: %{x:.1f}°C<br>P: %{y:.1f} hPa<br>H: %{z:.1f}%<extra></extra>"
        ),
    ))

    fig.update_layout(
        scene=dict(
            xaxis_title="Temperature (°C)",
            yaxis_title="Pressure (hPa)",
            zaxis_title="Humidity (%)",
            bgcolor=COLORS["card"],
        ),
        plot_bgcolor=COLORS["card"], paper_bgcolor=COLORS["card"],
        font=dict(color=COLORS["text"]),
        margin=dict(l=0, r=0, t=20, b=0),
    )
    return fig


@app.callback(
    Output("station-health-panel", "children"),
    Input("detection-data-store", "data"),
    Input("station-dropdown", "value"),
)
def update_station_health(data, station_id):
    stations = ["AWS_Chennai_001", "AWS_Mumbai_002", "AWS_Delhi_003"]
    if station_id != "ALL":
        stations = [station_id]

    if not data:
        return html.P("No data", style={"color": COLORS["text"]})

    df = pd.DataFrame(json.loads(data))

    cards = []
    for sid in stations:
        station_df = df[df["station_id"] == sid] if "station_id" in df.columns else df
        total = len(station_df)
        anomalies = station_df.get("anomaly_flag", pd.Series(0)).sum() if "anomaly_flag" in station_df.columns else 0
        rate = anomalies / total if total > 0 else 0.0

        if rate < 0.02:
            status, color = "HEALTHY", COLORS["NORMAL"]
        elif rate < 0.08:
            status, color = "DEGRADED", COLORS["MEDIUM"]
        elif rate < 0.20:
            status, color = "FAULT", COLORS["HIGH"]
        else:
            status, color = "CRITICAL", COLORS["CRITICAL"]

        cards.append(
            dbc.Card([
                dbc.CardBody([
                    html.Div([
                        html.Strong(sid, style={"color": COLORS["text"], "fontSize": "13px"}),
                        html.Span(status, style={
                            "background": color, "color": "white",
                            "padding": "2px 8px", "borderRadius": "10px",
                            "fontSize": "11px", "marginLeft": "8px",
                        }),
                    ]),
                    html.Small(
                        f"Readings: {total} | Anomalies: {int(anomalies)} ({rate:.1%})",
                        style={"color": "#7f8c8d"},
                    ),
                ])
            ], style={"backgroundColor": COLORS["accent"], "border": "none", "marginBottom": "8px"})
        )

    return cards


@app.callback(
    Output("alert-table", "children"),
    Input("detection-data-store", "data"),
)
def update_alert_table(data):
    if not data:
        return html.P("No alerts", style={"color": COLORS["text"]})

    df = pd.DataFrame(json.loads(data))
    if "anomaly_flag" not in df.columns:
        return html.P("No alerts", style={"color": COLORS["text"]})

    anomalies = df[df["anomaly_flag"] == 1].copy()
    if anomalies.empty:
        return html.P("✅ No anomalies detected in selected window",
                      style={"color": COLORS["NORMAL"], "fontSize": "14px"})

    anomalies = anomalies.nlargest(20, "confidence_score")

    columns = ["timestamp", "station_id", "temperature", "pressure", "humidity",
               "severity", "confidence_score", "root_cause"]
    existing_cols = [c for c in columns if c in anomalies.columns]
    display_df = anomalies[existing_cols].copy()

    if "confidence_score" in display_df.columns:
        display_df["confidence_score"] = display_df["confidence_score"].apply(lambda x: f"{x:.1%}")
    if "timestamp" in display_df.columns:
        display_df["timestamp"] = pd.to_datetime(display_df["timestamp"]).dt.strftime("%Y-%m-%d %H:%M")

    table = dash_table.DataTable(
        data=display_df.to_dict("records"),
        columns=[{"name": c.replace("_", " ").title(), "id": c} for c in display_df.columns],
        style_table={"overflowX": "auto"},
        style_cell={
            "backgroundColor": COLORS["accent"],
            "color": COLORS["text"],
            "fontSize": "12px",
            "padding": "6px 12px",
            "border": "1px solid #2c3e50",
            "textAlign": "left",
        },
        style_header={
            "backgroundColor": "#0a2342",
            "color": COLORS["text"],
            "fontWeight": "bold",
            "border": "1px solid #2c3e50",
        },
        style_data_conditional=[
            {"if": {"filter_query": '{severity} = "CRITICAL"'}, "backgroundColor": "#3d1a1a", "color": COLORS["CRITICAL"]},
            {"if": {"filter_query": '{severity} = "HIGH"'},     "backgroundColor": "#3d2b1a", "color": COLORS["HIGH"]},
            {"if": {"filter_query": '{severity} = "MEDIUM"'},   "backgroundColor": "#3d351a", "color": COLORS["MEDIUM"]},
        ],
        page_size=10,
        sort_action="native",
        filter_action="native",
    )
    return table


# ─────────────────────────────────────────
# Run
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*60)
    print("  SkyGuard AI Dashboard")
    print("  URL: http://localhost:8050")
    print("="*60 + "\n")
    app.run(debug=False, host="0.0.0.0", port=8050)
