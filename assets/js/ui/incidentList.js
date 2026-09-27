/**
 * incidentList.js
 * ---------------
 * Renders the incident list with search, filter, and sort controls.
 *
 * Responsibilities:
 * - Render toolbar (search, filters, sort, "Report Incident" button)
 * - Render incident cards with all required fields
 * - Apply real-time search, AND-logic filters, and sorting
 * - Show three distinct empty states:
 *     1. No incidents at all
 *     2. No search results
 *     3. No filter results
 * - Truncate long titles and descriptions in card view
 * - Fire onReportNew() when the "Report Incident" button is clicked
 * - Fire onViewDetail(incident) when "View Details" is clicked
 */

import {
  getFilteredIncidents,
  getAllIncidents,
} from '../services/incidentService.js';

import {
  INCIDENT_TYPES,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  escapeHtml,
  truncateText,
  formatDate,
  formatRelativeTime,
} from '../utils.js';

// ── Active filter/sort state (module-level, reset on each render) ──────────
let _state = {
  query:     '',
  type:      '',
  priority:  '',
  status:    '',
  sortBy:    'date',
  direction: 'desc',
};

// Callbacks set once by renderIncidentList.
let _onReportNew  = null;
let _onViewDetail = null;

// Container reference for re-renders.
let _listContainer = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render the incident list into `container`.
 * Attaches event listeners and performs the initial render.
 *
 * @param {HTMLElement} container    - Target element
 * @param {Function}    onReportNew  - Called when "Report Incident" is clicked
 * @param {Function}    onViewDetail - Called with (incident) when "View Details" clicked
 */
export function renderIncidentList(container, onReportNew, onViewDetail) {
  _onReportNew  = onReportNew;
  _onViewDetail = onViewDetail;
  _listContainer = container;

  // Reset state on each fresh render.
  _state = { query: '', type: '', priority: '', status: '', sortBy: 'date', direction: 'desc' };

  container.innerHTML = buildListHTML();
  attachListListeners(container);
  refreshList(container);
}

/**
 * Trigger a re-render of just the incident cards area
 * (used after create/update/delete to reflect new data without a full page reload).
 */
export function refreshIncidentList() {
  if (_listContainer) {
    refreshList(_listContainer);
  }
}

// ── HTML skeleton ──────────────────────────────────────────────────────────

function buildListHTML() {
  const typeOptions = INCIDENT_TYPES.map(
    (t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
  ).join('');

  const priorityOptions = INCIDENT_PRIORITIES.map(
    (p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`
  ).join('');

  const statusOptions = INCIDENT_STATUSES.map(
    (s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
  ).join('');

  return `
    <!-- Toolbar -->
    <div class="incident-toolbar" role="search" aria-label="Incident filters and search">

      <div class="incident-toolbar__search">
        <label for="inc-search" class="sr-only">Search incidents</label>
        <div class="incident-toolbar__search-wrap">
          <svg class="incident-toolbar__search-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            id="inc-search"
            class="form-input incident-toolbar__search-input"
            placeholder="Search by title, description or location…"
            autocomplete="off"
            aria-label="Search incidents"
          />
        </div>
      </div>

      <div class="incident-toolbar__filters">

        <label for="filter-type" class="sr-only">Filter by type</label>
        <select id="filter-type" class="form-select incident-toolbar__select" aria-label="Filter by type">
          <option value="">All types</option>
          ${typeOptions}
        </select>

        <label for="filter-priority" class="sr-only">Filter by priority</label>
        <select id="filter-priority" class="form-select incident-toolbar__select" aria-label="Filter by priority">
          <option value="">All priorities</option>
          ${priorityOptions}
        </select>

        <label for="filter-status" class="sr-only">Filter by status</label>
        <select id="filter-status" class="form-select incident-toolbar__select" aria-label="Filter by status">
          <option value="">All statuses</option>
          ${statusOptions}
        </select>

        <label for="sort-by" class="sr-only">Sort by</label>
        <select id="sort-by" class="form-select incident-toolbar__select" aria-label="Sort incidents">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="priority-asc">Priority (high→low)</option>
          <option value="priority-desc">Priority (low→high)</option>
          <option value="status-asc">Status (earliest first)</option>
          <option value="status-desc">Status (latest first)</option>
        </select>

        <button type="button" class="btn btn--secondary btn--sm" id="clear-filters-btn"
                aria-label="Clear all filters">
          Clear filters
        </button>

      </div>

      <button type="button" class="btn btn--primary" id="report-new-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Report Incident
      </button>

    </div><!-- /incident-toolbar -->

    <!-- Result count -->
    <p class="incident-list__count" id="incident-count" aria-live="polite" aria-atomic="true"></p>

    <!-- Incident cards — refreshed by refreshList() -->
    <div
      id="incident-cards"
      class="incident-list"
      role="list"
      aria-label="Incident list"
      aria-live="polite"
    ></div>
  `;
}

// ── Event wiring ───────────────────────────────────────────────────────────

function attachListListeners(container) {
  // Search — debounced.
  const searchInput = container.querySelector('#inc-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        _state.query = searchInput.value;
        refreshList(container);
      }, 200);
    });
  }

  // Filters.
  const filterType     = container.querySelector('#filter-type');
  const filterPriority = container.querySelector('#filter-priority');
  const filterStatus   = container.querySelector('#filter-status');
  const sortBy         = container.querySelector('#sort-by');

  if (filterType)     filterType.addEventListener('change',     () => { _state.type     = filterType.value;     refreshList(container); });
  if (filterPriority) filterPriority.addEventListener('change', () => { _state.priority = filterPriority.value; refreshList(container); });
  if (filterStatus)   filterStatus.addEventListener('change',   () => { _state.status   = filterStatus.value;   refreshList(container); });

  // Sort.
  if (sortBy) {
    sortBy.addEventListener('change', () => {
      const [field, dir] = sortBy.value.split('-');
      _state.sortBy    = field;
      _state.direction = dir;
      refreshList(container);
    });
  }

  // Clear filters.
  const clearBtn = container.querySelector('#clear-filters-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      _state.type     = '';
      _state.priority = '';
      _state.status   = '';
      _state.query    = '';
      if (filterType)     filterType.value     = '';
      if (filterPriority) filterPriority.value = '';
      if (filterStatus)   filterStatus.value   = '';
      if (searchInput)    searchInput.value     = '';
      refreshList(container);
    });
  }

  // Report Incident button.
  const reportBtn = container.querySelector('#report-new-btn');
  if (reportBtn && _onReportNew) {
    reportBtn.addEventListener('click', _onReportNew);
  }

  // Delegate "View Details" clicks from the cards area.
  const cardsArea = container.querySelector('#incident-cards');
  if (cardsArea) {
    cardsArea.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view-id]');
      if (btn && _onViewDetail) {
        const id = btn.getAttribute('data-view-id');
        // Get fresh incident from service.
        const all = getAllIncidents();
        const inc = all.find((i) => i.id === id);
        if (inc) _onViewDetail(inc);
      }
    });
  }
}

// ── List renderer ──────────────────────────────────────────────────────────

/**
 * Re-query the service with current state and redraw the cards area.
 * @param {HTMLElement} container
 */
function refreshList(container) {
  const cardsArea  = container.querySelector('#incident-cards');
  const countEl    = container.querySelector('#incident-count');
  if (!cardsArea) return;

  const all       = getAllIncidents();
  const hasAny    = all.length > 0;
  const hasSearch = _state.query.trim().length > 0;
  const hasFilter = _state.type || _state.priority || _state.status;

  const results = getFilteredIncidents({
    query:     _state.query,
    filters:   { type: _state.type, priority: _state.priority, status: _state.status },
    sortBy:    _state.sortBy,
    direction: _state.direction,
  });

  // Update count label.
  if (countEl) {
    if (results.length === 0) {
      countEl.textContent = '';
    } else {
      countEl.textContent = `Showing ${results.length} of ${all.length} incident${all.length !== 1 ? 's' : ''}`;
    }
  }

  // Empty states.
  if (!hasAny) {
    cardsArea.innerHTML = buildEmptyState(
      'No incidents reported yet',
      'When an incident is reported it will appear here.',
      'report-incident-empty-btn'
    );
    const emptyBtn = cardsArea.querySelector('#report-incident-empty-btn');
    if (emptyBtn && _onReportNew) emptyBtn.addEventListener('click', _onReportNew);
    return;
  }

  if (results.length === 0 && hasSearch) {
    cardsArea.innerHTML = buildEmptyState(
      'No incidents match your search',
      `No results for "${escapeHtml(_state.query.slice(0, 60))}". Try different keywords.`,
      null,
      'clear-search-empty'
    );
    const clearLink = cardsArea.querySelector('#clear-search-empty');
    if (clearLink) {
      clearLink.addEventListener('click', (e) => {
        e.preventDefault();
        _state.query = '';
        const searchInput = container.querySelector('#inc-search');
        if (searchInput) searchInput.value = '';
        refreshList(container);
      });
    }
    return;
  }

  if (results.length === 0 && hasFilter) {
    cardsArea.innerHTML = buildEmptyState(
      'No incidents match the selected filters',
      'Try adjusting the type, priority, or status filters.',
      null,
      'clear-filter-empty'
    );
    const clearLink = cardsArea.querySelector('#clear-filter-empty');
    if (clearLink) {
      clearLink.addEventListener('click', (e) => {
        e.preventDefault();
        _state.type     = '';
        _state.priority = '';
        _state.status   = '';
        const filterType     = container.querySelector('#filter-type');
        const filterPriority = container.querySelector('#filter-priority');
        const filterStatus   = container.querySelector('#filter-status');
        if (filterType)     filterType.value     = '';
        if (filterPriority) filterPriority.value = '';
        if (filterStatus)   filterStatus.value   = '';
        refreshList(container);
      });
    }
    return;
  }

  // Render cards.
  cardsArea.innerHTML = results.map(buildIncidentCard).join('');
}

// ── Card builder ───────────────────────────────────────────────────────────

/**
 * Build an incident card HTML string.
 * @param {Object} inc - Incident object
 * @returns {string}
 */
function buildIncidentCard(inc) {
  const priorityClass = getPriorityBadgeClass(inc.priority);
  const statusClass   = getStatusBadgeClass(inc.status);
  const isCritical    = inc.priority === 'Critical';

  const titleTruncated = truncateText(inc.title || '', 60);
  const descTruncated  = truncateText(inc.description || '', 120);
  const resources      = (inc.assignedResources || []).length;

  return `
    <article
      class="incident-card${isCritical ? ' incident-card--critical' : ''}"
      role="listitem"
      data-id="${escapeHtml(inc.id)}"
      aria-label="Incident ${escapeHtml(inc.id)}: ${escapeHtml(inc.title)}"
    >
      <div class="incident-card__header">
        <div class="incident-card__id-row">
          <span class="incident-card__id">${escapeHtml(inc.id)}</span>
          <div class="incident-card__badges">
            <span class="badge ${priorityClass}" title="Priority: ${escapeHtml(inc.priority)}">
              ${escapeHtml(inc.priority)}
            </span>
            <span class="badge ${statusClass}" title="Status: ${escapeHtml(inc.status)}">
              ${escapeHtml(inc.status)}
            </span>
            <span class="badge badge--type" title="Type: ${escapeHtml(inc.type)}">
              ${escapeHtml(inc.type)}
            </span>
          </div>
        </div>
        <h3 class="incident-card__title" title="${escapeHtml(inc.title)}">
          ${escapeHtml(titleTruncated)}
        </h3>
      </div>

      <div class="incident-card__body">
        <p class="incident-card__description" title="${escapeHtml(inc.description)}">
          ${escapeHtml(descTruncated)}
        </p>
        <div class="incident-card__meta">
          <span class="incident-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${escapeHtml(truncateText(inc.location || '', 40))}
          </span>
          <span class="incident-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <time datetime="${escapeHtml(inc.reportedAt)}" title="${escapeHtml(formatDate(inc.reportedAt))}">
              ${escapeHtml(formatRelativeTime(inc.reportedAt))}
            </time>
          </span>
          ${resources > 0 ? `
          <span class="incident-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            ${resources} resource${resources !== 1 ? 's' : ''} assigned
          </span>` : ''}
        </div>
      </div>

      <div class="incident-card__footer">
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          data-view-id="${escapeHtml(inc.id)}"
          aria-label="View details for incident ${escapeHtml(inc.id)}"
        >
          View Details
        </button>
      </div>
    </article>
  `;
}

// ── Empty state builder ────────────────────────────────────────────────────

/**
 * Build an empty state HTML string.
 * @param {string}      heading
 * @param {string}      message
 * @param {string|null} btnId     - If set, renders a "Report Incident" button
 * @param {string|null} linkId    - If set, renders a "Clear" link
 * @returns {string}
 */
function buildEmptyState(heading, message, btnId = null, linkId = null) {
  const action = btnId
    ? `<button type="button" class="btn btn--primary" id="${btnId}">
         Report First Incident
       </button>`
    : linkId
    ? `<a href="#" class="btn btn--secondary btn--sm" id="${linkId}">Clear</a>`
    : '';

  return `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="empty-state__heading">${escapeHtml(heading)}</h2>
      <p class="empty-state__message">${escapeHtml(message)}</p>
      ${action}
    </div>
  `;
}

// ── Badge helpers ──────────────────────────────────────────────────────────

function getPriorityBadgeClass(priority) {
  const map = {
    Critical: 'badge--critical',
    High:     'badge--high',
    Medium:   'badge--medium',
    Low:      'badge--low',
  };
  return map[priority] || 'badge--low';
}

function getStatusBadgeClass(status) {
  const map = {
    Reported:      'badge--status-reported',
    Active:        'badge--status-active',
    'In Progress': 'badge--status-inprogress',
    Resolved:      'badge--status-resolved',
  };
  return map[status] || 'badge--status-reported';
}
