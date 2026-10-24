import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { apiPatch } from '../services/api';
import toast from 'react-hot-toast';
import { Phone, CheckCircle2, XCircle, Send } from 'lucide-react';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [replyText, setReplyText] = useState("Sorry about this. We've issued a refund to your UPI ID.");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setIssues(items);
        if (items.length > 0 && !selectedIssueId) {
          setSelectedIssueId(items[0].id);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Issues snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  function formatTimeAgo(ms) {
    if (!ms) return 'Just now';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.floor(hours / 24)} d ago`;
  }

  const allIssues = useMemo(() => {
    return issues.map((i) => {
      const createdAt = i.createdAt || Date.now();
      const elapsed = Date.now() - createdAt;
      const isOpen = !i.status || i.status === 'OPEN';
      const isOverdue = isOpen && elapsed > 2 * 3600 * 1000;
      const overdueHours = Math.max(1, Math.floor((elapsed - 2 * 3600 * 1000) / 3600000));
      const minsLeft = Math.max(1, Math.floor((2 * 3600 * 1000 - elapsed) / 60000));
      const timeBadge = isOpen
        ? isOverdue
          ? `Overdue by ${overdueHours} h`
          : `${minsLeft} min left`
        : i.status === 'RESOLVED'
        ? 'Resolved'
        : 'Closed';

      const calcRefund = i.refundAmount ||
        (Array.isArray(i.affectedItems)
          ? i.affectedItems.reduce((sum, it) => sum + (Number(it.price || it.total) || 0), 0)
          : Number(i.orderTotal) || 0);

      const photos = Array.isArray(i.photos) ? i.photos : (i.photoUrl ? [i.photoUrl] : []);

      return {
        id: i.id,
        orderNo: i.orderNo || i.orderId?.slice(-4) || '—',
        issueType: i.issueType || 'Customer Issue',
        status: i.status || 'OPEN',
        title: i.title || i.description || (i.issueType ? `${i.issueType} reported` : 'Delivery issue'),
        customerName: i.userName || 'Customer',
        customerPhone: i.userPhone || '—',
        timeAgo: formatTimeAgo(createdAt),
        timeBadge,
        isOverdue,
        comment: i.description || 'Customer reported an issue with their delivery.',
        refundAmount: Math.round(calcRefund),
        photos,
        raw: i,
      };
    });
  }, [issues]);

  const activeIssue = useMemo(() => {
    if (allIssues.length === 0) return null;
    return allIssues.find((i) => i.id === selectedIssueId) || allIssues[0];
  }, [allIssues, selectedIssueId]);

  const handleResolveAction = async (actionType) => {
    if (!activeIssue) return;
    setActionLoading(true);
    try {
      await apiPatch(`/issues/${activeIssue.id}/status`, {
        status: actionType === 'REJECT' ? 'REJECTED' : 'RESOLVED',
        resolutionType: actionType,
        resolutionNotes: replyText,
      });
      toast.success(actionType === 'REJECT' ? 'Issue claim rejected' : 'Issue marked resolved');
    } catch (err) {
      toast.error(err.message || 'Failed to update issue');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !activeIssue) return;
    toast.success(`Reply sent to ${activeIssue.customerName}: "${replyText}"`);
  };

  return (
    <div className="p-6 lg:p-8 w-full space-y-6">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-2xl lg:text-[28px] font-extrabold text-gray-900 tracking-tight leading-none">
          Issues
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5">
          Missing, damaged or wrong items reported by customers — reply within 2 hours
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center text-gray-400 font-medium">
          Loading support issues from database…
        </div>
      ) : allIssues.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 border border-gray-100 text-center shadow-2xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">No active customer issues</h2>
          <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
            All customer deliveries are running smoothly! When customers report missing or damaged items, they will appear here immediately.
          </p>
        </div>
      ) : (
        /* 2-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of Issues */}
          <div className="lg:col-span-5 space-y-3">
            {allIssues.map((issue) => {
              const isSelected = activeIssue?.id === issue.id;
              return (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-gray-200 shadow-md border-l-4 border-l-[#0E6C3B]'
                      : 'border-gray-100 shadow-2xs hover:border-gray-200'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF2F2] text-[#E03137]">
                        {issue.issueType}
                      </span>
                      <span className="font-mono text-xs font-bold text-gray-800">
                        #{issue.orderNo}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        issue.isOverdue
                          ? 'bg-[#FDF2F2] text-[#E03137]'
                          : 'bg-[#FEF7EC] text-[#D97706]'
                      }`}
                    >
                      {issue.timeBadge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-gray-900 text-sm mt-2.5 leading-snug">
                    {issue.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    {issue.customerName} · {issue.timeAgo}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected Issue Detail */}
          {activeIssue && (
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#FDF2F2] text-[#E03137]">
                  {activeIssue.issueType}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (activeIssue.customerPhone && activeIssue.customerPhone !== '—') {
                      window.location.href = `tel:${activeIssue.customerPhone.replace(/[^0-9]/g, '')}`;
                    } else {
                      toast('No phone number on record for this customer');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs shadow-2xs transition-all"
                >
                  <Phone size={13} />
                  Call customer
                </button>
              </div>

              {/* Heading & Meta */}
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  {activeIssue.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1 font-medium">
                  Order #{activeIssue.orderNo} · {activeIssue.customerName} · reported {activeIssue.timeAgo}
                </p>
              </div>

              {/* Customer Quote Box */}
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100/80 text-sm text-gray-700 italic font-medium leading-relaxed">
                "{activeIssue.comment}"
              </div>

              {/* Customer Photos */}
              {activeIssue.photos && activeIssue.photos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-gray-700">Attached photos ({activeIssue.photos.length})</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {activeIssue.photos.map((pUrl, idx) => (
                      <div key={idx} className="w-24 h-24 rounded-xl border border-gray-200 bg-white overflow-hidden p-1 flex items-center justify-center shrink-0">
                        <img
                          src={pUrl}
                          alt={`Proof ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolve by section */}
              {activeIssue.status === 'OPEN' && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2.5">Resolve by</p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleResolveAction('REFUND')}
                      className="bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-2xs transition-all disabled:opacity-60"
                    >
                      Refund ₹{activeIssue.refundAmount}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleResolveAction('REDELIVER')}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-2xs transition-all disabled:opacity-60"
                    >
                      Redeliver item
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleResolveAction('REJECT')}
                      className="bg-white border border-red-200 hover:bg-red-50 text-[#E03137] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-2xs transition-all disabled:opacity-60"
                    >
                      Reject claim
                    </button>
                  </div>
                </div>
              )}

              {/* Reply to customer section */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">Reply to customer</p>
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Type a message to send to the customer..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B] resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendReply}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-gray-800 shadow-2xs transition-all"
                    >
                      <Send size={13} />
                      Send reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
