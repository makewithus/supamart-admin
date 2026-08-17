import React, { useState, useEffect } from 'react';
import { Wallet, Search } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import PaymentVerificationModal from '../components/PaymentVerificationModal';
import OrderDetailsModal from '../components/OrderDetailsModal';

const PAYMENT_TABS = {
  AWAITING_CONFIRMATION: { label: 'Awaiting Verification', v: 'warning' },
  PAID:                  { label: 'Paid',                  v: 'success' },
  FAILED:                { label: 'Rejected',              v: 'error'   },
  ALL:                   { label: 'All',                   v: 'neutral' },
};

function timeAgo(ms) {
  if (!ms) return '—';
  const d = Date.now() - ms;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ms).toLocaleDateString('en-IN');
}

// Payment verification queue — every UPI_MANUAL order the customer has tapped "I've paid"
// on, still awaiting a human to check the bank/UPI app and confirm or reject it. Same
// onSnapshot-on-the-whole-collection + client-side filter pattern as Orders.jsx, so no
// new Firestore composite index is needed.
export default function Accounts() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('AWAITING_CONFIRMATION');
  const [search, setSearch] = useState('');
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

  // Accounts is the manual-UPI payment ledger — COD is discontinued, so every payable
  // order goes through this queue at some point (PENDING -> AWAITING_CONFIRMATION -> PAID/FAILED).
  const upiOrders = orders.filter((o) => o.paymentMethod === 'UPI_MANUAL');
  const tabFiltered = tab === 'ALL' ? upiOrders : upiOrders.filter((o) => o.paymentStatus === tab);
  const filtered = tabFiltered.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(o.orderNo || '').includes(search) ||
      (o.userName || '').toLowerCase().includes(q) ||
      (o.userEmail || '').toLowerCase().includes(q) ||
      (o.userPhone || '').includes(search)
    );
  });

  const awaitingCount = upiOrders.filter((o) => o.paymentStatus === 'AWAITING_CONFIRMATION').length;

  const handleRowClick = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  // Only an AWAITING_CONFIRMATION order can actually be verified/rejected right now — for
  // everything else (already Paid/Failed, or still Pending with no claim yet) the action
  // modal's Confirm/Reject buttons wouldn't apply, so fall back to the read-only order
  // details view (same one Orders.jsx uses).
  const isActionable = selectedOrder?.paymentStatus === 'AWAITING_CONFIRMATION';

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Accounts" subtitle={`${awaitingCount} payment${awaitingCount === 1 ? '' : 's'} awaiting verification`} />

      <Card>
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
          <Badge variant="neutral">{filtered.length} results</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          {Object.entries(PAYMENT_TABS).map(([k, meta]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === k ? 'bg-primary-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {loading ? <Loader text="Loading payments…" /> : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="Nothing here" message={tab === 'AWAITING_CONFIRMATION' ? 'No payments are currently awaiting verification.' : 'No matching payment records.'} />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Order #', 'Customer', 'Items', 'Amount', 'Updated', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const badge = PAYMENT_TABS[o.paymentStatus] || { label: o.paymentStatus, v: 'neutral' };
                  return (
                    <tr
                      key={o.id}
                      onClick={() => handleRowClick(o)}
                      className="border-b border-neutral-50 hover:bg-neutral-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-neutral-500">#{o.orderNo}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-primary-900">{o.userName || '—'}</p>
                        <p className="text-xs text-neutral-400">{o.userEmail || o.userPhone || '—'}</p>
                      </td>
                      <td className="px-6 py-4 text-neutral-500">{(o.items || []).length} items</td>
                      <td className="px-6 py-4 font-semibold text-primary-900">₹{Math.round(o.total || 0)}</td>
                      <td className="px-6 py-4 text-neutral-400 text-xs">{timeAgo(o.updatedAt)}</td>
                      <td className="px-6 py-4"><Badge variant={badge.v}>{o.paymentStatus === 'AWAITING_CONFIRMATION' ? 'Verify' : badge.label}</Badge></td>
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
        title={isActionable ? 'Verify Payment' : 'Order Details'}
        size="lg"
      >
        {isActionable ? (
          <PaymentVerificationModal
            order={selectedOrder}
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => setIsModalOpen(false)}
          />
        ) : (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => setIsModalOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
