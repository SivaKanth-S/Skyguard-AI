// Browser Notification helper — delivers every SkyGuard alert/fault as a
// system notification (works even when the tab is in the background).
// Free, built into the browser, no keys needed.

export function isNotifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission() {
  if (!isNotifySupported()) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Must be called from a user gesture (button click). Resolves to the
// resulting permission: 'granted' | 'denied' | 'default' | 'unsupported'.
export async function ensureNotifyPermission() {
  if (!isNotifySupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function permissionHint(perm) {
  if (perm === 'granted') return '🔔 Notifications on — alerts pop up on your device.';
  if (perm === 'denied') return '🔕 Notifications blocked — allow them in the browser site settings to get alerts.';
  if (perm === 'unsupported') return '🔕 This browser does not support notifications.';
  return '🔔 You will be asked for notification permission on Start.';
}

// Fire-and-forget. Returns true if a notification was shown.
export function sendNotify(title, body, tag) {
  if (!isNotifySupported() || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, {
      body: body || '',
      tag: tag || `skyguard-${Date.now()}`,
      renotify: true,
    });
    n.onclick = () => {
      try {
        if (window.focus) window.focus();
        n.close();
      } catch { /* noop */ }
    };
    return true;
  } catch {
    return false;
  }
}
