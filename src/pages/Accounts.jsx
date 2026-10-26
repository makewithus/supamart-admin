import React, { useState, useEffect, useMemo } from 'react';
import { Search, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Modal from '../components/ui/Modal';
import PaymentVerificationModal from '../components/PaymentVerificationModal';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { apiPatch, apiGet } from '../services/api';
import toast from 'react-hot-toast';

function formatWaiting(createdAt) {
  if (!createdAt) return '—';
  const diffMs = Date.now() - createdAt;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${Math.max(1, diffMins)} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
}

export default function Accounts() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TO_VERIFY');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rejectOrder, setRejectOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('AMOUNT_NOT_RECEIVED');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrdersFromApi = async () => {
    try {
      const data = await apiGet('/orders?limit=100');
      const items = Array.isArray(data) ? data : data?.items || [];
      if (items.length > 0) {
        setOrders(items);
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchOrdersFromApi();
    const interval = setInterval(fetchOrdersFromApi, 10000);

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Accounts snapshot error:', err);
        fetchOrdersFromApi();
      }
    );
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  // Filter orders by tab
  const upiOrders = useMemo(() => {
    return orders.filter((o) => o.paymentMethod === 'UPI_MANUAL' || !o.paymentMethod || o.paymentMethod === 'UPI');
  }, [orders]);

  const toVerifyList = useMemo(() => {
    return upiOrders.filter((o) => o.paymentStatus === 'AWAITING_CONFIRMATION' || o.paymentStatus === 'PENDING');
  }, [upiOrders]);

  const verifiedList = useMemo(() => {
    return upiOrders.filter((o) => o.paymentStatus === 'PAID');
  }, [upiOrders]);

  const rejectedList = useMemo(() => {
    return upiOrders.filter((o) => o.paymentStatus === 'FAILED');
  }, [upiOrders]);

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  // Aggregate stats
  const waitingAmount = toVerifyList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const verifiedTodayOrders = useMemo(() => {
    return verifiedList.filter((o) => (o.updatedAt || o.createdAt || 0) >= startOfToday);
  }, [verifiedList, startOfToday]);
  const verifiedTodayAmount = verifiedTodayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const oldestWaitingOrder = useMemo(() => {
    if (toVerifyList.length === 0) return null;
    return [...toVerifyList].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
  }, [toVerifyList]);

  const codOrders = useMemo(() => {
    return orders.filter((o) => o.paymentMethod === 'COD' || o.paymentMethod === 'CASH_ON_DELIVERY');
  }, [orders]);

  const cashToCollectAmount = useMemo(() => {
    return codOrders
      .filter((o) => (o.status === 'DELIVERED' || o.status === 'OUT_FOR_DELIVERY') && o.paymentStatus !== 'PAID')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [codOrders]);

  const displayedOrders = useMemo(() => {
    if (activeTab === 'TO_VERIFY') return toVerifyList;
    if (activeTab === 'VERIFIED') return verifiedList;
    if (activeTab === 'REJECTED') return rejectedList;
    return upiOrders;
  }, [activeTab, toVerifyList, verifiedList, rejectedList, upiOrders]);

  const handleVerify = async (order, e) => {
    e?.stopPropagation();
    setActionLoading(true);
    try {
      await apiPatch(`/orders/${order.id}/mark-paid`);
      toast.success(`Payment verified for Order #${order.orderNo || order.id?.slice(-4)}`);
    } catch (err) {
      toast.error(err.message || 'Failed to verify payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (order, e) => {
    e?.stopPropagation();
    setRejectOrder(order);
    setRejectReason('AMOUNT_NOT_RECEIVED');
    setCustomRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectOrder) return;
    setActionLoading(true);
    try {
      await apiPatch(`/orders/${rejectOrder.id}/reject-payment`, {
        reason: rejectReason,
        customReason: customRejectReason.trim(),
      });
      toast.success(`Payment rejected for Order #${rejectOrder.orderNo || rejectOrder.id?.slice(-4)}`);
      setRejectOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to reject payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRowClick = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const toVerifyCount = toVerifyList.length;
  const verifiedCount = verifiedList.length;
  const rejectedCount = rejectedList.length;
  const allCount = upiOrders.length;

  return (
    <div className="p-6 lg:p-8 space-y-6 w-full animate-fade-in">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl lg:text-[28px] font-extrabold text-gray-900 tracking-tight leading-none">
          Payments
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5">
          Check each UPI transaction in your bank app before you verify it
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Waiting to verify */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
          <p className="text-xs font-semibold text-gray-500">Waiting to verify</p>
          <p className="text-2xl font-black text-gray-900 tracking-tight mt-1.5">
            ₹{waitingAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {toVerifyCount} {toVerifyCount === 1 ? 'payment' : 'payments'}
          </p>
        </div>

        {/* Oldest waiting */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
          <p className="text-xs font-semibold text-gray-500">Oldest waiting</p>
          <p className={`text-2xl font-black tracking-tight mt-1.5 ${oldestWaitingOrder ? 'text-[#E03137]' : 'text-gray-400'}`}>
            {oldestWaitingOrder ? formatWaiting(oldestWaitingOrder.createdAt) : '—'}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1 truncate">
            {oldestWaitingOrder ? `Order #${oldestWaitingOrder.orderNo || oldestWaitingOrder.id?.slice(-4)} · awaiting` : 'All caught up'}
          </p>
        </div>

        {/* Verified today */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
          <p className="text-xs font-semibold text-gray-500">Verified today</p>
          <p className="text-2xl font-black text-[#0E6C3B] tracking-tight mt-1.5">
            ₹{verifiedTodayAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {verifiedTodayOrders.length} {verifiedTodayOrders.length === 1 ? 'payment' : 'payments'}
          </p>
        </div>

        {/* Cash to collect */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs">
          <p className="text-xs font-semibold text-gray-500">Cash to collect</p>
          <p className="text-2xl font-black text-gray-900 tracking-tight mt-1.5">
            ₹{cashToCollectAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            From cash on delivery
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-8 px-6 pt-4 border-b border-gray-100 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('TO_VERIFY')}
            className={`pb-3 font-bold transition-all relative ${
              activeTab === 'TO_VERIFY'
                ? 'text-gray-900 border-b-2 border-[#0E6C3B]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            To verify <span className="font-semibold text-xs ml-0.5">{toVerifyCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('VERIFIED')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'VERIFIED'
                ? 'text-gray-900 border-b-2 border-[#0E6C3B]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Verified <span className="text-xs ml-0.5">{verifiedCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'REJECTED'
                ? 'text-gray-900 border-b-2 border-[#0E6C3B]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Rejected <span className="text-xs ml-0.5">{rejectedCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'ALL'
                ? 'text-gray-900 border-b-2 border-[#0E6C3B]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            All <span className="text-xs ml-0.5">{allCount}</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-white">
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">ORDER</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">CUSTOMER</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">AMOUNT</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">UPI REFERENCE (UTR)</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">PAID WITH</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">WAITING</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400 font-medium">
                    {activeTab === 'TO_VERIFY'
                      ? 'No UPI payments waiting for verification. All clear!'
                      : activeTab === 'VERIFIED'
                      ? 'No verified payments found.'
                      : activeTab === 'REJECTED'
                      ? 'No rejected payments found.'
                      : 'No UPI transactions found.'}
                  </td>
                </tr>
              ) : (
                displayedOrders.map((o) => {
                  const isClosed = o.status === 'DELIVERED' || o.status === 'CANCELLED';
                  const utr = o.upiRef || o.paymentDetails?.utr || o.paymentDetails?.transactionId;
                  const paidWith = o.paidWith || o.paymentDetails?.app || o.paymentMethod || 'UPI';
                  const waiting = o.waitingText || formatWaiting(o.createdAt);
                  const isShortWait = o.isWaitingShort ?? (waiting.includes('min') || waiting.includes('h'));
                  const isPendingVerification = o.paymentStatus === 'AWAITING_CONFIRMATION' || o.paymentStatus === 'PENDING';

                  return (
                    <tr
                      key={o.id}
                      onClick={() => handleRowClick(o)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Order Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">#{o.orderNo || o.id?.slice(-4)}</span>
                          {isClosed && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">
                              Order closed
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Column */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 text-xs sm:text-sm leading-tight">{o.userName || o.customerName || 'Customer'}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-normal leading-tight">{o.userEmail || o.userPhone || '—'}</p>
                      </td>

                    {/* Amount Column */}
                    <td className="px-6 py-4 font-bold text-gray-900 text-sm whitespace-nowrap">
                      ₹{Number(o.total || 0).toLocaleString('en-IN')}
                    </td>

                    {/* UPI Reference (UTR) */}
                    <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                      {utr ? (
                        <span className="text-gray-800 font-medium">{utr}</span>
                      ) : (
                        <span className="text-[#E03137] font-semibold">Not entered</span>
                      )}
                    </td>

                    {/* Paid with */}
                    <td className="px-6 py-4 text-gray-500 font-normal whitespace-nowrap">
                      {paidWith}
                    </td>

                    {/* Waiting time badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                          isShortWait
                            ? 'bg-[#FEF7EC] text-[#D97706]'
                            : 'bg-[#FDF2F2] text-[#E03137]'
                        }`}
                      >
                        {waiting}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isPendingVerification ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleVerify(o, e)}
                            className="bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-2xs transition-all"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenReject(o, e)}
                            className="bg-white border border-red-200 text-[#E03137] hover:bg-red-50 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : o.paymentStatus === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0E6C3B] bg-[#E7F4EB] px-2.5 py-1 rounded-md">
                          <CheckCircle2 size={13} /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E03137] bg-[#FDF2F2] px-2.5 py-1 rounded-md">
                          <XCircle size={13} /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Payment for #{rejectOrder.orderNo}</h3>
            <p className="text-xs text-gray-500">
              The order will be cancelled and the customer will be notified of the payment mismatch.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Reason</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white text-gray-800"
              >
                <option value="AMOUNT_NOT_RECEIVED">Amount not received in bank</option>
                <option value="AMOUNT_INCORRECT">Amount credited was incorrect</option>
                <option value="INVALID_UTR">Invalid or unverified UTR reference</option>
                <option value="OTHER">Other reason</option>
              </select>
            </div>
            {rejectReason === 'OTHER' && (
              <div>
                <textarea
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Explain why payment was rejected..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800"
                  rows={3}
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold text-white bg-[#E03137] hover:bg-red-700 rounded-xl shadow-2xs"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Verification Modal */}
      {isModalOpen && selectedOrder && (
        selectedOrder.paymentStatus === 'AWAITING_CONFIRMATION' && selectedOrder.status !== 'DELIVERED' ? (
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={`Payment Details #${selectedOrder?.orderNo || ''}`}
            size="lg"
          >
            <PaymentVerificationModal
              order={selectedOrder}
              onClose={() => setIsModalOpen(false)}
              onSuccess={() => {
                setIsModalOpen(false);
                fetchOrdersFromApi();
              }}
            />
          </Modal>
        ) : (
          <OrderDetailsModal
            order={selectedOrder}
            readOnly={true}
            viewOnlyReason="Order payment details in audit ledger."
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => {
              setIsModalOpen(false);
              fetchOrdersFromApi();
            }}
          />
        )
      )}
    </div>
  );
}
