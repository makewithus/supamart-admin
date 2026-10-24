import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import BrandForm from '../components/BrandForm';
import { apiDel } from '../services/api';
import toast from 'react-hot-toast';
import brandLogos from '../utils/brandLogos';
import productImages from '../utils/productImages';

// Curated pastel color combinations for brands without an image
const PASTEL_PALETTE = [
  { bg: 'bg-[#e6f4ea]', text: 'text-[#137333]' }, // mint green
  { bg: 'bg-[#fef7e0]', text: 'text-[#b06000]' }, // warm amber
  { bg: 'bg-[#e8f0fe]', text: 'text-[#1a73e8]' }, // soft blue
  { bg: 'bg-[#fce8e6]', text: 'text-[#c5221f]' }, // soft rose
  { bg: 'bg-[#feefe3]', text: 'text-[#c26401]' }, // soft peach
];

function getBrandInitial(name = '') {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (trimmed[0] || 'B').toUpperCase();
}

function getBrandColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[idx];
}

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);

  // Subscribe to brands
  useEffect(() => {
    const q = query(collection(db, 'brands'), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBrands(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error('Failed to load brands');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to products to compute real product counts and resolve system product images
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Compute product counts and map first available product image per brand
  const { productCountByBrand, productImageByBrand } = useMemo(() => {
    const countMap = {};
    const imgMap = {};

    products.forEach((p) => {
      const bKey = p.brand || p.brandName || p.brandId;
      if (bKey) {
        countMap[bKey] = (countMap[bKey] || 0) + 1;

        if (!imgMap[bKey]) {
          const pImgs = Array.isArray(p.images) ? p.images : [];
          const validImg = pImgs.find((img) => {
            const u = typeof img === 'string' ? img : img?.url;
            return u && !u.includes('cloudinary.com/demo/');
          });
          const resolved = (typeof validImg === 'string' ? validImg : validImg?.url) || productImages[p.name];
          if (resolved) {
            imgMap[bKey] = resolved;
          }
        }
      }
    });

    return { productCountByBrand: countMap, productImageByBrand: imgMap };
  }, [products]);

  const filtered = useMemo(() => {
    return brands.filter(
      (b) => !search || b.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [brands, search]);

  const performDelete = async (brandId) => {
    if (!brandId) return;
    await apiDel(`/brands/${brandId}`);
    toast.success('Brand deleted successfully');
  };

  const handleAddClick = () => {
    setEditingBrand(null);
    setIsDrawerOpen(true);
  };

  const handleEditClick = (brand) => {
    setEditingBrand(brand);
    setIsDrawerOpen(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 w-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Brands</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {brands.length} brands · click any brand to edit details or select product images
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 sm:w-60 pl-9 pr-3.5 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0a7c47] focus:border-[#0a7c47] shadow-2xs"
            />
          </div>
          {/* Add brand button */}
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0a7c47] hover:bg-[#086338] text-white text-sm font-semibold rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add brand</span>
          </button>
        </div>
      </div>

      {/* Brands Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/90 p-12 text-center text-sm text-gray-500 shadow-2xs">
          {search ? 'No brands match your search.' : 'No brands created yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filtered.map((b) => {
            const initial = getBrandInitial(b.name);
            const color = getBrandColor(b.name);
            const count =
              productCountByBrand[b.id] ||
              productCountByBrand[b.name] ||
              b.productCount ||
              0;

            // Resolve brand image from:
            // 1. Explicit brand logoUrl
            // 2. Bundled brand logos
            // 3. System product images linked to this brand
            const brandImg =
              b.logoUrl ||
              brandLogos[b.name] ||
              productImageByBrand[b.name] ||
              productImageByBrand[b.id] ||
              null;

            return (
              <div
                key={b.id}
                onClick={() => handleEditClick(b)}
                className="bg-white rounded-xl border border-gray-200/90 p-3.5 flex items-center gap-3 shadow-2xs hover:border-[#0a7c47]/50 hover:shadow-xs transition-all cursor-pointer group"
              >
                {/* Brand / Product Image Tile */}
                {brandImg ? (
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center shrink-0 p-1 shadow-2xs group-hover:border-[#0a7c47]/30 transition-all">
                    <img
                      src={brandImg}
                      alt={b.name}
                      className="w-full h-full object-contain rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className={`w-full h-full items-center justify-center font-bold text-xs rounded-lg ${color.bg} ${color.text}`}
                    >
                      {initial}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${color.bg} ${color.text} shadow-2xs`}
                  >
                    {initial}
                  </div>
                )}

                {/* Name & Count */}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 text-sm truncate leading-snug group-hover:text-[#0a7c47] transition-colors">
                    {b.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                    {count} {count === 1 ? 'product' : 'products'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Right Drawer for Brand Add/Edit (Same pattern as ProductForm) */}
      {isDrawerOpen && (
        <BrandForm
          brand={editingBrand}
          products={products}
          onSuccess={() => setIsDrawerOpen(false)}
          onCancel={() => setIsDrawerOpen(false)}
          onDelete={performDelete}
        />
      )}
    </div>
  );
}
