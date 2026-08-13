// Maps the exact brand `name` string in Firestore's `brands` collection to its
// locally-bundled logo, served from /public/brand-logos/ — the same cleaned images the
// customer app bundles via require() (see customer/src/utils/brandLogos.js, which this
// file mirrors key-for-key and documents the full source/processing history for).
//
// Two source batches: assets/brands/ (35 files, already brand-named) and
// assets/Remaining_Brands/ (53 files, identified one-by-one against packaging/logo
// content — this batch also replaced the Pepsodent logo, and is when "R.G." (deleted,
// not a real brand) and "Lia" (merged into "Cycle") got cleaned up in Firestore, see
// backend/src/jobs/fixBrandIssues.js). Three brands (DH, E-fee, KPR) still have no
// confidently-matched image and are deliberately left without one.
//
// Priority used by callers (see pages/Brands.jsx, components/ProductForm.jsx): an
// admin-uploaded `brand.logoUrl` (a live Firestore field, set via the Brand form)
// always overrides this bundled default — same pattern as product/category images.

const brandLogos = {
  "786": "/brand-logos/786.webp",
  "Anus": "/brand-logos/Anus.webp",
  "AVT": "/brand-logos/AVT.webp",
  "Bakers": "/brand-logos/Bakers.webp",
  "Bharath": "/brand-logos/Bharath.webp",
  "Boost": "/brand-logos/Boost.webp",
  "Bounty": "/brand-logos/Bounty.webp",
  "Britannia": "/brand-logos/Britannia.webp",
  "Bru": "/brand-logos/Bru.webp",
  "Clear": "/brand-logos/Clear.webp",
  "Clinic Plus": "/brand-logos/Clinic%20Plus.webp",
  "Closeup": "/brand-logos/Closeup.webp",
  "Comfort": "/brand-logos/Comfort.webp",
  "Cycle": "/brand-logos/Cycle.webp",
  "Dabur": "/brand-logos/Dabur.webp",
  "Devon": "/brand-logos/Devon.webp",
  "Dolphin": "/brand-logos/Dolphin.webp",
  "Dove": "/brand-logos/Dove.webp",
  "Elite": "/brand-logos/Elite.webp",
  "Exo": "/brand-logos/Exo.webp",
  "Glow & Lovely": "/brand-logos/Glow%20%26%20Lovely.webp",
  "Hamam": "/brand-logos/Hamam.webp",
  "Hellmann's": "/brand-logos/Hellmann's.webp",
  "Horlicks": "/brand-logos/Horlicks.webp",
  "Indulekha": "/brand-logos/Indulekha.webp",
  "Kellogg's": "/brand-logos/Kellogg's.webp",
  "Kissan": "/brand-logos/Kissan.webp",
  "Kit Kat": "/brand-logos/Kit%20Kat.webp",
  "Kitchen King": "/brand-logos/Kitchen%20King.webp",
  "Knorr": "/brand-logos/Knorr.webp",
  "KP": "/brand-logos/KP.webp",
  "Lifebuoy": "/brand-logos/Lifebuoy.webp",
  "Lipton": "/brand-logos/Lipton.webp",
  "Liril": "/brand-logos/Liril.webp",
  "Lux": "/brand-logos/Lux.webp",
  "Maggi": "/brand-logos/Maggi.webp",
  "Maharaja": "/brand-logos/Maharaja.webp",
  "Maxo": "/brand-logos/Maxo.webp",
  "Medimix": "/brand-logos/Medimix.webp",
  "Milma": "/brand-logos/Milma.webp",
  "Munch": "/brand-logos/Munch.webp",
  "Nescafe": "/brand-logos/Nescafe.webp",
  "Nirmal": "/brand-logos/Nirmal.webp",
  "Pavithram": "/brand-logos/Pavithram.webp",
  "Pears": "/brand-logos/Pears.webp",
  "Pepsodent": "/brand-logos/Pepsodent.webp",
  "Pond's": "/brand-logos/Pond's.webp",
  "Power": "/brand-logos/Power.webp",
  "Prakrithi": "/brand-logos/Prakrithi.webp",
  "Pran": "/brand-logos/Pran.webp",
  "Pringles": "/brand-logos/Pringles.webp",
  "Pulari": "/brand-logos/Pulari.webp",
  "Quaker": "/brand-logos/Quaker.webp",
  "Red Label": "/brand-logos/Red%20Label.webp",
  "Rexona": "/brand-logos/Rexona.webp",
  "Rin": "/brand-logos/Rin.webp",
  "Ruchi Gold": "/brand-logos/Ruchi%20Gold.webp",
  "Sara": "/brand-logos/Sara.webp",
  "Santoor": "/brand-logos/Santoor.webp",
  "Sensodyne": "/brand-logos/Sensodyne.webp",
  "Snickers": "/brand-logos/Snickers.webp",
  "SSK": "/brand-logos/SSK.webp",
  "Sunfeast": "/brand-logos/Sunfeast.webp",
  "Sunlight": "/brand-logos/Sunlight.webp",
  "Sunsilk": "/brand-logos/Sunsilk.webp",
  "Surf Excel": "/brand-logos/Surf%20Excel.webp",
  "Taaza": "/brand-logos/Taaza.webp",
  "Taj Mahal": "/brand-logos/Taj%20Mahal.webp",
  "TRESemmé": "/brand-logos/TRESemm%C3%A9.webp",
  "True Blue": "/brand-logos/True%20Blue.webp",
  "TT": "/brand-logos/TT.webp",
  "Ujala": "/brand-logos/Ujala.webp",
  "UT": "/brand-logos/UT.webp",
  "VWash": "/brand-logos/VWash.webp",
  "Vim": "/brand-logos/Vim.webp",
  "Wheel": "/brand-logos/Wheel.webp",
  "Yardley": "/brand-logos/Yardley.webp",
  "Yippee": "/brand-logos/Yippee.webp",
};

export default brandLogos;
