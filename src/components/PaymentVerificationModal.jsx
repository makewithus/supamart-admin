import React, { useState } from 'react';
import { Loader2, User, Package, CheckCircle2, XCircle } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import toast from 'react-hot-toast';
import { apiPatch } from '../services/api';
import productImages from '../utils/productImages';

const REJECT_REASONS = [
  { value: 'AMOUNT_NOT_RECEIVED', label: 'Amount not received' },
  { value: 'AMOUNT_INCORRECT', label: 'Amount credited was incorrect' },
  { value: 'OTHER', label: 'Other' },
];

export default function PaymentVerificationModal({ order, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('AMOUNT_NOT_RECEIVED');
  const [customReason, setCustomReason] = useState('');

  if (!order) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await apiPatch(`/orders/${order.id}/mark-paid`);
      toast.success('Payment confirmed — order approved');
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Failed to confirm payment');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (reason === 'OTHER' && !customReason.trim()) {
      toast.error('Please describe the reason for rejection');
      return;
    }
    setLoading(true);
    try {
      await apiPatch(`/orders/${order.id}/reject-payment`, { reason, customReason: customReason.trim() });
      toast.success('Payment rejected — order cancelled');
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Failed to reject payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Order #</p>
          <p className="font-mono text-sm font-bold text-primary-900">#{order.orderNo}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Amount to Verify</p>
          <p className="text-lg font-bold text-primary-900">₹{order.total}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Payment</p>
          <Badge variant="warning">{order.paymentMethod} • {order.paymentStatus}</Badge>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Claimed At</p>
          <p className="text-sm font-medium text-primary-900">{new Date(order.updatedAt).toLocaleString()}</p>
        </div>
      </div>

      {/* Customer details */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-primary-900 flex items-center gap-2">
          <User size={16} /> Customer Information
        </h3>
        <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-1">
          <p className="text-sm text-neutral-700"><strong>Name:</strong> {order.userName || '—'}</p>
          <p className="text-sm text-neutral-700"><strong>Email:</strong> {order.userEmail || '—'}</p>
          <p className="text-sm text-neutral-700"><strong>Phone:</strong> {order.userPhone || '—'}</p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-primary-900 flex items-center gap-2">
          <Package size={16} /> Order Items
        </h3>
        <div className="border border-neutral-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="p-3 font-semibold text-neutral-500">Item</th>
                <th className="p-3 font-semibold text-neutral-500">Qty</th>
                <th className="p-3 font-semibold text-neutral-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-50 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-neutral-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {productImages[item.name]
                          ? <img src={productImages[item.name]} alt={item.name} className="w-full h-full object-contain" />
                          : <Package size={20} className="text-neutral-300" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-primary-900">{item.name}</p>
                        <p className="text-xs text-neutral-400">{item.variantLabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-neutral-700">x{item.qty}</td>
                  <td className="p-3 font-semibold text-primary-900">₹{item.price * item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification actions */}
      <div className="space-y-4 pt-4 border-t border-neutral-100">
        <p className="text-xs text-neutral-500 font-medium leading-5">
          Check your bank/UPI app for a credit matching this exact amount before confirming.
        </p>

        {!showReject ? (
          <div className="flex gap-3">
            <Button variant="primary" className="flex-1 !bg-secondary-600 hover:!bg-secondary-700 focus:!ring-secondary-600" onClick={handleConfirm} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirm Payment Received</>}
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => setShowReject(true)} disabled={loading}>
              <XCircle size={16} /> Reject Payment
            </Button>
          </div>
        ) : (
          <div className="space-y-3 bg-red-50/50 border border-red-100 rounded-2xl p-4">
            <label className="block text-xs font-semibold text-neutral-600">Why is this payment being rejected?</label>
            <div className="space-y-2">
              {REJECT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rejectReason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-red-500"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            {reason === 'OTHER' && (
              <textarea
                className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200 text-sm focus:outline-none focus:border-red-400"
                rows={2}
                placeholder="Describe the reason…"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setShowReject(false)} disabled={loading}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
