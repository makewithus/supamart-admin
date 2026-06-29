import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2 } from 'lucide-react';
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

  return (
    <div className="p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Offers & Coupons" subtitle={`${offers.length} offers`}>
        <Button variant="primary" onClick={handleAddClick}>
          <Plus size={16} strokeWidth={2.5} /> Add Offer
        </Button>
      </PageHeader>

      {loading ? (
        <Card><Loader text="Loading offers…" /></Card>
      ) : offers.length === 0 ? (
        <Card><EmptyState icon={Tag} title="No offers yet" message="Create discount codes and offers for your customers." action="Add Offer" onAction={handleAddClick} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {offers.map((o, i) => {
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
