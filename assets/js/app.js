/**
 * app.js
 * ------
 * ResQGrid application entry point.
 * Initialises the store, registers routes, and starts the router.
 *
 * Phase 2B: Incident Management wired in.
 * Phases 3-5 placeholders remain for future implementation.
 */

import { initStore, isLocalStorageAvailable }    from './store.js';
import { initRouter, registerRoute }             from './router.js';
import { logger }                                from './utils.js';
import { getAllIncidents }                        from './services/incidentService.js';

// Phase 2B: Incident UI modules.
import { renderIncidentForm }    from './ui/incidentForm.js';
import { renderIncidentList, refreshIncidentList } from './ui/incidentList.js';
import { renderIncidentDetail }  from './ui/incidentDetail.js';

// ── Application initialisation ─────────────────────────────────────────────

function init() {
  logger.info('app: Starting ResQGrid…');

  initStore();

  if (!isLocalStorageAvailable()) {
    showStorageWarningBanner();
  }

  // Register routes.
  registerRoute('#dashboard', renderDashboard);
  registerRoute('#incidents', renderIncidents);
  registerRoute('#resources', renderResources);
  registerRoute('#assistant', renderAssistant);
  registerRoute('#stats',     renderStats);

  initRouter();

  logger.info('app: Ready.');
}

// ── Incidents section ──────────────────────────────────────────────────────
//
// The incidents section is a single-pane UI with three sub-views:
//   'list'   → incidentList.js
//   'form'   → incidentForm.js
//   'detail' → incidentDetail.js
//
// Sub-views are controlled by swapping innerHTML of a sub-pane container.
// The section header + disclaimer always stay visible.

/**
 * Render the Incidents section.
 * Called by the router each time #incidents is activated.
 *
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

    <div id="incidents-pane"></div>
  `;

  // Start on the list view.
  showListView(el);
}

/**
 * Show the incident list inside the incidents section.
 * @param {HTMLElement} sectionEl
 */
function showListView(sectionEl) {
  const pane = sectionEl.querySelector('#incidents-pane');
  if (!pane) return;
  pane.innerHTML = '';

  renderIncidentList(
    pane,
    // onReportNew — switch to the form view.
    () => showFormView(sectionEl),
    // onViewDetail — switch to the detail view.
    (incident) => showDetailView(sectionEl, incident.id)
  );
}

/**
 * Show the incident creation form inside the incidents section.
 * @param {HTMLElement} sectionEl
 */
function showFormView(sectionEl) {
  const pane = sectionEl.querySelector('#incidents-pane');
  if (!pane) return;

  // Build a wrapper with a heading.
  pane.innerHTML = `
    <div class="incident-form-wrapper">
      <div class="section-header" style="margin-bottom: var(--resq-space-6);">
        <div class="section-header__title-group">
          <h2 class="section-header__title" style="font-size: var(--resq-font-size-2xl);">
            Report New Incident
          </h2>
          <p class="section-header__subtitle">
            Fill in the details below. All fields marked * are required.
          </p>
        </div>
      </div>
      <div id="incident-form-container"></div>
    </div>
  `;

  const formContainer = pane.querySelector('#incident-form-container');
  if (!formContainer) return;

  renderIncidentForm(formContainer, (newIncident) => {
    if (newIncident) {
      // Incident created — go back to list.
      showListView(sectionEl);
      // Also refresh dashboard counts if user navigates there.
      scheduleDashboardRefresh();
    } else {
      // User cancelled.
      showListView(sectionEl);
    }
  });
}

/**
 * Show the incident detail view inside the incidents section.
 * @param {HTMLElement} sectionEl
 * @param {string}      incidentId
 */
function showDetailView(sectionEl, incidentId) {
  const pane = sectionEl.querySelector('#incidents-pane');
  if (!pane) return;
  pane.innerHTML = '';

  renderIncidentDetail(
    pane,
    incidentId,
    // onBack — return to list.
    () => showListView(sectionEl),
    // onChanged — refresh list counts and dashboard.
    () => {
      refreshIncidentList();
      scheduleDashboardRefresh();
    }
  );
}

// ── Dashboard section ──────────────────────────────────────────────────────

// Flag: set true when incident data changes so dashboard re-reads on next visit.
let _dashboardDirty = false;

/** Mark the dashboard as needing a data refresh. */
function scheduleDashboardRefresh() {
  _dashboardDirty = true;
}

/**
 * Render the Dashboard section with live incident counts.
 * @param {HTMLElement} el
 */
function renderDashboard(el) {
  _dashboardDirty = false;

  // Read live counts from the service.
  const all        = getAllIncidents();
  const total      = all.length;
  const active     = all.filter((i) => i.status !== 'Resolved').length;
  const critical   = all.filter((i) => i.priority === 'Critical').length;
  const resolved   = all.filter((i) => i.status === 'Resolved').length;

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

      <article class="summary-card" role="listitem" aria-label="${active} Active Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="summary-card__value">${active}</div>
        <div class="summary-card__label">Active Incidents</div>
        <div class="summary-card__sub">of ${total} total</div>
      </article>

      <article class="summary-card summary-card--critical" role="listitem" aria-label="${critical} Critical Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="summary-card__value">${critical}</div>
        <div class="summary-card__label">Critical Incidents</div>
        <div class="summary-card__sub">require immediate attention</div>
      </article>

      <article class="summary-card summary-card--resolved" role="listitem" aria-label="${resolved} Resolved Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="summary-card__value">${resolved}</div>
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
        <div class="summary-card__sub">coming in Phase 5</div>
      </article>

      <article class="summary-card" role="listitem" aria-label="${total} Total Incidents">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <div class="summary-card__value">${total}</div>
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

// ── Placeholder routes (Phases 3–5) ───────────────────────────────────────

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
      <p class="empty-state__message">Add, track, and deploy emergency resources. Coming in Phase 3.</p>
      <p class="empty-state__detail">add resources · assign to incidents · track availability</p>
    </div>
  `;
}

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
        Analyze a plain-language incident description and get a classification suggestion. Coming in Phase 4.
      </p>
    </div>
  `;
}

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
      <p class="empty-state__message">Live metrics from incident and resource data. Coming in Phase 5.</p>
    </div>
  `;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

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

function showStorageWarningBanner() {
  const banner = document.getElementById('storage-warning-banner');
  if (banner) banner.hidden = false;
}

// ── Boot ───────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
