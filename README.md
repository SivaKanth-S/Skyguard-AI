# ⚡ SkyGuard AI

### Real-Time Anomaly Detection for Automatic Weather Stations

SkyGuard AI is a machine-learning project that detects unusual or faulty weather sensor readings from **Automatic Weather Stations (AWS)**.

It monitors **temperature, pressure, and humidity** and uses multiple detection techniques to identify anomalies, explain the cause, and estimate corrected values.

## ✨ Features

* 🌡️ Temperature, pressure & humidity monitoring
* 🚨 Detects different types of sensor anomalies
* 🧠 Machine Learning-based anomaly detection
* 🔎 Anomaly explanation and confidence scores
* 🩹 Corrected value estimation
* 📡 Real-time stream simulation
* 📊 Interactive Dash dashboard
* 🌐 React + Vite web application
* 🗄️ Optional MySQL support
* 🧪 Automated testing

## 🛠️ Technologies

**Backend & ML:** Python, Pandas, NumPy, Scikit-learn, SciPy, SHAP

**Frontend:** React, Vite, Chart.js, Leaflet

**Database:** MySQL / CSV

## 🚀 Quick Start

### Backend

```bash
cd skyguard_ai

python -m venv .venv
```

Activate the environment and install dependencies:

```bash
pip install -r requirements.txt
```

Train the model:

```bash
python run.py train
```

Run the dashboard:

```bash
python run.py dashboard
```

### Frontend

```bash
cd website-react
npm install
npm run dev
```

## 📊 Anomaly Types

* Spike
* Frozen Value
* Calibration Drift
* Out-of-Range
* Noise Burst
* Missing Data
* Multivariate Inconsistency

## 🎯 Project Goal

**Detect → Explain → Correct → Monitor**

The goal is to improve the reliability of weather-station data before it is used for forecasting, agriculture, aviation, disaster management, and other applications.

## ⚠️ Note

This project currently uses synthetic data and is intended as a prototype. Real-world deployment requires validation with actual weather-station data.

## 👥 Project

**SkyGuard AI**

Intelligent anomaly detection for Automatic Weather Stations.
