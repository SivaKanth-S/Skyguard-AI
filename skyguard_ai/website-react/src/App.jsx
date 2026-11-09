import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotifyProvider } from './context/NotifyContext';
import { AnomalyProvider } from './context/AnomalyContext';
import { RoutePlannerProvider, useRoutePlanner } from './context/RoutePlannerContext';
import WebsiteNotifications from './components/WebsiteNotifications';
import useReveal from './hooks/useReveal';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import InsightsPage from './pages/InsightsPage';
import LocationPage from './pages/LocationPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import './styles/style.css';

// Only Live Location requires an account — every other route stays public.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-body">
        <div className="wrap">
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Checking session…
          </p>
        </div>
      </div>
    );
  }
  if (!user) {
    // Preserve query (?tab=route) so post-login redirects land on the right tab.
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

function RevealOnRoute() {
  const { pathname } = useLocation();
  useReveal(pathname);
  return null;
}

// Floating pill shown on every page except the planner itself while a route
// session is open. The planner never closes on navigation — this pill proves
// it is still running (with live tracking state) and jumps back to it.
function PersistentRoutePill() {
  const { mapOpened, route, tracking, start, end } = useRoutePlanner();
  const { pathname } = useLocation();
  if (!mapOpened && !route) return null;
  if (pathname === '/location' || pathname === '/route') return null;

  const short = (label) => {
    if (!label) return '—';
    const s = String(label).split(',')[0].trim();
    return s.length > 22 ? `${s.slice(0, 22)}…` : s;
  };

  return (
    <Link
      className="persistent-route-pill"
      to="/location"
      title="Back to Route Planner — your route is still open"
      style={{
        position: 'fixed',
        right: '14px',
        bottom: '14px',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '999px',
        background: 'var(--surface, #161b22)',
        border: '1px solid var(--border, #30363d)',
        boxShadow: '0 8px 28px rgba(0,0,0,.35)',
        color: 'var(--text, #e6edf3)',
        fontSize: '12.5px',
        fontWeight: 700,
        textDecoration: 'none',
        maxWidth: 'calc(100vw - 28px)',
      }}
    >
      <span
        style={{
          width: '9px',
          height: '9px',
          borderRadius: '50%',
          background: tracking ? '#2ecc71' : '#1a73e8',
          boxShadow: tracking ? '0 0 0 4px rgba(46,204,113,.2)' : 'none',
          flexShrink: 0,
        }}
      />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        🗺️ {short(start?.label)} → {short(end?.label)}
        {tracking ? ' · tracking' : route ? ' · route open' : ' · planner open'}
      </span>
      <span style={{ color: 'var(--accent, #58a6ff)', flexShrink: 0 }}>Resume →</span>
    </Link>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotifyProvider>
          {/* Single live-anomaly engine: dashboard + route planner (+ live
              location) all read the SAME fault zones, so readings match. */}
          <AnomalyProvider>
          {/* Planner state outlives page navigation: only an explicit Delete
              (or closing the program/tab, which clears sessionStorage) ends it. */}
          <RoutePlannerProvider>
          <BrowserRouter>
            <ScrollToTop />
            <RevealOnRoute />
            {/* Website-wide notification overlay — floats above every page/map */}
            <WebsiteNotifications />
            {/* Planner stays open across pages — Resume pill on other pages */}
            <PersistentRoutePill />
            <div className="app-container">
            <Navbar />
            <main>
              <Routes>
                {/* Multi-page navigation: one route per section */}
                <Route path="/" element={<HomePage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/signin" element={<AuthPage />} />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <ProfilePage />
                    </RequireAuth>
                  }
                />
                {/* Route planner (account required). /route kept as a
                    redirect so old links keep working. */}
                <Route
                  path="/location"
                  element={
                    <RequireAuth>
                      <LocationPage />
                    </RequireAuth>
                  }
                />
                <Route path="/route" element={<Navigate to="/location" replace />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </main>
            </div>
          </BrowserRouter>
          </RoutePlannerProvider>
          </AnomalyProvider>
        </NotifyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
