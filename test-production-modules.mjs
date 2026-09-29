/**
 * test-production-modules.mjs
 * ---------------------------
 * Tests the ACTUAL production ES modules in assets/js/.
 *
 * Run with:
 *   node --require ./test-globals-preload.cjs test-production-modules.mjs
 *
 * The preload script installs localStorage and structuredClone globals
 * BEFORE Node evaluates this file's static imports, which is the only
 * correct way to make store.js's STORAGE_AVAILABLE check pass.
 */

import {
  createResource, getAllResources, getResourceById,
  getAvailableResourcesByType, updateResource, deleteResource,
  assignResource, releaseResource, setMaintenance, clearMaintenance,
  validateResource, repairOrphans,
  searchResources, filterResources, sortResources, getFilteredResources,
} from './assets/js/services/resourceService.js';

import {
  createIncident, getAllIncidents, getIncidentById,
  updateIncidentStatus, registerReleaseHook,
} from './assets/js/services/incidentService.js';

import { STORAGE_KEYS } from './assets/js/store.js';

// Wire the Phase 3 release hook exactly as app.js does.
registerReleaseHook(releaseResource);

// Shortcut to the raw in-memory store (from preload).
const store = global._testStore;

// ── Test harness ───────────────────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[1m\x1b[31m', C = '\x1b[36m', X = '\x1b[0m', D = '\x1b[2m';
let passed = 0, failed = 0, currentSuite = '';
const failures = [];

function suite(name) {
  currentSuite = name;
  console.log(`\n${C}${name}${X}`);
}

function test(label, fn) {
  try {
    const detail = fn();
    passed++;
    const d = detail ? ` ${D}— ${detail}${X}` : '';
    console.log(`  ${G}✓${X} ${label}${d}`);
  } catch (err) {
    failed++;
    failures.push({ suite: currentSuite, label, msg: err.message });
    console.log(`  ${R}✗ FAIL${X} ${label}\n    ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}

function reset() {
  store.clear();
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Read raw JSON from the in-memory store (bypasses service layer). */
function rawGet(key) {
  const val = store.get(key);
  return val ? JSON.parse(val) : [];
}

/** Write raw JSON into the store (for injecting test fixtures). */
function rawSet(key, value) {
  store.set(key, JSON.stringify(value));
}

// ══════════════════════════════════════════════════════════════════════════
suite('P1 · Resource creation and validation');
reset();
let rid1 = null;

test('Create valid resource returns success', () => {
  const r = createResource({ name: 'Ambulance Unit 1', type: 'Ambulance', location: 'Main Gate' });
  assert(r.success, `success=false: ${JSON.stringify(r)}`);
  rid1 = r.resource.id;
  return `Created ${rid1}`;
});

test('Generated ID matches RES-NNNN pattern', () => {
  assert(/^RES-\d{4}$/.test(rid1), `ID format wrong: ${rid1}`);
  return `id="${rid1}"`;
});

test('Initial status is Available, assignedTo is null', () => {
  const r = getResourceById(rid1);
  eq(r.status, 'Available', 'status');
  eq(r.assignedTo, null, 'assignedTo');
  return 'status=Available, assignedTo=null';
});

test('addedAt is a valid ISO 8601 string', () => {
  assert(!isNaN(Date.parse(getResourceById(rid1).addedAt)), 'addedAt is not a valid date');
  return `addedAt="${getResourceById(rid1).addedAt}"`;
});

test('Resource persisted to localStorage', () => {
  const raw = rawGet(STORAGE_KEYS.RESOURCES);
  assert(raw.some(r => r.id === rid1), `${rid1} not found in raw store`);
  return `${raw.length} record(s) in store`;
});

test('Duplicate name rejected (case-insensitive)', () => {
  const r = createResource({ name: 'AMBULANCE UNIT 1', type: 'Ambulance', location: 'South Gate' });
  assert(!r.success && 'name' in r.errors, 'Expected name error');
  return `"${r.errors.name}"`;
});

test('Missing required fields all rejected', () => {
  const r = createResource({ name: '', type: '', location: '' });
  assert(!r.success, 'Expected failure');
  assert('name' in r.errors && 'type' in r.errors && 'location' in r.errors, 'Expected all three errors');
  return `errors: ${Object.keys(r.errors).join(', ')}`;
});

test('Invalid type enum rejected', () => {
  const r = createResource({ name: 'Unique Name XYZ', type: 'Helicopter', location: 'Pad 1' });
  assert(!r.success && 'type' in r.errors, 'Expected type error');
  return `"${r.errors.type}"`;
});

test('Whitespace-only name rejected', () => {
  const r = createResource({ name: '   ', type: 'Ambulance', location: 'Gate A' });
  assert(!r.success && 'name' in r.errors, 'Expected name error for whitespace');
  return 'whitespace-only name rejected';
});

// ══════════════════════════════════════════════════════════════════════════
suite('P2 · Read and update');

test('getAllResources returns array with correct record', () => {
  const all = getAllResources();
  assert(Array.isArray(all) && all.length === 1, `Expected 1, got ${all.length}`);
  return `${all.length} resource`;
});

test('getResourceById returns correct resource', () => {
  const r = getResourceById(rid1);
  assert(r && r.id === rid1, `Expected ${rid1}`);
  return `Retrieved ${r.id}`;
});

test('getResourceById returns null for unknown ID', () => {
  eq(getResourceById('RES-9999'), null, 'Should be null');
  return 'null for unknown';
});

test('getAvailableResourcesByType filters by type', () => {
  const avail = getAvailableResourcesByType('Ambulance');
  assert(avail.length === 1 && avail[0].id === rid1, 'Expected 1 Ambulance');
  return '1 Ambulance found';
});

test('getAvailableResourcesByType with no type returns all available', () => {
  const avail = getAvailableResourcesByType();
  assert(avail.length === 1, `Expected 1, got ${avail.length}`);
  return `${avail.length} available`;
});

test('updateResource changes location', () => {
  const r = updateResource(rid1, { location: 'South Gate' });
  assert(r.success, `Failed: ${r.error}`);
  eq(getResourceById(rid1).location, 'South Gate', 'location after update');
  return `location updated to "South Gate"`;
});

test('updateResource name uniqueness excludes own record', () => {
  const r = updateResource(rid1, { name: 'Ambulance Unit 1' });
  assert(r.success, `Should allow keeping own name: ${JSON.stringify(r)}`);
  return 'own name allowed on edit';
});

test('updateResource rejects duplicate name of another resource', () => {
  const r2 = createResource({ name: 'Fire Truck 1', type: 'Fire Truck', location: 'Station A' });
  const update = updateResource(rid1, { name: 'Fire Truck 1' });
  assert(!update.success && 'name' in update.errors, 'Expected name conflict error');
  deleteResource(r2.resource.id); // clean up
  return 'duplicate name conflict detected';
});

// ══════════════════════════════════════════════════════════════════════════
suite('P3 · Maintenance lifecycle');

test('Available → Maintenance', () => {
  const r = setMaintenance(rid1);
  assert(r.success, `Failed: ${r.error}`);
  eq(getResourceById(rid1).status, 'Maintenance', 'status');
  return 'Available → Maintenance OK';
});

test('setMaintenance is idempotent', () => {
  const r = setMaintenance(rid1);
  assert(r.success, 'Expected success for idempotent call');
  eq(getResourceById(rid1).status, 'Maintenance', 'still Maintenance');
  return 'idempotent OK';
});

test('Maintenance → Available', () => {
  const r = clearMaintenance(rid1);
  assert(r.success, `Failed: ${r.error}`);
  eq(getResourceById(rid1).status, 'Available', 'status');
  return 'Maintenance → Available OK';
});

test('clearMaintenance is idempotent on Available resource', () => {
  const r = clearMaintenance(rid1);
  assert(r.success, 'Expected success');
  return 'idempotent OK';
});

// ══════════════════════════════════════════════════════════════════════════
suite('P4 · Assignment');
reset();
const r1 = createResource({ name: 'Fire Truck Alpha', type: 'Fire Truck', location: 'Station A' });
const r2 = createResource({ name: 'Ambulance Beta',   type: 'Ambulance',  location: 'Station B' });
const inc1 = createIncident({
  title:       'Building fire test',
  description: 'Smoke visible from chemistry lab stairwell area.',
  type:        'Fire', priority: 'High', location: 'Building A', reportedBy: 'Tester',
});
updateIncidentStatus(inc1.incident.id, 'Active');
const INC_ID = inc1.incident.id;
const R1_ID  = r1.resource.id;
const R2_ID  = r2.resource.id;

test('Assign Available resource to active incident', () => {
  const result = assignResource(R1_ID, INC_ID);
  assert(result.success, `Failed: ${result.error}`);
  eq(getResourceById(R1_ID).status,     'Deployed', 'resource.status');
  eq(getResourceById(R1_ID).assignedTo, INC_ID,     'resource.assignedTo');
  assert(getIncidentById(INC_ID).assignedResources.includes(R1_ID), 'incident has resource ID');
  return `${R1_ID} → ${INC_ID}`;
});

test('Assign Maintenance resource rejected', () => {
  setMaintenance(R2_ID);
  const result = assignResource(R2_ID, INC_ID);
  assert(!result.success, 'Expected failure for Maintenance resource');
  clearMaintenance(R2_ID); // restore
  return `Blocked: "${result.error}"`;
});

test('Assign Deployed resource to a second incident rejected', () => {
  const inc2 = createIncident({
    title:       'Second incident', description: 'Another test incident for assignment.',
    type: 'Medical', priority: 'Low', location: 'Cafeteria', reportedBy: 'Tester',
  });
  updateIncidentStatus(inc2.incident.id, 'Active');
  const result = assignResource(R1_ID, inc2.incident.id);
  assert(!result.success, 'Expected failure — already Deployed');
  // Clean up inc2
  updateIncidentStatus(inc2.incident.id, 'In Progress');
  updateIncidentStatus(inc2.incident.id, 'Resolved');
  return `Blocked: "${result.error}"`;
});

test('Double assignment to same incident rejected', () => {
  const result = assignResource(R1_ID, INC_ID);
  assert(!result.success, 'Expected failure — already in assignedResources');
  return `Blocked: "${result.error}"`;
});

test('Cannot assign to a Resolved incident', () => {
  const incR = createIncident({
    title: 'Already resolved', description: 'This incident is fully resolved now.',
    type: 'Other', priority: 'Low', location: 'Zone B', reportedBy: 'Tester',
  });
  updateIncidentStatus(incR.incident.id, 'Active');
  updateIncidentStatus(incR.incident.id, 'In Progress');
  updateIncidentStatus(incR.incident.id, 'Resolved');
  const result = assignResource(R2_ID, incR.incident.id);
  assert(!result.success, 'Expected failure for Resolved incident');
  return `Blocked: "${result.error}"`;
});

test('Cannot delete a Deployed resource', () => {
  const result = deleteResource(R1_ID);
  assert(!result.success, 'Expected failure');
  return `Blocked: "${result.error}"`;
});

test('Cannot set Deployed resource to Maintenance', () => {
  const result = setMaintenance(R1_ID);
  assert(!result.success, 'Expected failure — must release first');
  return `Blocked: "${result.error}"`;
});

// ══════════════════════════════════════════════════════════════════════════
suite('P5 · Manual release');

test('Release restores Available, removes from incident', () => {
  const result = releaseResource(R1_ID);
  assert(result.success, `Failed: ${result.error}`);
  eq(getResourceById(R1_ID).status,     'Available', 'resource.status');
  eq(getResourceById(R1_ID).assignedTo, null,        'resource.assignedTo');
  assert(!getIncidentById(INC_ID).assignedResources.includes(R1_ID), 'incident no longer has resource ID');
  return `Released ${R1_ID} from ${INC_ID}`;
});

test('Release is idempotent for Available resource', () => {
  const result = releaseResource(R1_ID);
  assert(result.success, 'Expected success');
  eq(getResourceById(R1_ID).status, 'Available', 'still Available');
  return 'idempotent OK';
});

test('Release of unknown ID returns success (safe for bulk)', () => {
  const result = releaseResource('RES-ZZZZ');
  assert(result.success, `Expected success for unknown ID: ${JSON.stringify(result)}`);
  return 'unknown ID handled safely';
});

test('Release when incident is gone (orphan): resource freed, no crash', () => {
  // Inject a Deployed resource pointing at a non-existent incident
  const raw = rawGet(STORAGE_KEYS.RESOURCES);
  raw.push({ id: 'RES-GHOST', name: 'Ghost Unit', type: 'Other', status: 'Deployed', location: 'X', assignedTo: 'INC-MISSING', addedAt: new Date().toISOString() });
  rawSet(STORAGE_KEYS.RESOURCES, raw);

  const result = releaseResource('RES-GHOST');
  assert(result.success, `Expected success: ${JSON.stringify(result)}`);
  eq(getResourceById('RES-GHOST').status,     'Available', 'resource.status');
  eq(getResourceById('RES-GHOST').assignedTo, null,        'resource.assignedTo');

  // Clean up
  rawSet(STORAGE_KEYS.RESOURCES, getAllResources().filter(r => r.id !== 'RES-GHOST'));
  return 'orphan released cleanly, no crash';
});

// ══════════════════════════════════════════════════════════════════════════
suite('P6 · Auto-release on incident resolution');

test('Setup: re-assign resource to incident', () => {
  const result = assignResource(R1_ID, INC_ID);
  assert(result.success, `Failed: ${result.error}`);
  eq(getResourceById(R1_ID).status, 'Deployed', 'should be Deployed');
  return `${R1_ID} → ${INC_ID}`;
});

test('Resolve incident auto-releases all assigned resources', () => {
  updateIncidentStatus(INC_ID, 'In Progress');
  const result = updateIncidentStatus(INC_ID, 'Resolved');
  assert(result.success, `Resolve failed: ${result.error}`);

  // Resource side
  eq(getResourceById(R1_ID).status,     'Available', 'resource.status after auto-release');
  eq(getResourceById(R1_ID).assignedTo, null,        'resource.assignedTo after auto-release');

  // Incident side
  eq(getIncidentById(INC_ID).assignedResources.length, 0, 'incident.assignedResources cleared');
  return `${R1_ID} auto-released when ${INC_ID} resolved`;
});

// ══════════════════════════════════════════════════════════════════════════
suite('P7 · Release rollback (incident write failure)');

test('Rollback: resource stays Deployed when incident write throws', () => {
  // Fresh resource + incident
  const rF  = createResource({ name: 'Rollback Test', type: 'Other', location: 'Zone F' });
  const iF  = createIncident({
    title: 'Rollback incident', description: 'Testing rollback behavior on write failure.',
    type: 'Other', priority: 'Low', location: 'Zone F', reportedBy: 'Tester',
  });
  updateIncidentStatus(iF.incident.id, 'Active');
  assignResource(rF.resource.id, iF.incident.id);

  // Patch localStorage.setItem so the first INCIDENTS write after this point throws.
  const realSetItem = global.localStorage.setItem.bind(global.localStorage);
  let incidentWriteCount = 0;
  global.localStorage.setItem = (k, v) => {
    if (k === STORAGE_KEYS.INCIDENTS) {
      incidentWriteCount++;
      if (incidentWriteCount === 1) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
    }
    realSetItem(k, v);
  };

  const result = releaseResource(rF.resource.id);
  global.localStorage.setItem = realSetItem; // always restore

  assert(!result.success, `Expected failure — got: ${JSON.stringify(result)}`);
  assert(result.error && result.error.length > 0, 'Expected error message');

  // Resource must be rolled back to Deployed
  eq(getResourceById(rF.resource.id).status,     'Deployed',         'resource should be back to Deployed');
  eq(getResourceById(rF.resource.id).assignedTo, iF.incident.id,     'resource.assignedTo restored');

  // Incident must be unchanged
  assert(getIncidentById(iF.incident.id).assignedResources.includes(rF.resource.id), 'incident record unchanged');

  // Clean up
  releaseResource(rF.resource.id);
  updateIncidentStatus(iF.incident.id, 'In Progress');
  updateIncidentStatus(iF.incident.id, 'Resolved');
  return `rollback verified — error: "${result.error.slice(0, 70)}…"`;
});

// ══════════════════════════════════════════════════════════════════════════
suite('P8 · Orphan repair');
reset();

test('repairOrphans fixes resource pointing to missing incident', () => {
  rawSet(STORAGE_KEYS.RESOURCES, [{
    id: 'RES-ORPH', name: 'Orphan Unit', type: 'Other', status: 'Deployed',
    location: 'X', assignedTo: 'INC-NOTEXIST', addedAt: new Date().toISOString(),
  }]);
  rawSet(STORAGE_KEYS.INCIDENTS, []); // no incidents

  repairOrphans();

  const orphan = getResourceById('RES-ORPH');
  eq(orphan.status,     'Available', 'orphan should be Available');
  eq(orphan.assignedTo, null,        'orphan.assignedTo should be null');
  return 'orphan repaired correctly';
});

test('repairOrphans does not touch valid assignments', () => {
  // Valid: resource points to an incident that actually exists
  rawSet(STORAGE_KEYS.INCIDENTS, [{ id: 'INC-VALID', assignedResources: ['RES-VALID'] }]);
  rawSet(STORAGE_KEYS.RESOURCES, [{
    id: 'RES-VALID', name: 'Valid Unit', type: 'Ambulance', status: 'Deployed',
    location: 'HQ', assignedTo: 'INC-VALID', addedAt: new Date().toISOString(),
  }]);

  repairOrphans();

  eq(getResourceById('RES-VALID').status,     'Deployed',   'valid resource should stay Deployed');
  eq(getResourceById('RES-VALID').assignedTo, 'INC-VALID',  'valid assignedTo should be unchanged');
  return 'valid assignment untouched';
});

// ══════════════════════════════════════════════════════════════════════════
suite('P9 · Search, filter, sort');
reset();
rawSet(STORAGE_KEYS.RESOURCES, [
  { id: 'RES-0101', name: 'Ambulance Alpha', type: 'Ambulance',   status: 'Available',   location: 'North Gate', assignedTo: null,      addedAt: '2024-03-01T08:00:00.000Z' },
  { id: 'RES-0102', name: 'Fire Truck Beta', type: 'Fire Truck',  status: 'Deployed',    location: 'Station B',  assignedTo: 'INC-0001', addedAt: '2024-03-01T09:00:00.000Z' },
  { id: 'RES-0103', name: 'Police Unit C',   type: 'Police Unit', status: 'Maintenance', location: 'HQ',         assignedTo: null,      addedAt: '2024-03-01T07:00:00.000Z' },
]);

test('searchResources: name match (case-insensitive)', () => {
  const r = searchResources(getAllResources(), 'ALPHA');
  assert(r.length === 1 && r[0].id === 'RES-0101', `Expected RES-0101, got ${r.map(x=>x.id)}`);
  return '"ALPHA" → RES-0101';
});

test('searchResources: location match', () => {
  const r = searchResources(getAllResources(), 'station');
  assert(r.length === 1 && r[0].id === 'RES-0102', `Expected RES-0102`);
  return '"station" → RES-0102';
});

test('searchResources: empty query returns all', () => {
  const r = searchResources(getAllResources(), '');
  eq(r.length, 3, 'Expected 3');
  return '3 results';
});

test('filterResources: status=Available → 1', () => {
  const r = filterResources(getAllResources(), { status: 'Available' });
  assert(r.length === 1 && r[0].id === 'RES-0101', `Expected RES-0101`);
  return 'status=Available → 1';
});

test('filterResources: AND logic (type+status) → 0', () => {
  const r = filterResources(getAllResources(), { type: 'Ambulance', status: 'Deployed' });
  eq(r.length, 0, 'AND logic should return 0');
  return 'Ambulance AND Deployed → []';
});

test('sortResources: date asc → oldest first', () => {
  const r = sortResources(getAllResources(), 'date', 'asc');
  eq(r[0].id, 'RES-0103', `Expected RES-0103 oldest`);
  return `date asc: ${r.map(x=>x.id).join(', ')}`;
});

test('sortResources: name asc → alphabetical', () => {
  const r = sortResources(getAllResources(), 'name', 'asc');
  eq(r[0].name, 'Ambulance Alpha', `Expected Ambulance Alpha first`);
  return `name asc first: ${r[0].name}`;
});

test('sortResources: does not mutate input array', () => {
  const original = getAllResources();
  const origIds  = original.map(r => r.id).join(',');
  sortResources(original, 'name', 'asc');
  const afterIds = original.map(r => r.id).join(',');
  eq(origIds, afterIds, 'Input was mutated');
  return 'non-mutating confirmed';
});

test('getFilteredResources: search + filter + sort pipeline', () => {
  const r = getFilteredResources({ query: 'alpha', filters: { type: 'Ambulance' }, sortBy: 'name', direction: 'asc' });
  assert(r.length === 1 && r[0].id === 'RES-0101', `Expected RES-0101`);
  return 'pipeline → RES-0101';
});

// ── Cleanup ────────────────────────────────────────────────────────────────
store.clear();

// ── Summary ────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '─'.repeat(60));
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${total}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ [${f.suite}] ${f.label}\n    ${f.msg}`));
}
console.log(failed === 0
  ? `\n\x1b[32m✓ All ${total} production-module tests passed.\x1b[0m`
  : `\n\x1b[31m✗ ${failed}/${total} tests FAILED.\x1b[0m`);
console.log('\x1b[33m  ✓ In-memory store cleared — no persistent data created.\x1b[0m\n');
process.exit(failed > 0 ? 1 : 0);
