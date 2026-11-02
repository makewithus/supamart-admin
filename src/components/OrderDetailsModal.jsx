import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Printer, Phone, MessageSquare, Check,
  CheckCircle2, XCircle, AlertCircle, Clock, Send,
  Truck, Star, Calendar, RefreshCw, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPatch, apiPost } from '../services/api';
import productImages from '../utils/productImages';
import { db } from '../config/firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { formatDeliveryInstructions } from '../utils/orderUtils';

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
  const [savingNote, setSavingNote] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const handleSendRedeliveryReminder = async () => {
    if (!order.id) return;
    setSendingReminder(true);
    try {
      await apiPost(`/orders/${order.id}/redelivery/reminder`);
      toast.success('Reminder notification sent to customer!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };
  const [noteSaved, setNoteSaved] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPreset, setCancelPreset] = useState('Customer requested cancellation');
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showRedeliveryModal, setShowRedeliveryModal] = useState(false);
  const [redeliveryPreset, setRedeliveryPreset] = useState('Items damaged in transit');
  const [redeliveryCustomReason, setRedeliveryCustomReason] = useState('');
  const [initiatingRedelivery, setInitiatingRedelivery] = useState(false);
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
    if (activeOrderData?.deliveryDelay?.reportedDelayMinutes) {
      setDelayMins(`+${activeOrderData.deliveryDelay.reportedDelayMinutes} mins`);
    } else if (activeOrderData?.deliveryDelay?.newEstimatedTime) {
      setDelayMins(activeOrderData.deliveryDelay.newEstimatedTime);
    }
  }, [activeOrderData?.delayReason, activeOrderData?.deliveryDelay?.newEstimatedTime, activeOrderData?.deliveryDelay?.reportedDelayMinutes]);

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
  const instructions = formatDeliveryInstructions(activeOrderData.deliveryInstructions || activeOrderData.instructions || activeOrderData.notes);
  const placedTime = activeOrderData.placed || (activeOrderData.createdAt ? new Date(activeOrderData.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
  const canReviewPayment = !['PAID', 'FAILED'].includes(String(activeOrderData.paymentStatus || '').toUpperCase());

  const displayItems = Array.isArray(activeOrderData.items) ? activeOrderData.items : [];

  const itemTotal = displayItems.reduce((acc, it) => acc + (Number(it.price || it.unitPrice || 0) * (Number(it.qty || it.quantity || 1))), 0);
  const deliveryFee = activeOrderData.deliveryFee || 0;
  const toCollect = activeOrderData.total || itemTotal + deliveryFee;

  // Determine current step index
  const currentStepIdx = (() => {
    if (activeOrderData.status === 'DELIVERED') return 4;
    if (activeOrderData.status === 'PENDING_CONFIRMATION') return 3;
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
    const rawStatus = (activeOrderData.status || order.status || '').toUpperCase();
    if (rawStatus === 'ORDER_PLACED' || rawStatus === 'NEW' || rawStatus === 'PLACED' || !rawStatus) {
      toast.error('Please accept and confirm the order before assigning a delivery partner.');
      return;
    }
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
    if (activeOrderData.paymentMethod !== 'COD' && activeOrderData.paymentStatus !== 'PAID') {
      toast.error('Payment must be verified and approved first before approving this order. Please verify payment first.');
      return;
    }
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

  const handleUpdateStatus = async (newStatus, successMsg) => {
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/status`, { status: newStatus });
      }
      toast.success(successMsg || `Order status updated to ${newStatus}`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || `Failed to update status`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    const finalReason = cancelPreset === 'Other reason'
      ? (cancelCustomReason.trim() || 'Other reason')
      : (cancelCustomReason.trim() ? `${cancelPreset} — ${cancelCustomReason.trim()}` : cancelPreset);

    setCancelling(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/status`, {
          status: 'CANCELLED',
          reason: finalReason,
        });
      }
      toast.success(`Order ${orderNo} cancelled with reason`);
      setShowCancelModal(false);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || `Failed to cancel order ${orderNo}`);
    } finally {
      setCancelling(false);
    }
  };

  const handleInitiateRedelivery = async () => {
    if (!order.id || order.id.startsWith('#')) return;
    const finalReason = redeliveryPreset === 'Other reason'
      ? (redeliveryCustomReason.trim() || 'Admin initiated replacement')
      : (redeliveryCustomReason.trim() ? `${redeliveryPreset} — ${redeliveryCustomReason.trim()}` : redeliveryPreset);

    setInitiatingRedelivery(true);
    try {
      const res = await apiPost(`/orders/${order.id}/redelivery`, {
        reason: finalReason,
        adminNotes: `Admin initiated replacement for Order #${orderNo}: ${finalReason}`,
      });
      toast.success(`Free replacement Order #${res.data?.orderNo || ''} created! Customer notified.`);
      setShowRedeliveryModal(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate redelivery');
    } finally {
      setInitiatingRedelivery(false);
    }
  };

  const handleSaveNote = async () => {
    if (!order.id || order.id.startsWith('#')) return;
    setSavingNote(true);
    try {
      await apiPatch(`/orders/${order.id}/note`, { adminNote: internalNote });
      setNoteSaved(true);
      toast.success('Internal note saved');
      setTimeout(() => setNoteSaved(false), 2500);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleVerifyPayment = async () => {
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/mark-paid`);
      }
      toast.success('Payment verified and order approved!');
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!window.confirm('Reject this payment?')) return;
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/orders/${order.id}/reject-payment`, { reason: 'Payment not received' });
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
        const result = await apiPatch(`/orders/${order.id}/delivery-delay`, {
          newEstimatedTime: delayMins.trim(),
          delayReason: finalReason,
        });
        if (result.emailStatus === 'PENDING' || result.emailQueued) {
          toast.success('Delay saved. The customer email is queued for immediate delivery.');
        } else if (result.emailSent === false) {
          toast.error(`Delay saved, but the customer email was not sent. ${result.emailError || 'Check the backend email settings.'}`);
        } else {
          toast.success('Delivery delay updated and customer email sent.');
        }
      } else {
        toast.error('The customer email cannot be sent for a local or incomplete order.');
      }
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
    <>
      <div className="fixed inset-0 z-[100] overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-[500px] sm:max-w-[520px] bg-white h-full shadow-2xl flex flex-col z-[100] overflow-hidden animate-slide-in-right">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                {orderNo}
              </span>
              {activeOrderData.isRedelivery ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Free Replacement
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-600">
                  {order.status === 'ORDER_PLACED' || !order.status ? 'New' : order.status}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-400 mt-0.5 sm:mt-1">
              {placedTime} · Instant Delivery
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handlePrint}
              title="Print Order Receipt"
              className="p-1.5 sm:p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Printer size={16} strokeWidth={2} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 sm:p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 pb-24 sm:pb-32 space-y-4 sm:space-y-6">
          {/* Cancelled Alert Banner (if cancelled) */}
          {activeOrderData.status === 'CANCELLED' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 shadow-2xs">
              <div className="flex items-center gap-1.5 text-rose-800 text-xs font-extrabold">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>Order Cancelled</span>
                {activeOrderData.cancelledBy && (
                  <span className="text-[10px] font-semibold text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded">
                    by {activeOrderData.cancelledBy}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-900 font-medium pl-5">
                <span className="font-bold">Reason: </span>
                {activeOrderData.cancelReason || activeOrderData.cancellationReason || 'No reason specified'}
              </p>
            </div>
          )}

          {/* Linked Free Replacement Banner (if this original order has an arranged replacement) */}
          {!activeOrderData.isRedelivery && (activeOrderData.hasRedelivery || activeOrderData.replacementOrderNo) && (
            <div className="p-3 bg-purple-50/90 border border-purple-200/90 rounded-xl flex items-center justify-between text-xs text-purple-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-purple-600 shrink-0" />
                <div>
                  <span className="font-extrabold">Free Replacement Arranged: </span>
                  <span className="font-bold underline">Order #{activeOrderData.replacementOrderNo || 'Replacement'}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-900 rounded text-[10px] font-black uppercase tracking-wider">
                Replacement Active
              </span>
            </div>
          )}

          {/* Free Replacement / Redelivery Status Banner */}
          {activeOrderData.isRedelivery && (
            <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-emerald-50 border border-purple-200/80 rounded-2xl shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-700 text-white shadow-xs">
                    Free Replacement
                  </span>
                  <span className="text-xs font-bold text-gray-800">
                    Linked to Order #{activeOrderData.originalOrderNo || 'Original'}
                  </span>
                </div>
                {activeOrderData.issueId && (
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-white/80 px-2 py-0.5 rounded-md border border-purple-200">
                    Issue #{String(activeOrderData.issueId).slice(-6)}
                  </span>
                )}
              </div>

              {/* Customer Availability State Banner */}
              {activeOrderData.redeliveryStatus === 'AWAITING_CUSTOMER_CONFIRMATION' && (
                <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-snug">
                      <span className="font-extrabold">Awaiting Customer Confirmation:</span> Customer received a notification and popup in app to confirm availability. <span className="font-bold underline">Do not dispatch automatically.</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-[11px]">
                    <span className="text-amber-800 font-medium">
                      {activeOrderData.customerAvailability?.remindedAt ? `Reminder sent ${new Date(activeOrderData.customerAvailability.remindedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No response yet'}
                    </span>
                    <button
                      type="button"
                      onClick={handleSendRedeliveryReminder}
                      disabled={sendingReminder}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      {sendingReminder ? 'Sending...' : 'Send Reminder'}
                    </button>
                  </div>
                </div>
              )}

              {activeOrderData.redeliveryStatus === 'CONFIRMED' && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-extrabold">Customer Available:</span> Confirmed by customer. Ready for partner assignment and dispatch!
                  </div>
                </div>
              )}

              {activeOrderData.redeliveryStatus === 'RESCHEDULED' && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-900">
                  <Calendar size={16} className="text-blue-600 shrink-0" />
                  <div>
                    <span className="font-extrabold">Customer Rescheduled:</span> Requested slot:{' '}
                    <span className="font-black underline">{activeOrderData.rescheduledSlot || activeOrderData.customerAvailability?.rescheduledSlot || 'Scheduled for later'}</span>. Request remains active.
                  </div>
                </div>
              )}

              {activeOrderData.redeliveryStatus === 'DECLINED' && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-900">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold">Redelivery Declined by Customer:</span> Reason:{' '}
                    <span className="font-semibold">{activeOrderData.customerAvailability?.declinedReason || activeOrderData.cancelReason || 'Declined'}</span>.
                    <p className="mt-0.5 text-[11px] text-rose-700">Follow up with customer for refund or store resolution.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stepper Progress */}
          <div className="pt-1">
            <div className="grid grid-cols-5 text-center text-xs pb-2 border-b border-gray-100">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentStepIdx;
                const isPassed = idx < currentStepIdx;

                return (
                  <div key={step.id} className="relative flex flex-col items-center">
                    <span
                      className={`text-[9px] sm:text-[11px] font-bold transition-colors leading-tight ${
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
                      Delivery Delayed by {activeOrderData.deliveryDelay?.reportedBy || (activeOrderData.delayReportedByAdmin ? 'Store Admin' : 'Delivery Partner')}
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
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-emerald-950">
                    Order Collected & Confirmed by Customer
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    Verified receipt via mobile app
                  </p>
                </div>
              </div>
              {(activeOrderData.orderRating || activeOrderData.rating) && (
                <span className="px-2.5 py-1 bg-[#0A7C47] text-white rounded-lg text-xs font-black shadow-2xs flex items-center gap-1">
                  <Star size={12} className="fill-white text-white" />
                  <span>{activeOrderData.orderRating || activeOrderData.rating}/5</span>
                </span>
              )}
            </div>
          )}

          {/* Action Buttons: Accept / Dispatch / Deliver / Cancel */}
          {activeOrderData.status !== 'DELIVERED' && activeOrderData.status !== 'CANCELLED' && (
            <div className="flex flex-wrap items-center gap-2.5">
              {activeOrderData.isRedelivery && activeOrderData.redeliveryStatus === 'AWAITING_CUSTOMER_CONFIRMATION' ? (
                <div className="flex-1 flex flex-col gap-2">
                  <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="font-semibold">
                      ⏳ Awaiting customer response. Do not dispatch automatically.
                    </div>
                    <button
                      type="button"
                      onClick={handleSendRedeliveryReminder}
                      disabled={sendingReminder}
                      className="py-1 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Send size={13} />
                      <span>{sendingReminder ? 'Sending...' : 'Send Reminder'}</span>
                    </button>
                  </div>
                  <div className="py-2.5 bg-gray-100 text-gray-400 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-not-allowed">
                    <Clock size={16} />
                    <span>Dispatch Disabled (Awaiting Customer Availability)</span>
                  </div>
                </div>
              ) : activeOrderData.isRedelivery && activeOrderData.redeliveryStatus === 'DECLINED' ? (
                <div className="flex-1 py-2.5 px-3 bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                  <AlertCircle size={16} className="text-rose-600" />
                  <span>Redelivery Declined by Customer</span>
                </div>
              ) : (activeOrderData.status === 'ORDER_PLACED' || activeOrderData.status === 'PLACED' || !activeOrderData.status) ? (
                activeOrderData.paymentMethod !== 'COD' && activeOrderData.paymentMethod !== 'FREE_REPLACEMENT' && activeOrderData.paymentStatus !== 'PAID' ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-2xs">
                      <div className="font-semibold">
                        ⚠️ Payment must be verified before approving this order.
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyPayment}
                        disabled={loading}
                        className="py-1.5 px-3 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Check size={14} strokeWidth={2.4} />
                        <span>Verify & Approve Payment</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAcceptOrder}
                      disabled={loading}
                      className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Please verify payment first before approving this order"
                    >
                      <Check size={16} strokeWidth={2.4} />
                      <span>Accept order (Verify payment first)</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAcceptOrder}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check size={16} strokeWidth={2.4} />
                    <span>Accept order</span>
                  </button>
                )
              ) : activeOrderData.status === 'ORDER_ACCEPTED' || activeOrderData.status === 'PACKING' ? (
                <>
                  <div className="py-2.5 px-3 bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={2.4} />
                    <span>Accepted</span>
                  </div>
                  <button
                    onClick={() => {
                      if (activeOrderData.isRedelivery && activeOrderData.redeliveryStatus === 'AWAITING_CUSTOMER_CONFIRMATION') {
                        toast.error('Customer has not confirmed availability yet. Please wait for confirmation or send a reminder before dispatching.');
                        return;
                      }
                      if (activeOrderData.isRedelivery && activeOrderData.redeliveryStatus === 'DECLINED') {
                        toast.error('Customer declined this redelivery. Order cannot be dispatched.');
                        return;
                      }
                      if (activeOrderData.paymentMethod !== 'COD' && activeOrderData.paymentMethod !== 'FREE_REPLACEMENT' && activeOrderData.paymentStatus !== 'PAID') {
                        toast.error('Payment must be verified and approved first before dispatching!');
                        return;
                      }
                      const hasPartner = Boolean(
                        activeOrderData.assignedPartnerId ||
                        activeOrderData.deliveryBoyId ||
                        activeOrderData.deliveryPartner?.id ||
                        activeOrderData.deliveryBoyName ||
                        activeOrderData.deliveryPartner?.name
                      );
                      if (!hasPartner) {
                        toast.error('Please assign a delivery partner before marking Out for Delivery!');
                        return;
                      }
                      handleUpdateStatus('OUT_FOR_DELIVERY', `Order ${orderNo} dispatched - Out for Delivery!`);
                    }}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Truck size={16} strokeWidth={2.4} />
                    <span>Out for delivery</span>
                  </button>
                </>
              ) : activeOrderData.status === 'OUT_FOR_DELIVERY' ? (
                <>
                  <div className="py-2.5 px-3 bg-cyan-50 border border-cyan-200/80 text-cyan-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <Truck size={16} className="text-cyan-600" strokeWidth={2.4} />
                    <span>On the way</span>
                  </div>
                  <button
                    onClick={() => handleUpdateStatus('PENDING_CONFIRMATION', `Order ${orderNo} marked as Delivered! Awaiting customer confirmation.`)}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} strokeWidth={2.4} />
                    <span>Mark Delivered</span>
                  </button>
                </>
              ) : activeOrderData.status === 'PENDING_CONFIRMATION' ? (
                <>
                  <div className="py-2.5 px-3 bg-amber-50 border border-amber-200/80 text-amber-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                    <Clock size={16} className="text-amber-600" strokeWidth={2.4} />
                    <span>Awaiting customer confirmation</span>
                  </div>
                  <button
                    onClick={() => handleUpdateStatus('DELIVERED', `Order ${orderNo} closed and confirmed by Admin!`)}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    title="Force complete / close order if customer cannot confirm via app"
                  >
                    <Check size={16} strokeWidth={2.4} />
                    <span>Confirm & Close Order</span>
                  </button>
                </>
              ) : null}

              <button
                onClick={handleCancelOrder}
                disabled={loading}
                className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel order
              </button>

              {!activeOrderData.isRedelivery && (
                <button
                  type="button"
                  onClick={() => setShowRedeliveryModal(true)}
                  disabled={loading}
                  className="px-3.5 py-2.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Initiate Free Replacement Redelivery"
                >
                  <RotateCcw size={14} />
                  <span>Free Redelivery</span>
                </button>
              )}
            </div>
          )}

          {/* Initiate Redelivery Option for Completed or Cancelled Orders */}
          {!activeOrderData.isRedelivery && (activeOrderData.status === 'DELIVERED' || activeOrderData.status === 'CANCELLED') && (
            <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50/30 border border-purple-200/80 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                  <RotateCcw size={14} className="text-purple-700 shrink-0" />
                  <span>Initiate Free Replacement Redelivery</span>
                </p>
                <p className="text-[11px] text-purple-800">
                  Creates a free replacement (₹0) linked to #{orderNo}. Customer won't be charged.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRedeliveryModal(true)}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
              >
                <span>Initiate</span>
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

                      <div className="text-right shrink-0">
                        {activeOrderData.isRedelivery ? (
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Free Replacement
                            </span>
                            <p className="text-[11px] text-gray-400 font-medium line-through mt-0.5">
                              ₹{(price || Number(it.originalPrice || 0)) * qty}
                            </p>
                          </div>
                        ) : (
                          <span className={`text-xs font-extrabold text-gray-900 ${!isChecked ? 'line-through text-gray-400' : ''}`}>
                            ₹{price * qty}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Price Breakdown */}
            {activeOrderData.isRedelivery ? (
              <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 font-semibold">
                  <span>Replacement items value</span>
                  <span className="text-gray-900 font-bold">₹{itemTotal || activeOrderData.itemsTotalValue || 0}</span>
                </div>
                <div className="flex justify-between text-gray-600 font-semibold">
                  <span>Store coverage</span>
                  <span className="font-extrabold text-[#0A7C47]">-₹{itemTotal || activeOrderData.itemsTotalValue || 0} (100% Free)</span>
                </div>
                <div className="flex justify-between text-gray-600 font-semibold">
                  <span>Delivery fee</span>
                  <span className="font-extrabold text-[#0A7C47]">FREE</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-gray-900 pt-1.5 border-t border-gray-100">
                  <div className="flex flex-col">
                    <span>Customer To Pay</span>
                    <span className="text-[10px] text-emerald-700 font-bold">
                      Free Replacement · Linked to Order #{activeOrderData.originalOrderNo || 'Original'}
                    </span>
                  </div>
                  <span className="text-emerald-700 text-base font-black">₹0</span>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Only show review actions while payment still needs a decision. */}
          {canReviewPayment && <div className="space-y-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
              PAYMENT
            </p>

            {/* Payment verification action buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleVerifyPayment}
                disabled={loading}
                className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
              >
                Verify
              </button>

              <button
                onClick={handleRejectPayment}
                disabled={loading}
                className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors"
              >
                Reject
              </button>
            </div>
          </div>}

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
                    Assignment Rejected
                  </span>
                )}
                {activeOrderData.deliveryAcceptanceStatus === 'PENDING' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    Pending Acceptance
                  </span>
                )}
              </div>

              {(() => {
                const s = (activeOrderData.status || order.status || '').toUpperCase();
                const isOrderNew = s === 'ORDER_PLACED' || s === 'NEW' || s === 'PLACED' || !s;
                const isPaymentPending = activeOrderData.paymentMethod !== 'COD' && activeOrderData.paymentMethod !== 'FREE_REPLACEMENT' && activeOrderData.paymentStatus !== 'PAID';
                const isAwaitingRedeliveryConfirm = activeOrderData.isRedelivery && activeOrderData.redeliveryStatus === 'AWAITING_CUSTOMER_CONFIRMATION';
                const isRedeliveryDeclined = activeOrderData.isRedelivery && activeOrderData.redeliveryStatus === 'DECLINED';

                return (
                  <select
                    disabled={assigningPartner || isOrderNew || isPaymentPending || isAwaitingRedeliveryConfirm || isRedeliveryDeclined || activeOrderData.status === 'DELIVERED'}
                    title={
                      isRedeliveryDeclined
                        ? 'Customer declined redelivery'
                        : isAwaitingRedeliveryConfirm
                        ? 'Customer has not confirmed availability yet'
                        : isPaymentPending
                        ? 'Verify payment first before assigning partner'
                        : isOrderNew
                        ? 'Accept / approve order first before assigning partner'
                        : ''
                    }
                    value={activeOrderData.deliveryAcceptanceStatus === 'REJECTED' ? '' : (activeOrderData.assignedPartnerId || '')}
                    onChange={(e) => handleAssignPartnerModal(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs border ${
                      isOrderNew || isPaymentPending || isAwaitingRedeliveryConfirm || isRedeliveryDeclined
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-75'
                        : activeOrderData.deliveryAcceptanceStatus === 'REJECTED'
                        ? 'border-rose-300 bg-rose-50 text-rose-900 font-bold cursor-pointer'
                        : 'border-gray-200 bg-gray-50 text-gray-800 cursor-pointer'
                    }`}
                  >
                    <option value="">
                      {isRedeliveryDeclined
                        ? 'Redelivery Declined by Customer'
                        : isAwaitingRedeliveryConfirm
                        ? 'Awaiting customer confirmation to assign partner...'
                        : isPaymentPending
                        ? 'Verify payment first to assign partner...'
                        : isOrderNew
                        ? 'Approve order first to assign partner...'
                        : activeOrderData.deliveryAcceptanceStatus === 'REJECTED'
                        ? 'Rejected — Re-assign new partner...'
                        : activeOrderData.assignedPartnerId
                        ? 'Re-assign partner...'
                        : 'Select on-duty partner...'}
                    </option>
                    {partners.map((p) => {
                      const isOffDuty = p.isOnDuty === false || p.isActive === false;
                      return (
                        <option key={p.id} value={p.id} disabled={isOffDuty}>
                          {p.name} · {p.mobile || p.phone || ''} {isOffDuty ? '(OFF DUTY)' : '(ON DUTY)'}
                        </option>
                      );
                    })}
                  </select>
                );
              })()}

              {activeOrderData.deliveryAcceptanceStatus === 'REJECTED' ? (
                <p className="text-[11px] text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-rose-600 shrink-0 inline" />
                  <span>Previous assignment was rejected by {activeOrderData.rejectedByPartnerName || activeOrderData.deliveryBoyName || 'partner'}. Select an on-duty partner to re-assign.</span>
                </p>
              ) : activeOrderData.deliveryBoyName ? (
                <p className="text-[11px] text-gray-500 font-medium">
                  Assigned to <span className="font-bold text-gray-800">{activeOrderData.deliveryBoyName}</span> ({activeOrderData.deliveryBoyPhone || 'Phone unavailable'})
                </p>
              ) : null}
            </div>
          </div>

          {/* INTERNAL NOTE Section */}
          <div className="bg-gray-50 border border-gray-200/90 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-gray-800 block">
                  Internal note (not shown to customer)
                </label>
                <p className="text-[11px] text-gray-500 font-medium">
                  Visible to store operators and staff only
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black active:bg-gray-950 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {noteSaved ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span>Saved</span>
                  </>
                ) : savingNote ? (
                  <span>Saving...</span>
                ) : (
                  <span>Save note</span>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. Customer asked to call before arriving, or ring bell twice"
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all font-medium resize-y"
            />
          </div>
        </div>
      </div>

      {/* Cancellation Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 animate-scale-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 leading-tight">Cancel Order {orderNo}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Customer will receive this cancellation reason</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">Select cancellation reason:</label>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {[
                  'Customer requested cancellation',
                  'Item(s) out of stock',
                  'Delivery address unreachable / outside area',
                  'Store closed or high operational rush',
                  'Payment verification issue',
                  'Other reason',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelPreset(reason)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border ${
                      cancelPreset === reason
                        ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 font-medium'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Additional note / custom reason:
              </label>
              <textarea
                rows={2}
                value={cancelCustomReason}
                onChange={(e) => setCancelCustomReason(e.target.value)}
                placeholder={cancelPreset === 'Other reason' ? 'Please specify reason for customer...' : 'Add extra context for the customer (optional)...'}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm & Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Initiate Redelivery Confirmation Modal */}
      {showRedeliveryModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 animate-scale-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                    Free Replacement Redelivery
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Order #{orderNo} · Customer will NOT be charged
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRedeliveryModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-purple-50/80 border border-purple-200/80 rounded-xl text-xs text-purple-900 space-y-1">
              <div className="font-extrabold flex items-center gap-1.5">
                <span>Free Replacement Redelivery Record</span>
              </div>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                A separate ₹0 replacement order will be created and linked to Order #{orderNo}.
                The customer will immediately receive an in-app popup asking if they are available to receive the delivery.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Select reason for redelivery:
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {[
                  'Items damaged in transit',
                  'Missing item(s) from parcel',
                  'Customer received incorrect item(s)',
                  'Quality issue / spoiled item',
                  'Other reason',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRedeliveryPreset(reason)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer border ${
                      redeliveryPreset === reason
                        ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 font-medium'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Additional notes for customer & dispatch team:
              </label>
              <textarea
                rows={2}
                value={redeliveryCustomReason}
                onChange={(e) => setRedeliveryCustomReason(e.target.value)}
                placeholder={
                  redeliveryPreset === 'Other reason'
                    ? 'Please specify replacement details...'
                    : 'Add special replacement notes (optional)...'
                }
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRedeliveryModal(false)}
                disabled={initiatingRedelivery}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitiateRedelivery}
                disabled={initiatingRedelivery}
                className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {initiatingRedelivery ? 'Creating...' : 'Confirm & Initiate Redelivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
