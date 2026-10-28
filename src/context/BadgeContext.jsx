import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { apiGet } from '../services/api';

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

  useEffect(() => {
    try {
      // 1. Pending orders
      const unsubOrders = onSnapshot(
        query(
          collection(db, 'orders'),
          where('status', 'in', ['ORDER_PLACED', 'PENDING_CONFIRMATION', 'PLACED', 'CONFIRMED'])
        ),
        (snap) => {
          setCounts((prev) => ({ ...prev, orders: snap.size }));
        },
        () => {}
      );

      // 2. Pending UPI payments
      const unsubPayments = onSnapshot(
        query(
          collection(db, 'orders'),
          where('paymentStatus', 'in', ['PENDING', 'AWAITING_VERIFICATION'])
        ),
        (snap) => {
          setCounts((prev) => ({ ...prev, payments: snap.size }));
        },
        () => {}
      );

      // 3. Pending refunds
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

      // 4. Open issues
      const unsubIssues = onSnapshot(
        query(
          collection(db, 'issues'),
          where('status', 'in', ['OPEN', 'PENDING'])
        ),
        (snap) => {
          setCounts((prev) => ({ ...prev, issues: snap.size }));
        },
        () => {}
      );

      // 5. Real-time operational adminAlerts listener (for instant low stock & stockout alerts)
      const unsubAlerts = onSnapshot(
        query(
          collection(db, 'adminAlerts'),
          orderBy('createdAt', 'desc'),
          limit(15)
        ),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRecentAlerts(list);
          // Whenever an alert is created or modified, immediately fetch fresh inventory counts
          fetchLowStock();
        },
        () => {}
      );

      // Initial low stock fetch + periodic background sync (30s interval)
      fetchLowStock();
      const lowStockTimer = setInterval(fetchLowStock, 30 * 1000);

      return () => {
        unsubOrders();
        unsubPayments();
        unsubRefunds();
        unsubIssues();
        unsubAlerts();
        clearInterval(lowStockTimer);
      };
    } catch (_) {}
  }, [fetchLowStock]);

  return (
    <BadgeContext.Provider value={{ counts, dashboardLowStock, recentAlerts, refreshLowStock: fetchLowStock }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  return useContext(BadgeContext);
}
