/**
 * Helper utilities for working with and safely displaying Order data
 */

/**
 * Safely extracts a human-readable display string for an order delivery slot.
 * Prevents "Objects are not valid as a React child (found: object with keys {from, to, label})"
 * when order.slot is stored as an object { label, from, to } in the database.
 *
 * @param {string|object|null|undefined} slot - The slot value from the order
 * @param {string} [fallback='4–6 PM'] - Fallback label if slot is missing
 * @returns {string} Human-readable slot label
 */
export function formatDeliverySlot(slot, fallback = '4–6 PM') {
  if (!slot) return fallback;
  if (typeof slot === 'string') return slot.trim() || fallback;
  if (typeof slot === 'object') {
    if (slot.label && typeof slot.label === 'string' && slot.label.trim()) {
      return slot.label.trim();
    }
    if (slot.from && slot.to) {
      return `${slot.from}–${slot.to}`;
    }
    if (slot.from) return String(slot.from);
    if (slot.to) return String(slot.to);
    return fallback;
  }
  return String(slot);
}
