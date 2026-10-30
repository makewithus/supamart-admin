import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Plus, Trash2, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImages } from '../services/storage';
import productImages from '../utils/productImages';

export default function ProductForm({ product, categories = [], brands = [], onSuccess, onCancel }) {
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    brandId: '',
    gstRate: '18%',
    lowStockAlert: '10',
    onSale: false,
    isMonthlyStockUp: false,
  });

  const [packSizes, setPackSizes] = useState([
    { id: 'pack-1', size: 'Standard Pack', mrp: '40', selling: '40', stock: '100', discountPercent: '', showDiscountTag: false },
  ]);

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        categoryId: product.categoryId || (categories[0]?.id || ''),
        brandId: product.brandId || '',
        gstRate: product.gstRate || '18%',
        lowStockAlert: String(product.lowStockThreshold || '10'),
        onSale: (product.onSale === true || product.isOnSale === true) && product.onSale !== false && product.isOnSale !== false,
        isMonthlyStockUp: Boolean(product.isMonthlyStockUp),
      });

      if (product.variants && product.variants.length > 0) {
        setPackSizes(
          product.variants.map((v, i) => {
            const mrp = Number(v.mrp || v.price || 10);
            const sell = Number(v.offerPrice || v.sellingPrice || v.price || 10);
            const autoDisc = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 0;
            const hasCustom = v.discountPercent !== undefined;
            const discVal = hasCustom ? String(v.discountPercent) : (autoDisc > 0 ? String(autoDisc) : '');
            const showTag = v.showDiscountTag !== false && (v.discountPercent !== 0);
            return {
              id: v.id || `pack-${i + 1}`,
              size: v.label || product.unit || 'Standard Pack',
              mrp: String(mrp),
              selling: String(sell),
              stock: String(v.stock ?? 100),
              discountPercent: discVal,
              showDiscountTag: showTag && Number(discVal) > 0,
            };
          })
        );
      } else {
        const mrp = Number(product.price || 10);
        const sell = Number(product.offerPrice || product.price || 10);
        const autoDisc = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 0;
        const discVal = product.discountPercent !== undefined ? String(product.discountPercent) : (autoDisc > 0 ? String(autoDisc) : '');
        setPackSizes([
          {
            id: 'pack-1',
            size: product.unit || 'Standard Pack',
            mrp: String(mrp),
            selling: String(sell),
            stock: String(product.stock ?? 100),
            discountPercent: discVal,
            showDiscountTag: product.showDiscountTag !== false && (product.discountPercent !== 0) && Number(discVal) > 0,
          },
        ]);
      }

      const rawImgs = (product.images || []).map((img) => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean);
      const cleaned = rawImgs.filter((img) => !img.includes('cloudinary.com/demo/'));
      setExistingImages(cleaned);
    } else {
      if (categories.length > 0) {
        setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
      }
    }
  }, [product, categories, isEdit]);

  const handleAddPackSize = () => {
    setPackSizes((prev) => [
      ...prev,
      {
        id: `pack-${Date.now()}`,
        size: '500 g',
        mrp: '50',
        selling: '50',
        stock: '100',
        discountPercent: '',
        showDiscountTag: false,
      },
    ]);
  };

  const handleUpdatePackSize = (index, field, value) => {
    setPackSizes((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'selling' && (item.mrp === item.selling || !item.mrp)) {
          updated.mrp = value;
        }

        const mrp = Number(field === 'mrp' ? value : updated.mrp) || 0;
        const sell = Number(field === 'selling' ? value : updated.selling) || 0;

        // If user manually edited the % tag:
        if (field === 'discountPercent') {
          const num = Number(value);
          if (value === '' || isNaN(num) || num <= 0) {
            updated.showDiscountTag = false;
            updated.discountPercent = value === '' ? '' : '0';
          } else {
            updated.showDiscountTag = true;
            if (mrp > 0 && num > 0 && num < 100) {
              const calculatedSell = Math.round(mrp * (1 - num / 100));
              updated.selling = String(calculatedSell);
            }
          }
        } else if (field === 'mrp' || field === 'selling') {
          if (updated.showDiscountTag !== false && mrp > sell) {
            updated.discountPercent = String(Math.round(((mrp - sell) / mrp) * 100));
            updated.showDiscountTag = true;
          } else if (mrp <= sell) {
            updated.discountPercent = '0';
            updated.showDiscountTag = false;
          }
        }

        return updated;
      })
    );
  };

  const handleToggleDiscountTag = (index) => {
    setPackSizes((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const mrp = Number(item.mrp) || 0;
        const sell = Number(item.selling) || 0;
        const currentlyActive = item.showDiscountTag && Number(item.discountPercent) > 0;
        if (currentlyActive) {
          // Remove % tag
          return {
            ...item,
            showDiscountTag: false,
            discountPercent: '0',
          };
        } else {
          // Add % tag
          const auto = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 10;
          let newSell = item.selling;
          if (mrp > 0 && sell >= mrp) {
            newSell = String(Math.round(mrp * 0.9));
          }
          return {
            ...item,
            showDiscountTag: true,
            discountPercent: String(auto > 0 ? auto : 10),
            selling: newSell,
          };
        }
      })
    );
  };

  const handleRemovePackSize = (index) => {
    if (packSizes.length <= 1) {
      toast.error('A product must have at least one pack size');
      return;
    }
    setPackSizes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setNewImages((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removePreview = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExisting = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Please enter product name');
    if (!formData.categoryId) return toast.error('Please select category');

    // Validate packs
    for (const p of packSizes) {
      if (!p.size.trim()) return toast.error('Pack size cannot be empty');
      const mrpNum = Number(p.mrp);
      const sellNum = Number(p.selling);
      if (isNaN(mrpNum) || mrpNum <= 0) return toast.error('MRP must be greater than 0');
      if (isNaN(sellNum) || sellNum <= 0) return toast.error('Selling price must be greater than 0');
    }
    if (packSizes.length === 0) return toast.error('Add at least one pack size');

    setLoading(true);
    try {
      let uploadedUrls = [];
      if (newImages.length > 0) {
        uploadedUrls = await uploadImages(newImages, 'products');
      }

      const allImages = [...existingImages.map((img) => (typeof img === 'string' ? img : img.url || img)), ...uploadedUrls];

      const builtVariants = packSizes.map((p, idx) => {
        const mrp = Number(p.mrp);
        const selling = Number(p.selling);
        const numDisc = Number(p.discountPercent);
        const hasCustomDisc = !isNaN(numDisc) && numDisc > 0;
        const showTag = p.showDiscountTag !== false && (hasCustomDisc || (p.discountPercent !== '0' && mrp > selling));
        const discountPercent = !showTag ? 0 : (hasCustomDisc ? numDisc : Math.round(((mrp - selling) / mrp) * 100));

        return {
          id: p.id || `var-${idx + 1}`,
          label: p.size.trim(),
          price: mrp,
          offerPrice: selling < mrp ? selling : null,
          mrp: mrp,
          sellingPrice: selling,
          discountPercent,
          showDiscountTag: showTag && discountPercent > 0,
          stock: Number(p.stock) || 0,
        };
      });
      const primaryPack = builtVariants[0];

      const totalStock = builtVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      const isAvailable = totalStock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK';
      const onSaleActive = Boolean(formData.onSale);
      const firstDiscountedPack = builtVariants.find((variant) => variant.offerPrice != null && variant.offerPrice < variant.price && variant.showDiscountTag);
      if (onSaleActive && !firstDiscountedPack) {
        toast.error('Set a discounted pack price before adding this product to Today’s Best Prices');
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        categoryId: formData.categoryId,
        brandId: formData.brandId || null,
        price: primaryPack.price || 10,
        offerPrice: onSaleActive ? primaryPack.offerPrice : null,
        discountPercent: onSaleActive ? (primaryPack.discountPercent || firstDiscountedPack.discountPercent) : 0,
        showDiscountTag: onSaleActive ? Boolean(firstDiscountedPack) : false,
        stock: totalStock,
        unit: primaryPack.label || '1 kg',
        availability: isAvailable,
        onSale: onSaleActive,
        isOnSale: onSaleActive,
        variants: builtVariants.map((v) => ({
          ...v,
          offerPrice: onSaleActive ? v.offerPrice : null,
          discountPercent: onSaleActive ? v.discountPercent : 0,
          showDiscountTag: onSaleActive ? v.showDiscountTag : false,
        })),
        images: allImages,
        gstRate: formData.gstRate,
        lowStockThreshold: Number(formData.lowStockAlert) || 10,
        isMonthlyStockUp: Boolean(formData.isMonthlyStockUp),
      };

      if (isEdit && product?.id) {
        await apiPut(`/products/${product.id}`, payload);
        toast.success('Product updated successfully!');
      } else {
        await apiPost('/products', payload);
        toast.success('Product saved successfully!');
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity animate-fade-in"
        onClick={onCancel}
      />

      {/* Slide-over Right Drawer */}
      <div className="relative w-full max-w-[620px] bg-white h-full shadow-2xl flex flex-col z-50 overflow-hidden animate-slide-in-right">
        {/* Header - permanently fixed at top of drawer */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
              title="Go back"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              {isEdit ? 'Edit product' : 'Add product'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body - scrollable with pinned footer */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1">
            {/* Photos */}
            <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Photos · square, at least 1000 x 1000 px, white background
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {/* Existing Images */}
              {existingImages.map((img, i) => {
                const src = typeof img === 'string' ? img : img.url;
                return (
                  <div key={i} className="relative w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-white p-1">
                    <img src={src} alt="Product" className="w-full h-full object-contain rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeExisting(i)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-xs hover:bg-red-700"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}

              {/* New Previews */}
              {previewUrls.map((url, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-white p-1">
                  <img src={url} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removePreview(i)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-xs hover:bg-red-700"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {/* Upload Button */}
              <label className="w-24 h-24 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 hover:bg-gray-100/60 flex flex-col items-center justify-center text-xs font-semibold text-gray-600 cursor-pointer transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <Plus size={18} className="text-gray-400 mb-0.5" />
                <span>Upload</span>
              </label>
            </div>
          </div>

          {/* Product name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Product name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Lux Sandal Rs10 MLP"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B] transition-all"
            />
          </div>

          {/* Category & Brand (2 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => {
                  const catId = e.target.value;
                  const selCat = categories.find((c) => c.id === catId);
                  setFormData((prev) => ({
                    ...prev,
                    categoryId: catId,
                    ...(selCat?.gstRate ? { gstRate: selCat.gstRate } : {}),
                  }));
                }}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Brand
              </label>
              <select
                value={formData.brandId}
                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B]"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pack sizes Table */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Pack sizes
            </label>
            <div className="border border-gray-200 rounded-xl overflow-x-auto divide-y divide-gray-100">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-12 bg-gray-50/80 px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider items-center">
                  <div className="col-span-3">SIZE</div>
                  <div className="col-span-2 text-center">MRP ₹</div>
                  <div className="col-span-2 text-center">SELLING ₹</div>
                  <div className="col-span-2 text-center">% TAG</div>
                  <div className="col-span-2 text-center">STOCK</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="divide-y divide-gray-100 p-2 space-y-2">
                  {packSizes.map((pack, i) => {
                    const mrpVal = Number(pack.mrp) || 0;
                    const sellVal = Number(pack.selling) || 0;
                    const hasPriceError = mrpVal > 0 && sellVal > mrpVal;
                    const hasStandardPackWarning = pack.size.toLowerCase().includes('standard pack');
                    const hasActiveTag = pack.showDiscountTag && Number(pack.discountPercent) > 0;

                    return (
                      <div key={pack.id || i} className="space-y-1.5 pt-1">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={pack.size}
                              onChange={(e) => handleUpdatePackSize(i, 'size', e.target.value)}
                              placeholder="e.g. 500 g"
                              className="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#0E6C3B]"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={pack.mrp}
                              onChange={(e) => handleUpdatePackSize(i, 'mrp', e.target.value)}
                              placeholder="10"
                              className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-center text-gray-900 focus:outline-none focus:border-[#0E6C3B]"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={pack.selling}
                              onChange={(e) => handleUpdatePackSize(i, 'selling', e.target.value)}
                              placeholder="40"
                              className={`w-full rounded-xl px-2 py-1.5 text-xs text-center text-gray-900 focus:outline-none ${
                                hasPriceError
                                  ? 'border-2 border-red-500'
                                  : 'border border-gray-200 focus:border-[#0E6C3B]'
                              }`}
                            />
                          </div>
                          <div className="col-span-2 flex items-center">
                            <div className="relative w-full">
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={pack.discountPercent ?? ''}
                                onChange={(e) => handleUpdatePackSize(i, 'discountPercent', e.target.value)}
                                placeholder="0"
                                className={`w-full border rounded-xl pl-1 pr-3.5 py-1.5 text-xs text-center text-gray-900 focus:outline-none ${
                                  hasActiveTag
                                    ? 'border-green-300 bg-green-50/40 text-[#0E6C3B] font-bold focus:border-[#0E6C3B]'
                                    : 'border-gray-200 text-gray-500 focus:border-[#0E6C3B]'
                                }`}
                                title="Discount % tag (0 or blank to remove tag)"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={pack.stock}
                              onChange={(e) => handleUpdatePackSize(i, 'stock', e.target.value)}
                              placeholder="100"
                              className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-center text-gray-900 focus:outline-none focus:border-[#0E6C3B]"
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            {packSizes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePackSize(i)}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Delete pack"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* % Tag Toggle / Quick Controls */}
                        <div className="flex items-center justify-between px-1 text-[11px]">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleDiscountTag(i)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                hasActiveTag
                                  ? 'bg-green-100 text-green-800 hover:bg-red-50 hover:text-red-700'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              title={hasActiveTag ? 'Click to remove % tag' : 'Click to add % tag based on market prices'}
                            >
                              {hasActiveTag ? `Tag: ${pack.discountPercent}% OFF (Click to remove)` : '+ Add % tag'}
                            </button>
                            {hasActiveTag && (
                              <span className="text-[10px] text-gray-400">
                                Customer badge: "{pack.discountPercent}% OFF"
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Warnings / Errors */}
                        {hasPriceError && (
                          <p className="text-[11px] font-medium text-[#E03137]">
                            Selling price ₹{pack.selling} is above the MRP of ₹{pack.mrp}. You can't sell above MRP.
                          </p>
                        )}
                        {hasStandardPackWarning && (
                          <p className="text-[11px] font-medium text-[#E03137]">
                            "Standard Pack" doesn't tell customers the size. Enter it, like 4 × 100 g.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddPackSize}
              className="mt-2 text-xs font-bold text-gray-800 hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Add pack size
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Shown on the product page"
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B]"
            />
          </div>

          {/* GST rate & Low-stock alert at (2 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                GST rate
              </label>
              <select
                value={formData.gstRate}
                onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B]"
              >
                <option value="0%">0%</option>
                <option value="5%">5%</option>
                <option value="12%">12%</option>
                <option value="18%">18%</option>
                <option value="28%">28%</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Low-stock alert at
              </label>
              <input
                type="number"
                value={formData.lowStockAlert}
                onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                placeholder="10"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0E6C3B]/20 focus:border-[#0E6C3B]"
              />
            </div>
          </div>

          {/* On sale in the app checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="onSaleCheckbox"
              checked={formData.onSale}
              onChange={(e) => setFormData({ ...formData, onSale: e.target.checked })}
              className="w-4 h-4 text-[#0E6C3B] rounded border-gray-300 focus:ring-[#0E6C3B]"
            />
            <label htmlFor="onSaleCheckbox" className="text-xs sm:text-sm font-semibold text-gray-900 cursor-pointer">
              On sale in the app
            </label>
          </div>

          {/* Include in Monthly Stock Up checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="monthlyStockUpCheckbox"
              checked={formData.isMonthlyStockUp}
              onChange={(e) => setFormData({ ...formData, isMonthlyStockUp: e.target.checked })}
              className="w-4 h-4 text-[#0E6C3B] rounded border-gray-300 focus:ring-[#0E6C3B]"
            />
            <label htmlFor="monthlyStockUpCheckbox" className="text-xs sm:text-sm font-semibold text-gray-900 cursor-pointer">
              Include in Monthly Stock Up screen
            </label>
          </div>

          </div>

          {/* Action buttons - pinned at the bottom of the drawer */}
          <div className="sticky bottom-0 bg-white p-4 sm:p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-all shadow-2xs cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0E6C3B] hover:bg-[#09522C] text-white font-bold text-xs sm:text-sm shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Save product' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
