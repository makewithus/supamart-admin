import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Explicitly request persistence instead of relying on the SDK's implicit default. In some
// production browser configurations (privacy-hardened browsers, certain mobile in-app
// webviews, storage-partitioning edge cases) IndexedDB — what browserLocalPersistence
// actually uses — can be silently unavailable. When that happens with no explicit
// persistence call, sign-in can appear to succeed for a moment and then the very next auth
// check reports signed-out, which looks exactly like "logs in, instantly bounced back to
// login." This falls back through session -> in-memory persistence and logs which layer
// actually won, so a real persistence failure is visible in the console instead of silent.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Firebase Auth: browserLocalPersistence unavailable, falling back to session persistence', err);
  return setPersistence(auth, browserSessionPersistence).catch((err2) => {
    console.error('Firebase Auth: browserSessionPersistence also unavailable, falling back to in-memory — session will NOT survive a page reload', err2);
    return setPersistence(auth, inMemoryPersistence);
  });
});

// Resolved lazily (never at module load): getMessaging() throws outright on browsers/
// contexts without Push API support (e.g. non-HTTPS, some in-app browsers), and this
// module is imported by every page, so a hard call here would break the whole app for
// unsupported visitors instead of just disabling push for them. Cached after first resolve.
let messagingPromise = null;
export function getMessagingIfSupported() {
  if (!messagingPromise) {
    messagingPromise = isSupported().then((ok) => (ok ? getMessaging(app) : null));
  }
  return messagingPromise;
}
