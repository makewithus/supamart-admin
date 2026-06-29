import React, { useState, useEffect } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import Button from './ui/Button';
import Select from './ui/Select';
import DateInput from './ui/DateInput';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImage } from '../services/storage';

const KIND_OPTIONS = [
  { value: 'PERCENT', label: 'Percentage (%)' },
  { value: 'FLAT',    label: 'Flat Amount (₹)' },
];
const SCOPE_OPTIONS = [
  { value: 'CART',    label: 'Cart (all items)' },
  { value: 'PRODUCT', label: 'Product' },
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
    isActive:    true,
  });

  const [existingImage, setExistingImage] = useState(null);
  const [newImage, setNewImage]           = useState(null);   // File object
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [loading, setLoading]             = useState(false);

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

    setLoading(true);

    try {
      // Upload new image from browser → Cloudinary, get URL
      let imageUrl = existingImage || null;
      if (newImage) {
        imageUrl = await uploadImage(newImage, 'offers');
      }

      // Send JSON with image URL to backend
      const payload = {
        code:        formData.code.toUpperCase(),
        title:       formData.title || '',
        description: formData.description || '',
        kind:        formData.kind,
        value:       Number(formData.value),
        validFrom:   new Date(formData.validFrom).getTime(),
        validTo:     new Date(formData.validTo).getTime(),
        scope:       formData.scope,
        isActive:    formData.isActive,
        ...(formData.maxValue && { maxDiscount: Number(formData.maxValue) }),
        ...(formData.minValue && { minValue:    Number(formData.minValue) }),
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
          <input type="text" className={inputClass} required value={formData.code}
            onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. SUMMER50" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Title</label>
          <input type="text" className={inputClass} value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Summer Sale" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Description</label>
        <textarea className={inputClass} rows={2} value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Discount Type</label>
          <Select
            value={formData.kind}
            onChange={(v) => setFormData({ ...formData, kind: v })}
            options={KIND_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Discount Value *</label>
          <input type="number" step="0.01" min="0" className={inputClass} required value={formData.value}
            onChange={e => setFormData({ ...formData, value: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Max Discount (₹)</label>
          <input type="number" step="0.01" min="0" className={inputClass} value={formData.maxValue}
            onChange={e => setFormData({ ...formData, maxValue: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Min Order Value (₹)</label>
          <input type="number" step="0.01" min="0" className={inputClass} value={formData.minValue}
            onChange={e => setFormData({ ...formData, minValue: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Scope</label>
          <Select
            value={formData.scope}
            onChange={(v) => setFormData({ ...formData, scope: v })}
            options={SCOPE_OPTIONS}
          />
        </div>
        <div />
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

      <div className="flex items-center gap-3">
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
        <label className="block text-xs font-semibold text-neutral-500 mb-2">Banner Image</label>
        <div className="flex items-center gap-4">
          {(existingImage || previewUrl) ? (
            <div className="relative w-32 h-16 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <img src={previewUrl || existingImage} className="w-full h-full object-cover" alt="Banner" />
              <button type="button" onClick={removeImage}
                className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors">
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
