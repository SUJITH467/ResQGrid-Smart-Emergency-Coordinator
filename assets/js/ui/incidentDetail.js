/**
 * incidentDetail.js
 * -----------------
 * Renders a full incident detail panel.
 *
 * Phase 3 additions:
 * - Shows real resource names (not just IDs) for assigned resources.
 * - Embeds the assignment panel (assign + release) for non-Resolved incidents.
 */

import {
  getIncidentById,
  updateIncidentStatus,
  updateIncidentNotes,
  deleteIncident,
  getNextStatus,
} from '../services/incidentService.js';

import { getAllResources } from '../services/resourceService.js';

import {
  escapeHtml,
  formatDate,
  formatRelativeTime,
} from '../utils.js';

import { showToast }            from './toast.js';
import { renderAssignmentPanel } from './assignmentPanel.js';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render the incident detail panel.
 *
 * @param {HTMLElement} container  - Target element to render into
 * @param {string}      incidentId - ID of the incident to display
 * @param {Function}    onBack     - Called when "Back to Incidents" is clicked
 * @param {Function}    onChanged  - Called after any successful mutation
 */
export function renderIncidentDetail(container, incidentId, onBack, onChanged) {
  const inc = getIncidentById(incidentId);

  if (!inc) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h2 class="empty-state__heading">Incident Not Found</h2>
        <p class="empty-state__message">Incident "${escapeHtml(incidentId)}" could not be found.</p>
        <button type="button" class="btn btn--secondary" id="detail-back-missing">
          ← Back to Incidents
        </button>
      </div>
    `;
    const backBtn = container.querySelector('#detail-back-missing');
    if (backBtn && onBack) backBtn.addEventListener('click', onBack);
    return;
  }

  container.innerHTML = buildDetailHTML(inc);
  attachDetailListeners(container, inc, onBack, onChanged);

  // Mount the assignment panel into the resources section placeholder.
  const assignmentTarget = container.querySelector('#assignment-panel-mount');
  if (assignmentTarget) {
    // Wrap onChanged so the detail panel also refreshes after assignment/release.
    const onAssignmentChanged = () => {
      if (onChanged) onChanged();
      // Re-render the whole detail with fresh data.
      renderIncidentDetail(container, incidentId, onBack, onChanged);
    };
    renderAssignmentPanel(assignmentTarget, inc, onAssignmentChanged);
  }
}

// ── HTML builder ───────────────────────────────────────────────────────────

function buildDetailHTML(inc) {
  const nextStatus    = getNextStatus(inc.status);
  const isResolved    = inc.status === 'Resolved';
  const priorityClass = getPriorityBadgeClass(inc.priority);
  const statusClass   = getStatusBadgeClass(inc.status);

  // Resolve resource IDs to real names for display.
  const allResources  = getAllResources();
  const assignedIds   = inc.assignedResources || [];
  const resolvedResources = assignedIds.map((rid) => {
    const r = allResources.find((x) => x.id === rid);
    return r || { id: rid, name: rid, type: 'Unknown', status: 'Unknown' };
  });

  // Status advancement button.
  const statusBtnHTML = nextStatus ? `
    <button type="button" class="btn btn--primary" id="advance-status-btn"
            data-incident-id="${escapeHtml(inc.id)}"
            data-next-status="${escapeHtml(nextStatus)}"
            aria-label="Mark incident as ${escapeHtml(nextStatus)}">
      Mark ${escapeHtml(nextStatus)}
    </button>
  ` : `
    <span class="badge badge--status-resolved" aria-label="Incident resolved">
      ✓ Resolved
    </span>
  `;

  // Delete button — only for Resolved.
  const deleteBtnHTML = isResolved ? `
    <button type="button" class="btn btn--danger btn--sm" id="delete-incident-btn"
            data-incident-id="${escapeHtml(inc.id)}"
            aria-label="Delete incident ${escapeHtml(inc.id)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
      Delete Incident
    </button>
  ` : '';

  // Resource summary (resolved view — static list, no assign/release controls).
  const resolvedResourcesHTML = resolvedResources.length > 0
    ? `<ul class="incident-detail__resource-list">
        ${resolvedResources.map((r) => `
          <li class="incident-detail__resource-item">
            <span class="badge badge--type">${escapeHtml(r.type)}</span>
            <span>${escapeHtml(r.name)}</span>
            <span class="incident-detail__resource-id">${escapeHtml(r.id)}</span>
          </li>`).join('')}
       </ul>`
    : `<p class="incident-detail__no-resources">No resources were assigned to this incident.</p>`;

  return `
    <!-- Back navigation -->
    <div class="incident-detail__nav">
      <button type="button" class="btn btn--ghost btn--sm" id="detail-back-btn"
              aria-label="Back to incidents list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to Incidents
      </button>
    </div>

    <article class="incident-detail" aria-label="Incident ${escapeHtml(inc.id)} detail">

      <!-- Header -->
      <div class="incident-detail__header">
        <div class="incident-detail__title-row">
          <span class="incident-detail__id">${escapeHtml(inc.id)}</span>
          <div class="incident-detail__badges">
            <span class="badge ${priorityClass}">${escapeHtml(inc.priority)}</span>
            <span class="badge ${statusClass}">${escapeHtml(inc.status)}</span>
            <span class="badge badge--type">${escapeHtml(inc.type)}</span>
          </div>
        </div>
        <h2 class="incident-detail__title">${escapeHtml(inc.title)}</h2>
      </div>

      <!-- Status progression -->
      <div class="incident-detail__status-section">
        <h3 class="incident-detail__section-heading">Status</h3>
        <div class="incident-detail__status-track" aria-label="Status progression">
          ${buildStatusTrack(inc.status)}
        </div>
        <div class="incident-detail__status-actions">
          ${statusBtnHTML}
          <span id="status-action-error" class="form-error" role="alert" aria-live="polite" hidden></span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Main details grid -->
      <div class="incident-detail__grid">

        <div class="incident-detail__field">
          <dt class="incident-detail__field-label">Description</dt>
          <dd class="incident-detail__field-value incident-detail__description">
            ${escapeHtml(inc.description)}
          </dd>
        </div>

        <div class="incident-detail__field">
          <dt class="incident-detail__field-label">Location</dt>
          <dd class="incident-detail__field-value">${escapeHtml(inc.location)}</dd>
        </div>

        <div class="incident-detail__field">
          <dt class="incident-detail__field-label">Reported By</dt>
          <dd class="incident-detail__field-value">${escapeHtml(inc.reportedBy)}</dd>
        </div>

        <div class="incident-detail__field">
          <dt class="incident-detail__field-label">Reported At</dt>
          <dd class="incident-detail__field-value">
            <time datetime="${escapeHtml(inc.reportedAt)}">
              ${escapeHtml(formatDate(inc.reportedAt))}
            </time>
            <span class="incident-detail__relative">(${escapeHtml(formatRelativeTime(inc.reportedAt))})</span>
          </dd>
        </div>

        <div class="incident-detail__field">
          <dt class="incident-detail__field-label">Last Updated</dt>
          <dd class="incident-detail__field-value">
            <time datetime="${escapeHtml(inc.updatedAt)}">
              ${escapeHtml(formatDate(inc.updatedAt))}
            </time>
          </dd>
        </div>

        ${inc.resolvedAt ? `
        <div class="incident-detail__field">
          <dt class="incident-detail__field-label">Resolved At</dt>
          <dd class="incident-detail__field-value">
            <time datetime="${escapeHtml(inc.resolvedAt)}">
              ${escapeHtml(formatDate(inc.resolvedAt))}
            </time>
          </dd>
        </div>` : ''}

      </div>

      <hr class="divider" />

      <!-- Resources section -->
      <div class="incident-detail__resources">
        ${isResolved
          ? `<h3 class="incident-detail__section-heading">Resources (at resolution)</h3>
             ${resolvedResourcesHTML}`
          : `<div id="assignment-panel-mount"></div>`
        }
      </div>

      <hr class="divider" />

      <!-- Notes -->
      <div class="incident-detail__notes">
        <h3 class="incident-detail__section-heading">Notes</h3>
        <div class="form-group">
          <label for="inc-detail-notes" class="sr-only">Coordinator notes</label>
          <textarea
            id="inc-detail-notes"
            class="form-textarea"
            rows="4"
            placeholder="Add coordinator notes, observations, or actions taken…"
            maxlength="1000"
            aria-label="Coordinator notes for incident ${escapeHtml(inc.id)}"
          >${escapeHtml(inc.notes || '')}</textarea>
        </div>
        <div class="incident-detail__notes-actions">
          <button type="button" class="btn btn--secondary btn--sm" id="save-notes-btn"
                  data-incident-id="${escapeHtml(inc.id)}">
            Save Notes
          </button>
          <span id="notes-saved-msg" class="incident-detail__notes-saved" hidden>✓ Saved</span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Danger zone -->
      ${isResolved ? `
      <div class="incident-detail__danger">
        <h3 class="incident-detail__section-heading incident-detail__section-heading--danger">
          Danger Zone
        </h3>
        <p class="incident-detail__danger-note">
          Deleting an incident is permanent and cannot be undone.
          Only resolved incidents can be deleted.
        </p>
        ${deleteBtnHTML}
        <span id="delete-error" class="form-error" role="alert" aria-live="polite" hidden></span>
      </div>` : ''}

    </article>
  `;
}

// ── Event wiring ───────────────────────────────────────────────────────────

function attachDetailListeners(container, inc, onBack, onChanged) {
  const backBtn = container.querySelector('#detail-back-btn');
  if (backBtn && onBack) backBtn.addEventListener('click', onBack);

  const advanceBtn = container.querySelector('#advance-status-btn');
  if (advanceBtn) {
    advanceBtn.addEventListener('click', () => {
      handleStatusAdvance(container, inc.id, advanceBtn, onBack, onChanged);
    });
  }

  const saveNotesBtn = container.querySelector('#save-notes-btn');
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', () => handleSaveNotes(container, inc.id, onChanged));
  }

  const deleteBtn = container.querySelector('#delete-incident-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => handleDelete(container, inc, onBack, onChanged));
  }
}

// ── Action handlers ────────────────────────────────────────────────────────

function handleStatusAdvance(container, incidentId, advanceBtn, onBack, onChanged) {
  const nextStatus = advanceBtn.getAttribute('data-next-status');
  const errorSpan  = container.querySelector('#status-action-error');

  if (!nextStatus) return;

  advanceBtn.disabled = true;
  const result = updateIncidentStatus(incidentId, nextStatus);
  advanceBtn.disabled = false;

  if (!result.success) {
    if (errorSpan) { errorSpan.textContent = result.error; errorSpan.hidden = false; }
    showToast(result.error || 'Status could not be updated.', 'error');
    return;
  }

  showToast(`Incident ${incidentId} marked as ${nextStatus}.`, 'success');
  if (onChanged) onChanged();
  renderIncidentDetail(container, incidentId, onBack, onChanged);
}

function handleSaveNotes(container, incidentId, onChanged) {
  const textarea = container.querySelector('#inc-detail-notes');
  const savedMsg = container.querySelector('#notes-saved-msg');
  const saveBtn  = container.querySelector('#save-notes-btn');
  if (!textarea) return;

  if (saveBtn) saveBtn.disabled = true;
  const result = updateIncidentNotes(incidentId, textarea.value);
  if (saveBtn) saveBtn.disabled = false;

  if (!result.success) {
    showToast(result.error || 'Could not save notes.', 'error');
    return;
  }

  if (savedMsg) { savedMsg.hidden = false; setTimeout(() => { savedMsg.hidden = true; }, 2500); }
  showToast('Notes saved.', 'success');
  if (onChanged) onChanged();
}

function handleDelete(container, inc, onBack, onChanged) {
  const errorSpan = container.querySelector('#delete-error');
  const confirmed = window.confirm(
    `Delete incident ${inc.id}: "${inc.title}"?\n\nThis action cannot be undone.`
  );
  if (!confirmed) return;

  const result = deleteIncident(inc.id);
  if (!result.success) {
    if (errorSpan) { errorSpan.textContent = result.error; errorSpan.hidden = false; }
    showToast(result.error || 'Could not delete incident.', 'error');
    return;
  }

  showToast(`Incident ${inc.id} deleted.`, 'success');
  if (onChanged) onChanged();
  if (onBack)    onBack();
}

// ── Status track builder ───────────────────────────────────────────────────

function buildStatusTrack(currentStatus) {
  const statuses     = ['Reported', 'Active', 'In Progress', 'Resolved'];
  const currentIndex = statuses.indexOf(currentStatus);

  return statuses.map((s, i) => {
    const isDone    = i < currentIndex;
    const isCurrent = i === currentIndex;
    const cls = isDone ? 'status-step--done' : isCurrent ? 'status-step--current' : 'status-step--future';
    return `
      <div class="status-step ${cls}"
           aria-label="${escapeHtml(s)}${isCurrent ? ' (current)' : isDone ? ' (completed)' : ''}">
        <div class="status-step__dot" aria-hidden="true"></div>
        <span class="status-step__label">${escapeHtml(s)}</span>
      </div>
      ${i < statuses.length - 1 ? '<div class="status-step__line" aria-hidden="true"></div>' : ''}
    `;
  }).join('');
}

// ── Badge helpers ──────────────────────────────────────────────────────────

function getPriorityBadgeClass(priority) {
  return { Critical: 'badge--critical', High: 'badge--high', Medium: 'badge--medium', Low: 'badge--low' }[priority] || 'badge--low';
}

function getStatusBadgeClass(status) {
  return {
    Reported:      'badge--status-reported',
    Active:        'badge--status-active',
    'In Progress': 'badge--status-inprogress',
    Resolved:      'badge--status-resolved',
  }[status] || 'badge--status-reported';
}
