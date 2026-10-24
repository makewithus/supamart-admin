import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { apiPatch } from '../services/api';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';

export default function RefundRequests() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('WAITING');
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [rejectModalRefund, setRejectModalRefund] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'refunds'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRefunds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Refunds snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const waitingList = useMemo(() => {
    return refunds.filter((r) => (r.status || 'PENDING_APPROVAL') === 'PENDING_APPROVAL');
  }, [refunds]);

  const refundedList = useMemo(() => {
    return refunds.filter((r) => r.status === 'REFUND_GRANTED' || r.status === 'REFUNDED');
  }, [refunds]);

  const rejectedList = useMemo(() => {
    return refunds.filter((r) => r.status === 'REJECTED');
  }, [refunds]);

  const displayedRefunds = useMemo(() => {
    if (activeTab === 'WAITING') return waitingList;
    if (activeTab === 'REFUNDED') return refundedList;
    if (activeTab === 'REJECTED') return rejectedList;
    return refunds;
  }, [activeTab, waitingList, refundedList, rejectedList, refunds]);

  const handleApprove = async (r, e) => {
    e?.stopPropagation();
    setActionLoading(true);
    try {
      await apiPatch(`/refunds/${r.id}/status`, { status: 'REFUND_GRANTED' });
      toast.success(`Refund approved for Order #${r.orderNo}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve refund');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (r, e) => {
    e?.stopPropagation();
    setRejectModalRefund(r);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalRefund) return;
    if (!rejectReason.trim()) {
      toast.error('Please specify a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await apiPatch(`/refunds/${rejectModalRefund.id}/status`, {
        status: 'REJECTED',
        rejectReason: rejectReason.trim(),
      });
      toast.success(`Refund rejected for Order #${rejectModalRefund.orderNo}`);
      setRejectModalRefund(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject refund');
    } finally {
      setActionLoading(false);
    }
  };

  const waitingCount = waitingList.length;
  const refundedCount = refundedList.length;
  const rejectedCount = rejectedList.length;
  const allCount = refunds.length;

  return (
    <div className="p-6 lg:p-8 w-full space-y-6">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-2xl lg:text-[28px] font-extrabold text-gray-900 tracking-tight leading-none">
          Refunds
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5">
          Refunds go back to the customer's UPI ID within 5-7 working days
        </p>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        {/* Tabs Bar */}
        <div className="flex items-center gap-8 px-6 pt-4 border-b border-gray-100 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('WAITING')}
            className={`pb-3 font-bold transition-all relative ${
              activeTab === 'WAITING'
                ? 'text-gray-900 border-b-2 border-[#0E6C3B]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Waiting for approval <span className="font-semibold text-xs ml-0.5">{waitingCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('REFUNDED')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'REFUNDED'
                ? 'text-gray-900 border-b-2 border-[#0E6C3B]'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Refunded <span className="text-xs ml-0.5">{refundedCount}</span>
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
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">REQUEST</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">ORDER</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">CUSTOMER</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">REASON</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">AMOUNT</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">REFUND TO</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayedRefunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 size={32} className="text-gray-300 stroke-[1.5]" />
                      <p className="font-semibold text-gray-500 text-sm">No refund requests found</p>
                      <p className="text-xs text-gray-400">There are no refund requests in this view right now.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRefunds.map((r) => {
                  const reqNum = r.requestNo || `RF-${String(r.orderNo || r.id.slice(-4)).padStart(4, '0')}`;
                  const isPending = (r.status || 'PENDING_APPROVAL') === 'PENDING_APPROVAL';
                  const reasonTitle = r.reasonTitle || r.reason || 'Refund Request';
                  const reasonSub = r.reasonSub || (r.items ? `${r.items[0]?.name || 'Item'} · details attached` : 'Customer requested refund');
                  const refundToUpi = r.refundTo || r.upiId || r.userUpiId || 'UPI / Original Method';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRefund(r)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Request Column */}
                      <td className="px-6 py-4 font-semibold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                        {reqNum}
                      </td>

                      {/* Order Column */}
                      <td className="px-6 py-4 font-semibold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                        #{r.orderNo}
                      </td>

                      {/* Customer Column */}
                      <td className="px-6 py-4 font-bold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                        {r.userName || r.userPhone || 'Customer'}
                      </td>

                      {/* Reason Column */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 text-xs leading-tight">{reasonTitle}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-normal leading-tight">{reasonSub}</p>
                      </td>

                      {/* Amount Column */}
                      <td className="px-6 py-4 font-bold text-gray-900 text-sm whitespace-nowrap">
                        ₹{r.amount}
                      </td>

                      {/* Refund To (UPI) */}
                      <td className="px-6 py-4 font-mono text-xs text-gray-800 font-medium whitespace-nowrap">
                        {refundToUpi}
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleApprove(r, e)}
                              className="bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-2xs transition-all"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenReject(r, e)}
                              className="bg-white border border-red-200 text-[#E03137] hover:bg-red-50 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : r.status === 'REFUND_GRANTED' || r.status === 'REFUNDED' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0E6C3B] bg-[#E7F4EB] px-2.5 py-1 rounded-md">
                            <CheckCircle2 size={13} /> Refunded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E03137] bg-[#FDF2F2] px-2.5 py-1 rounded-md">
                            <XCircle size={13} /> Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reject Refund Request</h3>
            <p className="text-xs text-gray-500">
              Please enter the reason for rejecting this refund request for Order #{rejectModalRefund.orderNo}:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Item was delivered in good condition, proof not conclusive..."
              className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-800"
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalRefund(null)}
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
                {actionLoading ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedRefund}
        onClose={() => setSelectedRefund(null)}
        title={`Refund Request: ${selectedRefund?.requestNo || selectedRefund?.id || ''}`}
        size="md"
      >
        {selectedRefund && (
          <div className="space-y-4 text-xs">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Order:</span>
                <span className="font-bold text-gray-900">#{selectedRefund.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900">{selectedRefund.userName || selectedRefund.userPhone || 'Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-bold text-emerald-800 text-sm">₹{selectedRefund.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Refund Destination UPI:</span>
                <span className="font-mono font-medium text-gray-800">{selectedRefund.refundTo || selectedRefund.upiId || 'UPI / Original Method'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reason:</span>
                <span className="font-medium text-gray-800">{selectedRefund.reasonTitle || selectedRefund.reason}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
