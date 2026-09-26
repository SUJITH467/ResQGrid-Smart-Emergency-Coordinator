/**
 * utils.js
 * --------
 * Shared utility functions for ResQGrid.
 * Pure functions only — no DOM access, no LocalStorage access.
 */

// ── Logger ─────────────────────────────────────────────────────────────────
// Toggle DEBUG to false in production to silence info/warn messages.
const DEBUG = true;

export const logger = {
  info:  (...args) => { if (DEBUG) console.info('[ResQGrid]',  ...args); },
  warn:  (...args) => { if (DEBUG) console.warn('[ResQGrid]',  ...args); },
  error: (...args) => {            console.error('[ResQGrid]', ...args); },
};

// ── Allowed enum values ────────────────────────────────────────────────────
// Single source of truth for enum validation.
// These must match the canonical values in data-models.md exactly.

export const INCIDENT_TYPES = [
  'Fire',
  'Medical',
  'Security',
  'Hazmat',
  'Natural Disaster',
  'Other',
];

export const INCIDENT_PRIORITIES = [
  'Critical',
  'High',
  'Medium',
  'Low',
];

// Priority ordering: index 0 = highest. Used for sorting.
export const PRIORITY_ORDER = {
  Critical: 0,
  High:     1,
  Medium:   2,
  Low:      3,
};

export const INCIDENT_STATUSES = [
  'Reported',
  'Active',
  'In Progress',
  'Resolved',
];

// Status ordering: index 0 = earliest in lifecycle.
export const STATUS_ORDER = {
  Reported:    0,
  Active:      1,
  'In Progress': 2,
  Resolved:    3,
};

export const RESOURCE_TYPES = [
  'Ambulance',
  'Fire Truck',
  'Police Unit',
  'Hazmat Team',
  'Medical Team',
  'Utility Crew',
  'Other',
];

export const RESOURCE_STATUSES = [
  'Available',
  'Deployed',
  'Maintenance',
];

// ── ID Generation ──────────────────────────────────────────────────────────

/**
 * Generate the next ID in the ResQGrid format: PREFIX-NNNN
 * Finds the highest existing numeric suffix and increments by 1.
 *
 * @param {'INC'|'RES'|'LOG'} prefix       - The ID prefix
 * @param {Array<Object>}      existingItems - Existing records with an `id` field
 * @returns {string} e.g. "INC-0042"
 */
export function generateId(prefix, existingItems = []) {
  const pattern = new RegExp(`^${prefix}-(\\d{4})$`);

  let maxNum = 0;
  existingItems.forEach((item) => {
    const match = item.id && item.id.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  const nextNum = maxNum + 1;
  // Zero-pad to 4 digits.
  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

// ── Timestamps ─────────────────────────────────────────────────────────────

/**
 * Return the current date and time as an ISO 8601 UTC string.
 * Use this everywhere a timestamp is needed — never use `new Date()` directly.
 *
 * @returns {string} e.g. "2024-03-15T09:30:00.000Z"
 */
export function getNow() {
  return new Date().toISOString();
}

// ── Date Formatting ────────────────────────────────────────────────────────

/**
 * Format an ISO 8601 string as a human-readable date/time.
 * e.g. "15 Mar 2024, 09:30"
 *
 * @param {string} isoString - An ISO 8601 date string
 * @returns {string} Formatted string, or "Unknown" if the input is invalid
 */
export function formatDate(isoString) {
  if (!isoString) return 'Unknown';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format an ISO 8601 string as a relative time label.
 * e.g. "2 hours ago", "Just now"
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const diffMs      = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours   = Math.floor(diffMinutes / 60);
  const diffDays    = Math.floor(diffHours / 24);

  if (diffMinutes < 1)  return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours   < 24) return `${diffHours} hr ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

/**
 * Format a duration in minutes into a human-readable string.
 * Used by the statistics dashboard.
 *
 * @param {number|null} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A';
  if (minutes < 1)    return '< 1 min';
  if (minutes < 60)   return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60 * 10) / 10} hrs`;
  return `${Math.round(minutes / 1440 * 10) / 10} days`;
}

// ── Text Utilities ─────────────────────────────────────────────────────────

/**
 * Truncate a string to a maximum length, appending "…" if truncated.
 *
 * @param {string} str       - The source string
 * @param {number} maxLength - Maximum character count before truncation
 * @returns {string}
 */
export function truncateText(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Escape HTML special characters to prevent XSS when inserting
 * user-provided text into innerHTML.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ── Validation Helpers ─────────────────────────────────────────────────────

/**
 * Check that a string value is non-empty after trimming.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check that a string value is within a min/max character range (after trim).
 *
 * @param {*}      value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
export function isWithinLength(value, min, max) {
  if (!isNonEmptyString(value)) return false;
  const len = value.trim().length;
  return len >= min && len <= max;
}

/**
 * Check that a value is one of the allowed enum values.
 *
 * @param {*}        value
 * @param {string[]} allowedValues
 * @returns {boolean}
 */
export function isValidEnum(value, allowedValues) {
  return allowedValues.includes(value);
}

/**
 * Check that a date string parses to a valid date.
 *
 * @param {string} isoString
 * @returns {boolean}
 */
export function isValidDate(isoString) {
  if (!isoString) return false;
  return !isNaN(Date.parse(isoString));
}

// ── Number Formatting ──────────────────────────────────────────────────────

/**
 * Format a number with thousands separators.
 * Falls back to plain toString() if toLocaleString is unavailable.
 *
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  try {
    return num.toLocaleString('en-GB');
  } catch {
    return String(num);
  }
}

/**
 * Safely calculate a percentage, guarding against division by zero.
 * Returns 0 if total is 0.
 *
 * @param {number} count
 * @param {number} total
 * @param {number} [decimalPlaces=1]
 * @returns {number}
 */
export function calcPercentage(count, total, decimalPlaces = 1) {
  if (total === 0) return 0;
  const raw = (count / total) * 100;
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(raw * factor) / factor;
}
