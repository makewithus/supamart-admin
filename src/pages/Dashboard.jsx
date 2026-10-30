import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Download, Package, ShoppingBag, Clock
} from 'lucide-react';
import { auth, db } from '../config/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useBadges } from '../context/BadgeContext';
import productImages from '../utils/productImages';
import { apiGet } from '../services/api';

function formatRupee(num = 0) {
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

function getOrderTime(o) {
  if (!o?.createdAt) return Date.now();
  if (typeof o.createdAt === 'number') return o.createdAt;
  if (typeof o.createdAt?.toMillis === 'function') return o.createdAt.toMillis();
  if (o.createdAt?.seconds) return o.createdAt.seconds * 1000;
  if (typeof o.createdAt === 'string') {
    const parsed = Date.parse(o.createdAt);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

function normalizeOrder(o) {
  return {
    ...o,
    createdAt: getOrderTime(o),
    total: Number(o?.total ?? o?.totalAmount ?? o?.finalAmount ?? 0) || 0,
  };
}

function timeAgo(val) {
  const ms = typeof val === 'number' ? val : (val?.seconds ? val.seconds * 1000 : Date.parse(val) || 0);
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

function MiniSparkline({ heights = [20, 20, 20, 20, 20] }) {
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
  const {
    counts: badgeCounts,
    waitingPaymentAmount,
    oldestNewOrderMins,
    dashboardLowStock,
    orders: contextOrders,
    issues: contextIssues,
  } = useBadges();
  const [timeRange, setTimeRange] = useState('Today');
  const [hoveredBar, setHoveredBar] = useState(null);

  // Real-time state
  const [orders, setOrders] = useState([]);
  const [issues, setIssues] = useState([]);
  const [partners, setPartners] = useState([]);
  const [storeConfig, setStoreConfig] = useState(null);
  const [adminUser, setAdminUser] = useState(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state changes to keep admin user reactive
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setAdminUser(user);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time store configuration
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'config', 'global'), (snap) => {
        if (snap.exists()) {
          setStoreConfig(snap.data());
        }
      });
      return () => unsub();
    } catch (_) {}
  }, []);

  const fetchOrdersFromApi = async () => {
    try {
      const data = await apiGet('/orders?limit=50');
      const items = Array.isArray(data) ? data : data?.items || [];
      if (items.length > 0) {
        setOrders(items.map(normalizeOrder));
      }
    } catch (_) {}
    setLoading(false);
  };

  // Consume live orders from unified BadgeContext (0 redundant billable Firestore reads)
  useEffect(() => {
    if (contextOrders && contextOrders.length > 0) {
      setOrders(contextOrders.map(normalizeOrder));
      setLoading(false);
    } else {
      fetchOrdersFromApi();
    }
  }, [contextOrders]);

  // Consume live issues from unified BadgeContext (0 redundant billable Firestore reads)
  useEffect(() => {
    if (contextIssues) {
      setIssues(contextIssues);
    }
  }, [contextIssues]);

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
  const adminName =
    adminUser?.displayName?.trim()?.split(' ')[0] ||
    (adminUser?.email ? adminUser.email.split('@')[0] : 'Admin');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Dynamic Date and Store hours string
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const isSunday = new Date().getDay() === 0;
  const storeOpenTime = isSunday
    ? (storeConfig?.openingHours?.sunOpen || '9:00 AM')
    : (storeConfig?.openingHours?.monSatOpen || '8:30 AM');
  const storeIsOpen = localStorage.getItem('ms_admin_store_open') !== 'false';
  const todayStr = storeIsOpen
    ? `${todayFormatted} · Store open since ${storeOpenTime}`
    : `${todayFormatted} · Store closed`;

  // Timestamps
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOf7DaysAgo = startOfToday - (6 * 24 * 60 * 60 * 1000);
  const startOf30DaysAgo = startOfToday - (29 * 24 * 60 * 60 * 1000);

  // 1. Alert / Action Card metrics (100% Real-time, unified with Sidebar and DB)
  const actionMetrics = useMemo(() => {
    // New orders awaiting action
    const newOrders = orders.filter((o) => {
      const s = (o.status || '').toUpperCase();
      return s === 'ORDER_PLACED' || s === 'PLACED' || s === 'NEW' || !s;
    });

    let oldestMinutes = oldestNewOrderMins;
    if ((!oldestMinutes || oldestMinutes === 0) && newOrders.length > 0) {
      const oldestTime = Math.min(...newOrders.map((o) => o.createdAt || Date.now()));
      oldestMinutes = Math.max(1, Math.floor((Date.now() - oldestTime) / 60000));
    }

    // Payments to verify (Manual UPI pending, excluding cancelled)
    const unverified = orders.filter((o) => {
      const isUpi = !o.paymentMethod || o.paymentMethod === 'UPI_MANUAL' || o.paymentMethod === 'UPI';
      const isPending = o.paymentStatus === 'AWAITING_CONFIRMATION' ||
        o.paymentStatus === 'PENDING' ||
        o.paymentStatus === 'AWAITING_VERIFICATION';
      const notCancelled = (o.status || '').toUpperCase() !== 'CANCELLED';
      return isUpi && isPending && notCancelled;
    });
    const calculatedAmount = unverified.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const unverifiedAmount = waitingPaymentAmount > 0 ? waitingPaymentAmount : calculatedAmount;

    // Open issues
    const openIssues = issues.filter((i) => i.status === 'OPEN' || (!i.status && !i.resolved));
    const overdueIssues = openIssues.filter((i) => (Date.now() - (i.createdAt || 0)) > 2 * 3600 * 1000);

    // Low on stock items
    const lowStockCount = dashboardLowStock?.count || 0;
    const lowNames = dashboardLowStock?.names || '';

    return {
      newOrdersCount: badgeCounts?.orders ?? newOrders.length,
      oldestMinutes,
      unverifiedCount: badgeCounts?.payments ?? unverified.length,
      unverifiedAmount,
      openIssuesCount: badgeCounts?.issues ?? openIssues.length,
      overdueIssuesCount: overdueIssues.length,
      lowStockCount,
      lowStockNames: lowNames,
    };
  }, [orders, issues, dashboardLowStock, badgeCounts, waitingPaymentAmount, oldestNewOrderMins]);

  // 2. Metric KPI Cards (Real-time computed based on selected timeRange)
  const rangeConfig = useMemo(() => {
    if (timeRange === '7 days') {
      return {
        start: startOf7DaysAgo,
        label: 'last 7 days',
        revenueSubtitle: "last 7 days' gross",
        ordersSubtitle: 'in last 7 days',
      };
    }
    if (timeRange === '30 days') {
      return {
        start: startOf30DaysAgo,
        label: 'last 30 days',
        revenueSubtitle: "last 30 days' gross",
        ordersSubtitle: 'in last 30 days',
      };
    }
    return {
      start: startOfToday,
      label: 'today',
      revenueSubtitle: "today's gross",
      ordersSubtitle: 'today',
    };
  }, [timeRange, startOfToday, startOf7DaysAgo, startOf30DaysAgo]);

  const kpiData = useMemo(() => {
    const rangeOrders = orders.filter((o) => (o.createdAt || 0) >= rangeConfig.start);
    const revenue = rangeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const count = rangeOrders.length;
    const avgOrder = count > 0 ? Math.round(revenue / count) : 0;

    const delivered = rangeOrders.filter((o) => o.status === 'DELIVERED');
    const onTimeDelivered = delivered.filter((o) => !o.delayReason && !o.deliveryDelay);
    const onTimeRate = delivered.length > 0
      ? Math.round((onTimeDelivered.length / delivered.length) * 100)
      : (count > 0 ? 100 : 0);

    return {
      revenue,
      ordersCount: count,
      avgOrder,
      onTimeRate,
    };
  }, [orders, rangeConfig]);

  // 3. Dynamic Sparklines (5 daily intervals leading up to today)
  const sparklineData = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const buckets = [4, 3, 2, 1, 0].map((daysAgo) => {
      const bStart = startOfToday - (daysAgo * dayMs);
      const bEnd = bStart + dayMs;
      const bOrders = orders.filter((o) => (o.createdAt || 0) >= bStart && (o.createdAt || 0) < bEnd);
      const bRevenue = bOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const bCount = bOrders.length;
      const bAvg = bCount > 0 ? Math.round(bRevenue / bCount) : 0;
      const bDelivered = bOrders.filter((o) => o.status === 'DELIVERED');
      const bOnTime = bDelivered.filter((o) => !o.delayReason && !o.deliveryDelay);
      const bRate = bDelivered.length > 0 ? Math.round((bOnTime.length / bDelivered.length) * 100) : (bCount > 0 ? 100 : 0);
      return { revenue: bRevenue, count: bCount, avg: bAvg, rate: bRate };
    });

    const scale = (values) => {
      const max = Math.max(...values);
      if (max <= 0) return [20, 20, 20, 20, 20];
      return values.map((v) => Math.max(15, Math.round((v / max) * 100)));
    };

    return {
      revenue: scale(buckets.map((b) => b.revenue)),
      orders: scale(buckets.map((b) => b.count)),
      avg: scale(buckets.map((b) => b.avg)),
      rate: buckets.map((b) => Math.max(15, b.rate)),
    };
  }, [orders, startOfToday]);

  // 4. Revenue Last 14 Days (Real-time chart data with dynamic month formatting)
  const revenue14DaysData = useMemo(() => {
    const series = [];
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 13; i >= 0; i--) {
      const dayStart = startOfToday - (i * dayMs);
      const dayEnd = dayStart + dayMs;
      const d = new Date(dayStart);
      const dayNum = String(d.getDate());
      const monthShort = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullLabel = `${monthShort} ${dayNum}`;

      const dayRevenue = orders
        .filter((o) => (o.createdAt || 0) >= dayStart && (o.createdAt || 0) < dayEnd)
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      series.push({
        day: dayNum,
        monthShort,
        fullLabel,
        amount: dayRevenue,
        isToday: i === 0,
      });
    }

    const totalRev = series.reduce((sum, item) => sum + item.amount, 0);

    return {
      series,
      totalRevenue: totalRev,
    };
  }, [orders, startOfToday]);

  // Dynamic grid scale for 14-day chart
  const chartMax = useMemo(() => {
    const maxVal = Math.max(0, ...revenue14DaysData.series.map((s) => s.amount));
    if (maxVal <= 0) return 1000;
    if (maxVal <= 1000) return 1000;
    if (maxVal <= 5000) return Math.ceil(maxVal / 1000) * 1000;
    if (maxVal <= 20000) return Math.ceil(maxVal / 2500) * 2500;
    return Math.ceil(maxVal / 5000) * 5000;
  }, [revenue14DaysData.series]);

  const gridLevels = useMemo(() => {
    const step = chartMax / 3;
    return [
      chartMax,
      Math.round(chartMax - step),
      Math.round(chartMax - 2 * step),
      0,
    ];
  }, [chartMax]);

  // 5. Delivery Partners & Fleet Status (Real-time computed)
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

  // 6. Recent Orders (Real-time)
  const recentOrdersList = useMemo(() => {
    return orders.slice(0, 5).map((o) => {
      let pType = 'paid';
      let pText = 'Paid · Online';
      if (o.paymentMethod === 'COD' || o.paymentMethod === 'CASH_ON_DELIVERY') {
        pType = 'cod';
        pText = o.paymentStatus === 'PAID' ? 'COD · Paid' : 'Cash on delivery';
      } else if (o.paymentMethod === 'UPI_MANUAL' || o.paymentMethod === 'UPI') {
        if (o.paymentStatus === 'PAID') {
          pType = 'paid';
          pText = 'Paid · UPI';
        } else if (o.paymentStatus === 'FAILED') {
          pType = 'failed';
          pText = 'UPI · Failed';
        } else {
          pType = 'verify';
          pText = 'Verify UTR';
        }
      } else if (o.paymentStatus === 'PAID') {
        pType = 'paid';
        pText = 'Paid · Online';
      } else if (o.paymentStatus === 'FAILED') {
        pType = 'failed';
        pText = 'Payment failed';
      } else {
        pType = 'pending';
        pText = 'Pending';
      }

      let sType = 'new';
      let sText = 'New';
      if (o.status === 'PACKING' || o.status === 'ORDER_ACCEPTED' || o.status === 'ACCEPTED') {
        sType = 'packing';
        sText = 'Packing';
      } else if (o.status === 'OUT_FOR_DELIVERY') {
        sType = 'packing';
        sText = 'Out for delivery';
      } else if (o.status === 'DELIVERED') {
        sType = 'paid';
        sText = 'Delivered';
      } else if (o.status === 'CANCELLED') {
        sType = 'cancelled';
        sText = 'Cancelled';
      }

      const cust = o.userName || o.customerName || o.addressSnapshot?.name || o.address?.name || 'Customer';

      return {
        id: o.id,
        displayId: `#${o.orderNo || o.id.slice(-4)}`,
        customer: cust,
        total: Math.round(Number(o.total) || 0),
        paymentText: pText,
        paymentType: pType,
        status: sText,
        statusType: sType,
        placed: timeAgo(o.createdAt),
      };
    });
  }, [orders]);

  // 7. Best Sellers this week (Dynamically calculated from real order items)
  const bestSellersList = useMemo(() => {
    const salesMap = {};
    orders.forEach((o) => {
      if (o.createdAt && o.createdAt >= startOf7DaysAgo && Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const key = item.name || item.productName;
          if (!key) return;
          if (!salesMap[key]) {
            salesMap[key] = {
              name: key,
              count: 0,
              image: item.image || item.photoURL || null,
            };
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

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full animate-fade-in">
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
            <span className="text-2xl font-black text-[#dc2626] tracking-tight">
              {actionMetrics.newOrdersCount}
            </span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-red-700 transition-colors">
                New orders to accept
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                {actionMetrics.newOrdersCount > 0
                  ? `Oldest waiting ${actionMetrics.oldestMinutes} min`
                  : 'All orders processed'}
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
            <span className="text-2xl font-black text-[#d97706] tracking-tight">
              {actionMetrics.unverifiedCount}
            </span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-amber-700 transition-colors">
                Payments to verify
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                {actionMetrics.unverifiedCount > 0
                  ? `₹${formatRupee(actionMetrics.unverifiedAmount)} waiting`
                  : 'No pending payments'}
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
            <span className="text-2xl font-black text-[#dc2626] tracking-tight">
              {actionMetrics.openIssuesCount}
            </span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-red-700 transition-colors">
                Open issues
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                {actionMetrics.openIssuesCount > 0
                  ? (actionMetrics.overdueIssuesCount > 0
                      ? `${actionMetrics.overdueIssuesCount} past the 2-hour reply time`
                      : `${actionMetrics.openIssuesCount} awaiting response`)
                  : 'No open issues'}
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
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {actionMetrics.lowStockCount}
            </span>
            <div>
              <p className="text-xs font-extrabold text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors">
                Low on stock
              </p>
              <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate max-w-[150px]">
                {actionMetrics.lowStockCount > 0
                  ? (actionMetrics.lowStockNames || `${actionMetrics.lowStockCount} items need restock`)
                  : 'Inventory healthy'}
              </p>
            </div>
          </div>
          <ChevronRight size={17} className="text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* ── Metric Summary Cards Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Revenue · {timeRange}</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              ₹{formatRupee(kpiData.revenue)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">
              Live <span className="font-semibold text-gray-400">{rangeConfig.revenueSubtitle}</span>
            </span>
            <MiniSparkline heights={sparklineData.revenue} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Orders · {timeRange}</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {kpiData.ordersCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">
              {kpiData.ordersCount} <span className="font-semibold text-gray-400">{kpiData.ordersCount === 1 ? 'order' : 'orders'} {rangeConfig.ordersSubtitle}</span>
            </span>
            <MiniSparkline heights={sparklineData.orders} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Average order</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              ₹{formatRupee(kpiData.avgOrder)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">
              Per cart <span className="font-semibold text-gray-400">average</span>
            </span>
            <MiniSparkline heights={sparklineData.avg} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500">Delivered on time</p>
          <div className="my-2">
            <span className="text-2xl font-black text-gray-900 tracking-tight">
              {kpiData.onTimeRate}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">
              On schedule <span className="font-semibold text-gray-400">rate</span>
            </span>
            <MiniSparkline heights={sparklineData.rate} />
          </div>
        </div>
      </div>

      {/* ── Visualizations & Delivery Slots Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue 14 Days Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">
              Revenue — last 14 days
            </h2>
            <span className="text-xs font-bold text-gray-500">
              Total <span className="text-gray-900 font-extrabold">₹{formatRupee(revenue14DaysData.totalRevenue)}</span>
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="relative pt-6 pb-2">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-6 bottom-7 flex flex-col justify-between pointer-events-none">
              {gridLevels.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-300 w-8 text-right">
                    {val >= 1000
                      ? `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
                      : `₹${val}`}
                  </span>
                  <div className="flex-1 border-b border-gray-100 border-dashed" />
                </div>
              ))}
            </div>

            {/* Bars */}
            <div className="relative h-44 ml-10 flex items-end justify-between gap-1 sm:gap-2 px-1">
              {revenue14DaysData.series.map((item, idx) => {
                const heightPercent = chartMax > 0 && item.amount > 0
                  ? Math.max(8, Math.min(100, Math.round((item.amount / chartMax) * 100)))
                  : 4;
                const isHovered = hoveredBar === idx;

                return (
                  <div
                    key={`${item.fullLabel}-${idx}`}
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-8 px-2 py-1 bg-gray-900 text-white rounded text-[10px] font-bold whitespace-nowrap z-10 shadow-md">
                        {item.fullLabel}: ₹{formatRupee(item.amount)}
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                        item.isToday
                          ? 'bg-[#0A7C47]'
                          : isHovered
                          ? 'bg-[#82ca9d]'
                          : item.amount > 0
                          ? 'bg-[#A2D9B8]'
                          : 'bg-gray-100'
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
                <div className="text-xs text-gray-400 text-center py-8">No registered delivery partners yet</div>
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

          {/* Recent Orders - Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
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
                            {order.paymentText}
                          </span>
                        )}
                        {order.paymentType === 'failed' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            Failed
                          </span>
                        )}
                        {order.paymentType === 'pending' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                            Pending
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
                        {order.statusType === 'cancelled' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-500">
                            Cancelled
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

          {/* Recent Orders - Mobile Cards */}
          <div className="block md:hidden space-y-2.5">
            {recentOrdersList.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-medium bg-gray-50/60 rounded-xl border border-gray-100">
                No recent orders placed yet.
              </div>
            ) : (
              recentOrdersList.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate('/orders', { state: { openOrderId: order.id } })}
                  className="p-3.5 rounded-xl border border-gray-200/80 bg-white shadow-2xs hover:border-gray-300 transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">
                      {order.displayId}
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      ₹{order.total}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800 truncate mr-2">
                      {order.customer}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">
                      {order.placed}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      {order.paymentType === 'verify' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                          Verify UTR
                        </span>
                      )}
                      {order.paymentType === 'paid' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          {order.paymentText}
                        </span>
                      )}
                      {order.paymentType === 'cod' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200/60">
                          {order.paymentText}
                        </span>
                      )}
                      {order.paymentType === 'failed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                          Failed
                        </span>
                      )}
                      {order.paymentType === 'pending' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          Pending
                        </span>
                      )}
                    </div>

                    <div>
                      {order.statusType === 'new' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600">
                          New
                        </span>
                      )}
                      {order.statusType === 'packing' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700">
                          {order.status}
                        </span>
                      )}
                      {order.statusType === 'paid' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {order.status}
                        </span>
                      )}
                      {order.statusType === 'cancelled' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
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
                const imgSrc = item.image || productImages[item.imageKey] || null;
                return (
                  <div key={item.rank} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-3 text-center">
                      {item.rank}
                    </span>
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0 flex items-center justify-center">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.innerHTML = '<span class="text-gray-300 font-bold text-[10px]">MS</span>';
                            }
                          }}
                        />
                      ) : (
                        <Package size={18} className="text-gray-400" />
                      )}
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
