import React, { useState, useEffect } from 'react';
import { Loader2, Upload, X, Tag, Package, FolderTree } from 'lucide-react';
import Button from './ui/Button';
import Select from './ui/Select';
import DateInput from './ui/DateInput';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImage } from '../services/storage';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

const KIND_OPTIONS = [
  { value: 'PERCENT', label: 'Percentage (%)' },
  { value: 'FLAT',    label: 'Flat Amount (₹)' },
];

const SCOPE_OPTIONS = [
  { value: 'CART',     label: 'Cart (Entire cart)' },
  { value: 'CATEGORY', label: 'Category specific' },
  { value: 'PRODUCT',  label: 'Specific Product' },
];

export default function OfferForm({ offer, onSuccess, onCancel }) {
  const isEdit = !!offer;

  const [formData, setFormData] = useState({
    code:        '',
    title:       '',
    description: '',
    kind:        'PERCENT',
    value:       '',
    maxValue:    '',
    minValue:    '',
    validFrom:   '',
    validTo:     '',
    scope:       'CART',
    scopeId:     '',
    isActive:    true,
  });

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [existingImage, setExistingImage] = useState(null);
  const [newImage, setNewImage]           = useState(null);   // File object
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    async function loadTaxonomy() {
      try {
        const [catSnap, prodSnap] = await Promise.all([
          getDocs(query(collection(db, 'categories'), orderBy('name', 'asc'))),
          getDocs(query(collection(db, 'products'), orderBy('name', 'asc'))),
        ]);
        setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Failed to load categories/products for offers:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadTaxonomy();
  }, []);

  useEffect(() => {
    if (isEdit) {
      const fmt = (ms) => ms ? new Date(ms).toISOString().slice(0, 16) : '';
      setFormData({
        code:        offer.code || '',
        title:       offer.title || '',
        description: offer.description || '',
        kind:        offer.kind || 'PERCENT',
        value:       offer.value?.toString() || '',
        maxValue:    (offer.maxDiscount ?? offer.maxValue)?.toString() || '',
        minValue:    offer.minValue?.toString() || '',
        validFrom:   fmt(offer.validFrom),
        validTo:     fmt(offer.validTo),
        scope:       offer.scope || 'CART',
        scopeId:     offer.scopeId || '',
        isActive:    offer.isActive !== false,
      });
      setExistingImage(offer.image || offer.bannerImage || null);
    }
  }, [offer]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImage(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setExistingImage(null);
    }
  };

  const removeImage = () => {
    setNewImage(null);
    setExistingImage(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.value || !formData.validFrom || !formData.validTo) {
      return toast.error('Please fill required fields (Code, Value, Dates)');
    }

    if (formData.scope === 'CATEGORY' && !formData.scopeId) {
      return toast.error('Please select a target Category for this offer.');
    }
    if (formData.scope === 'PRODUCT' && !formData.scopeId) {
      return toast.error('Please select a target Product for this offer.');
    }

    setLoading(true);

    try {
      // Upload new image from browser → Cloudinary, get URL
      let imageUrl = existingImage || null;
      if (newImage) {
        imageUrl = await uploadImage(newImage, 'offers');
      }

      // Send JSON with image URL to backend
      const payload = {
        code:        formData.code.trim().toUpperCase(),
        title:       formData.title || '',
        description: formData.description || '',
        kind:        formData.kind,
        value:       Number(formData.value),
        validFrom:   new Date(formData.validFrom).getTime(),
        validTo:     new Date(formData.validTo).getTime(),
        scope:       formData.scope,
        scopeId:     formData.scope === 'CART' ? null : (formData.scopeId || null),
        isActive:    formData.isActive,
        ...(formData.maxValue ? { maxDiscount: Number(formData.maxValue) } : { maxDiscount: null }),
        ...(formData.minValue ? { minValue: Number(formData.minValue) } : { minValue: 0 }),
        ...(imageUrl !== undefined && { image: imageUrl }),
      };

      if (isEdit) {
        await apiPut(`/offers/${offer.id}`, payload);
        toast.success('Offer updated successfully.');
      } else {
        await apiPost('/offers', payload);
        toast.success('Offer created successfully.');
      }

      onSuccess();
    } catch (err) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Coupon Code *</label>
          <input
            type="text"
            className={`${inputClass} font-mono uppercase tracking-wider font-bold`}
            required
            value={formData.code}
            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g. SUMMER50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Title</label>
          <input
            type="text"
            className={inputClass}
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Summer Special"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Description / Terms</label>
        <textarea
          className={inputClass}
          rows={2}
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g. Save 10% on your orders above ₹199"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Discount Type *</label>
          <Select
            value={formData.kind}
            onChange={(v) => setFormData({ ...formData, kind: v })}
            options={KIND_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">
            {formData.kind === 'PERCENT' ? 'Percentage (%) *' : 'Flat Amount (₹) *'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            required
            value={formData.value}
            onChange={e => setFormData({ ...formData, value: e.target.value })}
            placeholder={formData.kind === 'PERCENT' ? 'e.g. 15' : 'e.g. 50'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Max Discount Cap (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={formData.maxValue}
            onChange={e => setFormData({ ...formData, maxValue: e.target.value })}
            placeholder="e.g. 100 (Optional)"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Min Order Value (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={formData.minValue}
            onChange={e => setFormData({ ...formData, minValue: e.target.value })}
            placeholder="e.g. 199 (0 for any order)"
          />
        </div>
      </div>

      {/* Scope configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Offer Scope</label>
          <Select
            value={formData.scope}
            onChange={(v) => setFormData({ ...formData, scope: v, scopeId: '' })}
            options={SCOPE_OPTIONS}
          />
        </div>
        <div>
          {formData.scope === 'CATEGORY' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Target Category *</label>
              <Select
                value={formData.scopeId}
                onChange={(v) => setFormData({ ...formData, scopeId: v })}
                options={[
                  { value: '', label: 'Select a Category' },
                  ...categories.map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>
          )}
          {formData.scope === 'PRODUCT' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Target Product *</label>
              <Select
                value={formData.scopeId}
                onChange={(v) => setFormData({ ...formData, scopeId: v })}
                options={[
                  { value: '', label: 'Select a Product' },
                  ...products.slice(0, 100).map(p => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>
          )}
          {formData.scope === 'CART' && (
            <div className="h-full flex items-center pt-5">
              <span className="text-xs text-neutral-400">Applies to the entire cart value</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Valid From *</label>
          <DateInput
            value={formData.validFrom}
            onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Valid To *</label>
          <DateInput
            value={formData.validTo}
            onChange={e => setFormData({ ...formData, validTo: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-900 focus:ring-offset-2 ${
            formData.isActive ? 'bg-primary-900' : 'bg-neutral-300'
          }`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            formData.isActive ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
        <span className="text-sm font-medium text-neutral-700">Active Offer</span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-2">Banner Image (Optional)</label>
        <div className="flex items-center gap-4">
          {(existingImage || previewUrl) ? (
            <div className="relative w-32 h-16 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <img src={previewUrl || existingImage} className="w-full h-full object-cover" alt="Banner" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="w-32 h-16 rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors text-neutral-400 hover:text-primary-600">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <Upload size={20} />
            </label>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading
            ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving…</span>
            : isEdit ? 'Save Changes' : 'Create Offer'}
        </Button>
      </div>
    </form>
  );
}
