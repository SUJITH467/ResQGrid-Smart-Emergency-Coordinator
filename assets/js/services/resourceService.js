/**
 * resourceService.js
 * ------------------
 * All resource data operations for ResQGrid.
 *
 * Rules:
 * - This is the ONLY module that reads/writes resqgrid_resources directly.
 * - assignResource and releaseResource also write resqgrid_incidents
 *   (the only cross-service write allowed per spec section 4).
 * - UI components must never call localStorage directly.
 *
 * Spec reference: .kiro/specs/resource-management.md
 * Data model:     .kiro/steering/data-models.md
 */

import { storeGet, storeSet, STORAGE_KEYS } from '../store.js';
import {
  logger,
  generateId,
  getNow,
  isNonEmptyString,
  isValidEnum,
  RESOURCE_TYPES,
  RESOURCE_STATUSES,
} from '../utils.js';

// ── Private helpers ────────────────────────────────────────────────────────

function readResources() {
  return storeGet(STORAGE_KEYS.RESOURCES);
}

function writeResources(resources) {
  return storeSet(STORAGE_KEYS.RESOURCES, resources);
}

function readIncidents() {
  return storeGet(STORAGE_KEYS.INCIDENTS);
}

function writeIncidents(incidents) {
  return storeSet(STORAGE_KEYS.INCIDENTS, incidents);
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate user-supplied resource fields.
 * Does NOT write to the store.
 *
 * @param {Object}      fields
 * @param {string|null} [excludeId] - When editing, pass the resource's own ID
 *                                    to skip it during name uniqueness check.
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateResource(fields, excludeId = null) {
  const errors = {};

  // name: required, non-empty, unique (case-insensitive)
  if (!isNonEmptyString(fields.name)) {
    errors.name = 'Resource name is required and must be unique.';
  } else {
    // Uniqueness check — exclude own record when editing.
    const resources = readResources();
    const trimmedName = fields.name.trim().toLowerCase();
    const duplicate = resources.some(
      (r) => r.name.toLowerCase() === trimmedName && r.id !== excludeId
    );
    if (duplicate) {
      errors.name = 'Resource name is required and must be unique.';
    }
  }

  // type: must be a valid enum value
  if (!isValidEnum(fields.type, RESOURCE_TYPES)) {
    errors.type = 'Please select a valid resource type.';
  }

  // location: required, non-empty
  if (!isNonEmptyString(fields.location)) {
    errors.location = 'Location is required.';
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

// ── Orphan repair ──────────────────────────────────────────────────────────

/**
 * Scan resources on app load and fix any orphaned assignments.
 * An orphan is a resource where assignedTo points to an incident that
 * no longer exists in the store.
 *
 * Spec RM-F21.
 */
export function repairOrphans() {
  const resources = readResources();
  const incidents = readIncidents();
  const incidentIds = new Set(incidents.map((i) => i.id));

  let repaired = false;

  const fixed = resources.map((r) => {
    if (r.assignedTo && !incidentIds.has(r.assignedTo)) {
      logger.warn(
        `resourceService.repairOrphans: ${r.id} references missing incident ` +
        `"${r.assignedTo}". Resetting to Available.`
      );
      repaired = true;
      return { ...r, assignedTo: null, status: 'Available' };
    }
    return r;
  });

  if (repaired) {
    writeResources(fixed);
    logger.info('resourceService.repairOrphans: Orphaned resources repaired.');
  }
}

// ── Create ─────────────────────────────────────────────────────────────────

/**
 * Create and persist a new resource.
 *
 * @param {Object} fields - { name, type, location }
 * @returns {{ success: boolean, resource?: Object, errors?: Object, error?: string }}
 */
export function createResource(fields) {
  const { valid, errors } = validateResource(fields, null);
  if (!valid) {
    logger.warn('resourceService.createResource: Validation failed.', errors);
    return { success: false, errors };
  }

  const resources = readResources();
  const now       = getNow();

  const resource = {
    id:         generateId('RES', resources),
    name:       fields.name.trim(),
    type:       fields.type,
    status:     'Available',   // always Available on creation
    location:   fields.location.trim(),
    assignedTo: null,          // not assigned on creation
    addedAt:    now,           // immutable after creation
  };

  resources.push(resource);
  const saved = writeResources(resources);

  if (!saved) {
    return { success: false, error: 'Storage full. Could not save resource.' };
  }

  logger.info(`resourceService.createResource: Created ${resource.id}.`);
  return { success: true, resource };
}

// ── Read ───────────────────────────────────────────────────────────────────

/** Return every stored resource. */
export function getAllResources() {
  return readResources();
}

/** Return a single resource by ID, or null. */
export function getResourceById(id) {
  if (!id) return null;
  return readResources().find((r) => r.id === id) ?? null;
}

/**
 * Return Available resources, optionally filtered by type.
 * @param {string} [type] - If provided, only return resources of this type.
 */
export function getAvailableResourcesByType(type) {
  const resources = readResources().filter((r) => r.status === 'Available');
  if (type) return resources.filter((r) => r.type === type);
  return resources;
}

// ── Update ─────────────────────────────────────────────────────────────────

/**
 * Update editable fields: name, type, location.
 * id, addedAt, status, assignedTo are protected.
 *
 * @param {string} id
 * @param {Object} fields - { name?, type?, location? }
 * @returns {{ success: boolean, resource?: Object, errors?: Object, error?: string }}
 */
export function updateResource(id, fields) {
  const resources = readResources();
  const index     = resources.findIndex((r) => r.id === id);

  if (index === -1) {
    return { success: false, error: `Resource ${id} not found.` };
  }

  const existing = resources[index];

  // Merge with existing values for validation.
  const merged = {
    name:     fields.name     ?? existing.name,
    type:     fields.type     ?? existing.type,
    location: fields.location ?? existing.location,
  };

  // Pass own ID so uniqueness check excludes the current record.
  const { valid, errors } = validateResource(merged, id);
  if (!valid) {
    return { success: false, errors };
  }

  resources[index] = {
    ...existing,
    name:     merged.name.trim(),
    type:     merged.type,
    location: merged.location.trim(),
  };

  const saved = writeResources(resources);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update resource.' };
  }

  logger.info(`resourceService.updateResource: Updated ${id}.`);
  return { success: true, resource: resources[index] };
}

// ── Delete ─────────────────────────────────────────────────────────────────

/**
 * Delete a resource by ID.
 * Blocked when status === "Deployed".
 *
 * @param {string} id
 * @returns {{ success: boolean, error?: string }}
 */
export function deleteResource(id) {
  const resources = readResources();
  const index     = resources.findIndex((r) => r.id === id);

  if (index === -1) {
    return { success: false, error: `Resource ${id} not found.` };
  }

  if (resources[index].status === 'Deployed') {
    return {
      success: false,
      error:   `Resource ${id} is currently deployed. Release it from its incident before deleting.`,
    };
  }

  resources.splice(index, 1);
  const saved = writeResources(resources);

  if (!saved) {
    return { success: false, error: 'Storage full. Could not delete resource.' };
  }

  logger.info(`resourceService.deleteResource: Deleted ${id}.`);
  return { success: true };
}

// ── Assignment ─────────────────────────────────────────────────────────────

/**
 * Assign an Available resource to an active incident.
 * Updates both resource and incident records atomically.
 *
 * Spec RM-F11, RM-F16.
 *
 * @param {string} resourceId
 * @param {string} incidentId
 * @returns {{ success: boolean, resource?: Object, incident?: Object, error?: string }}
 */
export function assignResource(resourceId, incidentId) {
  const resources = readResources();
  const incidents = readIncidents();

  const rIdx = resources.findIndex((r) => r.id === resourceId);
  const iIdx = incidents.findIndex((i) => i.id === incidentId);

  if (rIdx === -1) {
    return { success: false, error: `Resource ${resourceId} not found.` };
  }
  if (iIdx === -1) {
    return { success: false, error: `Incident ${incidentId} not found.` };
  }

  const resource = resources[rIdx];
  const incident = incidents[iIdx];

  // Validate resource is Available.
  if (resource.status !== 'Available') {
    return {
      success: false,
      error:   `Resource ${resourceId} is "${resource.status}" and cannot be assigned. Only Available resources can be assigned.`,
    };
  }

  // Validate incident is not Resolved.
  if (incident.status === 'Resolved') {
    return {
      success: false,
      error:   `Cannot assign resources to a Resolved incident.`,
    };
  }

  // Guard: resource already in incident's list (should not happen, but be safe).
  if (incident.assignedResources.includes(resourceId)) {
    return {
      success: false,
      error:   `Resource ${resourceId} is already assigned to ${incidentId}.`,
    };
  }

  // Mutate both records.
  resources[rIdx] = {
    ...resource,
    status:     'Deployed',
    assignedTo: incidentId,
  };

  incidents[iIdx] = {
    ...incident,
    assignedResources: [...incident.assignedResources, resourceId],
    updatedAt:         getNow(),
  };

  // Write both — best-effort rollback on failure.
  const savedR = writeResources(resources);
  if (!savedR) {
    return { success: false, error: 'Storage full. Could not assign resource.' };
  }
  const savedI = writeIncidents(incidents);
  if (!savedI) {
    // Rollback resource write.
    writeResources(
      resources.map((r, i) => (i === rIdx ? resource : r))
    );
    return { success: false, error: 'Storage full. Could not update incident.' };
  }

  logger.info(`resourceService.assignResource: ${resourceId} → ${incidentId}.`);
  return { success: true, resource: resources[rIdx], incident: incidents[iIdx] };
}

/**
 * Release a Deployed resource from its incident.
 * Updates both resource and incident records atomically.
 *
 * Read pattern mirrors assignResource:
 *   1. Read both arrays upfront before mutating either.
 *   2. Mutate both in memory.
 *   3. Write resources first; on failure return error (incidents untouched).
 *   4. Write incidents second; on failure roll back the resource write and
 *      return a clear error — never leave the two arrays in a split state.
 *
 * Also used internally by incidentService when resolving an incident.
 *
 * Spec RM-F14, RM-F15, RM-F16.
 *
 * @param {string} resourceId
 * @returns {{ success: boolean, resource?: Object, error?: string }}
 */
export function releaseResource(resourceId) {
  // ── 1. Read both arrays upfront ──────────────────────────────────────────
  const resources = readResources();
  const incidents = readIncidents();

  const rIdx = resources.findIndex((r) => r.id === resourceId);

  if (rIdx === -1) {
    // Resource not found — treat as already released (safe for bulk resolution).
    logger.warn(`resourceService.releaseResource: ${resourceId} not found. Skipping.`);
    return { success: true };
  }

  // Keep a snapshot of the original resource for rollback.
  const originalResource = resources[rIdx];

  if (originalResource.status !== 'Deployed') {
    // Already released — idempotent, not an error.
    return { success: true, resource: originalResource };
  }

  const incidentId = originalResource.assignedTo;

  // ── 2. Mutate both records in memory ─────────────────────────────────────
  resources[rIdx] = {
    ...originalResource,
    status:     'Available',
    assignedTo: null,
  };

  // Find and update the linked incident if it still exists.
  const iIdx = incidentId ? incidents.findIndex((i) => i.id === incidentId) : -1;

  if (iIdx !== -1) {
    incidents[iIdx] = {
      ...incidents[iIdx],
      assignedResources: incidents[iIdx].assignedResources.filter(
        (rid) => rid !== resourceId
      ),
      updatedAt: getNow(),
    };
  } else if (incidentId) {
    // Incident is gone (e.g. deleted) — resource can still be released safely.
    logger.warn(
      `resourceService.releaseResource: Incident ${incidentId} not found. ` +
      `Resource ${resourceId} released anyway.`
    );
  }

  // ── 3. Persist resource first ─────────────────────────────────────────────
  const savedR = writeResources(resources);
  if (!savedR) {
    // Nothing written yet — no rollback needed.
    return { success: false, error: 'Storage full. Could not release resource.' };
  }

  // ── 4. Persist incident (if applicable); roll back on failure ────────────
  if (iIdx !== -1) {
    const savedI = writeIncidents(incidents);
    if (!savedI) {
      // Incident write failed — roll back the resource write to keep both arrays
      // consistent. Restore the original resource record.
      const rollbackOk = writeResources(
        resources.map((r, i) => (i === rIdx ? originalResource : r))
      );
      const rollbackNote = rollbackOk
        ? 'Resource write rolled back successfully.'
        : 'WARNING: Resource rollback also failed — store may be inconsistent.';
      logger.warn(`resourceService.releaseResource: Incident write failed. ${rollbackNote}`);
      return {
        success: false,
        error:   `Storage full. Could not update incident after releasing resource. ${rollbackNote}`,
      };
    }
  }

  logger.info(`resourceService.releaseResource: Released ${resourceId}.`);
  return { success: true, resource: resources[rIdx] };
}

// ── Maintenance ────────────────────────────────────────────────────────────

/**
 * Put an Available resource into Maintenance.
 * Blocked when resource is Deployed (must release first).
 *
 * @param {string} id
 * @returns {{ success: boolean, resource?: Object, error?: string }}
 */
export function setMaintenance(id) {
  const resources = readResources();
  const index     = resources.findIndex((r) => r.id === id);

  if (index === -1) {
    return { success: false, error: `Resource ${id} not found.` };
  }

  if (resources[index].status === 'Deployed') {
    return {
      success: false,
      error:   `Resource ${id} is currently deployed. Release it first before setting maintenance.`,
    };
  }

  if (resources[index].status === 'Maintenance') {
    return { success: true, resource: resources[index] }; // idempotent
  }

  resources[index] = { ...resources[index], status: 'Maintenance' };

  const saved = writeResources(resources);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update resource.' };
  }

  logger.info(`resourceService.setMaintenance: ${id} → Maintenance.`);
  return { success: true, resource: resources[index] };
}

/**
 * Clear Maintenance status, returning the resource to Available.
 *
 * @param {string} id
 * @returns {{ success: boolean, resource?: Object, error?: string }}
 */
export function clearMaintenance(id) {
  const resources = readResources();
  const index     = resources.findIndex((r) => r.id === id);

  if (index === -1) {
    return { success: false, error: `Resource ${id} not found.` };
  }

  if (resources[index].status !== 'Maintenance') {
    return { success: true, resource: resources[index] }; // idempotent
  }

  resources[index] = { ...resources[index], status: 'Available' };

  const saved = writeResources(resources);
  if (!saved) {
    return { success: false, error: 'Storage full. Could not update resource.' };
  }

  logger.info(`resourceService.clearMaintenance: ${id} → Available.`);
  return { success: true, resource: resources[index] };
}

// ── Search, filter, sort ───────────────────────────────────────────────────

/**
 * Search resources by name and location (case-insensitive).
 * Returns all resources when query is empty.
 *
 * @param {Array<Object>} resources
 * @param {string}        query
 * @returns {Array<Object>}
 */
export function searchResources(resources, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return resources;

  return resources.filter((r) =>
    (r.name     || '').toLowerCase().includes(q) ||
    (r.location || '').toLowerCase().includes(q)
  );
}

/**
 * Filter resources by type and/or status (AND logic).
 *
 * @param {Array<Object>} resources
 * @param {{ type?: string, status?: string }} filters
 * @returns {Array<Object>}
 */
export function filterResources(resources, filters = {}) {
  return resources.filter((r) => {
    if (filters.type   && r.type   !== filters.type)   return false;
    if (filters.status && r.status !== filters.status) return false;
    return true;
  });
}

/**
 * Sort a resources array.
 * sortBy: 'date' (addedAt desc) | 'name' | 'status' | 'type'
 * Does NOT mutate the input array.
 *
 * @param {Array<Object>} resources
 * @param {string}        sortBy
 * @param {'asc'|'desc'}  direction
 * @returns {Array<Object>}
 */
export function sortResources(resources, sortBy = 'date', direction = 'desc') {
  const STATUS_SORT = { Available: 0, Deployed: 1, Maintenance: 2 };
  const sorted = [...resources];

  sorted.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date') {
      cmp = a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0;
    } else if (sortBy === 'name') {
      cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    } else if (sortBy === 'status') {
      cmp = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9);
    } else if (sortBy === 'type') {
      cmp = a.type.localeCompare(b.type);
    }
    return direction === 'desc' ? -cmp : cmp;
  });

  return sorted;
}

/**
 * Convenience pipeline: search → filter → sort.
 *
 * @param {Object} options
 * @returns {Array<Object>}
 */
export function getFilteredResources({
  query     = '',
  filters   = {},
  sortBy    = 'date',
  direction = 'desc',
} = {}) {
  let results = getAllResources();
  results = searchResources(results, query);
  results = filterResources(results, filters);
  results = sortResources(results, sortBy, direction);
  return results;
}
