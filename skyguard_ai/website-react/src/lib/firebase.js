import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Firebase web config comes from Vite env (see .env placeholders).
// Frontend keys are public by design — lock down access with Firebase
// authorized domains + security rules + App Check, not by hiding these values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let firebaseApp = null;
let auth = null;
if (isFirebaseConfigured) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    // Optional: enable App Check enforcement in the Firebase console, then
    // set VITE_FIREBASE_APPCHECK_SITE_KEY. Without a site key this is a no-op.
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || '';
    if (appCheckSiteKey) {
      try {
        initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch {
        // App Check must never block sign-in.
      }
    }
    auth = getAuth(firebaseApp);
  } catch {
    firebaseApp = null;
    auth = null;
  }
}

export { auth, firebaseApp };
