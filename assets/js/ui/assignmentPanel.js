/**
 * assignmentPanel.js
 * ------------------
 * Renders the resource assignment panel inside the incident detail view.
 *
 * Shows Available resources filtered by type, allows assigning one
 * to the current incident, and allows releasing deployed resources.
 *
 * @param {HTMLElement} container  - Target element to render into
 * @param {Object}      incident   - The incident being managed (fresh copy)
 * @param {Function}    onChanged  - Called after any assignment/release
 */

import {
  getAllResources,
  getAvailableResourcesByType,
  assignResource,
  releaseResource,
} from '../services/resourceService.js';

import { getIncidentById } from '../services/incidentService.js';

import { escapeHtml, RESOURCE_TYPES } from '../utils.js';
import { showToast } from './toast.js';

// ── Suggested resource types per incident type (UX hint, not a hard filter) ──
const TYPE_SUGGESTIONS = {
  Fire:               ['Fire Truck', 'Medical Team'],
  Medical:            ['Ambulance', 'Medical Team'],
  Security:           ['Police Unit'],
  Hazmat:             ['Hazmat Team', 'Medical Team'],
  'Natural Disaster':  ['Utility Crew', 'Medical Team', 'Ambulance'],
  Other:              [],
};

// ── Public API ─────────────────────────────────────────────────────────────

export function renderAssignmentPanel(container, incident, onChanged) {
  container.innerHTML = buildPanelHTML(incident);
  attachPanelListeners(container, incident, onChanged);
}

// ── HTML ───────────────────────────────────────────────────────────────────

function buildPanelHTML(incident) {
  const typeOptions = RESOURCE_TYPES.map(
    (t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
  ).join('');

  const suggestions = TYPE_SUGGESTIONS[incident.type] || [];
  const assignedIds = incident.assignedResources || [];
  const assigned    = getAllResources().filter((r) => assignedIds.includes(r.id));

  const assignedHTML = assigned.length > 0
    ? `<div class="assignment-panel__assigned">
         <h4 class="assignment-panel__sub-heading">Currently Assigned (${assigned.length})</h4>
         <ul class="assignment-panel__assigned-list">
           ${assigned.map((r) => `
             <li class="assignment-panel__assigned-item">
               <div class="assignment-panel__assigned-info">
                 <span class="badge badge--type">${escapeHtml(r.type)}</span>
                 <span class="assignment-panel__assigned-name">${escapeHtml(r.name)}</span>
                 <span class="badge badge--status-deployed">Deployed</span>
               </div>
               <button type="button" class="btn btn--secondary btn--sm"
                       data-release-id="${escapeHtml(r.id)}"
                       aria-label="Release ${escapeHtml(r.name)} from this incident">
                 Release
               </button>
             </li>`).join('')}
         </ul>
       </div>`
    : `<p class="assignment-panel__no-assigned">No resources assigned to this incident yet.</p>`;

  const hint = suggestions.length > 0
    ? `Suggested for a <em>${escapeHtml(incident.type)}</em> incident: ${suggestions.map((s) => `<strong>${escapeHtml(s)}</strong>`).join(', ')}.`
    : 'Only <strong>Available</strong> resources can be assigned.';

  return `
    <div class="assignment-panel">
      <div class="assignment-panel__header">
        <h3 class="assignment-panel__heading">Assigned Resources</h3>
        <span class="assignment-panel__incident-id">${escapeHtml(incident.id)}</span>
      </div>

      ${assignedHTML}

      <div class="assignment-panel__add-section">
        <h4 class="assignment-panel__sub-heading">Assign a Resource</h4>
        <p class="assignment-panel__hint">${hint}</p>

        <div class="assignment-panel__filter">
          <label for="assign-type-filter" class="form-label">Filter by type:</label>
          <select id="assign-type-filter" class="form-select assignment-panel__select"
                  aria-label="Filter available resources by type">
            <option value="">All available types</option>
            ${typeOptions}
          </select>
        </div>

        <div id="available-resources" class="assignment-panel__available" aria-live="polite"></div>
      </div>
    </div>
  `;
}

function buildAvailableList(incidentId, typeFilter) {
  const resources = getAvailableResourcesByType(typeFilter || undefined);

  if (resources.length === 0) {
    const msg = typeFilter
      ? `No <strong>${escapeHtml(typeFilter)}</strong> resources are currently available. Select a different type or check back later.`
      : 'No resources are currently available. Check resource statuses and try again.';
    return `<p class="assignment-panel__no-resources">${msg}</p>`;
  }

  return `
    <ul class="assignment-panel__available-list">
      ${resources.map((r) => `
        <li class="assignment-panel__available-item">
          <div class="assignment-panel__available-info">
            <span class="badge badge--status-available">Available</span>
            <span class="badge badge--type">${escapeHtml(r.type)}</span>
            <strong class="assignment-panel__available-name">${escapeHtml(r.name)}</strong>
            <span class="assignment-panel__location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   aria-hidden="true" width="12" height="12">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${escapeHtml(r.location)}
            </span>
          </div>
          <button type="button" class="btn btn--primary btn--sm"
                  data-assign-id="${escapeHtml(r.id)}"
                  data-incident-id="${escapeHtml(incidentId)}"
                  aria-label="Assign ${escapeHtml(r.name)} to incident ${escapeHtml(incidentId)}">
            Assign
          </button>
        </li>`).join('')}
    </ul>
  `;
}

// ── Listeners ──────────────────────────────────────────────────────────────

function attachPanelListeners(container, incident, onChanged) {
  const typeFilter = container.querySelector('#assign-type-filter');
  const availDiv   = container.querySelector('#available-resources');

  // Pre-select first suggestion for this incident type.
  const suggestions = TYPE_SUGGESTIONS[incident.type] || [];
  if (typeFilter && suggestions.length > 0) {
    typeFilter.value = suggestions[0];
  }

  // Initial render of available resources.
  if (availDiv) {
    availDiv.innerHTML = buildAvailableList(
      incident.id,
      typeFilter ? typeFilter.value : ''
    );
  }

  // Re-render available list when type filter changes.
  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      if (availDiv) {
        availDiv.innerHTML = buildAvailableList(incident.id, typeFilter.value);
      }
    });
  }

  // Delegated click handler for both Assign and Release buttons.
  container.addEventListener('click', (e) => {
    const assignBtn  = e.target.closest('[data-assign-id]');
    const releaseBtn = e.target.closest('[data-release-id]');

    if (assignBtn) {
      handleAssign(container, assignBtn, incident, typeFilter, availDiv, onChanged);
    } else if (releaseBtn) {
      handleRelease(container, releaseBtn, incident, onChanged);
    }
  });
}

// ── Action handlers ────────────────────────────────────────────────────────

function handleAssign(container, btn, incident, typeFilter, availDiv, onChanged) {
  const resourceId = btn.getAttribute('data-assign-id');
  btn.disabled     = true;

  const result = assignResource(resourceId, incident.id);

  btn.disabled = false;

  if (!result.success) {
    showToast(result.error || 'Could not assign resource.', 'error');
    return;
  }

  showToast(`Resource assigned to ${incident.id}.`, 'success');

  // Notify parent (refreshes list + dashboard).
  if (onChanged) onChanged();

  // Re-render the whole panel with the freshly updated incident.
  const updated = getIncidentById(incident.id);
  if (updated) {
    renderAssignmentPanel(container, updated, onChanged);
  }
}

function handleRelease(container, btn, incident, onChanged) {
  const resourceId = btn.getAttribute('data-release-id');
  const resource   = getAllResources().find((r) => r.id === resourceId);
  if (!resource) return;

  const confirmed = window.confirm(
    `Release "${resource.name}" from incident ${incident.id}?\nThe resource will return to Available status.`
  );
  if (!confirmed) return;

  const result = releaseResource(resourceId);

  if (!result.success) {
    showToast(result.error || 'Could not release resource.', 'error');
    return;
  }

  showToast(`${resource.name} released.`, 'success');

  // Notify parent.
  if (onChanged) onChanged();

  // Re-render the panel with fresh incident data.
  const updated = getIncidentById(incident.id);
  if (updated) {
    renderAssignmentPanel(container, updated, onChanged);
  }
}
