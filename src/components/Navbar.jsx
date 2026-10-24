import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Truck,
  CreditCard,
  RotateCcw,
  AlertCircle,
  Package,
  Layers,
  Tag,
  Users,
  Star,
  Crown,
  BadgePercent,
  Bell,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { auth, db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const NAV_GROUPS = [
  {
    standalone: true,
    items: [
      { to: '/', aliases: ['/dashboard'], icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    heading: 'OPERATIONS',
    items: [
      { to: '/orders', icon: ShoppingBag, label: 'Orders', badge: '4', badgeColor: 'red' },
      { to: '/deliveries', aliases: ['/delivery-partners'], icon: Truck, label: 'Deliveries' },
      { to: '/payments', aliases: ['/accounts'], icon: CreditCard, label: 'Payments', badge: '13', badgeColor: 'amber' },
      { to: '/refunds', icon: RotateCcw, label: 'Refunds', badge: '2', badgeColor: 'amber' },
      { to: '/issues', icon: AlertCircle, label: 'Issues', badge: '2', badgeColor: 'red' },
    ],
  },
  {
    heading: 'CATALOGUE',
    items: [
      { to: '/products', icon: Package, label: 'Products', badge: '3', badgeColor: 'gray' },
      { to: '/categories', icon: Layers, label: 'Categories' },
      { to: '/brands', icon: Tag, label: 'Brands' },
    ],
  },
  {
    heading: 'CUSTOMERS',
    items: [
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/ratings', aliases: ['/feedback'], icon: Star, label: 'Ratings', dot: true },
      { to: '/ms-club', icon: Crown, label: 'MS Club' },
    ],
  },
  {
    heading: 'MARKETING',
    items: [
      { to: '/offers', icon: BadgePercent, label: 'Offers & banners' },
      { to: '/push-notifications', icon: Bell, label: 'Push notifications' },
    ],
  },
  {
    heading: 'INSIGHTS',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    bottom: true,
    items: [
      { to: '/settings', icon: SettingsIcon, label: 'Settings', dot: true },
    ],
  },
];

export default function Navbar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const { pathname } = useLocation();
  const [badgeCounts, setBadgeCounts] = useState({
    orders: 4,
    payments: 13,
    refunds: 2,
    issues: 2,
    products: 3,
  });

  // Real-time badge counters from Firestore
  useEffect(() => {
    try {
      // 1. Pending orders
      const unsubOrders = onSnapshot(
        query(collection(db, 'orders'), where('status', 'in', ['ORDER_PLACED', 'PENDING_CONFIRMATION'])),
        (snap) => {
          if (!snap.empty) setBadgeCounts((prev) => ({ ...prev, orders: snap.size }));
        },
        () => {}
      );

      // 2. Pending UPI payments
      const unsubPayments = onSnapshot(
        query(collection(db, 'orders'), where('paymentMethod', '==', 'UPI_MANUAL'), where('paymentStatus', '==', 'PENDING')),
        (snap) => {
          if (!snap.empty) setBadgeCounts((prev) => ({ ...prev, payments: snap.size }));
        },
        () => {}
      );

      // 3. Pending refunds
      const unsubRefunds = onSnapshot(
        query(collection(db, 'refunds'), where('status', '==', 'PENDING')),
        (snap) => {
          if (!snap.empty) setBadgeCounts((prev) => ({ ...prev, refunds: snap.size }));
        },
        () => {}
      );

      // 4. Open issues
      const unsubIssues = onSnapshot(
        query(collection(db, 'issues'), where('status', '==', 'OPEN')),
        (snap) => {
          if (!snap.empty) setBadgeCounts((prev) => ({ ...prev, issues: snap.size }));
        },
        () => {}
      );

      // 5. Low stock products
      const unsubProducts = onSnapshot(
        collection(db, 'products'),
        (snap) => {
          const low = snap.docs.filter((d) => {
            const p = d.data();
            return (p.stock !== undefined && p.stock <= 10) || (p.variants && p.variants.some((v) => v.stock <= 10));
          });
          if (low.length > 0) setBadgeCounts((prev) => ({ ...prev, products: low.length }));
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

  const isActive = (item) => {
    if (item.to === '/') {
      return pathname === '/' || pathname === '/dashboard';
    }
    if (pathname.startsWith(item.to)) return true;
    if (item.aliases && item.aliases.some((a) => pathname.startsWith(a))) return true;
    return false;
  };

  const renderBadge = (item) => {
    if (item.dot) {
      return <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" />;
    }
    let val = item.badge;
    if (item.to === '/orders') val = badgeCounts.orders;
    if (item.to === '/payments') val = badgeCounts.payments;
    if (item.to === '/refunds') val = badgeCounts.refunds;
    if (item.to === '/issues') val = badgeCounts.issues;
    if (item.to === '/products') val = badgeCounts.products;
    if (!val) return null;

    if (item.badgeColor === 'red') {
      return (
        <span className="w-4 h-4 bg-[#EF4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
          {val}
        </span>
      );
    }
    if (item.badgeColor === 'amber') {
      return (
        <span className="min-w-[18px] h-4 px-1 bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
          {val}
        </span>
      );
    }
    return (
      <span className="w-4 h-4 bg-[#F3F4F6] text-[#6B7280] text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
        {val}
      </span>
    );
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-56 lg:w-60 shrink-0 bg-white border-r border-gray-200/80 flex flex-col h-screen
          transform transition-transform duration-200 ease-out md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/branding/ms-traders-symbol-small-colour.svg"
              alt="MS Traders"
              className="w-8 h-8 object-contain shrink-0"
            />
            <div>
              <p className="font-extrabold text-sm text-gray-900 leading-tight tracking-tight">MS Traders</p>
              <p className="text-[11px] text-gray-400 font-medium leading-tight">Store admin</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Nav Sections */}
        <nav aria-label="Admin navigation" className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className={`space-y-0.5 ${group.bottom ? 'pt-2' : ''}`}>
              {group.heading && (
                <p className="px-2.5 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {group.heading}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onCloseMobile}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs sm:text-[13px] font-medium transition-all group ${
                      active
                        ? 'bg-[#E6F4EA] text-[#0A7C47] font-semibold shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        size={17}
                        strokeWidth={active ? 2.25 : 1.75}
                        className={`shrink-0 ${active ? 'text-[#0A7C47]' : 'text-gray-500 group-hover:text-gray-700'}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {renderBadge(item)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Subtle Sign out trigger */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={14} strokeWidth={1.75} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
