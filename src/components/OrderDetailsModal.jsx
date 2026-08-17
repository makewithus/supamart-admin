import React, { useState, useEffect } from 'react';
import { Loader2, User, MapPin, Package, Clock } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Select from './ui/Select';
import toast from 'react-hot-toast';
import { apiPatch } from '../services/api';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import productImages from '../utils/productImages';

// Mirrors backend/src/config/constants.js ORDER_STATUS_FLOW exactly — the backend only
// accepts a forward one-step move (or a jump straight to CANCELLED at any point), never an
// arbitrary jump. The dropdown used to list all statuses regardless of the order's current
// state, so picking anything but the single valid next status threw "Invalid transition X ->
// Y" — that's what looked like "only a few of them work." Computing the actual valid next
// step here means every option in the dropdown is guaranteed to succeed.
//
// Collapsed from 7 to 5 statuses (dropped PACKING / READY_FOR_DELIVERY) — one shop, one
// rider, so those two intermediate clicks never carried distinct real-world information.
const ORDER_STATUS_FLOW = ['ORDER_PLACED', 'ORDER_ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];
const STATUS_LABELS = {
  ORDER_PLACED: 'Order Placed',
  ORDER_ACCEPTED: 'Accepted',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Defensive fallback only — every real status has an entry in STATUS_LABELS above. This
// just keeps a stray/legacy status value (e.g. one not yet migrated) from ever rendering
// as a raw SCREAMING_SNAKE_CASE string in the UI.
function humanizeStatus(raw) {
  return raw.replace(/_/g, ' ').replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());
}

// Returns { options, note } — options is always a subset the backend will actually accept
// for a PATCH /orders/:id/status from this order's current state. The backend allows any
// forward move (not just the immediate next step — see assertValidTransition in
// orderService.js), so every status from the order's current position onward, plus
// CANCELLED, is offered here — the admin can jump straight to the right one instead of
// clicking through each intermediate status.
function getStatusOptions(order) {
  if (!order) return { options: [], note: null };
  if (TERMINAL_STATUSES.includes(order.status)) {
    return { options: [order.status], note: 'This order is finalized — its status can no longer be changed.' };
  }
  const idx = ORDER_STATUS_FLOW.indexOf(order.status);
  // Backend hard-blocks advancing a UPI_MANUAL order past its current status until the
  // customer has at least claimed payment (AWAITING_CONFIRMATION) or the shop marked it PAID.
  const paymentBlocksAdvance =
    order.paymentMethod === 'UPI_MANUAL' && order.paymentStatus === 'PENDING';

  const options = [order.status];
  if (idx >= 0 && !paymentBlocksAdvance) options.push(...ORDER_STATUS_FLOW.slice(idx + 1));
  options.push('CANCELLED');

  const note = paymentBlocksAdvance
    ? "UPI payment hasn't been confirmed yet — this order can only be cancelled until then."
    // The backend only accepts a forward move within the known flow (see
    // assertValidTransition) — a status outside that flow entirely can't be advanced, only
    // cancelled. Shouldn't happen for any current order (see collapsePackingReadyStatus.js),
    // but stays honest about what will and won't actually succeed if it ever does.
    : idx === -1
      ? "This order has a legacy status outside the normal flow — it can only be cancelled."
      : null;
  return { options, note };
}

export default function OrderDetailsModal({ order, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(order?.status || 'ORDER_PLACED');
  const [partnerId, setPartnerId] = useState(order?.assignedPartnerId || '');
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setPartnerId(order.assignedPartnerId || '');
    }
  }, [order]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'PARTNER'));
        const snap = await getDocs(q);
        setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Failed to load partners', e);
      }
    };
    fetchPartners();
  }, []);

  const handleUpdateStatus = async () => {
    if (status === order.status) return;
    setLoading(true);
    try {
      await apiPatch(`/orders/${order.id}/status`, { status });
      toast.success('Order status updated');
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPartner = async () => {
    if (partnerId === order.assignedPartnerId) return;
    setLoading(true);
    try {
      await apiPatch(`/orders/${order.id}/assign`, { partnerId });
      toast.success('Delivery partner assigned');
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Failed to assign partner');
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  const { options: statusOptions, note: statusNote } = getStatusOptions(order);

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Order #</p>
          <p className="font-mono text-sm font-bold text-primary-900">#{order.orderNo}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Amount</p>
          <p className="text-sm font-bold text-primary-900">₹{order.total}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Payment</p>
          <Badge variant={
            order.paymentStatus === 'PAID' ? 'success'
              : order.paymentStatus === 'FAILED' ? 'error'
              : order.paymentStatus === 'AWAITING_CONFIRMATION' ? 'warning'
              : 'neutral'
          }>{order.paymentMethod} • {order.paymentStatus}</Badge>
          {order.paymentRejectionReason && (
            <p className="text-xs text-red-500 font-medium mt-1">{order.paymentRejectionReason}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Date</p>
          <p className="text-sm font-medium text-primary-900">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
      </div>

      {/* Customer details */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-primary-900 flex items-center gap-2">
          <User size={16} /> Customer Information
        </h3>
        <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2">
          <p className="text-sm text-neutral-700"><strong>Name:</strong> {order.userName || '—'}</p>
          <p className="text-sm text-neutral-700"><strong>Email:</strong> {order.userEmail || '—'}</p>
          <p className="text-sm text-neutral-700"><strong>Phone:</strong> {order.userPhone || '—'}</p>
          {order.addressSnapshot && (
            <div className="flex gap-2 text-sm text-neutral-700 mt-2 pt-2 border-t border-neutral-200">
              <MapPin size={16} className="shrink-0 mt-0.5 text-neutral-400" />
              <p>
                {order.addressSnapshot.houseNo}, {order.addressSnapshot.street}
                <br/>
                {order.addressSnapshot.landmark && <span>Landmark: {order.addressSnapshot.landmark}<br/></span>}
                {order.addressSnapshot.pincode}
              </p>
            </div>
          )}
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
                <th className="p-3 font-semibold text-neutral-500">Price</th>
                <th className="p-3 font-semibold text-neutral-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || order.cartItems || []).map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-50 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-neutral-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {productImages[item.name]
                          ? <img src={productImages[item.name]} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                          : <Package size={20} className="text-neutral-300" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-primary-900">{item.name}</p>
                        <p className="text-xs text-neutral-400">{item.variantLabel || item.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-neutral-700">x{item.qty}</td>
                  <td className="p-3 text-neutral-700">₹{item.price}</td>
                  <td className="p-3 font-semibold text-primary-900">₹{item.price * item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4 pt-4 border-t border-neutral-100">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Update Status</label>
            <Select
              value={status}
              onChange={setStatus}
              disabled={statusOptions.length <= 1}
              options={statusOptions.map((s) => ({
                value: s,
                label: `${STATUS_LABELS[s] || s}${s === order.status ? ' (current)' : ''}`,
              }))}
            />
            {statusNote && <p className="text-xs text-amber-600 font-medium mt-1.5">{statusNote}</p>}
          </div>
          <Button variant="primary" onClick={handleUpdateStatus} disabled={loading || status === order.status}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Update Status'}
          </Button>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Assign Delivery Partner</label>
            <Select
              value={partnerId}
              onChange={setPartnerId}
              options={[
                { value: '', label: '-- Unassigned --' },
                ...partners.map((p) => ({ value: p.id, label: p.name || p.phone || p.id })),
              ]}
            />
          </div>
          <Button variant="outlined" onClick={handleAssignPartner} disabled={loading || partnerId === order.assignedPartnerId}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Assign'}
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
