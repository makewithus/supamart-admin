import React, { useEffect } from 'react';
import { Volume2, X } from 'lucide-react';

const AUTO_DISMISS_MS = 15000;

// The "MOST IMPORTANT" requirement's alert: a large, impossible-to-miss banner (not a
// small corner toast) shown the instant useNewOrderAlert's Firestore listener sees a new
// order — order number, amount, and a direct "View Order" action, with no page refresh or
// tab switch needed.
export default function NewOrderBanner({ order, onView, onDismiss }) {
  useEffect(() => {
    if (!order) return undefined;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [order, onDismiss]);

  if (!order) return null;

  const itemCount = (order.items || []).length;

  return (
    <div className="sticky top-0 z-40 px-4 sm:px-6 lg:px-8 pt-4 animate-fade-in">
      <div className="bg-primary-900 text-white rounded-2xl shadow-card-hover px-5 py-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 animate-pulse">
          <Volume2 size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">New Order Received</p>
          <p className="text-base font-bold truncate">
            #{order.orderNo} <span className="font-normal text-white/80">· ₹{Math.round(order.total || 0)}</span>
            {itemCount ? <span className="font-normal text-white/60"> · {itemCount} item{itemCount === 1 ? '' : 's'}</span> : null}
          </p>
        </div>
        <button
          onClick={onView}
          className="px-4 py-2 rounded-xl bg-white text-primary-900 text-sm font-bold hover:bg-white/90 transition-colors flex-shrink-0"
        >
          View Order
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
