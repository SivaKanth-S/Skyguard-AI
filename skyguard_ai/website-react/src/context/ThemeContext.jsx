import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const LIGHT_TOKENS = {
  '--bg':               '#f4f6fb',
  '--surface':          '#ffffff',
  '--surface2':         '#e9eef6',
  '--border':           '#d0d7de',
  '--text':             '#1f2328',
  '--muted':            '#57606a',
  '--accent':           '#0969da',
  '--green':            '#1a7f37',
  '--red':              '#cf222e',
  '--orange':           '#d46b08',
  '--yellow':           '#b58105',
  '--purple':           '#8250df',
  '--blue':             '#0969da',
  '--shadow':           '0 4px 20px rgba(140,149,159,.18)',
  '--grad':             'linear-gradient(135deg,#0969da,#1a7f37,#8250df)',
  '--nav-bg':           'rgba(255,255,255,.94)',
  '--map-overlay-bg':   'rgba(255,255,255,.94)',
  '--map-overlay-text': '#1f2328',
  '--card-hover-border':'rgba(9,105,218,.35)',
  '--badge-bg-alpha':   '.15',
  '--tooltip-bg':       '#ffffff',
  '--select-bg':        '#f6f8fa',
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('skyguard_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const isLight = theme === 'light';
    const root = document.documentElement;

    root.setAttribute('data-theme', isLight ? 'light' : 'dark');
    if (document.body) {
      document.body.classList.toggle('light-theme', isLight);
      document.body.style.backgroundColor = isLight ? '#f4f6fb' : '#0d1117';
      document.body.style.color = isLight ? '#1f2328' : '#e6edf3';
    }

    if (isLight) {
      Object.entries(LIGHT_TOKENS).forEach(([k, v]) => root.style.setProperty(k, v));
    } else {
      Object.keys(LIGHT_TOKENS).forEach(k => root.style.removeProperty(k));
    }

    try {
      localStorage.setItem('skyguard_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isLight: theme === 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
