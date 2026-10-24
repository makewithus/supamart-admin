import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Copy, Check, Upload, Trash2, Edit2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import OfferForm from '../components/OfferForm';
import { apiDel, apiPut } from '../services/api';
import toast from 'react-hot-toast';

export default function Offers() {
  const [activeTab, setActiveTab] = useState('coupons'); // 'coupons' | 'banners'
  const [offers, setOffers] = useState([]);
  const [banners, setBanners] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    try {
      const qOffers = query(collection(db, 'offers'), orderBy('createdAt', 'desc'));
      const unsubOffers = onSnapshot(
        qOffers,
        (snap) => {
          setOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.error('Offers fetch error:', err);
          setLoading(false);
        }
      );

      const qBanners = collection(db, 'banners');
      const unsubBanners = onSnapshot(
        qBanners,
        (snap) => {
          setBanners(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.error('Banners fetch error:', err);
        }
      );

      return () => {
        unsubOffers();
        unsubBanners();
      };
    } catch (_) {
      setLoading(false);
    }
  }, []);

  const displayCoupons = useMemo(() => {
    return offers.map((o) => {
      const discountText =
        o.kind === 'PERCENT' ? `${o.value}% off` : `₹${o.value} off`;
      let cond = '';
      if (o.minValue > 0) cond += `Min ₹${o.minValue}`;
      if (o.maxDiscount) cond += `${cond ? ' · ' : ''}Max ₹${o.maxDiscount}`;
      if (o.firstOrderOnly) cond += `${cond ? ' · ' : ''}first order only`;
      if (!cond) cond = 'No min order';

      const validUntilStr = o.validTo
        ? new Date(o.validTo).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : 'Never expires';

      return {
        id: o.id,
        code: o.code || 'COUPON',
        discount: discountText,
        conditions: cond,
        used: o.usedCount || 0,
        validUntil: validUntilStr,
        isAmberDate: o.validTo && o.validTo < Date.now() + 90 * 86400000,
        isActive: o.isActive !== false,
        raw: o,
      };
    });
  }, [offers]);

  const handleToggleActive = async (coupon, e) => {
    e.stopPropagation();
    const nextState = !coupon.isActive;

    try {
      await apiPut(`/offers/${coupon.id}`, { isActive: nextState });
      toast.success(`Coupon ${coupon.code} is now ${nextState ? 'Active' : 'Inactive'}.`);
    } catch (err) {
      console.error('Failed to sync toggle to server:', err);
      toast.error('Failed to update coupon status');
    }
  };

  const handleToggleBanner = async (banner) => {
    const nextState = !banner.isActive;
    try {
      await apiPut(`/banners/${banner.id}`, { isActive: nextState });
      toast.success('Banner visibility updated.');
    } catch (err) {
      console.error('Failed to update banner:', err);
      toast.error('Failed to update banner');
    }
  };

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied "${code}"`);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleOpenAddModal = () => {
    setEditingOffer(null);
    setIsModalOpen(true);
  };

  const handleRowClick = (coupon) => {
    if (coupon.raw) {
      setEditingOffer(coupon.raw);
    } else {
      setEditingOffer({
        code: coupon.code,
        kind: coupon.kind || 'FLAT',
        value: coupon.value || 50,
        minValue: coupon.minValue || 0,
        isActive: coupon.isActive,
      });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 lg:p-8 w-full space-y-5 animate-fade-in">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Offers & banners</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Coupons customers apply at checkout, and the banners on the home screen
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#056B38] hover:bg-[#04552C] active:bg-[#034423] text-white text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New coupon</span>
        </button>
      </div>

      {/* Navigation Pill Tabs */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'coupons'
              ? 'bg-white text-gray-900 shadow-2xs border border-gray-200/80'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          Coupons
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'banners'
              ? 'bg-white text-gray-900 shadow-2xs border border-gray-200/80'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          Home banners
        </button>
      </div>

      {/* Main Content Card */}
      {activeTab === 'coupons' ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-white">
                  <th className="py-3.5 px-6 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    CODE
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    DISCOUNT
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    CONDITIONS
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    USED
                  </th>
                  <th className="py-3.5 px-4 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                    VALID UNTIL
                  </th>
                  <th className="py-3.5 px-6 text-[11px] font-bold tracking-wider text-gray-400 uppercase text-right">
                    ACTIVE
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {displayCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-6 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="font-semibold text-gray-500 text-sm">No coupons found</p>
                        <p className="text-xs text-gray-400">Click &ldquo;New coupon&rdquo; to create a discount coupon for your customers.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayCoupons.map((coupon) => (
                    <tr
                      key={coupon.id || coupon.code}
                      onClick={() => handleRowClick(coupon)}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer group"
                    >
                      {/* CODE */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-dashed border-[#86EFAC] bg-[#F0FDF4] text-[#166534] font-mono text-xs font-bold tracking-wide">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(coupon.code, e)}
                            title="Copy code"
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 transition-opacity rounded"
                          >
                            {copiedCode === coupon.code ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* DISCOUNT */}
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {coupon.discount}
                      </td>

                      {/* CONDITIONS */}
                      <td className="py-3.5 px-4 text-gray-500 font-normal">
                        {coupon.conditions}
                      </td>

                      {/* USED */}
                      <td className="py-3.5 px-4 text-gray-700 font-medium">
                        {coupon.used}
                      </td>

                      {/* VALID UNTIL */}
                      <td
                        className={`py-3.5 px-4 font-medium ${
                          coupon.isAmberDate ? 'text-[#D97706]' : 'text-gray-600'
                        }`}
                      >
                        {coupon.validUntil}
                      </td>

                      {/* ACTIVE TOGGLE */}
                      <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleActive(coupon, e)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            coupon.isActive ? 'bg-[#0a7c47]' : 'bg-gray-300'
                          }`}
                          title={coupon.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              coupon.isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Home Banners Tab View */
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Active Home Screen Banners</h2>
              <p className="text-xs text-gray-500 mt-0.5">Banners featured in the carousel on the mobile customer app</p>
            </div>
            <button
              onClick={() => toast.success('Upload custom banner image')}
              className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Upload size={14} />
              <span>Add banner</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {banners.length === 0 ? (
              <div className="py-12 text-center text-gray-400 col-span-2">
                <div className="flex flex-col items-center justify-center gap-2">
                  <ImageIcon size={32} className="text-gray-300 stroke-[1.5]" />
                  <p className="font-semibold text-gray-500 text-sm">No banners created yet</p>
                  <p className="text-xs text-gray-400">Add marketing banners to highlight on the customer app home screen.</p>
                </div>
              </div>
            ) : (
              banners.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-gray-200/80 p-4 flex flex-col justify-between hover:border-emerald-600/30 transition-all bg-[#FAFBF9]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Target: {b.target || b.targetType || 'Home'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleBanner(b)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ${
                          b.isActive ? 'bg-[#056B38] justify-end' : 'bg-gray-200 justify-start'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs transition duration-200 ${
                            b.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">{b.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.subtitle}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200/60 text-xs text-gray-400">
                    <span>{b.clicks || 0} user interactions</span>
                    <button
                      onClick={() => toast.success('Banner details')}
                      className="text-xs font-semibold text-[#0A7C47] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Configure</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Coupon / Edit Coupon Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOffer ? `Edit Coupon: ${editingOffer.code}` : 'Create New Coupon'}
        size="md"
      >
        <OfferForm
          offer={editingOffer}
          onSuccess={() => {
            setIsModalOpen(false);
            toast.success('Coupon updated successfully!');
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          try {
            await apiDel(`/offers/${deletingId}`);
            toast.success('Offer deleted.');
          } catch (e) {
            toast.error(e.message);
          } finally {
            setDeletingId(null);
          }
        }}
        title="Delete Coupon"
        message="Are you sure you want to delete this coupon? It will no longer apply at checkout."
      />
    </div>
  );
}
