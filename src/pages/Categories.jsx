import React, { useState, useEffect, useMemo } from 'react';
import { Plus, GripVertical, Image as ImageIcon } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CategoryForm from '../components/CategoryForm';
import { apiDel, apiGet } from '../services/api';
import toast from 'react-hot-toast';

function groupHierarchically(cats) {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  const topLevel = cats.filter((c) => !c.parentId).sort(byOrder);
  const groups = topLevel.map((parent) => ({
    parent,
    children: cats.filter((c) => c.parentId === parent.id).sort(byOrder),
  }));
  return groups;
}

export default function Categories() {
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Subscribe to categories
  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
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

  // Fetch products from cached search API once on mount to compute category product counts
  useEffect(() => {
    let active = true;
    apiGet('/products/search?q=')
      .then((res) => {
        if (!active) return;
        const items = res?.items || [];
        setProducts(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Map category id to product count
  const productCountByCat = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      if (p.categoryId) map[p.categoryId] = (map[p.categoryId] || 0) + 1;
      if (p.subCategoryId) map[p.subCategoryId] = (map[p.subCategoryId] || 0) + 1;
    });
    return map;
  }, [products]);

  const groups = useMemo(() => groupHierarchically(cats), [cats]);
  const totalSubcategories = cats.filter((c) => c.parentId).length;

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

  const handleToggleVisible = async (cat, e) => {
    e.stopPropagation();
    const next = cat.isActive === false ? true : false;
    try {
      await updateDoc(doc(db, 'categories', cat.id), {
        isActive: next,
        updatedAt: Date.now(),
      });
      toast.success(`Category ${next ? 'visible' : 'hidden'} in app`);
    } catch (err) {
      toast.error('Failed to update visibility: ' + err.message);
    }
  };

  const handleAddClick = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {groups.length} main categories · {totalSubcategories} subcategories · drag to reorder how they appear in the app
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0a7c47] hover:bg-[#086338] text-white text-sm font-medium rounded-lg transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add category</span>
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-10 px-4 py-3.5"></th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">CATEGORY</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">SUBCATEGORIES</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">PRODUCTS</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">IMAGE</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">VISIBLE IN APP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-500 font-medium">
                    No categories found. Click "Add category" above to create one.
                  </td>
                </tr>
              ) : (
                groups.map(({ parent, children }) => {
                  const subNames = children.map((c) => c.name);
                  let subText = 'No subcategories';
                  if (subNames.length > 0) {
                    if (subNames.length <= 4) {
                      subText = subNames.join(', ');
                    } else {
                      subText = `${subNames.slice(0, 4).join(', ')} +${subNames.length - 4}`;
                    }
                  }

                  const count = (productCountByCat[parent.id] || 0) +
                    children.reduce((acc, c) => acc + (productCountByCat[c.id] || 0), 0);

                  const hasImage = !!parent.image;
                  const isVisible = parent.isActive !== false;

                  return (
                    <tr
                      key={parent.id}
                      onClick={() => handleEditClick(parent)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="w-10 px-4 py-4 text-gray-400 group-hover:text-gray-600">
                        <GripVertical size={16} className="cursor-grab" />
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-900 text-sm whitespace-nowrap">
                        {parent.name}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-sm">
                        {subText}
                      </td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap">
                        <span className={count <= 2 ? 'text-red-600 font-bold' : 'text-gray-900 font-bold'}>
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap">
                        {hasImage ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e6f4ea] text-[#137333]">
                            Image set
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fce8e6] text-[#c5221f]">
                            No image
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => handleToggleVisible(parent, e)}
                          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isVisible ? 'bg-[#0a7c47]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isVisible ? 'translate-x-3' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List (< md screens) */}
      <div className="block md:hidden space-y-3">
        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/90 p-8 text-center text-sm text-gray-500 font-medium">
            No categories found. Tap "Add category" above to create one.
          </div>
        ) : (
          groups.map(({ parent, children }) => {
            const subNames = children.map((c) => c.name);
            const count = (productCountByCat[parent.id] || 0) +
              children.reduce((acc, c) => acc + (productCountByCat[c.id] || 0), 0);
            const hasImage = !!parent.image;
            const isVisible = parent.isActive !== false;

            return (
              <div
                key={parent.id}
                onClick={() => handleEditClick(parent)}
                className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer active:bg-gray-50/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                      {parent.image ? (
                        <img src={parent.image} alt={parent.name} className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-gray-900 truncate">{parent.name}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[11px] font-bold ${count <= 2 ? 'text-red-600' : 'text-gray-500'}`}>
                          {count} {count === 1 ? 'product' : 'products'}
                        </span>
                        <span className="text-gray-300">·</span>
                        {hasImage ? (
                          <span className="text-[10px] font-semibold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.2 rounded">
                            Image
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[#c5221f] bg-[#fce8e6] px-1.5 py-0.2 rounded">
                            No image
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] font-medium text-gray-500">Live</span>
                    <button
                      type="button"
                      onClick={(e) => handleToggleVisible(parent, e)}
                      aria-label="Toggle visible in app"
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isVisible ? 'bg-[#0a7c47]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isVisible ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {subNames.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {subNames.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-gray-50 text-[11px] font-medium text-gray-600 border border-gray-200/60"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit/Add Modal */}
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

      {/* Confirm Delete */}
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
