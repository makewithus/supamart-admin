import React, { useState, useEffect } from 'react';
import { Users, Search, UserCircle2, ShoppingBag } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, where, getDocs, onSnapshot } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

function timeAgo(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_BADGE_VARIANT = {
  ORDER_PLACED: 'warning', ORDER_ACCEPTED: 'info', PACKING: 'info',
  READY_FOR_DELIVERY: 'info', OUT_FOR_DELIVERY: 'info', DELIVERED: 'success', CANCELLED: 'error',
};

// Row click opens this: every order this customer has ever placed, id/date/items/amount/status.
// Queried by userId only (no orderBy) so no new Firestore composite index is required —
// sorted client-side instead, same trick Accounts.jsx uses for its payment-status filter.
function CustomerOrdersModal({ customer, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    getDocs(query(collection(db, 'orders'), where('userId', '==', customer.id)))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setOrders(list);
      })
      .catch((err) => { console.error(err); toast.error('Failed to load orders'); })
      .finally(() => setLoading(false));
  }, [customer]);

  if (!customer) return null;

  return (
    <div className="space-y-5">
      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-1">
        <p className="text-sm text-neutral-700"><strong>Name:</strong> {customer.name || '—'}</p>
        <p className="text-sm text-neutral-700"><strong>Email:</strong> {customer.email || '—'}</p>
        <p className="text-sm text-neutral-700"><strong>Phone:</strong> {customer.mobile || '—'}</p>
      </div>

      {loading ? <Loader text="Loading orders…" /> : orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders yet" message="This customer hasn't placed any orders." />
      ) : (
        <div className="border border-neutral-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                {['Order #', 'Date', 'Items', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="p-3 font-semibold text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-neutral-50 last:border-0">
                  <td className="p-3 font-mono text-xs text-neutral-500">#{o.orderNo}</td>
                  <td className="p-3 text-neutral-500 text-xs">{timeAgo(o.createdAt)}</td>
                  <td className="p-3 text-neutral-700">{(o.items || []).length} items</td>
                  <td className="p-3 font-semibold text-primary-900">₹{Math.round(o.total || 0)}</td>
                  <td className="p-3"><Badge variant={STATUS_BADGE_VARIANT[o.status] || 'neutral'}>{o.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Failed to load customers');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = customers.filter((c) =>
    !search ||
    (c.mobile || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Customers" subtitle={`${customers.length} registered users`} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, email or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-primary-900
                placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10 transition-all"
            />
          </div>
          <Badge variant="neutral">{filtered.length} shown</Badge>
        </div>

        {loading ? <Loader text="Loading customers…" /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" message={search ? 'Try a different search.' : 'No users have signed up yet.'} />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Customer', 'Email', 'Phone', 'Role', 'Orders', 'Lifetime Spend', 'Joined'].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="border-b border-neutral-50 hover:bg-neutral-50/80 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
                          {c.photoURL
                            ? <img src={c.photoURL} alt={c.name} loading="lazy" decoding="async" className="w-full h-full rounded-full object-cover" />
                            : <UserCircle2 size={16} className="text-secondary-700" />
                          }
                        </div>
                        <span className="font-medium text-primary-900">{c.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 text-xs">{c.email || '—'}</td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-xs">{c.mobile || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={c.role === 'ADMIN' ? 'dark' : c.role === 'PARTNER' ? 'info' : 'neutral'}>
                        {c.role || 'CUSTOMER'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">{c.totalOrders ?? 0}</td>
                    <td className="px-6 py-4 font-semibold text-primary-900">₹{Math.round(c.lifetimeSpending || 0)}</td>
                    <td className="px-6 py-4 text-neutral-400 text-xs">{timeAgo(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Customer Orders" size="lg">
        <CustomerOrdersModal customer={selected} onClose={() => setSelected(null)} />
      </Modal>
    </div>
  );
}
