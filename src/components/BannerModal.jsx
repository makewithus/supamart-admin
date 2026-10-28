import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Check, Image as ImageIcon, Sparkles, Layers, Sliders } from 'lucide-react';
import {
  THEME_PRESETS,
  createCompositeBanner,
  convertBannerToStandardDimensions,
} from '../utils/bannerImage';
import { apiPost, apiPut } from '../services/api';
import toast from 'react-hot-toast';

export default function BannerModal({
  isOpen,
  onClose,
  onSuccess,
  currentBannerCount = 0,
  banner = null, // If provided, modal is in "Edit" mode
}) {
  const [mode, setMode] = useState('composite'); // 'composite' | 'full'
  const [selectedTheme, setSelectedTheme] = useState(THEME_PRESETS[0]);
  const [label, setLabel] = useState('Farm fresh');
  const [title, setTitle] = useState('Vegetables picked this morning');
  const [subtitle, setSubtitle] = useState('Starting at just ₹9');
  const [buttonText, setButtonText] = useState('Shop now');
  const [target, setTarget] = useState('Home');
  const [customTarget, setCustomTarget] = useState('');
  const [order, setOrder] = useState(currentBannerCount);
  const [isActive, setIsActive] = useState(true);

  const [sideImageFile, setSideImageFile] = useState(null);
  const [sideImagePreview, setSideImagePreview] = useState(null);
  const [fullBannerFile, setFullBannerFile] = useState(null);
  const [fullBannerPreview, setFullBannerPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize form when opening or editing
  useEffect(() => {
    if (!isOpen) return;

    if (banner) {
      setLabel(banner.label || '');
      setTitle(banner.title || '');
      setSubtitle(banner.subtitle || '');
      setButtonText(banner.buttonText || 'Shop now');
      setTarget(banner.target || banner.targetType || 'Home');
      setOrder(banner.order ?? currentBannerCount);
      setIsActive(banner.isActive !== false);

      const matchedTheme = THEME_PRESETS.find(
        (t) => t.background?.toLowerCase() === banner.background?.toLowerCase()
      ) || {
        id: 'custom',
        name: 'Existing',
        background: banner.background || '#E4F2E9',
        text: banner.text || '#121712',
        secondary: banner.secondary || '#3B5145',
        button: banner.button || '#0A7C47',
        buttonText: banner.buttonText || '#FFFFFF',
      };
      setSelectedTheme(matchedTheme);

      if (banner.image) {
        setSideImagePreview(banner.image);
        setFullBannerPreview(banner.image);
      }
    } else {
      setLabel('Farm fresh');
      setTitle('Vegetables picked this morning');
      setSubtitle('Starting at just ₹9');
      setButtonText('Shop now');
      setTarget('Home');
      setCustomTarget('');
      setOrder(currentBannerCount);
      setIsActive(true);
      setSelectedTheme(THEME_PRESETS[0]);
      setSideImageFile(null);
      setSideImagePreview(null);
      setFullBannerFile(null);
      setFullBannerPreview(null);
    }
  }, [isOpen, banner, currentBannerCount]);

  if (!isOpen) return null;

  const handleProcessImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please upload a valid image (PNG, JPG, WebP)');
      return;
    }

    if (mode === 'composite') {
      setSideImageFile(file);
      setSideImagePreview(URL.createObjectURL(file));
      toast.success('Side product image uploaded!');
    } else {
      try {
        const { file: stdFile, previewUrl } = await convertBannerToStandardDimensions(file);
        setFullBannerFile(stdFile);
        setFullBannerPreview(previewUrl);
        toast.success('Formatted to 800×320 standard banner!');
      } catch (err) {
        toast.error('Failed to format image');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading(banner ? 'Updating banner...' : 'Publishing banner...');

    try {
      let finalImageFile = null;

      if (mode === 'composite') {
        // Upload the selected side image file directly so it remains crisp and unbaked
        finalImageFile = sideImageFile;
      } else {
        finalImageFile = fullBannerFile;
      }

      const finalTarget = target === 'Custom' ? customTarget.trim() || 'Home' : target;
      const formData = new FormData();

      if (finalImageFile) {
        formData.append('image', finalImageFile);
      } else if (banner?.image) {
        formData.append('image', banner.image);
      }

      formData.append('target', finalTarget);
      formData.append('targetType', finalTarget);
      formData.append('destination', finalTarget.toLowerCase());
      formData.append('title', title.trim());
      formData.append('label', label.trim());
      formData.append('subtitle', subtitle.trim());
      formData.append('buttonText', buttonText.trim());
      formData.append('buttonTextColor', selectedTheme.buttonText || '#FFFFFF');
      formData.append('order', String(order));
      formData.append('isActive', String(isActive));
      formData.append('mode', mode);
      formData.append('type', mode);
      formData.append('background', selectedTheme.background);
      formData.append('text', selectedTheme.text);
      formData.append('secondary', selectedTheme.secondary);
      formData.append('button', selectedTheme.button);

      if (banner?.id) {
        await apiPut(`/banners/${banner.id}`, formData);
        toast.success('Banner updated successfully!', { id: toastId });
      } else {
        await apiPost('/banners', formData);
        toast.success('Banner created and published live!', { id: toastId });
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Failed to save banner:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to save banner', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (sideImagePreview && sideImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(sideImagePreview);
    }
    if (fullBannerPreview && fullBannerPreview.startsWith('blob:')) {
      URL.revokeObjectURL(fullBannerPreview);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
              <Upload size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                {banner ? 'Edit Home Banner' : 'Add Home Banner'}
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400">
                Configure banner text, side image, and theme for the mobile customer app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-gray-100/80 rounded-xl text-[11px] sm:text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('composite')}
              className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-center ${
                mode === 'composite'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layers size={13} className="shrink-0" />
              <span>Text + Image</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('full')}
              className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-center ${
                mode === 'full'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <ImageIcon size={13} className="shrink-0" />
              <span>Full Graphic</span>
            </button>
          </div>

          {/* Live Mobile Interactive Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-700 tracking-tight">
                Live App Preview (800×320)
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <Sparkles size={11} /> Auto-fits to phone width with no breakage
              </span>
            </div>

            {mode === 'composite' ? (
              <div
                style={{ backgroundColor: selectedTheme.background }}
                className="w-full aspect-[2.5/1] rounded-2xl p-4 sm:p-5 flex items-center justify-between border border-gray-200/80 shadow-2xs relative overflow-hidden transition-colors"
              >
                {/* Left Side Text Content */}
                <div className="flex-1 min-w-0 pr-3 z-10 flex flex-col justify-center h-full">
                  {label && (
                    <span
                      style={{ color: selectedTheme.secondary }}
                      className="text-[10px] sm:text-xs font-bold tracking-wider uppercase mb-1 truncate"
                    >
                      {label}
                    </span>
                  )}
                  <h3
                    style={{ color: selectedTheme.text }}
                    className="text-base sm:text-lg font-black leading-tight tracking-tight line-clamp-2"
                  >
                    {title || 'Banner Title'}
                  </h3>
                  {subtitle && (
                    <p
                      style={{ color: selectedTheme.secondary }}
                      className="text-xs font-medium mt-1 truncate"
                    >
                      {subtitle}
                    </p>
                  )}
                  <div className="mt-2.5">
                    <span
                      style={{
                        backgroundColor: selectedTheme.button,
                        color: selectedTheme.buttonText,
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold shadow-2xs"
                    >
                      <span>{buttonText || 'Shop now'}</span>
                      <span className="text-xs">›</span>
                    </span>
                  </div>
                </div>

                {/* Right Side Visual Box */}
                <div className="w-[38%] h-[85%] rounded-xl overflow-hidden bg-white/90 border border-white/60 shadow-2xs flex items-center justify-center p-1.5 shrink-0 z-10 relative">
                  {sideImagePreview ? (
                    <img
                      src={sideImagePreview}
                      alt="Side visual preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                      <ImageIcon size={22} className="stroke-1 text-gray-300 mb-1" />
                      <span className="text-[10px] font-medium text-gray-400 leading-tight">
                        Upload Side Image
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full aspect-[2.5/1] rounded-2xl overflow-hidden bg-gray-100 border border-gray-200/80 flex items-center justify-center shadow-2xs relative">
                {fullBannerPreview ? (
                  <img
                    src={fullBannerPreview}
                    alt="Full banner preview"
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <ImageIcon size={28} className="mx-auto stroke-1 text-gray-300 mb-1" />
                    <span className="text-xs font-medium">Upload 800×320 Graphic Banner</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Theme Color Presets */}
          {mode === 'composite' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Card Theme & Colors
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {THEME_PRESETS.map((t) => {
                  const isSelected = selectedTheme.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTheme(t)}
                      style={{ backgroundColor: t.background }}
                      className={`p-2.5 rounded-xl border-2 transition-all flex flex-col items-start justify-between text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#056B38] ring-2 ring-emerald-500/20 shadow-2xs'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span
                        style={{ color: t.text }}
                        className="text-[11px] font-extrabold truncate w-full"
                      >
                        {t.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span
                          style={{ backgroundColor: t.button }}
                          className="w-4 h-4 rounded-full border border-black/10 inline-block"
                        />
                        <span
                          style={{ color: t.secondary }}
                          className="text-[10px] font-semibold"
                        >
                          Theme
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Image Upload Input Box */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {mode === 'composite' ? 'Side Product Image' : 'Banner Graphic'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessImage(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-4 px-4 rounded-xl border-2 border-dashed transition-all flex items-center justify-between cursor-pointer ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-emerald-600/40 bg-gray-50/60 hover:bg-emerald-50/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-500 shadow-2xs">
                  <Upload size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    {mode === 'composite'
                      ? sideImageFile
                        ? sideImageFile.name
                        : 'Choose side photo (veggies, grains, snacks...)'
                      : fullBannerFile
                      ? fullBannerFile.name
                      : 'Choose full 800×320 banner file'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    PNG, JPG, or WebP — automatically resized and framed
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#056B38] bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-2xs">
                Browse
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProcessImage(file);
              }}
            />
          </div>

          {/* Text Customization Inputs (for Composite mode) */}
          {mode === 'composite' && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Tag / Badge (Top uppercase)
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. FARM FRESH or 20% OFF"
                    className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Button Action Text
                  </label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Shop now"
                    className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Headline Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Wholesale prices, home delivered"
                  required
                  className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Subtitle / Offer Details
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Starting at just ₹9 or Up to 20% off atta, rice & oil"
                  className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>
            </div>
          )}

          {/* Navigation Target & Display Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Target App Destination
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              >
                <option value="Home">Home Screen</option>
                <option value="Categories">Categories Screen</option>
                <option value="Offers">Offers & Coupons Screen</option>
                <option value="Custom">Custom Category Slug...</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Carousel Display Order
              </label>
              <input
                type="number"
                min="0"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                placeholder="0"
                className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {target === 'Custom' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Category Slug
              </label>
              <input
                type="text"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                placeholder="e.g. fresh-vegetables or rice-atta-grains"
                className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
          )}

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-800">Publish Live to Customer App</p>
              <p className="text-[11px] text-gray-400">
                Immediately shows this banner in the mobile app home screen carousel
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isActive ? 'bg-[#0E6C3B]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'composite' && !title.trim())}
              className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl bg-[#056B38] hover:bg-[#04552C] text-xs font-semibold text-white shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-center"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{banner ? 'Update Banner' : 'Publish Banner'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
