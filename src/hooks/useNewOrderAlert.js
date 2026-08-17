import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { playNotificationSound } from '../utils/notificationSound';

// Immediate, works-with-zero-setup "new order" alert for any admin tab that's actually
// open: a live Firestore listener on the orders collection, same onSnapshot pattern every
// other admin page already uses. This is the primary, reliable foreground layer — it
// doesn't need the Firebase Console VAPID key, Notification permission, or FCM token
// registration to work at all. FCM (see services/pushNotifications.js) is layered on top
// for the one case this hook structurally cannot cover: alerting the admin when the
// dashboard tab isn't open/focused at all (that's what firebase-messaging-sw.js's
// onBackgroundMessage handles).
//
// `onNewOrder(order)` is called for the most recent new order in a snapshot batch, so the
// caller (App.jsx) can drive the prominent "NEW ORDER RECEIVED" banner. Sound and the
// native browser Notification are triggered here directly (not deferred to the caller) so
// they still fire even if a caller doesn't pass onNewOrder.
export default function useNewOrderAlert(enabled, onNewOrder) {
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    mountedAtRef.current = Date.now();
    let isFirstSnapshot = true;

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Firestore reports every existing doc as "added" on the first snapshot — only
        // alert for orders that arrive live, after this hook mounted.
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        let latestNewOrder = null;
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const order = { id: change.doc.id, ...change.doc.data() };
          if ((order.createdAt || 0) < mountedAtRef.current) return;

          playNotificationSound();
          latestNewOrder = order;

          // Also fires a native OS/browser notification when permission has been granted —
          // this still shows even if the admin has switched to another browser tab (though
          // not if the browser itself is fully closed; that case needs the FCM push).
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(`New order #${order.orderNo}`, {
                body: `₹${order.total} • ${(order.items || []).length} item(s)`,
                icon: '/logo.png',
              });
            } catch (err) {
              console.error('useNewOrderAlert: Notification constructor failed', err);
            }
          }
        });
        if (latestNewOrder) onNewOrder?.(latestNewOrder);
      },
      (err) => console.error('useNewOrderAlert: Firestore listener failed', err)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onNewOrder is expected to be a
    // stable callback (defined once at the App root); re-subscribing the listener on every
    // parent render (which would happen if it were in the dep array, since App.jsx passes an
    // inline arrow) would tear down and recreate the Firestore listener on every re-render.
  }, [enabled]);
}
