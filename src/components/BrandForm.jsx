import React, { useState, useEffect } from 'react';
import { Loader2, Upload, Image as ImageIcon, X } from 'lucide-react';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import { apiPost, apiPut } from '../services/api';
import { uploadImage } from '../services/storage';
import brandLogos from '../utils/brandLogos';

export default function BrandForm({ brand, onSuccess, onCancel }) {
  const isEdit = !!brand;

  const [formData, setFormData] = useState({
    name:     '',
    order:    '',
    isActive: true,
  });

  const [existingLogo, setExistingLogo] = useState(null);
  const [newLogo, setNewLogo]           = useState(null); // File object
  const [previewUrl, setPreviewUrl]     = useState(null);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (isEdit) {
      setFormData({
        name:     brand.name || '',
        order:    brand.order?.toString() || '',
        isActive: brand.isActive !== false,
      });
      setExistingLogo(brand.logoUrl || null);
    }
  }, [brand]);

  // Replaces the logo in one click — clears whatever was there before (bundled default
  // or an older upload) and puts the new file in the single slot, mirroring
  // ProductForm's primary-photo control so admins get the same, consistent control
  // everywhere in the app.
  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setExistingLogo(null);
    setNewLogo(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const removeLogo = () => {
    setNewLogo(null);
    setExistingLogo(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Brand name is required');

    setLoading(true);

    try {
      // Logo is optional — a brand with no logo falls back to the bundled default (if
      // this exact brand name has one in brandLogos.js), then a generic placeholder icon.
      let logoUrl = existingLogo || '';
      if (newLogo) {
        logoUrl = await uploadImage(newLogo, 'brands');
      }

      const payload = {
        name:     formData.name,
        logoUrl,
        order:    Number(formData.order) || 0,
        isActive: formData.isActive,
      };

      if (isEdit) {
        await apiPut(`/brands/${brand.id}`, payload);
        toast.success('Brand updated successfully.');
      } else {
        await apiPost('/brands', payload);
        toast.success('Brand created successfully.');
      }

      onSuccess();
    } catch (err) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Same priority pattern as ProductForm/CategoryForm: an uploaded (or not-yet-saved
  // pending) logo overrides the bundled default for this exact brand name.
  const bundledLogo = brandLogos[formData.name];
  const pendingUrl = !existingLogo && previewUrl ? previewUrl : null;
  const usingUploadedLogo = !!pendingUrl || !!existingLogo;
  const displayedLogo = pendingUrl || existingLogo || bundledLogo;

  const inputClass = "w-full px-4 py-2.5 rounded-md bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1">Brand Name *</label>
        <input type="text" className={inputClass} required value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })} />
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
        <label className="block text-xs font-semibold text-neutral-500 mb-2">Brand Logo</label>
        <div className="flex items-center gap-4">
          {/* Same click-to-replace primary tile as ProductForm's Product Photo control —
              the whole tile is clickable, showing the uploaded logo, or the bundled
              default for this exact brand name, or an empty state. */}
          <label
            className="relative w-24 h-24 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 cursor-pointer group flex-shrink-0"
            title="Click to upload a logo"
          >
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            {displayedLogo ? (
              <img src={displayedLogo} className="w-full h-full object-contain p-2" alt={formData.name || 'Brand'} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 group-hover:text-primary-600 transition-colors">
                <ImageIcon size={22} />
                <span className="text-[10px] font-medium mt-1">No logo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/55 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[11px] font-semibold flex flex-col items-center gap-1">
                <Upload size={16} />
                {displayedLogo ? 'Change' : 'Upload'}
              </span>
            </div>
          </label>
          {(existingLogo || previewUrl) && (
            <button type="button" onClick={removeLogo}
              className="text-[11px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-1">
              <X size={12} /> Remove upload
            </button>
          )}
          <p className="text-[11px] text-neutral-400 max-w-[180px]">
            {usingUploadedLogo
              ? "Click the logo to replace it — this is what's shown everywhere for this brand, overriding the bundled default."
              : bundledLogo
                ? "This is the bundled default logo. Click it to upload a different one and override the default everywhere."
                : "Optional — click to upload a logo. Brands without one show a generic icon."}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading
            ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving…</span>
            : isEdit ? 'Save Changes' : 'Create Brand'}
        </Button>
      </div>
    </form>
  );
}
