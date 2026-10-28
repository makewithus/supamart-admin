import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { collection, query, orderBy, where, getDocs, onSnapshot, limit } from 'firebase/firestore';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { ShoppingBag } from 'lucide-react';

function maskPhone(phone) {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10) {
    const first5 = clean.slice(0, 5);
    const last2 = clean.slice(-2);
    return `${first5}•••${last2}`;
  }
  return phone;
}

function formatRelativeTime(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function formatJoinedDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

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
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load orders');
      })
      .finally(() => setLoading(false));
  }, [customer]);

  if (!customer) return null;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-1">
        <p className="text-sm text-gray-700"><strong>Name:</strong> {customer.name || '—'}</p>
        <p className="text-sm text-gray-700"><strong>Email:</strong> {customer.email || '—'}</p>
        <p className="text-sm text-gray-700"><strong>Phone:</strong> {customer.mobile || '—'}</p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">This customer hasn't placed any orders yet.</div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Order #', 'Date', 'Items', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="p-3 font-semibold text-gray-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/60">
                  <td className="p-3 font-mono text-xs text-gray-600">#{o.orderNo || o.id?.slice(-6)}</td>
                  <td className="p-3 text-gray-500 text-xs">{formatJoinedDate(o.createdAt)}</td>
                  <td className="p-3 text-gray-700">{(o.items || []).length} items</td>
                  <td className="p-3 font-bold text-gray-900">₹{Math.round(o.total || 0)}</td>
                  <td className="p-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                      {o.status}
                    </span>
                  </td>
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected] = useState(null);

  // Subscribe to recent users
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
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

  // Fetch recent orders once to compute active stats
  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(30)))
      .then((snap) => {
        if (!active) return;
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Compute customer stats
  const customerStatsMap = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const uid = o.userId;
      if (!uid) return;
      if (!map[uid]) {
        map[uid] = { count: 0, spend: 0, lastOrderAt: 0 };
      }
      map[uid].count += 1;
      map[uid].spend += (o.total || 0);
      if (o.createdAt && o.createdAt > map[uid].lastOrderAt) {
        map[uid].lastOrderAt = o.createdAt;
      }
    });
    return map;
  }, [orders]);

  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  // Count ordered this month
  const orderedThisMonthCount = useMemo(() => {
    const activeUids = new Set();
    orders.forEach((o) => {
      if (o.createdAt && o.createdAt >= thirtyDaysAgo && o.userId) {
        activeUids.add(o.userId);
      }
    });
    return activeUids.size;
  }, [orders, thirtyDaysAgo]);

  const msClubCount = useMemo(() => {
    return customers.filter((c) => !!c.isMSClubMember).length;
  }, [customers]);

  const deletionRequestsCount = useMemo(() => {
    return customers.filter((c) => !!c.deletionRequested || !!c.scheduledDeletionAt).length;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (activeTab === 'ordered') {
      return customers.filter((c) => {
        const stats = customerStatsMap[c.id];
        return (stats && stats.lastOrderAt >= thirtyDaysAgo) || (c.totalOrders > 0);
      });
    }
    if (activeTab === 'msclub') {
      return customers.filter((c) => !!c.isMSClubMember);
    }
    if (activeTab === 'deletion') {
      return customers.filter((c) => !!c.deletionRequested || !!c.scheduledDeletionAt);
    }
    return customers;
  }, [customers, activeTab, customerStatsMap, thirtyDaysAgo]);

  const handleExportCSV = () => {
    if (customers.length === 0) {
      toast('No customers to export');
      return;
    }
    const headers = ['Name', 'Email', 'Phone', 'Orders', 'Lifetime Spend (INR)', 'Joined'];
    const rows = customers.map((c) => {
      const stats = customerStatsMap[c.id] || {};
      const orderCount = c.totalOrders ?? stats.count ?? 0;
      const spend = Math.round(c.lifetimeSpending ?? stats.spend ?? 0);
      return [
        `"${c.name || ''}"`,
        `"${c.email || ''}"`,
        `"${c.mobile || ''}"`,
        orderCount,
        spend,
        `"${formatJoinedDate(c.createdAt)}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Customer list exported to CSV!');
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {customers.length} registered · {orderedThisMonthCount} ordered in the last 30 days
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          Export CSV
        </button>
      </div>

      {/* Card Table Container */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
        {/* Tabs Bar */}
        <div className="border-b border-gray-200 px-4 sm:px-6 pt-3 flex items-center gap-4 sm:gap-8 overflow-x-auto text-xs sm:text-sm no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All <span className="ml-1 text-xs text-gray-500 font-normal">{customers.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('ordered')}
            className={`pb-3 font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'ordered'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Ordered this month <span className="ml-1 text-xs text-gray-500 font-normal">{orderedThisMonthCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('msclub')}
            className={`pb-3 font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'msclub'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            MS Club <span className="ml-1 text-xs text-gray-500 font-normal">{msClubCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('deletion')}
            className={`pb-3 font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'deletion'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Deletion requests <span className="ml-1 text-xs text-red-600 font-bold">{deletionRequestsCount}</span>
          </button>
        </div>

        {/* Desktop Customers Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">CUSTOMER</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">PHONE</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ORDERS</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">LIFETIME SPEND</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">LAST ORDER</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">JOINED</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="font-semibold text-gray-500 text-sm">No customers found</p>
                      <p className="text-xs text-gray-400">There are no customers matching this category.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const stats = customerStatsMap[c.id] || {};
                  const orderCount = c.totalOrders ?? stats.count ?? 0;
                  const lifetimeSpend = Math.round(c.lifetimeSpending ?? stats.spend ?? 0);
                  const initial = (c.name || 'C')[0]?.toUpperCase();
                  const maskedPhone = maskPhone(c.mobile);
                  const lastOrderTime = stats.lastOrderAt ? formatRelativeTime(stats.lastOrderAt) : (c.lastOrderTime || 'Never');
                  const joinedDate = c.createdAt ? formatJoinedDate(c.createdAt) : (c.joinedDate || '—');

                  const isMSClub = !!c.isMSClubMember;
                  const isTest = c.email?.includes('test') || c.name?.toLowerCase().includes('test');
                  const isDeletion = !!c.deletionRequested || !!c.scheduledDeletionAt;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                    >
                      {/* Customer */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{c.name || 'Customer'}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono whitespace-nowrap">
                        {maskedPhone}
                      </td>

                      {/* Orders */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap">
                        {orderCount}
                      </td>

                      {/* Lifetime Spend */}
                      <td className="px-6 py-4 font-bold text-gray-900 text-sm whitespace-nowrap">
                        ₹{lifetimeSpend.toLocaleString('en-IN')}
                      </td>

                      {/* Last Order */}
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {lastOrderTime}
                      </td>

                      {/* Joined */}
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {joinedDate}
                      </td>

                      {/* Badges */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isMSClub && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fef3c7] text-[#92400e]">
                            MS Club
                          </span>
                        )}
                        {isTest && !isMSClub && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f3f4f6] text-[#4b5563]">
                            Test account
                          </span>
                        )}
                        {isDeletion && !isMSClub && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fee2e2] text-[#991b1b]">
                            {c.scheduledDeletionAt ? `Deletion on ${formatJoinedDate(c.scheduledDeletionAt)}` : 'Deletion requested'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Customer Cards (< md screens) */}
        <div className="block md:hidden divide-y divide-gray-100">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm font-semibold">
              No customers matching this category.
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const stats = customerStatsMap[c.id] || {};
              const orderCount = c.totalOrders ?? stats.count ?? 0;
              const lifetimeSpend = Math.round(c.lifetimeSpending ?? stats.spend ?? 0);
              const initial = (c.name || 'C')[0]?.toUpperCase();
              const maskedPhone = maskPhone(c.mobile);
              const lastOrderTime = stats.lastOrderAt ? formatRelativeTime(stats.lastOrderAt) : (c.lastOrderTime || 'Never');
              const joinedDate = c.createdAt ? formatJoinedDate(c.createdAt) : (c.joinedDate || '—');

              const isMSClub = !!c.isMSClubMember;
              const isTest = c.email?.includes('test') || c.name?.toLowerCase().includes('test');
              const isDeletion = !!c.deletionRequested || !!c.scheduledDeletionAt;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="p-4 space-y-3 cursor-pointer hover:bg-gray-50/70 transition-colors active:bg-gray-100/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{c.name || 'Customer'}</p>
                        <p className="text-xs text-gray-400 truncate">{c.email || '—'}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isMSClub && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fef3c7] text-[#92400e]">
                          MS Club
                        </span>
                      )}
                      {isDeletion && !isMSClub && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#fee2e2] text-[#991b1b]">
                          Deletion
                        </span>
                      )}
                      {isTest && !isMSClub && !isDeletion && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f3f4f6] text-[#4b5563]">
                          Test
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50 rounded-xl text-center">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{orderCount}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Orders</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">₹{lifetimeSpend.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Lifetime</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 truncate">{lastOrderTime}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Last order</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                    <span>Phone: {maskedPhone}</span>
                    <span>Joined {joinedDate}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Orders Details Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Customer Orders" size="lg">
        <CustomerOrdersModal customer={selected} onClose={() => setSelected(null)} />
      </Modal>
    </div>
  );
}
