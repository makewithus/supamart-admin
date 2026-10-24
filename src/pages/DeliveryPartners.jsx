import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Phone, MapPin, MessageSquare, ChevronDown, Check,
  X, UserPlus, Clock
} from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { apiPost, apiPatch } from '../services/api';
import { formatDeliverySlot } from '../utils/orderUtils';
import toast from 'react-hot-toast';

function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length >= 10) {
    return `${clean.slice(0, 5)} •••${clean.slice(-2)}`;
  }
  return clean;
}

export default function DeliveryPartners() {
  const [rawPartners, setRawPartners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackingPartner, setTrackingPartner] = useState(null);

  // New partner form fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Subscribe in real-time to deliveryPartners collection
  useEffect(() => {
    try {
      const q = query(collection(db, 'deliveryPartners'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          setRawPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.error('deliveryPartners snapshot error:', err);
          // If orderBy index fails, fallback to unordered query
          onSnapshot(collection(db, 'deliveryPartners'), (s) => {
            setRawPartners(s.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
          });
        }
      );
      return () => unsub();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  // Subscribe in real-time to orders collection to calculate dynamic live metrics
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'orders'), (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Map partners with live activity, counts, and status
  const partners = useMemo(() => {
    return rawPartners.map((p) => {
      const pOrders = orders.filter((o) => o.assignedPartnerId === p.id);
      const activeOrder = pOrders.find((o) => o.status === 'OUT_FOR_DELIVERY' || o.status === 'ORDER_ACCEPTED');
      const deliveredTodayCount = pOrders.filter((o) => o.status === 'DELIVERED').length;
      const cashHeld = pOrders
        .filter((o) => (o.paymentMethod === 'COD' || o.paymentMethod === 'CASH_ON_DELIVERY') && o.status === 'DELIVERED')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      let status = 'At store';
      let statusType = 'at_store';
      let online = p.isActive !== false;
      let subText = 'Free · ready for orders';
      let btnAction = 'Assign order';

      if (!online) {
        status = 'Off duty';
        statusType = 'off_duty';
        subText = 'Offline';
        btnAction = 'Message';
      } else if (activeOrder) {
        status = 'On delivery';
        statusType = 'on_delivery';
        const area = activeOrder.addressSnapshot?.city || activeOrder.address?.area || 'Menamkulam';
        subText = `Order #${activeOrder.orderNo || activeOrder.id?.slice(-4)} · ${area}`;
        btnAction = 'Track';
      }

      return {
        id: p.id,
        initial: (p.name || 'P')[0]?.toUpperCase(),
        name: p.name || 'Partner',
        phone: maskPhone(p.mobile || p.phone),
        fullPhone: p.mobile || p.phone || '',
        status,
        statusType,
        online,
        subText,
        delivered: deliveredTodayCount,
        cashHeld: Math.round(cashHeld),
        onTime: deliveredTodayCount > 0 ? '100%' : '—',
        btnAction,
        currentLocation: p.currentLocation || null,
        raw: p,
      };
    });
  }, [rawPartners, orders]);

  // Orders that need a partner (Ready to dispatch)
  const dispatchOrders = useMemo(() => {
    return orders
      .filter((o) => !o.assignedPartnerId && (o.status === 'PACKING' || o.status === 'ORDER_ACCEPTED' || o.status === 'ORDER_PLACED'))
      .map((o) => ({
        id: o.id,
        orderNo: o.orderNo ? `#${o.orderNo}` : `#${o.id.slice(-4)}`,
        customer: o.userName || o.addressSnapshot?.name || o.address?.name || 'Customer',
        area: o.addressSnapshot?.city || o.address?.area || 'Menamkulam',
        distance: '0.8 km',
        slot: formatDeliverySlot(o.deliverySlot || o.slot),
        instructions: o.deliveryInstructions || o.instructions || 'Leave at door · Call on arrival',
        assignedTo: '',
      }));
  }, [orders]);

  // Aggregate counts for header
  const partnerCounts = useMemo(() => {
    let onDelivery = 0;
    let atStore = 0;
    let offDuty = 0;
    partners.forEach((p) => {
      if (p.statusType === 'on_delivery') onDelivery++;
      else if (p.statusType === 'at_store') atStore++;
      else offDuty++;
    });
    return { onDelivery, atStore, offDuty };
  }, [partners]);

  const handleAddPartner = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost('/delivery-partners', { name, mobile, email, password });
      toast.success('Delivery partner added successfully!');
      setIsModalOpen(false);
      setName('');
      setMobile('');
      setEmail('');
      setPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (orderId, partnerId) => {
    if (!partnerId) return;
    const targetPartner = partners.find((p) => p.id === partnerId);
    try {
      await apiPatch(`/orders/${orderId}/assign`, { partnerId });
      toast.success(`Assigned Order to ${targetPartner?.name || 'Partner'}`);
    } catch (err) {
      toast.error(err.message || 'Failed to assign order');
    }
  };

  const handleCall = (phone) => {
    if (!phone) return toast.error('No phone number on file');
    window.location.href = `tel:${phone}`;
  };

  const handleTrack = (partner) => {
    if (partner.btnAction === 'Track') {
      if (partner.currentLocation) {
        toast.success(`Live coordinates: Lat ${partner.currentLocation.lat.toFixed(4)}, Lng ${partner.currentLocation.lng.toFixed(4)}`);
      } else {
        toast.success(`Live tracking for ${partner.name} is active`);
      }
    } else if (partner.btnAction === 'Assign order') {
      toast('Select an order in "Ready to dispatch" table below to assign');
    } else {
      window.open(`https://wa.me/91${partner.fullPhone.replace(/\D/g, '')}`, '_blank');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 w-full animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Deliveries
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            {partnerCounts.onDelivery} out on delivery · {partnerCounts.atStore} waiting at store · {partnerCounts.offDuty} off duty
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0A7C47] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Add partner</span>
        </button>
      </div>

      {/* ── Partner Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-semibold bg-white rounded-2xl border border-gray-100">
            Loading delivery partners from database…
          </div>
        ) : partners.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 font-semibold bg-white rounded-2xl border border-gray-100">
            No delivery partners registered yet. Click "Add partner" above.
          </div>
        ) : (
          partners.map((partner) => (
            <div
              key={partner.id}
              className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                {/* Header: Avatar, Name, Status Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-black text-xs text-gray-700">
                        {partner.initial}
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ring-2 ring-white absolute -bottom-0.5 -right-0.5 ${
                          partner.online ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-gray-900 leading-tight">
                        {partner.name}
                      </p>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                        {partner.phone}
                      </p>
                    </div>
                  </div>

                  {/* Status Pill Badge */}
                  <div>
                    {partner.statusType === 'on_delivery' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 text-cyan-700">
                        On delivery
                      </span>
                    )}
                    {partner.statusType === 'at_store' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        At store
                      </span>
                    )}
                    {partner.statusType === 'off_duty' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-600">
                        Off duty
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub info banner */}
                <div className="my-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-medium text-gray-600 truncate">
                  {partner.subText}
                </div>

                {/* Metrics 3-column row */}
                <div className="grid grid-cols-3 text-center py-1 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-black text-gray-900 leading-tight">{partner.delivered}</p>
                    <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Delivered</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 leading-tight">₹{partner.cashHeld}</p>
                    <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Cash held</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 leading-tight">{partner.onTime}</p>
                    <p className="text-[10px] font-semibold text-gray-400 mt-0.5">On time</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-3">
                <button
                  onClick={() => handleCall(partner.fullPhone)}
                  className="flex-1 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors text-center cursor-pointer"
                >
                  Call
                </button>

                <button
                  onClick={() => handleTrack(partner)}
                  className="flex-1 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors text-center cursor-pointer"
                >
                  {partner.btnAction}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Ready to Dispatch Section (Live packed orders from DB) ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">
            Ready to dispatch
          </h2>
          <span className="text-xs font-semibold text-gray-400">
            {dispatchOrders.length} packed {dispatchOrders.length === 1 ? 'order' : 'orders'} waiting for partner
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="pb-3 font-bold">Order</th>
                <th className="pb-3 font-bold">Customer</th>
                <th className="pb-3 font-bold">Area</th>
                <th className="pb-3 font-bold">Distance</th>
                <th className="pb-3 font-bold">Slot</th>
                <th className="pb-3 font-bold">Instructions</th>
                <th className="pb-3 font-bold">Assign to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium text-gray-800">
              {dispatchOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-semibold">
                    No packed orders currently waiting for dispatch. All assigned!
                  </td>
                </tr>
              ) : (
                dispatchOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 font-mono font-bold text-gray-900">{o.orderNo}</td>
                    <td className="py-3.5 font-bold text-gray-900">{o.customer}</td>
                    <td className="py-3.5 text-gray-600">{o.area}</td>
                    <td className="py-3.5 text-gray-600">{o.distance}</td>
                    <td className="py-3.5 text-gray-600">{formatDeliverySlot(o.slot)}</td>
                    <td className="py-3.5 text-amber-900 font-semibold">{o.instructions}</td>
                    <td className="py-3.5">
                      <select
                        defaultValue=""
                        onChange={(e) => handleAssign(o.id, e.target.value)}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
                      >
                        <option value="">Choose partner</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.status})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Partner Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => !saving && setIsModalOpen(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 z-50 animate-fade-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-extrabold text-gray-900">
                Add Delivery Partner
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPartner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  placeholder="partner@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile (10 digits)</label>
                <input
                  required
                  pattern="[0-9]{10}"
                  type="tel"
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Initial Password</label>
                <input
                  required
                  minLength={6}
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0A7C47] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
