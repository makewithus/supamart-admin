import React, { useState, useEffect, useMemo } from 'react';
import { Send, Smartphone, Bell, Clock, CheckCircle2, Users, AlertCircle, Sparkles } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { apiPost, apiGet } from '../services/api';
import toast from 'react-hot-toast';
import { playNotificationSound, getAudioContext } from '../utils/notificationSound';

function formatSentDate(ms) {
  if (!ms) return 'Just now';
  const d = new Date(ms);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function PushNotifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendTo, setSendTo] = useState('ALL');
  const [when, setWhen] = useState('Send now');
  const [opens, setOpens] = useState('Home screen');

  const [users, setUsers] = useState([]);
  const [sentList, setSentList] = useState([]);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);

  // Fetch users once on mount to compute actual reachable token counts (no continuous listener)
  useEffect(() => {
    let active = true;
    getDocs(collection(db, 'users'))
      .then((snap) => {
        if (!active) return;
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch((e) => console.error('Error loading users:', e));
    return () => { active = false; };
  }, []);

  // Subscribe to recent broadcasts to display actual sent notifications
  useEffect(() => {
    try {
      const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20));
      const unsub = onSnapshot(
        q,
        (snap) => {
          setSentList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.warn('Broadcasts query error, falling back to unordered collection:', err);
          onSnapshot(collection(db, 'broadcasts'), (snap2) => {
            const list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setSentList(list);
          });
        }
      );
      return () => unsub();
    } catch (e) {
      console.error('Error listening to broadcasts:', e);
    }
  }, []);

  // Calculate reachable stats dynamically
  const audienceStats = useMemo(() => {
    let totalReachable = 0;
    let msClubReachable = 0;
    let newUsersReachable = 0;

    users.forEach((u) => {
      const hasToken = Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0;
      const notOptedOut = u.offerNotificationsEnabled !== false;
      if (hasToken && notOptedOut) {
        totalReachable++;
        if (u.isMSClubMember) msClubReachable++;
        if (!u.totalOrders || u.totalOrders === 0) newUsersReachable++;
      }
    });

    return {
      totalUsers: users.length,
      totalReachable,
      msClubReachable,
      newUsersReachable,
    };
  }, [users]);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter both title and message.');
      return;
    }

    setSending(true);
    try {
      const audienceLabel =
        sendTo === 'ALL'
          ? 'All customers'
          : sendTo === 'ACTIVE'
          ? 'Active shoppers'
          : sendTo === 'MSCLUB'
          ? 'MS Club members'
          : 'New shoppers';

      const res = await apiPost('/admin/broadcast', {
        title: title.trim(),
        body: message.trim(),
        audience: audienceLabel,
        targetScreen: opens,
      }, { timeout: 45_000 });

      try {
        getAudioContext()?.resume();
        playNotificationSound();
      } catch (_) {}

      toast.success(
        res.sent > 0
          ? `Push notification sent to ${res.sent} registered devices!`
          : 'Saved to customer in-app inboxes. No mobile push tokens are registered yet.'
      );
      setTitle('');
      setMessage('');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to broadcast notification');
    } finally {
      setSending(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      getAudioContext()?.resume();
      playNotificationSound();

      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          new Notification(title || 'MS Traders', {
            body: message || 'Store notification test',
            icon: '/branding/ms-traders-symbol-small-colour.svg',
          });
        }
      }
      toast.success('Test notification triggered in this browser.');
    } catch (err) {
      toast.error('Could not display test notification: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 w-full space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Push notifications</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Send offers and store announcements to customers who allowed notifications · {audienceStats.totalReachable} reachable devices
        </p>
      </div>

      {/* Main Grid: Form (left) & Mobile Preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Card */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-6 shadow-2xs">
          <form onSubmit={handleSendNotification} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                maxLength={50}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fresh vegetables just arrived"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
              />
              <div className="text-right text-[11px] text-gray-400 mt-1">
                {title.length}/50
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message</label>
              <textarea
                value={message}
                maxLength={140}
                rows={3}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter notification body text..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 resize-none transition-all"
              />
              <div className="text-right text-[11px] text-gray-400 mt-1">
                {message.length}/140
              </div>
            </div>

            {/* Dropdowns Row: Send to & When */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Send to</label>
                <div className="relative">
                  <select
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pr-8 cursor-pointer"
                  >
                    <option value="ALL">All customers ({audienceStats.totalReachable} reachable)</option>
                    <option value="ACTIVE">Active shoppers (last 7 days)</option>
                    <option value="MSCLUB">MS Club members ({audienceStats.msClubReachable} reachable)</option>
                    <option value="NEW">New customers ({audienceStats.newUsersReachable} reachable)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">When</label>
                <div className="relative">
                  <select
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pr-8 cursor-pointer"
                  >
                    <option value="Send now">Send now</option>
                    <option value="Schedule for 3:00 PM today">Schedule for 3:00 PM today</option>
                    <option value="Schedule for 6:00 PM today">Schedule for 6:00 PM today</option>
                    <option value="Tomorrow morning 9:00 AM">Tomorrow morning 9:00 AM</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Opens */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Opens</label>
              <div className="relative">
                <select
                  value={opens}
                  onChange={(e) => setOpens(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pr-8 cursor-pointer"
                >
                  <option value="Home screen">Home screen</option>
                  <option value="Offers & banners">Offers & banners</option>
                  <option value="Vegetables Category">Vegetables Category</option>
                  <option value="MS Club Screen">MS Club Screen</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-2xs cursor-pointer text-center"
              >
                {testing ? 'Sending test…' : 'Send test to this browser'}
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2 rounded-xl bg-[#056B38] hover:bg-[#04552C] active:bg-[#034423] text-white text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer text-center"
              >
                {sending ? 'Broadcasting…' : 'Send notification'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Preview Card */}
        <div className="lg:col-span-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">Live Device Preview</p>
          <div className="bg-[#1F2429] p-5 rounded-3xl border border-gray-800 shadow-xl flex items-center justify-center">
            {/* iOS/Android style card */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-lg border border-white/20 w-full transition-all">
              <div className="flex items-center gap-2 mb-1.5">
                <img
                  src="/branding/ms-traders-symbol-small-colour.svg"
                  alt="MS Traders"
                  className="w-5 h-5 object-contain shrink-0"
                />
                <span className="text-[11px] font-semibold text-gray-600">MS Traders</span>
                <span className="text-[10px] text-gray-400 ml-auto font-medium">now</span>
              </div>
              <p className="text-xs font-bold text-gray-900 leading-snug">
                {title || 'Notification Title'}
              </p>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5 line-clamp-3">
                {message || 'Notification message text will appear right here.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sent Section (Real-time from Firestore broadcasts collection) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Broadcast History</h2>
          <span className="text-xs text-gray-400 font-medium">{sentList.length} total broadcasts</span>
        </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                  <th className="py-3.5 px-6 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    NOTIFICATION
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    AUDIENCE
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    SENT
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    DELIVERED
                  </th>
                  <th className="py-3.5 px-6 text-[11px] font-bold tracking-wider text-gray-400 uppercase text-right">
                    TARGET
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-800">
                {sentList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                      No broadcast notifications sent yet. Use the form above to dispatch your first push notification.
                    </td>
                  </tr>
                ) : (
                  sentList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-gray-900">{item.title}</div>
                        <div className="text-[11px] text-gray-400 truncate max-w-xs">{item.body}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        {item.audience || 'All customers'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-medium whitespace-nowrap">
                        {formatSentDate(item.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 font-bold">
                        {item.delivered || 0} devices
                      </td>
                      <td className="py-3.5 px-6 text-gray-600 font-medium text-right">
                        {item.targetScreen || 'Home screen'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Broadcast Cards (smaller screens) */}
          <div className="block md:hidden divide-y divide-gray-100">
            {sentList.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-semibold">
                No broadcast notifications sent yet.
              </div>
            ) : (
              sentList.map((item) => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">{item.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.body}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 shrink-0">
                      {item.delivered || 0} devices
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <span>{item.audience || 'All customers'} · {item.targetScreen || 'Home'}</span>
                    <span>{formatSentDate(item.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
  );
}
