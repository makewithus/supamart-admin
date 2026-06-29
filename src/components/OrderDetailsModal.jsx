import React, { useState, useEffect } from 'react';
import { Loader2, User, MapPin, Package, Clock } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import toast from 'react-hot-toast';
import { apiPatch } from '../services/api';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const STATUS_OPTIONS = [
  'PENDING', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
];

export default function OrderDetailsModal({ order, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(order?.status || 'PENDING');
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

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Order ID</p>
          <p className="font-mono text-sm font-bold text-primary-900">{order.id}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Amount</p>
          <p className="text-sm font-bold text-primary-900">₹{order.total}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Payment</p>
          <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>{order.paymentMethod} • {order.paymentStatus}</Badge>
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
                    <p className="font-medium text-primary-900">{item.name}</p>
                    <p className="text-xs text-neutral-400">{item.variantLabel || item.unit}</p>
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
            <select 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-900"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Button variant="primary" onClick={handleUpdateStatus} disabled={loading || status === order.status}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Update Status'}
          </Button>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Assign Delivery Partner</label>
            <select 
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-900"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">-- Unassigned --</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name || p.phone || p.id}</option>)}
            </select>
          </div>
          <Button variant="outline" onClick={handleAssignPartner} disabled={loading || partnerId === order.assignedPartnerId}>
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
