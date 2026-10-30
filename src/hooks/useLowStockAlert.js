import { useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { playNotificationSound } from '../utils/notificationSound';
import toast from 'react-hot-toast';

export default function useLowStockAlert(enabled, onLowStockAlert) {
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    mountedAtRef.current = Date.now();
    let isFirstSnapshot = true;

    const q = query(collection(db, 'adminAlerts'), orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Firestore reports existing docs on the first snapshot — only alert for live incoming alerts
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }

        let latestAlert = null;
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const alert = { id: change.doc.id, ...change.doc.data() };
          if ((alert.createdAt || 0) < mountedAtRef.current) return;

          // 1. Play audio chime if sound is enabled
          if (localStorage.getItem('ms_alert_sound_enabled') !== 'false') {
            playNotificationSound();
          }

          latestAlert = alert;
          const isOutOfStock = alert.isOutOfStock || Number(alert.currentStock ?? alert.stock) <= 0;
          const stockCount = Number(alert.currentStock ?? alert.stock ?? 0);

          // 2. Native OS/Browser notification
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(
                isOutOfStock ? `Out of Stock: ${alert.productName}` : `Low Stock Alert: ${alert.productName}`,
                {
                  body: isOutOfStock
                    ? `${alert.productName}${alert.variantLabel ? ` (${alert.variantLabel})` : ''} reached 0 units${alert.orderNo ? ` on order #${alert.orderNo}` : ''}!`
                    : `Only ${stockCount} unit${stockCount === 1 ? '' : 's'} left for ${alert.productName}${alert.variantLabel ? ` (${alert.variantLabel})` : ''}! Refill inventory.`,
                  icon: '/logo.png',
                  tag: `low-stock-${alert.productId}`,
                }
              );
            } catch (err) {
              console.error('useLowStockAlert: Notification error', err);
            }
          }

          // 3. Quick toast notification
          toast.error(
            isOutOfStock
              ? `Out of stock: ${alert.productName} is at 0 units!`
              : `Low stock alert: ${alert.productName} has only ${stockCount} remaining!`,
            {
              duration: 5000,
            }
          );
        });

        if (latestAlert) {
          onLowStockAlert?.(latestAlert);
        }
      },
      (err) => {
        if (err?.code !== 'permission-denied') {
          console.warn('useLowStockAlert: listener paused', err?.message || err);
        }
      }
    );

    return () => unsub();
  }, [enabled]);
}
