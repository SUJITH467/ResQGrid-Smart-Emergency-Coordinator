/**
 * resourceList.js
 * ---------------
 * Renders the resource list with search, filter, sort, and per-row actions.
 *
 * Exposes:
 *   renderResourceList(container, onAddNew, onEdit, onViewDetail)
 *   refreshResourceList()
 */

import {
  getAllResources,
  getFilteredResources,
  deleteResource,
  setMaintenance,
  clearMaintenance,
  releaseResource,
} from '../services/resourceService.js';

import {
  RESOURCE_TYPES,
  RESOURCE_STATUSES,
  escapeHtml,
  truncateText,
  formatDate,
} from '../utils.js';

import { showToast } from './toast.js';

// ── Module state ───────────────────────────────────────────────────────────
let _state = { query: '', type: '', status: '', sortBy: 'date', direction: 'desc' };
let _onAddNew    = null;
let _onEdit      = null;
let _onViewDetail= null;
let _container   = null;

// ── Public API ─────────────────────────────────────────────────────────────

export function renderResourceList(container, onAddNew, onEdit, onViewDetail) {
  _onAddNew     = onAddNew;
  _onEdit       = onEdit;
  _onViewDetail = onViewDetail;
  _container    = container;
  _state = { query: '', type: '', status: '', sortBy: 'date', direction: 'desc' };

  container.innerHTML = buildShellHTML();
  attachListeners(container);
  refreshCards(container);
}

export function refreshResourceList() {
  if (_container) refreshCards(_container);
}

// ── Shell HTML ─────────────────────────────────────────────────────────────

function buildShellHTML() {
  const typeOptions = RESOURCE_TYPES.map(
    (t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
  ).join('');
  const statusOptions = RESOURCE_STATUSES.map(
    (s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
  ).join('');

  return `
    <!-- Availability summary strip -->
    <div class="resource-summary" id="resource-summary" aria-live="polite" aria-atomic="true"></div>

    <!-- Toolbar -->
    <div class="incident-toolbar" role="search" aria-label="Resource filters and search">
      <div class="incident-toolbar__search">
        <label for="res-search" class="sr-only">Search resources</label>
        <div class="incident-toolbar__search-wrap">
          <svg class="incident-toolbar__search-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" id="res-search" class="form-input incident-toolbar__search-input"
                 placeholder="Search by name or location…" autocomplete="off"
                 aria-label="Search resources"/>
        </div>
      </div>

      <div class="incident-toolbar__filters">
        <label for="res-filter-type" class="sr-only">Filter by type</label>
        <select id="res-filter-type" class="form-select incident-toolbar__select" aria-label="Filter by type">
          <option value="">All types</option>${typeOptions}
        </select>

        <label for="res-filter-status" class="sr-only">Filter by status</label>
        <select id="res-filter-status" class="form-select incident-toolbar__select" aria-label="Filter by status">
          <option value="">All statuses</option>${statusOptions}
        </select>

        <label for="res-sort" class="sr-only">Sort by</label>
        <select id="res-sort" class="form-select incident-toolbar__select" aria-label="Sort resources">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="status-asc">Status</option>
          <option value="type-asc">Type A–Z</option>
        </select>

        <button type="button" class="btn btn--secondary btn--sm" id="res-clear-btn"
                aria-label="Clear all filters">Clear filters</button>
      </div>

      <button type="button" class="btn btn--primary" id="res-add-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Resource
      </button>
    </div>

    <p class="incident-list__count" id="res-count" aria-live="polite" aria-atomic="true"></p>

    <div id="resource-cards" class="resource-list" role="list" aria-label="Resource list" aria-live="polite"></div>
  `;
}

// ── Listeners ──────────────────────────────────────────────────────────────

function attachListeners(container) {
  const search    = container.querySelector('#res-search');
  const filterType= container.querySelector('#res-filter-type');
  const filterStat= container.querySelector('#res-filter-status');
  const sortSel   = container.querySelector('#res-sort');
  const clearBtn  = container.querySelector('#res-clear-btn');
  const addBtn    = container.querySelector('#res-add-btn');

  if (search) {
    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { _state.query = search.value; refreshCards(container); }, 200);
    });
  }
  if (filterType)  filterType.addEventListener('change',  () => { _state.type   = filterType.value;  refreshCards(container); });
  if (filterStat)  filterStat.addEventListener('change',  () => { _state.status = filterStat.value;  refreshCards(container); });
  if (sortSel) {
    sortSel.addEventListener('change', () => {
      const [field, dir] = sortSel.value.split('-');
      _state.sortBy    = field;
      _state.direction = dir || 'asc';
      refreshCards(container);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      _state = { ..._state, query: '', type: '', status: '' };
      if (search)     search.value    = '';
      if (filterType) filterType.value = '';
      if (filterStat) filterStat.value = '';
      refreshCards(container);
    });
  }
  if (addBtn && _onAddNew) addBtn.addEventListener('click', _onAddNew);

  // Delegated clicks on card action buttons.
  const cards = container.querySelector('#resource-cards');
  if (cards) {
    cards.addEventListener('click', (e) => handleCardAction(e, container));
  }
}

// ── Card actions (delegated) ───────────────────────────────────────────────

function handleCardAction(e, container) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const id     = btn.getAttribute('data-id');

  if (action === 'edit' && _onEdit) {
    const resource = getAllResources().find((r) => r.id === id);
    if (resource) _onEdit(resource);
    return;
  }

  if (action === 'detail' && _onViewDetail) {
    const resource = getAllResources().find((r) => r.id === id);
    if (resource) _onViewDetail(resource);
    return;
  }

  if (action === 'delete') {
    const resource = getAllResources().find((r) => r.id === id);
    if (!resource) return;
    const confirmed = window.confirm(
      `Delete resource ${id}: "${resource.name}"?\nThis action cannot be undone.`
    );
    if (!confirmed) return;
    const result = deleteResource(id);
    if (result.success) {
      showToast(`Resource ${id} deleted.`, 'success');
      refreshCards(container);
    } else {
      showToast(result.error || 'Could not delete resource.', 'error');
    }
    return;
  }

  if (action === 'maintenance') {
    const result = setMaintenance(id);
    if (result.success) {
      showToast('Resource set to Maintenance.', 'success');
      refreshCards(container);
    } else {
      showToast(result.error || 'Could not set maintenance.', 'error');
    }
    return;
  }

  if (action === 'available') {
    const result = clearMaintenance(id);
    if (result.success) {
      showToast('Resource marked Available.', 'success');
      refreshCards(container);
    } else {
      showToast(result.error || 'Could not clear maintenance.', 'error');
    }
    return;
  }

  if (action === 'release') {
    const resource = getAllResources().find((r) => r.id === id);
    if (!resource) return;
    const confirmed = window.confirm(
      `Release ${resource.name} from incident ${resource.assignedTo}?\nThe resource will return to Available status.`
    );
    if (!confirmed) return;
    const result = releaseResource(id);
    if (result.success) {
      showToast(`Resource ${id} released.`, 'success');
      refreshCards(container);
    } else {
      showToast(result.error || 'Could not release resource.', 'error');
    }
  }
}

// ── Refresh ────────────────────────────────────────────────────────────────

function refreshCards(container) {
  const cardsEl   = container.querySelector('#resource-cards');
  const countEl   = container.querySelector('#res-count');
  const summaryEl = container.querySelector('#resource-summary');
  if (!cardsEl) return;

  const all     = getAllResources();
  const results = getFilteredResources({
    query:     _state.query,
    filters:   { type: _state.type, status: _state.status },
    sortBy:    _state.sortBy,
    direction: _state.direction,
  });

  // Availability summary.
  if (summaryEl) {
    const avail = all.filter((r) => r.status === 'Available').length;
    const dep   = all.filter((r) => r.status === 'Deployed').length;
    const maint = all.filter((r) => r.status === 'Maintenance').length;
    summaryEl.innerHTML = all.length === 0 ? '' : `
      <div class="resource-summary__strip">
        <span class="resource-summary__item resource-summary__item--available">
          <span class="resource-summary__dot"></span>
          ${avail} Available
        </span>
        <span class="resource-summary__item resource-summary__item--deployed">
          <span class="resource-summary__dot"></span>
          ${dep} Deployed
        </span>
        <span class="resource-summary__item resource-summary__item--maintenance">
          <span class="resource-summary__dot"></span>
          ${maint} Maintenance
        </span>
      </div>
    `;
  }

  // Count.
  if (countEl) {
    countEl.textContent = results.length === 0 ? ''
      : `Showing ${results.length} of ${all.length} resource${all.length !== 1 ? 's' : ''}`;
  }

  // Empty states.
  const hasAny    = all.length > 0;
  const hasSearch = _state.query.trim().length > 0;
  const hasFilter = _state.type || _state.status;

  if (!hasAny) {
    cardsEl.innerHTML = buildEmpty(
      'No resources added yet',
      'Add your first emergency resource to get started.',
      'res-empty-add-btn'
    );
    const emptyBtn = cardsEl.querySelector('#res-empty-add-btn');
    if (emptyBtn && _onAddNew) emptyBtn.addEventListener('click', _onAddNew);
    return;
  }

  if (results.length === 0 && hasSearch) {
    cardsEl.innerHTML = buildEmpty(
      'No resources match your search',
      `No results for "${escapeHtml(_state.query.slice(0, 50))}". Try different keywords.`,
      null, 'res-clear-search-link'
    );
    const link = cardsEl.querySelector('#res-clear-search-link');
    if (link) link.addEventListener('click', (e) => {
      e.preventDefault();
      _state.query = '';
      const s = container.querySelector('#res-search');
      if (s) s.value = '';
      refreshCards(container);
    });
    return;
  }

  if (results.length === 0 && hasFilter) {
    cardsEl.innerHTML = buildEmpty(
      'No resources match the selected filters',
      'Try adjusting the type or status filters.',
      null, 'res-clear-filter-link'
    );
    const link = cardsEl.querySelector('#res-clear-filter-link');
    if (link) link.addEventListener('click', (e) => {
      e.preventDefault();
      _state.type   = '';
      _state.status = '';
      const ft = container.querySelector('#res-filter-type');
      const fs = container.querySelector('#res-filter-status');
      if (ft) ft.value = '';
      if (fs) fs.value = '';
      refreshCards(container);
    });
    return;
  }

  cardsEl.innerHTML = results.map(buildCard).join('');
}

// ── Card HTML ──────────────────────────────────────────────────────────────

function buildCard(r) {
  const statusCls  = getStatusBadgeClass(r.status);
  const actionBtns = buildActionButtons(r);

  return `
    <article class="resource-card resource-card--${r.status.toLowerCase().replace(' ', '-')}"
             role="listitem" data-id="${escapeHtml(r.id)}"
             aria-label="Resource ${escapeHtml(r.id)}: ${escapeHtml(r.name)}">

      <div class="resource-card__header">
        <div class="resource-card__id-row">
          <span class="resource-card__id">${escapeHtml(r.id)}</span>
          <div class="resource-card__badges">
            <span class="badge ${statusCls}">${escapeHtml(r.status)}</span>
            <span class="badge badge--type">${escapeHtml(r.type)}</span>
          </div>
        </div>
        <h3 class="resource-card__name" title="${escapeHtml(r.name)}">
          ${escapeHtml(truncateText(r.name, 50))}
        </h3>
      </div>

      <div class="resource-card__body">
        <div class="resource-card__meta">
          <span class="resource-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${escapeHtml(truncateText(r.location, 40))}
          </span>
          ${r.status === 'Deployed' && r.assignedTo ? `
          <span class="resource-card__meta-item resource-card__meta-item--deployed">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Assigned to <strong>${escapeHtml(r.assignedTo)}</strong>
          </span>` : ''}
          <span class="resource-card__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Added ${escapeHtml(formatDate(r.addedAt))}
          </span>
        </div>
      </div>

      <div class="resource-card__footer">
        ${actionBtns}
      </div>
    </article>
  `;
}

function buildActionButtons(r) {
  const editBtn = `
    <button type="button" class="btn btn--secondary btn--sm"
            data-action="edit" data-id="${escapeHtml(r.id)}"
            aria-label="Edit ${escapeHtml(r.name)}">Edit</button>`;

  if (r.status === 'Available') {
    return `
      ${editBtn}
      <button type="button" class="btn btn--secondary btn--sm"
              data-action="maintenance" data-id="${escapeHtml(r.id)}"
              aria-label="Set ${escapeHtml(r.name)} to maintenance">Set Maintenance</button>
      <button type="button" class="btn btn--danger btn--sm"
              data-action="delete" data-id="${escapeHtml(r.id)}"
              aria-label="Delete ${escapeHtml(r.name)}">Delete</button>
    `;
  }

  if (r.status === 'Deployed') {
    return `
      ${editBtn}
      <button type="button" class="btn btn--secondary btn--sm"
              data-action="release" data-id="${escapeHtml(r.id)}"
              aria-label="Release ${escapeHtml(r.name)}">Release</button>
      <span class="resource-card__no-delete">Cannot delete a deployed resource</span>
    `;
  }

  // Maintenance
  return `
    ${editBtn}
    <button type="button" class="btn btn--secondary btn--sm"
            data-action="available" data-id="${escapeHtml(r.id)}"
            aria-label="Mark ${escapeHtml(r.name)} as available">Mark Available</button>
    <button type="button" class="btn btn--danger btn--sm"
            data-action="delete" data-id="${escapeHtml(r.id)}"
            aria-label="Delete ${escapeHtml(r.name)}">Delete</button>
  `;
}

// ── Empty state ────────────────────────────────────────────────────────────

function buildEmpty(heading, message, btnId, linkId) {
  const action = btnId
    ? `<button type="button" class="btn btn--primary" id="${btnId}">Add First Resource</button>`
    : linkId
    ? `<a href="#" class="btn btn--secondary btn--sm" id="${linkId}">Clear</a>`
    : '';

  return `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      </div>
      <h2 class="empty-state__heading">${escapeHtml(heading)}</h2>
      <p class="empty-state__message">${escapeHtml(message)}</p>
      ${action}
    </div>
  `;
}

// ── Badge helper ───────────────────────────────────────────────────────────

function getStatusBadgeClass(status) {
  return {
    Available:   'badge--status-available',
    Deployed:    'badge--status-deployed',
    Maintenance: 'badge--status-maintenance',
  }[status] || 'badge--status-available';
}
