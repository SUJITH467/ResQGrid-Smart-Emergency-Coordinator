/**
 * test-globals-preload.cjs
 * ------------------------
 * CommonJS preload script for Node.js.
 * Run with: node --require ./test-globals-preload.cjs <esm-file>
 *
 * Sets up browser globals (localStorage, structuredClone) BEFORE any
 * ES module is evaluated, working around ESM top-level import hoisting.
 */

const _store = new Map();

global.localStorage = {
  getItem:    (k)    => _store.has(k) ? _store.get(k) : null,
  setItem:    (k, v) => { _store.set(k, String(v)); },
  removeItem: (k)    => { _store.delete(k); },
  clear:      ()     => { _store.clear(); },
};

if (typeof global.structuredClone !== 'function') {
  global.structuredClone = (v) => JSON.parse(JSON.stringify(v));
}

// Expose the store map so tests can reset it or inspect raw values.
global._testStore = _store;
