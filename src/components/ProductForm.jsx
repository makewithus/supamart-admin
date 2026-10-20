import React, { useState, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, Plus, Trash2, Layers } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImages } from '../services/storage';
import productImages from '../utils/productImages';

const AVAILABILITY_OPTIONS = [
  { value: 'AVAILABLE',    label: 'Available' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'UNAVAILABLE',  label: 'Unavailable' },
];

// Top-level categories first, each immediately followed by its own sub-categories
// (indented in the label) — mirrors how the customer app's Categories accordion nests them.
function buildCategoryOptions(categories) {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  const topLevel = categories.filter((c) => !c.parentId).sort(byOrder);
  const options = [];
  topLevel.forEach((parent) => {
    options.push({ value: parent.id, label: parent.name });
    categories
      .filter((c) => c.parentId === parent.id)
      .sort(byOrder)
      .forEach((child) => options.push({ value: child.id, label: `— ${child.name}` }));
  });
  return options;
}

export default function ProductForm({ product, categories, brands = [], onSuccess, onCancel }) {
  const isEdit = !!product;
  const categoryOptions = buildCategoryOptions(categories);
  const brandOptions = [{ value: '', label: 'None' }, ...brands.map((b) => ({ value: b.id, label: b.name }))];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    brandId: '',
    price: '',
    offerPrice: '',
    stock: '',
    unit: '',
    weight: '',
    tags: '',
    sku: '',
    availability: 'AVAILABLE',
    isFeatured: false,
    isTrending: false,
    isBestseller: false,
    isMonthlyStockUp: false,
  });

  // Pack sizes & custom weight variants (e.g. 250g, 500g, 1kg, 2kg)
  const [variantsList, setVariantsList] = useState([
    { id: 'var-1', label: '1 kg', price: '', offerPrice: '', stock: '50' }
  ]);

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages]           = useState([]);   // File objects
  const [previewUrls, setPreviewUrls]       = useState([]);
  const [loading, setLoading]               = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus]     = useState('');

  useEffect(() => {
    if (isEdit) {
      const v = product.variants?.[0] || {};
      setFormData({
        name:         product.name || '',
        description:  product.description || '',
        categoryId:   product.categoryId || '',
        brandId:      product.brandId || '',
        price:        v.price?.toString() || '',
        offerPrice:   v.offerPrice?.toString() || '',
        stock:        v.stock?.toString() || '',
        unit:         product.unit || '',
        weight:       product.weight?.toString() || '',
        tags:         (product.tags || []).join(', '),
        sku:          v.sku || '',
        availability: product.availability || 'AVAILABLE',
        isFeatured:   product.isFeatured || false,
        isTrending:   product.isTrending || false,
        isBestseller: product.isBestseller || false,
        isMonthlyStockUp: product.isMonthlyStockUp || false,
      });

      if (product.variants && product.variants.length > 0) {
        setVariantsList(
          product.variants.map((varItem, i) => ({
            id: varItem.id || `var-${Date.now()}-${i}`,
            label: varItem.label || (i === 0 ? product.unit || '1 kg' : `Pack ${i + 1}`),
            price: varItem.price?.toString() || '',
            offerPrice: varItem.offerPrice?.toString() || '',
            stock: varItem.stock?.toString() || '50',
          }))
        );
      }
      setExistingImages(product.images || []);
    } else if (categories.length > 0) {
      setFormData(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [product, categories]);

  const handleAddPresetVariant = (label) => {
    setVariantsList(prev => [
      ...prev,
      {
        id: `var-${Date.now()}-${prev.length + 1}`,
        label,
        // Each pack needs an explicitly entered admin price; do not infer prices
        // or discounts by multiplying another pack's values.
        price: '',
        offerPrice: '',
        stock: formData.stock || '50',
      }
    ]);
  };

  const handleUpdateVariant = (index, field, value) => {
    setVariantsList(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleRemoveVariant = (index) => {
    if (variantsList.length <= 1) return toast.error('A product must have at least one pack size/variant');
    setVariantsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setNewImages(prev => [...prev, ...files]);
    setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  // Replaces the product's main photo in one click — clears whatever was there before
  // (bundled default, an older upload, or a not-yet-saved pending one) and puts the new
  // file in the single "primary" slot, so there's no ambiguity about which photo is the
  // one that shows everywhere. Any extra photos add on top of this via the "Add" box below.
  const handlePrimaryPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setExistingImages([]);
    setNewImages([file]);
    setPreviewUrls([URL.createObjectURL(file)]);
    e.target.value = '';
  };

  const removeExistingImage = (idx) => setExistingImages(prev => prev.filter((_, i) => i !== idx));

  const removeNewImage = (idx) => {
    setNewImages(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.categoryId || !formData.price || !formData.stock) {
      return toast.error('Please fill all required fields');
    }
    if (Number(formData.price) <= 0) return toast.error('Price must be greater than 0');
    if (Number(formData.stock) < 0)  return toast.error('Stock cannot be negative');

    // Validate variants
    if (variantsList.length > 0) {
      const labelsSeen = new Set();
      for (let i = 0; i < variantsList.length; i++) {
        const v = variantsList[i];
        const trimmedLabel = (v.label || '').trim().toLowerCase();
        if (!trimmedLabel) {
          return toast.error(`Please provide a label/size for variant #${i + 1}`);
        }
        if (labelsSeen.has(trimmedLabel)) {
          return toast.error(`Duplicate variant label "${v.label}". Each pack size must be unique.`);
        }
        labelsSeen.add(trimmedLabel);

        const vPrice = Number(v.price);
        if (vPrice <= 0) {
          return toast.error(`Price for variant "${v.label}" must be greater than 0`);
        }
        if (v.offerPrice && Number(v.offerPrice) > vPrice) {
          return toast.error(`Offer price cannot exceed standard price for "${v.label}"`);
        }
      }
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus('');

    try {
      // 1. Upload new images from browser → Cloudinary
      let newUrls = [];
      if (newImages.length > 0) {
        setUploadStatus('Uploading images…');
        newUrls = await uploadImages(newImages, 'products', setUploadProgress);
      }

      setUploadStatus('Saving…');

      // 2. Combine kept existing images with newly uploaded URLs
      const keptImageUrls = existingImages.map(img => (typeof img === 'string' ? img : img.url || img));
      const allImages = [...keptImageUrls, ...newUrls];

      // 3. Build variants from variantsList
      let builtVariants = [];
      if (variantsList.length > 0) {
        builtVariants = variantsList.map((v, idx) => {
          const mrpVal = Number(v.price) > 0 ? Number(v.price) : Number(formData.price);
          const sellVal = v.offerPrice && Number(v.offerPrice) > 0 ? Number(v.offerPrice) : null;
          const discountPct = (mrpVal && sellVal && sellVal < mrpVal)
            ? Math.round(((mrpVal - sellVal) / mrpVal) * 100)
            : 0;

          return {
            id:              v.id || `VAR-${Date.now()}-${idx}`,
            label:           (v.label || '').trim() || (idx === 0 ? formData.unit || '1 kg' : `Pack ${idx + 1}`),
            price:           mrpVal,
            offerPrice:      sellVal,
            mrp:             mrpVal,
            sellingPrice:    sellVal ?? mrpVal,
            discountPercent: discountPct,
            stock:           Number(v.stock) >= 0 ? Number(v.stock) : (Number(formData.stock) || 50),
            sku:             formData.sku || null,
          };
        });
      } else {
        const baseMrp = Number(formData.price);
        const baseOffer = formData.offerPrice ? Number(formData.offerPrice) : null;
        const discountPct = (baseMrp && baseOffer && baseOffer < baseMrp)
          ? Math.round(((baseMrp - baseOffer) / baseMrp) * 100)
          : 0;

        builtVariants = [
          {
            id:              formData.sku || `VAR-${Date.now()}`,
            price:           baseMrp,
            offerPrice:      baseOffer,
            mrp:             baseMrp,
            sellingPrice:    baseOffer ?? baseMrp,
            discountPercent: discountPct,
            stock:           Number(formData.stock),
            sku:             formData.sku || null,
            label:           formData.unit || 'Default',
          },
        ];
      }

      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      // 4. Send JSON with image URLs (no file upload to backend)
      const payload = {
        name:         formData.name,
        description:  formData.description,
        categoryId:   formData.categoryId,
        brandId:      formData.brandId || null,
        unit:         formData.unit,
        weight:       Number(formData.weight) || 0,
        availability: formData.availability,
        isFeatured:   formData.isFeatured,
        isTrending:   formData.isTrending,
        isBestseller: formData.isBestseller,
        isMonthlyStockUp: formData.isMonthlyStockUp,
        tags,
        variants:     builtVariants,
      };

      // A bundled fallback photo is not a remote URL, so an empty list here means
      // the editor has no image change to save. Omitting it keeps legacy products
      // editable without clearing their server-side image field.
      if (allImages.length > 0 || !isEdit) payload.images = allImages;

      if (isEdit) {
        await apiPut(`/products/${product.id}`, payload);
        toast.success('Product updated successfully.');
      } else {
        await apiPost('/products', payload);
        toast.success('Product created successfully.');
      }

      onSuccess();
    } catch (err) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  // Mirrors the priority Products.jsx/customer app's getProductImageSource() use: a real
  // uploaded photo (first existingImages entry, if not the generic shared Cloudinary seed
  // stock photo) overrides the bundled default — so uploading here is how an admin
  // actually replaces a product's picture (e.g. new packaging), not just decoration.
  const bundledPhoto = productImages[formData.name];
  const firstExistingUrl = existingImages[0] ? (existingImages[0].url || existingImages[0]) : null;
  const existingIsGeneric = firstExistingUrl && /res\.cloudinary\.com\/demo\//.test(firstExistingUrl);
  // A pending (not-yet-saved) upload sitting in slot 0 will become images[0] on submit —
  // show it as the primary photo now, rather than the stale default, so what's on screen
  // always matches what saving will actually produce.
  const pendingPrimaryUrl = (!existingImages.length && previewUrls.length) ? previewUrls[0] : null;
  const usingUploadedPhoto = !!pendingPrimaryUrl || (!!firstExistingUrl && !existingIsGeneric);
  const displayedPhoto = pendingPrimaryUrl || (firstExistingUrl && !existingIsGeneric ? firstExistingUrl : bundledPhoto);

  const inputClass = "w-full px-4 py-2.5 rounded-md bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Product Name *</label>
          <input type="text" className={inputClass} required value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Category *</label>
          <Select
            value={formData.categoryId}
            onChange={(v) => setFormData({ ...formData, categoryId: v })}
            options={categoryOptions}
            placeholder="Select category…"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Brand</label>
        <Select
          value={formData.brandId}
          onChange={(v) => setFormData({ ...formData, brandId: v })}
          options={brandOptions}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Description</label>
        <textarea className={inputClass} rows={3} value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Price (₹) *</label>
          <input type="number" min="0" step="0.01" className={inputClass} required value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Offer Price (₹)</label>
          <input type="number" min="0" step="0.01" className={inputClass} value={formData.offerPrice}
            onChange={e => setFormData({ ...formData, offerPrice: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Stock *</label>
          <input type="number" min="0" className={inputClass} required value={formData.stock}
            onChange={e => setFormData({ ...formData, stock: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Unit (e.g. 1 kg)</label>
          <input type="text" className={inputClass} value={formData.unit}
            onChange={e => setFormData({ ...formData, unit: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Weight (kg)</label>
          <input type="number" min="0" step="0.01" className={inputClass} value={formData.weight}
            onChange={e => setFormData({ ...formData, weight: e.target.value })} />
        </div>
      </div>

      {/* Pack Sizes & Weight Variants Card */}
      <div className="bg-neutral-50/80 border border-neutral-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-primary-900" />
              <h4 className="text-sm font-bold text-neutral-800">
                Pack Sizes & Weight Variants
              </h4>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Configure custom prices for different grams / weights (e.g. 250g, 500g, 1kg, 2kg).
            </p>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-neutral-400 mr-1">Quick Add:</span>
            {[
              { label: '250 g', mult: 0.28 },
              { label: '500 g', mult: 0.54 },
              { label: '1 kg', mult: 1 },
              { label: '2 kg', mult: 1.95 },
              { label: '5 kg', mult: 4.8 },
            ].map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleAddPresetVariant(p.label, p.mult)}
                className="px-2.5 py-1 text-xs font-semibold bg-white border border-neutral-200 rounded-md text-neutral-700 hover:border-primary-900 hover:text-primary-900 hover:bg-primary-50 transition-colors"
              >
                + {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleAddPresetVariant(`Pack ${variantsList.length + 1}`, 1)}
              className="px-2.5 py-1 text-xs font-bold bg-primary-900 text-white rounded-md hover:bg-primary-800 transition-colors flex items-center gap-1"
            >
              <Plus size={12} /> Custom
            </button>
          </div>
        </div>

        {/* Variants List Items */}
        <div className="space-y-2.5">
          {variantsList.map((v, idx) => (
            <div
              key={v.id || idx}
              className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3"
            >
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                  Pack Size / Weight
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 g, 1 kg"
                  className={inputClass}
                  value={v.label}
                  onChange={e => handleUpdateVariant(idx, 'label', e.target.value)}
                />
              </div>

              <div className="w-full md:w-32">
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="MRP"
                  className={inputClass}
                  value={v.price}
                  onChange={e => handleUpdateVariant(idx, 'price', e.target.value)}
                />
              </div>

              <div className="w-full md:w-32">
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                  Offer Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  className={inputClass}
                  value={v.offerPrice}
                  onChange={e => handleUpdateVariant(idx, 'offerPrice', e.target.value)}
                />
              </div>

              <div className="w-full md:w-28">
                <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  className={inputClass}
                  value={v.stock}
                  onChange={e => handleUpdateVariant(idx, 'stock', e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end pt-5">
                <button
                  type="button"
                  onClick={() => handleRemoveVariant(idx)}
                  disabled={variantsList.length <= 1}
                  title={variantsList.length <= 1 ? "At least one variant required" : "Remove variant"}
                  className={`p-2 rounded-md transition-colors ${
                    variantsList.length <= 1
                      ? 'text-neutral-300 cursor-not-allowed'
                      : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Tags (comma separated)</label>
          <input type="text" className={inputClass} value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Availability</label>
          <Select
            value={formData.availability}
            onChange={(v) => setFormData({ ...formData, availability: v })}
            options={AVAILABILITY_OPTIONS}
          />
        </div>
      </div>

      <div className="flex gap-6">
        {[
          { key: 'isFeatured', label: 'Featured' },
          { key: 'isTrending', label: 'Trending' },
          { key: 'isBestseller', label: 'Bestseller' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, [key]: !formData[key] })}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-900 focus:ring-offset-2 ${
                formData[key] ? 'bg-primary-900' : 'bg-neutral-300'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                formData[key] ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
            <span className="text-sm font-medium text-neutral-700">{label}</span>
          </div>
        ))}
        <label className="flex items-center gap-2.5 text-sm font-medium text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isMonthlyStockUp}
            onChange={(event) => setFormData((previous) => ({ ...previous, isMonthlyStockUp: event.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300 text-primary-900 focus:ring-primary-900"
          />
          Monthly stock-up
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-2">Product Photo</label>
        <div className="flex flex-wrap items-start gap-4">
          {/* Primary photo — the whole tile is clickable to replace it in one step */}
          <label
            className="relative w-28 h-28 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 cursor-pointer group flex-shrink-0"
            title="Click to upload a new photo — e.g. when the packaging changes"
          >
            <input type="file" accept="image/*" className="hidden" onChange={handlePrimaryPhotoChange} />
            {displayedPhoto ? (
              <img src={displayedPhoto} className="w-full h-full object-contain" alt={formData.name} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 group-hover:text-primary-600 transition-colors">
                <ImageIcon size={22} />
                <span className="text-[10px] font-medium mt-1">No photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/55 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-semibold flex flex-col items-center gap-1">
                <Upload size={16} />
                {displayedPhoto ? 'Change' : 'Upload'}
              </span>
            </div>
          </label>

          {/* Extra photos (optional) + add box */}
          <div className="flex flex-wrap gap-4">
            {existingImages.slice(1).map((img, i) => {
              const idx = i + 1;
              return (
                <div key={`ext-${idx}`} className="relative w-24 h-24 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
                  <img src={img.url || img} className="w-full h-full object-contain" alt="Product" />
                  <button type="button" onClick={() => removeExistingImage(idx)}
                    className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            {previewUrls.slice(existingImages.length ? 0 : 1).map((url, i) => {
              const idx = (existingImages.length ? 0 : 1) + i;
              return (
                <div key={`new-${idx}`} className="relative w-24 h-24 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
                  <img src={url} className="w-full h-full object-contain" alt="New Upload" />
                  <button type="button" onClick={() => removeNewImage(idx)}
                    className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <label className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors text-neutral-400 hover:text-primary-600">
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
              <Upload size={18} />
              <span className="text-[10px] font-medium mt-1">Add</span>
            </label>
          </div>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">
          {usingUploadedPhoto
            ? "Click the photo to replace it — this is what's shown everywhere for this product, overriding the bundled default."
            : bundledPhoto
              ? "This is the bundled default photo. Click it to upload a real photo — e.g. when the packaging changes — and it'll override the default everywhere."
              : "Click to upload a photo for this product."}
        </p>
      </div>

      {loading && (
        <div className="space-y-1">
          {uploadStatus && <p className="text-xs text-neutral-500">{uploadStatus}</p>}
          {uploadProgress > 0 && (
            <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
              <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading
            ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {uploadStatus || 'Saving…'}</span>
            : isEdit ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
