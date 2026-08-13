import { useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

// Auto sign-out after a period of inactivity. The Firebase session itself
// persists across reloads (browserLocalPersistence), so without this an admin
// stays signed in forever — this re-prompts credentials once the console has
// been left idle. The last-activity timestamp lives in localStorage so the
// timer survives a page refresh and is shared across tabs.

const IDLE_LIMIT_MS   = 30 * 60 * 1000; // sign out after 30 min idle
const CHECK_EVERY_MS  = 20 * 1000;      // how often we re-check the timestamp
const WRITE_THROTTLE_MS = 5 * 1000;     // don't touch localStorage on every mousemove
const STORAGE_KEY = 'ms_admin_last_activity';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'];

export default function useIdleLogout(enabled) {
  const lastWrite = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const stamp = (t) => {
      lastWrite.current = t;
      localStorage.setItem(STORAGE_KEY, String(t));
    };

    // Treat mount (a fresh sign-in or reload while signed in) as activity.
    stamp(Date.now());

    const onActivity = () => {
      const t = Date.now();
      if (t - lastWrite.current >= WRITE_THROTTLE_MS) stamp(t);
    };

    const check = () => {
      const last = Number(localStorage.getItem(STORAGE_KEY)) || 0;
      if (last && Date.now() - last >= IDLE_LIMIT_MS) {
        localStorage.removeItem(STORAGE_KEY);
        signOut(auth);
      }
    };

    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const intervalId = setInterval(check, CHECK_EVERY_MS);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(intervalId);
    };
  }, [enabled]);
}
