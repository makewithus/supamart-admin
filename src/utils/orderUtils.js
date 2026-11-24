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

function deduplicatePhrases(text) {
  if (!text || typeof text !== 'string') return '';
  const parts = text.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (const p of parts) {
    const key = p.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  return deduped.join('; ');
}

/**
 * Safely extracts a human-readable display string for order delivery instructions.
 * Prevents "Objects are not valid as a React child (found: object with keys {landmark, combinedNote, ...})"
 * when order.deliveryInstructions or order.instructions is stored as an object,
 * and deduplicates repeated phrases.
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
        return deduplicatePhrases(trimmed) || fallback;
      }
    }
    return deduplicatePhrases(trimmed) || fallback;
  }
  if (typeof instructions === 'object') {
    if (typeof instructions.combinedNote === 'string' && instructions.combinedNote.trim()) {
      return deduplicatePhrases(instructions.combinedNote.trim()) || fallback;
    }
    if (typeof instructions.summary === 'string' && instructions.summary.trim()) {
      return deduplicatePhrases(instructions.summary.trim()) || fallback;
    }
    if (typeof instructions.additionalNotes === 'string' && instructions.additionalNotes.trim()) {
      return deduplicatePhrases(instructions.additionalNotes.trim()) || fallback;
    }
    if (Array.isArray(instructions.selectedLabels) && instructions.selectedLabels.length > 0) {
      const labels = instructions.selectedLabels
        .filter((l) => typeof l === 'string' && l.trim())
        .join('; ');
      if (labels) return deduplicatePhrases(labels) || fallback;
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
    if (stringValues.length > 0) return deduplicatePhrases(stringValues.join(', ')) || fallback;
    return fallback;
  }
  return deduplicatePhrases(String(instructions)) || fallback;
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

/**
 * Returns human-readable label and Tailwind styling classes for an order status.
 *
 * @param {string} status - Raw order status
 * @param {boolean} [isRedelivery=false] - Whether this order is a free replacement
 * @returns {{ label: string, bgClass: string }}
 */
export function getStatusBadgeConfig(status, isRedelivery = false) {
  if (isRedelivery) {
    return {
      label: 'Free Replacement',
      bgClass: 'bg-purple-100 text-purple-800 border-purple-200',
    };
  }
  const s = String(status || '').toUpperCase().trim();
  switch (s) {
    case 'ORDER_PLACED':
    case 'PLACED':
    case 'NEW':
      return { label: 'New Order', bgClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'ORDER_ACCEPTED':
    case 'ACCEPTED':
      return { label: 'Order Accepted', bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'PACKING':
    case 'READY_FOR_DELIVERY':
      return { label: 'Packing', bgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for Delivery', bgClass: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
    case 'PENDING_CONFIRMATION':
      return { label: 'Awaiting Confirmation', bgClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'DELIVERED':
      return { label: 'Delivered', bgClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'CANCELLED':
      return { label: 'Cancelled', bgClass: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'DISPUTED':
      return { label: 'Disputed', bgClass: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:
      return {
        label: s ? s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'New Order',
        bgClass: 'bg-gray-100 text-gray-700 border-gray-200',
      };
  }
}
