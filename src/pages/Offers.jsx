import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import IconChip from '../components/ui/IconChip';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import OfferForm from '../components/OfferForm';
import { apiDel } from '../services/api';
import toast from 'react-hot-toast';

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'offers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Failed to load offers');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const performDelete = async () => {
    if (!deletingId) return;
    try {
      await apiDel(`/offers/${deletingId}`);
      toast.success('Offer deleted successfully.');
    } catch (err) {
      toast.error(`Failed to delete offer: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddClick = () => {
    setEditingOffer(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (offer, e) => {
    if (e) e.stopPropagation();
    setEditingOffer(offer);
    setIsModalOpen(true);
  };

  const isExpired = (o) => o.validTo && o.validTo < Date.now();
  const statusOf = (o) => (isExpired(o) ? 'EXPIRED' : o.isActive === false ? 'INACTIVE' : 'ACTIVE');

  const filtered = useMemo(
    () => offers.filter((o) => {
      if (statusFilter !== 'ALL' && statusOf(o) !== statusFilter) return false;
      if (search && !o.code?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [offers, search, statusFilter]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Offers & Coupons" subtitle={`${offers.length} offers`}>
        <Button variant="primary" onClick={handleAddClick}>
          <Plus size={16} strokeWidth={2.5} /> Add Offer
        </Button>
      </PageHeader>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search coupon code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-primary-900
                placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10 transition-all w-56"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'ACTIVE', 'INACTIVE', 'EXPIRED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === s ? 'bg-primary-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <Badge variant="neutral">{filtered.length} of {offers.length}</Badge>
        </div>
      </Card>

      {loading ? (
        <Card><Loader text="Loading offers…" /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={Tag} title="No offers found" message={offers.length ? 'Try adjusting your filters.' : 'Create discount codes and offers for your customers.'} action="Add Offer" onAction={handleAddClick} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((o, i) => {
            const expired = isExpired(o);
            return (
              <div
                key={o.id}
                onClick={() => handleEditClick(o)}
                className={`bg-white rounded-2xl shadow-card p-5 animate-fade-up opacity-0-init cursor-pointer hover:shadow-card-hover transition-shadow group ${expired ? 'opacity-60 hover:opacity-100' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <IconChip icon={Tag} color={expired ? 'neutral' : 'secondary'} size="sm" />
                  <Badge variant={expired ? 'neutral' : o.isActive === false ? 'warning' : 'success'}>
                    {expired ? 'Expired' : o.isActive === false ? 'Inactive' : 'Active'}
                  </Badge>
                </div>

                <p className="font-mono font-bold text-lg text-primary-900 tracking-wider mb-1">{o.code}</p>
                <p className="text-sm text-neutral-500 mb-3">
                  {o.kind === 'PERCENT' ? `${o.value}% off` : `₹${o.value} off`}
                  {o.maxDiscount ? ` · max ₹${o.maxDiscount}` : ''}
                  {o.minValue ? ` · min ₹${o.minValue}` : ''}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <div>
                    <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Valid until</p>
                    <p className="text-xs font-medium text-primary-900">{fmtDate(o.validTo)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEditClick(o); }} className="p-1.5 text-neutral-400 hover:text-primary-900 hover:bg-neutral-100 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingId(o.id); }} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingOffer ? 'Edit Offer' : 'Add New Offer'}
        size="md"
      >
        <OfferForm 
          offer={editingOffer} 
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={performDelete}
        title="Delete Offer"
        message="Are you sure you want to delete this offer? This action cannot be undone."
      />
    </div>
  );
}
