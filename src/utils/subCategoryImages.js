// Maps slugify(parentCategoryName) + "-" + slugify(subCategoryName) to its
// locally-bundled image, served from /public/subcategory-images/ or
// /public/product-images/ — the same cleaned photos the customer app bundles
// via require() (see customer/src/utils/subCategoryImages.js, which this file
// mirrors key-for-key). Categories.jsx checks this before falling back to the
// sub-category's own remote `image` URL. Keys match the REAL parent/sub-category
// names in Firestore after the taxonomy consolidation (backend/src/jobs/
// consolidateCategories.js: 28 top-level categories merged down to 14) —
// "Detergent"/"Dishwash" are now "Household & Cleaning", "Hair Care"/
// "Oral-Care"/"Face Wash"/"Feminine Hygiene"/"Bathing Soap"/"Talc & Grooming"
// are now "Personal Care", and "Sauces & Spreads"/"Breakfast" are now
// "Sauces, Pickles & Condiments". "Tea & Coffee"/"Health Food Drinks" were
// briefly merged into "Beverages & Health Drinks" and then split back into
// two separate top-level categories, "Beverages" and "Health Drinks"
// (backend/src/jobs/splitBeveragesAndHealthDrinks.js), per the client's
// correction that they're different categories to the shop. The underlying
// image files were never touched by any of this — only the lookup keys
// needed updating.
//
// The sub-categories added by backend/src/jobs/subcategorizeRemaining.js (Cooking
// Oils & Ghee, Dairy, Spices & Masala, Rice/Atta/Grains, Instant/Ready-to-Cook
// Mixes, Dry Fruits & Nuts, Fresh Vegetables) have no dedicated icon shoot.
// Per the client, reuse an actual product photo already in that sub-category as
// its icon (served from /product-images/, same as productImages.js) instead of
// leaving it blank until a dedicated icon is shot.
//
// There is no real "Skin-Care" parent category yet — those entries are kept in
// case one's added later with matching sub-category names.

const subCategoryImages = {
  // Household & Cleaning (formerly Detergent + Dishwash)
  "household-cleaning-detergent-powder": "/subcategory-images/Powder.webp",
  "household-cleaning-detergent-bars": "/subcategory-images/Detergent%20Bars.webp",
  "household-cleaning-detergent-liquid": "/subcategory-images/Detergent%20Liquid.webp",
  "household-cleaning-fabric-conditioner": "/subcategory-images/Fabric%20Conditioner.webp",
  "household-cleaning-bleach": "/subcategory-images/Bleach.webp",
  "household-cleaning-dishwash-bars": "/subcategory-images/Dishwash%20Bars.webp",
  "household-cleaning-dishwash-liquid": "/subcategory-images/Dishwash%20Liquid.webp",
  "household-cleaning-fabric-whitener": "/product-images/Ujala%20Crystal%20White%20Liquid.webp",
  "household-cleaning-mosquito-repellent": "/product-images/Maxo%20Coil%20Mosquito%20Repellent.webp",

  // Personal Care (formerly Bathing Soap + Hair Care + Oral-Care + Face Wash + Feminine Hygiene)
  "personal-care-soaps": "/subcategory-images/Soaps.webp",
  "personal-care-hand-wash": "/subcategory-images/Hand%20Wash.webp",
  "personal-care-shampoo": "/subcategory-images/Shampoo.webp",
  "personal-care-hair-oil": "/subcategory-images/Hair%20Oil.webp",
  "personal-care-conditioner": "/subcategory-images/Conditioner.webp",
  "personal-care-oral-care": "/subcategory-images/Toothpaste.webp",
  "personal-care-face-wash-men": "/subcategory-images/Men.webp",
  "personal-care-face-wash-women": "/subcategory-images/Women.webp",
  "personal-care-feminine-hygiene": "/subcategory-images/Intimate%20Wash.webp",

  // Beverages (formerly Tea & Coffee, folded into "Beverages & Health Drinks",
  // then split back out as its own top-level category)
  "beverages-tea": "/subcategory-images/Tea.webp",
  "beverages-coffee": "/subcategory-images/Coffee.webp",

  // Health Drinks (formerly Health Food Drinks, folded into "Beverages & Health
  // Drinks", then split back out as its own top-level category)
  "health-drinks-health-energy-drinks": "/subcategory-images/Health%20Drink%20and%20Supplements.webp",

  // Sauces, Pickles & Condiments (formerly Sauces & Spreads + Breakfast)
  "sauces-pickles-condiments-sauces-ketchup": "/subcategory-images/Sauces%20and%20Ketchup.webp",
  "sauces-pickles-condiments-soup": "/subcategory-images/Soup.webp",
  "sauces-pickles-condiments-chutneys-jam": "/subcategory-images/Jam.webp",
  "sauces-pickles-condiments-pickles": "/product-images/Anus%20Mango%20Pickle.webp",

  // Snacks & Confectionery — icons borrowed from a representative product photo
  "snacks-confectionery-chips": "/product-images/Pringles%20Original.webp",
  "snacks-confectionery-noodles-pasta": "/product-images/Maggi%202-Minute%20Noodles.webp",
  "snacks-confectionery-biscuits-cookies": "/product-images/Good%20Day%20Chocochip.webp",
  "snacks-confectionery-chocolates-confectionery": "/product-images/Kit%20Kat%20Miniatures.webp",

  // Beverages — icon borrowed from a representative product photo
  "beverages-fruit-drinks-desserts": "/product-images/Pran%20Litchi%20Drink.webp",

  // Cooking Oils & Ghee — icons borrowed from a representative product photo
  "cooking-oils-ghee-cooking-oils": "/product-images/Prakrithi%20Coconut%20Oil.webp",
  "cooking-oils-ghee-ghee": "/product-images/Milma%20Ghee.webp",

  // Dairy — icons borrowed from a representative product photo
  "dairy-butter": "/product-images/Milma%20Butter.webp",
  "dairy-paneer": "/product-images/Milma%20Paneer.webp",
  "dairy-dairy-sweets": "/product-images/Milma%20Ghee%20Cake%20Choco%20Brownie.webp",

  // Spices & Masala — icons borrowed from a representative product photo
  "spices-masala-masala-powders": "/product-images/Turmeric%20Powder.webp",
  "spices-masala-asafoetida": "/product-images/TT%20Asafoetida%20Cake.webp",
  "spices-masala-herbs-pastes": "/product-images/Ginger%20Garlic%20Paste.webp",

  // Rice, Atta & Grains — icons borrowed from a representative product photo
  "rice-atta-grains-rice": "/product-images/SSK%20Ponni%20Rice%201st.webp",
  "rice-atta-grains-atta-maida-flour": "/product-images/Elite%20Atta.webp",
  "rice-atta-grains-pulses-dals": "/product-images/Kadala%20Paruppu%20Chana%20Dal.webp",
  "rice-atta-grains-jaggery-sweeteners": "/product-images/Sarkara%20Jaggery.webp",

  // Instant / Ready-to-Cook Mixes — icons borrowed from a representative product photo
  "instant-ready-to-cook-mixes-idiyappam-puttu-mixes": "/product-images/UT%20Puttu%20Podi.webp",
  "instant-ready-to-cook-mixes-breakfast-cereals": "/product-images/Kellogg's%20Corn%20Flakes.webp",
  "instant-ready-to-cook-mixes-rava-vermicelli-payasam-mix": "/product-images/UT%20Uppuma%20Rava.webp",
  "instant-ready-to-cook-mixes-health-traditional-mixes": "/product-images/DH%20Roast%20Ragi%20Powder.webp",

  // Dry Fruits & Nuts — icons borrowed from a representative product photo
  "dry-fruits-nuts-nuts-raisins": "/product-images/Gold%20Walnut.webp",
  "dry-fruits-nuts-flours-syrups": "/product-images/Dates%20Syrup.webp",

  // Fresh Vegetables — icons borrowed from a representative product photo
  "fresh-vegetables-vegetables": "/product-images/Potato.webp",
  "fresh-vegetables-leafy-greens-herbs": "/product-images/Curry%20Leaves%20K.%20Leaves.webp",
  "fresh-vegetables-fruits": "/product-images/Mango.webp",
  "fresh-vegetables-pooja-flowers": "/product-images/Flowers%20assorted%2C%20for%20pooja.webp",

  // No real parent category yet — kept in case one's added later with matching sub-category names
  "skin-care-body-lotion": "/subcategory-images/Body%20Lotion.webp",
  "skin-care-cream": "/subcategory-images/Cream.webp",
  "skin-care-moisturiser": "/subcategory-images/Moisturiser.webp",
  "skin-care-petroleum-jelly": "/subcategory-images/Petroleum%20Jelly.webp",
  "skin-care-sunscreen": "/subcategory-images/Sunscreen.webp",
};

export default subCategoryImages;
