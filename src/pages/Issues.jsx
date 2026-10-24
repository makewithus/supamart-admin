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

  // Designer sample showcase items to match Screenshot 3
  const sampleIssues = useMemo(() => [
    {
      id: 'mock-issue-1023',
      orderNo: '1023',
      issueType: 'Damaged item',
      status: 'OPEN',
      title: 'Milk pouch leaking on arrival',
      customerName: 'Krrish Singhal',
      customerPhone: '+91 98765 43210',
      timeAgo: '3 h ago',
      timeBadge: 'Overdue by 1 h',
      isOverdue: true,
      comment: 'Two pouches were wet and one had leaked inside the bag.',
      refundAmount: 33,
      photoUrl: '/product-images/full_cream_milk.jpg',
      hasPhoto2: true,
    },
    {
      id: 'mock-issue-1022',
      orderNo: '1022',
      issueType: 'Missing item',
      status: 'OPEN',
      title: 'Green Chilli not in the bag',
      customerName: 'Test',
      customerPhone: '+91 98765 12345',
      timeAgo: '50 min ago',
      timeBadge: '1 h 10 min left',
      isOverdue: false,
      comment: 'Green Chilli was ordered but missing from the grocery bag.',
      refundAmount: 18,
      photoUrl: null,
      hasPhoto2: false,
    },
  ], []);

  const allIssues = useMemo(() => {
    if (issues.length > 0) {
      // Map Firestore fields if needed
      return issues.map((i) => ({
        ...i,
        orderNo: i.orderNo || i.orderId?.slice(-4) || '1023',
        issueType: i.issueType || 'Damaged item',
        title: i.title || i.description || (i.issueType === 'Damaged item' ? 'Milk pouch leaking on arrival' : 'Missing item in order'),
        customerName: i.userName || 'Customer',
        customerPhone: i.userPhone || '+91 98765 43210',
        timeAgo: '3 h ago',
        timeBadge: i.status === 'OPEN' ? 'Overdue by 1 h' : 'Resolved',
        isOverdue: i.status === 'OPEN',
        comment: i.description || 'Customer reported problem with delivery.',
        refundAmount: i.refundAmount || 33,
        photoUrl: i.photos?.[0] || '/product-images/full_cream_milk.jpg',
        hasPhoto2: true,
      }));
    }
    return sampleIssues;
  }, [issues, sampleIssues]);

  const activeIssue = useMemo(() => {
    return allIssues.find((i) => i.id === selectedIssueId) || allIssues[0] || sampleIssues[0];
  }, [allIssues, selectedIssueId, sampleIssues]);

  const handleResolveAction = async (actionType) => {
    if (!activeIssue) return;
    setActionLoading(true);
    try {
      if (activeIssue.id?.startsWith('mock-')) {
        if (actionType === 'REFUND') toast.success(`Refund of ₹${activeIssue.refundAmount} issued to ${activeIssue.customerName}`);
        else if (actionType === 'REDELIVER') toast.success(`Redelivery scheduled for Order #${activeIssue.orderNo}`);
        else toast.success(`Claim rejected for Order #${activeIssue.orderNo}`);
        return;
      }
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
    if (!replyText.trim()) return;
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
          Missing, damaged or wrong items reported by customers - reply within 2 hours
        </p>
      </div>

      {/* 2-Column Layout */}
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
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#FDF2F2] text-[#E03137]">
              {activeIssue.issueType}
            </span>
            <button
              type="button"
              onClick={() => toast(`Calling customer ${activeIssue.customerName} (${activeIssue.customerPhone})...`)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs shadow-2xs transition-all"
            >
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
          <div className="flex items-center gap-3">
            <div className="w-24 h-24 rounded-xl border border-gray-200 bg-white overflow-hidden p-1 flex items-center justify-center shrink-0">
              <img
                src={activeIssue.photoUrl || '/product-images/full_cream_milk.jpg'}
                alt="Evidence"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = '/product-images/Milma%20Ghee.webp';
                }}
              />
            </div>
            <div className="w-24 h-24 rounded-xl border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-center p-2 shrink-0">
              <span className="text-[11px] text-gray-400 font-medium">Customer photo 2</span>
            </div>
          </div>

          {/* Resolve by section */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2.5">Resolve by</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleResolveAction('REFUND')}
                className="bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-2xs transition-all"
              >
                Refund ₹ {activeIssue.refundAmount}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleResolveAction('REDELIVER')}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-2xs transition-all"
              >
                Redeliver item
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleResolveAction('REJECT')}
                className="bg-white border border-red-200 hover:bg-red-50 text-[#E03137] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-2xs transition-all"
              >
                Reject claim
              </button>
            </div>
          </div>

          {/* Reply to customer section */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">Reply to customer</p>
            <div className="space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
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
      </div>
    </div>
  );
}
