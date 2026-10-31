import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
import { collection, query, orderBy, getDocs, limit, onSnapshot } from 'firebase/firestore';
import ProductForm from '../components/ProductForm';
import productImages from '../utils/productImages';
import { optimizeCloudinaryUrl } from '../utils/cloudinaryImage';
import toast from 'react-hot-toast';
import { apiPatch, apiGet } from '../services/api';

export default function Products() {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL'); // ALL, IN_STOCK, LOW, OUT_OF_STOCK
  const [saleFilter, setSaleFilter] = useState('ALL'); // ALL, ON_SALE, OFF_SALE
  const [statFilter, setStatFilter] = useState(null); // 'NO_PHOTO', 'STANDARD_PACK', 'LOW_STOCK', 'PRICING'
  const [loading, setLoading] = useState(true);
  const productSnapshotReadyRef = useRef(false);

  // Drawer modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    if (location.state?.search) {
      setSearch(location.state.search);
    }
    if (location.state?.stockFilter) {
      setStockFilter(location.state.stockFilter);
    }
  }, [location.state]);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await apiGet('/admin/catalog');
      if (data) {
        if (data.categories) setCategories(data.categories);
        if (data.brands) setBrands(data.brands);
        if (data.products) setProducts(data.products);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('apiGet(/admin/catalog) fallback to getDocs:', err?.message || err);
    }

    // Fallback: load once from Firestore if API unavailable
    try {
      const [catSnap, brandSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'brands')),
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(100))),
      ]);
      setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setBrands(brandSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (!productSnapshotReadyRef.current) setProducts(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to load products from Firestore:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    const interval = setInterval(loadCatalog, 30000);
    return () => clearInterval(interval);
  }, [loadCatalog]);

  const categoryNameById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const brandNameById = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])),
    [brands]
  );

  // Map live products dynamically from Firestore
  const combinedProducts = useMemo(() => {
    return products.map((p) => {
      const primaryVar = p.variants?.[0] || {};
      const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0) || p.stock || 0;
      const rawImg = p.images?.[0]?.url || p.images?.[0];
      const isGeneric = rawImg && /cloudinary\.com\/demo\//.test(rawImg);
      const cleanImg = isGeneric ? null : rawImg;
      const resolvedImg = cleanImg ? (cleanImg.startsWith('http') ? optimizeCloudinaryUrl(cleanImg, 150) : cleanImg) : (productImages[p.name] || null);

      const mrp = Number(primaryVar.mrp || primaryVar.price || p.price || 0);
      const saleActive = (p.onSale === true || p.isOnSale === true) && p.onSale !== false && p.isOnSale !== false;
      const sell = saleActive
        ? Number(primaryVar.offerPrice || primaryVar.sellingPrice || p.offerPrice || mrp)
        : mrp;

      let warning = null;
      if (sell > mrp && mrp > 0) {
        warning = `Selling price is above the ₹${mrp} MRP`;
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
        isLowStock: totalStock > 0 && totalStock <= (p.lowStockThreshold || 10),
        isOutOfStock: totalStock === 0,
        onSale: (p.onSale === true || p.isOnSale === true) && p.onSale !== false && p.isOnSale !== false,
        discountPercent: primaryVar.discountPercent !== undefined
          ? primaryVar.discountPercent
          : (p.discountPercent !== undefined ? p.discountPercent : (mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 0)),
        showDiscountTag: primaryVar.showDiscountTag !== false && p.showDiscountTag !== false && (primaryVar.discountPercent !== 0) && (p.discountPercent !== 0),
        hasPhoto: !!resolvedImg,
        imgSrc: resolvedImg,
        isStandardPack: (p.unit || '').toLowerCase().includes('standard pack'),
        isPricingProblem: sell > mrp && mrp > 0,
        warning,
        rawDoc: p,
      };
    });
  }, [products, categoryNameById, brandNameById]);

  // Dynamic stat card counts
  const noPhotoCount = useMemo(() => combinedProducts.filter((p) => !p.hasPhoto).length, [combinedProducts]);
  const standardPackCount = useMemo(() => combinedProducts.filter((p) => p.isStandardPack).length, [combinedProducts]);
  const lowStockCount = useMemo(() => combinedProducts.filter((p) => p.isLowStock || p.isOutOfStock).length, [combinedProducts]);
  const pricingProblemCount = useMemo(() => combinedProducts.filter((p) => p.isPricingProblem).length, [combinedProducts]);

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
      if (stockFilter === 'LOW' && !p.isLowStock && !p.isOutOfStock) return false;
      if (stockFilter === 'OUT_OF_STOCK' && (!p.isOutOfStock && p.stock > 0)) return false;

      if (saleFilter === 'ON_SALE' && !p.onSale) return false;
      if (saleFilter === 'OFF_SALE' && p.onSale) return false;

      if (statFilter === 'NO_PHOTO' && p.hasPhoto) return false;
      if (statFilter === 'STANDARD_PACK' && !p.isStandardPack) return false;
      if (statFilter === 'LOW_STOCK' && !p.isLowStock && !p.isOutOfStock) return false;
      if (statFilter === 'PRICING' && !p.isPricingProblem && !p.warning?.includes('price')) return false;

      return true;
    });
  }, [combinedProducts, search, selectedCategory, selectedBrand, stockFilter, saleFilter, statFilter]);

  const handleToggleOnSale = async (p, e) => {
    e.stopPropagation();
    const nextSale = !p.onSale;
    const primaryVariant = p.rawDoc?.variants?.[0] || {};
    const primaryPrice = Number(primaryVariant.price ?? primaryVariant.mrp ?? p.rawDoc?.price ?? 0);
    const savedPrimaryOffer = Number(primaryVariant.offerPrice ?? primaryVariant.sellingPrice ?? p.rawDoc?.offerPrice ?? 0);
    const primaryOffer = savedPrimaryOffer > 0 && savedPrimaryOffer < primaryPrice ? savedPrimaryOffer : Number(p.rawDoc?.offerPrice ?? 0);
    const saleVariants = nextSale && Array.isArray(p.rawDoc?.variants)
      ? p.rawDoc.variants.map((variant) => {
          const price = Number(variant.price ?? variant.mrp ?? 0);
          const savedOffer = Number(variant.offerPrice ?? variant.sellingPrice ?? 0);
          const offerPrice = savedOffer > 0 && savedOffer < price ? savedOffer : null;
          const discountPercent = Number(variant.discountPercent) || (offerPrice ? Math.round((price - offerPrice) / price * 100) : 0);
          return {
            ...variant,
            offerPrice,
            discountPercent,
            showDiscountTag: Boolean(offerPrice && discountPercent > 0),
          };
        })
      : undefined;
    const primaryDiscount = Number(primaryVariant.discountPercent) || Number(p.rawDoc?.discountPercent) || (primaryPrice > primaryOffer && primaryPrice > 0 ? Math.round((primaryPrice - primaryOffer) / primaryPrice * 100) : 0);
    const firstDiscountedVariant = saleVariants?.find((variant) => variant.showDiscountTag);
    const nextShowDiscountTag = nextSale && (firstDiscountedVariant != null || (primaryOffer > 0 && primaryOffer < primaryPrice && primaryDiscount > 0));
    const nextDiscountPercent = nextSale
      ? (primaryOffer > 0 && primaryOffer < primaryPrice ? primaryDiscount : (firstDiscountedVariant?.discountPercent || primaryDiscount))
      : (p.rawDoc?.discountPercent ?? p.discountPercent ?? 0);
    const nextOfferPrice = p.rawDoc?.offerPrice ?? null;
    const restoredOfferPrice = primaryOffer > 0 && primaryOffer < primaryPrice ? primaryOffer : nextOfferPrice;
    const hasDiscountedPack = saleVariants
      ? saleVariants.some((variant) => variant.showDiscountTag)
      : primaryOffer > 0 && primaryOffer < primaryPrice && primaryDiscount > 0;
    if (nextSale && !hasDiscountedPack) {
      toast.error('Set a discounted pack price before enabling Today’s Best Prices');
      return;
    }

    setProducts((prev) =>
      prev.map((item) =>
        item.id === p.id
          ? {
              ...item,
              onSale: nextSale,
              isOnSale: nextSale,
              showDiscountTag: nextShowDiscountTag,
              discountPercent: nextDiscountPercent,
              offerPrice: nextSale ? restoredOfferPrice : nextOfferPrice,
              rawDoc: item.rawDoc
                ? {
                    ...item.rawDoc,
                    onSale: nextSale,
                    isOnSale: nextSale,
                    showDiscountTag: nextShowDiscountTag,
                    discountPercent: nextDiscountPercent,
                    offerPrice: nextSale ? restoredOfferPrice : nextOfferPrice,
                    ...(saleVariants ? { variants: saleVariants } : {}),
                  }
                : item.rawDoc,
            }
          : item
      )
    );
    try {
      const payload = {
        onSale: nextSale,
        isOnSale: nextSale,
        showDiscountTag: nextShowDiscountTag,
        discountPercent: nextDiscountPercent,
        offerPrice: nextSale ? restoredOfferPrice : nextOfferPrice,
        ...(saleVariants ? { variants: saleVariants } : {}),
      };
      await apiPatch(`/products/${p.id}/availability`, payload);
      toast.success(`${p.name} is now ${nextSale ? 'on sale' : 'off sale'}`);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
      loadCatalog();
    }
  };

  const handleRowClick = (p) => {
    setEditingProduct(p.rawDoc || p);
    setDrawerOpen(true);
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-gray-900 tracking-tight leading-none">
            Products
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-1.5">
            {products.length} products in {categories.length} categories
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add product</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Without a photo */}
        <div
          onClick={() => setStatFilter(statFilter === 'NO_PHOTO' ? null : 'NO_PHOTO')}
          className={`p-3 sm:p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-3 sm:gap-4 ${
            statFilter === 'NO_PHOTO' ? 'border-red-400 ring-2 ring-red-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FDF2F2] text-[#E03137] flex items-center justify-center shrink-0">
            <ImageOff size={17} />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{noPhotoCount}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 font-normal mt-0.5">Without photo</p>
          </div>
        </div>

        {/* Card 2: Standard Pack */}
        <div
          onClick={() => setStatFilter(statFilter === 'STANDARD_PACK' ? null : 'STANDARD_PACK')}
          className={`p-3 sm:p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-3 sm:gap-4 ${
            statFilter === 'STANDARD_PACK' ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FEF7EC] text-[#D97706] flex items-center justify-center shrink-0">
            <Box size={17} />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{standardPackCount}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 font-normal mt-0.5">Standard Pack</p>
          </div>
        </div>

        {/* Card 3: Low on stock */}
        <div
          onClick={() => setStatFilter(statFilter === 'LOW_STOCK' ? null : 'LOW_STOCK')}
          className={`p-3 sm:p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-3 sm:gap-4 ${
            statFilter === 'LOW_STOCK' ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FEF7EC] text-[#D97706] flex items-center justify-center shrink-0">
            <AlertTriangle size={17} />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{lowStockCount}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 font-normal mt-0.5">Low on stock</p>
          </div>
        </div>

        {/* Card 4: Pricing problems */}
        <div
          onClick={() => setStatFilter(statFilter === 'PRICING' ? null : 'PRICING')}
          className={`p-3 sm:p-4 rounded-2xl bg-white border cursor-pointer transition-all flex items-center gap-3 sm:gap-4 ${
            statFilter === 'PRICING' ? 'border-red-400 ring-2 ring-red-100 shadow-sm' : 'border-gray-100 shadow-2xs hover:border-gray-200'
          }`}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FDF2F2] text-[#E03137] flex items-center justify-center shrink-0">
            <Tag size={17} />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{pricingProblemCount}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 font-normal mt-0.5">Price issues</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Inputs */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
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
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#0E6C3B] flex-1 sm:flex-none"
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
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-[#0E6C3B] flex-1 sm:flex-none"
          >
            <option value="ALL">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>

          {/* Stock segmented control */}
          <div className="flex items-center bg-gray-50 p-0.5 rounded-xl border border-gray-200 text-xs font-semibold overflow-x-auto">
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
              Out
            </button>
          </div>

          {/* Sale status filter */}
          <div className="flex items-center bg-gray-50 p-0.5 rounded-xl border border-gray-200 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setSaleFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                saleFilter === 'ALL' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All status
            </button>
            <button
              type="button"
              onClick={() => setSaleFilter('ON_SALE')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                saleFilter === 'ON_SALE' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              On sale
            </button>
            <button
              type="button"
              onClick={() => setSaleFilter('OFF_SALE')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                saleFilter === 'OFF_SALE' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Off sale
            </button>
          </div>
        </div>

        {/* Right count */}
        <span className="text-xs font-medium text-gray-400">
          {filteredProducts.length} shown
        </span>
      </div>

      {/* Products Card Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        {/* Mobile Product Cards (< md screens) */}
        <div className="block md:hidden divide-y divide-gray-100">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 font-medium">
              No products found matching your search and filter criteria.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const imgPath = p.imgSrc || (p.imageName && productImages[p.imageName]) || (productImages[p.name]);

              return (
                <div
                  key={p.id}
                  onClick={() => handleRowClick(p)}
                  className="p-3.5 hover:bg-gray-50/70 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 p-1">
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

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-900 text-sm leading-tight truncate">{p.name}</p>
                        <div className="text-right shrink-0">
                          <span className="font-black text-gray-900 text-sm">₹{p.price}</span>
                          {p.showDiscountTag && p.discountPercent > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                              {p.discountPercent}% OFF
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{p.unit} · {p.categoryName}</p>
                      {p.warning && (
                        <p className="text-[11px] text-[#E03137] font-medium leading-tight mt-0.5">
                          {p.warning}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">Stock:</span>
                      {p.isOutOfStock || p.stock === 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FDF2F2] text-[#E03137]">
                          Out of stock
                        </span>
                      ) : p.isLowStock ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FEF7EC] text-[#D97706]">
                          {p.stock} left
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                          {p.stock} units
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-medium">On Sale:</span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleOnSale(p, e)}
                        className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
                          p.onSale ? 'bg-[#0E6C3B]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white shadow-2xs transform transition-transform duration-200 ease-in-out ${
                            p.onSale ? 'translate-x-3.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (>= md screens) */}
        <div className="hidden md:block overflow-x-auto">
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
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400 font-medium">
                    No products found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-sm">₹{p.price}</span>
                        {p.mrp && (
                          <span className="text-gray-400 text-xs line-through font-normal">
                            ₹{p.mrp}
                          </span>
                        )}
                        {p.showDiscountTag && p.discountPercent > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            {p.discountPercent}% OFF
                          </span>
                        )}
                      </div>
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
              }))}
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
          onSuccess={() => {
            setDrawerOpen(false);
            loadCatalog();
          }}
          onCancel={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
