import React, { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import PaymentVerificationModal from '../components/PaymentVerificationModal';

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

  const pending = orders.filter(
    (o) => o.paymentMethod === 'UPI_MANUAL' && o.paymentStatus === 'AWAITING_CONFIRMATION'
  );

  const handleRowClick = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Accounts" subtitle={`${pending.length} payment${pending.length === 1 ? '' : 's'} awaiting verification`} />

      <Card>
        {loading ? <Loader text="Loading payments…" /> : pending.length === 0 ? (
          <EmptyState icon={Wallet} title="All caught up" message="No payments are currently awaiting verification." />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Order #', 'Customer', 'Items', 'Amount', 'Claimed', ''].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((o) => (
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
                    <td className="px-6 py-4"><Badge variant="warning">Verify</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Verify Payment"
        size="lg"
      >
        <PaymentVerificationModal
          order={selectedOrder}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
