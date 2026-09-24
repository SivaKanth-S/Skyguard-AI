import React, { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { auth, firebaseApp } from '../lib/firebase';

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export default function ProfilePage() {
  const { user, loading, signOut, refresh } = useAuth();
  const [name, setName] = useState(null); // lazy-init from user below
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null); // { kind: 'ok' | 'err', text }
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [preview, setPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef(null);

  if (!loading && !user) {
    return <Navigate to="/signin" replace state={{ from: '/profile' }} />;
  }

  const displayName = name === null ? (user?.displayName || '') : name;
  const providers = (user?.providerData || []).map(p => p.providerId);
  const hasPassword = providers.includes('password');
  const initial = ((user?.displayName || user?.email || 'U').trim().charAt(0) || 'U').toUpperCase();

  const say = (kind, text) => setNotice({ kind, text });

  const saveName = async (e) => {
    e.preventDefault();
    if (!auth?.currentUser) return;
    const value = displayName.trim();
    if (!value) {
      say('err', 'Please enter a display name.');
      return;
    }
    setBusy('name');
    setNotice(null);
    try {
      await updateProfile(auth.currentUser, { displayName: value });
      await refresh();
      say('ok', 'Display name updated.');
    } catch (err) {
      say('err', err?.message || 'Could not update name. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    setPhotoFile(null);
    setPreview(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      say('err', 'Please choose an image file (JPG/PNG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      say('err', 'Photo must be under 2 MB.');
      return;
    }
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async () => {
    if (!photoFile || !auth?.currentUser || !firebaseApp) return;
    setBusy('photo');
    setNotice(null);
    try {
      const storage = getStorage(firebaseApp);
      const path = `avatars/${auth.currentUser.uid}/photo_${Date.now()}`;
      await uploadBytes(ref(storage, path), photoFile, { contentType: photoFile.type });
      const url = await getDownloadURL(ref(storage, path));
      await updateProfile(auth.currentUser, { photoURL: url });
      await refresh();
      setPhotoFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      say('ok', 'Profile photo updated.');
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('storage/unauthorized') || code.includes('storage/unknown')) {
        say('err', 'Storage blocked the upload — in Firebase console open Storage → Get started, then allow signed-in users to write their own avatars/ folder.');
      } else {
        say('err', err?.message || 'Could not upload photo. Please try again.');
      }
    } finally {
      setBusy('');
    }
  };

  const removePhoto = async () => {
    if (!auth?.currentUser) return;
    setBusy('photo');
    setNotice(null);
    try {
      const current = auth.currentUser.photoURL || '';
      await updateProfile(auth.currentUser, { photoURL: '' });
      // Best-effort cleanup of the stored file (only for our own bucket URLs).
      const m = current.match(/\/o\/([^?]+)/);
      if (m && firebaseApp) {
        try {
          await deleteObject(ref(getStorage(firebaseApp), decodeURIComponent(m[1])));
        } catch { /* file may already be gone */ }
      }
      await refresh();
      setPhotoFile(null);
      setPreview(null);
      say('ok', 'Profile photo removed.');
    } catch (err) {
      say('err', err?.message || 'Could not remove photo. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const verifyEmail = async () => {
    if (!auth?.currentUser) return;
    setBusy('verify');
    setNotice(null);
    try {
      await sendEmailVerification(auth.currentUser);
      say('ok', `Verification email sent to ${auth.currentUser.email}. Check inbox + spam.`);
    } catch (err) {
      say('err', err?.message || 'Could not send verification email.');
    } finally {
      setBusy('');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!auth?.currentUser) return;
    if (pw.next.length < 6) {
      say('err', 'New password must be at least 6 characters.');
      return;
    }
    if (pw.next !== pw.confirm) {
      say('err', 'New passwords do not match.');
      return;
    }
    setBusy('pw');
    setNotice(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, pw.current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      say('ok', 'Password changed successfully.');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        say('err', 'Current password is incorrect.');
      } else if (code === 'auth/weak-password') {
        say('err', 'New password is too weak (min. 6 characters).');
      } else {
        say('err', err?.message || 'Could not change password.');
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <div className="page-hero">
        <div className="wrap page-hero-row">
          <div>
            <div className="label">Account</div>
            <h1 className="page-title">Profile</h1>
            <p className="page-desc">
              Your SkyGuard AI identity — photo, name, sign-in status, and password.
            </p>
          </div>
          <div className="page-stat">
            <span className="big">{user?.emailVerified ? '✓' : '!'}</span>
            <small>{user?.emailVerified ? 'Verified' : 'Unverified'}</small>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="wrap" style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {notice && (
            <div
              className={`loc-alert-item ${notice.kind === 'ok' ? 'safe' : 'critical'}`}
              role="alert"
            >
              <div className="loc-alert-text">
                <strong>{notice.text}</strong>
              </div>
            </div>
          )}

          {loading || !user ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading profile…</p>
          ) : (
            <>
              {/* PHOTO */}
              <div className="card" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '14px', margin: '0 0 14px' }}>📷 Profile Photo</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                  {preview || user.photoURL ? (
                    <img
                      src={preview || user.photoURL}
                      alt="Profile"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }}
                    />
                  ) : (
                    <span
                      style={{
                        width: '84px', height: '84px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #58a6ff, #1f6feb)',
                        color: '#fff', fontSize: '34px', fontWeight: '800',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {initial}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={pickPhoto}
                      style={{ display: 'none' }}
                    />
                    <button className="loc-btn" onClick={() => fileRef.current?.click()}>
                      Choose Photo
                    </button>
                    {photoFile && (
                      <button className="loc-btn primary" onClick={uploadPhoto} disabled={busy === 'photo'}>
                        {busy === 'photo' ? 'Uploading…' : 'Upload'}
                      </button>
                    )}
                    {user.photoURL && (
                      <button className="loc-btn danger" onClick={removePhoto} disabled={busy === 'photo'}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '12px 0 0' }}>
                  JPG/PNG under 2 MB. Stored in your Firebase Storage avatars folder.
                </p>
              </div>

              {/* NAME */}
              <div className="card" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '14px', margin: '0 0 14px' }}>👤 Display Name</h3>
                <form onSubmit={saveName}>
                  <div className="auth-input">
                    <input
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={60}
                    />
                  </div>
                  <div className="rm-actions" style={{ marginTop: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Shown on your account chip and alerts.
                    </span>
                    <button type="submit" className="rm-confirm" disabled={busy === 'name'}>
                      {busy === 'name' ? 'Saving…' : 'Save Name'}
                    </button>
                  </div>
                </form>
              </div>

              {/* EMAIL + STATUS */}
              <div className="card" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '14px', margin: '0 0 14px' }}>📧 Email & Status</h3>
                <div className="mip-rows">
                  <div className="mip-row">
                    <span className="mip-label">Email</span>
                    <span className="mip-val">{user.email || '—'}</span>
                  </div>
                  <div className="mip-row">
                    <span className="mip-label">Status</span>
                    <span
                      className="mip-sev"
                      style={{
                        background: user.emailVerified ? 'rgba(46,204,113,.15)' : 'rgba(243,156,18,.15)',
                        color: user.emailVerified ? 'var(--green)' : 'var(--orange)',
                      }}
                    >
                      {user.emailVerified ? '✓ VERIFIED' : '! UNVERIFIED'}
                    </span>
                  </div>
                  <div className="mip-row">
                    <span className="mip-label">Sign-in method</span>
                    <span className="mip-val">{providers.includes('google.com') ? 'Google' : ''}{providers.includes('google.com') && hasPassword ? ' + ' : ''}{hasPassword ? 'Email/Password' : ''}{providers.length === 0 ? '—' : ''}</span>
                  </div>
                  <div className="mip-row">
                    <span className="mip-label">Member since</span>
                    <span className="mip-val">{fmtDate(user.metadata?.creationTime)}</span>
                  </div>
                  <div className="mip-row">
                    <span className="mip-label">Last sign-in</span>
                    <span className="mip-val">{fmtDate(user.metadata?.lastSignInTime)}</span>
                  </div>
                </div>
                {!user.emailVerified && (
                  <div className="rm-actions" style={{ marginTop: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Verify to confirm account ownership.
                    </span>
                    <button className="rm-confirm" onClick={verifyEmail} disabled={busy === 'verify'}>
                      {busy === 'verify' ? 'Sending…' : 'Send Verification Email'}
                    </button>
                  </div>
                )}
              </div>

              {/* PASSWORD */}
              <div className="card" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '14px', margin: '0 0 14px' }}>🔑 {hasPassword ? 'Change Password' : 'Password'}</h3>
                {hasPassword ? (
                  <form onSubmit={changePassword}>
                    <label className="auth-label" htmlFor="pw-current">Current Password</label>
                    <div className="auth-input">
                      <input
                        id="pw-current"
                        type="password"
                        autoComplete="current-password"
                        value={pw.current}
                        onChange={(e) => setPw({ ...pw, current: e.target.value })}
                        required
                      />
                    </div>
                    <label className="auth-label" htmlFor="pw-next">New Password</label>
                    <div className="auth-input">
                      <input
                        id="pw-next"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Min. 6 characters"
                        value={pw.next}
                        onChange={(e) => setPw({ ...pw, next: e.target.value })}
                        required
                      />
                    </div>
                    <label className="auth-label" htmlFor="pw-confirm">Confirm New Password</label>
                    <div className="auth-input">
                      <input
                        id="pw-confirm"
                        type="password"
                        autoComplete="new-password"
                        value={pw.confirm}
                        onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                        required
                      />
                    </div>
                    <div className="rm-actions" style={{ marginTop: '14px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Re-authenticates, then updates instantly.
                      </span>
                      <button type="submit" className="rm-confirm" disabled={busy === 'pw'}>
                        {busy === 'pw' ? 'Updating…' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    You signed in with <strong>Google</strong>, so there is no SkyGuard password to change —
                    manage it in your Google Account instead.
                  </p>
                )}
              </div>

              {/* SESSION */}
              <div className="card" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block' }}>Session</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Signed in on this device. Sign out to end it.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link to="/location" className="loc-btn primary" style={{ textDecoration: 'none' }}>
                      Open Live Location
                    </Link>
                    <button className="loc-btn danger" onClick={() => signOut()}>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
