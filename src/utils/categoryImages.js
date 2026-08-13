// Maps slugify(category.name) to its locally-bundled image, served from
// /public/category-images/ — the same cleaned photos the customer app bundles
// via require() (see customer/src/utils/categoryImages.js, which this file
// mirrors key-for-key). Categories.jsx checks this before falling back to the
// category's own remote `image` URL. The old Detergent/Dishwash/Bathing Soap/
// Hair Care/Oral-Care/Face Wash/Talc & Grooming/Feminine Hygiene/Tea & Coffee/
// Health Food Drinks/Sauces & Spreads/Breakfast categories no longer exist;
// they were consolidated (backend/src/jobs/consolidateCategories.js) into
// "Household & Cleaning", "Personal Care", "Beverages & Health Drinks", and
// "Sauces, Pickles & Condiments" — then "Beverages & Health Drinks" was split
// back into two separate top-level categories, "Beverages" and "Health Drinks"
// (backend/src/jobs/splitBeveragesAndHealthDrinks.js), per the client's
// correction that they're different categories to the shop. One representative
// icon from each absorbed group is reused for its merged/split parent below.

const categoryImages = {
  "household-cleaning": "/category-images/Detergent.webp",
  "personal-care": "/category-images/Bath%20and%20Hygiene.webp",
  "beverages": "/category-images/Beverages.webp",
  "health-drinks": "/category-images/Health%20Food%20Drinks.webp",
  "sauces-pickles-condiments": "/category-images/Packaged%20Foods.webp",
};

export default categoryImages;
