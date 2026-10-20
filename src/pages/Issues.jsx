import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  ExternalLink,
  Camera,
  RotateCcw,
  Truck,
  Image as ImageIcon,
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
  OPEN:     { label: 'Open Issues', v: 'warning' },
  RESOLVED: { label: 'Resolved',    v: 'success' },
  REJECTED: { label: 'Rejected',    v: 'error'   },
  ALL:      { label: 'All Issues',  v: 'neutral' },
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

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('OPEN');
  const [search, setSearch] = useState('');

  // Selected issue for detail modal
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Photo viewer modal
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Resolution action states
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Issues snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const tabFiltered =
    tab === 'ALL' ? issues : issues.filter((i) => (i.status || 'OPEN') === tab);

  const filtered = tabFiltered.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(i.orderNo || '').includes(search) ||
      (i.userName || '').toLowerCase().includes(q) ||
      (i.userEmail || '').toLowerCase().includes(q) ||
      (i.userPhone || '').includes(search) ||
      (i.issueType || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  });

  const openCount = issues.filter((i) => (i.status || 'OPEN') === 'OPEN').length;

  const handleOpenDetail = (issue) => {
    setSelectedIssue(issue);
    setResolutionNotes(issue.resolutionNotes || '');
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedIssue) return;
    setActionLoading(true);
    try {
      await apiPatch(`/issues/${selectedIssue.id}/status`, {
        status,
        resolutionNotes: resolutionNotes.trim(),
      });
      toast.success(
        status === 'RESOLVED'
          ? `Issue for Order #${selectedIssue.orderNo} marked as resolved.`
          : `Issue for Order #${selectedIssue.orderNo} rejected.`
      );
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update issue status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader
        title="Issues & Disputed Orders"
        subtitle={`${openCount} open issue request${openCount === 1 ? '' : 's'} reported by customers`}
      />

      {/* TABS & SEARCH BAR */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-neutral-200/80 rounded-xl shadow-xs overflow-x-auto">
          {Object.entries(STATUS_TABS).map(([k, { label, v }]) => {
            const count =
              k === 'ALL'
                ? issues.length
                : issues.filter((i) => (i.status || 'OPEN') === k).length;
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
            placeholder="Search order #, customer, issue..."
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
            <Loader text="Loading reported issues..." />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="No reported issues"
            description={
              search
                ? 'No issues match your current search query.'
                : 'There are currently no reported issues in this queue.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((item) => {
              const isOpen = (item.status || 'OPEN') === 'OPEN';
              const isResolved = item.status === 'RESOLVED';
              const isRejected = item.status === 'REJECTED';
              const wantsRefund = item.resolutionType === 'REFUND';

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs hover:border-primary-800/40 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Order Info & Customer */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold text-gray-900">
                          Order #{item.orderNo}
                        </span>
                        {isOpen && <Badge variant="warning">Open Issue</Badge>}
                        {isResolved && <Badge variant="success">Resolved</Badge>}
                        {isRejected && <Badge variant="error">Rejected</Badge>}

                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-900 border border-primary-200/60">
                          {item.issueType || 'General Issue'}
                        </span>

                        <span className="text-xs text-neutral-400 ml-auto lg:ml-0">
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

                      {item.description && (
                        <p className="text-xs text-neutral-600 line-clamp-1 italic bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100">
                          "{item.description}"
                        </p>
                      )}
                    </div>

                    {/* Middle: Affected products & photos preview */}
                    <div className="lg:w-64 space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-neutral-700">Affected Products:</span>
                        <div className="text-neutral-600 truncate mt-0.5">
                          {(item.affectedItems || [])
                            .map((it) => `${it.name} (${it.qty || 1})`)
                            .join(', ')}
                        </div>
                      </div>

                      {item.photos && item.photos.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Camera size={14} className="text-neutral-400" />
                          <span className="text-neutral-500 font-medium">
                            {item.photos.length} photo{item.photos.length === 1 ? '' : 's'} attached
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Wanted fix & action */}
                    <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-neutral-100">
                      <div className="text-right">
                        <div className="text-xs text-neutral-400">User Requested</div>
                        <div className="text-sm font-bold text-gray-800 flex items-center gap-1 justify-end">
                          {wantsRefund ? (
                            <>
                              <RotateCcw size={14} className="text-emerald-600" />
                              <span>Refund to UPI</span>
                            </>
                          ) : (
                            <>
                              <Truck size={14} className="text-blue-600" />
                              <span>Deliver Again</span>
                            </>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isOpen ? 'primary' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item);
                        }}
                      >
                        {isOpen ? 'Review & Fix' : 'View Details'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAILED ISSUE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Reported Issue · Order #${selectedIssue?.orderNo || ''}`}
        size="lg"
      >
        {selectedIssue && (
          <div className="space-y-6">
            {/* RESOLUTION STATUS BANNER */}
            {selectedIssue.status === 'RESOLVED' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-emerald-900">
                    Issue Resolved
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {selectedIssue.resolutionNotes
                      ? `Notes: ${selectedIssue.resolutionNotes}`
                      : 'This issue was resolved by the shop admin.'}
                  </div>
                </div>
              </div>
            )}

            {selectedIssue.status === 'REJECTED' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-red-900">
                    Issue Request Rejected
                  </div>
                  <div className="text-xs text-red-700 mt-0.5">
                    {selectedIssue.resolutionNotes || 'No notes provided.'}
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
                    {selectedIssue.userName || 'Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Phone:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {selectedIssue.userPhone || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Email:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {selectedIssue.userEmail || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Address:</span>{' '}
                  <span className="text-gray-800">
                    {selectedIssue.address
                      ? [
                          selectedIssue.address.houseNo,
                          selectedIssue.address.street,
                          selectedIssue.address.landmark,
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* ISSUE DETAILS & AFFECTED ITEMS */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 space-y-4">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Issue Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-neutral-500">What went wrong:</span>{' '}
                  <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                    {selectedIssue.issueType || 'Unspecified'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500">Customer Desired Fix:</span>{' '}
                  <span className="font-bold text-primary-900 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200">
                    {selectedIssue.resolutionType === 'REFUND'
                      ? 'Refund to original payment (UPI app)'
                      : 'Deliver the item again'}
                  </span>
                </div>
              </div>

              {/* Affected items list */}
              <div>
                <div className="text-xs font-semibold text-neutral-500 mb-2">
                  Affected Items:
                </div>
                <div className="space-y-2">
                  {(selectedIssue.affectedItems || []).map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-2 px-3 bg-white rounded-lg border border-neutral-200"
                    >
                      <div className="font-medium text-gray-800">
                        {it.name}{' '}
                        <span className="text-neutral-400">
                          ({it.unit || ''} × {it.qty || 1})
                        </span>
                      </div>
                      <div className="font-bold text-gray-900">
                        ₹{(it.price || 0) * (it.qty || 1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer description */}
              {selectedIssue.description && (
                <div>
                  <div className="text-xs font-semibold text-neutral-500 mb-1">
                    Customer Description:
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-neutral-200 text-sm text-gray-800">
                    {selectedIssue.description}
                  </div>
                </div>
              )}

              {/* Photos */}
              {selectedIssue.photos && selectedIssue.photos.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-neutral-500 mb-2">
                    Evidence Photos (tap to view full):
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {selectedIssue.photos.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setPreviewPhoto(url)}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-neutral-200 cursor-pointer hover:opacity-80 transition-opacity bg-white"
                      >
                        <img
                          src={url}
                          alt={`Evidence ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ACTION SECTION */}
            {(!selectedIssue.status || selectedIssue.status === 'OPEN') && (
              <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-4">
                <h4 className="text-sm font-bold text-gray-900">
                  Take Action on this Issue
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">
                    Resolution Notes (optional note sent to customer):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Redelivery dispatched via rider / Refund ₹246 processed to UPI"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-900/10 focus:border-primary-900"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button
                    variant="primary"
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus('RESOLVED')}
                  >
                    <CheckCircle2 size={16} className="mr-2" />
                    Mark as Resolved
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus('REJECTED')}
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

      {/* FULL PHOTO PREVIEW MODAL */}
      <Modal
        isOpen={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title="Photo Evidence Preview"
        size="md"
      >
        {previewPhoto && (
          <div className="flex items-center justify-center p-2">
            <img
              src={previewPhoto}
              alt="Evidence preview"
              className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
