import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, Users, LogOut, Tag, Zap,
} from 'lucide-react';
import { auth } from '../config/firebase';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products',   icon: Package,         label: 'Products'  },
  { to: '/orders',     icon: ShoppingCart,    label: 'Orders'    },
  { to: '/categories', icon: Layers,          label: 'Categories'},
  { to: '/customers',  icon: Users,           label: 'Customers' },
  { to: '/offers',     icon: Tag,             label: 'Offers'    },
];

export default function Navbar() {
  const { pathname } = useLocation();

  const isActive = (to) =>
    to === '/' ? pathname === '/' || pathname === '/dashboard' : pathname.startsWith(to);

  return (
    <aside className="w-64 flex-shrink-0 bg-primary-900 flex flex-col h-screen shadow-sidebar">
      {/* Brand */}
      <div className="px-6 pt-7 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="SupaMart" className="h-10 w-auto object-contain" />
          <div>
            <p className="text-white font-bold text-base leading-none">Admin</p>
            <p className="text-neutral-400 text-[11px] font-medium mt-0.5">Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
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

      {/* Logout */}
      <div className="px-3 pb-6 pt-2 border-t border-white/10">
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
  );
}
