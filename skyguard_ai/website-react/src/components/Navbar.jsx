import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { toggleTheme, isLight } = useTheme();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile drawer on route change + lock body scroll while open.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', mobileMenuOpen);
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    if (mobileMenuOpen) {
      window.addEventListener('keydown', onKey);
    }
    return () => {
      document.body.classList.remove('nav-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/analysis', label: 'Analysis' },
    { path: '/insights', label: 'Insights' },
    { path: '/location', label: 'Route Planner' },
  ];
  const isLocActive = location.pathname === '/location' || location.pathname === '/route';

  return (
    <>
      <nav className={`nav ${isScrolled || location.pathname !== '/' ? 'scrolled' : ''}`} id="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <span>⚡</span> SkyGuard <span style={{ color: 'var(--accent)' }}>AI</span>
          </Link>
          <ul className={`nav-links ${mobileMenuOpen ? 'open' : ''}`} id="navLinks">
            {navLinks.map(link => {
              const isActive = link.path === '/location'
                ? isLocActive
                : location.pathname === link.path;
              return (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className={isActive ? 'on' : ''}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            {/* Mobile drawer copies — desktop bar versions hide on phones */}
            <li className="nav-drawer-cta">
              {user ? (
                <>
                  <Link to="/profile" className="btn btn-ghost btn-sm" onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </Link>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (window.confirm('Are you sure you want to sign out?')) signOut();
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/signin" className="btn btn-ghost btn-sm" onClick={() => setMobileMenuOpen(false)}>
                  Sign in
                </Link>
              )}
              <Link to="/dashboard" className="btn btn-primary btn-sm" onClick={() => setMobileMenuOpen(false)}>
                Live Demo
              </Link>
            </li>
          </ul>
          <button
            className="theme-toggle-btn"
            id="themeToggleBtn"
            aria-label={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            onClick={toggleTheme}
          >
            <span className="theme-icon" id="themeIcon">
              {isLight ? '☀️' : '🌙'}
            </span>
            <span className="theme-label" id="themeLabel">
              {isLight ? 'Light' : 'Dark'}
            </span>
          </button>
          {user ? (
            <div className="nav-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                to="/profile"
                title={user.displayName || user.email || 'Profile'}
                style={{ textDecoration: 'none' }}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', display: 'block', border: '1px solid var(--accent)' }}
                  />
                ) : (
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #58a6ff, #1f6feb)',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textTransform: 'uppercase',
                      userSelect: 'none',
                    }}
                  >
                    {((user.displayName || user.email || 'U').trim().charAt(0) || 'U')}
                  </span>
                )}
              </Link>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (window.confirm('Are you sure you want to sign out?')) signOut();
                }}
                title={`Sign out (${user.email || 'signed in'})`}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/signin" className="btn btn-ghost btn-sm nav-desktop-only">
              Sign in
            </Link>
          )}
          <Link to="/dashboard" className="btn btn-primary btn-sm nav-cta nav-desktop-only">
            Live Demo
          </Link>
          <button
            className={`burger ${mobileMenuOpen ? 'open' : ''}`}
            id="burger"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>
      {/* Mobile Drawer Backdrop Overlay */}
      <div
        className={`nav-backdrop ${mobileMenuOpen ? 'show' : ''}`}
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
      />
    </>
  );
}
