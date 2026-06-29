import React, { useState, useEffect } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImage } from '../services/storage';

export default function CategoryForm({ category, onSuccess, onCancel }) {
  const isEdit = !!category;

  const [formData, setFormData] = useState({
    name:        '',
    description: '',
    order:       '',
    isActive:    true,
  });

  const [existingImage, setExistingImage] = useState(null);
  const [newImage, setNewImage]           = useState(null);   // File object
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name:        category.name || '',
        description: category.description || '',
        order:       category.order?.toString() || '',
        isActive:    category.isActive !== false,
      });
      setExistingImage(category.image || null);
    }
  }, [category]);

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
    if (!formData.name) return toast.error('Category name is required');

    setLoading(true);

    try {
      // Upload new image from browser → Cloudinary, get URL
      let imageUrl = existingImage || null;
      if (newImage) {
        imageUrl = await uploadImage(newImage, 'categories');
      }

      // Send JSON with image URL to backend
      const payload = {
        name:        formData.name,
        description: formData.description || '',
        order:       Number(formData.order) || 0,
        isActive:    formData.isActive,
        ...(imageUrl !== undefined && { image: imageUrl }),
      };

      if (isEdit) {
        await apiPut(`/categories/${category.id}`, payload);
        toast.success('Category updated successfully.');
      } else {
        await apiPost('/categories', payload);
        toast.success('Category created successfully.');
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
      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Category Name *</label>
        <input type="text" className={inputClass} required value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Description</label>
        <textarea className={inputClass} rows={2} value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Display Order</label>
          <input type="number" min="0" className={inputClass} value={formData.order}
            onChange={e => setFormData({ ...formData, order: e.target.value })} />
        </div>
        <div className="flex items-end pb-1 gap-2.5">
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
          <span className="text-sm font-medium text-neutral-700">Active</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-2">Category Image</label>
        <div className="flex items-center gap-4">
          {(existingImage || previewUrl) ? (
            <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <img src={previewUrl || existingImage} className="w-full h-full object-cover" alt="Category" />
              <button type="button" onClick={removeImage}
                className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors text-neutral-400 hover:text-primary-600">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <Upload size={22} />
              <span className="text-[10px] font-medium mt-1">Upload</span>
            </label>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 size={16} className="animate-spin text-primary-600" />
              <span>Uploading image…</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading
            ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving…</span>
            : isEdit ? 'Save Changes' : 'Create Category'}
        </Button>
      </div>
    </form>
  );
}
