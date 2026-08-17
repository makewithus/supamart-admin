import { useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

// Auto sign-out after a period of inactivity. The Firebase session itself
// persists across reloads (browserLocalPersistence), so without this an admin
// stays signed in forever — this re-prompts credentials once the console has
// been left idle. The last-activity timestamp lives in localStorage so the
// timer survives a page refresh and is shared across tabs.
//
// 10 min was the original value here, but this dashboard is explicitly meant to sit open
// on a shop PC/tablet all day, passively watching for new-order push alerts (see
// useNewOrderAlert/EnableAlertsPrompt) — nobody touches the mouse/keyboard while just
// glancing at it for new orders. That made this fire constantly during completely normal
// use, forcing a "logged in, then bounced back to login" loop every ~10 idle minutes.
// 8 hours covers a full shop shift while still logging out overnight if the PC is left on.

const IDLE_LIMIT_MS   = 8 * 60 * 60 * 1000; // sign out after 8 hours idle (was 10 min — far too aggressive for an always-open dashboard)
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

    // SECURITY: check the PREVIOUS session's last-activity timestamp before treating this
    // mount as fresh activity. The old code unconditionally stamped "now" on every mount —
    // which meant simply reopening the browser (even after it sat closed for days) reset
    // the idle clock to zero, so a persisted admin session effectively never expired as
    // long as someone opened the browser at least once within any IDLE_LIMIT_MS window.
    // That's what let a stale logged-in session sit there indefinitely without ever
    // re-prompting for credentials. Now: if the browser was already idle-stale when this
    // mounts, sign out immediately instead of quietly resetting the timer.
    const existing = Number(localStorage.getItem(STORAGE_KEY)) || 0;
    if (existing && Date.now() - existing >= IDLE_LIMIT_MS) {
      localStorage.removeItem(STORAGE_KEY);
      signOut(auth);
      return undefined;
    }
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
