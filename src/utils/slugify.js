// Mirrors customer/src/utils/slugify.js exactly — turns a category/sub-category
// `name` into the same stable lookup key used for the customer app's local image
// maps, e.g. "Tea & Coffee" -> "tea-coffee", "Bathing Soap" -> "bathing-soap".
export default function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
