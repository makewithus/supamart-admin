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

/**
 * Safely extracts a human-readable display string for order delivery instructions.
 * Prevents "Objects are not valid as a React child (found: object with keys {landmark, combinedNote, ...})"
 * when order.deliveryInstructions or order.instructions is stored as an object.
 *
 * @param {string|object|null|undefined} instructions - The raw delivery instructions from the order
 * @param {string} [fallback=''] - Fallback label if instructions are missing
 * @returns {string} Human-readable delivery instructions
 */
export function formatDeliveryInstructions(instructions, fallback = '') {
  if (!instructions) return fallback;
  if (typeof instructions === 'string') {
    const trimmed = instructions.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return formatDeliveryInstructions(parsed, fallback);
        }
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof instructions === 'object') {
    if (typeof instructions.combinedNote === 'string' && instructions.combinedNote.trim()) {
      return instructions.combinedNote.trim();
    }
    if (typeof instructions.summary === 'string' && instructions.summary.trim()) {
      return instructions.summary.trim();
    }
    if (typeof instructions.additionalNotes === 'string' && instructions.additionalNotes.trim()) {
      return instructions.additionalNotes.trim();
    }
    if (Array.isArray(instructions.selectedLabels) && instructions.selectedLabels.length > 0) {
      const labels = instructions.selectedLabels
        .filter((l) => typeof l === 'string' && l.trim())
        .join('; ');
      if (labels) return labels;
    }
    if (typeof instructions.landmark === 'string' && instructions.landmark.trim()) {
      return `Landmark: ${instructions.landmark.trim()}`;
    }
    if (typeof instructions.gateDetails === 'string' && instructions.gateDetails.trim()) {
      return `Gate: ${instructions.gateDetails.trim()}`;
    }
    const stringValues = Object.entries(instructions)
      .filter(([k, v]) => typeof v === 'string' && v.trim() && !['id', '_id'].includes(k))
      .map(([k, v]) => `${k}: ${v}`);
    if (stringValues.length > 0) return stringValues.join(', ');
    return fallback;
  }
  return String(instructions);
}

/**
 * Safely formats an address or addressSnapshot object into a human-readable string.
 * Prevents object-rendering errors if address fields are unexpected shapes.
 *
 * @param {string|object|null|undefined} rawAddr - Address string or object
 * @param {string} [fallback='Address on file'] - Fallback address text
 * @returns {string} Formatted address string
 */
export function formatAddress(rawAddr, fallback = 'Address on file') {
  if (!rawAddr) return fallback;
  if (typeof rawAddr === 'string') return rawAddr.trim() || fallback;
  if (typeof rawAddr === 'object') {
    if (typeof rawAddr.formattedAddress === 'string' && rawAddr.formattedAddress.trim()) {
      return rawAddr.formattedAddress.trim();
    }
    const parts = [rawAddr.houseNo, rawAddr.street, rawAddr.landmark, rawAddr.city, rawAddr.pincode]
      .filter((p) => (typeof p === 'string' && p.trim()) || typeof p === 'number');
    if (parts.length > 0) return parts.join(', ');
    return fallback;
  }
  return String(rawAddr);
}
