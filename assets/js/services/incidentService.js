/**
 * incidentService.js
 * ------------------
 * All incident data operations for ResQGrid.
 *
 * Rules:
 * - This is the ONLY module that reads/writes resqgrid_incidents.
 * - UI components must never call localStorage directly.
 * - All writes go through storeGet / storeSet from store.js.
 * - All user-supplied fields are validated before any write.
 *
 * Spec reference: .kiro/specs/incident-management.md
 * Data model:     .kiro/steering/data-models.md
 */

import { storeGet, storeSet, STORAGE_KEYS } from '../store.js';
import {
  logger,
  generateId,
  getNow,
  isNonEmptyString,
  isWithinLength,
  isValidEnum,
  INCIDENT_TYPES,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  STATUS_ORDER,
  PRIORITY_ORDER,
} from '../utils.js';

// Lazy import to avoid circular dependency.
// resourceService imports incidentService for atomic writes;
// we import resourceService here only for the resolve hook.
// We use a dynamic approach: the reference is set by app.js after both
// services are loaded.
let _releaseResource = null;

/**
 * Register the resource release function.
 * Called once from app.js after resourceService is imported.
 *
 * @param {Function} fn - resourceService.releaseResource
 */
export function registerReleaseHook(fn) {
  _releaseResource = fn;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Character limits from the spec (section 5). */
const TITLE_MIN       = 5;
const TITLE_MAX       = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 500;
const LOCATION_MAX    = 200;

/**
 * How close two incidents must be in time (ms) to trigger a duplicate warning.
 * Spec: "same location and type within 5 minutes" (section 9).
 */
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Valid status transitions.
 * Maps each current status to the single allowed next status.
 * `null` means terminal — no further transitions allowed.
 *
 * Spec section 6.
 */
const NEXT_STATUS = {
  Reported:      'Active',
  Active:        'In Progress',
  'In Progress': 'Resolved',
  Resolved:      null,
};

// ── Private helpers ────────────────────────────────────────────────────────

/**
 * Read the full incidents array from LocalStorage.
 * Returns an empty array if the store is missing or corrupted
 * (storeGet handles recovery internally).
 *
 * @returns {Array<Object>}
 */
function readAll() {
  return storeGet(STORAGE_KEYS.INCIDENTS);
}

/**
 * Write the full incidents array back to LocalStorage.
 * Returns true on success, false on failure.
 *
 * @param {Array<Object>} incidents
 * @returns {boolean}
 */
function writeAll(incidents) {
  return storeSet(STORAGE_KEYS.INCIDENTS, incidents);
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate user-supplied incident fields.
 * Does NOT write to the store.
 *
 * Returns { valid: true } when all fields pass.
 * Returns { valid: false, errors: { fieldName: "message", … } } when any fail.
 *
 * Spec section 5.
 *
 * @param {Object} fields - Raw fields from the incident form
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateIncident(fields) {
  const errors = {};

  // title: required, 5–100 chars
  if (!isWithinLength(fields.title, TITLE_MIN, TITLE_MAX)) {
    errors.title = 'Title is required and must be between 5 and 100 characters.';
  }

  // description: required, 10–500 chars
  if (!isWithinLength(fields.description, DESCRIPTION_MIN, DESCRIPTION_MAX)) {
    errors.description = 'Description is required and must be between 10 and 500 characters.';
  }

  // location: required, non-empty after trim
  if (!isNonEmptyString(fields.location)) {
    errors.location = 'Location is required.';
  }

  // type: must be a valid enum value
  if (!isValidEnum(fields.type, INCIDENT_TYPES)) {
    errors.type = 'Please select a valid incident type.';
  }

  // priority: must be a valid enum value
  if (!isValidEnum(fields.priority, INCIDENT_PRIORITIES)) {
    errors.priority = 'Please select a valid priority level.';
  }

  // reportedBy: required, non-empty after trim
  if (!isNonEmptyString(fields.reportedBy)) {
    errors.reportedBy = 'Reporter name is required.';
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

// ── Duplicate detection ────────────────────────────────────────────────────

/**
 * Check whether a new incident looks like a duplicate of a recently
 * reported one. A duplicate is defined as: same type AND same location
 * (case-insensitive, trimmed) reported within the last 5 minutes.
 *
 * This function NEVER blocks submission — it only returns a warning string
 * when a potential duplicate is found, or null when none is detected.
 *
 * Spec section 9: "Warn about possible duplicate incidents based on same
 * location and type within 5 minutes. Do not block duplicate submission."
 *
 * @param {{ type: string, location: string }} fields
 * @returns {string|null} Warning message or null
 */
export function checkDuplicate(fields) {
  const incidents  = readAll();
  const now        = Date.now();
  const inputType  = fields.type;
  const inputLoc   = (fields.location || '').trim().toLowerCase();

  const isDuplicate = incidents.some((inc) => {
    // Only consider incidents reported within the duplicate window.
    const reportedMs = Date.parse(inc.reportedAt);
    if (isNaN(reportedMs)) return false;
    if (now - reportedMs > DUPLICATE_WINDOW_MS) return false;

    const sameType     = inc.type === inputType;
    const sameLoc      = (inc.location || '').trim().toLowerCase() === inputLoc;
    return sameType && sameLoc;
  });

  if (isDuplicate) {
    return 'A similar incident was recently reported at this location. Please verify before submitting.';
  }
  return null;
}

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * Create and persist a new incident.
 *
 * Returns { success: true, incident } on success.
 * Returns { success: false, errors } when validation fails.
 * Returns { success: false, error: string } on a storage write failure.
 *
 * The function:
 * 1. Validates all user-supplied fields.
 * 2. Builds the complete incident object (auto-generates id, timestamps, status).
 * 3. Appends it to the incidents array and writes to LocalStorage.
 *
 * Spec sections 3 (IM-F01–F05), 4, 5.
 *
 * @param {Object} fields - User-supplied fields from the incident form
 * @returns {{ success: boolean, incident?: Object, errors?: Object, error?: string }}
 */
export function createIncident(fields) {
  // 1. Validate.
  const { valid, errors } = validateIncident(fields);
  if (!valid) {
    logger.warn('incidentService.createIncident: Validation failed.', errors);
    return { success: false, errors };
  }

  const incidents = readAll();
  const now       = getNow();

  // 2. Build the incident object following the canonical data model exactly.
  const incident = {
    id:                generateId('INC', incidents),
    title:             fields.title.trim(),
    description:       fields.description.trim(),
    type:              fields.type,
    priority:          fields.priority,
    status:            'Reported',          // always Reported on creation
    location:          fields.location.trim(),
    reportedBy:        fields.reportedBy.trim(),
    reportedAt:        now,                 // immutable after creation
    updatedAt:         now,
    resolvedAt:        null,                // set only when Resolved
    assignedResources: [],                  // empty until resource phase
    notes:             (fields.notes || '').trim(),
  };

  // 3. Append and persist.
  incidents.push(incident);
  const saved = writeAll(incidents);

  if (!saved) {
    logger.error('incidentService.createIncident: Failed to write to LocalStorage.');
    return { success: false, error: 'Storage full. Could not save incident.' };
  }

  logger.info(`incidentService.createIncident: Created ${incident.id}.`);
  return { success: true, incident };
}

// ── Read ───────────────────────────────────────────────────────────────────

/**
 * Return every stored incident as an array.
 * Returns an empty array when no incidents exist or data is corrupted.
 *
 * @returns {Array<Object>}
 */
export function getAllIncidents() {
  return readAll();
}

/**
 * Return a single incident by its ID.
 * Returns the incident object, or null if not found.
 *
 * @param {string} id - e.g. "INC-0001"
 * @returns {Object|null}
 */
export function getIncidentById(id) {
  if (!id) return null;
  const incidents = readAll();
  return incidents.find((inc) => inc.id === id) ?? null;
}

// ── Update status ──────────────────────────────────────────────────────────

/**
 * Advance an incident's status to the next step in the lifecycle.
 *
 * Valid transitions (spec section 6):
 *   Reported → Active → In Progress → Resolved
 *
 * Returns { success: true, incident } on success.
 * Returns { success: false, error: string } when:
 *   - The incident is not found.
 *   - The transition is invalid (already Resolved or skipping a step).
 *
 * Side-effects when transitioning to Resolved:
 *   - Sets resolvedAt to the current UTC timestamp.
 *   - Triggers resource release (Phase 3 will hook in here).
 *
 * @param {string} id        - Incident ID
 * @param {string} newStatus - The desired next status
 * @returns {{ success: boolean, incident?: Object, error?: string }}
 */
export function updateIncidentStatus(id, newStatus) {
  const incidents = readAll();
  const index     = incidents.findIndex((inc) => inc.id === id);

  if (index === -1) {
    return { success: false, error: `Incident ${id} not found.` };
  }

  const incident    = incidents[index];
  const allowedNext = NEXT_STATUS[incident.status];

  // Validate the transition.
  if (allowedNext === null) {
    return {
      success: false,
      error:   `Incident ${id} is Resolved and cannot be updated further.`,
    };
  }

  if (newStatus !== allowedNext) {
    return {
      success: false,
      error:   `Invalid status transition: "${incident.status}" → "${newStatus}". Expected "${allowedNext}".`,
    };
  }

  const now = getNow();

  // Apply the transition.
  incidents[index] = {
    ...incident,
    status:    newStatus,
    updatedAt: now,
    resolvedAt: newStatus === 'Resolved' ? now : incident.resolvedAt,
  };

  // Phase 3 hook: release all assigned resources when an incident is Resolved.
  if (newStatus === 'Resolved' && _releaseResource) {
    const toRelease = incident.assignedResources || [];
    toRelease.forEach((resourceId) => {
      _releaseResource(resourceId);
    });
    // Clear the assignedResources list on the incident after releasing.
    incidents[index] = {
      ...incidents[index],
      assignedResources: [],
    };
  }

  const saved = writeAll(incidents);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update incident status.' };
  }

  logger.info(`incidentService.updateIncidentStatus: ${id} → ${newStatus}.`);
  return { success: true, incident: incidents[index] };
}

/**
 * Return the single valid next status for a given current status.
 * Returns null when the incident is Resolved (terminal state).
 * Useful for UI button labels ("Mark Active", "Mark In Progress", etc.).
 *
 * @param {string} currentStatus
 * @returns {string|null}
 */
export function getNextStatus(currentStatus) {
  return NEXT_STATUS[currentStatus] ?? null;
}

// ── Update notes ───────────────────────────────────────────────────────────

/**
 * Add or replace the notes text on an incident.
 * An empty string is a valid value (clears the notes field).
 *
 * Returns { success: true, incident } on success.
 * Returns { success: false, error: string } when the incident is not found
 * or the write fails.
 *
 * Spec section 3 (IM-F13).
 *
 * @param {string} id    - Incident ID
 * @param {string} notes - New notes text (may be empty)
 * @returns {{ success: boolean, incident?: Object, error?: string }}
 */
export function updateIncidentNotes(id, notes) {
  if (typeof notes !== 'string') {
    return { success: false, error: 'Notes must be a string.' };
  }

  const incidents = readAll();
  const index     = incidents.findIndex((inc) => inc.id === id);

  if (index === -1) {
    return { success: false, error: `Incident ${id} not found.` };
  }

  incidents[index] = {
    ...incidents[index],
    notes:     notes,  // empty string is valid
    updatedAt: getNow(),
  };

  const saved = writeAll(incidents);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not save notes.' };
  }

  logger.info(`incidentService.updateIncidentNotes: Updated notes for ${id}.`);
  return { success: true, incident: incidents[index] };
}

// ── General update ─────────────────────────────────────────────────────────

/**
 * Update editable fields on an existing incident.
 * Only allows changing: title, description, location, type, priority, notes.
 * id, reportedAt, status, resolvedAt, assignedResources are protected.
 *
 * Returns { success: true, incident } on success.
 * Returns { success: false, errors } when validation fails.
 * Returns { success: false, error: string } when not found or write fails.
 *
 * @param {string} id      - Incident ID
 * @param {Object} updates - Partial fields to apply
 * @returns {{ success: boolean, incident?: Object, errors?: Object, error?: string }}
 */
export function updateIncident(id, updates) {
  const incidents = readAll();
  const index     = incidents.findIndex((inc) => inc.id === id);

  if (index === -1) {
    return { success: false, error: `Incident ${id} not found.` };
  }

  // Merge updates with existing incident for validation purposes.
  const merged = {
    title:       updates.title       ?? incidents[index].title,
    description: updates.description ?? incidents[index].description,
    location:    updates.location    ?? incidents[index].location,
    type:        updates.type        ?? incidents[index].type,
    priority:    updates.priority    ?? incidents[index].priority,
    reportedBy:  updates.reportedBy  ?? incidents[index].reportedBy,
  };

  const { valid, errors } = validateIncident(merged);
  if (!valid) {
    return { success: false, errors };
  }

  // Apply only the allowed fields.
  incidents[index] = {
    ...incidents[index],
    title:       merged.title.trim(),
    description: merged.description.trim(),
    location:    merged.location.trim(),
    type:        merged.type,
    priority:    merged.priority,
    reportedBy:  merged.reportedBy.trim(),
    notes:       typeof updates.notes === 'string'
                   ? updates.notes
                   : incidents[index].notes,
    updatedAt:   getNow(),
  };

  const saved = writeAll(incidents);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update incident.' };
  }

  logger.info(`incidentService.updateIncident: Updated ${id}.`);
  return { success: true, incident: incidents[index] };
}

// ── Delete ─────────────────────────────────────────────────────────────────

/**
 * Permanently delete an incident by ID.
 *
 * Deletion is only permitted when status === "Resolved".
 * Attempting to delete a non-Resolved incident returns an error and does NOT
 * modify the store.
 *
 * Spec sections 3 (IM-F14 & IM-F15), 9.
 *
 * Returns { success: true } on success.
 * Returns { success: false, error: string } when:
 *   - Incident not found.
 *   - Incident is not Resolved.
 *   - Write fails.
 *
 * @param {string} id - Incident ID
 * @returns {{ success: boolean, error?: string }}
 */
export function deleteIncident(id) {
  const incidents = readAll();
  const index     = incidents.findIndex((inc) => inc.id === id);

  if (index === -1) {
    return { success: false, error: `Incident ${id} not found.` };
  }

  const incident = incidents[index];

  // Enforce deletion rule: only Resolved incidents may be deleted.
  if (incident.status !== 'Resolved') {
    return {
      success: false,
      error:   `Incident ${id} cannot be deleted because its status is "${incident.status}". Only Resolved incidents can be deleted.`,
    };
  }

  // Remove the incident from the array.
  incidents.splice(index, 1);

  const saved = writeAll(incidents);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not delete incident.' };
  }

  logger.info(`incidentService.deleteIncident: Deleted ${id}.`);
  return { success: true };
}

// ── Search, filter, sort ───────────────────────────────────────────────────

/**
 * Search incidents by a query string.
 * Matches against title, description, and location (case-insensitive).
 * Returns all incidents when query is empty or whitespace-only.
 *
 * Spec section 3 (IM-F07).
 *
 * @param {Array<Object>} incidents - Incident array to search (pass the result of getAllIncidents())
 * @param {string}        query     - Search string
 * @returns {Array<Object>}
 */
export function searchIncidents(incidents, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return incidents;

  return incidents.filter((inc) => {
    const inTitle       = (inc.title       || '').toLowerCase().includes(q);
    const inDescription = (inc.description || '').toLowerCase().includes(q);
    const inLocation    = (inc.location    || '').toLowerCase().includes(q);
    return inTitle || inDescription || inLocation;
  });
}

/**
 * Filter incidents by type, priority, and/or status.
 * All provided filter values must match (AND logic).
 * A filter value of null or undefined means "no filter for this field".
 *
 * Spec section 3 (IM-F08).
 *
 * @param {Array<Object>}   incidents - Incident array to filter
 * @param {{ type?: string, priority?: string, status?: string }} filters
 * @returns {Array<Object>}
 */
export function filterIncidents(incidents, filters = {}) {
  return incidents.filter((inc) => {
    if (filters.type     && inc.type     !== filters.type)     return false;
    if (filters.priority && inc.priority !== filters.priority) return false;
    if (filters.status   && inc.status   !== filters.status)   return false;
    return true;
  });
}

/**
 * Sort an incidents array by the specified field and direction.
 * Does NOT mutate the input array — returns a new sorted array.
 *
 * Supported sortBy values:
 *   'date'     → reportedAt (ISO string, lexicographic sort is correct for ISO 8601)
 *   'priority' → Priority enum order (Critical first)
 *   'status'   → Status lifecycle order (Reported first)
 *
 * Spec section 3 (IM-F09).
 *
 * @param {Array<Object>} incidents
 * @param {'date'|'priority'|'status'} sortBy
 * @param {'asc'|'desc'} direction
 * @returns {Array<Object>}
 */
export function sortIncidents(incidents, sortBy = 'date', direction = 'desc') {
  const sorted = [...incidents];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'date') {
      // ISO 8601 strings sort correctly as strings.
      comparison = a.reportedAt < b.reportedAt ? -1 : a.reportedAt > b.reportedAt ? 1 : 0;

    } else if (sortBy === 'priority') {
      const aOrder = PRIORITY_ORDER[a.priority] ?? 99;
      const bOrder = PRIORITY_ORDER[b.priority] ?? 99;
      comparison   = aOrder - bOrder;  // lower number = higher priority

    } else if (sortBy === 'status') {
      const aOrder = STATUS_ORDER[a.status] ?? 99;
      const bOrder = STATUS_ORDER[b.status] ?? 99;
      comparison   = aOrder - bOrder;
    }

    return direction === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Apply search, filters, and sort in a single pipeline.
 * Convenience function for the list UI.
 *
 * @param {Object} options
 * @param {string}  [options.query]     - Search string
 * @param {Object}  [options.filters]   - { type, priority, status }
 * @param {string}  [options.sortBy]    - 'date' | 'priority' | 'status'
 * @param {string}  [options.direction] - 'asc' | 'desc'
 * @returns {Array<Object>}
 */
export function getFilteredIncidents({ query = '', filters = {}, sortBy = 'date', direction = 'desc' } = {}) {
  let results = getAllIncidents();
  results = searchIncidents(results, query);
  results = filterIncidents(results, filters);
  results = sortIncidents(results, sortBy, direction);
  return results;
}

// ── Resource assignment helpers (Phase 3 stubs) ────────────────────────────

/**
 * Add a resource ID to an incident's assignedResources array.
 * Called by resourceService when assigning a resource.
 * (Phase 3 will complete the full assignment workflow.)
 *
 * Returns { success: true, incident } or { success: false, error }.
 *
 * @param {string} incidentId  - Incident ID
 * @param {string} resourceId  - Resource ID to add
 * @returns {{ success: boolean, incident?: Object, error?: string }}
 */
export function addResourceToIncident(incidentId, resourceId) {
  const incidents = readAll();
  const index     = incidents.findIndex((inc) => inc.id === incidentId);

  if (index === -1) {
    return { success: false, error: `Incident ${incidentId} not found.` };
  }

  const incident = incidents[index];

  if (incident.status === 'Resolved') {
    return { success: false, error: `Cannot assign resources to a Resolved incident.` };
  }

  if (incident.assignedResources.includes(resourceId)) {
    return { success: false, error: `Resource ${resourceId} is already assigned to ${incidentId}.` };
  }

  incidents[index] = {
    ...incident,
    assignedResources: [...incident.assignedResources, resourceId],
    updatedAt:         getNow(),
  };

  const saved = writeAll(incidents);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update incident.' };
  }

  logger.info(`incidentService.addResourceToIncident: ${resourceId} → ${incidentId}.`);
  return { success: true, incident: incidents[index] };
}

/**
 * Remove a resource ID from an incident's assignedResources array.
 * Called by resourceService when releasing a resource.
 *
 * Returns { success: true, incident } or { success: false, error }.
 *
 * @param {string} incidentId  - Incident ID
 * @param {string} resourceId  - Resource ID to remove
 * @returns {{ success: boolean, incident?: Object, error?: string }}
 */
export function removeResourceFromIncident(incidentId, resourceId) {
  const incidents = readAll();
  const index     = incidents.findIndex((inc) => inc.id === incidentId);

  if (index === -1) {
    return { success: false, error: `Incident ${incidentId} not found.` };
  }

  const incident = incidents[index];

  incidents[index] = {
    ...incident,
    assignedResources: incident.assignedResources.filter((rid) => rid !== resourceId),
    updatedAt:         getNow(),
  };

  const saved = writeAll(incidents);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update incident.' };
  }

  logger.info(`incidentService.removeResourceFromIncident: ${resourceId} released from ${incidentId}.`);
  return { success: true, incident: incidents[index] };
}
