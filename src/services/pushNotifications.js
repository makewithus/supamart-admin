import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingIfSupported } from '../config/firebase';
import { apiPost, apiDel } from './api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let currentToken = null;
let foregroundUnsub = null;

// Diagnostic snapshot — used by the "Enable Order Alerts" UI to decide what to show, and
// useful for debugging without ever logging the VAPID key itself.
export function getPushDiagnostics() {
  return {
    vapidConfigured: !!VAPID_KEY,
    notificationApiAvailable: typeof Notification !== 'undefined',
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    serviceWorkerApiAvailable: 'serviceWorker' in navigator,
  };
}

// Registers the background service worker, gets an FCM token, and hands it to the backend
// (POST /api/admin/fcm-token) so a new order can push to this browser even when this tab
// isn't the active one.
//
// `requestPermission`: false (default) is the silent "restore an existing grant" path used
// on every app load — it never shows the OS permission prompt, it only proceeds if a past
// session already got 'granted'. true is the explicit path used by the "Enable Order
// Alerts" button click, where showing the prompt is expected and desired.
//
// Each failure point logs a distinct, specific error (not a single generic catch) so a
// real failure is diagnosable from the console instead of looking identical to "just not
// configured yet". The one exception is a genuinely optional precondition (no VAPID key
// configured, or an unsupported browser) — those return a `{ ok:false, reason }` instead of
// throwing, because they are not errors, they are the app correctly degrading to the
// foreground-only (Firestore-listener) alert path.
export async function initPushNotifications({ requestPermission = false } = {}) {
  if (!VAPID_KEY) {
    return { ok: false, reason: 'no-vapid-key' };
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) {
    return { ok: false, reason: 'unsupported-browser' };
  }

  if (typeof Notification === 'undefined') {
    return { ok: false, reason: 'no-notification-api' };
  }

  if (Notification.permission !== 'granted') {
    if (!requestPermission) return { ok: false, reason: 'permission-not-yet-requested' };
    let permission;
    try {
      permission = await Notification.requestPermission();
    } catch (err) {
      console.error('Push notifications: Notification.requestPermission() threw', err);
      return { ok: false, reason: 'permission-request-failed', error: err };
    }
    if (permission !== 'granted') {
      return { ok: false, reason: permission === 'denied' ? 'permission-denied' : 'permission-dismissed' };
    }
  }

  let registration;
  try {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (err) {
    console.error('Push notifications: service worker registration failed', err);
    return { ok: false, reason: 'service-worker-registration-failed', error: err };
  }

  let token;
  try {
    token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  } catch (err) {
    console.error('Push notifications: getToken() failed', err);
    return { ok: false, reason: 'get-token-failed', error: err };
  }
  if (!token) {
    console.error('Push notifications: getToken() returned no token (unexpected)');
    return { ok: false, reason: 'no-token-returned' };
  }

  try {
    await apiPost('/admin/fcm-token', { token });
  } catch (err) {
    console.error('Push notifications: failed to register token with backend', err);
    return { ok: false, reason: 'backend-registration-failed', error: err };
  }

  currentToken = token;

  // Foreground messages (tab open + focused): logged for diagnostics only. When the tab is
  // focused, the Firestore onSnapshot listener in useNewOrderAlert.js has already fired the
  // sound + the "New Order Received" banner for the same order by the time this callback
  // runs (it doesn't depend on FCM/permission at all, so it's always faster/more reliable).
  // Also alerting here would mean two sounds + two banners for one order — intentionally
  // not done. The service worker's onBackgroundMessage (firebase-messaging-sw.js) is what
  // actually matters for FCM: it only fires when this tab is NOT focused, which is exactly
  // the case the onSnapshot listener can't cover.
  if (foregroundUnsub) foregroundUnsub();
  foregroundUnsub = onMessage(messaging, (payload) => {
    console.info('Push notifications: foreground FCM message received (no-op by design — see comment)', payload);
  });

  return { ok: true, token };
}

// Best-effort token cleanup on sign-out so a stale browser doesn't keep receiving pushes
// for an account it's no longer signed into.
export async function teardownPushNotifications() {
  if (!currentToken) return;
  try {
    // apiDel never sends a request body in this codebase's api.js — pass the token as a
    // query param instead of touching that shared helper (used by every delete call in the app).
    await apiDel(`/admin/fcm-token?token=${encodeURIComponent(currentToken)}`);
  } catch (err) {
    console.error('teardownPushNotifications failed', err);
  } finally {
    currentToken = null;
  }
}
