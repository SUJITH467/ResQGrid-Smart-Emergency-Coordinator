/**
 * assistantPanel.js
 * -----------------
 * Renders the Decision-Support Assistant UI panel.
 *
 * ⚠ This tool uses keyword matching rules — not AI.
 * All suggestions are advisory only. The coordinator makes every final decision.
 *
 * Spec reference: .kiro/specs/decision-assistant.md
 *
 * @param {HTMLElement} container  - Target element to render into
 * @param {Function}    onAccept   - Called with transfer payload when coordinator accepts
 */

import {
  analyze,
  logResult,
  buildTransferPayload,
} from '../services/assistantService.js';

import {
  escapeHtml,
  INCIDENT_TYPES,
  INCIDENT_PRIORITIES,
  RESOURCE_TYPES,
} from '../utils.js';

import { showToast } from './toast.js';

// ── Module state ───────────────────────────────────────────────────────────
// Tracks the current analysis result so logging can mark it accepted/dismissed.
let _currentResult      = null;
let _currentDescription = '';
let _resultLogged       = false;   // true once a log entry has been written

// ── Public API ─────────────────────────────────────────────────────────────

export function renderAssistantPanel(container, onAccept) {
  container.innerHTML = buildPanelHTML();
  attachListeners(container, onAccept);
}

// ── HTML ───────────────────────────────────────────────────────────────────

function buildPanelHTML() {
  return `
    <div class="assistant-panel">

      <!-- Input area -->
      <div class="assistant-panel__input-section">
        <div class="form-group">
          <label class="form-label" for="assistant-description">
            Describe the incident
          </label>
          <textarea
            id="assistant-description"
            class="form-textarea assistant-panel__textarea"
            placeholder="e.g. Thick smoke visible from second floor stairwell near the chemistry lab. No flames observed yet."
            rows="5"
            maxlength="1000"
            aria-required="true"
            aria-describedby="assistant-char-count assistant-short-hint"
          ></textarea>
          <div class="assistant-panel__input-meta">
            <span id="assistant-short-hint" class="form-hint assistant-panel__short-hint" hidden>
              Provide more detail for a better suggestion (minimum 10 characters).
            </span>
            <span id="assistant-char-count" class="assistant-panel__char-count"
                  aria-live="polite" aria-atomic="true">
              0 / 1000
            </span>
          </div>
        </div>

        <div class="assistant-panel__input-actions">
          <button type="button" class="btn btn--primary" id="assistant-analyze-btn"
                  disabled aria-label="Analyze the incident description">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Analyze
          </button>
          <button type="button" class="btn btn--secondary" id="assistant-clear-btn"
                  aria-label="Clear description and reset panel">
            Clear
          </button>
        </div>
      </div>

      <!-- Result panel — hidden until analysis runs -->
      <div
        id="assistant-result"
        class="assistant-panel__result"
        role="region"
        aria-label="Analysis result"
        aria-live="polite"
        hidden
      ></div>

    </div>
  `;
}

// ── Result panel HTML ──────────────────────────────────────────────────────

function buildResultHTML(result, description, editState) {
  const isFallback   = result.isFallback;
  const panelClass   = isFallback
    ? 'assistant-result assistant-result--fallback'
    : 'assistant-result';
  const acceptLabel  = isFallback ? 'Accept & Review' : 'Accept Suggestion';
  const edited       = editState && editState.edited;
  const acceptBtn    = edited ? 'Accept Edited Suggestion' : acceptLabel;

  const displayType      = (editState?.type)      ?? result.suggestedType;
  const displayPriority  = (editState?.priority)  ?? result.suggestedPriority;
  const displayResources = (editState?.resources) ?? result.suggestedResources;

  const confidenceDots   = buildConfidenceDots(result.confidence);
  const confidenceClass  = `assistant-confidence--${result.confidence.toLowerCase()}`;

  const typeOptions      = INCIDENT_TYPES.map((t) =>
    `<option value="${escapeHtml(t)}"${displayType === t ? ' selected' : ''}>${escapeHtml(t)}</option>`
  ).join('');

  const priorityOptions  = INCIDENT_PRIORITIES.map((p) =>
    `<option value="${escapeHtml(p)}"${displayPriority === p ? ' selected' : ''}>${escapeHtml(p)}</option>`
  ).join('');

  const resourceChecks   = RESOURCE_TYPES.map((rt) => {
    const checked = displayResources.includes(rt) ? ' checked' : '';
    return `
      <label class="assistant-resource-check">
        <input type="checkbox" name="res-check" value="${escapeHtml(rt)}"${checked}
               aria-label="Include ${escapeHtml(rt)}"/>
        ${escapeHtml(rt)}
      </label>`;
  }).join('');

  const keywordsHTML = result.matchedKeywords.length > 0
    ? result.matchedKeywords.map((k) => `<span class="assistant-keyword">${escapeHtml(k)}</span>`).join(' ')
    : '<em>none</em>';

  return `
    <div class="${panelClass}">
      <div class="assistant-result__header">
        <h3 class="assistant-result__title" id="assistant-result-heading" tabindex="-1">
          ${isFallback ? '⚠ Low Confidence — Review Required' : 'Suggestion'}
        </h3>
        <div class="assistant-confidence ${confidenceClass}"
             aria-label="Confidence: ${escapeHtml(result.confidence)}">
          ${confidenceDots}
          <span class="assistant-confidence__label">${escapeHtml(result.confidence)}</span>
        </div>
      </div>

      ${isFallback ? `
        <p class="assistant-result__fallback-note">
          No strong indicators were detected. Review and adjust the fields below
          before transferring to the incident form.
        </p>` : ''}

      <!-- Type -->
      <div class="assistant-result__field">
        <span class="assistant-result__field-label">Incident Type</span>
        <div class="assistant-result__field-value">
          <span class="assistant-result__display-value" data-field="type">
            <span class="badge badge--type">${escapeHtml(displayType)}</span>
          </span>
          <div class="assistant-result__edit-control" data-edit-field="type" hidden>
            <label for="edit-type" class="sr-only">Edit incident type</label>
            <select id="edit-type" class="form-select assistant-result__edit-select"
                    aria-label="Incident type">
              ${typeOptions}
            </select>
          </div>
          <button type="button" class="btn btn--ghost btn--sm assistant-result__edit-btn"
                  data-toggle-field="type" aria-label="Edit incident type">
            Edit
          </button>
        </div>
      </div>

      <!-- Priority -->
      <div class="assistant-result__field">
        <span class="assistant-result__field-label">Priority</span>
        <div class="assistant-result__field-value">
          <span class="assistant-result__display-value" data-field="priority">
            <span class="badge ${getPriorityBadgeClass(displayPriority)}">${escapeHtml(displayPriority)}</span>
          </span>
          <div class="assistant-result__edit-control" data-edit-field="priority" hidden>
            <label for="edit-priority" class="sr-only">Edit priority</label>
            <select id="edit-priority" class="form-select assistant-result__edit-select"
                    aria-label="Priority">
              ${priorityOptions}
            </select>
          </div>
          <button type="button" class="btn btn--ghost btn--sm assistant-result__edit-btn"
                  data-toggle-field="priority" aria-label="Edit priority">
            Edit
          </button>
        </div>
      </div>

      <!-- Resources -->
      <div class="assistant-result__field">
        <span class="assistant-result__field-label">Suggested Resources</span>
        <div class="assistant-result__field-value">
          <span class="assistant-result__display-value" data-field="resources">
            ${displayResources.length > 0
              ? displayResources.map((r) => `<span class="badge badge--type">${escapeHtml(r)}</span>`).join(' ')
              : '<em class="assistant-result__none">None suggested</em>'}
          </span>
          <div class="assistant-result__edit-control assistant-result__edit-control--resources"
               data-edit-field="resources" hidden>
            <fieldset class="assistant-resource-fieldset">
              <legend class="sr-only">Select required resource types</legend>
              ${resourceChecks}
            </fieldset>
          </div>
          <button type="button" class="btn btn--ghost btn--sm assistant-result__edit-btn"
                  data-toggle-field="resources" aria-label="Edit suggested resources">
            Edit
          </button>
        </div>
      </div>

      <!-- Explanation -->
      <div class="assistant-result__explanation">
        <h4 class="assistant-result__explanation-heading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" aria-hidden="true" width="14" height="14">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Why this suggestion
        </h4>
        <p class="assistant-result__explanation-text">${escapeHtml(result.explanation)}</p>
        <div class="assistant-result__keywords">
          <span class="assistant-result__keywords-label">Matched indicators:</span>
          ${keywordsHTML}
        </div>
      </div>

      <!-- Actions -->
      <div class="assistant-result__actions">
        <button type="button" class="btn btn--primary" id="assistant-accept-btn"
                aria-label="${escapeHtml(acceptBtn)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          ${escapeHtml(acceptBtn)}
        </button>
        <button type="button" class="btn btn--secondary" id="assistant-dismiss-btn"
                aria-label="Dismiss suggestion">
          Dismiss
        </button>
      </div>
    </div>
  `;
}

function buildConfidenceDots(level) {
  const filled  = level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
  const dots    = [1, 2, 3].map((i) =>
    `<span class="assistant-confidence__dot${i <= filled ? ' assistant-confidence__dot--filled' : ''}"
           aria-hidden="true"></span>`
  ).join('');
  return dots;
}

// ── Listeners ──────────────────────────────────────────────────────────────

function attachListeners(container, onAccept) {
  const textarea   = container.querySelector('#assistant-description');
  const analyzeBtn = container.querySelector('#assistant-analyze-btn');
  const clearBtn   = container.querySelector('#assistant-clear-btn');
  const resultDiv  = container.querySelector('#assistant-result');
  const hintEl     = container.querySelector('#assistant-short-hint');
  const countEl    = container.querySelector('#assistant-char-count');

  // Character counter + enable/disable Analyze button.
  if (textarea) {
    textarea.addEventListener('input', () => {
      const len     = textarea.value.length;
      const trimmed = textarea.value.trim();
      if (countEl) countEl.textContent = `${len} / 1000`;
      if (analyzeBtn) analyzeBtn.disabled = trimmed.length === 0;
      if (hintEl) hintEl.hidden = trimmed.length === 0 || trimmed.length >= 10;
    });
  }

  // Analyze button.
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      const description = textarea ? textarea.value : '';
      handleAnalyze(description, resultDiv, onAccept);
    });
  }

  // Clear button.
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Log dismissed if a result was showing and not yet logged.
      if (_currentResult && !_resultLogged) {
        logResult(_currentResult, _currentDescription, false);
        _resultLogged = true;
      }
      // Reset state.
      _currentResult      = null;
      _currentDescription = '';
      _resultLogged       = false;
      if (textarea)   { textarea.value = ''; }
      if (countEl)    { countEl.textContent = '0 / 1000'; }
      if (hintEl)     { hintEl.hidden = true; }
      if (analyzeBtn) { analyzeBtn.disabled = true; }
      if (resultDiv)  { resultDiv.hidden = true; resultDiv.innerHTML = ''; }
    });
  }
}

// ── Analyze handler ────────────────────────────────────────────────────────

function handleAnalyze(description, resultDiv, onAccept) {
  const result = analyze(description);

  _currentResult      = result;
  _currentDescription = description;
  _resultLogged       = false;

  // Log this analysis (accepted=false initially; updated on accept).
  logResult(result, description, false);
  _resultLogged = true;

  // Render result panel.
  if (resultDiv) {
    resultDiv.innerHTML = buildResultHTML(result, description, null);
    resultDiv.hidden    = false;

    // Move focus to result heading for accessibility.
    const heading = resultDiv.querySelector('#assistant-result-heading');
    if (heading) heading.focus();

    // Attach result-level listeners.
    attachResultListeners(resultDiv, result, description, onAccept);
  }
}

// ── Result-level listeners ─────────────────────────────────────────────────

function attachResultListeners(resultDiv, result, description, onAccept) {
  // Track edits to type, priority, resources.
  let editState = { edited: false, type: null, priority: null, resources: null };

  // Edit toggle buttons.
  resultDiv.querySelectorAll('[data-toggle-field]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field   = btn.getAttribute('data-toggle-field');
      const control = resultDiv.querySelector(`[data-edit-field="${field}"]`);
      const display = resultDiv.querySelector(`[data-field="${field}"]`);
      if (!control) return;

      const isOpen = !control.hidden;
      control.hidden = isOpen;
      display.hidden = !isOpen;
      btn.textContent = isOpen ? 'Edit' : 'Done';

      if (!isOpen) {
        // Edit opened — mark as edited.
        editState.edited = true;
        updateAcceptButton(resultDiv, result.isFallback, editState.edited);
      }
    });
  });

  // Re-render accept label dynamically when any edit select/checkbox changes.
  resultDiv.addEventListener('change', (e) => {
    const select = e.target.closest('[data-edit-field="type"] select');
    const psel   = e.target.closest('[data-edit-field="priority"] select');
    const rcheck = e.target.closest('[data-edit-field="resources"]');
    if (select || psel || rcheck) {
      editState.edited = true;
      updateAcceptButton(resultDiv, result.isFallback, true);
    }
  });

  // Accept button.
  const acceptBtn = resultDiv.querySelector('#assistant-accept-btn');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      // Collect any edits.
      const typeEl     = resultDiv.querySelector('#edit-type');
      const priorityEl = resultDiv.querySelector('#edit-priority');
      const resCBs     = resultDiv.querySelectorAll('[name="res-check"]:checked');

      const finalType      = typeEl     ? typeEl.value     : result.suggestedType;
      const finalPriority  = priorityEl ? priorityEl.value : result.suggestedPriority;
      const finalResources = resCBs.length > 0
        ? Array.from(resCBs).map((cb) => cb.value)
        : result.suggestedResources;

      // Build a result with any edits applied.
      const finalResult = {
        ...result,
        suggestedType:      finalType,
        suggestedPriority:  finalPriority,
        suggestedResources: finalResources,
      };

      // Log acceptance (the log entry was already written; write a new one
      // with accepted:true so the audit trail is accurate).
      logResult(finalResult, description, true);

      // Show confirmation in the result panel.
      resultDiv.innerHTML = buildAcceptedHTML();

      // Call parent with transfer payload.
      if (typeof onAccept === 'function') {
        onAccept(buildTransferPayload(finalResult, description));
      }

      showToast('Suggestion transferred to incident form.', 'success');
    });
  }

  // Dismiss button.
  const dismissBtn = resultDiv.querySelector('#assistant-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      resultDiv.hidden  = true;
      resultDiv.innerHTML = '';
      // Log entry already written with accepted:false.
    });
  }
}

function updateAcceptButton(resultDiv, isFallback, edited) {
  const btn = resultDiv.querySelector('#assistant-accept-btn');
  if (!btn) return;
  const label = edited
    ? 'Accept Edited Suggestion'
    : isFallback ? 'Accept & Review' : 'Accept Suggestion';
  btn.textContent = label;
  btn.setAttribute('aria-label', label);
}

function buildAcceptedHTML() {
  return `
    <div class="assistant-result assistant-result--accepted">
      <div class="assistant-result__accepted-msg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" aria-hidden="true" width="24" height="24">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <strong>Suggestion transferred to incident form.</strong>
      </div>
      <p class="assistant-result__accepted-sub">
        The incident type, priority and description have been pre-filled.
        You can still edit any field before submitting.
      </p>
      <a href="#incidents" class="btn btn--secondary btn--sm"
         aria-label="Go to incident form">
        Go to Incident Form →
      </a>
    </div>
  `;
}

// ── Badge helper ───────────────────────────────────────────────────────────

function getPriorityBadgeClass(priority) {
  return {
    Critical: 'badge--critical',
    High:     'badge--high',
    Medium:   'badge--medium',
    Low:      'badge--low',
  }[priority] || 'badge--medium';
}
