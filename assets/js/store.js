/**
 * store.js
 * --------
 * LocalStorage abstraction for ResQGrid.
 * All services must use store.get() and store.set() exclusively.
 * Never call localStorage directly from UI components.
 */

import { logger } from './utils.js';

// ── Storage key constants ──────────────────────────────────────────────────
export const STORAGE_KEYS = {
  INCIDENTS:     'resqgrid_incidents',
  RESOURCES:     'resqgrid_resources',
  ASSISTANT_LOG: 'resqgrid_assistant_log',
  SETTINGS:      'resqgrid_settings',
};

// ── Default values returned when a key is empty or corrupted ──────────────
const DEFAULTS = {
  [STORAGE_KEYS.INCIDENTS]:     [],
  [STORAGE_KEYS.RESOURCES]:     [],
  [STORAGE_KEYS.ASSISTANT_LOG]: [],
  [STORAGE_KEYS.SETTINGS]:      {},
};

/**
 * Check whether localStorage is available in this browser environment.
 * Returns true if available, false otherwise.
 */
function isStorageAvailable() {
  try {
    const testKey = '__resqgrid_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Cache the availability check so we only run it once.
const STORAGE_AVAILABLE = isStorageAvailable();

/**
 * Validate that a parsed value has the expected shape for a given key.
 * For array keys, the value must be an array.
 * For object keys, the value must be a plain object.
 *
 * @param {string} key   - One of STORAGE_KEYS values
 * @param {*}      value - The parsed value to validate
 * @returns {boolean}
 */
function isValidShape(key, value) {
  const defaultValue = DEFAULTS[key];
  if (Array.isArray(defaultValue)) {
    return Array.isArray(value);
  }
  if (typeof defaultValue === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  return true;
}

/**
 * Read a value from LocalStorage.
 * Returns the parsed value, or the default for that key if missing/corrupted.
 *
 * @param {string} key - One of STORAGE_KEYS values
 * @returns {Array|Object}
 */
export function storeGet(key) {
  if (!STORAGE_AVAILABLE) {
    logger.warn(`store.get: localStorage unavailable. Returning default for "${key}".`);
    return structuredClone(DEFAULTS[key] ?? null);
  }

  try {
    const raw = localStorage.getItem(key);

    // Key does not exist yet — return default (not an error).
    if (raw === null) {
      return structuredClone(DEFAULTS[key] ?? null);
    }

    const parsed = JSON.parse(raw);

    // Shape validation: if parsed value has wrong structure, reset to default.
    if (key in DEFAULTS && !isValidShape(key, parsed)) {
      logger.warn(
        `store.get: Data for "${key}" failed shape validation. ` +
        `Expected ${Array.isArray(DEFAULTS[key]) ? 'array' : 'object'}, ` +
        `got ${typeof parsed}. Resetting to default.`
      );
      storeSet(key, DEFAULTS[key]);
      return structuredClone(DEFAULTS[key]);
    }

    return parsed;
  } catch (err) {
    logger.warn(`store.get: Failed to parse data for "${key}". Resetting to default. Error: ${err.message}`);
    // Overwrite corrupted data with the safe default.
    storeSet(key, DEFAULTS[key]);
    return structuredClone(DEFAULTS[key] ?? null);
  }
}

/**
 * Write a value to LocalStorage.
 * Returns true on success, false on failure.
 *
 * @param {string}       key   - One of STORAGE_KEYS values
 * @param {Array|Object} value - The value to serialize and store
 * @returns {boolean}
 */
export function storeSet(key, value) {
  if (!STORAGE_AVAILABLE) {
    logger.warn(`store.set: localStorage unavailable. Could not save "${key}".`);
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // QuotaExceededError or other write failures.
    if (err.name === 'QuotaExceededError') {
      logger.warn(`store.set: Storage quota exceeded. Could not save "${key}".`);
    } else {
      logger.warn(`store.set: Failed to write "${key}". Error: ${err.message}`);
    }
    return false;
  }
}

/**
 * Remove a key from LocalStorage.
 * Returns true on success, false on failure.
 *
 * @param {string} key - One of STORAGE_KEYS values
 * @returns {boolean}
 */
export function storeRemove(key) {
  if (!STORAGE_AVAILABLE) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    logger.warn(`store.remove: Failed to remove "${key}". Error: ${err.message}`);
    return false;
  }
}

/**
 * Check whether localStorage is available (exposed for UI banner use).
 * @returns {boolean}
 */
export function isLocalStorageAvailable() {
  return STORAGE_AVAILABLE;
}

/**
 * Initialize all known LocalStorage keys with their defaults
 * if they do not already exist. Called once on app startup.
 */
export function initStore() {
  // If localStorage is unavailable, skip initialization silently.
  // The app will function without persistence and app.js will show the banner.
  if (!STORAGE_AVAILABLE) {
    logger.warn('store.init: localStorage unavailable — skipping initialization.');
    return;
  }

  Object.values(STORAGE_KEYS).forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null && key in DEFAULTS) {
      storeSet(key, DEFAULTS[key]);
      logger.info(`store.init: Initialized "${key}" with default value.`);
    }
  });
}
