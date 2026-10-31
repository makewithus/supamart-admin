import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { apiGet, apiPatch, apiPost } from '../services/api';
import toast from 'react-hot-toast';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  ShoppingBag,
  CreditCard,
  AlertCircle,
  Package,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  RefreshCw,
  Trash2
} from 'lucide-react';

function formatTimestamp(ts) {
  if (!ts) return 'Just now';
  const millis = typeof ts === 'number'
    ? ts
    : ts.toMillis
    ? ts.toMillis()
    : ts.seconds
    ? ts.seconds * 1000
    : Date.parse(ts) || Date.now();

  const diffSec = Math.floor((Date.now() - millis) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const d = new Date(millis);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Notifications() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); // ALL | UNREAD | ORDERS | STOCK | PAYMENTS | ISSUES
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAlertsApi = useCallback(async () => {
    try {
      const res = await apiGet('/admin/alerts?limit=100');
      const items = res?.items || (Array.isArray(res) ? res : []);
      if (items.length > 0) {
        setAlerts((prev) => {
          const map = new Map();
          prev.forEach((a) => { if (a?.id) map.set(a.id, a); });
          items.forEach((a) => { if (a?.id) map.set(a.id, { ...(map.get(a.id) || {}), ...a }); });
          const merged = Array.from(map.values());
          merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return merged;
        });
      }
    } catch (e) {
      console.warn('apiGet(/admin/alerts) fallback notice:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertsApi();

    let unsub = () => {};
    try {
      const q = query(
        collection(db, 'adminAlerts'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAlerts(items);
          setLoading(false);
        },
        (err) => {
          console.warn('adminAlerts onSnapshot error (using API fallback):', err?.message || err);
          setLoading(false);
        }
      );
    } catch (_) {
      setLoading(false);
    }

    return () => unsub();
  }, [fetchAlertsApi]);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await apiPatch(`/admin/alerts/${id}/read`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, read: true, readAt: Date.now() } : a))
      );
    } catch (err) {
      toast.error('Failed to mark alert as read');
    }
  };

  const handleClearAll = async () => {
    setActionLoading(true);
    try {
      const res = await apiPost('/admin/alerts/clear-all');
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true, readAt: Date.now() })));
      toast.success(res?.cleared ? `Marked ${res.cleared} alerts as read` : 'All alerts marked as read');
    } catch (err) {
      toast.error(err.message || 'Failed to clear alerts');
    } finally {
      setActionLoading(false);
    }
  };

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      unread: alerts.filter((a) => !a.read).length,
      orders: alerts.filter((a) => a.type === 'ORDER_PLACED' || a.type === 'ORDER_CANCELLED' || a.type?.startsWith('ORDER')).length,
      stock: alerts.filter((a) => a.type === 'LOW_STOCK' || a.type === 'OUT_OF_STOCK').length,
      payments: alerts.filter((a) => a.type === 'PAYMENT_CLAIMED' || a.type?.includes('PAYMENT')).length,
      issues: alerts.filter((a) => a.type === 'ISSUE_REPORTED' || a.type?.includes('ISSUE')).length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filterType === 'UNREAD') return !a.read;
      if (filterType === 'ORDERS') return a.type === 'ORDER_PLACED' || a.type === 'ORDER_CANCELLED' || a.type?.startsWith('ORDER');
      if (filterType === 'STOCK') return a.type === 'LOW_STOCK' || a.type === 'OUT_OF_STOCK';
      if (filterType === 'PAYMENTS') return a.type === 'PAYMENT_CLAIMED' || a.type?.includes('PAYMENT');
      if (filterType === 'ISSUES') return a.type === 'ISSUE_REPORTED' || a.type?.includes('ISSUE');
      return true;
    });
  }, [alerts, filterType]);

  const getAlertMetadata = (alert) => {
    switch (alert.type) {
      case 'ORDER_CANCELLED':
        return {
          icon: XCircle,
          iconColor: 'text-rose-600',
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
          cardBorder: 'hover:border-rose-300',
          tag: 'Order Cancelled',
          title: `Order #${alert.orderNo || alert.orderId} was cancelled`,
          description: alert.reason ? `Reason: ${alert.reason}` : 'No cancellation reason provided',
          actionText: 'View Order',
          onAction: () => navigate('/orders', { state: { search: String(alert.orderNo || alert.orderId) } }),
        };
      case 'ORDER_PLACED':
        return {
          icon: ShoppingBag,
          iconColor: 'text-emerald-600',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          cardBorder: 'hover:border-emerald-300',
          tag: 'New Order',
          title: `New Order #${alert.orderNo} placed (₹${alert.total || '0'})`,
          description: `Customer: ${alert.customerName || 'Customer'} · ${alert.itemsCount || 1} items · ${alert.paymentMethod || 'Online'}`,
          actionText: 'View Order',
          onAction: () => navigate('/orders', { state: { search: String(alert.orderNo || alert.orderId) } }),
        };
      case 'OUT_OF_STOCK':
        return {
          icon: AlertCircle,
          iconColor: 'text-rose-600',
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
          cardBorder: 'hover:border-rose-300',
          tag: 'Out of Stock',
          title: `Stockout: ${alert.productName || 'Product'}`,
          description: `${alert.variantLabel ? `Variant: ${alert.variantLabel} · ` : ''}Reached 0 units. Refill inventory immediately.`,
          actionText: 'Restock Product',
          onAction: () => navigate('/products', { state: { search: alert.productName || '' } }),
        };
      case 'LOW_STOCK':
        return {
          icon: Package,
          iconColor: 'text-amber-600',
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          cardBorder: 'hover:border-amber-300',
          tag: 'Low Stock Alert',
          title: `Low Stock: ${alert.productName || 'Product'}`,
          description: `Only ${alert.currentStock ?? alert.stock ?? 0} units left (threshold: ${alert.threshold || 10}).`,
          actionText: 'Manage Stock',
          onAction: () => navigate('/products', { state: { stockFilter: 'LOW', search: alert.productName || '' } }),
        };
      case 'PAYMENT_CLAIMED':
        return {
          icon: CreditCard,
          iconColor: 'text-blue-600',
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
          cardBorder: 'hover:border-blue-300',
          tag: 'Payment Claimed',
          title: `UPI Payment claimed for Order #${alert.orderNo || alert.orderId}`,
          description: `Customer claimed payment of ₹${alert.amount || '0'}. Please verify with bank statement.`,
          actionText: 'Verify Payment',
          onAction: () => navigate('/payments', { state: { search: String(alert.orderNo || alert.orderId) } }),
        };
      case 'ISSUE_REPORTED':
        return {
          icon: AlertTriangle,
          iconColor: 'text-purple-600',
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
          cardBorder: 'hover:border-purple-300',
          tag: 'Issue Reported',
          title: `Issue reported on Order #${alert.orderNo || ''}`,
          description: `Type: ${alert.issueType || 'Customer reported issue'} · Requested: ${alert.resolutionType || 'Refund'}`,
          actionText: 'Review Issue',
          onAction: () => navigate('/issues'),
        };
      default:
        return {
          icon: Bell,
          iconColor: 'text-gray-600',
          badgeBg: 'bg-gray-100 text-gray-800 border-gray-200',
          cardBorder: 'hover:border-gray-300',
          tag: alert.type || 'Notice',
          title: alert.title || alert.type || 'Operational Alert',
          description: alert.message || alert.reason || alert.description || 'System event',
          actionText: 'Details',
          onAction: () => {},
        };
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-[28px] font-black text-gray-900 tracking-tight leading-none">
              Store Notifications & Alerts
            </h1>
            {counts.unread > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-2xs">
                {counts.unread} new
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5">
            Real-time feed of order cancellations, placements, inventory stockouts, payments, and customer issues
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAlertsApi}
            title="Refresh alerts"
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw size={15} />
          </button>

          {counts.unread > 0 && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A7C47] hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCheck size={16} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'ALL', label: 'All Alerts', count: counts.all },
          { id: 'UNREAD', label: 'Unread', count: counts.unread },
          { id: 'ORDERS', label: 'Orders & Cancellations', count: counts.orders },
          { id: 'STOCK', label: 'Stock & Inventory', count: counts.stock },
          { id: 'PAYMENTS', label: 'Payments', count: counts.payments },
          { id: 'ISSUES', label: 'Issues & Disputes', count: counts.issues },
        ].map((tab) => {
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alerts Feed */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">
          Loading alerts stream...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-gray-100 shadow-2xs text-center flex flex-col items-center justify-center p-6 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#0A7C47] flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">All caught up!</h3>
          <p className="text-xs text-gray-500 max-w-sm">
            {filterType === 'UNREAD'
              ? 'No unread notifications right now. You are up to date on all store operations.'
              : 'No alerts found for this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const meta = getAlertMetadata(alert);
            const Icon = meta.icon;
            const isUnread = !alert.read;

            return (
              <div
                key={alert.id}
                onClick={meta.onAction}
                className={`group relative bg-white border rounded-2xl p-4 sm:p-5 transition-all shadow-2xs hover:shadow-card-hover cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isUnread
                    ? 'border-gray-300/90 bg-emerald-50/20'
                    : 'border-gray-200/80 bg-white opacity-90'
                } ${meta.cardBorder}`}
              >
                {/* Left content */}
                <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 bg-gray-50 shadow-2xs ${meta.iconColor}`}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${meta.badgeBg}`}
                      >
                        {meta.tag}
                      </span>
                      {isUnread && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white uppercase tracking-wider">
                          Unread
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
                        <Clock size={11} />
                        {formatTimestamp(alert.createdAt)}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight leading-snug">
                      {meta.title}
                    </h4>

                    <p className="text-xs text-gray-600 font-medium leading-relaxed">
                      {meta.description}
                    </p>

                    {alert.customerPhone && (
                      <p className="text-[11px] text-gray-400 font-mono">
                        Phone: {alert.customerPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkAsRead(alert.id, e)}
                      title="Mark as read"
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={meta.onAction}
                    className="px-3 py-1.5 rounded-xl bg-gray-900 group-hover:bg-[#0A7C47] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>{meta.actionText}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
