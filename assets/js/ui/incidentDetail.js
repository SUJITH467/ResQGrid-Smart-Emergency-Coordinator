/**
 * incidentDetail.js
 * -----------------
 * Renders a full incident detail panel inside the incidents section.
 *
 * Responsibilities:
 * - Show all incident fields (full title, description, timestamps, notes, resources)
 * - Render the single valid status advancement button (hidden when Resolved)
 * - Render a "Save Notes" textarea and button
 * - Render a "Delete" button only for Resolved incidents
 * - Fire onBack() when "Back to Incidents" is clicked
 * - Fire onChanged() after any successful status/notes/delete operation
 *   so the parent can refresh the list and dashboard counts
 */

import {
  getIncidentById,
  updateIncidentStatus,
  updateIncidentNotes,
  deleteIncident,
  getNextStatus,
} from '../services/incidentService.js';

import {
  escapeHtml,
  formatDate,
  formatRelativeTime,
} from '../utils.js';

import { showToast } from './toast.js';

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
}

// ── HTML builder ───────────────────────────────────────────────────────────

function buildDetailHTML(inc) {
  const nextStatus     = getNextStatus(inc.status);
  const isResolved     = inc.status === 'Resolved';
  const priorityClass  = getPriorityBadgeClass(inc.priority);
  const statusClass    = getStatusBadgeClass(inc.status);
  const resources      = inc.assignedResources || [];

  // Status advancement button — hidden when Resolved.
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           aria-hidden="true">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
      Delete Incident
    </button>
  ` : '';

  // Assigned resources section.
  const resourcesHTML = resources.length > 0
    ? `<ul class="incident-detail__resource-list">
        ${resources.map((id) => `
          <li class="incident-detail__resource-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 aria-hidden="true" width="14" height="14">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            ${escapeHtml(id)}
          </li>`).join('')}
       </ul>`
    : `<p class="incident-detail__no-resources">No resources assigned yet.</p>`;

  return `
    <!-- Back navigation -->
    <div class="incident-detail__nav">
      <button type="button" class="btn btn--ghost btn--sm" id="detail-back-btn"
              aria-label="Back to incidents list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             aria-hidden="true">
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

      </div><!-- /incident-detail__grid -->

      <hr class="divider" />

      <!-- Assigned resources (read-only in Phase 2) -->
      <div class="incident-detail__resources">
        <h3 class="incident-detail__section-heading">Assigned Resources</h3>
        ${resourcesHTML}
        <p class="incident-detail__resource-note">
          Resource assignment is managed in the Resources section.
        </p>
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
  // Back button.
  const backBtn = container.querySelector('#detail-back-btn');
  if (backBtn && onBack) {
    backBtn.addEventListener('click', onBack);
  }

  // Advance status button.
  const advanceBtn = container.querySelector('#advance-status-btn');
  if (advanceBtn) {
    advanceBtn.addEventListener('click', () => {
      handleStatusAdvance(container, inc.id, advanceBtn, onBack, onChanged);
    });
  }

  // Save notes button.
  const saveNotesBtn = container.querySelector('#save-notes-btn');
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', () => {
      handleSaveNotes(container, inc.id, onChanged);
    });
  }

  // Delete button.
  const deleteBtn = container.querySelector('#delete-incident-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      handleDelete(container, inc, onBack, onChanged);
    });
  }
}

// ── Action handlers ────────────────────────────────────────────────────────

/**
 * Handle status advancement.
 * onBack is passed in directly so the re-render after status change
 * preserves the real "go back to list" callback.
 */
function handleStatusAdvance(container, incidentId, advanceBtn, onBack, onChanged) {
  const nextStatus = advanceBtn.getAttribute('data-next-status');
  const errorSpan  = container.querySelector('#status-action-error');

  if (!nextStatus) return;

  advanceBtn.disabled = true;

  const result = updateIncidentStatus(incidentId, nextStatus);

  advanceBtn.disabled = false;

  if (!result.success) {
    if (errorSpan) {
      errorSpan.textContent = result.error || 'Status could not be updated. Please try again.';
      errorSpan.hidden      = false;
    }
    showToast(result.error || 'Status could not be updated.', 'error');
    return;
  }

  showToast(`Incident ${incidentId} marked as ${nextStatus}.`, 'success');

  // Notify parent (refreshes list + dashboard counts).
  if (onChanged) onChanged();

  // Re-render this detail panel with fresh data, preserving the real onBack.
  renderIncidentDetail(container, incidentId, onBack, onChanged);
}

/**
 * Handle notes save.
 */
function handleSaveNotes(container, incidentId, onChanged) {
  const textarea  = container.querySelector('#inc-detail-notes');
  const savedMsg  = container.querySelector('#notes-saved-msg');
  const saveBtn   = container.querySelector('#save-notes-btn');

  if (!textarea) return;

  const notes = textarea.value;

  if (saveBtn) saveBtn.disabled = true;

  const result = updateIncidentNotes(incidentId, notes);

  if (saveBtn) saveBtn.disabled = false;

  if (!result.success) {
    showToast(result.error || 'Could not save notes. Please try again.', 'error');
    return;
  }

  // Show brief "Saved" confirmation inline.
  if (savedMsg) {
    savedMsg.hidden = false;
    setTimeout(() => { savedMsg.hidden = true; }, 2500);
  }

  showToast('Notes saved.', 'success');
  if (onChanged) onChanged();
}

/**
 * Handle incident deletion with confirmation dialog.
 */
function handleDelete(container, inc, onBack, onChanged) {
  const errorSpan = container.querySelector('#delete-error');

  // Confirmation dialog.
  const confirmed = window.confirm(
    `Delete incident ${inc.id}: "${inc.title}"?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  const result = deleteIncident(inc.id);

  if (!result.success) {
    if (errorSpan) {
      errorSpan.textContent = result.error || 'Could not delete incident. Please try again.';
      errorSpan.hidden      = false;
    }
    showToast(result.error || 'Could not delete incident.', 'error');
    return;
  }

  showToast(`Incident ${inc.id} deleted.`, 'success');

  // Navigate back to the list.
  if (onChanged) onChanged();
  if (onBack)    onBack();
}

// ── Status track builder ───────────────────────────────────────────────────

/**
 * Build the visual status track (Reported → Active → In Progress → Resolved).
 * @param {string} currentStatus
 * @returns {string} HTML
 */
function buildStatusTrack(currentStatus) {
  const statuses = ['Reported', 'Active', 'In Progress', 'Resolved'];
  const currentIndex = statuses.indexOf(currentStatus);

  return statuses.map((s, i) => {
    const isDone    = i < currentIndex;
    const isCurrent = i === currentIndex;
    const cls       = isDone ? 'status-step--done' : isCurrent ? 'status-step--current' : 'status-step--future';
    return `
      <div class="status-step ${cls}" aria-label="${escapeHtml(s)}${isCurrent ? ' (current)' : isDone ? ' (completed)' : ''}">
        <div class="status-step__dot" aria-hidden="true"></div>
        <span class="status-step__label">${escapeHtml(s)}</span>
      </div>
      ${i < statuses.length - 1 ? '<div class="status-step__line" aria-hidden="true"></div>' : ''}
    `;
  }).join('');
}

// ── Badge helpers ──────────────────────────────────────────────────────────

function getPriorityBadgeClass(priority) {
  const map = { Critical: 'badge--critical', High: 'badge--high', Medium: 'badge--medium', Low: 'badge--low' };
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
