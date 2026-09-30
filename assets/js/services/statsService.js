/**
 * statsService.js
 * ---------------
 * Pure statistics computation for ResQGrid.
 *
 * Rules:
 * - All functions are pure — they accept arrays and return new values.
 * - No LocalStorage reads or writes are performed here.
 * - Data is always passed in by the caller (statsService never imports
 *   incidentService or resourceService directly).
 * - No NaN, Infinity, undefined or null values must appear in the result.
 *
 * Spec reference: .kiro/specs/statistics-dashboard.md
 */

import {
  logger,
  INCIDENT_TYPES,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  RESOURCE_TYPES,
  RESOURCE_STATUSES,
} from '../utils.js';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute a complete StatsResult from incident and resource arrays.
 * Never throws — returns a safe empty result on unexpected errors.
 *
 * @param {Array<Object>} incidents - From incidentService.getAllIncidents()
 * @param {Array<Object>} resources - From resourceService.getAllResources()
 * @returns {StatsResult}
 */
export function compute(incidents, resources) {
  try {
    // Defensive: ensure arrays even if corrupted data slips through.
    const inc = Array.isArray(incidents) ? incidents : [];
    const res = Array.isArray(resources) ? resources : [];

    return {
      incidents: computeIncidentStats(inc),
      resources: computeResourceStats(res),
      resolution: calcResolutionTimes(inc),
    };
  } catch (err) {
    logger.error('statsService.compute: Unexpected error.', err);
    return emptyResult();
  }
}

// ── Incident statistics ────────────────────────────────────────────────────

function computeIncidentStats(incidents) {
  const total    = incidents.length;
  const active   = incidents.filter((i) => i.status !== 'Resolved').length;
  const critical = incidents.filter((i) => i.priority === 'Critical').length;
  const resolved = incidents.filter((i) => i.status === 'Resolved').length;

  const byType     = countByField(incidents, 'type',     INCIDENT_TYPES);
  const byPriority = countByField(incidents, 'priority', INCIDENT_PRIORITIES);
  const byStatus   = countByField(incidents, 'status',   INCIDENT_STATUSES);

  return {
    total,
    active,
    critical,
    resolved,
    byType:     calcPercentages(byType,     total),
    byPriority: calcPercentages(byPriority, total),
    byStatus:   calcPercentages(byStatus,   total),
  };
}

// ── Resource statistics ────────────────────────────────────────────────────

function computeResourceStats(resources) {
  const total       = resources.length;
  const available   = resources.filter((r) => r.status === 'Available').length;
  const deployed    = resources.filter((r) => r.status === 'Deployed').length;
  const maintenance = resources.filter((r) => r.status === 'Maintenance').length;

  const byType   = countByField(resources, 'type',   RESOURCE_TYPES);
  const byStatus = countByField(resources, 'status', RESOURCE_STATUSES);

  return {
    total,
    available,
    deployed,
    maintenance,
    utilization: calcUtilization(resources),
    byType:      calcPercentages(byType,   total),
    byStatus:    calcPercentages(byStatus, total),
  };
}

// ── Generic helpers (exported for unit testing) ────────────────────────────

/**
 * Count occurrences of each enum value for a given field.
 * Always iterates all allowedValues so no value is skipped.
 *
 * @param {Array<Object>} array         - Records to count
 * @param {string}        field         - Field name on each record
 * @param {string[]}      allowedValues - Enum values to count
 * @returns {Array<{label:string, count:number}>}
 */
export function countByField(array, field, allowedValues) {
  const counts = {};
  allowedValues.forEach((v) => { counts[v] = 0; });
  array.forEach((item) => {
    const val = item[field];
    if (val in counts) counts[val]++;
  });
  return allowedValues.map((v) => ({ label: v, count: counts[v] }));
}

/**
 * Add a `pct` field to each item in a count array.
 * Guards against division by zero: if total === 0, all pct values are 0.
 *
 * @param {Array<{label:string, count:number}>} rows
 * @param {number}                              total
 * @returns {Array<{label:string, count:number, pct:number}>}
 */
export function calcPercentages(rows, total) {
  return rows.map((row) => ({
    ...row,
    pct: total === 0 ? 0 : Math.round((row.count / total) * 1000) / 10,
  }));
}

/**
 * Calculate the resource utilization rate.
 * Excludes Maintenance resources from the denominator.
 *
 * @param {Array<Object>} resources
 * @returns {number|null} Utilization percentage (0–100, 1dp) or null if N/A
 */
export function calcUtilization(resources) {
  const nonMaintenance = resources.filter((r) => r.status !== 'Maintenance');
  if (nonMaintenance.length === 0) return null;

  const deployed = nonMaintenance.filter((r) => r.status === 'Deployed').length;
  const rate     = (deployed / nonMaintenance.length) * 100;
  return Math.round(rate * 10) / 10;
}

/**
 * Calculate average, fastest and slowest resolution times in minutes.
 * Excludes invalid or negative durations.
 *
 * @param {Array<Object>} incidents
 * @returns {{ average: number|null, fastest: number|null, slowest: number|null }}
 */
export function calcResolutionTimes(incidents) {
  const durations = [];

  incidents.forEach((inc) => {
    if (inc.status !== 'Resolved') return;
    if (!inc.resolvedAt || !inc.reportedAt) return;

    const resolved  = Date.parse(inc.resolvedAt);
    const reported  = Date.parse(inc.reportedAt);

    if (isNaN(resolved) || isNaN(reported)) {
      logger.warn(`statsService: Invalid date on incident ${inc.id}. Excluding from resolution times.`);
      return;
    }

    const minutes = (resolved - reported) / 60000;

    if (minutes < 0) {
      logger.warn(`statsService: Negative duration on incident ${inc.id}. Excluding.`);
      return;
    }

    durations.push(minutes);
  });

  if (durations.length === 0) {
    return { average: null, fastest: null, slowest: null };
  }

  const sum     = durations.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / durations.length) * 10) / 10;
  const fastest = Math.round(Math.min(...durations) * 10) / 10;
  const slowest = Math.round(Math.max(...durations) * 10) / 10;

  return { average, fastest, slowest };
}

// ── Format helpers (exported for use in UI and tests) ──────────────────────

/**
 * Format a duration in minutes as a human-readable string.
 * Returns "N/A" when minutes is null.
 *
 * @param {number|null} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A';
  if (minutes < 1)    return '< 1 min';
  if (minutes < 60)   return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60 * 10) / 10} hrs`;
  return `${Math.round(minutes / 1440 * 10) / 10} days`;
}

/**
 * Format a utilization rate as a percentage string.
 * Returns "N/A" when rate is null.
 *
 * @param {number|null} rate
 * @returns {string}
 */
export function formatUtilization(rate) {
  if (rate === null || rate === undefined) return 'N/A';
  return `${rate}%`;
}

/**
 * Format a number with thousands separators.
 * Falls back to plain toString() if toLocaleString fails.
 *
 * @param {number} n
 * @returns {string}
 */
export function formatCount(n) {
  try {
    return n.toLocaleString('en-GB');
  } catch {
    return String(n);
  }
}

// ── Safe empty result ──────────────────────────────────────────────────────

function emptyResult() {
  const emptyBreakdown = (values) =>
    values.map((label) => ({ label, count: 0, pct: 0 }));

  return {
    incidents: {
      total: 0, active: 0, critical: 0, resolved: 0,
      byType:     emptyBreakdown(INCIDENT_TYPES),
      byPriority: emptyBreakdown(INCIDENT_PRIORITIES),
      byStatus:   emptyBreakdown(INCIDENT_STATUSES),
    },
    resources: {
      total: 0, available: 0, deployed: 0, maintenance: 0,
      utilization: null,
      byType:   emptyBreakdown(RESOURCE_TYPES),
      byStatus: emptyBreakdown(RESOURCE_STATUSES),
    },
    resolution: { average: null, fastest: null, slowest: null },
  };
}
