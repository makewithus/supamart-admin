import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { apiGet } from '../services/api';
import { playNotificationSound } from '../utils/notificationSound';
import toast from 'react-hot-toast';

const BadgeContext = createContext({
  counts: {
    orders: 0,
    payments: 0,
    refunds: 0,
    issues: 0,
    products: 0,
  },
  dashboardLowStock: {
    count: 0,
    names: '',
    items: [],
  },
  recentAlerts: [],
  orders: [],
  issues: [],
  orderAlert: null,
  clearOrderAlert: () => {},
  lowStockAlert: null,
  clearLowStockAlert: () => {},
  refreshLowStock: () => {},
});

export function BadgeProvider({ children }) {
  const [counts, setCounts] = useState({
    orders: 0,
    payments: 0,
    refunds: 0,
    issues: 0,
    products: 0,
  });

  const [dashboardLowStock, setDashboardLowStock] = useState({
    count: 0,
    names: '',
    items: [],
  });

  const [recentAlerts, setRecentAlerts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [issuesList, setIssuesList] = useState([]);
  const [orderAlert, setOrderAlert] = useState(null);
  const [lowStockAlert, setLowStockAlert] = useState(null);

  const knownOrderIdsRef = useRef(new Set());
  const initialOrdersLoadedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());

  const fetchLowStock = useCallback(async () => {
    try {
      const res = await apiGet('/admin/low-stock?threshold=10');
      const items = res?.items || [];
      setCounts((prev) => ({ ...prev, products: items.length }));
      const names = items.slice(0, 3).map((p) => p.name?.toLowerCase()).join(', ');
      setDashboardLowStock({
        count: items.length,
        names,
        items,
      });
    } catch (_) {}
  }, []);

  const [waitingPaymentAmount, setWaitingPaymentAmount] = useState(0);
  const [oldestNewOrderMins, setOldestNewOrderMins] = useState(0);

  useEffect(() => {
    try {
      // 1. Unified live Orders listener (50 max to strictly optimize billable reads)
      const unsubOrders = onSnapshot(
        query(
          collection(db, 'orders'),
          orderBy('createdAt', 'desc'),
          limit(50)
        ),
        (snap) => {
          const orderDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOrders(orderDocs);

          // Audio chime & notification on incoming new orders
          if (!initialOrdersLoadedRef.current) {
            initialOrdersLoadedRef.current = true;
            snap.docs.forEach((d) => knownOrderIdsRef.current.add(d.id));
          } else {
            let latestNew = null;
            snap.docChanges().forEach((change) => {
              if (change.type !== 'added') return;
              const docId = change.doc.id;
              if (knownOrderIdsRef.current.has(docId)) return;
              knownOrderIdsRef.current.add(docId);

              const order = { id: docId, ...change.doc.data() };
              latestNew = order;

              if (localStorage.getItem('ms_alert_sound_enabled') !== 'false') {
                playNotificationSound();
              }
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                  new Notification(`New order #${order.orderNo || ''}`, {
                    body: `₹${order.total || order.totalAmount || 0} • ${(order.items || []).length} item(s)`,
                    icon: '/logo.png',
                  });
                } catch (_) {}
              }
            });
            if (latestNew) setOrderAlert(latestNew);
          }

          // New orders awaiting shop approval/acceptance
          const newOrders = orderDocs.filter((o) => {
            const s = (o.status || '').toUpperCase();
            return s === 'ORDER_PLACED' || s === 'PLACED' || s === 'NEW' || !s;
          });

          // Unverified UPI payments awaiting admin confirmation (excluding cancelled)
          const unverifiedPayments = orderDocs.filter((o) => {
            const isUpi = !o.paymentMethod || o.paymentMethod === 'UPI_MANUAL' || o.paymentMethod === 'UPI';
            const isPending = o.paymentStatus === 'AWAITING_CONFIRMATION' ||
              o.paymentStatus === 'PENDING' ||
              o.paymentStatus === 'AWAITING_VERIFICATION';
            const notCancelled = (o.status || '').toUpperCase() !== 'CANCELLED';
            return isUpi && isPending && notCancelled;
          });

          const totalWaitingAmount = unverifiedPayments.reduce((sum, o) => {
            return sum + (Number(o.total ?? o.totalAmount ?? o.finalAmount ?? 0) || 0);
          }, 0);

          let oldestMins = 0;
          if (newOrders.length > 0) {
            const oldestTime = Math.min(...newOrders.map((o) => {
              if (!o.createdAt) return Date.now();
              if (typeof o.createdAt === 'number') return o.createdAt;
              if (o.createdAt.toMillis) return o.createdAt.toMillis();
              if (o.createdAt.seconds) return o.createdAt.seconds * 1000;
              return Date.parse(o.createdAt) || Date.now();
            }));
            oldestMins = Math.max(1, Math.floor((Date.now() - oldestTime) / 60000));
          }

          setCounts((prev) => ({
            ...prev,
            orders: newOrders.length,
            payments: unverifiedPayments.length,
          }));
          setWaitingPaymentAmount(totalWaitingAmount);
          setOldestNewOrderMins(oldestMins);
        },
        (err) => {
          console.warn('Orders badge listener error:', err);
        }
      );

      // 2. Pending refunds
      const unsubRefunds = onSnapshot(
        query(
          collection(db, 'refunds'),
          where('status', 'in', ['PENDING', 'PENDING_APPROVAL'])
        ),
        (snap) => {
          setCounts((prev) => ({ ...prev, refunds: snap.size }));
        },
        () => {}
      );

      // 3. Open issues
      const unsubIssues = onSnapshot(
        query(
          collection(db, 'issues'),
          where('status', 'in', ['OPEN', 'PENDING'])
        ),
        (snap) => {
          setCounts((prev) => ({ ...prev, issues: snap.size }));
          setIssuesList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        () => {}
      );

      // 4. Live operational adminAlerts listener (for instant low stock & stockout alerts)
      const unsubAlerts = onSnapshot(
        query(
          collection(db, 'adminAlerts'),
          orderBy('createdAt', 'desc'),
          limit(10)
        ),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRecentAlerts(list);

          let latestAlert = null;
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const alert = { id: change.doc.id, ...change.doc.data() };
            if ((alert.createdAt || 0) < mountedAtRef.current) return;

            if (localStorage.getItem('ms_alert_sound_enabled') !== 'false') {
              playNotificationSound();
            }

            latestAlert = alert;
            const isOutOfStock = alert.isOutOfStock || Number(alert.currentStock ?? alert.stock) <= 0;
            const stockCount = Number(alert.currentStock ?? alert.stock ?? 0);

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                new Notification(
                  isOutOfStock ? `🚨 Out of Stock: ${alert.productName}` : `⚠️ Low Stock Alert: ${alert.productName}`,
                  {
                    body: isOutOfStock
                      ? `${alert.productName}${alert.variantLabel ? ` (${alert.variantLabel})` : ''} reached 0 units!`
                      : `Only ${stockCount} unit${stockCount === 1 ? '' : 's'} left for ${alert.productName}!`,
                    icon: '/logo.png',
                    tag: `low-stock-${alert.productId}`,
                  }
                );
              } catch (_) {}
            }

            toast.error(
              isOutOfStock
                ? `Out of stock: ${alert.productName} is at 0 units!`
                : `Low stock alert: ${alert.productName} has only ${stockCount} remaining!`,
              {
                duration: 5000,
                icon: isOutOfStock ? '🚨' : '⚠️',
              }
            );
          });

          if (latestAlert) {
            setLowStockAlert(latestAlert);
          }

          fetchLowStock();
        },
        () => {}
      );

      // Initial low stock fetch + periodic background sync (60s interval)
      fetchLowStock();
      const lowStockTimer = setInterval(fetchLowStock, 60 * 1000);

      return () => {
        unsubOrders();
        unsubRefunds();
        unsubIssues();
        unsubAlerts();
        clearInterval(lowStockTimer);
      };
    } catch (_) {}
  }, [fetchLowStock]);

  return (
    <BadgeContext.Provider
      value={{
        counts,
        waitingPaymentAmount,
        oldestNewOrderMins,
        dashboardLowStock,
        recentAlerts,
        orders,
        issues: issuesList,
        orderAlert,
        clearOrderAlert: () => setOrderAlert(null),
        lowStockAlert,
        clearLowStockAlert: () => setLowStockAlert(null),
        refreshLowStock: fetchLowStock,
      }}
    >
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  return useContext(BadgeContext);
}
