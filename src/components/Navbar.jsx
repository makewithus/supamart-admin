import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, Users, LogOut, Tag, BadgePercent, Wallet, Menu, X, Volume2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../config/firebase';
import { playNotificationSound, getAudioContext } from '../utils/notificationSound';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products',   icon: Package,         label: 'Products'  },
  { to: '/orders',     icon: ShoppingCart,    label: 'Orders'    },
  { to: '/accounts',   icon: Wallet,          label: 'Accounts'  },
  { to: '/categories', icon: Layers,          label: 'Categories'},
  { to: '/brands',     icon: Tag,             label: 'Brands'    },
  { to: '/customers',  icon: Users,           label: 'Customers' },
  { to: '/offers',     icon: BadgePercent,    label: 'Offers'    },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (to) =>
    to === '/' ? pathname === '/' || pathname === '/dashboard' : pathname.startsWith(to);

  return (
    <>
      {/* Mobile top bar — visible below md, replaces the static sidebar with a drawer toggle */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-primary-900 shadow-sidebar sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="MS Traders" className="h-8 w-auto object-contain" />
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 text-white/90 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Backdrop for the mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 max-w-[80vw] flex-shrink-0 bg-primary-900 flex flex-col h-screen shadow-sidebar
          transform transition-transform duration-200 ease-out md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand */}
        <div className="px-6 pt-7 pb-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="MS Traders" className="h-10 w-auto object-contain" />
            <div>
              <p className="text-white font-bold text-base leading-none">Admin</p>
              <p className="text-neutral-400 text-[11px] font-medium mt-0.5">Console</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                  ${active
                    ? 'bg-white/12 text-white'
                    : 'text-neutral-400 hover:bg-white/8 hover:text-white'
                  }`}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={active ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'}
                />
                {label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-secondary-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Alert sound test + Logout */}
        <div className="px-3 pb-6 pt-2 border-t border-white/10 space-y-0.5">
          <button
            onClick={() => {
              // Also a real gesture — clicking this always attempts to (re-)unlock audio,
              // so it doubles as a manual "unstick" if the earlier Enable Order Alerts
              // click somehow didn't take (e.g. permission dialog dismissed mid-flow).
              getAudioContext()?.resume();
              playNotificationSound();
              toast.success('Playing test alert sound…', { duration: 2000 });
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400
              hover:bg-white/8 hover:text-white transition-all duration-150"
          >
            <Volume2 size={18} strokeWidth={1.75} />
            Test Alert Sound
          </button>
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400
              hover:bg-red-950/40 hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
