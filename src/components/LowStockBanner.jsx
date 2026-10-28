import React, { useEffect } from 'react';
import { AlertTriangle, AlertOctagon, X, ArrowRight } from 'lucide-react';

const AUTO_DISMISS_MS = 15000;

export default function LowStockBanner({ alert, onView, onDismiss }) {
  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [alert, onDismiss]);

  if (!alert) return null;

  const isOutOfStock = alert.isOutOfStock || Number(alert.currentStock ?? alert.stock) <= 0;
  const stockCount = Number(alert.currentStock ?? alert.stock ?? 0);

  return (
    <div className="sticky top-0 z-40 px-4 sm:px-6 lg:px-8 pt-4 animate-fade-in">
      <div
        className={`rounded-2xl shadow-card-hover px-5 py-4 flex items-center gap-4 text-white transition-all ${
          isOutOfStock
            ? 'bg-gradient-to-r from-red-700 via-red-800 to-rose-900'
            : 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700'
        }`}
      >
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
          {isOutOfStock ? <AlertOctagon size={24} className="text-white" /> : <AlertTriangle size={24} className="text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/25 text-white">
              {isOutOfStock ? 'Out of Stock Alert' : 'Low Inventory Alert'}
            </span>
            {alert.orderNo ? (
              <span className="text-[11px] text-white/80 font-medium">
                via Order #{alert.orderNo}
              </span>
            ) : null}
          </div>
          <p className="text-base font-bold truncate mt-0.5 text-white">
            {alert.productName}
            {alert.variantLabel ? <span className="font-normal text-white/85"> ({alert.variantLabel})</span> : null}
            <span className="font-semibold text-white/90">
              {' · '}
              {isOutOfStock ? '0 units remaining (OUT OF STOCK)' : `Only ${stockCount} unit${stockCount === 1 ? '' : 's'} left`}
            </span>
          </p>
        </div>

        <button
          onClick={onView}
          className="px-4 py-2 rounded-xl bg-white text-gray-900 font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-1.5 flex-shrink-0 shadow-sm"
        >
          <span>Restock</span>
          <ArrowRight size={15} />
        </button>

        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
