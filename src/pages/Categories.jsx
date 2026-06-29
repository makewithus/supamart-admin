import React, { useState, useEffect } from 'react';
import { Layers, Plus, Image, Edit2, Trash2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CategoryForm from '../components/CategoryForm';
import { onSnapshot } from 'firebase/firestore';
import { apiDel } from '../services/api';
import toast from 'react-hot-toast';

export default function Categories() {
  const [cats, setCats]       = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Failed to load categories');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const performDelete = async () => {
    if (!deletingId) return;
    try {
      await apiDel(`/categories/${deletingId}`);
      toast.success('Category deleted successfully.');
    } catch (err) {
      toast.error(`Failed to delete category: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddClick = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (category, e) => {
    if (e) e.stopPropagation();
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Categories" subtitle={`${cats.length} categories`}>
        <Button variant="primary" onClick={handleAddClick}>
          <Plus size={16} strokeWidth={2.5} /> Add Category
        </Button>
      </PageHeader>

      {loading ? (
        <Card><Loader text="Loading categories…" /></Card>
      ) : cats.length === 0 ? (
        <Card><EmptyState icon={Layers} title="No categories yet" message="Create your first category to organise products." action="Add Category" onAction={handleAddClick} /></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {cats.map((c, i) => (
            <div
              key={c.id}
              onClick={() => handleEditClick(c)}
              className="bg-white rounded-2xl shadow-card p-5 animate-fade-up opacity-0-init hover:shadow-card-hover transition-shadow cursor-pointer group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="w-full aspect-square rounded-xl bg-secondary-50 mb-4 overflow-hidden flex items-center justify-center">
                {c.image
                  ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                  : <Image size={28} className="text-neutral-300" />
                }
              </div>
              <p className="font-bold text-primary-900 text-sm leading-snug">{c.name}</p>
              {c.description && (
                <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{c.description}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <Badge variant={c.isActive === false ? 'neutral' : 'success'}>
                  {c.isActive === false ? 'Hidden' : 'Active'}
                </Badge>
                <div className="flex items-center gap-1">
                  <Badge variant="neutral">#{c.order ?? c.sortOrder ?? i + 1}</Badge>
                  <button onClick={(e) => { e.stopPropagation(); handleEditClick(c); }} className="p-1.5 text-neutral-400 hover:text-primary-900 hover:bg-neutral-100 rounded-lg transition-colors ml-1">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingId(c.id); }} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
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
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
      >
        <CategoryForm 
          category={editingCategory} 
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={performDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category? This action cannot be undone."
      />
    </div>
  );
}
