import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Plus, Image, Edit2, Trash2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
import categoryImages from '../utils/categoryImages';
import subCategoryImages from '../utils/subCategoryImages';
import slugify from '../utils/slugify';
import { optimizeCloudinaryUrl } from '../utils/cloudinaryImage';

// Groups top-level categories together with their own sub-categories so the
// hierarchy is explicit in the DOM structure, not implied by grid ordering + an
// indent hack (which broke visually whenever a grid row wrapped).
function groupHierarchically(cats) {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  const topLevel = cats.filter((c) => !c.parentId).sort(byOrder);
  const groups = topLevel.map((parent) => ({
    parent,
    children: cats.filter((c) => c.parentId === parent.id).sort(byOrder),
  }));
  // Orphaned sub-categories (parentId pointing at a deleted/missing category) get their own group.
  const usedIds = new Set([
    ...topLevel.map((c) => c.id),
    ...groups.flatMap((g) => g.children.map((c) => c.id)),
  ]);
  const orphans = cats.filter((c) => !usedIds.has(c.id)).sort(byOrder);
  return { groups, orphans };
}

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

  const { groups, orphans } = useMemo(() => groupHierarchically(cats), [cats]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
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
        <div className="space-y-5">
          {groups.map(({ parent, children }, i) => (
            <Card key={parent.id} className="!p-4 sm:!p-5" style={{ animationDelay: `${i * 50}ms` }}>
              {/* Top-level category header */}
              <div
                onClick={() => handleEditClick(parent)}
                className="flex items-center gap-4 cursor-pointer group rounded-xl -m-1 p-1 hover:bg-neutral-50 transition-colors"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl bg-secondary-50 overflow-hidden flex items-center justify-center">
                  {/* An admin-uploaded photo (parent.image, a live Firestore field) always
                      overrides the bundled default -- otherwise editing a category's image
                      here would save successfully but silently never actually show up. */}
                  {parent.image
                    ? <img src={optimizeCloudinaryUrl(parent.image, 150)} alt={parent.name} loading="lazy" decoding="async" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    : categoryImages[slugify(parent.name)]
                    ? <img src={categoryImages[slugify(parent.name)]} alt={parent.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                    : <Image size={26} className="text-neutral-300" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-primary-900 text-sm sm:text-base leading-snug truncate">{parent.name}</p>
                  {parent.description && (
                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{parent.description}</p>
                  )}
                </div>
                <Badge variant={parent.isActive === false ? 'neutral' : 'success'}>
                  {parent.isActive === false ? 'Hidden' : 'Active'}
                </Badge>
                <div className="hidden sm:flex items-center gap-1">
                  <Badge variant="neutral">#{parent.order ?? i + 1}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleEditClick(parent); }} className="p-1.5 text-neutral-400 hover:text-primary-900 hover:bg-neutral-100 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeletingId(parent.id); }} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Sub-categories — wrapped chip row, always visually anchored under their parent */}
              {children.length > 0 && (
                <div className="mt-4 pt-4 border-t border-neutral-100 pl-0 sm:pl-[4.5rem] flex flex-wrap gap-2">
                  {children.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleEditClick(c)}
                      className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-100 hover:border-secondary-200 hover:bg-secondary-50/50 transition-colors cursor-pointer group/chip"
                    >
                      <div className="w-11 h-11 flex-shrink-0 rounded-lg bg-white overflow-hidden flex items-center justify-center">
                        {/* An admin-uploaded photo (c.image, a live Firestore field) always
                            overrides the bundled default -- otherwise editing a sub-category's
                            image here would save successfully but silently never show up. */}
                        {c.image
                          ? <img src={optimizeCloudinaryUrl(c.image, 150)} alt={c.name} loading="lazy" decoding="async" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                          : subCategoryImages[`${slugify(parent.name)}-${slugify(c.name)}`]
                          ? <img src={subCategoryImages[`${slugify(parent.name)}-${slugify(c.name)}`]} alt={c.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                          : <Image size={16} className="text-neutral-300" />
                        }
                      </div>
                      <span className="text-xs font-semibold text-primary-900 whitespace-nowrap">{c.name}</span>
                      {c.isActive === false && <Badge variant="neutral">Hidden</Badge>}
                      <button onClick={(e) => { e.stopPropagation(); setDeletingId(c.id); }} className="p-1 text-neutral-300 opacity-0 group-hover/chip:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-md transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}

          {orphans.length > 0 && (
            <Card>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Uncategorised sub-categories</p>
              <div className="flex flex-wrap gap-2">
                {orphans.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleEditClick(c)}
                    className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-neutral-50 border border-neutral-100 hover:border-secondary-200 cursor-pointer group/chip"
                  >
                    <span className="text-xs font-semibold text-primary-900 whitespace-nowrap">{c.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingId(c.id); }} className="p-1 text-neutral-300 opacity-0 group-hover/chip:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-md transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
      >
        <CategoryForm
          category={editingCategory}
          categories={cats}
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
