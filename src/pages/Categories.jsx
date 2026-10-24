import React, { useState, useEffect, useMemo } from 'react';
import { Plus, GripVertical, Image as ImageIcon } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CategoryForm from '../components/CategoryForm';
import { apiDel } from '../services/api';
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

  // Subscribe to products to compute category product counts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
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
    <div className="p-6 lg:p-8 space-y-6 w-full animate-fade-in">
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

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
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
              {groups.map(({ parent, children }) => {
                const subNames = children.map((c) => c.name);
                let subText = 'No subcategories';
                if (subNames.length > 0) {
                  if (subNames.length <= 4) {
                    subText = subNames.join(', ');
                  } else {
                    subText = `${subNames.slice(0, 4).join(', ')} +${subNames.length - 4}`;
                  }
                }

                // Count products in parent category or any of its subcategories
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
                    {/* Drag Handle */}
                    <td className="w-10 px-4 py-4 text-gray-400 group-hover:text-gray-600">
                      <GripVertical size={16} className="cursor-grab" />
                    </td>

                    {/* Category Name */}
                    <td className="px-4 py-4 font-bold text-gray-900 text-sm whitespace-nowrap">
                      {parent.name}
                    </td>

                    {/* Subcategories */}
                    <td className="px-4 py-4 text-gray-500 text-sm">
                      {subText}
                    </td>

                    {/* Products count: red if <= 2 as shown in screenshot */}
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      <span className={count <= 2 ? 'text-red-600 font-bold' : 'text-gray-900 font-bold'}>
                        {count}
                      </span>
                    </td>

                    {/* Image Status Badge */}
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

                    {/* Visible in app Toggle */}
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
              })}
            </tbody>
          </table>
        </div>
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
