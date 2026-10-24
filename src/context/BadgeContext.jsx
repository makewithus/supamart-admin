import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

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
  },
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
  });

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

      // 5. Products low-stock (single listener shared across Navbar, TopBar, and Dashboard)
      const unsubProducts = onSnapshot(
        collection(db, 'products'),
        (snap) => {
          const docs = snap.docs.map((d) => d.data());
          // Navbar & TopBar badge count (stock <= 5)
          const low5 = docs.filter((p) => {
            return (p.stock !== undefined && p.stock <= 5) || (p.variants && p.variants.some((v) => v.stock <= 5));
          });
          setCounts((prev) => ({ ...prev, products: low5.length }));

          // Dashboard card count (stock <= 10) and names
          const low10 = docs.filter((p) => {
            return (p.stock !== undefined && p.stock <= 10) || (p.variants && p.variants.some((v) => v.stock <= 10));
          });
          const names = low10.slice(0, 3).map((p) => p.name?.toLowerCase()).join(', ');
          setDashboardLowStock({
            count: low10.length,
            names,
          });
        },
        () => {}
      );

      return () => {
        unsubOrders();
        unsubPayments();
        unsubRefunds();
        unsubIssues();
        unsubProducts();
      };
    } catch (_) {}
  }, []);

  return (
    <BadgeContext.Provider value={{ counts, dashboardLowStock }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  return useContext(BadgeContext);
}
