import React, { useEffect, useState } from 'react';
import {
  ClipboardList, Banknote, Package, Users, Clock, CheckCircle2,
  XCircle, TrendingUp, AlertTriangle, ShoppingCart, Tag
} from 'lucide-react';
import { apiGet } from '../services/api';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import IconChip from '../components/ui/IconChip';

const STATUS_BADGE = {
  PENDING:    { label: 'Pending',    v: 'warning'  },
  CONFIRMED:  { label: 'Confirmed',  v: 'info'     },
  PACKING:    { label: 'Packing',    v: 'info'     },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', v: 'info' },
  DELIVERED:  { label: 'Delivered',  v: 'success'  },
  CANCELLED:  { label: 'Cancelled',  v: 'error'    },
};

function fmt(n) {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function Dashboard() {
  const [stats,  setStats]  = useState({ orders: 0, revenue: 0, products: 0, customers: 0, pending: 0, delivered: 0, cancelled: 0 });
  const [recent, setRecent] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [activeOffers, setActiveOffers] = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, ordersRes, lowStockRes, offersRes] = await Promise.all([
          apiGet('/admin/dashboard'),
          apiGet('/orders?limit=6'),
          apiGet('/admin/low-stock?threshold=10'),
          apiGet('/offers/active').catch(() => ({ items: [] }))
        ]);

        const td = dashRes.today || {};
        const md = dashRes.month || {};
        
        setStats({
          orders:    td.orders || 0,
          revenue:   td.revenue || 0,
          products:  0, // We could add a counter for this on backend if needed, for now just use today's metrics
          customers: 0,
          pending:   td.pending || 0,
          delivered: td.delivered || 0,
          cancelled: td.cancelled || 0,
        });

        setRecent(ordersRes.items || []);
        
        const low = (lowStockRes.items || []).flatMap(p => 
          (p.lowVariants || []).map(v => ({ ...p, variantLabel: v.label, stock: v.stock }))
        );
        setLowStock(low.slice(0, 8));
        setActiveOffers(offersRes.items?.length || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-neutral-50">
      <PageHeader
        title="Dashboard"
        subtitle={today}
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-8">
        <StatCard icon={ClipboardList} color="secondary" label="Today's Orders"   value={fmt(stats.orders)}    sub={`${stats.pending} pending today`}   style={{ animationDelay: '0ms'   }} />
        <StatCard icon={Banknote}      color="tertiary"  label="Today's Revenue"  value={`₹${fmt(stats.revenue)}`} sub="For today"              style={{ animationDelay: '75ms'  }} />
        <StatCard icon={Package}       color="primary"   label="Low Stock"       value={lowStock.length}  sub="Items needing refill"                   style={{ animationDelay: '150ms' }} />
        <StatCard icon={TrendingUp}    color="neutral"   label="Success Rate"    value={`${stats.orders > 0 ? Math.round((stats.delivered/stats.orders)*100) : 100}%`} sub="Today's completion"                   style={{ animationDelay: '225ms' }} />
        <StatCard icon={Tag}           color="secondary" label="Active Offers"   value={activeOffers}      sub="Currently running"                      style={{ animationDelay: '300ms' }} />
      </div>

      {/* ── Status mini-row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Clock,         color: 'amber',     label: 'Pending',   value: stats.pending    },
          { icon: CheckCircle2,  color: 'secondary', label: 'Delivered', value: stats.delivered  },
          { icon: XCircle,       color: 'red',       label: 'Cancelled', value: stats.cancelled  },
        ].map(({ icon: Icon, color, label, value }, i) => (
          <div key={label} className="bg-white rounded-2xl shadow-card px-5 py-4 flex items-center gap-4 animate-fade-up opacity-0-init" style={{ animationDelay: `${300 + i * 60}ms` }}>
            <IconChip icon={Icon} color={color} size="sm" />
            <div>
              <p className="text-xl font-bold text-primary-900 leading-none">{value}</p>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Lower grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders (spans 2 cols on large screens) */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-primary-900">Recent Orders</h2>
              <Badge variant="neutral">{recent.length} shown</Badge>
            </div>
            {loading ? <Loader text="Fetching orders…" /> : recent.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No orders yet" />
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      {['Order ID', 'Customer', 'Amount', 'Status', 'Time'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((o, i) => {
                      const s = STATUS_BADGE[o.status] || { label: o.status, v: 'neutral' };
                      return (
                        <tr key={o.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-xs text-neutral-500">#{o.id.slice(-6).toUpperCase()}</td>
                          <td className="px-6 py-3.5 font-medium text-primary-900">{o.userPhone || o.userId?.slice(0, 10) || '—'}</td>
                          <td className="px-6 py-3.5 font-semibold text-primary-900">₹{fmt(o.total || 0)}</td>
                          <td className="px-6 py-3.5"><Badge variant={s.v}>{s.label}</Badge></td>
                          <td className="px-6 py-3.5 text-neutral-400 text-xs">{timeAgo(o.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Low stock */}
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <IconChip icon={AlertTriangle} color="amber" size="sm" />
              <h2 className="text-base font-bold text-primary-900">Low Stock</h2>
            </div>
            {loading ? <Loader text="Checking stock…" /> : lowStock.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 size={32} className="text-secondary-400 mb-2" strokeWidth={1.5} />
                <p className="text-sm font-medium text-neutral-400">All products well-stocked</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStock.map((p) => (
                  <div key={`${p.id}-${p.variantLabel}`} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-primary-900 truncate">{p.name}</p>
                      <p className="text-xs text-neutral-400">{p.variantLabel}</p>
                    </div>
                    <Badge variant={p.stock === 0 ? 'error' : 'warning'}>
                      {p.stock === 0 ? 'Out' : `${p.stock} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
