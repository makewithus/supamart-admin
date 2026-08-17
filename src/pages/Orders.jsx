import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { onSnapshot } from 'firebase/firestore';

const STATUS_BADGE = {
  ORDER_PLACED:        { label: 'Placed',            v: 'warning' },
  ORDER_ACCEPTED:      { label: 'Accepted',           v: 'info'    },
  PACKING:             { label: 'Packing',            v: 'info'    },
  READY_FOR_DELIVERY:  { label: 'Ready for Delivery', v: 'info'    },
  OUT_FOR_DELIVERY:    { label: 'Out for Delivery',   v: 'info'    },
  DELIVERED:           { label: 'Delivered',          v: 'success' },
  CANCELLED:           { label: 'Cancelled',          v: 'error'   },
};

const ALL_STATUSES = Object.keys(STATUS_BADGE);

const PAYMENT_BADGE = {
  PENDING:               { label: 'Payment Pending', v: 'neutral' },
  AWAITING_CONFIRMATION: { label: 'Awaiting Confirmation', v: 'warning' },
  PAID:                  { label: 'Paid', v: 'success' },
  FAILED:                { label: 'Failed', v: 'error' },
};
const ALL_PAYMENT_STATUSES = Object.keys(PAYMENT_BADGE);

const DATE_RANGES = {
  ALL: { label: 'All time', ms: null },
  TODAY: { label: 'Today', ms: 24 * 60 * 60 * 1000 },
  WEEK: { label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  MONTH: { label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
};

function timeAgo(ms) {
  if (!ms) return '—';
  const d = Date.now() - ms;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ms).toLocaleDateString('en-IN');
}

export default function Orders() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders,  setOrders]  = useState([]);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // "View Order" from the NewOrderBanner (App.jsx) navigates here with the order id in
  // router state; once that order is present in the live list, open it automatically and
  // clear the state so a manual refresh/back-navigation doesn't reopen it.
  useEffect(() => {
    const openOrderId = location.state?.openOrderId;
    if (!openOrderId) return;
    const match = orders.find((o) => o.id === openOrderId);
    if (match) {
      setSelectedOrder(match);
      setIsModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [orders, location.state, location.pathname, navigate]);

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const filtered = orders.filter((o) => {
    if (filter !== 'ALL' && o.status !== filter) return false;
    if (paymentFilter !== 'ALL' && o.paymentStatus !== paymentFilter) return false;
    const rangeMs = DATE_RANGES[dateRange].ms;
    if (rangeMs && Date.now() - (o.createdAt || 0) > rangeMs) return false;
    if (search &&
        !String(o.orderNo || '').includes(search) &&
        !o.id.toLowerCase().includes(search.toLowerCase()) &&
        !(o.userName || '').toLowerCase().includes(search.toLowerCase()) &&
        !(o.userPhone || '').includes(search)) return false;
    return true;
  });

  const clearFilters = () => {
    setSearch(''); setFilter('ALL'); setPaymentFilter('ALL'); setDateRange('ALL');
  };
  const hasActiveFilters = filter !== 'ALL' || paymentFilter !== 'ALL' || dateRange !== 'ALL' || search !== '';

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Orders" subtitle={`${orders.length} total orders`} />

      <Card>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search order #, name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-primary-900
                placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10 transition-all w-64"
            />
          </div>
          <Select
            value={dateRange}
            onChange={setDateRange}
            className="w-40"
            options={Object.entries(DATE_RANGES).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            value={paymentFilter}
            onChange={setPaymentFilter}
            className="w-52"
            placeholder="Any payment status"
            options={[
              { value: 'ALL', label: 'Any payment status' },
              ...ALL_PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_BADGE[s].label })),
            ]}
          />
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs font-semibold text-neutral-400 hover:text-primary-900 underline">
              Clear filters
            </button>
          )}
          <Badge variant="neutral">{filtered.length} of {orders.length}</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          {['ALL', ...ALL_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === s
                  ? 'bg-primary-900 text-white'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_BADGE[s]?.label}
            </button>
          ))}
        </div>

        {loading ? <Loader text="Loading orders…" /> : filtered.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No orders found" message="Try adjusting your filters." />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Time'].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const s = STATUS_BADGE[o.status] || { label: o.status || '—', v: 'neutral' };
                  return (
                    <tr 
                      key={o.id} 
                      onClick={() => handleOrderClick(o)}
                      className="border-b border-neutral-50 hover:bg-neutral-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-neutral-500">#{o.orderNo}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-primary-900">{o.userName || o.userId?.slice(0, 10) || '—'}</p>
                        {o.userPhone && <p className="text-xs text-neutral-400">{o.userPhone}</p>}
                      </td>
                      <td className="px-6 py-4 text-neutral-500">{(o.items || o.cartItems || []).length} items</td>
                      <td className="px-6 py-4 font-semibold text-primary-900">₹{Math.round(o.total || 0)}</td>
                      <td className="px-6 py-4"><Badge variant={s.v}>{s.label}</Badge></td>
                      <td className="px-6 py-4 text-neutral-400 text-xs">{timeAgo(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Order Details"
        size="lg"
      >
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
