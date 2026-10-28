import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Download, Printer, Search, ChevronDown, Check, Clock, AlertCircle, Eye
} from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { apiPatch, apiGet } from '../services/api';
import toast from 'react-hot-toast';

function formatRelativeTime(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} d ago`;
}

function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length >= 10) {
    return `${clean.slice(0, 5)} •••${clean.slice(-2)}`;
  }
  return clean;
}

export default function Orders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('Last 7 days');
  const [paymentFilter, setPaymentFilter] = useState('Any payment');
  const [partnerFilter, setPartnerFilter] = useState('Any partner');
  const [partners, setPartners] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState({});
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
      setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

function mapOrderDoc(id, data) {
  const createdAt = data.createdAt || Date.now();
  const orderNo = data.orderNo ? String(data.orderNo) : id.slice(-4);
  const customerName = data.userName || data.addressSnapshot?.name || data.address?.name || 'Customer';
  const phone = data.userPhone || data.addressSnapshot?.phone || data.address?.phone || '';
  const area = data.addressSnapshot?.city || data.address?.city || data.addressSnapshot?.area || data.addressSnapshot?.locality || '';
  const phoneArea = `${maskPhone(phone)}${phone && area ? ' · ' : ''}${area}`;

  // Normalize statusKey
  let statusKey = 'NEW';
  const rawStatus = (data.status || '').toUpperCase();
  if (rawStatus === 'ORDER_PLACED' || rawStatus === 'NEW' || rawStatus === 'PLACED') {
    statusKey = 'NEW';
  } else if (rawStatus === 'ORDER_ACCEPTED' || rawStatus === 'PACKING' || rawStatus === 'ACCEPTED') {
    statusKey = 'PACKING';
  } else if (rawStatus === 'OUT_FOR_DELIVERY') {
    statusKey = 'OUT_FOR_DELIVERY';
  } else if (rawStatus === 'DELIVERED') {
    statusKey = 'DELIVERED';
  } else if (rawStatus === 'CANCELLED') {
    statusKey = 'CANCELLED';
  } else if (rawStatus === 'DISPUTED') {
    statusKey = 'DISPUTED';
  }

  // Payment classification
  let paymentType = 'paid';
  let paymentText = 'Paid · UPI';
  if (data.paymentStatus === 'AWAITING_CONFIRMATION' || data.paymentStatus === 'PENDING') {
    paymentType = 'verify';
    paymentText = 'Verify UTR';
  } else if (data.paymentStatus === 'FAILED') {
    paymentType = 'failed';
    paymentText = 'Payment failed';
  } else {
    paymentType = 'paid';
    paymentText = 'Paid · Online';
  }

  const partner = data.deliveryBoyName || data.deliveryPartner?.name || (statusKey === 'PACKING' || statusKey === 'NEW' ? 'Not assigned' : '—');
  const assignedPartnerId = data.assignedPartnerId || data.deliveryBoyId || null;
  const deliveryAcceptanceStatus = data.deliveryAcceptanceStatus || (assignedPartnerId ? 'PENDING' : null);
  const delayReason = data.delayReason || null;
  const deliveryDelay = data.deliveryDelay || null;
  const itemsCount = (data.items || []).length;
  const total = Math.round(Number(data.total || data.totalAmount) || 0);

  return {
    id,
    orderNo,
    customer: customerName,
    phoneArea,
    itemsCount,
    total,
    paymentText,
    paymentType,
    assignedPartnerId,
    deliveryAcceptanceStatus,
    delayReason,
    deliveryDelay,
    status: statusKey === 'NEW' ? 'New' : statusKey === 'PACKING' ? 'Packing' : statusKey === 'OUT_FOR_DELIVERY' ? 'Out for delivery' : statusKey === 'DELIVERED' ? 'Delivered' : statusKey === 'CANCELLED' ? 'Cancelled' : 'Disputed',
    statusKey,
    partner,
    placed: formatRelativeTime(createdAt),
    createdAt,
    urgent: statusKey === 'NEW',
    raw: { id, ...data },
  };
}

  const fetchOrdersFromApi = async () => {
    try {
      const data = await apiGet('/orders?limit=100');
      const items = Array.isArray(data) ? data : data?.items || [];
      if (items.length > 0) {
        setOrders(items.map((it) => mapOrderDoc(it.id, it)));
      }
    } catch (_) {}
    setLoading(false);
  };

  // Subscribe to live orders in real-time from Firestore (with API fallback on error)
  useEffect(() => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => mapOrderDoc(d.id, d.data()));
          setOrders(list);
          setLoading(false);
        },
        (err) => {
          console.error('Error listening to orders:', err);
          fetchOrdersFromApi();
        }
      );

      return () => {
        unsub();
      };
    } catch (e) {
      console.error(e);
      fetchOrdersFromApi();
    }
  }, []);

  const handleAssignPartner = async (orderId, partnerId) => {
    if (!partnerId) return;
    const target = partners.find((p) => p.id === partnerId);
    if (target && (target.isOnDuty === false || target.isActive === false)) {
      toast.error(`${target.name} is currently OFF DUTY and cannot be assigned`);
      return;
    }
    try {
      await apiPatch(`/orders/${orderId}/assign`, { partnerId });
      toast.success(`Assigned to ${target?.name || 'Partner'}`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to assign order');
    }
  };

  // If navigated with openOrderId in state, open it immediately
  useEffect(() => {
    const openId = location.state?.openOrderId;
    if (openId && orders.length > 0) {
      const cleanId = String(openId).replace('#', '');
      const match = orders.find((o) => o.id === cleanId || o.orderNo === cleanId);
      if (match) {
        setSelectedOrderForDrawer(match.raw);
      }
    }
  }, [location.state, orders]);

  // Tab counts dynamically calculated from live orders
  const tabCounts = useMemo(() => {
    const counts = { ALL: orders.length, NEW: 0, PACKING: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0, CANCELLED: 0, DISPUTED: 0 };
    orders.forEach((o) => {
      if (counts[o.statusKey] !== undefined) {
        counts[o.statusKey]++;
      }
    });
    return counts;
  }, [orders]);

  const STATUS_TABS = useMemo(() => [
    { id: 'ALL', label: 'All', count: tabCounts.ALL },
    { id: 'NEW', label: 'New', count: tabCounts.NEW, badgeColor: 'bg-[#dc2626] text-white' },
    { id: 'PACKING', label: 'Packing', count: tabCounts.PACKING },
    { id: 'OUT_FOR_DELIVERY', label: 'Out for delivery', count: tabCounts.OUT_FOR_DELIVERY },
    { id: 'DELIVERED', label: 'Delivered', count: tabCounts.DELIVERED },
    { id: 'CANCELLED', label: 'Cancelled', count: tabCounts.CANCELLED },
    { id: 'DISPUTED', label: 'Disputed', count: tabCounts.DISPUTED },
  ], [tabCounts]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const all = {};
      orders.forEach((o) => { all[o.id] = true; });
      setSelectedOrders(all);
    } else {
      setSelectedOrders({});
    }
  };

  const handleToggleRow = (id, e) => {
    e.stopPropagation();
    setSelectedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab !== 'ALL' && o.statusKey !== activeTab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNo = o.orderNo.toLowerCase().includes(q);
        const matchCust = o.customer.toLowerCase().includes(q);
        const matchArea = o.phoneArea.toLowerCase().includes(q);
        if (!matchNo && !matchCust && !matchArea) return false;
      }
      if (paymentFilter === 'Verify UTR' && o.paymentType !== 'verify') return false;
      if (paymentFilter === 'Paid · UPI' && o.paymentType !== 'paid') return false;
      if (partnerFilter !== 'Any partner' && o.partner !== partnerFilter) return false;
      return true;
    });
  }, [orders, activeTab, search, paymentFilter, partnerFilter]);

  // Aggregate total for last 7 days from live orders
  const totalRevenue7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return orders
      .filter((o) => (o.createdAt || 0) >= cutoff && o.statusKey !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [orders]);

  const newOrdersWaiting = useMemo(() => {
    return orders.filter((o) => o.statusKey === 'NEW');
  }, [orders]);

  const rejectedOrdersWaiting = useMemo(() => {
    return orders.filter(
      (o) =>
        o.deliveryAcceptanceStatus === 'REJECTED' &&
        o.statusKey !== 'DELIVERED' &&
        o.statusKey !== 'CANCELLED'
    );
  }, [orders]);

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Orders
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            {orders.length} orders · ₹{totalRevenue7d.toLocaleString('en-IN')} in the last 7 days
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              if (orders.length === 0) return toast.error('No orders to export');
              const headers = ['Order #', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Partner', 'Placed'];
              const rows = filteredOrders.map((o) => [
                o.orderNo,
                `"${o.customer}"`,
                o.itemsCount,
                o.total,
                o.paymentText,
                o.status,
                o.partner,
                o.placed,
              ]);
              const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map((e) => e.join(',')).join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', 'MS_Traders_Orders.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success('Orders CSV exported');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white border border-gray-200/90 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={13} strokeWidth={2.2} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white border border-gray-200/90 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer size={13} strokeWidth={2.2} />
            <span className="hidden xs:inline">Print slips</span>
          </button>
        </div>
      </div>

      {/* ── Urgent Attention Banner (Dynamic from live state) ── */}
      {newOrdersWaiting.length > 0 && (
        <div className="p-3.5 sm:p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] animate-pulse shrink-0" />
            <p className="text-xs font-semibold text-rose-950">
              <span className="font-bold">{newOrdersWaiting.length} new {newOrdersWaiting.length === 1 ? 'order is' : 'orders are'} waiting to be accepted.</span> Oldest placed {newOrdersWaiting[newOrdersWaiting.length - 1]?.placed}.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('NEW')}
            className="px-3.5 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-bold text-rose-950 hover:bg-rose-50/80 shadow-2xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Review new orders
          </button>
        </div>
      )}

      {/* ── Rejected Orders Alert Banner ── */}
      {rejectedOrdersWaiting.length > 0 && (
        <div className="p-3.5 sm:p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <p className="text-xs font-semibold text-amber-950">
              <span className="font-bold">{rejectedOrdersWaiting.length} {rejectedOrdersWaiting.length === 1 ? 'order delivery assignment was' : 'order delivery assignments were'} rejected</span> by partner. Please re-assign to an on-duty delivery partner below.
            </p>
          </div>
        </div>
      )}

      {/* ── Orders Table Card Container ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        {/* Status Filter Tabs */}
        <div className="px-3 sm:px-5 pt-3 sm:pt-4 border-b border-gray-100 flex items-center gap-4 sm:gap-6 overflow-x-auto select-none no-scrollbar">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 sm:pb-3.5 flex items-center gap-1.5 sm:gap-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    tab.badgeColor
                      ? tab.badgeColor
                      : isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, customer name or phone..."
              className="w-full pl-9 pr-3.5 py-1.5 sm:py-2 text-xs bg-gray-50 border border-gray-200/80 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white transition-all placeholder:text-gray-400 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Payment Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200/80 rounded-xl pl-3 pr-7 py-1.5 sm:py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option>Any payment</option>
                <option>Verify UTR</option>
                <option>Paid · UPI</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Partner Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200/80 rounded-xl pl-3 pr-7 py-1.5 sm:py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option>Any partner</option>
                <option>Not assigned</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Mobile Order Cards List (< md screens) ── */}
        <div className="block md:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400 font-semibold">
              Loading live orders from database…
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 font-semibold">
              No orders matching this filter.
            </div>
          ) : (
            filteredOrders.map((o) => (
              <div
                key={o.id}
                onClick={() => setSelectedOrderForDrawer(o.raw)}
                className="p-3.5 hover:bg-gray-50/70 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 text-sm">#{o.orderNo}</span>
                    {o.statusKey === 'NEW' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600">
                        New
                      </span>
                    )}
                    {o.statusKey === 'PACKING' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700">
                        Packing
                      </span>
                    )}
                    {o.statusKey === 'OUT_FOR_DELIVERY' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700">
                        On the way
                      </span>
                    )}
                    {o.statusKey === 'DELIVERED' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        Delivered
                      </span>
                    )}
                    {o.statusKey === 'CANCELLED' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-600">
                        Cancelled
                      </span>
                    )}
                  </div>
                  <span className="font-black text-gray-900 text-base">₹{o.total}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-gray-900">{o.customer}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{o.phoneArea}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-600">{o.itemsCount} {o.itemsCount === 1 ? 'item' : 'items'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{o.placed}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-50 text-[11px]">
                  <div>
                    {o.paymentType === 'verify' && (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                        Verify UTR
                      </span>
                    )}
                    {o.paymentType === 'paid' && (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Paid · UPI
                      </span>
                    )}
                    {o.paymentType === 'cod' && (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-gray-100 text-gray-700 border border-gray-200/60">
                        COD
                      </span>
                    )}
                    {o.paymentType === 'failed' && (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                        Failed
                      </span>
                    )}
                  </div>

                  <span className="text-gray-500 font-medium">
                    {o.partner && o.partner !== 'Not assigned' && o.partner !== '—' ? o.partner : 'Unassigned'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop Table Container (>= md screens) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA] text-[11px] font-bold text-gray-400 tracking-wider uppercase select-none">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={filteredOrders.length > 0 && Object.keys(selectedOrders).length === filteredOrders.length}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">ORDER</th>
                <th className="py-3 px-3">CUSTOMER</th>
                <th className="py-3 px-3">ITEMS</th>
                <th className="py-3 px-3">TOTAL</th>
                <th className="py-3 px-3">PAYMENT</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3">PARTNER</th>
                <th className="py-3 px-4">PLACED</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400 font-semibold">
                    Loading live orders from database…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400 font-semibold">
                    No orders matching this filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isChecked = !!selectedOrders[o.id];
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedOrderForDrawer(o.raw)}
                      className={`hover:bg-gray-50/70 transition-colors cursor-pointer ${
                        isChecked ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4" onClick={(e) => handleToggleRow(o.id, e)}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-gray-900">
                        #{o.orderNo}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900">{o.customer}</div>
                        <div className="text-[11px] text-gray-400 font-medium truncate max-w-[160px]">
                          {o.phoneArea}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-semibold text-gray-600">
                        {o.itemsCount} {o.itemsCount === 1 ? 'item' : 'items'}
                      </td>

                      <td className="py-3 px-3 font-bold text-gray-900">
                        ₹{o.total}
                      </td>

                      <td className="py-3 px-3">
                        {o.paymentType === 'verify' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                            Verify UTR
                          </span>
                        )}
                        {o.paymentType === 'paid' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Paid · UPI
                          </span>
                        )}
                        {o.paymentType === 'cod' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200/60">
                            Cash on delivery
                          </span>
                        )}
                        {o.paymentType === 'failed' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            Failed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {o.statusKey === 'NEW' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600">
                            New
                          </span>
                        )}
                        {o.statusKey === 'PACKING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700">
                            Packing
                          </span>
                        )}
                        {o.statusKey === 'OUT_FOR_DELIVERY' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 text-cyan-700">
                            Out for delivery
                          </span>
                        )}
                        {o.statusKey === 'DELIVERED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            Delivered
                          </span>
                        )}
                        {o.statusKey === 'CANCELLED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-600">
                            Cancelled
                          </span>
                        )}
                        {o.statusKey === 'DISPUTED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700">
                            Disputed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        {o.statusKey === 'DELIVERED' || o.statusKey === 'CANCELLED' ? (
                          <span className="font-bold text-gray-900">{o.partner}</span>
                        ) : (
                          <div className="flex flex-col gap-1 min-w-[160px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-gray-900">
                                {o.deliveryAcceptanceStatus === 'REJECTED'
                                  ? (o.partner && o.partner !== 'Not assigned' && o.partner !== '—'
                                      ? `Rejected by ${o.partner}`
                                      : 'Assignment Rejected')
                                  : (o.partner && o.partner !== 'Not assigned' && o.partner !== '—'
                                      ? o.partner
                                      : 'Unassigned')}
                              </span>
                              {o.deliveryAcceptanceStatus === 'ACCEPTED' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                  Accepted
                                </span>
                              )}
                              {o.deliveryAcceptanceStatus === 'REJECTED' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                  Rejected
                                </span>
                              )}
                              {o.deliveryAcceptanceStatus === 'PENDING' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 animate-pulse">
                                  Pending
                                </span>
                              )}
                            </div>

                            <select
                              value={o.deliveryAcceptanceStatus === 'REJECTED' ? '' : (o.assignedPartnerId || '')}
                              onChange={(e) => handleAssignPartner(o.id, e.target.value)}
                              className={`text-[11px] font-semibold py-1 px-1.5 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white cursor-pointer shadow-2xs border ${
                                o.deliveryAcceptanceStatus === 'REJECTED'
                                  ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                                  : 'bg-gray-50 border-gray-200 text-gray-700'
                              }`}
                            >
                              <option value="">
                                {o.deliveryAcceptanceStatus === 'REJECTED'
                                  ? '⚠️ Re-assign new partner...'
                                  : o.assignedPartnerId
                                  ? 'Re-assign partner...'
                                  : 'Assign partner...'}
                              </option>
                              {partners.map((p) => {
                                const isOffDuty = p.isOnDuty === false || p.isActive === false;
                                return (
                                  <option key={p.id} value={p.id} disabled={isOffDuty}>
                                    {p.name} {isOffDuty ? '(Off Duty)' : '(On Duty)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-gray-400 font-semibold whitespace-nowrap">
                        {o.placed}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForDrawer(o.raw)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-emerald-500 hover:text-emerald-700 font-bold text-xs text-gray-700 bg-white hover:bg-emerald-50/50 transition-colors shadow-2xs"
                        >
                          <Eye size={13} /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order Details Slide-over Drawer (Live sync) ── */}
      {selectedOrderForDrawer && (
        <OrderDetailsModal
          order={selectedOrderForDrawer}
          partners={partners}
          onClose={() => setSelectedOrderForDrawer(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
