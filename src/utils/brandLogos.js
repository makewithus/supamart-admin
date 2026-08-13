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
  "786": "/brand-logos/786.png",
  "Anus": "/brand-logos/Anus.png",
  "AVT": "/brand-logos/AVT.png",
  "Bakers": "/brand-logos/Bakers.png",
  "Bharath": "/brand-logos/Bharath.png",
  "Boost": "/brand-logos/Boost.png",
  "Bounty": "/brand-logos/Bounty.png",
  "Britannia": "/brand-logos/Britannia.png",
  "Bru": "/brand-logos/Bru.png",
  "Clear": "/brand-logos/Clear.png",
  "Clinic Plus": "/brand-logos/Clinic%20Plus.png",
  "Closeup": "/brand-logos/Closeup.png",
  "Comfort": "/brand-logos/Comfort.png",
  "Cycle": "/brand-logos/Cycle.png",
  "Dabur": "/brand-logos/Dabur.png",
  "Devon": "/brand-logos/Devon.png",
  "Dolphin": "/brand-logos/Dolphin.png",
  "Dove": "/brand-logos/Dove.png",
  "Elite": "/brand-logos/Elite.png",
  "Exo": "/brand-logos/Exo.png",
  "Glow & Lovely": "/brand-logos/Glow%20%26%20Lovely.png",
  "Hamam": "/brand-logos/Hamam.png",
  "Hellmann's": "/brand-logos/Hellmann's.png",
  "Horlicks": "/brand-logos/Horlicks.png",
  "Indulekha": "/brand-logos/Indulekha.png",
  "Kellogg's": "/brand-logos/Kellogg's.png",
  "Kissan": "/brand-logos/Kissan.png",
  "Kit Kat": "/brand-logos/Kit%20Kat.png",
  "Kitchen King": "/brand-logos/Kitchen%20King.png",
  "Knorr": "/brand-logos/Knorr.png",
  "KP": "/brand-logos/KP.png",
  "Lifebuoy": "/brand-logos/Lifebuoy.png",
  "Lipton": "/brand-logos/Lipton.png",
  "Liril": "/brand-logos/Liril.png",
  "Lux": "/brand-logos/Lux.png",
  "Maggi": "/brand-logos/Maggi.png",
  "Maharaja": "/brand-logos/Maharaja.png",
  "Maxo": "/brand-logos/Maxo.png",
  "Medimix": "/brand-logos/Medimix.png",
  "Milma": "/brand-logos/Milma.png",
  "Munch": "/brand-logos/Munch.png",
  "Nescafe": "/brand-logos/Nescafe.png",
  "Nirmal": "/brand-logos/Nirmal.png",
  "Pavithram": "/brand-logos/Pavithram.png",
  "Pears": "/brand-logos/Pears.png",
  "Pepsodent": "/brand-logos/Pepsodent.png",
  "Pond's": "/brand-logos/Pond's.png",
  "Power": "/brand-logos/Power.png",
  "Prakrithi": "/brand-logos/Prakrithi.png",
  "Pran": "/brand-logos/Pran.png",
  "Pringles": "/brand-logos/Pringles.png",
  "Pulari": "/brand-logos/Pulari.png",
  "Quaker": "/brand-logos/Quaker.png",
  "Red Label": "/brand-logos/Red%20Label.png",
  "Rexona": "/brand-logos/Rexona.png",
  "Rin": "/brand-logos/Rin.png",
  "Ruchi Gold": "/brand-logos/Ruchi%20Gold.png",
  "Sara": "/brand-logos/Sara.png",
  "Santoor": "/brand-logos/Santoor.png",
  "Sensodyne": "/brand-logos/Sensodyne.png",
  "Snickers": "/brand-logos/Snickers.png",
  "SSK": "/brand-logos/SSK.png",
  "Sunfeast": "/brand-logos/Sunfeast.png",
  "Sunlight": "/brand-logos/Sunlight.png",
  "Sunsilk": "/brand-logos/Sunsilk.png",
  "Surf Excel": "/brand-logos/Surf%20Excel.png",
  "Taaza": "/brand-logos/Taaza.png",
  "Taj Mahal": "/brand-logos/Taj%20Mahal.png",
  "TRESemmé": "/brand-logos/TRESemm%C3%A9.png",
  "True Blue": "/brand-logos/True%20Blue.png",
  "TT": "/brand-logos/TT.png",
  "Ujala": "/brand-logos/Ujala.png",
  "UT": "/brand-logos/UT.png",
  "VWash": "/brand-logos/VWash.png",
  "Vim": "/brand-logos/Vim.png",
  "Wheel": "/brand-logos/Wheel.png",
  "Yardley": "/brand-logos/Yardley.png",
  "Yippee": "/brand-logos/Yippee.png",
};

export default brandLogos;
