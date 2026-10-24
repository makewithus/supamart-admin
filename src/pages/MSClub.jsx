import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';

export default function MSClub() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [monthlyPrice, setMonthlyPrice] = useState('49');
  const [bulkDiscount, setBulkDiscount] = useState('5');
  const [freeDelivery, setFreeDelivery] = useState(true);
  const [earlyAccess, setEarlyAccess] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);

  // Load plan settings from config
  useEffect(() => {
    async function loadPlan() {
      try {
        const planDoc = await getDoc(doc(db, 'config', 'msClub'));
        if (planDoc.exists()) {
          const d = planDoc.data();
          if (d.monthlyPrice !== undefined) setMonthlyPrice(String(d.monthlyPrice));
          if (d.bulkDiscount !== undefined) setBulkDiscount(String(d.bulkDiscount));
          if (d.freeDelivery !== undefined) setFreeDelivery(!!d.freeDelivery);
          if (d.earlyAccess !== undefined) setEarlyAccess(!!d.earlyAccess);
        }
      } catch (err) {
        console.warn('Could not load msClub config, using defaults:', err);
      }
    }
    loadPlan();
  }, []);

  // Listen to members from users collection
  useEffect(() => {
    try {
      const q = query(collection(db, 'users'), where('isMSClubMember', '==', true));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => {
          const u = d.data();
          return {
            id: d.id,
            name: u.name || 'Member',
            email: u.email || '',
            rawValidUntil: u.msClubValidUntil || 0,
            rawSaved: u.msClubSavedAmount || 0,
            since: u.msClubJoinedAt
              ? new Date(u.msClubJoinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—',
            renews: u.msClubValidUntil
              ? new Date(u.msClubValidUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '—',
            saved: u.msClubSavedAmount ? `₹${u.msClubSavedAmount}` : '₹0',
            status: u.msClubStatus || 'Active',
          };
        });

        setMembers(list);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching members:', err);
        setMembers([]);
        setLoading(false);
      });

      return () => unsub();
    } catch (_) {
      setMembers([]);
      setLoading(false);
    }
  }, []);

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setSavingPlan(true);
    try {
      await setDoc(doc(db, 'config', 'msClub'), {
        monthlyPrice: Number(monthlyPrice) || 49,
        bulkDiscount: Number(bulkDiscount) || 5,
        freeDelivery,
        earlyAccess,
        updatedAt: Date.now(),
      }, { merge: true });
      toast.success('MS Club plan updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save plan: ' + err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const activeCount = members.length;
  const monthlyRevenue = activeCount * (Number(monthlyPrice) || 49);
  const renewsIn7Days = members.filter((m) => {
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    return m.rawValidUntil >= now && m.rawValidUntil <= sevenDays;
  }).length;
  const deliveryFeesWaived = members.reduce((sum, m) => sum + (m.rawSaved || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-6 w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">MS Club</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          ₹{monthlyPrice} a month · free delivery, no minimum order, extra {bulkDiscount}% off bulk packs
        </p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-xl border border-gray-200/90 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-gray-600">Active members</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{activeCount}</p>
          <p className="text-xs text-gray-400 mt-1">+{activeCount} this month</p>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl border border-gray-200/90 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-gray-600">Monthly revenue</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">₹{monthlyRevenue}</p>
          <p className="text-xs text-gray-400 mt-1">From memberships</p>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl border border-gray-200/90 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-gray-600">Renewals in 7 days</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{renewsIn7Days}</p>
          <p className="text-xs text-gray-400 mt-1">Reminder sent automatically</p>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl border border-gray-200/90 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-gray-600">Delivery fees waived</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">₹{deliveryFeesWaived}</p>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>
      </div>

      {/* Main Content Split: Members Table (Left) + Plan Settings (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Members Table */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="text-base font-bold text-gray-900">Members</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MEMBER</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SINCE</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">RENEWS</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SAVED SO FAR</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="font-semibold text-gray-500 text-sm">No MS Club members yet</p>
                        <p className="text-xs text-gray-400">Customers who subscribe to MS Club will appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-4 font-bold text-gray-900 text-sm">{m.name}</td>
                      <td className="px-5 py-4 text-gray-500 text-sm">{m.since}</td>
                      <td className="px-5 py-4 text-gray-500 text-sm">{m.renews}</td>
                      <td className="px-5 py-4 font-bold text-gray-900 text-sm">{m.saved}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e6f4ea] text-[#137333]">
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan Form */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200/90 p-5 shadow-2xs">
          <h2 className="text-base font-bold text-gray-900 mb-4">Plan</h2>
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Monthly price (₹)
              </label>
              <input
                type="number"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="w-full px-3.5 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0a7c47] focus:border-[#0a7c47]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Bulk pack discount (%)
              </label>
              <input
                type="number"
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(e.target.value)}
                className="w-full px-3.5 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0a7c47] focus:border-[#0a7c47]"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={freeDelivery}
                  onChange={(e) => setFreeDelivery(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0a7c47] focus:ring-[#0a7c47] accent-[#0a7c47]"
                />
                <span className="text-sm font-medium text-gray-700">Free delivery on every order</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={earlyAccess}
                  onChange={(e) => setEarlyAccess(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0a7c47] focus:ring-[#0a7c47] accent-[#0a7c47]"
                />
                <span className="text-sm font-medium text-gray-700">Early access to weekly deals</span>
              </label>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={savingPlan}
              className="w-full mt-3 py-2.5 px-4 bg-[#0a7c47] hover:bg-[#086338] text-white text-sm font-medium rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {savingPlan ? 'Saving…' : 'Save plan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
