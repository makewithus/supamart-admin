import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import BrandForm from '../components/BrandForm';
import { apiDel } from '../services/api';
import toast from 'react-hot-toast';
import brandLogos from '../utils/brandLogos';

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'brands'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setBrands(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Failed to load brands');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const performDelete = async () => {
    if (!deletingId) return;
    try {
      await apiDel(`/brands/${deletingId}`);
      toast.success('Brand deleted successfully.');
    } catch (err) {
      toast.error(`Failed to delete brand: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddClick = () => {
    setEditingBrand(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (brand) => {
    setEditingBrand(brand);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Brands" subtitle={`${brands.length} brands`}>
        <Button variant="primary" onClick={handleAddClick}>
          <Plus size={16} strokeWidth={2.5} /> Add Brand
        </Button>
      </PageHeader>

      {loading ? (
        <Card><Loader text="Loading brands…" /></Card>
      ) : brands.length === 0 ? (
        <Card><EmptyState icon={Tag} title="No brands yet" message="Add your first brand so products can be filtered by it." action="Add Brand" onAction={handleAddClick} /></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-5">
          {brands.map((b, i) => (
            <div
              key={b.id}
              onClick={() => handleEditClick(b)}
              className="bg-white rounded-2xl shadow-card p-4 animate-fade-up opacity-0-init hover:shadow-card-hover transition-shadow cursor-pointer group"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="w-full aspect-square rounded-xl bg-secondary-50 mb-3 overflow-hidden flex items-center justify-center">
                {/* An admin-uploaded logo (b.logoUrl, a live Firestore field) always
                    overrides the bundled default -- same priority as product/category
                    images -- so editing a brand's logo here actually shows up. */}
                {b.logoUrl
                  ? <img src={b.logoUrl} alt={b.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                  : brandLogos[b.name]
                  ? <img src={brandLogos[b.name]} alt={b.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                  : <Tag size={24} className="text-neutral-300" />
                }
              </div>
              <p className="font-bold text-primary-900 text-xs leading-snug text-center line-clamp-2">{b.name}</p>
              <div className="flex items-center justify-between mt-3">
                <Badge variant={b.isActive === false ? 'neutral' : 'success'}>
                  {b.isActive === false ? 'Hidden' : 'Active'}
                </Badge>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleEditClick(b); }} className="p-1.5 text-neutral-400 hover:text-primary-900 hover:bg-neutral-100 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingId(b.id); }} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBrand ? 'Edit Brand' : 'Add New Brand'}
      >
        <BrandForm
          brand={editingBrand}
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={performDelete}
        title="Delete Brand"
        message="Are you sure you want to delete this brand? Products already tagged with it will keep the reference but show no brand until reassigned."
      />
    </div>
  );
}
