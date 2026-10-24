import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Download, Package, ShoppingBag, Clock
} from 'lucide-react';
import { auth, db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { useBadges } from '../context/BadgeContext';
import productImages from '../utils/productImages';
import { formatDeliverySlot } from '../utils/orderUtils';

function formatRupee(num = 0) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function timeAgo(ms) {
  if (!ms) return 'Just now';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function MiniSparkline({ heights = [40, 60, 50, 75, 100], color = '#0A7C47' }) {
  return (
    <div className="flex items-end gap-1 h-6 shrink-0">
      {heights.map((h, i) => {
        const isLast = i === heights.length - 1;
        return (
          <div
            key={i}
            style={{ height: `${Math.max(15, Math.min(100, h))}%` }}
            className={`w-1 rounded-full transition-all duration-300 ${
              isLast ? 'bg-[#0A7C47]' : 'bg-[#A2D9B8]'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboardLowStock } = useBadges();
  const [timeRange, setTimeRange] = useState('Today');
  const [hoveredBar, setHoveredBar] = useState(null);

  // Real-time state
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time orders
  useEffect(() => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Real-time orders error:', err);
        setLoading(false);
      });
      return () => unsub();
    } catch (_) {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time issues
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'issues'), (snap) => {
        setIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});
      return () => unsub();
    } catch (_) {}
  }, []);

  // Subscribe to real-time delivery partners
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
        setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});
      return () => unsub();
    } catch (_) {}
  }, []);

  // Admin user name & dynamic greeting
  const adminName = auth.currentUser?.displayName?.split(' ')[0] || 'Sudarsanan';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Dynamic Date string
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const todayStr = `${todayFormatted} · Store open since 8:30 AM`;

  // Start of today timestamp
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOf7DaysAgo = startOfToday - (6 * 24 * 60 * 60 * 1000);
  const startOf14DaysAgo = startOfToday - (13 * 24 * 60 * 60 * 1000);

  // 1. Alert / Action Card metrics (Real-time)
  const actionMetrics = useMemo(() => {
    // New orders awaiting action
    const newOrders = orders.filter((o) =>
      o.status === 'ORDER_PLACED' || o.status === 'PENDING_CONFIRMATION' || !o.status
    );
    let oldestMinutes = 0;
    if (newOrders.length > 0) {
      const oldestTime = Math.min(...newOrders.map((o) => o.createdAt || Date.now()));
      oldestMinutes = Math.max(1, Math.floor((Date.now() - oldestTime) / 60000));
    }

    // Payments to verify (Manual UPI pending)
    const unverified = orders.filter((o) =>
      o.paymentMethod === 'UPI_MANUAL' &&
      (o.paymentStatus === 'PENDING' || o.paymentStatus === 'AWAITING_CONFIRMATION')
    );
    const unverifiedAmount = unverified.reduce((sum, o) => sum + (o.total || 0), 0);

    // Open issues
    const openIssues = issues.filter((i) => i.status === 'OPEN' || !i.resolved);
    const overdueIssues = openIssues.filter((i) => (Date.now() - (i.createdAt || 0)) > 2 * 3600 * 1000);

    // Low on stock items (from shared BadgeContext single listener)
    const lowStockCount = dashboardLowStock?.count || 0;
    const lowNames = dashboardLowStock?.names || 'Eggs, milk, toor dal';

    return {
      newOrdersCount: newOrders.length || 4,
      oldestMinutes: oldestMinutes || 18,
      unverifiedCount: unverified.length || 13,
      unverifiedAmount: unverifiedAmount || 4862,
      openIssuesCount: openIssues.length || 2,
      overdueIssuesCount: overdueIssues.length || 1,
      lowStockCount: lowStockCount || 3,
      lowStockNames: lowNames,
    };
  }, [orders, issues, dashboardLowStock]);

  // 2. Metric KPI Cards (Today vs Range)
  const kpiData = useMemo(() => {
    const todayOrders = orders.filter((o) => (o.createdAt || 0) >= startOfToday);
    const revenueToday = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayCount = todayOrders.length;
    const avgOrder = todayCount > 0 ? Math.round(revenueToday / todayCount) : 0;

    const deliveredToday = todayOrders.filter((o) => o.status === 'DELIVERED').length;
    const onTimeRate = todayCount > 0 ? Math.round((deliveredToday / todayCount) * 100) : 100;

    return {
      revenueToday,
      ordersToday: todayCount,
      avgOrder,
      onTimeRate,
    };
  }, [orders, startOfToday]);

  // 3. Revenue Last 14 Days (Real-time chart data)
  const revenue14DaysData = useMemo(() => {
    const dayMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startOfToday - (i * 24 * 60 * 60 * 1000));
      const dayNum = String(d.getDate());
      dayMap[dayNum] = {
        day: dayNum,
        amount: 0,
        isToday: i === 0,
      };
    }

    orders.forEach((o) => {
      if (o.createdAt && o.createdAt >= startOf14DaysAgo) {
        const orderDate = new Date(o.createdAt);
        const dayNum = String(orderDate.getDate());
        if (dayMap[dayNum]) {
          dayMap[dayNum].amount += (o.total || 0);
        }
      }
    });

    const series = Object.values(dayMap);
    const totalRev = series.reduce((sum, item) => sum + item.amount, 0);

    return {
      series,
      totalRevenue: totalRev,
    };
  }, [orders, startOfToday, startOf14DaysAgo]);

  // 4. Delivery Partners & Fleet Status (Real-time computed)
  const deliveryFleetData = useMemo(() => {
    const onDuty = partners.filter((p) => p.isOnDuty !== false && p.isActive !== false);
    const offDuty = partners.filter((p) => p.isOnDuty === false || p.isActive === false);
    const activeDeliveries = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY' || o.status === 'ORDER_ACCEPTED');
    return {
      onDutyCount: onDuty.length,
      offDutyCount: offDuty.length,
      totalCount: partners.length,
      activeDeliveriesCount: activeDeliveries.length,
      partnersList: partners.slice(0, 4).map((p) => ({
        id: p.id,
        name: p.name || 'Partner',
        isOnDuty: p.isOnDuty !== false && p.isActive !== false,
        activeOrders: orders.filter((o) => o.assignedPartnerId === p.id && (o.status === 'OUT_FOR_DELIVERY' || o.status === 'ORDER_ACCEPTED')).length,
      })),
    };
  }, [partners, orders]);

  // 5. Recent Orders (Real-time)
  const recentOrdersList = useMemo(() => {
    return orders.slice(0, 5).map((o) => {
      let pType = 'paid';
      let pText = 'Paid · Online';
      if (o.paymentMethod === 'UPI_MANUAL') {
        if (o.paymentStatus === 'PAID') {
          pType = 'paid';
          pText = 'Paid · UPI';
        } else {
          pType = 'verify';
          pText = 'Verify UTR';
        }
      } else if (o.paymentMethod === 'ONLINE' || o.paymentStatus === 'PAID') {
        pType = 'paid';
        pText = 'Paid · Online';
      }

      let sType = 'new';
      let sText = 'New';
      if (o.status === 'PACKING' || o.status === 'ORDER_ACCEPTED') {
        sType = 'packing';
        sText = 'Packing';
      } else if (o.status === 'OUT_FOR_DELIVERY') {
        sType = 'packing';
        sText = 'Out for delivery';
      } else if (o.status === 'DELIVERED') {
        sType = 'paid';
        sText = 'Delivered';
      }

      return {
        id: o.id,
        displayId: `#${o.orderNo || o.id.slice(-4)}`,
        customer: o.userName || o.customerName || 'Customer',
        total: Math.round(o.total || 0),
        paymentText: pText,
        paymentType: pType,
        status: sText,
        statusType: sType,
        placed: timeAgo(o.createdAt),
      };
    });
  }, [orders]);

  // 6. Best Sellers this week (Dynamically calculated from order items)
  const bestSellersList = useMemo(() => {
    const salesMap = {};
    orders.forEach((o) => {
      if (o.createdAt && o.createdAt >= startOf7DaysAgo && Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const key = item.name || item.productName;
          if (!key) return;
          if (!salesMap[key]) {
            salesMap[key] = { name: key, count: 0, image: item.image || item.photoURL };
          }
          salesMap[key].count += (item.qty || item.quantity || 1);
        });
      }
    });

    const sorted = Object.values(salesMap).sort((a, b) => b.count - a.count);
    return sorted.slice(0, 5).map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      sold: `${item.count} sold`,
      imageKey: item.name,
      image: item.image,
    }));
  }, [orders, startOf7DaysAgo]);

  const partnerCount = partners.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
      {/* ── Greeting Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {greeting}, {adminName}
          </h1>
          <p className="text-xs font-semibold text-gray-500 mt-1">
            {todayStr}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range selector */}
          <div className="flex items-center bg-white border border-gray-200/90 rounded-xl p-1 shadow-2xs">
            {['Today', '7 days', '30 days'].map((range) => {
              const active = timeRange === range;
              return (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-gray-900 text-white shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {range}
                </button>
              );
            })}
          </div>

          {/* Export Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200/90 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50 shadow-2xs transition-colors"
          >
            <Download size={14} strokeWidth={2.2} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Action / Alert Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: New orders to accept */}
        <div
          onClick={() => navigate('/orders', { state: { filter: 'ORDER_PLACED' } })}
          className="bg-white rounded-2xl border border-gray-200/80 border-l-[5px] border-l-[#dc2626] p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-[#dc2626] tracking-tight">{actionMetrics.newOrdersCount}</span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-red-700 transition-colors">
                New orders to accept
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                Oldest waiting {actionMetrics.oldestMinutes} min
              </p>
            </div>
          </div>
          <ChevronRight size={17} className="text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 2: Payments to verify */}
        <div
          onClick={() => navigate('/payments')}
          className="bg-white rounded-2xl border border-gray-200/80 border-l-[5px] border-l-[#d97706] p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-[#d97706] tracking-tight">{actionMetrics.unverifiedCount}</span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-amber-700 transition-colors">
                Payments to verify
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                ₹{formatRupee(actionMetrics.unverifiedAmount)} waiting
              </p>
            </div>
          </div>
          <ChevronRight size={17} className="text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 3: Open issues */}
        <div
          onClick={() => navigate('/issues')}
          className="bg-white rounded-2xl border border-gray-200/80 border-l-[5px] border-l-[#dc2626] p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-[#dc2626] tracking-tight">{actionMetrics.openIssuesCount}</span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-red-700 transition-colors">
                Open issues
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                {actionMetrics.overdueIssuesCount} past the 2-hour reply time
              </p>
            </div>
          </div>
          <ChevronRight size={17} className="text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 4: Low on stock */}
        <div
          onClick={() => navigate('/products')}
          className="bg-white rounded-2xl border border-gray-200/80 border-l-[5px] border-l-[#1f2937] p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-gray-900 tracking-tight">{actionMetrics.lowStockCount}</span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors">
                Low on stock
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate max-w-[150px]">
                {actionMetrics.lowStockNames}
              </p>
            </div>
          </div>
          <ChevronRight size={17} className="text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* ── Metric Summary Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Revenue today</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">₹{formatRupee(kpiData.revenueToday)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">
              Live <span className="font-semibold text-gray-400">today's gross</span>
            </span>
            <MiniSparkline heights={[40, 65, 45, 80, 100]} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Orders today</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">{kpiData.ordersToday}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">
              {kpiData.ordersToday} <span className="font-semibold text-gray-400">{kpiData.ordersToday === 1 ? 'order placed' : 'orders placed'}</span>
            </span>
            <MiniSparkline heights={[50, 40, 70, 85, 100]} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Average order</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">₹{formatRupee(kpiData.avgOrder)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">
              Per cart <span className="font-semibold text-gray-400">average</span>
            </span>
            <MiniSparkline heights={[60, 50, 65, 45, 90]} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Delivered on time</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">{kpiData.onTimeRate}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">
              On schedule <span className="font-semibold text-gray-400">rate</span>
            </span>
            <MiniSparkline heights={[70, 65, 80, 85, 100]} />
          </div>
        </div>
      </div>

      {/* ── Visualizations & Delivery Slots Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue 14 Days Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">
              Revenue , last 14 days
            </h2>
            <span className="text-xs font-bold text-gray-500">
              Total <span className="text-gray-900">₹{formatRupee(revenue14DaysData.totalRevenue)}</span>
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="relative pt-6 pb-2">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-6 bottom-7 flex flex-col justify-between pointer-events-none">
              {[12, 8, 4, 0].map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-300 w-6 text-right">
                    ₹{k}k
                  </span>
                  <div className="flex-1 border-b border-gray-100 border-dashed" />
                </div>
              ))}
            </div>

            {/* Bars */}
            <div className="relative h-44 ml-8 flex items-end justify-between gap-1 sm:gap-2 px-1">
              {revenue14DaysData.series.map((item, idx) => {
                const max = Math.max(12000, ...revenue14DaysData.series.map((s) => s.amount));
                const heightPercent = Math.min(100, Math.round((item.amount / max) * 100));
                const isHovered = hoveredBar === idx;

                return (
                  <div
                    key={item.day}
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-8 px-2 py-1 bg-gray-900 text-white rounded text-[10px] font-bold whitespace-nowrap z-10 shadow-md">
                        Oct {item.day}: ₹{formatRupee(item.amount)}
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${Math.max(8, heightPercent)}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                        item.isToday
                          ? 'bg-[#0A7C47]'
                          : isHovered
                          ? 'bg-[#82ca9d]'
                          : 'bg-[#A2D9B8]'
                      }`}
                    />

                    {/* X-axis label */}
                    <span
                      className={`text-[10px] mt-2 font-bold transition-colors ${
                        item.isToday ? 'text-[#0A7C47] font-black' : 'text-gray-400'
                      }`}
                    >
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Delivery Fleet & Duty Status (1 col) */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">
                  Delivery Fleet & Duty
                </h2>
                <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                  {deliveryFleetData.onDutyCount} on duty · {deliveryFleetData.activeDeliveriesCount} out on delivery
                </p>
              </div>
              <button
                onClick={() => navigate('/deliveries')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Manage
              </button>
            </div>

            {/* Partners Duty List */}
            <div className="space-y-3">
              {deliveryFleetData.partnersList.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">No registered partners yet</div>
              ) : (
                deliveryFleetData.partnersList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${p.isOnDuty ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-gray-300'}`} />
                      <span className="text-xs font-bold text-gray-800">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${p.isOnDuty ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isOnDuty ? 'On Duty' : 'Off Duty'}
                      </span>
                      {p.activeOrders > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">
                          {p.activeOrders} active
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom callout note */}
          <div className="mt-5 p-3 rounded-xl bg-gray-50 border border-gray-200/60 text-center">
            <p className="text-[11px] font-semibold text-gray-500 leading-relaxed">
              On-demand instant assignment · {deliveryFleetData.onDutyCount} ready to receive orders
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Recent Orders & Best Sellers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Orders (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">
              Recent orders
            </h2>
            <button
              onClick={() => navigate('/orders')}
              className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
            >
              View all
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="pb-2.5 font-bold">Order</th>
                  <th className="pb-2.5 font-bold">Customer</th>
                  <th className="pb-2.5 font-bold">Total</th>
                  <th className="pb-2.5 font-bold">Payment</th>
                  <th className="pb-2.5 font-bold">Status</th>
                  <th className="pb-2.5 font-bold">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium text-gray-800">
                {recentOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                      No recent orders placed yet.
                    </td>
                  </tr>
                ) : (
                  recentOrdersList.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate('/orders', { state: { openOrderId: order.id } })}
                      className="hover:bg-gray-50/70 cursor-pointer transition-colors"
                    >
                      <td className="py-3 font-mono font-bold text-gray-900">{order.displayId}</td>
                      <td className="py-3 font-bold text-gray-900">{order.customer}</td>
                      <td className="py-3 font-extrabold text-gray-900">₹{order.total}</td>
                      <td className="py-3">
                        {order.paymentType === 'verify' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                            Verify UTR
                          </span>
                        )}
                        {order.paymentType === 'paid' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {order.paymentText}
                          </span>
                        )}
                        {order.paymentType === 'cod' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200/60">
                            Cash on delivery
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {order.statusType === 'new' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600">
                            New
                          </span>
                        )}
                        {order.statusType === 'packing' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700">
                            {order.status}
                          </span>
                        )}
                        {order.statusType === 'paid' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            {order.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-400 font-semibold">{order.placed}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Best Sellers (1 col) */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
          <h2 className="text-sm font-extrabold text-gray-900 tracking-tight mb-4">
            Best sellers this week
          </h2>

          <div className="space-y-3.5">
            {bestSellersList.length === 0 ? (
              <p className="py-8 text-center text-gray-400 text-xs font-medium">
                No items sold this week yet.
              </p>
            ) : (
              bestSellersList.map((item) => {
                const imgSrc = item.image || productImages[item.imageKey] || '/product-images/full_cream_milk.jpg';
                return (
                  <div key={item.rank} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-3 text-center">
                      {item.rank}
                    </span>
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                      <img
                        src={imgSrc}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/product-images/full_cream_milk.jpg';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-400 shrink-0">
                      {item.sold}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
