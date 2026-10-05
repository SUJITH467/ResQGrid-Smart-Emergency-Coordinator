/**
 * test-incident-service.mjs
 * --------------------------
 * Direct unit tests for incidentService.js.
 * Verifies every acceptance criterion in:
 *   .kiro/specs/incident-service-validation.md
 *
 * Run:
 *   node --require ./test-globals-preload.cjs test-incident-service.mjs
 *
 * Covers:
 *   ISV-F01–F12  validateIncident boundaries
 *   ISV-F13–F18  createIncident initial state
 *   ISV-F19–F24  updateIncidentStatus transitions
 *   ISV-F25–F26  getNextStatus
 *   ISV-F27–F29  updateIncidentNotes
 *   ISV-F30–F32  deleteIncident guard
 *   ISV-F33–F35  checkDuplicate window
 *   ISV-F36–F38  searchIncidents
 *   ISV-F39–F40  filterIncidents
 *   ISV-F41–F42  sortIncidents (non-mutating)
 *   ISV-F43      getFilteredIncidents pipeline
 *   ISV-F44–F45  updateIncident protected fields
 */

import {
  validateIncident,
  createIncident,
  getAllIncidents,
  getIncidentById,
  updateIncidentStatus,
  getNextStatus,
  updateIncidentNotes,
  updateIncident,
  deleteIncident,
  checkDuplicate,
  searchIncidents,
  filterIncidents,
  sortIncidents,
  getFilteredIncidents,
  registerReleaseHook,
} from './assets/js/services/incidentService.js';

import { STORAGE_KEYS } from './assets/js/store.js';

// ── Test harness (same pattern as existing suites) ─────────────────────────
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
    console.log(`  ${G}✓${X} ${label}${detail ? ` ${D}— ${detail}${X}` : ''}`);
  } catch (err) {
    failed++;
    failures.push({ suite: currentSuite, label, msg: err.message });
    console.log(`  ${R}✗ FAIL${X} ${label}\n    ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || 'eq'}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

// ── Reset helper ───────────────────────────────────────────────────────────
function reset() {
  global._testStore.clear();
}

// ── Valid base fields (used across many tests) ─────────────────────────────
const VALID_FIELDS = {
  title:       'Test Incident One',
  description: 'A test incident description that is long enough.',
  type:        'Fire',
  priority:    'High',
  location:    'Block A, Floor 2',
  reportedBy:  'Coordinator Jane',
};

// Helper: create a valid incident and return it
function makeIncident(overrides = {}) {
  const r = createIncident({ ...VALID_FIELDS, ...overrides });
  assert(r.success, `makeIncident failed: ${JSON.stringify(r)}`);
  return r.incident;
}

// Helper: advance an incident all the way to a given status
function advanceTo(id, targetStatus) {
  const path = ['Active', 'In Progress', 'Resolved'];
  for (const s of path) {
    updateIncidentStatus(id, s);
    if (s === targetStatus) break;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ISV-F01–F12  validateIncident
// ══════════════════════════════════════════════════════════════════════════

suite('1 · validateIncident — title boundaries (ISV-F01–F04)');
reset();

test('4-char title rejected (ISV-F01)', () => {
  const r = validateIncident({ ...VALID_FIELDS, title: 'ABCD' });
  assert(!r.valid, 'expected valid=false');
  assert('title' in r.errors, 'expected errors.title');
  return 'errors.title present';
});

test('5-char title accepted (ISV-F02)', () => {
  const r = validateIncident({ ...VALID_FIELDS, title: 'ABCDE' });
  assert(r.valid, `expected valid=true, got: ${JSON.stringify(r.errors)}`);
  return 'valid=true';
});

test('100-char title accepted (ISV-F03)', () => {
  const r = validateIncident({ ...VALID_FIELDS, title: 'A'.repeat(100) });
  assert(r.valid, 'expected valid=true');
  return 'valid=true';
});

test('101-char title rejected (ISV-F04)', () => {
  const r = validateIncident({ ...VALID_FIELDS, title: 'A'.repeat(101) });
  assert(!r.valid, 'expected valid=false');
  assert('title' in r.errors, 'expected errors.title');
  return 'errors.title present';
});

// ──────────────────────────────────────────────────────────────────────────

suite('2 · validateIncident — description boundaries (ISV-F05–F08)');
reset();

test('9-char description rejected (ISV-F05)', () => {
  const r = validateIncident({ ...VALID_FIELDS, description: '123456789' });
  assert(!r.valid, 'expected valid=false');
  assert('description' in r.errors, 'expected errors.description');
  return 'errors.description present';
});

test('10-char description accepted (ISV-F06)', () => {
  const r = validateIncident({ ...VALID_FIELDS, description: '1234567890' });
  assert(r.valid, `expected valid=true, got: ${JSON.stringify(r.errors)}`);
  return 'valid=true';
});

test('500-char description accepted (ISV-F07)', () => {
  const r = validateIncident({ ...VALID_FIELDS, description: 'D'.repeat(500) });
  assert(r.valid, 'expected valid=true');
  return 'valid=true';
});

test('501-char description rejected (ISV-F08)', () => {
  const r = validateIncident({ ...VALID_FIELDS, description: 'D'.repeat(501) });
  assert(!r.valid, 'expected valid=false');
  assert('description' in r.errors, 'expected errors.description');
  return 'errors.description present';
});

// ──────────────────────────────────────────────────────────────────────────

suite('3 · validateIncident — whitespace & enum guards (ISV-F09–F12)');
reset();

test('whitespace-only title rejected (ISV-F09)', () => {
  const r = validateIncident({ ...VALID_FIELDS, title: '     ' });
  assert(!r.valid && 'title' in r.errors, 'expected title error');
  return 'whitespace title rejected';
});

test('whitespace-only description rejected (ISV-F09)', () => {
  const r = validateIncident({ ...VALID_FIELDS, description: '   ' });
  assert(!r.valid && 'description' in r.errors, 'expected description error');
  return 'whitespace description rejected';
});

test('whitespace-only location rejected (ISV-F09)', () => {
  const r = validateIncident({ ...VALID_FIELDS, location: '   ' });
  assert(!r.valid && 'location' in r.errors, 'expected location error');
  return 'whitespace location rejected';
});

test('whitespace-only reportedBy rejected (ISV-F09)', () => {
  const r = validateIncident({ ...VALID_FIELDS, reportedBy: '   ' });
  assert(!r.valid && 'reportedBy' in r.errors, 'expected reportedBy error');
  return 'whitespace reportedBy rejected';
});

test('invalid type enum rejected (ISV-F10)', () => {
  const r = validateIncident({ ...VALID_FIELDS, type: 'Volcano' });
  assert(!r.valid && 'type' in r.errors, 'expected type error');
  return 'invalid type rejected';
});

test('invalid priority enum rejected (ISV-F11)', () => {
  const r = validateIncident({ ...VALID_FIELDS, priority: 'Catastrophic' });
  assert(!r.valid && 'priority' in r.errors, 'expected priority error');
  return 'invalid priority rejected';
});

test('all valid fields → valid:true, no errors key (ISV-F12)', () => {
  const r = validateIncident(VALID_FIELDS);
  assert(r.valid, 'expected valid=true');
  assert(!r.errors || Object.keys(r.errors).length === 0, 'expected no errors');
  return 'valid=true, no errors';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F13–F18  createIncident initial state
// ══════════════════════════════════════════════════════════════════════════

suite('4 · createIncident — initial field values (ISV-F13–F17)');
reset();

let createdIncident;

test('creates incident and returns success (ISV-F13)', () => {
  const r = createIncident(VALID_FIELDS);
  assert(r.success, `expected success, got: ${JSON.stringify(r)}`);
  createdIncident = r.incident;
  return `id=${createdIncident.id}`;
});

test('ID matches INC-NNNN pattern (ISV-F13)', () => {
  assert(/^INC-\d{4}$/.test(createdIncident.id), `bad id: ${createdIncident.id}`);
  return `id="${createdIncident.id}"`;
});

test('initial status is Reported (ISV-F14)', () => {
  eq(createdIncident.status, 'Reported', 'status');
  return 'status=Reported';
});

test('resolvedAt is null (ISV-F15)', () => {
  eq(createdIncident.resolvedAt, null, 'resolvedAt');
  return 'resolvedAt=null';
});

test('assignedResources is empty array (ISV-F16)', () => {
  assert(Array.isArray(createdIncident.assignedResources), 'must be array');
  eq(createdIncident.assignedResources.length, 0, 'length');
  return 'assignedResources=[]';
});

test('reportedAt is valid ISO 8601 (ISV-F17)', () => {
  assert(!isNaN(Date.parse(createdIncident.reportedAt)), `invalid: ${createdIncident.reportedAt}`);
  return `reportedAt="${createdIncident.reportedAt}"`;
});

test('updatedAt equals reportedAt at creation (ISV-F17)', () => {
  eq(createdIncident.reportedAt, createdIncident.updatedAt, 'reportedAt===updatedAt');
  return 'timestamps equal';
});

test('notes defaults to empty string when omitted', () => {
  eq(createdIncident.notes, '', 'notes');
  return 'notes=""';
});

test('notes whitespace is trimmed', () => {
  const r = createIncident({ ...VALID_FIELDS, notes: '  whitespace  ' });
  eq(r.incident.notes, 'whitespace', 'notes trimmed');
  return 'trimmed correctly';
});

test('two incidents get unique sequential IDs', () => {
  const r2 = createIncident({ ...VALID_FIELDS, title: 'Second Incident' });
  assert(r2.incident.id !== createdIncident.id, 'IDs must differ');
  return `${createdIncident.id} vs ${r2.incident.id}`;
});

test('invalid fields return success:false without store write (ISV-F18)', () => {
  const before = getAllIncidents().length;
  const r = createIncident({ title: 'x', description: '', type: 'Bad', priority: '', location: '', reportedBy: '' });
  assert(!r.success, 'expected failure');
  assert('errors' in r, 'expected errors');
  eq(getAllIncidents().length, before, 'store unchanged');
  return 'store unchanged on validation failure';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F19–F24  updateIncidentStatus transitions
// ══════════════════════════════════════════════════════════════════════════

suite('5 · updateIncidentStatus — valid lifecycle (ISV-F19, F23, F24)');
reset();

let incId;

test('create incident for transition tests', () => {
  const r = createIncident(VALID_FIELDS);
  incId = r.incident.id;
  return `id=${incId}`;
});

test('Reported → Active succeeds (ISV-F19)', () => {
  const r = updateIncidentStatus(incId, 'Active');
  assert(r.success, `expected success: ${r.error}`);
  eq(r.incident.status, 'Active', 'status');
  return 'Reported→Active OK';
});

test('updatedAt changes on transition (ISV-F24)', () => {
  const inc = getIncidentById(incId);
  assert(!isNaN(Date.parse(inc.updatedAt)), 'updatedAt must be valid date');
  return `updatedAt=${inc.updatedAt}`;
});

test('Active → In Progress succeeds (ISV-F19)', () => {
  const r = updateIncidentStatus(incId, 'In Progress');
  assert(r.success, `expected success: ${r.error}`);
  eq(r.incident.status, 'In Progress', 'status');
  return 'Active→In Progress OK';
});

test('In Progress → Resolved succeeds and sets resolvedAt (ISV-F19, F23)', () => {
  const r = updateIncidentStatus(incId, 'Resolved');
  assert(r.success, `expected success: ${r.error}`);
  eq(r.incident.status, 'Resolved', 'status');
  assert(!isNaN(Date.parse(r.incident.resolvedAt)), `resolvedAt invalid: ${r.incident.resolvedAt}`);
  return `resolvedAt=${r.incident.resolvedAt}`;
});

test('resolvedAt is null before resolution', () => {
  reset();
  const newInc = makeIncident();
  eq(newInc.resolvedAt, null, 'resolvedAt before resolution');
  return 'null before resolution';
});

suite('6 · updateIncidentStatus — invalid transitions (ISV-F20–F22)');
reset();

let inc2Id;
test('setup: create incident', () => {
  inc2Id = makeIncident({ title: 'Transition Test' }).id;
  return `id=${inc2Id}`;
});

test('Reported → In Progress rejected (skip, ISV-F20)', () => {
  const r = updateIncidentStatus(inc2Id, 'In Progress');
  assert(!r.success, 'expected failure');
  assert(r.error, 'expected error message');
  return `error: "${r.error}"`;
});

test('Reported → Resolved rejected (skip, ISV-F20)', () => {
  const r = updateIncidentStatus(inc2Id, 'Resolved');
  assert(!r.success, 'expected failure');
  return 'rejected';
});

test('Active → Reported rejected (backward, ISV-F21)', () => {
  updateIncidentStatus(inc2Id, 'Active');
  const r = updateIncidentStatus(inc2Id, 'Reported');
  assert(!r.success, 'expected failure');
  return 'backward transition rejected';
});

test('Resolved → Active rejected (terminal, ISV-F22)', () => {
  updateIncidentStatus(inc2Id, 'In Progress');
  updateIncidentStatus(inc2Id, 'Resolved');
  const r = updateIncidentStatus(inc2Id, 'Active');
  assert(!r.success, 'expected failure — Resolved is terminal');
  return `error: "${r.error}"`;
});

test('unknown incident ID returns success:false', () => {
  const r = updateIncidentStatus('INC-9999', 'Active');
  assert(!r.success, 'expected failure for unknown id');
  return 'unknown id rejected';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F25–F26  getNextStatus
// ══════════════════════════════════════════════════════════════════════════

suite('7 · getNextStatus (ISV-F25–F26)');

test('Reported → Active (ISV-F26)', () => {
  eq(getNextStatus('Reported'), 'Active', 'next status');
  return 'OK';
});

test('Active → In Progress (ISV-F26)', () => {
  eq(getNextStatus('Active'), 'In Progress', 'next status');
  return 'OK';
});

test('In Progress → Resolved (ISV-F26)', () => {
  eq(getNextStatus('In Progress'), 'Resolved', 'next status');
  return 'OK';
});

test('Resolved → null (terminal, ISV-F25)', () => {
  eq(getNextStatus('Resolved'), null, 'next status');
  return 'null (terminal)';
});

test('unknown status → null (safe fallback)', () => {
  eq(getNextStatus('Unknown'), null, 'unknown → null');
  return 'null for unknown';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F27–F29  updateIncidentNotes
// ══════════════════════════════════════════════════════════════════════════

suite('8 · updateIncidentNotes (ISV-F27–F29)');
reset();

let noteIncId;
test('setup: create incident', () => {
  noteIncId = makeIncident({ title: 'Notes Test Incident' }).id;
  return `id=${noteIncId}`;
});

test('saves non-empty notes', () => {
  const r = updateIncidentNotes(noteIncId, 'Evacuation initiated.');
  assert(r.success, `expected success: ${r.error}`);
  eq(r.incident.notes, 'Evacuation initiated.', 'notes');
  return 'notes saved';
});

test('empty string notes accepted (ISV-F27)', () => {
  const r = updateIncidentNotes(noteIncId, '');
  assert(r.success, `expected success: ${r.error}`);
  eq(r.incident.notes, '', 'notes');
  return 'empty string accepted';
});

test('non-string notes rejected (ISV-F28)', () => {
  const r = updateIncidentNotes(noteIncId, 42);
  assert(!r.success, 'expected failure for non-string');
  assert(r.error, 'expected error message');
  return `error: "${r.error}"`;
});

test('unknown ID returns success:false (ISV-F29)', () => {
  const r = updateIncidentNotes('INC-9999', 'Some notes');
  assert(!r.success, 'expected failure for unknown id');
  return 'unknown id rejected';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F30–F32  deleteIncident guard
// ══════════════════════════════════════════════════════════════════════════

suite('9 · deleteIncident guard (ISV-F30–F32)');
reset();

let delReportedId, delActiveId, delResolvedId;

test('setup: create three incidents', () => {
  delReportedId = makeIncident({ title: 'Delete Test Reported' }).id;
  delActiveId   = makeIncident({ title: 'Delete Test Active' }).id;
  delResolvedId = makeIncident({ title: 'Delete Test Resolved' }).id;
  updateIncidentStatus(delActiveId, 'Active');
  advanceTo(delResolvedId, 'Resolved');
  return `reported=${delReportedId} active=${delActiveId} resolved=${delResolvedId}`;
});

test('Reported incident cannot be deleted (ISV-F31)', () => {
  const r = deleteIncident(delReportedId);
  assert(!r.success, 'expected failure');
  assert(r.error, 'expected error message');
  return `error: "${r.error}"`;
});

test('Active incident cannot be deleted (ISV-F31)', () => {
  const r = deleteIncident(delActiveId);
  assert(!r.success, 'expected failure');
  return 'Active deletion blocked';
});

test('Resolved incident can be deleted (ISV-F30)', () => {
  const r = deleteIncident(delResolvedId);
  assert(r.success, `expected success: ${r.error}`);
  return 'Resolved deleted';
});

test('deleted incident not in getAllIncidents (ISV-F30)', () => {
  const all = getAllIncidents();
  assert(!all.some(i => i.id === delResolvedId), 'should not be in store');
  return `${all.length} incidents remain`;
});

test('unknown ID returns success:false (ISV-F32)', () => {
  const r = deleteIncident('INC-9999');
  assert(!r.success, 'expected failure');
  return 'unknown id rejected';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F33–F35  checkDuplicate
// ══════════════════════════════════════════════════════════════════════════

suite('10 · checkDuplicate — 5-minute window (ISV-F33–F35)');
reset();

test('no incidents in store → null (ISV-F34)', () => {
  const r = checkDuplicate({ type: 'Fire', location: 'Block A' });
  eq(r, null, 'should be null');
  return 'null (no incidents)';
});

test('same type+location within 5 min → warning (ISV-F33)', () => {
  createIncident({ ...VALID_FIELDS, type: 'Fire', location: 'Chemistry Lab' });
  const r = checkDuplicate({ type: 'Fire', location: 'Chemistry Lab' });
  assert(typeof r === 'string' && r.length > 0, 'expected warning string');
  return `warning: "${r}"`;
});

test('different location → null (ISV-F34)', () => {
  const r = checkDuplicate({ type: 'Fire', location: 'Block B' });
  eq(r, null, 'different location should be null');
  return 'null (different location)';
});

test('different type → null (ISV-F34)', () => {
  const r = checkDuplicate({ type: 'Medical', location: 'Chemistry Lab' });
  eq(r, null, 'different type should be null');
  return 'null (different type)';
});

test('location match is case-insensitive', () => {
  const r = checkDuplicate({ type: 'Fire', location: 'CHEMISTRY LAB' });
  assert(typeof r === 'string', 'expected warning — case-insensitive match');
  return 'case-insensitive match works';
});

test('incident older than 5 min → null (ISV-F35, simulated via stale timestamp)', () => {
  // Manually write a stale incident to the store
  const staleTime = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 min ago
  const raw = JSON.parse(global._testStore.get('resqgrid_incidents') || '[]');
  raw.push({
    id: 'INC-STALE', title: 'Stale', description: 'Old incident..',
    type: 'Security', priority: 'Low', status: 'Reported',
    location: 'Old Room', reportedBy: 'Tester',
    reportedAt: staleTime, updatedAt: staleTime,
    resolvedAt: null, assignedResources: [], notes: '',
  });
  global._testStore.set('resqgrid_incidents', JSON.stringify(raw));

  const r = checkDuplicate({ type: 'Security', location: 'Old Room' });
  eq(r, null, 'stale incident should not trigger warning');
  return 'stale incident correctly ignored';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F36–F38  searchIncidents
// ══════════════════════════════════════════════════════════════════════════

suite('11 · searchIncidents (ISV-F36–F38)');
reset();

// Populate a known set
const incA = makeIncident({ title: 'Fire at Block A', description: 'Smoke rising from east wing.', location: 'Block A' });
const incB = makeIncident({ title: 'Medical Emergency', description: 'Patient collapsed in cafeteria.', location: 'Cafeteria' });
const incC = makeIncident({ title: 'Security Alert', description: 'Suspicious person at main gate.', location: 'Main Gate' });
const allThree = getAllIncidents();

test('empty query returns all (ISV-F36)', () => {
  const r = searchIncidents(allThree, '');
  eq(r.length, 3, 'should return all 3');
  return '3 incidents returned';
});

test('whitespace-only query returns all (ISV-F36)', () => {
  const r = searchIncidents(allThree, '   ');
  eq(r.length, 3, 'should return all 3');
  return '3 incidents returned';
});

test('query matches title (ISV-F37)', () => {
  const r = searchIncidents(allThree, 'Medical');
  eq(r.length, 1, `expected 1, got ${r.length}`);
  eq(r[0].id, incB.id, 'should be incB');
  return 'title match works';
});

test('query matches description (ISV-F37)', () => {
  const r = searchIncidents(allThree, 'east wing');
  eq(r.length, 1, `expected 1, got ${r.length}`);
  eq(r[0].id, incA.id, 'should be incA');
  return 'description match works';
});

test('query matches location (ISV-F37)', () => {
  const r = searchIncidents(allThree, 'cafeteria');
  eq(r.length, 1, `expected 1, got ${r.length}`);
  eq(r[0].id, incB.id, 'should be incB');
  return 'location match works';
});

test('case-insensitive match (ISV-F37)', () => {
  const r = searchIncidents(allThree, 'MAIN GATE');
  eq(r.length, 1, `expected 1, got ${r.length}`);
  eq(r[0].id, incC.id, 'should be incC');
  return 'case-insensitive OK';
});

test('no match returns empty array (ISV-F38)', () => {
  const r = searchIncidents(allThree, 'xyzzy');
  eq(r.length, 0, 'should be empty');
  return '[] returned';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F39–F40  filterIncidents
// ══════════════════════════════════════════════════════════════════════════

suite('12 · filterIncidents (ISV-F39–F40)');
reset();

makeIncident({ title: 'Fire High',      type: 'Fire',     priority: 'High',   location: 'L1' });
makeIncident({ title: 'Fire Critical',  type: 'Fire',     priority: 'Critical', location: 'L2' });
makeIncident({ title: 'Medical High',   type: 'Medical',  priority: 'High',   location: 'L3' });
const filterAll = getAllIncidents();

test('filter by type returns only matching type (ISV-F39)', () => {
  const r = filterIncidents(filterAll, { type: 'Fire' });
  assert(r.every(i => i.type === 'Fire'), 'all must be Fire');
  eq(r.length, 2, `expected 2, got ${r.length}`);
  return 'type filter works';
});

test('filter by priority (ISV-F39)', () => {
  const r = filterIncidents(filterAll, { priority: 'High' });
  assert(r.every(i => i.priority === 'High'), 'all must be High');
  eq(r.length, 2, `expected 2, got ${r.length}`);
  return 'priority filter works';
});

test('combined type+priority AND logic (ISV-F39)', () => {
  const r = filterIncidents(filterAll, { type: 'Fire', priority: 'Critical' });
  eq(r.length, 1, `expected 1, got ${r.length}`);
  eq(r[0].priority, 'Critical', 'priority');
  eq(r[0].type, 'Fire', 'type');
  return 'AND filter works';
});

test('null filter value is not applied (ISV-F40)', () => {
  const r = filterIncidents(filterAll, { type: null, priority: undefined });
  eq(r.length, 3, `expected 3 (no filter), got ${r.length}`);
  return 'null filters ignored';
});

test('filter returns empty array when no match (ISV-F39)', () => {
  const r = filterIncidents(filterAll, { type: 'Hazmat' });
  eq(r.length, 0, 'expected empty');
  return '[] returned';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F41–F42  sortIncidents (non-mutating)
// ══════════════════════════════════════════════════════════════════════════

suite('13 · sortIncidents — non-mutating + correct order (ISV-F41–F42)');
reset();

// Build an array with explicitly different reportedAt values so date sort
// is deterministic even when incidents are created within the same millisecond.
const s1 = makeIncident({ title: 'Sort Low Priority',      priority: 'Low',      location: 'S1' });
const s2 = makeIncident({ title: 'Sort Critical Priority', priority: 'Critical', location: 'S2' });
const s3 = makeIncident({ title: 'Sort High Priority',     priority: 'High',     location: 'S3' });
// Advance s3 to Active so we have mixed statuses
updateIncidentStatus(s3.id, 'Active');

// Patch reportedAt values so s1 < s2 < s3 unambiguously
{
  const raw = JSON.parse(global._testStore.get('resqgrid_incidents'));
  const base = new Date('2024-01-01T00:00:00.000Z').getTime();
  raw.forEach((inc, i) => {
    inc.reportedAt = new Date(base + i * 1000).toISOString();
    inc.updatedAt  = inc.reportedAt;
  });
  global._testStore.set('resqgrid_incidents', JSON.stringify(raw));
}

const sortInput = getAllIncidents();

test('sortIncidents does not mutate input array (ISV-F41)', () => {
  const copy = [...sortInput];
  sortIncidents(sortInput, 'priority', 'asc');
  // Original order must be unchanged
  for (let i = 0; i < copy.length; i++) {
    eq(sortInput[i].id, copy[i].id, `position ${i} mutated`);
  }
  return 'input array not mutated';
});

test('sort by date desc — newest first (ISV-F42)', () => {
  const r = sortIncidents(sortInput, 'date', 'desc');
  // s3 was created last (has highest reportedAt)
  eq(r[0].id, s3.id, 'newest should be first');
  return `first=${r[0].id}`;
});

test('sort by date asc — oldest first (ISV-F42)', () => {
  const r = sortIncidents(sortInput, 'date', 'asc');
  eq(r[0].id, s1.id, 'oldest should be first');
  return `first=${r[0].id}`;
});

test('sort by priority asc — Critical first (ISV-F42)', () => {
  const r = sortIncidents(sortInput, 'priority', 'asc');
  eq(r[0].priority, 'Critical', 'Critical should be first');
  return `first priority=${r[0].priority}`;
});

test('sort by status asc — Reported before Active (ISV-F42)', () => {
  const r = sortIncidents(sortInput, 'status', 'asc');
  const statuses = r.map(i => i.status);
  const reportedIdx = statuses.indexOf('Reported');
  const activeIdx   = statuses.indexOf('Active');
  assert(reportedIdx < activeIdx, `Reported (${reportedIdx}) should come before Active (${activeIdx})`);
  return `Reported@${reportedIdx} < Active@${activeIdx}`;
});

test('unknown sortBy key returns valid array without crash (edge case)', () => {
  const r = sortIncidents(sortInput, 'unknownField', 'asc');
  eq(r.length, sortInput.length, 'length preserved');
  return `${r.length} items, no crash`;
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F43  getFilteredIncidents pipeline
// ══════════════════════════════════════════════════════════════════════════

suite('14 · getFilteredIncidents — combined pipeline (ISV-F43)');
reset();

makeIncident({ title: 'Fire at Warehouse', type: 'Fire',    priority: 'High',   location: 'Warehouse' });
makeIncident({ title: 'Fire at Lab',       type: 'Fire',    priority: 'Critical', location: 'Lab' });
makeIncident({ title: 'Medical at Lab',    type: 'Medical', priority: 'High',   location: 'Lab' });

test('pipeline: search restricts results, then filter, then sort', () => {
  const r = getFilteredIncidents({
    query:     'lab',           // matches "Fire at Lab" and "Medical at Lab"
    filters:   { type: 'Fire' }, // narrows to "Fire at Lab"
    sortBy:    'priority',
    direction: 'asc',
  });
  eq(r.length, 1, `expected 1, got ${r.length}`);
  eq(r[0].type, 'Fire', 'type should be Fire');
  assert((r[0].location || '').toLowerCase().includes('lab'), 'location should contain lab');
  return `1 result: "${r[0].title}"`;
});

test('no-options call returns all incidents sorted by date desc', () => {
  const r = getFilteredIncidents();
  eq(r.length, 3, `expected 3, got ${r.length}`);
  return '3 incidents, no crash';
});

test('pipeline returns [] when combined criteria match nothing', () => {
  const r = getFilteredIncidents({
    query:   'xyzzy',          // matches nothing
    filters: { type: 'Fire' },
  });
  eq(r.length, 0, 'expected empty');
  return '[] when nothing matches';
});

// ══════════════════════════════════════════════════════════════════════════
// ISV-F44–F45  updateIncident protected fields
// ══════════════════════════════════════════════════════════════════════════

suite('15 · updateIncident — protected fields (ISV-F44–F45)');
reset();

let protectedId;
test('setup: create incident', () => {
  const inc = makeIncident({ title: 'Protected Test Incident' });
  protectedId = inc.id;
  return `id=${protectedId}`;
});

test('can update allowed fields: title, description, location, type, priority', () => {
  const r = updateIncident(protectedId, {
    title:       'Updated Title Xx',
    description: 'Updated description here that is long enough.',
    location:    'New Location Block C',
    type:        'Medical',
    priority:    'Low',
  });
  assert(r.success, `expected success: ${JSON.stringify(r)}`);
  eq(r.incident.title,    'Updated Title Xx', 'title updated');
  eq(r.incident.type,     'Medical', 'type updated');
  eq(r.incident.priority, 'Low', 'priority updated');
  return 'allowed fields updated';
});

test('id is never changed by updateIncident (ISV-F44)', () => {
  const r = updateIncident(protectedId, { id: 'INC-9999', title: 'Any Valid Title Two' });
  // Even if id is passed, the stored id must remain original
  eq(r.incident.id, protectedId, 'id must not change');
  return `id remains ${protectedId}`;
});

test('reportedAt is never changed by updateIncident (ISV-F44)', () => {
  const original = getIncidentById(protectedId).reportedAt;
  updateIncident(protectedId, { reportedAt: '2000-01-01T00:00:00.000Z', title: 'Any Valid Long Title' });
  const after = getIncidentById(protectedId).reportedAt;
  eq(after, original, 'reportedAt must not change');
  return 'reportedAt unchanged';
});

test('status is never changed by updateIncident (ISV-F44)', () => {
  updateIncident(protectedId, { status: 'Resolved', title: 'Any Valid Title Here' });
  const inc = getIncidentById(protectedId);
  eq(inc.status, 'Reported', 'status must not change via updateIncident');
  return 'status unchanged';
});

test('assignedResources is never changed by updateIncident (ISV-F44)', () => {
  updateIncident(protectedId, { assignedResources: ['RES-9999'], title: 'Any Valid Title ABC' });
  const inc = getIncidentById(protectedId);
  eq(inc.assignedResources.length, 0, 'assignedResources must not change');
  return 'assignedResources unchanged';
});

test('updateIncident re-runs validation on merged result (ISV-F45)', () => {
  // Pass a title that is too short — should fail validation
  const r = updateIncident(protectedId, { title: 'ab' });
  assert(!r.success, 'expected validation failure');
  assert(r.errors && 'title' in r.errors, 'expected title validation error');
  return 'validation re-runs on update';
});

test('updateIncident returns success:false for unknown ID', () => {
  const r = updateIncident('INC-9999', { title: 'Valid Title Here Now' });
  assert(!r.success, 'expected failure for unknown id');
  return 'unknown id rejected';
});

// ══════════════════════════════════════════════════════════════════════════
// Cleanup and summary
// ══════════════════════════════════════════════════════════════════════════

reset();

const total = passed + failed;
console.log('\n' + '─'.repeat(60));
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${total}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ [${f.suite}] ${f.label}\n    ${f.msg}`));
}
console.log(failed === 0
  ? `\n\x1b[32m✓ All ${total} incidentService tests passed.\x1b[0m`
  : `\n\x1b[31m✗ ${failed}/${total} tests failed.\x1b[0m`);
console.log('\x1b[33m  ✓ In-memory store cleared — no persistent data created.\x1b[0m\n');
process.exit(failed > 0 ? 1 : 0);
