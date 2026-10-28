import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Phone, MapPin, MessageSquare, ChevronDown, Check,
  X, UserPlus, Clock, ExternalLink, Star, AlertCircle, AlertTriangle
} from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { apiPost, apiPatch } from '../services/api';
import toast from 'react-hot-toast';
import { formatDeliveryInstructions, formatAddress } from '../utils/orderUtils';

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
  const [deliveryTab, setDeliveryTab] = useState('ALL');

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

  // Subscribe in real-time to recent orders to calculate dynamic live metrics
  useEffect(() => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Map partners with live activity, counts, and duty status strictly from DB
  const partners = useMemo(() => {
    return (rawPartners || []).filter(Boolean).map((p) => {
      const pOrders = (orders || []).filter((o) => o && o.assignedPartnerId === p.id);
      const activeOrders = pOrders.filter(
        (o) =>
          (o.status === 'OUT_FOR_DELIVERY' || o.status === 'ORDER_ACCEPTED' || o.status === 'PENDING_CONFIRMATION') &&
          o.deliveryAcceptanceStatus !== 'REJECTED'
      );
      const deliveredOrders = pOrders.filter((o) => o.status === 'DELIVERED');
      const deliveredTodayCount = deliveredOrders.length;
      const onTimeDelivered = deliveredOrders.filter((o) => !o.delayReason && !o.deliveryDelay);

      let online = p?.isOnDuty !== false && p?.isActive !== false;
      let status = 'On duty';
      let statusType = 'at_store';
      let subText = 'Available · Ready for orders';
      let btnAction = 'Track';

      if (!online) {
        status = 'Off duty';
        statusType = 'off_duty';
        subText = 'Off duty · Cannot receive orders';
        btnAction = 'Message';
      } else if (activeOrders.length > 0) {
        status = 'On delivery';
        statusType = 'on_delivery';
        subText = `${activeOrders.length} active ${activeOrders.length === 1 ? 'delivery' : 'deliveries'}`;
        btnAction = 'Track';
      }

      const onTimePercent = deliveredTodayCount > 0
        ? `${Math.round((onTimeDelivered.length / deliveredTodayCount) * 100)}%`
        : '—';

      return {
        id: p?.id || 'partner',
        initial: (p?.name || 'P')[0]?.toUpperCase() || 'P',
        name: p?.name || 'Partner',
        phone: maskPhone(p?.mobile || p?.phone),
        fullPhone: p?.mobile || p?.phone || '',
        status,
        statusType,
        online,
        subText,
        delivered: deliveredTodayCount,
        activeOrdersCount: activeOrders.length,
        onTime: onTimePercent,
        btnAction,
        currentLocation: p?.currentLocation || null,
        lastSyncedAt: p?.lastSyncedAt || null,
        raw: p,
      };
    });
  }, [rawPartners, orders]);

  // Comprehensive deliveries list for real-time tracking
  const deliveriesList = useMemo(() => {
    return (orders || [])
      .filter((o) => o && o.status !== 'CANCELLED')
      .map((o) => {
        const orderNo = o.orderNo ? `#${o.orderNo}` : (o.id ? `#${o.id.slice(-4)}` : '#----');
        const customer = o.userName || o.addressSnapshot?.name || o.address?.name || 'Customer';
        const phone = o.userPhone || o.addressSnapshot?.phone || o.address?.phone || '';
        const rawAddr = o.address || o.addressSnapshot;
        const formattedAddr = formatAddress(rawAddr);
        const instructions = formatDeliveryInstructions(o.deliveryInstructions || o.instructions || o.notes);
        const items = Array.isArray(o.items) ? o.items : [];
        const itemsSummary = items.map((it) => `${it?.name || 'Item'} (x${it?.quantity || it?.qty || 1})`).join(', ');

        const assignedPartner = Array.isArray(rawPartners) ? rawPartners.find((p) => p && p.id === o.assignedPartnerId) : null;
        const partnerName = o.deliveryBoyName || assignedPartner?.name || 'Unassigned';
        const partnerPhone = o.deliveryBoyPhone || assignedPartner?.mobile || assignedPartner?.phone || '';
        const acceptanceStatus = o.deliveryAcceptanceStatus || (o.assignedPartnerId ? 'PENDING' : null);

        const syncLocation = o.lastSyncedLocation || assignedPartner?.currentLocation || null;
        const lastSyncedTime = o.lastSyncedAt || assignedPartner?.lastSyncedAt || null;

        const delayReason = o.delayReason || o.deliveryDelay?.delayReason || o.deliveryDelay?.reason || null;
        const newEstimatedTime = o.deliveryDelay?.newEstimatedTime || null;

        const isDelivered = o.status === 'DELIVERED';
        const isPendingConfirmation = o.status === 'PENDING_CONFIRMATION';
        const isOutForDelivery = o.status === 'OUT_FOR_DELIVERY';
        const isConfirmed = !!(o.confirmedAt || o.orderRating || o.rating);
        const rating = o.orderRating || o.rating || null;
        const paymentMethod = o.paymentMethod || 'ONLINE';
        const isPaid = !!(o.isPaid || o.paymentStatus === 'PAID');

        return {
          id: o.id,
          orderNo,
          placed: o.placed || (o.createdAt ? new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'),
          itemsCount: items.length,
          itemsSummary: itemsSummary || '1 package',
          total: Math.round(Number(o.total || o.totalAmount) || 0),
          customer,
          phone,
          address: formattedAddr,
          instructions,
          assignedPartnerId: o.assignedPartnerId || null,
          partnerName,
          partnerPhone,
          acceptanceStatus,
          syncLocation,
          lastSyncedTime,
          delayReason,
          newEstimatedTime,
          status: o.status,
          isDelivered,
          isPendingConfirmation,
          isOutForDelivery,
          isConfirmed,
          rating,
          paymentMethod,
          isPaid,
          raw: o,
        };
      })
      .filter((d) => {
        if (deliveryTab === 'ACTIVE') return d.isOutForDelivery || d.isPendingConfirmation || d.status === 'PACKING' || d.status === 'ORDER_ACCEPTED';
        if (deliveryTab === 'CONFIRMED') return d.isDelivered || d.isConfirmed;
        if (deliveryTab === 'DELAYED') return !!d.delayReason;
        if (deliveryTab === 'REJECTED') return d.acceptanceStatus === 'REJECTED';
        return true;
      });
  }, [orders, rawPartners, deliveryTab]);

  // Aggregate counts for header
  const partnerCounts = useMemo(() => {
    let onDelivery = 0;
    let atStore = 0;
    let offDuty = 0;
    partners.forEach((p) => {
      if (p.statusType === 'on_delivery') onDelivery++;
      else if (p.online) atStore++;
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
    const targetPartner = rawPartners.find((p) => p.id === partnerId);
    if (targetPartner && (targetPartner.isOnDuty === false || targetPartner.isActive === false)) {
      toast.error(`${targetPartner.name} is currently OFF DUTY and cannot be assigned`);
      return;
    }
    try {
      await apiPatch(`/orders/${orderId}/assign`, { partnerId });
      toast.success(`Assigned Order to ${targetPartner?.name || 'Partner'}`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to assign order');
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
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full animate-fade-in">
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
                    <p className="text-sm font-black text-gray-900 leading-tight">{partner.activeOrdersCount}</p>
                    <p className="text-[10px] font-semibold text-gray-400 mt-0.5">Active</p>
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

      {/* ── Deliveries Section: Live Orders Tracking & Assignments ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">
              Live Deliveries & Tracking
            </h2>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Real-time sync, partner acceptance, GPS coordinates, delay alerts & customer ratings
            </p>
          </div>

          {/* Delivery Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'All Orders' },
              { id: 'ACTIVE', label: 'Active Delivery' },
              { id: 'DELAYED', label: 'Delayed' },
              { id: 'CONFIRMED', label: 'Delivered & Rated' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDeliveryTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  deliveryTab === tab.id
                    ? 'bg-[#0A7C47] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50/50">
                <th className="py-3 px-3 font-bold">Order Details</th>
                <th className="py-3 px-3 font-bold">Customer Details</th>
                <th className="py-3 px-3 font-bold">Assigned Partner</th>
                <th className="py-3 px-3 font-bold">Sync Location</th>
                <th className="py-3 px-3 font-bold">Timing & Delay</th>
                <th className="py-3 px-3 font-bold">Delivery & Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {deliveriesList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400 font-semibold">
                    No delivery orders matching the selected filter.
                  </td>
                </tr>
              ) : (
                deliveriesList.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* 1. Order Details */}
                    <td className="py-3.5 px-3 align-top min-w-[130px]">
                      <div className="font-mono font-bold text-gray-900 text-sm">{d.orderNo}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{d.placed}</div>
                      <div className="text-[11px] text-gray-600 mt-1 max-w-[150px] truncate" title={d.itemsSummary}>
                        {d.itemsCount} items · {d.itemsSummary}
                      </div>
                      <div className={`mt-1 font-bold text-xs ${d.isPaid ? 'text-[#0A7C47]' : 'text-amber-700'}`}>
                        {d.paymentMethod === 'COD' ? 'Cash on delivery' : d.isPaid ? 'Paid online' : 'Payment pending'} · ₹{d.total}
                      </div>
                    </td>

                    {/* 2. Customer Details */}
                    <td className="py-3.5 px-3 align-top max-w-[210px]">
                      <div className="font-bold text-gray-900">{d.customer}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-gray-500">{maskPhone(d.phone)}</span>
                        {d.phone && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCall(d.phone)}
                              className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                              title="Call customer"
                            >
                              <Phone size={10} />
                            </button>
                            <button
                              onClick={() => window.open(`https://wa.me/91${String(d.phone).replace(/\D/g, '')}`, '_blank')}
                              className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                              title="WhatsApp customer"
                            >
                              <MessageSquare size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                        {d.address}
                      </div>
                      {d.instructions ? (
                        <div className="mt-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 font-semibold">
                          📌 {typeof d.instructions === 'string' ? d.instructions : String(d.instructions)}
                        </div>
                      ) : null}
                    </td>

                    {/* 3. Assigned Partner */}
                    <td className="py-3.5 px-3 align-top min-w-[160px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-900 text-xs">
                            {d.partnerName}
                          </span>
                          {d.acceptanceStatus === 'ACCEPTED' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Accepted
                            </span>
                          )}
                          {d.acceptanceStatus === 'REJECTED' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                              Rejected
                            </span>
                          )}
                          {d.acceptanceStatus === 'PENDING' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                              Pending
                            </span>
                          )}
                        </div>

                        {d.partnerPhone && (
                          <div className="text-[10px] font-mono text-gray-400">
                            {maskPhone(d.partnerPhone)}
                          </div>
                        )}

                        {/* Assign / Re-assign Dropdown (Only On Duty Partners) */}
                        {!d.isDelivered && (
                          <select
                            value={d.acceptanceStatus === 'REJECTED' ? '' : (d.assignedPartnerId || '')}
                            onChange={(e) => handleAssign(d.id, e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg text-[11px] font-semibold focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs border ${
                              d.acceptanceStatus === 'REJECTED'
                                ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                                : 'bg-white border-gray-200 text-gray-700'
                            }`}
                          >
                            <option value="">
                              {d.acceptanceStatus === 'REJECTED'
                                ? '⚠️ Re-assign partner...'
                                : d.assignedPartnerId
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
                        )}
                      </div>
                    </td>

                    {/* 4. Sync Location */}
                    <td className="py-3.5 px-3 align-top min-w-[140px]">
                      {d.syncLocation && typeof d.syncLocation.lat === 'number' ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-gray-800">
                            <MapPin size={12} className="text-[#0A7C47]" />
                            <span>{d.syncLocation.lat.toFixed(4)}, {d.syncLocation.lng.toFixed(4)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {d.lastSyncedTime ? `Synced ${new Date(d.lastSyncedTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Live synced'}
                          </div>
                          <button
                            onClick={() => window.open(`https://www.google.com/maps?q=${d.syncLocation.lat},${d.syncLocation.lng}`, '_blank')}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                          >
                            <span>Open in Maps</span>
                            <ExternalLink size={10} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px] italic">Awaiting sync</span>
                      )}
                    </td>

                    {/* 5. Timing & Delay */}
                    <td className="py-3.5 px-3 align-top min-w-[130px]">
                      {d.delayReason ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            Delayed · {d.newEstimatedTime || 'New ETA'}
                          </span>
                          <div className="text-[11px] text-amber-800 font-medium leading-tight">
                            <span className="font-bold">Reason:</span> {d.delayReason}
                          </div>
                          <div className="text-[9px] text-amber-700 italic">
                            Customer & email notified
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                          On schedule
                        </span>
                      )}
                    </td>

                    {/* 6. Delivery & Confirmation */}
                    <td className="py-3.5 px-3 align-top min-w-[140px]">
                      {d.isDelivered || d.isConfirmed ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ Delivered & Confirmed
                          </span>
                          {d.rating ? (
                            <div className="flex items-center gap-1 text-xs font-black text-amber-700">
                              <Star size={12} className="fill-amber-400 text-amber-400" />
                              <span>{d.rating}/5 rating</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-700 font-semibold">
                              Receipt confirmed
                            </div>
                          )}
                        </div>
                      ) : d.isPendingConfirmation ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            Pending Customer Confirmation
                          </span>
                          <div className="text-[10px] text-gray-500 font-medium">
                            Awaiting "Order collected? Yes"
                          </div>
                        </div>
                      ) : d.isOutForDelivery ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                          Out for delivery
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                          {d.status || 'Processing'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Deliveries Card List (< md screens) */}
        <div className="block md:hidden space-y-3">
          {deliveriesList.length === 0 ? (
            <div className="py-10 text-center text-gray-400 font-semibold bg-gray-50/50 rounded-xl">
              No delivery orders matching the selected filter.
            </div>
          ) : (
            deliveriesList.map((d) => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs space-y-3"
              >
                {/* Header: Order No, Placed, Total & Status */}
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 text-sm">{d.orderNo}</span>
                      <span className="text-[11px] text-gray-400">· {d.placed}</span>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      {d.itemsCount} items · {d.itemsSummary}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-sm text-gray-900">₹{d.total}</div>
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      d.isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {d.paymentMethod === 'COD' ? 'COD' : d.isPaid ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{d.customer}</span>
                    {d.phone && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCall(d.phone)}
                          className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center gap-1"
                        >
                          <Phone size={10} /> Call
                        </button>
                        <button
                          onClick={() => window.open(`https://wa.me/91${String(d.phone).replace(/\D/g, '')}`, '_blank')}
                          className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1"
                        >
                          <MessageSquare size={10} /> WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{d.address}</p>
                  {d.instructions ? (
                    <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 font-semibold">
                      📌 {typeof d.instructions === 'string' ? d.instructions : String(d.instructions)}
                    </div>
                  ) : null}
                </div>

                {/* Partner assignment & status */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-700">Partner: {d.partnerName}</span>
                      {d.acceptanceStatus === 'ACCEPTED' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                          Accepted
                        </span>
                      )}
                      {d.acceptanceStatus === 'REJECTED' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800">
                          Rejected
                        </span>
                      )}
                      {d.acceptanceStatus === 'PENDING' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                    </div>
                    {/* Delivery Status Badge */}
                    {d.isDelivered || d.isConfirmed ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        ✓ Delivered
                      </span>
                    ) : d.isOutForDelivery ? (
                      <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                        Out for delivery
                      </span>
                    ) : null}
                  </div>

                  {!d.isDelivered && (
                    <select
                      value={d.acceptanceStatus === 'REJECTED' ? '' : (d.assignedPartnerId || '')}
                      onChange={(e) => handleAssign(d.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white focus:outline-none focus:border-emerald-600"
                    >
                      <option value="">
                        {d.acceptanceStatus === 'REJECTED'
                          ? '⚠️ Re-assign partner...'
                          : d.assignedPartnerId
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
                  )}

                  {d.syncLocation && typeof d.syncLocation.lat === 'number' && (
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-gray-500 flex items-center gap-1">
                        <MapPin size={11} className="text-[#0A7C47]" />
                        {d.syncLocation.lat.toFixed(4)}, {d.syncLocation.lng.toFixed(4)}
                      </span>
                      <button
                        onClick={() => window.open(`https://www.google.com/maps?q=${d.syncLocation.lat},${d.syncLocation.lng}`, '_blank')}
                        className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
                      >
                        Maps <ExternalLink size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
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
