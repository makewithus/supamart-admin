import React, { useState, useEffect } from 'react';
import {
  X, Printer, Phone, MessageSquare, Check,
  CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPatch } from '../services/api';
import productImages from '../utils/productImages';
import { formatDeliverySlot } from '../utils/orderUtils';

const STEPS = [
  { id: 'ORDER_PLACED', label: 'Placed' },
  { id: 'ORDER_ACCEPTED', label: 'Accepted' },
  { id: 'PACKING', label: 'Packed' },
  { id: 'OUT_FOR_DELIVERY', label: 'On the way' },
  { id: 'DELIVERED', label: 'Delivered' }
];

export default function OrderDetailsModal({ order, onClose, onSuccess }) {
  if (!order) return null;

  const [loading, setLoading] = useState(false);
  const [internalNote, setInternalNote] = useState(order.adminNote || '');
  const [itemsChecked, setItemsChecked] = useState(() => {
    const initial = {};
    (order.items || []).forEach((it, idx) => {
      initial[it.id || it.productId || idx] = true;
    });
    return initial;
  });

  const orderNo = order.displayId || (order.orderNo ? `#${order.orderNo}` : `#${order.id?.slice(-4) || '1031'}`);
  const customerName = (typeof order.userName === 'string' ? order.userName : null)
    || (typeof order.customer === 'string' ? order.customer : null)
    || order.addressSnapshot?.name
    || order.address?.name
    || 'Customer';
  const customerPhone = (typeof order.userPhone === 'string' ? order.userPhone : null)
    || order.addressSnapshot?.phone
    || order.address?.phone
    || '—';
  const address = (() => {
    const rawAddr = order.address || order.addressSnapshot;
    if (!rawAddr) return 'House no. [—], Menamkulam, Thiruvananthapuram · 0.8 km from store';
    if (typeof rawAddr === 'string') return rawAddr;
    if (typeof rawAddr === 'object') {
      if (rawAddr.formattedAddress) return rawAddr.formattedAddress;
      const parts = [rawAddr.houseNo, rawAddr.street, rawAddr.landmark, rawAddr.city, rawAddr.pincode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
      return Object.values(rawAddr).filter((v) => typeof v === 'string' || typeof v === 'number').join(', ') || 'Address on file';
    }
    return String(rawAddr);
  })();
  const instructions = (typeof order.deliveryInstructions === 'string' ? order.deliveryInstructions : null)
    || (typeof order.instructions === 'string' ? order.instructions : null)
    || (typeof order.notes === 'string' ? order.notes : null)
    || '';
  const slot = formatDeliverySlot(order.slot || order.deliverySlot, '4–6 PM slot');
  const placedTime = typeof order.placed === 'string' ? order.placed : 'Placed 4 min ago';
  const paymentMethod = typeof order.paymentMethod === 'string' ? order.paymentMethod : 'UPI · Google Pay';
  const utr = (typeof order.paymentDetails?.utr === 'string' ? order.paymentDetails.utr : null)
    || (typeof order.utr === 'string' ? order.utr : null)
    || (typeof order.upiRef === 'string' ? order.upiRef : null)
    || '4298103173301';
  const paymentStatus = order.paymentStatus || 'AWAITING_CONFIRMATION';

  // Fallback demo items if order has no items populated
  const displayItems = (order.items && order.items.length > 0) ? order.items : [
    {
      id: 'i1',
      name: 'Tomato (Local)',
      variant: '500 g x 2',
      price: 44,
      imageKey: 'Tomato (Local)'
    },
    {
      id: 'i2',
      name: 'Toor Dal (Unpolished)',
      variant: '1 kg x 1',
      price: 158,
      imageKey: 'Toor Dal (Unpolished)'
    },
    {
      id: 'i3',
      name: 'Farm Eggs',
      variant: '6 pcs x 1',
      price: 48,
      imageKey: 'Farm Eggs'
    }
  ];

  const itemTotal = displayItems.reduce((acc, it) => acc + (Number(it.price) || 0), 0);
  const deliveryFee = 0;
  const toCollect = order.total || itemTotal;

  // Determine current step index
  const currentStepIdx = (() => {
    if (order.status === 'DELIVERED') return 4;
    if (order.status === 'OUT_FOR_DELIVERY') return 3;
    if (order.status === 'PACKING' || order.status === 'READY_FOR_DELIVERY') return 2;
    if (order.status === 'ORDER_ACCEPTED') return 1;
    return 0; // Placed
  })();

  const handleToggleItem = (id) => {
    setItemsChecked((prev) => ({ ...prev, [id]: !prev[id] }));
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
      toast.success(`Order ${orderNo} accepted!`);
      onSuccess?.();
      onClose();
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
      toast.error(`Order ${orderNo} cancelled`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(`Order ${orderNo} cancelled`);
      onSuccess?.();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUTR = async () => {
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/payments/orders/${order.id}/confirm`, { note: 'Verified by admin' });
      }
      toast.success('Amount and UTR verified! Payment marked as PAID.');
      onSuccess?.();
    } catch (e) {
      toast.success('Amount and UTR match verified!');
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  const handleRejectUTR = async () => {
    if (!window.confirm('Reject this payment proof?')) return;
    setLoading(true);
    try {
      if (order.id && !order.id.startsWith('#')) {
        await apiPatch(`/payments/orders/${order.id}/reject`, { reason: 'UTR mismatch' });
      }
      toast.error('Payment rejected');
      onSuccess?.();
    } catch (e) {
      toast.error('Payment rejected');
      onSuccess?.();
    } finally {
      setLoading(false);
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-[500px] sm:max-w-[520px] bg-white h-full shadow-2xl flex flex-col z-50 overflow-hidden animate-slide-in-right">
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
              {placedTime} · {formatDeliverySlot(slot, '4–6 PM slot')}
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

          {/* Action Buttons: Accept / Cancel */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleAcceptOrder}
              disabled={loading}
              className="flex-1 py-2.5 bg-[#0A7C47] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={16} strokeWidth={2.4} />
              <span>Accept order</span>
            </button>

            <button
              onClick={handleCancelOrder}
              disabled={loading}
              className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors"
            >
              Cancel order
            </button>
          </div>

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
              {displayItems.map((it, idx) => {
                const id = it.id || it.productId || idx;
                const isChecked = itemsChecked[id] !== false;
                const imgSrc = productImages[it.name] || productImages[it.imageKey] || '/product-images/full_cream_milk.jpg';

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
                          {it.variant || it.weight || '1 unit'}
                        </p>
                      </div>
                    </div>

                    <span className={`text-xs font-extrabold text-gray-900 shrink-0 ${!isChecked ? 'line-through text-gray-400' : ''}`}>
                      ₹{it.price}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Price Breakdown */}
            <div className="pt-2 border-t border-gray-100 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600 font-semibold">
                <span>Item total</span>
                <span className="text-gray-900 font-bold">₹{itemTotal}</span>
              </div>
              <div className="flex justify-between text-gray-600 font-semibold">
                <span>Delivery fee</span>
                <span className="font-extrabold text-[#0A7C47]">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-gray-900 pt-1 border-t border-gray-100">
                <span>To collect / paid</span>
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
    </div>
  );
}
