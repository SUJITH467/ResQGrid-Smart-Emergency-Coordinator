/**
 * app.js
 * ------
 * ResQGrid application entry point.
 *
 * Phase 3: Resource Management wired in.
 * Phase 4: Decision-Support Assistant wired in.
 */

import { initStore, isLocalStorageAvailable }     from './store.js';
import { initRouter, registerRoute }              from './router.js';
import { logger }                                 from './utils.js';
import { getAllIncidents }                         from './services/incidentService.js';
import { getAllResources, repairOrphans }          from './services/resourceService.js';
import { registerReleaseHook }                    from './services/incidentService.js';
import { releaseResource }                        from './services/resourceService.js';

// Phase 2B: Incident UI modules.
import { renderIncidentForm }                        from './ui/incidentForm.js';
import { renderIncidentList, refreshIncidentList }   from './ui/incidentList.js';
import { renderIncidentDetail }                      from './ui/incidentDetail.js';

// Phase 3: Resource UI modules.
import { renderResourceList, refreshResourceList }  from './ui/resourceList.js';
import { renderResourceForm }                       from './ui/resourceForm.js';

// Phase 4: Assistant UI module.
import { renderAssistantPanel }                     from './ui/assistantPanel.js';

// ── Prefill state (assistant → incident form transfer) ─────────────────────
// Set by the assistant panel on accept; consumed once by showFormView.
let _pendingPrefill = null;

// ── Application initialisation ─────────────────────────────────────────────

function init() {
  logger.info('app: Starting ResQGrid…');

  // 1. Initialise LocalStorage.
  initStore();

  // 2. Storage warning banner.
  if (!isLocalStorageAvailable()) {
    showStorageWarningBanner();
  }

  // 3. Wire the Phase 3 release hook into incidentService.
  //    When an incident is resolved, incidentService will call
  //    resourceService.releaseResource for each assigned resource.
  registerReleaseHook(releaseResource);

  // 4. Repair any orphaned resource references from previous sessions.
  repairOrphans();

  // 5. Register routes.
  registerRoute('#dashboard', renderDashboard);
  registerRoute('#incidents', renderIncidents);
  registerRoute('#resources', renderResourcesSection);
  registerRoute('#assistant', renderAssistant);
  registerRoute('#stats',     renderStats);

  // 6. Start the router.
  initRouter();

  logger.info('app: Ready.');
}

// ── Incidents section ──────────────────────────────────────────────────────

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
  showListView(el);
}

function showListView(sectionEl) {
  const pane = sectionEl.querySelector('#incidents-pane');
  if (!pane) return;
  pane.innerHTML = '';
  renderIncidentList(
    pane,
    () => showFormView(sectionEl),
    (incident) => showDetailView(sectionEl, incident.id)
  );
}

function showFormView(sectionEl) {
  const pane = sectionEl.querySelector('#incidents-pane');
  if (!pane) return;
  pane.innerHTML = `
    <div class="incident-form-wrapper">
      <div class="section-header" style="margin-bottom: var(--resq-space-6);">
        <div class="section-header__title-group">
          <h2 class="section-header__title" style="font-size: var(--resq-font-size-2xl);">
            Report New Incident
          </h2>
          <p class="section-header__subtitle">Fill in the details below. All fields marked * are required.</p>
        </div>
      </div>
      <div id="incident-form-container"></div>
    </div>
  `;
  const formContainer = pane.querySelector('#incident-form-container');
  if (!formContainer) return;

  // Consume any pending prefill from the assistant (one-time transfer).
  const prefill   = _pendingPrefill;
  _pendingPrefill = null;

  renderIncidentForm(formContainer, (newIncident) => {
    if (newIncident) {
      showListView(sectionEl);
      scheduleDashboardRefresh();
    } else {
      showListView(sectionEl);
    }
  }, prefill);
}

function showDetailView(sectionEl, incidentId) {
  const pane = sectionEl.querySelector('#incidents-pane');
  if (!pane) return;
  pane.innerHTML = '';
  renderIncidentDetail(
    pane,
    incidentId,
    () => showListView(sectionEl),
    () => {
      refreshIncidentList();
      refreshResourceList();   // sync resource list after assign/release from detail
      scheduleDashboardRefresh();
    }
  );
}

// ── Resources section ──────────────────────────────────────────────────────

function renderResourcesSection(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Resources</h1>
        <p class="section-header__subtitle">Manage and deploy emergency resources</p>
      </div>
      <span class="badge badge--prototype">Educational Prototype</span>
    </div>
    ${buildPrototypeDisclaimer()}
    <div id="resources-pane"></div>
  `;
  showResourceListView(el);
}

function showResourceListView(sectionEl) {
  const pane = sectionEl.querySelector('#resources-pane');
  if (!pane) return;
  pane.innerHTML = '';
  renderResourceList(
    pane,
    () => showResourceFormView(sectionEl, null),   // Add new
    (resource) => showResourceFormView(sectionEl, resource), // Edit
    null  // No detail view needed — all actions are inline on the card
  );
}

function showResourceFormView(sectionEl, resource) {
  const pane = sectionEl.querySelector('#resources-pane');
  if (!pane) return;

  const isEdit  = resource !== null && resource !== undefined;
  const heading = isEdit ? `Edit Resource — ${resource.id}` : 'Add New Resource';
  const sub     = isEdit
    ? 'Update the name, type, or location of this resource.'
    : 'Fill in the details below. All fields marked * are required.';

  pane.innerHTML = `
    <div class="incident-form-wrapper">
      <div class="section-header" style="margin-bottom: var(--resq-space-6);">
        <div class="section-header__title-group">
          <h2 class="section-header__title" style="font-size: var(--resq-font-size-2xl);">
            ${heading}
          </h2>
          <p class="section-header__subtitle">${sub}</p>
        </div>
      </div>
      <div id="resource-form-container"></div>
    </div>
  `;

  const formContainer = pane.querySelector('#resource-form-container');
  if (!formContainer) return;

  renderResourceForm(formContainer, resource ?? null, (savedResource) => {
    // null means user cancelled; non-null means saved successfully.
    showResourceListView(sectionEl);
    scheduleDashboardRefresh();
  });
}

// ── Dashboard section ──────────────────────────────────────────────────────

let _dashboardDirty = false;

function scheduleDashboardRefresh() {
  _dashboardDirty = true;
}

function renderDashboard(el) {
  _dashboardDirty = false;

  const incidents  = getAllIncidents();
  const resources  = getAllResources();

  const total    = incidents.length;
  const active   = incidents.filter((i) => i.status !== 'Resolved').length;
  const critical = incidents.filter((i) => i.priority === 'Critical').length;
  const resolved = incidents.filter((i) => i.status === 'Resolved').length;

  const resAvail = resources.filter((r) => r.status === 'Available').length;
  const resDep   = resources.filter((r) => r.status === 'Deployed').length;
  const resMaint = resources.filter((r) => r.status === 'Maintenance').length;
  const resNonMaint = resAvail + resDep;
  const utilRate = resNonMaint > 0
    ? `${Math.round(resDep / resNonMaint * 1000) / 10}%`
    : 'N/A';

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

      <article class="summary-card summary-card--available" role="listitem" aria-label="${resAvail} Available Resources">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="summary-card__value">${resAvail}</div>
        <div class="summary-card__label">Available Resources</div>
        <div class="summary-card__sub">ready for deployment</div>
      </article>

      <article class="summary-card summary-card--deployed" role="listitem" aria-label="${resDep} Deployed Resources">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
        <div class="summary-card__value">${resDep}</div>
        <div class="summary-card__label">Deployed Resources</div>
        <div class="summary-card__sub">currently active</div>
      </article>

      <article class="summary-card" role="listitem" aria-label="Utilization rate: ${utilRate}">
        <div class="summary-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <div class="summary-card__value">${utilRate}</div>
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

// ── Placeholder routes (Phases 4–5) ───────────────────────────────────────

function renderAssistant(el) {
  el.innerHTML = `
    <div class="section-header">
      <div class="section-header__title-group">
        <h1 class="section-header__title">Decision-Support Assistant</h1>
        <p class="section-header__subtitle">Rule-based incident classification — not AI</p>
      </div>
      <span class="badge badge--prototype">Prototype — Not AI</span>
    </div>
    <div id="assistant-panel-mount"></div>
  `;

  const mount = el.querySelector('#assistant-panel-mount');
  if (!mount) return;

  renderAssistantPanel(mount, (payload) => {
    // Coordinator accepted a suggestion — store prefill and navigate to form.
    _pendingPrefill = payload;
    // Navigate to incidents section; showFormView will consume _pendingPrefill.
    window.location.hash = '#incidents';
    // The router will call renderIncidents → showListView → user clicks "Report Incident"
    // → showFormView picks up _pendingPrefill. But for smoother UX we directly open
    // the form after a short tick so the route change has settled.
    setTimeout(() => {
      const incSection = document.getElementById('section-incidents');
      if (incSection) {
        showFormView(incSection);
      }
    }, 50);
  });
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
