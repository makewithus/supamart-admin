import React, { useState, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImages } from '../services/storage';

const AVAILABILITY_OPTIONS = [
  { value: 'AVAILABLE',    label: 'Available' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'UNAVAILABLE',  label: 'Unavailable' },
];

export default function ProductForm({ product, categories, onSuccess, onCancel }) {
  const isEdit = !!product;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
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
  });

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
      });
      setExistingImages(product.images || []);
    } else if (Object.keys(categories).length > 0) {
      setFormData(prev => ({ ...prev, categoryId: Object.keys(categories)[0] }));
    }
  }, [product, categories]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setNewImages(prev => [...prev, ...files]);
    setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
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

      // 3. Build the variant
      const variant = {
        id:         formData.sku || `VAR-${Date.now()}`,
        price:      Number(formData.price),
        offerPrice: formData.offerPrice ? Number(formData.offerPrice) : null,
        stock:      Number(formData.stock),
        sku:        formData.sku || null,
        label:      'Default',
      };

      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      // 4. Send JSON with image URLs (no file upload to backend)
      const payload = {
        name:         formData.name,
        description:  formData.description,
        categoryId:   formData.categoryId,
        unit:         formData.unit,
        weight:       Number(formData.weight) || 0,
        availability: formData.availability,
        isFeatured:   formData.isFeatured,
        isTrending:   formData.isTrending,
        tags,
        variants:     [variant],
        images:       allImages,
      };

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

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10";

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
            options={Object.entries(categories).map(([id, name]) => ({ value: id, label: name }))}
            placeholder="Select category…"
          />
        </div>
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

      <div className="grid grid-cols-3 gap-4">
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
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">SKU</label>
          <input type="text" className={inputClass} value={formData.sku}
            onChange={e => setFormData({ ...formData, sku: e.target.value })} />
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
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-2">Product Images</label>
        <div className="flex flex-wrap gap-4 mb-4">
          {existingImages.map((img, idx) => (
            <div key={`ext-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <img src={img.url || img} className="w-full h-full object-cover" alt="Product" />
              <button type="button" onClick={() => removeExistingImage(idx)}
                className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                <X size={12} />
              </button>
            </div>
          ))}
          {previewUrls.map((url, idx) => (
            <div key={`new-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <img src={url} className="w-full h-full object-cover" alt="New Upload" />
              <button type="button" onClick={() => removeNewImage(idx)}
                className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors text-neutral-400 hover:text-primary-600">
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
            <Upload size={20} />
            <span className="text-[10px] font-medium mt-1">Add</span>
          </label>
        </div>
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
