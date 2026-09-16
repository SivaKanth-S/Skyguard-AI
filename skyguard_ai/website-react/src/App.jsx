import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import AnomaliesPage from './pages/AnomaliesPage';
import ArchitecturePage from './pages/ArchitecturePage';
import UseCasesPage from './pages/UseCasesPage';
import MetricsPage from './pages/MetricsPage';
import LocationPage from './pages/LocationPage';
import './styles/style.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="app-container">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/anomalies" element={<AnomaliesPage />} />
              <Route path="/architecture" element={<ArchitecturePage />} />
              <Route path="/usecases" element={<UseCasesPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/location" element={<LocationPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>
          <footer
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              borderTop: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: '12px',
              background: 'var(--surface)'
            }}
          >
            <div className="wrap">
              <p style={{ margin: 0 }}>
                ⚡ <strong>SkyGuard AI</strong> — Real-Time Anomaly Detection &amp; Self-Healing for Weather Stations.
              </p>
              <p style={{ margin: '6px 0 0', opacity: 0.8 }}>
                Built with React, Leaflet, Chart.js &amp; Open-Meteo Telemetry.
              </p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
