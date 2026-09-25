import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { sendNotify } from '../lib/notify';

// Website-wide notifications: every alert/fault pops up as a floating card
// fixed to the viewport (visible over the full screen on any page/map),
// plus a real system notification when the browser permission allows it.

const NotifyContext = createContext({
  notifications: [],
  notify: () => 0,
  dismiss: () => {},
  clear: () => {},
});

let seq = 0;
const MAX_STACK = 5;
const TTL_MS = { critical: 12000, warning: 9000, info: 7000, success: 7000 };

export function NotifyProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    ({ severity = 'info', title = '', detail = '', browser = true, tag } = {}) => {
      const id = ++seq;
      if (browser) {
        try {
          sendNotify(title, detail, tag || `skyguard-${id}`);
        } catch { /* website card still shows */ }
      }
      setNotifications((list) =>
        [{ id, severity, title, detail, time: new Date().toLocaleTimeString() }, ...list].slice(0, MAX_STACK),
      );
      const ttl = TTL_MS[severity] || TTL_MS.info;
      const timer = setTimeout(() => dismiss(id), ttl);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const clear = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setNotifications([]);
  }, []);

  return (
    <NotifyContext.Provider value={{ notifications, notify, dismiss, clear }}>
      {children}
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotifyContext);
}
