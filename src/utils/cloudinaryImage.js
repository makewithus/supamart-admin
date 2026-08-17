// Same fix as customer/src/utils/cloudinaryImage.js — rewrites a Cloudinary delivery URL
// to request a resized, auto-quality/auto-format variant instead of the raw full-resolution
// upload. List/grid pages here (Brands, Categories, Products, Customers) were rendering
// every admin-uploaded photo at its original size, often several MB, for a thumbnail. This
// needs no re-upload — it works retroactively on every photo already stored, since
// Cloudinary applies the transform on the fly and caches the result on its CDN.
export function optimizeCloudinaryUrl(url, width = 300) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[a-z0-9_,]*w_\d/.test(url)) return url; // already has a width transform
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_limit/`);
}
