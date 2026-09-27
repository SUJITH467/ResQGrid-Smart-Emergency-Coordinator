/**
 * incidentForm.js
 * ---------------
 * Renders and manages the "Report Incident" creation form.
 *
 * Responsibilities:
 * - Render form HTML into the provided container element
 * - Validate fields on submit via incidentService.validateIncident
 * - Show inline field-level error messages
 * - Check for duplicates and show a non-blocking warning
 * - Call incidentService.createIncident on valid submission
 * - Show success toast and reset form
 * - Disable submit button while processing (prevent double-submit)
 * - Call onSuccess callback when an incident is created
 *
 * The form does NOT manage routing — the parent (app.js) handles navigation.
 */

import {
  validateIncident,
  checkDuplicate,
  createIncident,
} from '../services/incidentService.js';

import { escapeHtml, INCIDENT_TYPES, INCIDENT_PRIORITIES } from '../utils.js';
import { showToast } from './toast.js';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render the incident creation form into `container`.
 *
 * @param {HTMLElement} container   - Target element to render into
 * @param {Function}    onSuccess   - Called with the new incident object after creation
 */
export function renderIncidentForm(container, onSuccess) {
  container.innerHTML = buildFormHTML();
  attachFormListeners(container, onSuccess);
}

// ── HTML builder ───────────────────────────────────────────────────────────

function buildFormHTML() {
  // Build <option> lists for the select fields.
  const typeOptions = INCIDENT_TYPES.map(
    (t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
  ).join('');

  const priorityOptions = INCIDENT_PRIORITIES.map(
    (p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`
  ).join('');

  return `
    <form class="incident-form" id="incident-form" novalidate aria-label="Report new incident">

      <!-- Duplicate warning — hidden until triggered -->
      <div
        class="alert alert--warning incident-form__dup-warning"
        id="dup-warning"
        role="alert"
        aria-live="polite"
        hidden
      >
        <svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span id="dup-warning-text"></span>
      </div>

      <!-- Two-column grid on wider screens -->
      <div class="incident-form__grid">

        <!-- Title -->
        <div class="form-group incident-form__full-width">
          <label class="form-label form-label--required" for="inc-title">
            Incident Title
          </label>
          <input
            type="text"
            id="inc-title"
            name="title"
            class="form-input"
            placeholder="e.g. Smoke detected in Building A"
            maxlength="100"
            autocomplete="off"
            aria-required="true"
            aria-describedby="inc-title-error inc-title-hint"
          />
          <span class="form-hint" id="inc-title-hint">5–100 characters</span>
          <span class="form-error" id="inc-title-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Description -->
        <div class="form-group incident-form__full-width">
          <label class="form-label form-label--required" for="inc-description">
            Description
          </label>
          <textarea
            id="inc-description"
            name="description"
            class="form-textarea"
            placeholder="Describe the incident in detail — what you observed, when, and any immediate dangers."
            rows="4"
            maxlength="500"
            aria-required="true"
            aria-describedby="inc-description-error inc-description-hint"
          ></textarea>
          <span class="form-hint" id="inc-description-hint">10–500 characters</span>
          <span class="form-error" id="inc-description-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Location -->
        <div class="form-group">
          <label class="form-label form-label--required" for="inc-location">
            Location
          </label>
          <input
            type="text"
            id="inc-location"
            name="location"
            class="form-input"
            placeholder="e.g. Building A, Floor 2"
            maxlength="200"
            autocomplete="off"
            aria-required="true"
            aria-describedby="inc-location-error"
          />
          <span class="form-error" id="inc-location-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Reporter -->
        <div class="form-group">
          <label class="form-label form-label--required" for="inc-reporter">
            Reported By
          </label>
          <input
            type="text"
            id="inc-reporter"
            name="reportedBy"
            class="form-input"
            placeholder="Your name"
            maxlength="100"
            autocomplete="name"
            aria-required="true"
            aria-describedby="inc-reporter-error"
          />
          <span class="form-error" id="inc-reporter-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Incident Type -->
        <div class="form-group">
          <label class="form-label form-label--required" for="inc-type">
            Incident Type
          </label>
          <select
            id="inc-type"
            name="type"
            class="form-select"
            aria-required="true"
            aria-describedby="inc-type-error"
          >
            <option value="">— Select type —</option>
            ${typeOptions}
          </select>
          <span class="form-error" id="inc-type-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Priority -->
        <div class="form-group">
          <label class="form-label form-label--required" for="inc-priority">
            Priority
          </label>
          <select
            id="inc-priority"
            name="priority"
            class="form-select"
            aria-required="true"
            aria-describedby="inc-priority-error"
          >
            <option value="">— Select priority —</option>
            ${priorityOptions}
          </select>
          <span class="form-error" id="inc-priority-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Notes (optional) -->
        <div class="form-group incident-form__full-width">
          <label class="form-label" for="inc-notes">
            Notes <span class="form-hint" style="display:inline; margin-left:4px;">(optional)</span>
          </label>
          <textarea
            id="inc-notes"
            name="notes"
            class="form-textarea"
            placeholder="Any additional observations or context…"
            rows="3"
            maxlength="1000"
          ></textarea>
        </div>

      </div><!-- /incident-form__grid -->

      <!-- Form actions -->
      <div class="incident-form__actions">
        <button
          type="submit"
          class="btn btn--primary"
          id="inc-submit-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
          Report Incident
        </button>
        <button type="button" class="btn btn--secondary" id="inc-cancel-btn">
          Cancel
        </button>
      </div>

    </form>
  `;
}

// ── Event listeners ────────────────────────────────────────────────────────

/**
 * Wire up all form event listeners.
 *
 * @param {HTMLElement} container
 * @param {Function}    onSuccess
 */
function attachFormListeners(container, onSuccess) {
  const form      = container.querySelector('#incident-form');
  const submitBtn = container.querySelector('#inc-submit-btn');
  const cancelBtn = container.querySelector('#inc-cancel-btn');

  if (!form) return;

  // Submit handler.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    handleSubmit(form, submitBtn, onSuccess);
  });

  // Cancel handler — delegated to parent via onSuccess(null).
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (typeof onSuccess === 'function') onSuccess(null);
    });
  }

  // Live validation: clear errors as the user corrects each field.
  form.addEventListener('input', (e) => {
    const field = e.target.name;
    if (field) clearFieldError(form, field);
  });

  form.addEventListener('change', (e) => {
    const field = e.target.name;
    if (field) clearFieldError(form, field);
  });
}

// ── Submit handler ─────────────────────────────────────────────────────────

/**
 * Handle form submission:
 * 1. Collect field values
 * 2. Run validation via incidentService
 * 3. Check for duplicates (non-blocking)
 * 4. Create incident
 * 5. Show toast, reset form, call onSuccess
 *
 * @param {HTMLFormElement} form
 * @param {HTMLButtonElement} submitBtn
 * @param {Function} onSuccess
 */
function handleSubmit(form, submitBtn, onSuccess) {
  // Collect values.
  const fields = collectFields(form);

  // Validate.
  const { valid, errors } = validateIncident(fields);
  if (!valid) {
    showFieldErrors(form, errors);
    scrollToFirstError(form);
    return;
  }

  // Clear all errors before proceeding.
  clearAllErrors(form);

  // Check for duplicates — show warning but do NOT block.
  const dupWarning = checkDuplicate(fields);
  showDuplicateWarning(form, dupWarning);

  // Disable submit to prevent double-submit.
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
  }

  // Create the incident.
  const result = createIncident(fields);

  // Re-enable submit button.
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" aria-hidden="true" width="16" height="16">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5"  y1="12" x2="19" y2="12"/>
      </svg>
      Report Incident
    `;
  }

  if (!result.success) {
    // Service-level errors (e.g. storage full).
    if (result.errors) {
      showFieldErrors(form, result.errors);
      scrollToFirstError(form);
    } else {
      showToast(result.error || 'Could not save incident. Please try again.', 'error');
    }
    return;
  }

  // Success.
  showToast(`Incident ${result.incident.id} reported successfully.`, 'success');
  form.reset();
  hideDuplicateWarning(form);

  if (typeof onSuccess === 'function') {
    onSuccess(result.incident);
  }
}

// ── Field helpers ──────────────────────────────────────────────────────────

/**
 * Collect all form field values into an object.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function collectFields(form) {
  return {
    title:       form.querySelector('[name="title"]')?.value       ?? '',
    description: form.querySelector('[name="description"]')?.value ?? '',
    location:    form.querySelector('[name="location"]')?.value    ?? '',
    reportedBy:  form.querySelector('[name="reportedBy"]')?.value  ?? '',
    type:        form.querySelector('[name="type"]')?.value        ?? '',
    priority:    form.querySelector('[name="priority"]')?.value    ?? '',
    notes:       form.querySelector('[name="notes"]')?.value       ?? '',
  };
}

/**
 * Map from form field name → error span ID.
 */
const ERROR_SPAN_IDS = {
  title:       'inc-title-error',
  description: 'inc-description-error',
  location:    'inc-location-error',
  reportedBy:  'inc-reporter-error',
  type:        'inc-type-error',
  priority:    'inc-priority-error',
};

/**
 * Map from form field name → input element selector.
 */
const FIELD_SELECTORS = {
  title:       '[name="title"]',
  description: '[name="description"]',
  location:    '[name="location"]',
  reportedBy:  '[name="reportedBy"]',
  type:        '[name="type"]',
  priority:    '[name="priority"]',
};

/**
 * Show field-level validation errors.
 * @param {HTMLFormElement} form
 * @param {Object} errors - { fieldName: errorMessage }
 */
function showFieldErrors(form, errors) {
  Object.entries(errors).forEach(([field, message]) => {
    // Show error span.
    const spanId = ERROR_SPAN_IDS[field];
    if (spanId) {
      const span = document.getElementById(spanId);
      if (span) {
        span.textContent = message;
        span.hidden      = false;
      }
    }
    // Add error class to input.
    const selector = FIELD_SELECTORS[field];
    if (selector) {
      const input = form.querySelector(selector);
      if (input) {
        input.classList.add('form-input--error', 'form-select--error', 'form-textarea--error');
      }
    }
  });
}

/**
 * Clear the error for a single field.
 * @param {HTMLFormElement} form
 * @param {string} fieldName
 */
function clearFieldError(form, fieldName) {
  const spanId = ERROR_SPAN_IDS[fieldName];
  if (spanId) {
    const span = document.getElementById(spanId);
    if (span) {
      span.textContent = '';
      span.hidden      = true;
    }
  }
  const selector = FIELD_SELECTORS[fieldName];
  if (selector) {
    const input = form.querySelector(selector);
    if (input) {
      input.classList.remove('form-input--error', 'form-select--error', 'form-textarea--error');
    }
  }
}

/**
 * Clear all field errors.
 * @param {HTMLFormElement} form
 */
function clearAllErrors(form) {
  Object.keys(ERROR_SPAN_IDS).forEach((field) => clearFieldError(form, field));
}

/**
 * Scroll the form to the first visible error element.
 * @param {HTMLFormElement} form
 */
function scrollToFirstError(form) {
  const firstError = form.querySelector('.form-error:not([hidden])');
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Move focus to the corresponding input.
    const group = firstError.closest('.form-group');
    if (group) {
      const input = group.querySelector('input, select, textarea');
      if (input) input.focus();
    }
  }
}

/**
 * Show or update the non-blocking duplicate warning banner.
 * @param {HTMLFormElement} form
 * @param {string|null} message
 */
function showDuplicateWarning(form, message) {
  const banner   = document.getElementById('dup-warning');
  const textSpan = document.getElementById('dup-warning-text');
  if (!banner || !textSpan) return;

  if (message) {
    textSpan.textContent = message;
    banner.hidden        = false;
  } else {
    banner.hidden        = true;
    textSpan.textContent = '';
  }
}

/**
 * Hide the duplicate warning banner.
 * @param {HTMLFormElement} form
 */
function hideDuplicateWarning(form) {
  const banner = document.getElementById('dup-warning');
  if (banner) banner.hidden = true;
}
