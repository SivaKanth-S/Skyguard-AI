import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web config comes from Vite env (see .env placeholders).
// Frontend keys are public by design — lock down access with Firebase
// authorized domains + security rules, not by hiding these values.
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
    auth = getAuth(firebaseApp);
  } catch {
    firebaseApp = null;
    auth = null;
  }
}

export { auth, firebaseApp };
