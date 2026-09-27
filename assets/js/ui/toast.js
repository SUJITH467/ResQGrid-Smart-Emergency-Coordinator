/**
 * toast.js
 * --------
 * Shared toast notification utility for ResQGrid.
 *
 * Usage:
 *   import { showToast } from './toast.js';
 *   showToast('Incident created successfully.', 'success');
 *
 * Toast types: 'success' | 'error' | 'warning' | 'info'
 * Auto-dismisses after 4 seconds (per spec section 8).
 */

const TOAST_DURATION_MS = 4000;

/**
 * Show a non-blocking toast notification.
 *
 * @param {string} message - Text to display
 * @param {'success'|'error'|'warning'|'info'} type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Build the toast element.
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  // Pick an icon based on type.
  const icon = getToastIcon(type);

  toast.innerHTML = `
    ${icon}
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Auto-remove after TOAST_DURATION_MS.
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, TOAST_DURATION_MS);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Return an inline SVG icon string for a given toast type.
 * @param {string} type
 * @returns {string}
 */
function getToastIcon(type) {
  const icons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" aria-hidden="true" style="flex-shrink:0">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>`,
    error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" aria-hidden="true" style="flex-shrink:0">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9"  y1="9" x2="15" y2="15"/>
              </svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" aria-hidden="true" style="flex-shrink:0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" aria-hidden="true" style="flex-shrink:0">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>`,
  };
  return icons[type] || icons.info;
}

/**
 * Minimal HTML escape to prevent XSS in toast messages.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
