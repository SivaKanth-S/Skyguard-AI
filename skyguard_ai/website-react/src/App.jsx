import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <RevealOnRoute />
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
                <Route
                  path="/location"
                  element={
                    <RequireAuth>
                      <LocationPage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
