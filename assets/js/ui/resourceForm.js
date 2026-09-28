/**
 * resourceForm.js
 * ---------------
 * Renders the Add / Edit resource form.
 *
 * Supports two modes:
 *   - Create mode (resource = null): blank form, "Add Resource" button.
 *   - Edit mode   (resource = Object): pre-filled, "Save Changes" button.
 *
 * @param {HTMLElement}  container  - Target element
 * @param {Object|null}  resource   - Existing resource for edit, null for create
 * @param {Function}     onSuccess  - Called with saved resource on success, null on cancel
 */

import {
  validateResource,
  createResource,
  updateResource,
} from '../services/resourceService.js';

import { escapeHtml, RESOURCE_TYPES } from '../utils.js';
import { showToast } from './toast.js';

export function renderResourceForm(container, resource, onSuccess) {
  const isEdit = resource !== null && resource !== undefined;
  container.innerHTML = buildFormHTML(resource, isEdit);
  attachListeners(container, resource, isEdit, onSuccess);
}

// ── HTML ───────────────────────────────────────────────────────────────────

function buildFormHTML(resource, isEdit) {
  const typeOptions = RESOURCE_TYPES.map(
    (t) => `<option value="${escapeHtml(t)}"${resource?.type === t ? ' selected' : ''}>${escapeHtml(t)}</option>`
  ).join('');

  const deployedWarning = isEdit && resource.status === 'Deployed'
    ? `<div class="alert alert--warning resource-form__deployed-warning" role="note">
         <svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
           <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
           <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
         </svg>
         <span>This resource is currently deployed to incident <strong>${escapeHtml(resource.assignedTo || '')}</strong>. Changes will not affect the current assignment.</span>
       </div>`
    : '';

  return `
    <form class="resource-form" id="resource-form" novalidate aria-label="${isEdit ? 'Edit resource' : 'Add new resource'}">
      ${deployedWarning}

      <div class="resource-form__grid">

        <!-- Name -->
        <div class="form-group resource-form__full-width">
          <label class="form-label form-label--required" for="res-name">Resource Name</label>
          <input
            type="text" id="res-name" name="name" class="form-input"
            placeholder="e.g. Ambulance Unit 1"
            value="${isEdit ? escapeHtml(resource.name) : ''}"
            maxlength="100" autocomplete="off"
            aria-required="true" aria-describedby="res-name-error"
          />
          <span class="form-error" id="res-name-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Type -->
        <div class="form-group">
          <label class="form-label form-label--required" for="res-type">Resource Type</label>
          <select id="res-type" name="type" class="form-select"
                  aria-required="true" aria-describedby="res-type-error">
            <option value="">— Select type —</option>
            ${typeOptions}
          </select>
          <span class="form-error" id="res-type-error" role="alert" aria-live="polite" hidden></span>
        </div>

        <!-- Location -->
        <div class="form-group">
          <label class="form-label form-label--required" for="res-location">Location</label>
          <input
            type="text" id="res-location" name="location" class="form-input"
            placeholder="e.g. Main Campus Gate"
            value="${isEdit ? escapeHtml(resource.location) : ''}"
            maxlength="200" autocomplete="off"
            aria-required="true" aria-describedby="res-location-error"
          />
          <span class="form-error" id="res-location-error" role="alert" aria-live="polite" hidden></span>
        </div>

      </div>

      <div class="resource-form__actions">
        <button type="submit" class="btn btn--primary" id="res-submit-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            ${isEdit
              ? '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'
              : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
          </svg>
          ${isEdit ? 'Save Changes' : 'Add Resource'}
        </button>
        <button type="button" class="btn btn--secondary" id="res-cancel-btn">Cancel</button>
      </div>
    </form>
  `;
}

// ── Listeners ──────────────────────────────────────────────────────────────

function attachListeners(container, resource, isEdit, onSuccess) {
  const form      = container.querySelector('#resource-form');
  const submitBtn = container.querySelector('#res-submit-btn');
  const cancelBtn = container.querySelector('#res-cancel-btn');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(form, submitBtn, resource, isEdit, onSuccess);
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (typeof onSuccess === 'function') onSuccess(null);
    });
  }

  // Live validation: clear error on correction.
  form.addEventListener('input',  (e) => clearError(e.target.name));
  form.addEventListener('change', (e) => clearError(e.target.name));
}

// ── Submit ─────────────────────────────────────────────────────────────────

function handleSubmit(form, submitBtn, resource, isEdit, onSuccess) {
  const fields = collectFields(form);
  const { valid, errors } = validateResource(fields, isEdit ? resource.id : null);

  if (!valid) {
    showErrors(errors);
    focusFirstError(form);
    return;
  }

  clearAllErrors();

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

  const result = isEdit
    ? updateResource(resource.id, fields)
    : createResource(fields);

  if (submitBtn) { submitBtn.disabled = false; }

  if (!result.success) {
    if (result.errors) { showErrors(result.errors); focusFirstError(form); }
    else { showToast(result.error || 'Could not save resource. Please try again.', 'error'); }
    resetSubmitBtn(submitBtn, isEdit);
    return;
  }

  showToast(
    isEdit
      ? `Resource ${result.resource.id} updated.`
      : `Resource ${result.resource.id} added.`,
    'success'
  );

  if (!isEdit) form.reset();
  if (typeof onSuccess === 'function') onSuccess(result.resource);
}

function resetSubmitBtn(btn, isEdit) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = isEdit ? 'Save Changes' : 'Add Resource';
}

// ── Field helpers ──────────────────────────────────────────────────────────

function collectFields(form) {
  return {
    name:     form.querySelector('[name="name"]')?.value     ?? '',
    type:     form.querySelector('[name="type"]')?.value     ?? '',
    location: form.querySelector('[name="location"]')?.value ?? '',
  };
}

const ERROR_MAP = {
  name:     'res-name-error',
  type:     'res-type-error',
  location: 'res-location-error',
};

const INPUT_MAP = {
  name:     '[name="name"]',
  type:     '[name="type"]',
  location: '[name="location"]',
};

function showErrors(errors) {
  Object.entries(errors).forEach(([field, msg]) => {
    const span = document.getElementById(ERROR_MAP[field]);
    if (span) { span.textContent = msg; span.hidden = false; }
    const input = document.querySelector(INPUT_MAP[field]);
    if (input) input.classList.add('form-input--error', 'form-select--error');
  });
}

function clearError(fieldName) {
  const spanId = ERROR_MAP[fieldName];
  if (spanId) {
    const span = document.getElementById(spanId);
    if (span) { span.textContent = ''; span.hidden = true; }
  }
  const sel = INPUT_MAP[fieldName];
  if (sel) {
    const input = document.querySelector(sel);
    if (input) input.classList.remove('form-input--error', 'form-select--error');
  }
}

function clearAllErrors() {
  Object.keys(ERROR_MAP).forEach(clearError);
}

function focusFirstError(form) {
  const first = form.querySelector('.form-error:not([hidden])');
  if (!first) return;
  const group = first.closest('.form-group');
  if (group) {
    const input = group.querySelector('input, select');
    if (input) input.focus();
  }
}
