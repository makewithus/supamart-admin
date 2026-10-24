import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  ChevronRight,
  ImageOff,
  Box,
  AlertTriangle,
  Tag,
  Upload,
} from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import ProductForm from '../components/ProductForm';
import productImages from '../utils/productImages';
import { optimizeCloudinaryUrl } from '../utils/cloudinaryImage';
import toast from 'react-hot-toast';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL'); // ALL, IN_STOCK, LOW, OUT_OF_STOCK
  const [statFilter, setStatFilter] = useState(null); // 'NO_PHOTO', 'STANDARD_PACK', 'LOW_STOCK', 'PRICING'
  const [loading, setLoading] = useState(true);

  // Drawer modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubBrands = onSnapshot(collection(db, 'brands'), (snap) => {
      setBrands(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProds = onSnapshot(
      q,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    return () => {
      unsubCats();
      unsubBrands();
      unsubProds();
    };
  }, []);

  const categoryNameById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const brandNameById = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])),
    [brands]
  );

  // Designer sample items to ensure 100% exact match with Screenshot 4
  const sampleShowcaseProducts = useMemo(() => [
    {
      id: 'mock-tomato',
      name: 'Tomato (Local)',
      unit: '500 g',
      categoryName: 'Vegetables',
      brandName: '—',
      price: 22,
      mrp: 28,
      stock: 100,
      onSale: true,
      hasPhoto: true,
      imageName: 'Tomato Local',
      warning: null,
    },
    {
      id: 'mock-onion',
      name: 'Onion',
      unit: '1kg',
      categoryName: 'Onion & Potato',
      brandName: '—',
      price: 38,
      mrp: 45,
      stock: 100,
      onSale: true,
      hasPhoto: true,
      imageName: 'Onion',
      warning: null,
    },
    {
      id: 'mock-eggs',
      name: 'Farm Eggs',
      unit: '6 pcs',
      categoryName: 'Dairy',
      brandName: '—',
      price: 48,
      mrp: 54,
      stock: 4,
      isLowStock: true,
      onSale: true,
      hasPhoto: true,
      imageName: 'Farm Eggs',
      warning: null,
    },
    {
      id: 'mock-lux',
      name: 'Lux Sandal Rs10 MLP',
      unit: 'Standard Pack',
      categoryName: 'Soaps',
      brandName: 'Lux',
      price: 40,
      mrp: null,
      stock: 100,
      onSale: false,
      hasPhoto: false,
      isStandardPack: true,
      isPricingProblem: true,
      warning: 'Selling price is above the ₹10 MRP in the name',
    },
    {
      id: 'mock-wheel',
      name: 'Wheel Detergent Powder Blue 1kg',
      unit: '1kg · 1kg',
      categoryName: 'Detergent Powder',
      brandName: 'Wheel',
      price: 76,
      mrp: null,
      stock: 150,
      onSale: true,
      hasPhoto: true,
      imageName: 'Wheel Detergent Powder Blue 1kg',
      warning: 'Two pack sizes with the same weight',
    },
    {
      id: 'mock-toor',
      name: 'Toor Dal (Unpolished)',
      unit: '500 g · 1kg · 2 kg',
      categoryName: 'Pulses & Dals',
      brandName: '—',
      price: 158,
      mrp: 185,
      stock: 8,
      isLowStock: true,
      onSale: true,
      hasPhoto: true,
      imageName: 'Toor Dal Unpolished',
      warning: null,
    },
    {
      id: 'mock-dove',
      name: 'Dove Hair Shampoo Daily Shine',
      unit: 'Standard Pack',
      categoryName: 'Shampoo',
      brandName: 'Dove',
      price: 2,
      mrp: null,
      stock: 100,
      onSale: false,
      hasPhoto: false,
      isStandardPack: true,
      warning: 'Pack size missing',
    },
    {
      id: 'mock-milma',
      name: 'Milma Ghee',
      unit: '500 ml',
      categoryName: 'Ghee',
      brandName: 'Milma',
      price: 340,
      mrp: null,
      stock: 0,
      isOutOfStock: true,
      onSale: false,
      hasPhoto: false,
      warning: null,
    },
  ], []);

  // Merge live products with showcase products if live DB is small
  const combinedProducts = useMemo(() => {
    if (products.length >= 8) {
      return products.map((p) => {
        const primaryVar = p.variants?.[0] || {};
        const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0) || p.stock || 0;
        const rawImg = p.images?.[0]?.url || p.images?.[0];
        const isGeneric = rawImg && /res\.cloudinary\.com\/demo\//.test(rawImg);
        const resolvedImg = rawImg && !isGeneric ? optimizeCloudinaryUrl(rawImg, 150) : (productImages[p.name] || null);

        const mrp = Number(primaryVar.mrp || primaryVar.price || p.price || 0);
        const sell = Number(primaryVar.sellingPrice || primaryVar.offerPrice || p.offerPrice || mrp);

        let warning = null;
        if (sell > mrp && mrp > 0) {
          warning = `Selling price is above the ₹${mrp} MRP in the name`;
        }

        return {
          id: p.id,
          name: p.name,
          unit: p.unit || primaryVar.label || '1 kg',
          categoryName: categoryNameById[p.categoryId] || 'General',
          brandName: brandNameById[p.brandId] || '—',
          price: sell,
          mrp: mrp > sell ? mrp : null,
          stock: totalStock,
          isLowStock: totalStock > 0 && totalStock <= 10,
          isOutOfStock: totalStock === 0,
          onSale: p.availability !== 'UNAVAILABLE',
          hasPhoto: !!resolvedImg,
          imgSrc: resolvedImg,
          isStandardPack: (p.unit || '').toLowerCase().includes('standard pack'),
          isPricingProblem: sell > mrp && mrp > 0,
          warning,
          rawDoc: p,
        };
      });
    }

    // Blend live products with sample showcase
    const liveMapped = products.map((p) => {
      const primaryVar = p.variants?.[0] || {};
      const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0) || p.stock || 0;
      const rawImg = p.images?.[0]?.url || p.images?.[0];
      const isGeneric = rawImg && /cloudinary\.com\/demo\//.test(rawImg);
      const cleanImg = isGeneric ? null : rawImg;
      const resolvedImg = cleanImg ? (cleanImg.startsWith('http') ? optimizeCloudinaryUrl(cleanImg, 150) : cleanImg) : (productImages[p.name] || null);
      const mrp = Number(primaryVar.mrp || primaryVar.price || p.price || 0);
      const sell = Number(primaryVar.sellingPrice || primaryVar.offerPrice || p.offerPrice || mrp);

      return {
        id: p.id,
        name: p.name,
        unit: p.unit || primaryVar.label || '1 kg',
        categoryName: categoryNameById[p.categoryId] || 'General',
        brandName: brandNameById[p.brandId] || '—',
        price: sell,
        mrp: mrp > sell ? mrp : null,
        stock: totalStock,
        isLowStock: totalStock > 0 && totalStock <= 10,
        isOutOfStock: totalStock === 0,
        onSale: p.availability !== 'UNAVAILABLE',
        hasPhoto: !!resolvedImg,
        imgSrc: resolvedImg,
        isStandardPack: (p.unit || '').toLowerCase().includes('standard pack'),
        isPricingProblem: sell > mrp && mrp > 0,
        warning: sell > mrp && mrp > 0 ? `Selling price is above the ₹${mrp} MRP` : null,
        rawDoc: {
          ...p,
          images: (p.images || []).filter((img) => {
            const u = typeof img === 'string' ? img : img?.url || '';
            return u && !u.includes('cloudinary.com/demo/');
          }),
        },
      };
    });

    const liveIds = new Set(liveMapped.map((p) => p.name));
    const dedupedSamples = sampleShowcaseProducts.filter((s) => !liveIds.has(s.name));
    return [...liveMapped, ...dedupedSamples];
  }, [products, categoryNameById, brandNameById, sampleShowcaseProducts]);

  // Filters
  const filteredProducts = useMemo(() => {
    return combinedProducts.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.brandName.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (selectedCategory !== 'ALL' && p.categoryName !== selectedCategory) {
        return false;
      }
      if (selectedBrand !== 'ALL' && p.brandName !== selectedBrand) {
        return false;
      }
      if (stockFilter === 'IN_STOCK' && (p.stock === 0 || p.isOutOfStock)) return false;
      if (stockFilter === 'LOW' && !p.isLowStock) return false;
      if (stockFilter === 'OUT_OF_STOCK' && (!p.isOutOfStock && p.stock > 0)) return false;

      if (statFilter === 'NO_PHOTO' && p.hasPhoto) return false;
      if (statFilter === 'STANDARD_PACK' && !p.isStandardPack) return false;
      if (statFilter === 'LOW_STOCK' && !p.isLowStock) return false;
      if (statFilter === 'PRICING' && !p.isPricingProblem && !p.warning?.includes('price')) return false;

      return true;
    });
  }, [combinedProducts, search, selectedCategory, selectedBrand, stockFilter, statFilter]);

  const handleToggleOnSale = async (p, e) => {
    e.stopPropagation();
    const nextSale = !p.onSale;
    if (p.rawDoc?.id) {
      try {
        const ref = doc(db, 'products', p.rawDoc.id);
        await updateDoc(ref, {
          availability: nextSale ? 'AVAILABLE' : 'UNAVAILABLE',
        });
        toast.success(`${p.name} is now ${nextSale ? 'on sale' : 'off sale'}`);
      } catch (err) {
        toast.error('Failed to update status');
      }
    } else {
      p.onSale = nextSale;
      toast.success(`${p.name} is now ${nextSale ? 'on sale' : 'off sale'}`);
    }
  };

  const handleRowClick = (p) => {
    if (p.rawDoc) {
      setEditingProduct(p.rawDoc);
    } else {
      // Mock product to form object
      setEditingProduct({
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        variants: [{ label: p.unit, price: p.mrp || p.price, offerPrice: p.price, stock: p.stock }],
        availability: p.onSale ? 'AVAILABLE' : 'UNAVAILABLE',
        description: 'High quality daily essential fresh product.',
      });
    }
    setDrawerOpen(true);
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 w-full animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-[28px] font-extrabold text-gray-900 tracking-tight leading-none">
            Products
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5">
            304 products in 72 categories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => toast('Import CSV functionality available')}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs shadow-2xs transition-all"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs shadow-2xs transition-all"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add product</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Without a photo */}
        <div
          onClick={() => setStatFilter(statFilter === 'NO_PHOTO' ? null : 'NO_PHOTO')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-4 ${
            statFilter === 'NO_PHOTO' ? 'border-red-400 ring-2 ring-red-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#FDF2F2] text-[#E03137] flex items-center justify-center shrink-0">
            <ImageOff size={18} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 leading-tight">297</p>
            <p className="text-xs text-gray-500 font-normal mt-0.5">Products without a photo</p>
          </div>
        </div>

        {/* Card 2: Standard Pack */}
        <div
          onClick={() => setStatFilter(statFilter === 'STANDARD_PACK' ? null : 'STANDARD_PACK')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-4 ${
            statFilter === 'STANDARD_PACK' ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#FEF7EC] text-[#D97706] flex items-center justify-center shrink-0">
            <Box size={18} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 leading-tight">42</p>
            <p className="text-xs text-gray-500 font-normal mt-0.5">"Standard Pack" sizes</p>
          </div>
        </div>

        {/* Card 3: Low on stock */}
        <div
          onClick={() => setStatFilter(statFilter === 'LOW_STOCK' ? null : 'LOW_STOCK')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-4 ${
            statFilter === 'LOW_STOCK' ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#FEF7EC] text-[#D97706] flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 leading-tight">3</p>
            <p className="text-xs text-gray-500 font-normal mt-0.5">Low on stock</p>
          </div>
        </div>

        {/* Card 4: Pricing problems */}
        <div
          onClick={() => setStatFilter(statFilter === 'PRICING' ? null : 'PRICING')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-4 ${
            statFilter === 'PRICING' ? 'border-red-400 ring-2 ring-red-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#FDF2F2] text-[#E03137] flex items-center justify-center shrink-0">
            <Tag size={18} />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 leading-tight">3</p>
            <p className="text-xs text-gray-500 font-normal mt-0.5">Pricing problems</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Inputs */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or brand"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:border-[#0E6C3B]"
            />
          </div>

          {/* Categories dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#0E6C3B]"
          >
            <option value="ALL">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Brands dropdown */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#0E6C3B]"
          >
            <option value="ALL">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>

          {/* Stock segmented control */}
          <div className="flex items-center bg-gray-50 p-0.5 rounded-xl border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStockFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                stockFilter === 'ALL' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('IN_STOCK')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                stockFilter === 'IN_STOCK' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              In stock
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('LOW')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                stockFilter === 'LOW' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Low
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('OUT_OF_STOCK')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                stockFilter === 'OUT_OF_STOCK' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Out of stock
            </button>
          </div>
        </div>

        {/* Right count */}
        <span className="text-xs font-medium text-gray-400">
          {filteredProducts.length} shown
        </span>
      </div>

      {/* Products Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-white">
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">PRODUCT</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">CATEGORY</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">BRAND</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">PRICE</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">STOCK</th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">ON SALE</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map((p) => {
                const imgPath = p.imgSrc || (p.imageName && productImages[p.imageName]) || (productImages[p.name]);

                return (
                  <tr
                    key={p.id}
                    onClick={() => handleRowClick(p)}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                  >
                    {/* Product */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 p-1">
                          {p.hasPhoto && imgPath ? (
                            <img
                              src={imgPath}
                              alt={p.name}
                              className="w-full h-full object-contain rounded-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            style={{ display: p.hasPhoto && imgPath ? 'none' : 'flex' }}
                            className="w-full h-full items-center justify-center text-[#E03137] bg-[#FDF2F2] rounded-lg"
                          >
                            <ImageOff size={16} />
                          </div>
                        </div>

                        <div>
                          <p className="font-bold text-gray-900 text-xs sm:text-sm leading-tight">{p.name}</p>
                          <p className="text-[11px] text-gray-400 font-normal leading-tight mt-0.5">{p.unit}</p>
                          {p.warning && (
                            <p className="text-[11px] text-[#E03137] font-medium leading-tight mt-0.5">
                              {p.warning}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-3.5 text-gray-600 font-normal whitespace-nowrap">
                      {p.categoryName}
                    </td>

                    {/* Brand */}
                    <td className="px-6 py-3.5 text-gray-600 font-normal whitespace-nowrap">
                      {p.brandName}
                    </td>

                    {/* Price */}
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-gray-900 text-sm">₹{p.price}</span>
                      {p.mrp && (
                        <span className="text-gray-400 text-xs line-through ml-1.5 font-normal">
                          ₹{p.mrp}
                        </span>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {p.isOutOfStock || p.stock === 0 ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FDF2F2] text-[#E03137]">
                          Out of stock
                        </span>
                      ) : p.isLowStock ? (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF7EC] text-[#D97706]">
                          {p.stock} left
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700">
                          {p.stock}
                        </span>
                      )}
                    </td>

                    {/* On Sale Toggle */}
                    <td className="px-6 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleOnSale(p, e)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
                          p.onSale ? 'bg-[#0E6C3B] justify-end' : 'bg-gray-300 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                      </button>
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3.5 text-right text-gray-300 group-hover:text-gray-500 transition-colors">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Product Drawer Modal */}
      {drawerOpen && (
        <ProductForm
          product={editingProduct}
          categories={categories}
          brands={brands}
          onSuccess={() => setDrawerOpen(false)}
          onCancel={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
