/**
 * router.js
 * ---------
 * Hash-based SPA router for ResQGrid.
 * Listens for URL hash changes and renders the matching section.
 *
 * Supported routes:
 *   #dashboard  → Dashboard overview
 *   #incidents  → Incident management
 *   #resources  → Resource management
 *   #assistant  → Decision-support assistant
 *   #stats      → Statistics dashboard
 */

import { logger } from './utils.js';

// ── Route definitions ──────────────────────────────────────────────────────
// Each route maps a hash to a section element ID and a render function.
// Render functions are registered by each feature module via router.register().

/** @type {Map<string, Function>} */
const routes = new Map();

/** The default route shown when no hash is present or hash is unknown. */
const DEFAULT_ROUTE = '#dashboard';

/** All valid section element IDs, one per route. */
const SECTION_IDS = {
  '#dashboard': 'section-dashboard',
  '#incidents': 'section-incidents',
  '#resources': 'section-resources',
  '#assistant': 'section-assistant',
  '#stats':     'section-stats',
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Register a render function for a given route hash.
 * The render function is called with the section's root element each time
 * the route becomes active.
 *
 * @param {string}   hash     - e.g. '#incidents'
 * @param {Function} renderFn - Called with (sectionElement) when route activates
 */
export function registerRoute(hash, renderFn) {
  routes.set(hash, renderFn);
  logger.info(`router: Registered route "${hash}".`);
}

/**
 * Navigate programmatically to a route.
 * Equivalent to the user clicking a nav link.
 *
 * @param {string} hash - e.g. '#resources'
 */
export function navigateTo(hash) {
  window.location.hash = hash;
}

/**
 * Return the currently active route hash.
 * Falls back to DEFAULT_ROUTE if hash is missing or unknown.
 *
 * @returns {string}
 */
export function getCurrentRoute() {
  const hash = window.location.hash;
  return hash in SECTION_IDS ? hash : DEFAULT_ROUTE;
}

/**
 * Initialise the router.
 * - Attaches the hashchange listener.
 * - Renders the current route immediately.
 * Call this once from app.js after all routes are registered.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  // Render the initial route on page load.
  handleRouteChange();
  logger.info('router: Initialized.');
}

// ── Internal ───────────────────────────────────────────────────────────────

/**
 * Called whenever the URL hash changes.
 * Shows the matching section, hides all others, calls the render function.
 */
function handleRouteChange() {
  const activeHash = getCurrentRoute();

  // Show/hide sections.
  Object.entries(SECTION_IDS).forEach(([hash, sectionId]) => {
    const el = document.getElementById(sectionId);
    if (!el) {
      logger.warn(`router: Section element "#${sectionId}" not found in DOM.`);
      return;
    }
    const isActive = hash === activeHash;
    el.hidden = !isActive;
    el.setAttribute('aria-hidden', String(!isActive));
  });

  // Update nav link active states.
  updateNavLinks(activeHash);

  // Call the registered render function if one exists.
  const renderFn = routes.get(activeHash);
  const sectionEl = document.getElementById(SECTION_IDS[activeHash]);

  if (renderFn && sectionEl) {
    try {
      renderFn(sectionEl);
    } catch (err) {
      logger.error(`router: Render function for "${activeHash}" threw an error.`, err);
    }
  }

  // Update the document title.
  document.title = `ResQGrid — ${getRouteTitle(activeHash)}`;

  logger.info(`router: Navigated to "${activeHash}".`);
}

/**
 * Update the active CSS class on navigation links.
 *
 * @param {string} activeHash
 */
function updateNavLinks(activeHash) {
  const navLinks = document.querySelectorAll('[data-nav-link]');
  navLinks.forEach((link) => {
    const linkHash = link.getAttribute('href');
    const isActive = linkHash === activeHash;
    link.classList.toggle('nav__link--active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

/**
 * Return a human-readable page title for a route hash.
 *
 * @param {string} hash
 * @returns {string}
 */
function getRouteTitle(hash) {
  const titles = {
    '#dashboard': 'Dashboard',
    '#incidents': 'Incidents',
    '#resources': 'Resources',
    '#assistant': 'Decision Support',
    '#stats':     'Statistics',
  };
  return titles[hash] ?? 'Dashboard';
}

// Export SECTION_IDS so app.js can build the sections.
export { SECTION_IDS };
