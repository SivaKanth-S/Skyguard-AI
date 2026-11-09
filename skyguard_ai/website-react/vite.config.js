import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Security headers served by the dev/preview servers. Production hosts must
// set these (plus the CSP below) at the CDN/edge level as well.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), payment=(), geolocation=(self)',
  // Allow the Firebase Google sign-in popup to keep a handle to this window.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

// Content-Security-Policy injected into the production index.html. Dev mode
// is skipped because Vite injects inline scripts for HMR.
// If you enable Firebase App Check (reCAPTCHA v3), also allow
// https://www.google.com and https://www.gstatic.com in script-src/frame-src/connect-src.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com https://api.emailjs.com https://nominatim.openstreetmap.org https://photon.komoot.io https://router.project-osrm.org https://api.open-meteo.com https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.tile.openstreetmap.org",
  "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function cspPlugin() {
  return {
    name: 'skyguard-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: { headers: securityHeaders },
  preview: { headers: securityHeaders },
})
