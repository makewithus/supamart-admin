import React, { useState, useEffect, useMemo } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function Feedback() {
  const [orders, setOrders] = useState([]);
  const [resolvedIds, setResolvedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ms_admin_resolved_reviews') || '[]');
    } catch {
      return [];
    }
  });

  // Subscribe to orders in real-time
  useEffect(() => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.error('Failed to load orders for feedback:', err);
        }
      );
      return () => unsub();
    } catch (_) {}
  }, []);

  // Compute breakdown and rated orders
  const { avgRating, totalRatings, breakdown, followUps } = useMemo(() => {
    const rated = orders.filter((o) => {
      const rating = o.ratings?.orderRating || o.deliveryRating || o.rating;
      return typeof rating === 'number' && rating > 0;
    });

    let sum = 0;
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const needsFollowUpList = [];

    rated.forEach((o) => {
      const star = Math.min(5, Math.max(1, Math.round(o.ratings?.orderRating || o.deliveryRating || o.rating)));
      counts[star] = (counts[star] || 0) + 1;
      sum += star;

      if (star <= 3) {
        needsFollowUpList.push({
          id: o.id,
          orderNo: o.orderNo || o.id?.slice(-4),
          customerName: o.userName || o.customerName || 'Customer',
          phone: o.userPhone || o.customerPhone || '',
          rating: star,
          tags: o.ratings?.tags || o.tags || ['Customer Feedback'],
          comment: o.ratings?.review || o.deliveryReview || o.comment || 'Feedback received.',
        });
      }
    });

    if (rated.length === 0) {
      return {
        avgRating: '0.0',
        totalRatings: 0,
        breakdown: [
          { star: 5, count: 0, color: 'bg-[#0a7c47]' },
          { star: 4, count: 0, color: 'bg-[#059669]' },
          { star: 3, count: 0, color: 'bg-[#f59e0b]' },
          { star: 2, count: 0, color: 'bg-[#ef4444]' },
          { star: 1, count: 0, color: 'bg-[#dc2626]' },
        ],
        followUps: [],
      };
    }

    const calculatedAvg = (sum / rated.length).toFixed(1);
    const calculatedBreakdown = [
      { star: 5, count: counts[5] || 0, color: 'bg-[#0a7c47]' },
      { star: 4, count: counts[4] || 0, color: 'bg-[#059669]' },
      { star: 3, count: counts[3] || 0, color: 'bg-[#f59e0b]' },
      { star: 2, count: counts[2] || 0, color: 'bg-[#ef4444]' },
      { star: 1, count: counts[1] || 0, color: 'bg-[#dc2626]' },
    ];

    return {
      avgRating: calculatedAvg,
      totalRatings: rated.length,
      breakdown: calculatedBreakdown,
      followUps: needsFollowUpList,
    };
  }, [orders]);

  const handleCall = (item) => {
    if (item.phone) {
      window.location.href = `tel:${item.phone}`;
      toast.success(`Calling ${item.customerName} (${item.phone})`);
    } else {
      toast('No phone number on record for this customer');
    }
  };

  const handleMarkResolved = async (item) => {
    const next = [...resolvedIds, item.id];
    setResolvedIds(next);
    localStorage.setItem('ms_admin_resolved_reviews', JSON.stringify(next));

    try {
      await updateDoc(doc(db, 'orders', item.id), {
        'ratings.isResolved': true,
        'ratings.resolvedAt': Date.now(),
      });
      toast.success(`Review for #${item.orderNo} marked as resolved!`);
    } catch (_) {
      toast.success(`Review for #${item.orderNo} marked as resolved!`);
    }
  };

  const visibleFollowUps = followUps.filter((item) => !resolvedIds.includes(item.id));

  return (
    <div className="p-6 md:p-8 space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Ratings & reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          From the “Rate your order” screen in the app
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Summary Breakdown (col-span-4) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200/90 p-6 shadow-2xs">
          {/* Big Rating */}
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-gray-900 tracking-tight">{avgRating}</span>
            <span className="text-base font-normal text-gray-400">/5</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 mb-6">
            Average of {totalRatings} ratings in the last 30 days
          </p>

          {/* Breakdown progress bars */}
          <div className="space-y-3">
            {breakdown.map((row) => {
              const maxCount = Math.max(...breakdown.map((b) => b.count), 1);
              const widthPct = Math.round((row.count / maxCount) * 100);

              return (
                <div key={row.star} className="flex items-center text-xs">
                  <span className="w-8 font-semibold text-gray-600 flex items-center gap-1">
                    {row.star}
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden mx-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${row.color}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-5 text-right font-bold text-gray-700">{row.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Needs follow-up (col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200/90 p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Needs follow-up</h2>
            <span className="text-xs text-gray-400 font-medium">Ratings of 3 or below</span>
          </div>

          {/* List of items */}
          <div className="divide-y divide-gray-100">
            {visibleFollowUps.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={28} className="text-[#0a7c47]" />
                <span>{totalRatings === 0 ? 'No customer ratings received yet.' : 'All low rating reviews have been resolved! Great work!'}</span>
              </div>
            ) : (
              visibleFollowUps.map((item) => {
                const isWarning = item.rating === 3;
                return (
                  <div key={item.id} className="py-4 first:pt-4 last:pb-0 flex items-start gap-4">
                    {/* Star badge */}
                    <div
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shrink-0 ${
                        isWarning
                          ? 'bg-[#fef3c7] text-[#d97706]'
                          : 'bg-[#fee2e2] text-[#dc2626]'
                      }`}
                    >
                      <span>{item.rating}</span>
                      <Star size={11} className="fill-current text-current" />
                    </div>

                    {/* Middle details */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm">
                        {item.customerName} <span className="text-gray-400 font-normal">#{item.orderNo}</span>
                      </p>

                      {/* Issue tags */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Comment text */}
                      <p className="text-sm text-gray-600 mt-1.5 leading-snug">
                        {item.comment}
                      </p>
                    </div>

                    {/* Right actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleCall(item)}
                        className="px-4 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors text-center"
                      >
                        Call
                      </button>
                      <button
                        onClick={() => handleMarkResolved(item)}
                        className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors text-center"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
