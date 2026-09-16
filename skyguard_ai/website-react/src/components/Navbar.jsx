import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { theme, toggleTheme, isLight } = useTheme();
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

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/analysis', label: 'Analysis' },
    { path: '/anomalies', label: 'Anomalies' },
    { path: '/architecture', label: 'Architecture' },
    { path: '/usecases', label: 'Use Cases' },
    { path: '/metrics', label: 'Metrics' },
    { path: '/location', label: 'Live Location' },
  ];

  return (
    <nav className={`nav ${isScrolled || location.pathname !== '/' ? 'scrolled' : ''}`} id="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          <span>⚡</span> SkyGuard <span style={{ color: 'var(--accent)' }}>AI</span>
        </Link>
        <ul className={`nav-links ${mobileMenuOpen ? 'open' : ''}`} id="navLinks">
          {navLinks.map(link => {
            const isActive = location.pathname === link.path;
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
        <Link to="/dashboard" className="btn btn-primary btn-sm nav-cta">
          Live Demo
        </Link>
        <button
          className={`burger ${mobileMenuOpen ? 'open' : ''}`}
          id="burger"
          aria-label="Toggle Navigation Menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}
