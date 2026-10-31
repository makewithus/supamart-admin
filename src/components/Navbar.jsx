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
import { auth } from '../config/firebase';
import { useBadges } from '../context/BadgeContext';

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
      { to: '/orders', icon: ShoppingBag, label: 'Orders', badgeType: 'orders', badgeColor: 'red' },
      { to: '/deliveries', aliases: ['/delivery-partners'], icon: Truck, label: 'Deliveries' },
      { to: '/payments', aliases: ['/accounts'], icon: CreditCard, label: 'Payments', badgeType: 'payments', badgeColor: 'amber' },
      { to: '/refunds', icon: RotateCcw, label: 'Refunds', badgeType: 'refunds', badgeColor: 'amber' },
      { to: '/issues', icon: AlertCircle, label: 'Issues', badgeType: 'issues', badgeColor: 'red' },
      { to: '/notifications', aliases: ['/alerts'], icon: Bell, label: 'Notifications' },
    ],
  },
  {
    heading: 'CATALOGUE',
    items: [
      { to: '/products', icon: Package, label: 'Products', badgeType: 'products', badgeColor: 'gray' },
      { to: '/categories', icon: Layers, label: 'Categories' },
      { to: '/brands', icon: Tag, label: 'Brands' },
    ],
  },
  {
    heading: 'CUSTOMERS',
    items: [
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/ratings', aliases: ['/feedback'], icon: Star, label: 'Ratings' },
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
      { to: '/settings', icon: SettingsIcon, label: 'Settings' },
    ],
  },
];

export default function Navbar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const { pathname } = useLocation();
  const { counts: badgeCounts } = useBadges();

  const isActive = (item) => {
    if (item.to === '/') {
      return pathname === '/' || pathname === '/dashboard';
    }
    if (pathname.startsWith(item.to)) return true;
    if (item.aliases && item.aliases.some((a) => pathname.startsWith(a))) return true;
    return false;
  };

  const renderBadge = (item) => {
    let val = 0;
    if (item.badgeType === 'orders' || item.to === '/orders') val = badgeCounts.orders;
    else if (item.badgeType === 'payments' || item.to === '/payments') val = badgeCounts.payments;
    else if (item.badgeType === 'refunds' || item.to === '/refunds') val = badgeCounts.refunds;
    else if (item.badgeType === 'issues' || item.to === '/issues') val = badgeCounts.issues;
    else if (item.badgeType === 'products' || item.to === '/products') val = badgeCounts.products;

    if (!val || val <= 0) return null;

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
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/branding/ms-traders-horizontal-colour.svg"
              alt="MS Traders"
              className="h-7 w-auto object-contain shrink-0 group-hover:opacity-90 transition-opacity"
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#0A7C47] bg-[#E6F4EA] px-1.5 py-0.5 rounded border border-[#0A7C47]/20 shrink-0">
              Admin
            </span>
          </Link>
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
            onClick={() => {
              localStorage.removeItem('ms_admin_last_activity');
              localStorage.removeItem('ms_admin_build_id');
              sessionStorage.removeItem('ms_admin_just_logged_in');
              auth.signOut();
            }}
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
