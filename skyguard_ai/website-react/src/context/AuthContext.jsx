import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { sendLoginNotification } from '../lib/loginNotify';

const AuthContext = createContext({
  user: null,
  loading: true,
  configured: false,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refresh: async () => {},
  rev: 0,
});

function friendlyError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try signing in instead.';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'Incorrect email or password.';
  if (code === 'auth/invalid-credential') return 'Incorrect email or password. If you are new here, switch to Sign Up and create an account first.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a minute and try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (code === 'auth/configuration-not-found') return 'FIREBASE_PROVIDER_DISABLED: Firebase Authentication has no sign-in providers yet. Open Firebase console → Build → Authentication → Get started, then enable the Email/Password provider.';
  if (code === 'auth/operation-not-allowed') return 'FIREBASE_PROVIDER_DISABLED: Email/Password sign-in is switched OFF in your Firebase project (skyguard-ai-1ac3f). Enable it under Authentication → Sign-in method, then retry. New users must use Sign Up first.';
  if (code === 'auth/popup-closed-by-user') return '';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized — add it under Authentication → Settings → Authorized domains in Firebase console.';
  if (code === 'auth/account-exists-with-different-credential') return 'This email already uses a different sign-in method. Try the other option.';
  return err?.message || 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Bumped on every refresh() so consumers re-render even when Firebase
  // mutates the same User object in place (same reference).
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // Completes a Google redirect sign-in (used inside the Android WebView).
    // A non-null result means a FRESH redirect login just happened.
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user?.email) {
          sendLoginNotification(result.user.email, 'Google');
        }
      })
      .catch(() => {});
    // Firebase persists the session in the browser (survives reloads).
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const guard = () => {
    if (!auth) throw new Error('NOT_CONFIGURED');
  };

  const signUp = async (email, password) => {
    guard();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      sendLoginNotification(cred.user?.email || email.trim(), 'Email sign-up');
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  };

  const signIn = async (email, password) => {
    guard();
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      sendLoginNotification(cred.user?.email || email.trim(), 'Email sign-in');
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  };

  // Google sign-in: popup on desktop web, full redirect inside the
  // Android WebView (where popups are blocked).
  const signInWithGoogle = async () => {
    guard();
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      sendLoginNotification(cred.user?.email, 'Google');
    } catch (err) {
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/operation-not-supported-in-this-environment' ||
        err?.code === 'auth/popup-closed-by-user'
      ) {
        if (err?.code === 'auth/popup-closed-by-user') return;
        await signInWithRedirect(auth, provider);
        return;
      }
      throw new Error(friendlyError(err));
    }
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  // Reload the Firebase user (fresh photoURL / displayName / verified flag).
  // NOTE: keeps the live User object instead of spreading it — photoURL and
  // friends live on the prototype, so {...user} would silently drop them and
  // the avatar would vanish until a full page reload.
  const refresh = async () => {
    if (!auth?.currentUser) return;
    try {
      await auth.currentUser.reload();
    } catch { /* use whatever state we have */ }
    setUser(auth.currentUser);
    setRev(r => r + 1);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, configured: isFirebaseConfigured, signUp, signIn, signInWithGoogle, signOut, refresh, rev }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
