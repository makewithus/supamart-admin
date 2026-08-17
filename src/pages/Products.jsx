import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Image, Edit2, Trash2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import productImages from '../utils/productImages';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import ConfirmModal from '../components/ui/ConfirmModal';
import ProductForm from '../components/ProductForm';
import { onSnapshot } from 'firebase/firestore';
import { apiDel } from '../services/api';
import toast from 'react-hot-toast';
import { optimizeCloudinaryUrl } from '../utils/cloudinaryImage';

const AVAIL_BADGE = {
  AVAILABLE:    { label: 'Available',    v: 'success'  },
  OUT_OF_STOCK: { label: 'Out of Stock', v: 'error'    },
  UNAVAILABLE:  { label: 'Unavailable',  v: 'neutral'  },
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // full docs, so ProductForm can render hierarchy
  const [brands, setBrands] = useState([]);
  const [search, setSearch]     = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [availFilter, setAvailFilter] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 25;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Memoized so typing in the search box (which re-renders this component on every
  // keystroke) doesn't rebuild these lookup maps from scratch each time — only
  // recomputed when the underlying categories/brands listeners actually push new data.
  const categoryNameById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const brandNameById = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])),
    [brands]
  );

  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubBrands = onSnapshot(collection(db, 'brands'), (snap) => {
      setBrands(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProds = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Failed to load products');
      setLoading(false);
    });

    return () => {
      unsubCats();
      unsubBrands();
      unsubProds();
    };
  }, []);

  const performDelete = async () => {
    if (!deletingId) return;
    try {
      await apiDel(`/products/${deletingId}`);
      toast.success('Product deleted successfully.');
    } catch (err) {
      toast.error(`Failed to delete product: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const stockOf = (p) => (p.variants || []).reduce((s, v) => s + (v.stock || 0), 0);

  const filtered = useMemo(
    () => products.filter((p) => {
      if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
      if (brandFilter !== 'ALL' && p.brandId !== brandFilter) return false;
      if (availFilter !== 'ALL' && p.availability !== availFilter) return false;
      if (lowStockOnly && stockOf(p) > 10) return false;
      return true;
    }),
    [products, search, categoryFilter, brandFilter, availFilter, lowStockOnly]
  );

  const hasActiveFilters = search !== '' || categoryFilter !== 'ALL' || brandFilter !== 'ALL' || availFilter !== 'ALL' || lowStockOnly;
  const clearFilters = () => {
    setSearch(''); setCategoryFilter('ALL'); setBrandFilter('ALL'); setAvailFilter('ALL'); setLowStockOnly(false);
  };

  // Client-side pagination — keeps the DOM (and the number of image requests)
  // bounded even with a few hundred products in the catalog.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE),
    [filtered, pageClamped]
  );

  // Any change to the result set resets to page 1.
  useEffect(() => { setPage(1); }, [search, categoryFilter, brandFilter, availFilter, lowStockOnly]);

  const minPrice = (p) => {
    const prices = (p.variants || []).map((v) => v.offerPrice ?? v.price).filter(Boolean);
    return prices.length ? `₹${Math.min(...prices)}` : '—';
  };

  const totalStock = stockOf;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Products" subtitle={`${products.length} items in catalog`}>
        <Button variant="primary" size="md" onClick={handleAddClick}>
          <Plus size={16} strokeWidth={2.5} /> Add Product
        </Button>
      </PageHeader>

      <Card>
        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-primary-900
                placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10 transition-all"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            className="w-44"
            options={[
              { value: 'ALL', label: 'All categories' },
              ...categories.filter((c) => !c.parentId).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            value={brandFilter}
            onChange={setBrandFilter}
            className="w-40"
            options={[
              { value: 'ALL', label: 'All brands' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Select
            value={availFilter}
            onChange={setAvailFilter}
            className="w-44"
            options={[
              { value: 'ALL', label: 'Any availability' },
              ...Object.entries(AVAIL_BADGE).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
          />
          <button
            onClick={() => setLowStockOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              lowStockOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Low stock (≤10)
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs font-semibold text-neutral-400 hover:text-primary-900 underline">
              Clear filters
            </button>
          )}
          <Badge variant="neutral">{filtered.length} of {products.length}</Badge>
        </div>

        {loading ? <Loader text="Loading products…" /> : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No products found" message={search ? 'Try a different search term.' : 'Add your first product to get started.'} action="Add Product" onAction={() => setIsModalOpen(true)} />
        ) : (
          <>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Product', 'Category', 'Brand', 'Price from', 'Stock', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => {
                  const s = AVAIL_BADGE[p.availability] || { label: p.availability || '—', v: 'neutral' };
                  // Real admin-uploaded photo (not the generic shared Cloudinary seed
                  // stock photo) wins over the bundled one — lets an admin swap in a
                  // real picture (e.g. new packaging) from ProductForm without a rebuild.
                  const rawImg = p.images?.[0]?.url || p.images?.[0];
                  const isGenericStock = rawImg && /res\.cloudinary\.com\/demo\//.test(rawImg);
                  const img = (rawImg && !isGenericStock) ? optimizeCloudinaryUrl(rawImg, 150) : (productImages[p.name] || null);
                  const stock = totalStock(p);
                  return (
                    <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {img
                              ? <img src={img} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                              : <Image size={20} className="text-neutral-300" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-primary-900 leading-snug">{p.name}</p>
                            <p className="text-xs text-neutral-400">{p.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-500">{categoryNameById[p.categoryId] || '—'}</td>
                      <td className="px-6 py-4 text-neutral-500">{brandNameById[p.brandId] || '—'}</td>
                      <td className="px-6 py-4 font-semibold text-primary-900">{minPrice(p)}</td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${stock === 0 ? 'text-red-500' : stock <= 10 ? 'text-amber-600' : 'text-primary-900'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-6 py-4"><Badge variant={s.v}>{s.label}</Badge></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleEditClick(p); }} className="p-2 text-neutral-400 hover:text-primary-900 hover:bg-neutral-100 rounded-lg transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeletingId(p.id); }} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-5 text-sm">
              <span className="text-neutral-400">
                Showing {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageClamped <= 1}
                  className="px-3 py-1.5 rounded-md border border-neutral-200 text-primary-900 font-medium
                    hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-neutral-500 px-1">Page {pageClamped} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageClamped >= totalPages}
                  className="px-3 py-1.5 rounded-md border border-neutral-200 text-primary-900 font-medium
                    hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        size="lg"
      >
        <ProductForm
          product={editingProduct}
          categories={categories}
          brands={brands}
          onSuccess={() => setIsModalOpen(false)}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={performDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
      />
    </div>
  );
}
