import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { apiPatch } from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const STATUS_TABS = {
  PENDING_APPROVAL: { label: 'Pending Approval', v: 'warning' },
  REFUND_GRANTED:   { label: 'Refund Granted',   v: 'success' },
  REJECTED:         { label: 'Rejected',         v: 'error'   },
  ALL:              { label: 'All Requests',     v: 'neutral' },
};

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RefundRequests() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [search, setSearch] = useState('');

  // Selected refund modal state
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
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

  const tabFiltered =
    tab === 'ALL' ? refunds : refunds.filter((r) => (r.status || 'PENDING_APPROVAL') === tab);

  const filtered = tabFiltered.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(r.orderNo || '').includes(search) ||
      (r.userName || '').toLowerCase().includes(q) ||
      (r.userEmail || '').toLowerCase().includes(q) ||
      (r.userPhone || '').includes(search) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  });

  const pendingCount = refunds.filter(
    (r) => (r.status || 'PENDING_APPROVAL') === 'PENDING_APPROVAL'
  ).length;

  const handleOpenDetail = (refund) => {
    setSelectedRefund(refund);
    setIsModalOpen(true);
  };

  const handleGrantRefund = async () => {
    if (!selectedRefund) return;
    setActionLoading(true);
    try {
      await apiPatch(`/refunds/${selectedRefund.id}/status`, {
        status: 'REFUND_GRANTED',
      });
      toast.success(
        `Refund granted for Order #${selectedRefund.orderNo}. Case closed.`
      );
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to grant refund');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedRefund) return;
    if (!rejectReason.trim()) {
      toast.error('Please specify a rejection reason for the customer');
      return;
    }
    setActionLoading(true);
    try {
      await apiPatch(`/refunds/${selectedRefund.id}/status`, {
        status: 'REJECTED',
        rejectReason: rejectReason.trim(),
      });
      toast.success(
        `Refund rejected for Order #${selectedRefund.orderNo}. Case closed.`
      );
      setIsRejectModalOpen(false);
      setIsModalOpen(false);
      setRejectReason('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject refund');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader
        title="Refund Requests"
        subtitle={`${pendingCount} manual refund case${pendingCount === 1 ? '' : 's'} awaiting admin approval`}
      />

      {/* TABS & SEARCH BAR */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-neutral-200/80 rounded-xl shadow-xs overflow-x-auto">
          {Object.entries(STATUS_TABS).map(([k, { label, v }]) => {
            const count =
              k === 'ALL'
                ? refunds.length
                : refunds.filter((r) => (r.status || 'PENDING_APPROVAL') === k).length;
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  active
                    ? 'bg-primary-900 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            placeholder="Search order #, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-900/10 focus:border-primary-900"
          />
        </div>
      </div>

      {/* CONTENT LIST */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader text="Loading refund requests..." />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="No refund requests found"
            description={
              search
                ? 'No requests match your current search query.'
                : 'There are currently no refund requests in this queue.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((item) => {
              const isPending = (item.status || 'PENDING_APPROVAL') === 'PENDING_APPROVAL';
              const isGranted = item.status === 'REFUND_GRANTED';
              const isRejected = item.status === 'REJECTED';

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs hover:border-primary-800/40 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Order Info & Customer */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-extrabold text-gray-900">
                          Order #{item.orderNo}
                        </span>
                        {isPending && (
                          <Badge variant="warning">Awaiting Approval</Badge>
                        )}
                        {isGranted && (
                          <Badge variant="success">Refund Granted</Badge>
                        )}
                        {isRejected && (
                          <Badge variant="error">Rejected</Badge>
                        )}
                        <span className="text-xs text-neutral-400">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-neutral-400" />
                          <span className="font-semibold text-gray-800">
                            {item.userName || 'Customer'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-neutral-400" />
                          <span>{item.userPhone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail size={14} className="text-neutral-400" />
                          <span className="truncate">{item.userEmail || '—'}</span>
                        </div>
                      </div>

                      <div className="text-xs text-neutral-500">
                        <span className="font-semibold text-neutral-700">Reason:</span>{' '}
                        {item.reason || 'Order cancelled'}
                      </div>
                    </div>

                    {/* Middle: Items summary */}
                    <div className="lg:w-48 text-xs text-neutral-600">
                      <div className="font-semibold text-neutral-700 mb-1">
                        Affected Items:
                      </div>
                      <div className="truncate">
                        {(item.items || [])
                          .map((it) => `${it.name} (${it.qty || 1})`)
                          .join(', ') || 'All order items'}
                      </div>
                    </div>

                    {/* Right: Amount & Action */}
                    <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-neutral-100">
                      <div className="text-right">
                        <div className="text-xs text-neutral-400">Refund Amount</div>
                        <div className="text-xl font-black text-emerald-700">
                          ₹{item.totalRefund || 0}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isPending ? 'primary' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item);
                        }}
                      >
                        {isPending ? 'Review Case' : 'View Details'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL & ACTION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Refund Request · Order #${selectedRefund?.orderNo || ''}`}
        size="lg"
      >
        {selectedRefund && (
          <div className="space-y-6">
            {/* STATUS BANNER */}
            {selectedRefund.status === 'REFUND_GRANTED' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-900">
                    Refund Granted & Sent Manually
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Case is closed. Total ₹{selectedRefund.totalRefund} was transferred manually to customer.
                  </div>
                </div>
              </div>
            )}

            {selectedRefund.status === 'REJECTED' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-red-900">
                    Refund Request Rejected
                  </div>
                  <div className="text-xs text-red-700 mt-1">
                    <span className="font-semibold">Reason provided:</span>{' '}
                    {selectedRefund.rejectReason || 'No reason specified'}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Customer can see this reason in their app along with the shop owner phone & WhatsApp buttons.
                  </div>
                </div>
              </div>
            )}

            {/* CUSTOMER INFORMATION */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Customer Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-neutral-500">Name:</span>{' '}
                  <span className="font-bold text-gray-900">
                    {selectedRefund.userName || 'Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Phone:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {selectedRefund.userPhone || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Email:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {selectedRefund.userEmail || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Address:</span>{' '}
                  <span className="text-gray-800">
                    {selectedRefund.address
                      ? [
                          selectedRefund.address.houseNo,
                          selectedRefund.address.street,
                          selectedRefund.address.landmark,
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* ORDER & REFUND DETAILS */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Refund Breakdown & Method
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500">Refund Method:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedRefund.refundTo || 'UPI app'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500">Refund Reference:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedRefund.refundReference || `REF-${selectedRefund.orderNo}`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-500">Cancellation Reason:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedRefund.reason || 'Order cancelled'}
                  </span>
                </div>

                <div className="border-t border-neutral-200 pt-3">
                  <div className="text-xs font-semibold text-neutral-500 mb-2">
                    Items to Refund:
                  </div>
                  <div className="space-y-2">
                    {(selectedRefund.items || []).map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-lg border border-neutral-100"
                      >
                        <span className="font-medium text-gray-800">
                          {it.name} × {it.qty || 1}
                        </span>
                        <span className="font-bold text-gray-900">
                          ₹{(it.price || 0) * (it.qty || 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-base pt-3 border-t border-neutral-200">
                  <span className="font-bold text-gray-900">Total Refund:</span>
                  <span className="text-xl font-extrabold text-emerald-700">
                    ₹{selectedRefund.totalRefund || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* MANUAL DECISION ACTIONS */}
            {(!selectedRefund.status || selectedRefund.status === 'PENDING_APPROVAL') && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">
                      Admin Decision Required
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Check if this is a genuine case. If accepted, send the money manually (UPI/cash) to the customer, then click "Refund Request Accepted & Granted". If invalid or fraudulent, click "Reject Request".
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="primary"
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    disabled={actionLoading}
                    onClick={handleGrantRefund}
                  >
                    <CheckCircle2 size={16} className="mr-2" />
                    Refund Request Accepted (Refund Granted)
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={actionLoading}
                    onClick={() => setIsRejectModalOpen(true)}
                  >
                    <XCircle size={16} className="mr-2" />
                    Reject Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* REJECT REASON MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Refund Request"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Please fill in the reason for rejecting this refund request. The customer will see this explanation in the SupaMart app along with the shop contact numbers.
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Rejection Reason *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Products were already delivered and verified in good condition, or claim could not be verified."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectRefund}
              disabled={actionLoading || !rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
