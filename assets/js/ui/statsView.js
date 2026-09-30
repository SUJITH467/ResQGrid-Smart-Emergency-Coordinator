/**
 * statsView.js
 * ------------
 * Renders the Statistics Dashboard into a target container element.
 *
 * Data flow:
 *   app.js calls renderStatsView(container)
 *   → fetches incidents + resources from their services
 *   → calls statsService.compute(incidents, resources)
 *   → renders sections
 *
 * statsView never reads LocalStorage directly.
 */

import { getAllIncidents }    from '../services/incidentService.js';
import { getAllResources }    from '../services/resourceService.js';
import {
  compute,
  formatDuration,
  formatUtilization,
  formatCount,
} from '../services/statsService.js';

import { escapeHtml } from '../utils.js';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render the full statistics dashboard into `container`.
 * Called by app.js each time #stats route is activated.
 *
 * @param {HTMLElement} container
 */
export function renderStatsView(container) {
  container.innerHTML = buildShell();
  mountContent(container);
  wireRefresh(container);
}

// ── Shell HTML ─────────────────────────────────────────────────────────────

function buildShell() {
  return `
    <div class="stats-toolbar">
      <div class="stats-toolbar__meta">
        <span id="stats-updated-at" class="stats-toolbar__updated"
              aria-live="polite" aria-atomic="true"></span>
      </div>
      <button type="button" class="btn btn--secondary btn--sm"
              id="stats-refresh-btn" aria-label="Refresh statistics">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" aria-hidden="true">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-4"/>
        </svg>
        Refresh
      </button>
    </div>
    <div id="stats-content" role="region" aria-label="Statistics Dashboard"></div>
  `;
}

// ── Content mount + refresh ────────────────────────────────────────────────

function mountContent(container) {
  const contentEl = container.querySelector('#stats-content');
  if (!contentEl) return;

  let stats;
  try {
    const incidents = getAllIncidents();
    const resources = getAllResources();
    stats = compute(incidents, resources);
  } catch (err) {
    contentEl.innerHTML = `
      <div class="alert alert--error" role="alert">
        <strong>Statistics could not be computed.</strong>
        Please refresh the page. If the problem persists, check your browser's
        storage settings.
      </div>`;
    return;
  }

  contentEl.innerHTML = buildContent(stats);

  // Update "Updated at" label.
  const updatedEl = container.querySelector('#stats-updated-at');
  if (updatedEl) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    updatedEl.textContent = `Updated at ${now}`;
  }
}

function wireRefresh(container) {
  const btn = container.querySelector('#stats-refresh-btn');
  if (btn) btn.addEventListener('click', () => mountContent(container));
}

// ── Full content HTML ──────────────────────────────────────────────────────

function buildContent(stats) {
  return `
    ${buildSummaryCards(stats)}
    ${buildIncidentOverview(stats)}
    ${buildResourceOverview(stats)}
    ${buildResolutionSection(stats)}
  `;
}

// ── Summary cards (8) ─────────────────────────────────────────────────────

function buildSummaryCards(stats) {
  const { incidents: inc, resources: res } = stats;
  const util = formatUtilization(res.utilization);

  const cards = [
    {
      value:   formatCount(inc.active),
      label:   'Active Incidents',
      sub:     `of ${formatCount(inc.total)} total`,
      icon:    iconAlert(),
      accent:  '',
      ariaLabel: `${inc.active} Active Incidents`,
    },
    {
      value:   formatCount(inc.critical),
      label:   'Critical Incidents',
      sub:     'require immediate attention',
      icon:    iconCircleAlert(),
      accent:  'summary-card--critical',
      ariaLabel: `${inc.critical} Critical Incidents`,
    },
    {
      value:   formatCount(inc.resolved),
      label:   'Resolved Incidents',
      sub:     'this session',
      icon:    iconCheck(),
      accent:  'summary-card--resolved',
      ariaLabel: `${inc.resolved} Resolved Incidents`,
    },
    {
      value:   formatCount(inc.total),
      label:   'Total Incidents',
      sub:     'all time',
      icon:    iconFile(),
      accent:  '',
      ariaLabel: `${inc.total} Total Incidents`,
    },
    {
      value:   formatCount(res.available),
      label:   'Available Resources',
      sub:     'ready for deployment',
      icon:    iconMonitor(),
      accent:  'summary-card--available',
      ariaLabel: `${res.available} Available Resources`,
    },
    {
      value:   formatCount(res.deployed),
      label:   'Deployed Resources',
      sub:     'currently active',
      icon:    iconSend(),
      accent:  'summary-card--deployed',
      ariaLabel: `${res.deployed} Deployed Resources`,
    },
    {
      value:   util,
      label:   'Utilization Rate',
      sub:     'deployed / operational',
      icon:    iconBar(),
      accent:  '',
      ariaLabel: `Utilization rate: ${util}`,
    },
    {
      value:   formatDuration(stats.resolution.average),
      label:   'Avg. Resolution Time',
      sub:     stats.resolution.average === null ? 'no resolved incidents yet' : 'per incident',
      icon:    iconClock(),
      accent:  '',
      ariaLabel: `Average resolution time: ${formatDuration(stats.resolution.average)}`,
    },
  ];

  const cardsHTML = cards.map((c) => `
    <article class="summary-card ${c.accent}" role="listitem"
             aria-label="${escapeHtml(c.ariaLabel)}">
      <div class="summary-card__icon" aria-hidden="true">${c.icon}</div>
      <div class="summary-card__value">${escapeHtml(String(c.value))}</div>
      <div class="summary-card__label">${escapeHtml(c.label)}</div>
      <div class="summary-card__sub">${escapeHtml(c.sub)}</div>
    </article>
  `).join('');

  return `
    <div class="summary-cards" role="list" aria-label="Summary metrics">
      ${cardsHTML}
    </div>
  `;
}

// ── Incident overview (3 bar charts) ──────────────────────────────────────

function buildIncidentOverview(stats) {
  const { incidents: inc } = stats;
  const hasIncidents = inc.total > 0;

  const emptyMsg = `
    <div class="stats-empty">
      <p class="stats-empty__message">
        No incidents have been reported yet.
        <a href="#incidents" class="stats-empty__link">Report your first incident →</a>
      </p>
    </div>
  `;

  return `
    <section class="stats-section" aria-label="Incident Overview">
      <h2 class="stats-section__heading">Incident Overview</h2>
      ${!hasIncidents ? emptyMsg : `
        <div class="stats-charts-grid">
          <div class="stats-chart-block">
            <h3 class="stats-chart-block__title">By Type</h3>
            ${buildBarTable(inc.byType, 'type')}
          </div>
          <div class="stats-chart-block">
            <h3 class="stats-chart-block__title">By Priority</h3>
            ${buildBarTable(inc.byPriority, 'priority')}
          </div>
          <div class="stats-chart-block">
            <h3 class="stats-chart-block__title">By Status</h3>
            ${buildBarTable(inc.byStatus, 'status-incident')}
          </div>
        </div>
      `}
    </section>
  `;
}

// ── Resource overview (2 bar charts) ──────────────────────────────────────

function buildResourceOverview(stats) {
  const { resources: res } = stats;
  const hasResources = res.total > 0;

  const emptyMsg = `
    <div class="stats-empty">
      <p class="stats-empty__message">
        No resources have been added yet.
        <a href="#resources" class="stats-empty__link">Add your first resource →</a>
      </p>
    </div>
  `;

  return `
    <section class="stats-section" aria-label="Resource Overview">
      <h2 class="stats-section__heading">Resource Overview</h2>
      ${!hasResources ? emptyMsg : `
        <div class="stats-charts-grid">
          <div class="stats-chart-block">
            <h3 class="stats-chart-block__title">By Type</h3>
            ${buildBarTable(res.byType, 'res-type')}
          </div>
          <div class="stats-chart-block">
            <h3 class="stats-chart-block__title">By Status</h3>
            ${buildBarTable(res.byStatus, 'res-status')}
          </div>
        </div>
      `}
    </section>
  `;
}

// ── Resolution time section ────────────────────────────────────────────────

function buildResolutionSection(stats) {
  const { resolution: r } = stats;

  const noData = r.average === null;

  const body = noData
    ? `<p class="stats-resolution__empty">
         N/A — No incidents have been resolved yet.
         Resolution time will appear once incidents are closed.
       </p>`
    : `
      <div class="stats-resolution__grid">
        <div class="stats-resolution__item">
          <span class="stats-resolution__label">Average</span>
          <span class="stats-resolution__value">${escapeHtml(formatDuration(r.average))}</span>
        </div>
        <div class="stats-resolution__item">
          <span class="stats-resolution__label">Fastest</span>
          <span class="stats-resolution__value stats-resolution__value--fast">
            ${escapeHtml(formatDuration(r.fastest))}
          </span>
        </div>
        <div class="stats-resolution__item">
          <span class="stats-resolution__label">Slowest</span>
          <span class="stats-resolution__value stats-resolution__value--slow">
            ${escapeHtml(formatDuration(r.slowest))}
          </span>
        </div>
      </div>`;

  return `
    <section class="stats-section" aria-label="Resolution Time">
      <h2 class="stats-section__heading">Resolution Time</h2>
      ${body}
    </section>
  `;
}

// ── Bar chart table ────────────────────────────────────────────────────────

/**
 * Build an accessible table with CSS bar charts.
 *
 * @param {Array<{label:string, count:number, pct:number}>} rows
 * @param {string} colorGroup - Used to pick CSS fill class (type/priority/status-incident/etc.)
 * @returns {string} HTML
 */
function buildBarTable(rows, colorGroup) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  const rowsHTML = rows.map((row) => {
    const fillClass = getFillClass(colorGroup, row.label);
    const barWidth  = Math.min(100, row.pct);
    const minWidth  = row.pct > 0 ? 'min-width:2px;' : '';

    return `
      <tr>
        <td class="stat-table__label" data-label="Category">${escapeHtml(row.label)}</td>
        <td class="stat-table__count" data-label="Count">${formatCount(row.count)}</td>
        <td class="stat-table__pct"   data-label="%">${row.pct === 0 ? '0%' : `${row.pct}%`}</td>
        <td class="stat-table__bar"   data-label="Distribution">
          <div class="stat-bar-track" role="presentation">
            <div class="stat-bar-fill ${fillClass}"
                 style="width:${barWidth}%;${minWidth}"
                 aria-hidden="true"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="stat-table">
      <caption class="sr-only">Breakdown table — ${escapeHtml(colorGroup)}</caption>
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col">Count</th>
          <th scope="col">%</th>
          <th scope="col">Distribution</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot>
        <tr>
          <td class="stat-table__total-label">Total</td>
          <td class="stat-table__total-count">${formatCount(total)}</td>
          <td></td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;
}

// ── Fill class helper ──────────────────────────────────────────────────────

const FILL_CLASS_MAP = {
  type: {
    'Fire':             'stat-bar-fill--fire',
    'Medical':          'stat-bar-fill--medical',
    'Security':         'stat-bar-fill--security',
    'Hazmat':           'stat-bar-fill--hazmat',
    'Natural Disaster': 'stat-bar-fill--natural',
    'Other':            'stat-bar-fill--other',
  },
  priority: {
    'Critical': 'stat-bar-fill--critical',
    'High':     'stat-bar-fill--high',
    'Medium':   'stat-bar-fill--medium',
    'Low':      'stat-bar-fill--low',
  },
  'status-incident': {
    'Reported':     'stat-bar-fill--reported',
    'Active':       'stat-bar-fill--active',
    'In Progress':  'stat-bar-fill--inprogress',
    'Resolved':     'stat-bar-fill--resolved',
  },
  'res-type': {
    'Ambulance':   'stat-bar-fill--res-type',
    'Fire Truck':  'stat-bar-fill--res-type',
    'Police Unit': 'stat-bar-fill--res-type',
    'Hazmat Team': 'stat-bar-fill--res-type',
    'Medical Team':'stat-bar-fill--res-type',
    'Utility Crew':'stat-bar-fill--res-type',
    'Other':       'stat-bar-fill--res-type',
  },
  'res-status': {
    'Available':   'stat-bar-fill--available',
    'Deployed':    'stat-bar-fill--deployed',
    'Maintenance': 'stat-bar-fill--maintenance',
  },
};

function getFillClass(colorGroup, label) {
  return FILL_CLASS_MAP[colorGroup]?.[label] ?? 'stat-bar-fill--other';
}

// ── SVG icons (inline, no external deps) ──────────────────────────────────

const SVG = (path) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`;

const iconAlert   = () => SVG(`<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`);
const iconCircleAlert = () => SVG(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`);
const iconCheck   = () => SVG(`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`);
const iconFile    = () => SVG(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`);
const iconMonitor = () => SVG(`<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`);
const iconSend    = () => SVG(`<polygon points="3 11 22 2 13 21 11 13 3 11"/>`);
const iconBar     = () => SVG(`<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`);
const iconClock   = () => SVG(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`);
