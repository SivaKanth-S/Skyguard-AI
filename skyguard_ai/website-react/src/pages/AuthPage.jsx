import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4); // 0..4
}

const STRENGTH = [
  { label: '', color: 'transparent' },
  { label: 'Weak', color: '#e74c3c' },
  { label: 'Fair', color: '#e67e22' },
  { label: 'Good', color: '#2ecc71' },
  { label: 'Strong', color: '#58a6ff' },
];

export default function AuthPage() {
  const { user, loading, configured, signUp, signIn, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/location';

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const strength = scorePassword(password);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!configured) {
      setError('Sign-in is not configured yet — add your Firebase keys to website-react/.env and restart the dev server.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="wrap">
        <div className="auth-card">
          {/* Brand panel */}
          <div className="auth-side">
            <div className="auth-logo">⚡ SkyGuard AI</div>
            <h2>
              {mode === 'signin' ? 'Welcome back.' : 'Join the watch.'}
            </h2>
            <p>
              Your account unlocks Live Location — real-time GPS tracking
              against the Tamil Nadu AWS network with geofenced threat alerts.
            </p>
            <ul className="auth-points">
              <li><span>📍</span> Live GPS + fault-zone proximity alerts</li>
              <li><span>🚨</span> Shockwave bursts the moment faults erupt</li>
              <li><span>🔒</span> Session stays signed in on this device</li>
            </ul>
            <div className="auth-stats">
              <div><strong>20</strong><small>stations</small></div>
              <div><strong>7</strong><small>fault types</small></div>
              <div><strong>98%</strong><small>ROC-AUC</small></div>
            </div>
          </div>

          {/* Form panel */}
          <div className="auth-form-wrap">
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === 'signin' ? 'on' : ''}`}
                onClick={() => { setMode('signin'); setError(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'signup' ? 'on' : ''}`}
                onClick={() => { setMode('signup'); setError(''); }}
              >
                Sign Up
              </button>
            </div>

            <h3>{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</h3>
            <p className="auth-sub">
              {mode === 'signin'
                ? 'Enter your credentials to return to the map.'
                : 'One account for the whole network. Takes 20 seconds.'}
            </p>

            <button
              type="button"
              className="auth-google"
              disabled={busy || loading}
              onClick={async () => {
                setError('');
                if (!configured) {
                  setError('Sign-in is not configured yet — add your Firebase keys to website-react/.env and restart the dev server.');
                  return;
                }
                setBusy(true);
                try {
                  await signInWithGoogle();
                  navigate(from, { replace: true });
                } catch (err) {
                  if (err.message) setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span className="auth-google-g">G</span>
              Continue with Google
            </button>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>

            {loading ? (
              <p className="auth-loading">
                <span className="loc-spinner-sm"></span> Checking session…
              </p>
            ) : (
              <form onSubmit={submit} noValidate>
                <label className="auth-label" htmlFor="auth-email">Email</label>
                <div className="auth-input">
                  <span className="auth-ico">✉️</span>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <label className="auth-label" htmlFor="auth-password">Password</label>
                <div className="auth-input">
                  <span className="auth-ico">🔑</span>
                  <input
                    id="auth-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-peek"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    title={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>

                {mode === 'signup' && password.length > 0 && (
                  <div className="auth-strength">
                    <div className="auth-strength-bar">
                      {[1, 2, 3, 4].map(i => (
                        <span
                          key={i}
                          style={{
                            background: i <= strength ? STRENGTH[strength].color : 'var(--surface2)',
                          }}
                        />
                      ))}
                    </div>
                    <small style={{ color: STRENGTH[strength].color }}>
                      {STRENGTH[strength].label} password
                    </small>
                  </div>
                )}

                {mode === 'signup' && (
                  <>
                    <label className="auth-label" htmlFor="auth-confirm">Confirm Password</label>
                    <div className="auth-input">
                      <span className="auth-ico">✅</span>
                      <input
                        id="auth-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-peek"
                        onClick={() => setShowConfirm(v => !v)}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                        title={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </>
                )}

                {error && (
                  <div className="auth-error" role="alert">
                    <span>⚠️</span>
                    <div>{error}</div>
                  </div>
                )}

                <button type="submit" className="auth-submit" disabled={busy}>
                  {busy ? (
                    <><span className="loc-spinner-sm"></span> Please wait…</>
                  ) : (
                    mode === 'signin' ? 'Sign In →' : 'Create Account →'
                  )}
                </button>

                <p className="auth-switch">
                  {mode === 'signin' ? (
                    <>New here? <button type="button" onClick={() => { setMode('signup'); setError(''); }}>Create an account</button></>
                  ) : (
                    <>Have an account? <button type="button" onClick={() => { setMode('signin'); setError(''); }}>Sign in</button></>
                  )}
                </p>
              </form>
            )}

            <p className="auth-secure">
              🔒 Protected by Firebase Authentication · sign-in alerts emailed to you ·{' '}
              <Link to="/">Back to Home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
