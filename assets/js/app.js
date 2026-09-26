/**
 * app.js
 * ------
 * ResQGrid application entry point.
 * Initialises the store, registers placeholder routes, and starts the router.
 *
 * Phase 1: Foundation only.
 * Placeholder render functions display empty states for each section.
 * Feature modules will replace these in later phases.
 */

import { initStore, isLocalStorageAvailable, STORAGE_KEYS } from './store.js';
import { initRouter, registerRoute }                        from './router.js';
import { logger, formatDate, getNow }                       from './utils.js';

// ── Application initialisation ─────────────────────────────────────────────

/**
 * Main entry point. Called when the DOM is ready.
 */
function init() {
  logger.info('app: Starting ResQGrid…');

  // 1. Initialise LocalStorage (creates default keys if absent).
  initStore();

  // 2. Show a warning banner if LocalStorage is unavailable.
  if (!isLocalStorageAvailable()) {
    showStorageWarningBanner();
  }

  // 3. Register placeholder render functions for each route.
  //    These will be replaced by feature modules in later phases.
  registerRoute('#dashboard', renderDashboard);
  registerRoute('#incidents', renderIncidents);
  registerRoute('#resources', renderResources);
  registerRoute('#assistant', renderAssistant);
  registerRoute('#stats',     renderStats);

  // 4. Start the router (renders the current route immediately).
  initRouter();

  logger.info('app: Ready.');
}

// ── Placeholder render functions ───────────────────────────────────────────
// Each function receives its section's root <section> element.
// Replace these with real feature modules in Phases 2–5.

/**
 * Render the Dashboard section.
 * Phase 1: Shows summary cards with empty states.
 *
 * @param {HTMLElement} el
 */
function renderDashboard(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Dashboard</h1>
        <p class="section-header__subtitle">Operational overview of ResQGrid</p>
      </div>
      <span class="badge badge--prototype">Educational Prototype</span>
    </div>

    ${buildPrototypeDisclaimer()}

    <div class="summary-cards" role="list" aria-label="Summary metrics">

      <article class="summary-card" role="listitem" aria-label="0 Active Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="summary-card__value">0</div>
        <div class="summary-card__label">Active Incidents</div>
        <div class="summary-card__sub">of 0 total</div>
      </article>

      <article class="summary-card summary-card--critical" role="listitem" aria-label="0 Critical Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="summary-card__value">0</div>
        <div class="summary-card__label">Critical Incidents</div>
        <div class="summary-card__sub">require immediate attention</div>
      </article>

      <article class="summary-card summary-card--resolved" role="listitem" aria-label="0 Resolved Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="summary-card__value">0</div>
        <div class="summary-card__label">Resolved Incidents</div>
        <div class="summary-card__sub">this session</div>
      </article>

      <article class="summary-card summary-card--available" role="listitem" aria-label="0 Available Resources">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="summary-card__value">0</div>
        <div class="summary-card__label">Available Resources</div>
        <div class="summary-card__sub">ready for deployment</div>
      </article>

      <article class="summary-card summary-card--deployed" role="listitem" aria-label="0 Deployed Resources">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
        <div class="summary-card__value">0</div>
        <div class="summary-card__label">Deployed Resources</div>
        <div class="summary-card__sub">currently active</div>
      </article>

      <article class="summary-card" role="listitem" aria-label="Resource utilization: N/A">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <div class="summary-card__value">N/A</div>
        <div class="summary-card__label">Utilization Rate</div>
        <div class="summary-card__sub">deployed / operational</div>
      </article>

      <article class="summary-card" role="listitem" aria-label="Average resolution time: N/A">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="summary-card__value">N/A</div>
        <div class="summary-card__label">Avg. Resolution Time</div>
        <div class="summary-card__sub">no resolved incidents yet</div>
      </article>

      <article class="summary-card" role="listitem" aria-label="0 Total Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div class="summary-card__value">0</div>
        <div class="summary-card__label">Total Incidents</div>
        <div class="summary-card__sub">all time</div>
      </article>

    </div>

    <div class="dashboard-quicklinks">
      <h2 class="dashboard-quicklinks__heading">Get started</h2>
      <div class="dashboard-quicklinks__grid">
        <a href="#incidents" class="quicklink-card">
          <div class="quicklink-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="quicklink-card__text">
            <strong>Report Incident</strong>
            <span>Log a new emergency incident</span>
          </div>
        </a>
        <a href="#resources" class="quicklink-card">
          <div class="quicklink-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="quicklink-card__text">
            <strong>Manage Resources</strong>
            <span>Add or view emergency resources</span>
          </div>
        </a>
        <a href="#assistant" class="quicklink-card">
          <div class="quicklink-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="quicklink-card__text">
            <strong>Decision Support</strong>
            <span>Analyze an incident description</span>
          </div>
        </a>
        <a href="#stats" class="quicklink-card">
          <div class="quicklink-card__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div class="quicklink-card__text">
            <strong>View Statistics</strong>
            <span>Review response performance</span>
          </div>
        </a>
      </div>
    </div>
  `;
}

/**
 * Render the Incidents section placeholder.
 * @param {HTMLElement} el
 */
function renderIncidents(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Incidents</h1>
        <p class="section-header__subtitle">Report and manage emergency incidents</p>
      </div>
      <span class="badge badge--prototype">Educational Prototype</span>
    </div>

    ${buildPrototypeDisclaimer()}

    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="empty-state__heading">Incident Management</h2>
      <p class="empty-state__message">
        This section will allow you to report, classify, and manage emergency incidents.
        Coming in Phase 2.
      </p>
      <p class="empty-state__detail">
        Features: report incident · assign priority · track status · view incident history
      </p>
    </div>
  `;
}

/**
 * Render the Resources section placeholder.
 * @param {HTMLElement} el
 */
function renderResources(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Resources</h1>
        <p class="section-header__subtitle">Manage and deploy emergency resources</p>
      </div>
      <span class="badge badge--prototype">Educational Prototype</span>
    </div>

    ${buildPrototypeDisclaimer()}

    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <h2 class="empty-state__heading">Resource Management</h2>
      <p class="empty-state__message">
        This section will allow you to add, track, and deploy emergency resources.
        Coming in Phase 3.
      </p>
      <p class="empty-state__detail">
        Features: add resources · assign to incidents · track availability · release resources
      </p>
    </div>
  `;
}

/**
 * Render the Decision-Support Assistant section placeholder.
 * @param {HTMLElement} el
 */
function renderAssistant(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Decision-Support Assistant</h1>
        <p class="section-header__subtitle">Rule-based incident classification tool</p>
      </div>
      <span class="badge badge--prototype">Prototype — Not AI</span>
    </div>

    <div class="alert alert--warning" role="note">
      <strong>Prototype Notice:</strong> The Decision-Support Assistant uses keyword matching rules,
      not artificial intelligence. All suggestions are advisory only.
      The coordinator makes every final decision.
      <strong>Do not use in real emergencies.</strong>
    </div>

    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="empty-state__heading">Decision-Support Assistant (Prototype)</h2>
      <p class="empty-state__message">
        This tool will analyze a plain-language incident description and suggest an incident type,
        priority, and required resources using transparent keyword rules.
        Coming in Phase 4.
      </p>
      <p class="empty-state__detail">
        Features: describe incident · get classification suggestion · review reasoning · transfer to incident form
      </p>
    </div>
  `;
}

/**
 * Render the Statistics section placeholder.
 * @param {HTMLElement} el
 */
function renderStats(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Statistics</h1>
        <p class="section-header__subtitle">Response performance and operational metrics</p>
      </div>
      <span class="badge badge--prototype">Educational Prototype</span>
    </div>

    ${buildPrototypeDisclaimer()}

    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      </div>
      <h2 class="empty-state__heading">Statistics Dashboard</h2>
      <p class="empty-state__message">
        This section will display live metrics derived from your incident and resource data.
        Coming in Phase 5.
      </p>
      <p class="empty-state__detail">
        Features: incidents by type · priority breakdown · resolution times · resource utilization
      </p>
    </div>
  `;
}

// ── Shared UI helpers ──────────────────────────────────────────────────────

/**
 * Build the standard prototype disclaimer HTML string.
 * Must appear on every section that deals with emergency data.
 *
 * @returns {string} HTML string
 */
function buildPrototypeDisclaimer() {
  return `
    <div class="alert alert--info prototype-disclaimer" role="note">
      <svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>
        <strong>Educational Prototype</strong> — ResQGrid is for learning purposes only.
        Do not use in real emergencies. Always follow official emergency procedures.
      </span>
    </div>
  `;
}

/**
 * Show a persistent banner when LocalStorage is unavailable.
 * Data will not persist this session.
 */
function showStorageWarningBanner() {
  const banner = document.getElementById('storage-warning-banner');
  if (banner) {
    banner.hidden = false;
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
// Wait for the DOM to be ready before initialising.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
