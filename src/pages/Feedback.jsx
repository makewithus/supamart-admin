import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Star, CheckCircle2, ThumbsUp, ThumbsDown, Phone, Clock, Package } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { apiGet } from '../services/api';
import toast from 'react-hot-toast';

export default function Feedback() {
  const [orders, setOrders] = useState([]);
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'FOLLOW_UP' | '5' | '4' | 'LOW'
  const [resolvedIds, setResolvedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ms_admin_resolved_reviews') || '[]');
    } catch {
      return [];
    }
  });

  // Replace or merge orders safely by ID
  const mergeOrders = useCallback((incomingList) => {
    setOrders((prev) => {
      const map = new Map();
      prev.forEach((o) => { if (o?.id) map.set(o.id, o); });
      incomingList.forEach((o) => {
        if (o?.id) map.set(o.id, o);
      });
      return Array.from(map.values());
    });
  }, []);

  // Fetch via API to guarantee access regardless of Firestore security rules
  const fetchOrdersFromApi = useCallback(async () => {
    try {
      const res = await apiGet('/orders?limit=200');
      const items = res?.items || (Array.isArray(res) ? res : []);
      if (items.length > 0) {
        setOrders((prev) => {
          const map = new Map();
          prev.forEach((o) => { if (o?.id) map.set(o.id, o); });
          items.forEach((o) => { if (o?.id) map.set(o.id, o); });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.warn('apiGet(/orders) notice:', err?.message || err);
    }
  }, []);

  // Subscribe to orders in real-time
  useEffect(() => {
    fetchOrdersFromApi();

    let unsub = () => {};
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (items.length > 0) {
            setOrders(items);
          }
        },
        (err) => {
          console.warn('Firestore onSnapshot fallback to API:', err?.message || err);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription failed, relying on API:', e);
    }

    const interval = setInterval(fetchOrdersFromApi, 12000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [fetchOrdersFromApi]);

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

  // Parse all rated orders
  const { allReviews, avgRating, totalRatings, breakdown, counts } = useMemo(() => {
    const rated = orders.filter((o) => {
      const rating = o.ratings?.orderRating || o.deliveryRating || o.rating;
      return typeof rating === 'number' && rating > 0;
    });

    let sum = 0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    const reviews = rated.map((o) => {
      const star = Math.min(5, Math.max(1, Math.round(o.ratings?.orderRating || o.deliveryRating || o.rating)));
      starCounts[star] = (starCounts[star] || 0) + 1;
      sum += star;

      const ratedAt = o.ratings?.ratedAt || o.updatedAt || o.createdAt || Date.now();
      const isResolved = Boolean(o.ratings?.isResolved || resolvedIds.includes(o.id));

      return {
        id: o.id,
        orderNo: o.orderNo || o.id?.slice(-4),
        customerName: o.userName || o.customerName || 'Customer',
        phone: o.userPhone || o.customerPhone || '',
        rating: star,
        tags: o.ratings?.tags || o.tags || ['Customer Feedback'],
        comment: o.ratings?.review || o.deliveryReview || o.comment || '',
        deliveryFeedback: o.ratings?.deliveryFeedback || null,
        productRatings: o.ratings?.productRatings || [],
        items: o.items || [],
        ratedAt,
        timeAgo: formatTimeAgo(ratedAt),
        isResolved,
        raw: o,
      };
    });

    reviews.sort((a, b) => (b.ratedAt || 0) - (a.ratedAt || 0));

    const calculatedAvg = reviews.length > 0 ? (sum / reviews.length).toFixed(1) : '0.0';
    const calculatedBreakdown = [
      { star: 5, count: starCounts[5] || 0, color: 'bg-[#0a7c47]' },
      { star: 4, count: starCounts[4] || 0, color: 'bg-[#059669]' },
      { star: 3, count: starCounts[3] || 0, color: 'bg-[#f59e0b]' },
      { star: 2, count: starCounts[2] || 0, color: 'bg-[#ef4444]' },
      { star: 1, count: starCounts[1] || 0, color: 'bg-[#dc2626]' },
    ];

    return {
      allReviews: reviews,
      avgRating: calculatedAvg,
      totalRatings: reviews.length,
      breakdown: calculatedBreakdown,
      counts: starCounts,
    };
  }, [orders, resolvedIds]);

  // Filter reviews for display
  const displayedReviews = useMemo(() => {
    if (filterTab === 'FOLLOW_UP') {
      return allReviews.filter((r) => r.rating <= 3 && !r.isResolved);
    }
    if (filterTab === '5') {
      return allReviews.filter((r) => r.rating === 5);
    }
    if (filterTab === '4') {
      return allReviews.filter((r) => r.rating === 4);
    }
    if (filterTab === 'LOW') {
      return allReviews.filter((r) => r.rating <= 3);
    }
    return allReviews;
  }, [allReviews, filterTab]);

  const followUpCount = useMemo(() => {
    return allReviews.filter((r) => r.rating <= 3 && !r.isResolved).length;
  }, [allReviews]);

  const handleCall = (item) => {
    if (item.phone) {
      window.location.href = `tel:${item.phone.replace(/[^0-9]/g, '')}`;
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

  return (
    <div className="p-6 md:p-8 space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Ratings & reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Real-time order ratings and customer feedback from the SupaMart mobile app
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
            Average of {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'} submitted by customers
          </p>

          {/* Breakdown progress bars */}
          <div className="space-y-3">
            {breakdown.map((row) => {
              const maxCount = Math.max(...breakdown.map((b) => b.count), 1);
              const widthPct = Math.round((row.count / maxCount) * 100);

              return (
                <button
                  key={row.star}
                  type="button"
                  onClick={() => setFilterTab(row.star >= 4 ? String(row.star) : 'LOW')}
                  className="w-full flex items-center text-xs hover:bg-gray-50 p-1 rounded-md transition-colors text-left"
                >
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
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Card: Reviews List (col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200/90 p-6 shadow-2xs space-y-4">
          {/* Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Customer feedback</h2>
              <span className="text-xs text-gray-400 font-medium">
                {displayedReviews.length} {displayedReviews.length === 1 ? 'review' : 'reviews'} displayed
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTab === 'ALL'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({allReviews.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('FOLLOW_UP')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTab === 'FOLLOW_UP'
                    ? 'bg-white text-[#d97706] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Needs follow-up ({followUpCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('5')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTab === '5'
                    ? 'bg-white text-[#0a7c47] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                5★ ({counts[5] || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('4')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTab === '4'
                    ? 'bg-white text-[#059669] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                4★ ({counts[4] || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('LOW')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterTab === 'LOW'
                    ? 'bg-white text-[#dc2626] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                1–3★ ({counts[1] + counts[2] + counts[3]})
              </button>
            </div>
          </div>

          {/* List of items */}
          <div className="divide-y divide-gray-100">
            {displayedReviews.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={28} className="text-[#0a7c47]" />
                <span>
                  {allReviews.length === 0
                    ? 'No customer ratings received yet. Ratings submitted from the mobile app will appear here instantly.'
                    : 'No reviews found matching this filter.'}
                </span>
              </div>
            ) : (
              displayedReviews.map((item) => {
                const isExcellent = item.rating === 5;
                const isGood = item.rating === 4;
                const isWarning = item.rating === 3;
                const isNegative = item.rating <= 2;

                return (
                  <div key={item.id} className="py-4 first:pt-2 last:pb-0 flex items-start gap-4">
                    {/* Star badge */}
                    <div
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shrink-0 ${
                        isExcellent
                          ? 'bg-[#ecfdf5] text-[#047857]'
                          : isGood
                          ? 'bg-[#f0fdf4] text-[#16a34a]'
                          : isWarning
                          ? 'bg-[#fef3c7] text-[#d97706]'
                          : 'bg-[#fee2e2] text-[#dc2626]'
                      }`}
                    >
                      <span>{item.rating}</span>
                      <Star size={11} className="fill-current text-current" />
                    </div>

                    {/* Middle details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm">
                          {item.customerName}{' '}
                          <span className="text-gray-400 font-normal">#{item.orderNo}</span>
                        </p>
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <Clock size={11} />
                          {item.timeAgo}
                        </span>
                        {item.isResolved && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            Resolved
                          </span>
                        )}
                      </div>

                      {/* Delivery feedback / tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {item.deliveryFeedback === 'up' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                            <ThumbsUp size={10} /> Liked delivery
                          </span>
                        )}
                        {item.deliveryFeedback === 'down' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700">
                            <ThumbsDown size={10} /> Disliked delivery
                          </span>
                        )}
                        {item.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Comment text */}
                      {item.comment ? (
                        <p className="text-sm text-gray-700 mt-1.5 leading-snug font-medium">
                          "{item.comment}"
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic mt-1">
                          Rated {item.rating} stars without written review.
                        </p>
                      )}

                      {/* Product ratings breakdown if present */}
                      {item.productRatings && item.productRatings.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.productRatings.map((pr, pIdx) => {
                            const matchedItem = item.items.find(
                              (it) => it.productId === pr.productId || it.id === pr.productId
                            );
                            const name = matchedItem?.name || `Product`;
                            return (
                              <span
                                key={pIdx}
                                className="inline-flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 text-gray-600 font-medium"
                              >
                                <Package size={10} className="text-gray-400" />
                                {name}: {pr.rating}★
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {item.phone && (
                        <button
                          onClick={() => handleCall(item)}
                          className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors text-center flex items-center gap-1"
                        >
                          <Phone size={11} /> Call
                        </button>
                      )}
                      {item.rating <= 3 && !item.isResolved && (
                        <button
                          onClick={() => handleMarkResolved(item)}
                          className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors text-center"
                        >
                          Mark resolved
                        </button>
                      )}
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
