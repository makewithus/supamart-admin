import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  Upload,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  PackageCheck,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPost, apiPut, apiDel } from '../services/api';
import { uploadImage } from '../services/storage';
import brandLogos from '../utils/brandLogos';
import productImages from '../utils/productImages';

export default function BrandForm({
  brand,
  products = [],
  onSuccess,
  onCancel,
  onDelete
}) {
  const isEdit = !!brand;

  const [formData, setFormData] = useState({
    name: '',
    order: '',
    isActive: true,
  });

  const [existingLogo, setExistingLogo] = useState(null);
  const [newLogo, setNewLogo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showProductImagePicker, setShowProductImagePicker] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name: brand.name || '',
        order: brand.order !== undefined ? String(brand.order) : '0',
        isActive: brand.isActive !== false,
      });
      setExistingLogo(brand.logoUrl || null);
    } else {
      setFormData({
        name: '',
        order: '0',
        isActive: true,
      });
      setExistingLogo(null);
    }
    setNewLogo(null);
    setPreviewUrl(null);
  }, [brand, isEdit]);

  // Find all available product images in the system associated with this brand or general catalog
  const availableProductImages = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. First priority: products matching this exact brand
    const matchingProducts = products.filter((p) => {
      const bName = p.brand || p.brandName || p.brandId;
      return bName && formData.name && bName.toLowerCase() === formData.name.toLowerCase();
    });

    matchingProducts.forEach((p) => {
      const pImgs = Array.isArray(p.images) ? p.images : [];
      pImgs.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && !u.includes('cloudinary.com/demo/') && !seen.has(u)) {
          seen.add(u);
          list.push({ url: u, productName: p.name, isMatch: true });
        }
      });
      if (productImages[p.name] && !seen.has(productImages[p.name])) {
        seen.add(productImages[p.name]);
        list.push({ url: productImages[p.name], productName: p.name, isMatch: true });
      }
    });

    // 2. Second priority: bundled logo if available
    const bundled = brandLogos[formData.name];
    if (bundled && !seen.has(bundled)) {
      seen.add(bundled);
      list.push({ url: bundled, productName: `${formData.name} Official Logo`, isMatch: true });
    }

    // 3. Other catalog product images
    products.slice(0, 30).forEach((p) => {
      const pImgs = Array.isArray(p.images) ? p.images : [];
      pImgs.forEach((img) => {
        const u = typeof img === 'string' ? img : img?.url;
        if (u && !u.includes('cloudinary.com/demo/') && !seen.has(u)) {
          seen.add(u);
          list.push({ url: u, productName: p.name, isMatch: false });
        }
      });
    });

    return list;
  }, [products, formData.name]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setExistingLogo(null);
    setNewLogo(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const selectProductImage = (url) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setNewLogo(null);
    setPreviewUrl(null);
    setExistingLogo(url);
    toast.success('Selected system image for brand');
  };

  const removeLogo = () => {
    setNewLogo(null);
    setExistingLogo(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) return toast.error('Brand name is required');

    setLoading(true);

    try {
      let logoUrl = existingLogo || '';
      if (newLogo) {
        logoUrl = await uploadImage(newLogo, 'brands');
      }

      const payload = {
        name: trimmedName,
        logoUrl: logoUrl || null,
        order: Number(formData.order) || 0,
        isActive: formData.isActive,
      };

      if (isEdit) {
        await apiPut(`/brands/${brand.id}`, payload);
        toast.success(`Brand "${trimmedName}" updated successfully`);
      } else {
        await apiPost('/brands', payload);
        toast.success(`Brand "${trimmedName}" created successfully`);
      }

      onSuccess();
    } catch (err) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!brand?.id) return;
    setDeleting(true);
    try {
      if (onDelete) {
        await onDelete(brand.id);
      } else {
        await apiDel(`/brands/${brand.id}`);
        toast.success('Brand deleted successfully');
      }
      onSuccess();
    } catch (err) {
      toast.error(`Failed to delete brand: ${err.message}`);
    } finally {
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const bundledLogo = brandLogos[formData.name];
  const displayedLogo = previewUrl || existingLogo || bundledLogo;

  // Products belonging to this brand
  const linkedProducts = useMemo(() => {
    if (!brand) return [];
    return products.filter((p) => {
      const b = p.brand || p.brandName || p.brandId;
      return b && (b === brand.id || b === brand.name);
    });
  }, [products, brand]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity animate-fade-in"
        onClick={onCancel}
      />

      {/* Slide-over Right Drawer */}
      <div className="relative w-full max-w-[580px] bg-white h-full shadow-2xl flex flex-col z-50 overflow-hidden animate-slide-in-right">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 bg-white shrink-0">
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
              {isEdit ? 'Edit brand' : 'Add brand'}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-6 space-y-6 flex-1">
            {/* Brand Logo & Product Image Section */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Brand Logo & Product Image
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Upload a brand logo or choose an existing product image available in the system.
              </p>

              <div className="flex items-start gap-4">
                {/* Primary Logo Tile */}
                <label
                  className="relative w-28 h-28 rounded-2xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 hover:border-[#0a7c47] cursor-pointer group flex items-center justify-center shrink-0 p-2 transition-all shadow-2xs"
                  title="Click to upload custom logo file"
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  {displayedLogo ? (
                    <img
                      src={displayedLogo}
                      className="w-full h-full object-contain"
                      alt={formData.name || 'Brand'}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 group-hover:text-[#0a7c47] transition-colors">
                      <ImageIcon size={26} strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold mt-1.5">No image</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1 rounded-2xl">
                    <Upload size={16} />
                    <span>{displayedLogo ? 'Change' : 'Upload'}</span>
                  </div>
                </label>

                {/* Info & Options */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer shadow-2xs transition-colors">
                      <Upload size={14} />
                      <span>Upload from device</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </label>

                    {(existingLogo || previewUrl) && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X size={14} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Square PNG, WEBP or JPG. Recommended: 500 × 500 px with transparent or white background.
                  </p>
                </div>
              </div>

              {/* System Product Images Carousel / Selector */}
              {availableProductImages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#0a7c47]" />
                      <span>Use product image from system</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowProductImagePicker(!showProductImagePicker)}
                      className="text-[11px] font-semibold text-[#0a7c47] hover:underline"
                    >
                      {showProductImagePicker ? 'Hide options' : `Show all (${availableProductImages.length})`}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {(showProductImagePicker
                      ? availableProductImages
                      : availableProductImages.slice(0, 6)
                    ).map((item, idx) => {
                      const isSelected = displayedLogo === item.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectProductImage(item.url)}
                          className={`relative w-14 h-14 rounded-xl border p-1 bg-white hover:border-[#0a7c47] transition-all flex items-center justify-center shrink-0 group ${
                            isSelected
                              ? 'border-2 border-[#0a7c47] ring-2 ring-[#0a7c47]/20 shadow-xs'
                              : 'border-gray-200'
                          }`}
                          title={`Use "${item.productName}" image`}
                        >
                          <img
                            src={item.url}
                            alt={item.productName}
                            className="w-full h-full object-contain rounded-lg"
                          />
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0a7c47] text-white flex items-center justify-center shadow-xs">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Brand Name Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Brand Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dove, Britannia, Fortune"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a7c47]/20 focus:border-[#0a7c47] transition-all"
              />
            </div>

            {/* Display Order & Active Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Display Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0a7c47]/20 focus:border-[#0a7c47] transition-all"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Lower numbers appear first in the customer app
                </span>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Active in App
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formData.isActive ? 'bg-[#0a7c47]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.isActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-semibold text-gray-700">
                    {formData.isActive ? 'Visible to customers' : 'Hidden from catalogue'}
                  </span>
                </div>
              </div>
            </div>

            {/* Linked Products Section (when editing) */}
            {isEdit && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <PackageCheck size={15} className="text-[#0a7c47]" />
                    <span>Linked Products</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-gray-700 border border-gray-200">
                    {linkedProducts.length} items
                  </span>
                </div>

                {linkedProducts.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No products currently assigned to this brand.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1">
                    {linkedProducts.slice(0, 8).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-gray-100"
                      >
                        <span className="font-medium text-gray-800 truncate mr-2">
                          {p.name}
                        </span>
                        <span className="text-gray-400 shrink-0">{p.unit || ''}</span>
                      </div>
                    ))}
                    {linkedProducts.length > 8 && (
                      <p className="text-[11px] text-gray-400 text-center pt-1">
                        + {linkedProducts.length - 8} more products
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delete Brand Section (Full CRUD Delete) */}
            {isEdit && (
              <div className="pt-4 border-t border-gray-100">
                {!showConfirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Delete this brand</span>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
                    <p className="text-xs font-semibold text-red-900">
                      Are you sure you want to delete "{formData.name}"?
                    </p>
                    <p className="text-[11px] text-red-700">
                      Linked products will remain in your catalog without a brand tag.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(false)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="p-5 border-t border-gray-100 bg-white shrink-0 flex items-center justify-end gap-3 shadow-sm">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#0a7c47] hover:bg-[#086338] text-white text-xs sm:text-sm font-bold transition-colors shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{isEdit ? 'Save brand' : 'Create brand'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
