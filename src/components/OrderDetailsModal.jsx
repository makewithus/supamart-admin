import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Printer, Phone, MessageSquare, Check,
  CheckCircle2, XCircle, AlertCircle, Clock, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPatch } from '../services/api';
import productImages from '../utils/productImages';
import { db } from '../config/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';

const STEPS = [
  { id: 'ORDER_PLACED', label: 'Placed' },
  { id: 'ORDER_ACCEPTED', label: 'Accepted' },
  { id: 'PACKING', label: 'Packed' },
  { id: 'OUT_FOR_DELIVERY', label: 'On the way' },
  { id: 'DELIVERED', label: 'Delivered' }
];

const DELAY_ETA_PRESETS = ['+15 mins', '+20 mins', '+30 mins', '+45 mins', '+60 mins'];
const DELAY_REASON_PRESETS = [
  'Heavy Traffic Congestion',
  'Adverse Weather / Rain',
  'Store Packing Rush',
  'Delivery Vehicle Breakdown',
];

export default function OrderDetailsModal({ order, partners: initialPartners = [], onClose, onSuccess }) {
  if (!order) return null;

  const [liveOrder, setLiveOrder] = useState(order);
  const activeOrderData = liveOrder || order;
  const [partners, setPartners] = useState(initialPartners);
  const [loading, setLoading] = useState(false);
  const [assigningPartner, setAssigningPartner] = useState(false);
  const [internalNote, setInternalNote] = useState(activeOrderData.adminNote || '');
  const [delayOpen, setDelayOpen] = useState(false);
  const [delayMins, setDelayMins] = useState('+20 mins');
  const [delayReasonText, setDelayReasonText] = useState(activeOrderData.delayReason || '');
  const [submittingDelay, setSubmittingDelay] = useState(false);
  const [itemsChecked, setItemsChecked] = useState(() => {
    const initial = {};
    (activeOrderData.items || []).forEach((it, idx) => {
      initial[it.id || it.productId || idx] = true;
    });
    return initial;
  });

  useEffect(() => {
    if (activeOrderData?.delayReason) {
      setDelayReasonText(activeOrderData.delayReason);
    }
    if (activeOrderData?.deliveryDelay?.newEstimatedTime) {
      setDelayMins(activeOrderData.deliveryDelay.newEstimatedTime);
    }
  }, [activeOrderData?.delayReason, activeOrderData?.deliveryDelay?.newEstimatedTime]);

  // Subscribe to live order updates in real-time
  useEffect(() => {
    if (!order.id || order.id.startsWith('#')) return;
    try {
      const unsub = onSnapshot(doc(db, 'orders', order.id), (docSnap) => {
        if (docSnap.exists()) {
          setLiveOrder({ id: docSnap.id, ...docSnap.data() });
        }
      });
      return () => unsub();
    } catch (_) {}
  }, [order.id]);

  // Subscribe to live delivery partners if not supplied
  useEffect(() => {
    if (initialPartners && initialPartners.length > 0) {
      setPartners(initialPartners);
      return;
    }
    try {
      const unsub = onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
        setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    } catch (_) {}
  }, [initialPartners]);

  const orderNo = activeOrderData.displayId || (activeOrderData.orderNo ? `#${activeOrderData.orderNo}` : `#${activeOrderData.id?.slice(-4) || ''}`);
  const customerName = (typeof activeOrderData.userName === 'string' ? activeOrderData.userName : null)
    || (typeof activeOrderData.customer === 'string' ? activeOrderData.customer : null)
    || activeOrderData.addressSnapshot?.name
    || activeOrderData.address?.name
    || 'Customer';
  const customerPhone = (typeof activeOrderData.userPhone === 'string' ? activeOrderData.userPhone : null)
    || activeOrderData.addressSnapshot?.phone
    || activeOrderData.address?.phone
    || '—';
  const address = (() => {
    const rawAddr = activeOrderData.address || activeOrderData.addressSnapshot;
    if (!rawAddr) return 'Address not provided';
    if (typeof rawAddr === 'string') return rawAddr;
    if (typeof rawAddr === 'object') {
      if (rawAddr.formattedAddress) return rawAddr.formattedAddress;
      const parts = [rawAddr.houseNo, rawAddr.street, rawAddr.landmark, rawAddr.city, rawAddr.pincode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
      return Object.values(rawAddr).filter((v) => typeof v === 'string' || typeof v === 'number').join(', ') || 'Address on file';
    }
    return String(rawAddr);
  })();
  const instructions = (typeof activeOrderData.deliveryInstructions === 'string' ? activeOrderData.deliveryInstructions : null)
    || (typeof activeOrderData.instructions === 'string' ? activeOrderData.instructions : null)
    || (typeof activeOrderData.notes === 'string' ? activeOrderData.notes : null)
    || '';
  const placedTime = activeOrderData.placed || (activeOrderData.createdAt ? new Date(activeOrderData.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
  const paymentMethod = typeof activeOrderData.paymentMethod === 'string' ? activeOrderData.paymentMethod : 'UPI';
  const utr = (typeof activeOrderData.paymentDetails?.utr === 'string' ? activeOrderData.paymentDetails.utr : null)
    || (typeof activeOrderData.utr === 'string' ? activeOrderData.utr : null)
    || (typeof activeOrderData.upiRef === 'string' ? activeOrderData.upiRef : null)
    || '—';
  const paymentStatus = activeOrderData.paymentStatus || 'AWAITING_CONFIRMATION';

  const displayItems = Array.isArray(activeOrderData.items) ? activeOrderData.items : [];

  const itemTotal = displayItems.reduce((acc, it) => acc + (Number(it.price || it.unitPrice || 0) * (Number(it.qty || it.quantity || 1))), 0);
  const deliveryFee = activeOrderData.deliveryFee || 0;
  const toCollect = activeOrderData.total || itemTotal + deliveryFee;

  // Determine current step index
  const currentStepIdx = (() => {
    if (activeOrderData.status === 'DELIVERED') return 4;
    if (activeOrderData.status === 'OUT_FOR_DELIVERY') return 3;
    if (activeOrderData.status === 'PACKING' || activeOrderData.status === 'READY_FOR_DELIVERY') return 2;
    if (activeOrderData.status === 'ORDER_ACCEPTED') return 1;
    return 0; // Placed
  })();

  const handleToggleItem = (id) => {
    setItemsChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAssignPartnerModal = async (partnerId) => {
    if (!partnerId) return;
    const target = partners.find((p) => p.id === partnerId);
    if (target && (target.isOnDuty === false || target.isActive === false)) {
      toast.error(`${target.name} is currently OFF DUTY and cannot be assigned`);
      return;
    }
    setAssigningPartner(true);
    try {
      await apiPatch(`/orders/${order.id}/assign`, { partnerId });
      toast.success(`Assigned order to ${target?.name || 'Partner'}`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to assign partner');
    } finally {
      setAssigningPartner(false);
    }
  };

  const handleAcceptOrder = async () => {
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/status`, { status: 'ORDER_ACCEPTED' });
      }
      toast.success(`Order ${orderNo} accepted successfully!`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || `Failed to accept order ${orderNo}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/status`, { status: 'CANCELLED' });
      }
      toast.success(`Order ${orderNo} cancelled`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || `Failed to cancel order ${orderNo}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUTR = async () => {
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/mark-paid`);
      }
      toast.success('Amount and UTR verified! Payment marked as PAID.');
      onSuccess?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectUTR = async () => {
    if (!window.confirm('Reject this payment proof?')) return;
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/reject-payment`, { reason: 'UTR mismatch or amount not credited' });
      }
      toast.success('Payment rejected');
      onSuccess?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to reject payment');
    } finally {
      setLoading(false);
    }
  };

  const isOrderTerminal = activeOrderData.status === 'DELIVERED' || activeOrderData.status === 'CANCELLED';

  const handleSaveDelay = async () => {
    const finalReason = delayReasonText.trim();
    if (!finalReason) {
      toast.error('Please specify the reason for the delivery delay.');
      return;
    }
    if (!delayMins.trim()) {
      toast.error('Please specify the updated delivery time.');
      return;
    }
    setSubmittingDelay(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/delivery-delay`, {
          newEstimatedTime: delayMins.trim(),
          delayReason: finalReason,
        });
      }
      toast.success('Delivery delay updated & notification email sent to customer!');
      setDelayOpen(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update delivery delay');
    } finally {
      setSubmittingDelay(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCall = () => {
    window.location.href = `tel:${customerPhone.replace(/[^0-9]/g, '')}`;
  };

  const handleWhatsApp = () => {
    const num = customerPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${num}?text=Hello%20${encodeURIComponent(customerName)}%2C%20regarding%20your%20order%20${orderNo}`, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-[500px] sm:max-w-[520px] bg-white h-full shadow-2xl flex flex-col z-[100] overflow-hidden animate-slide-in-right">
        {/* Drawer Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-gray-900 tracking-tight">
                {orderNo}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600">
                {order.status === 'ORDER_PLACED' || !order.status ? 'New' : order.status}
              </span>
            </div>
            <p className="text-xs font-semibold text-gray-400 mt-1">
              {placedTime} · Instant Delivery
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="Print Order Receipt"
              className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Printer size={16} strokeWidth={2} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Stepper Progress */}
          <div className="pt-1">
            <div className="grid grid-cols-5 text-center text-xs pb-2 border-b border-gray-100">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentStepIdx;
                const isPassed = idx < currentStepIdx;

                return (
                  <div key={step.id} className="relative flex flex-col items-center">
                    <span
                      className={`text-[11px] font-bold transition-colors ${
                        isActive
                          ? 'text-[#0A7C47]'
                          : isPassed
                          ? 'text-gray-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isActive && (
                      <div className="w-full h-0.5 bg-[#0A7C47] rounded-full mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Delay Management Section */}
          <div className="space-y-2">
            {(activeOrderData.delayReason || activeOrderData.deliveryDelay) && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 shadow-2xs">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-amber-950">
                      ⚠️ Delivery Delayed by {activeOrderData.deliveryDelay?.reportedBy || (activeOrderData.delayReportedByAdmin ? 'Store Admin' : 'Delivery Partner')}
                    </p>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md shrink-0">
                      New ETA: {activeOrderData.deliveryDelay?.newEstimatedTime || 'Delayed'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1 font-medium">
                    <span className="font-bold">Reason:</span> {activeOrderData.delayReason || activeOrderData.deliveryDelay?.delayReason || activeOrderData.deliveryDelay?.reason || 'Traffic/Weather delay'}
                  </p>
                  {!isOrderTerminal && (
                    <button
                      type="button"
                      onClick={() => setDelayOpen((v) => !v)}
                      className="mt-2 text-[11px] font-bold text-amber-900 hover:text-amber-950 underline cursor-pointer flex items-center gap-1"
                    >
                      <Clock size={12} />
                      <span>{delayOpen ? 'Close Delay Editor' : 'Update Delay / Notify Customer'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {!activeOrderData.delayReason && !activeOrderData.deliveryDelay && !isOrderTerminal && !delayOpen && (
              <button
                type="button"
                onClick={() => setDelayOpen(true)}
                className="w-full py-2 px-3 border border-amber-300 bg-amber-50/60 hover:bg-amber-100/60 text-amber-900 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clock size={14} className="text-amber-600" />
                <span>Report Delivery Delay & Email Customer</span>
              </button>
            )}

            {/* Delay Update Drawer / Form */}
            {delayOpen && !isOrderTerminal && (
              <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-xl space-y-3 animate-fade-in shadow-2xs">
                <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                    <Clock size={14} className="text-amber-700" />
                    <span>Update Delivery Estimate & Notify</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDelayOpen(false)}
                    className="text-amber-700 hover:text-amber-950 text-xs font-bold p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Delay Duration Presets */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                    Estimated Delay / New Time:
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {DELAY_ETA_PRESETS.map((eta) => (
                      <button
                        key={eta}
                        type="button"
                        onClick={() => setDelayMins(eta)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          delayMins === eta
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/50'
                        }`}
                      >
                        {eta}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={delayMins}
                    onChange={(e) => setDelayMins(e.target.value)}
                    placeholder="e.g. +20 mins or Arriving by 5:30 PM"
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                {/* Reason Presets */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                    Reason for Delay:
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {DELAY_REASON_PRESETS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setDelayReasonText(reason)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          delayReasonText === reason
                            ? 'bg-amber-700 text-white font-bold shadow-xs'
                            : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/50'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={delayReasonText}
                    onChange={(e) => setDelayReasonText(e.target.value)}
                    placeholder="Enter or customize the reason for the customer..."
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs text-gray-900 placeholder-amber-900/40 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 font-medium"
                  />
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveDelay}
                    disabled={submittingDelay}
                    className="flex-1 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send size={13} />
                    <span>{submittingDelay ? 'Sending Email & Updating...' : 'Update & Email Customer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelayOpen(false)}
                    disabled={submittingDelay}
                    className="px-3 py-2 border border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Customer Confirmation & Rating Status Banner */}
          {(activeOrderData.confirmedAt || activeOrderData.status === 'DELIVERED') && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
              <div>
                <p className="text-xs font-black text-emerald-950">
                  ✓ Order Collected & Confirmed by Customer
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Verified receipt via mobile app
                </p>
              </div>
              {(activeOrderData.orderRating || activeOrderData.rating) && (
                <span className="px-2.5 py-1 bg-[#0A7C47] text-white rounded-lg text-xs font-black shadow-2xs">
                  ★ {activeOrderData.orderRating || activeOrderData.rating}/5
                </span>
              )}
            </div>
          )}

          {/* Action Buttons: Accept / Cancel */}
          {activeOrderData.status !== 'DELIVERED' && activeOrderData.status !== 'CANCELLED' && (
            <div className="flex items-center gap-2.5">
              {(activeOrderData.status === 'ORDER_PLACED' || activeOrderData.status === 'PLACED' || !activeOrderData.status) ? (
                <button
                  onClick={handleAcceptOrder}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check size={16} strokeWidth={2.4} />
                  <span>Accept order</span>
                </button>
              ) : (
                <div className="flex-1 py-2.5 px-3 bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={2.4} />
                  <span>Order Accepted</span>
                </div>
              )}

              <button
                onClick={handleCancelOrder}
                disabled={loading}
                className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel order
              </button>
            </div>
          )}

          {/* CUSTOMER Section */}
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              CUSTOMER
            </p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold text-gray-900 leading-tight">
                  {customerName}
                </p>
                <p className="text-xs font-semibold text-gray-400 font-mono mt-0.5">
                  {customerPhone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCall}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                >
                  <Phone size={13} className="text-gray-400" />
                  <span>Call</span>
                </button>

                <button
                  onClick={handleWhatsApp}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                >
                  <MessageSquare size={13} className="text-gray-400" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            <p className="text-xs font-medium text-gray-600 leading-relaxed">
              {address}
            </p>

            {/* Delivery instructions callout box */}
            {instructions && (
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 font-medium leading-relaxed">
                <span className="font-bold text-amber-950">Delivery instructions: </span>
                {instructions}
              </div>
            )}
          </div>

          {/* ITEMS Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                ITEMS
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                Untick an item if it is out of stock
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {displayItems.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No items listed for this order.</p>
              ) : (
                displayItems.map((it, idx) => {
                  const id = it.id || it.productId || idx;
                  const isChecked = itemsChecked[id] !== false;
                  const imgSrc = productImages[it.name] || productImages[it.imageKey] || it.image || '/product-images/full_cream_milk.jpg';
                  const price = Number(it.price || it.unitPrice || 0);
                  const qty = Number(it.qty || it.quantity || 1);

                  return (
                    <div key={id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#0A7C47]"
                        />
                        <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                          <img
                            src={imgSrc}
                            alt={it.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className={`text-xs font-bold text-gray-900 ${!isChecked ? 'line-through text-gray-400' : ''}`}>
                            {it.name}
                          </p>
                          <p className="text-[11px] font-semibold text-gray-400">
                            {it.variant || it.pack || (qty > 1 ? `Qty: ${qty}` : '1 unit')}
                          </p>
                        </div>
                      </div>

                      <span className={`text-xs font-extrabold text-gray-900 shrink-0 ${!isChecked ? 'line-through text-gray-400' : ''}`}>
                        ₹{price * qty}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Price Breakdown */}
            <div className="pt-2 border-t border-gray-100 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600 font-semibold">
                <span>Item total</span>
                <span className="text-gray-900 font-bold">₹{itemTotal}</span>
              </div>
              <div className="flex justify-between text-gray-600 font-semibold">
                <span>Delivery fee</span>
                <span className="font-extrabold text-[#0A7C47]">{deliveryFee > 0 ? `₹${deliveryFee}` : 'FREE'}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-gray-900 pt-1 border-t border-gray-100">
                <span>Order Total (Paid Online)</span>
                <span>₹{toCollect}</span>
              </div>
            </div>
          </div>

          {/* PAYMENT Section */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              PAYMENT
            </p>

            <div className="p-3.5 bg-white border border-gray-200/80 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-gray-900">
                  {paymentMethod}
                </p>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                  UTR {utr}
                </p>
              </div>

              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                Verify UTR
              </span>
            </div>

            {/* Payment verification action buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleVerifyUTR}
                disabled={loading}
                className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
              >
                Amount and UTR match · Verify
              </button>

              <button
                onClick={handleRejectUTR}
                disabled={loading}
                className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors"
              >
                Reject
              </button>
            </div>

            {/* Partner Assignment in Payment Verification Section */}
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">
                  Assign Delivery Partner (On Duty only):
                </span>
                {activeOrderData.deliveryAcceptanceStatus === 'ACCEPTED' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Accepted
                  </span>
                )}
                {activeOrderData.deliveryAcceptanceStatus === 'REJECTED' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                    Rejected
                  </span>
                )}
                {activeOrderData.deliveryAcceptanceStatus === 'PENDING' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    Pending Acceptance
                  </span>
                )}
              </div>

              <select
                disabled={assigningPartner || activeOrderData.status === 'DELIVERED'}
                value={activeOrderData.assignedPartnerId || ''}
                onChange={(e) => handleAssignPartnerModal(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-600 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="">{activeOrderData.assignedPartnerId ? 'Re-assign partner...' : 'Select on-duty partner...'}</option>
                {partners.map((p) => {
                  const isOffDuty = p.isOnDuty === false || p.isActive === false;
                  return (
                    <option key={p.id} value={p.id} disabled={isOffDuty}>
                      {p.name} · {p.mobile || p.phone || ''} {isOffDuty ? '(OFF DUTY)' : '(ON DUTY)'}
                    </option>
                  );
                })}
              </select>

              {activeOrderData.deliveryBoyName && (
                <p className="text-[11px] text-gray-500 font-medium">
                  Assigned to <span className="font-bold text-gray-800">{activeOrderData.deliveryBoyName}</span> ({activeOrderData.deliveryBoyPhone || 'Phone unavailable'})
                </p>
              )}
            </div>
          </div>

          {/* INTERNAL NOTE Section */}
          <div className="space-y-1.5 pb-4">
            <label className="text-xs font-bold text-gray-700">
              Internal note (not shown to customer)
            </label>
            <textarea
              rows={2}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Customer asked to call before arriving"
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all font-medium"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
