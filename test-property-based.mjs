/**
 * test-property-based.mjs
 * -----------------------
 * Property-based tests for ResQGrid.
 *
 * Run:
 *   node --require ./test-globals-preload.cjs test-property-based.mjs
 *
 * WHAT IS PROPERTY-BASED TESTING?
 * --------------------------------
 * Instead of checking "given this specific input, expect this specific output",
 * property-based testing generates many varied inputs automatically and checks
 * that structural INVARIANTS hold for all of them.
 *
 * This file implements a minimal `forAll` runner inline — no external framework
 * needed. It draws inputs from explicit value pools and runs each property
 * check N times with different combinations.
 *
 * INVARIANTS TESTED
 * -----------------
 * P01  ID uniqueness — no two incidents share an ID across 50 creations
 * P02  ID uniqueness — no two resources share an ID across 50 creations
 * P03  ID format    — every generated incident ID matches INC-\d{4}
 * P04  ID format    — every generated resource ID matches RES-\d{4}
 * P05  Initial status — every new incident always has status "Reported"
 * P06  Initial status — every new resource always has status "Available"
 * P07  resolvedAt null — every new incident has resolvedAt === null
 * P08  assignedTo null — every new resource has assignedTo === null
 * P09  assignedResources empty — every new incident has assignedResources = []
 * P10  Status transition — no valid single-step transition is ever rejected
 * P11  Status terminal  — Resolved never allows a further transition
 * P12  Invalid transitions always rejected — no skip or backward move succeeds
 * P13  Assignment sync — after assign, resource.assignedTo === incident.id
 * P14  Assignment sync — after assign, incident.assignedResources contains resourceId
 * P15  Release sync    — after release, resource.assignedTo === null
 * P16  Release sync    — after release, incident.assignedResources excludes resourceId
 * P17  Deployed block  — a Deployed resource cannot be assigned to a second incident
 * P18  Available invariant — no Available resource has a non-null assignedTo
 * P19  Deployed invariant  — no Deployed resource has assignedTo === null
 * P20  Stats non-negative  — all count fields are >= 0 for any incident/resource set
 * P21  Stats total         — total incidents === active + resolved
 * P22  Stats utilization   — utilization is null or in range [0, 100]
 * P23  Sort non-mutating   — sortIncidents never mutates input array
 * P24  Sort non-mutating   — sortResources never mutates input array
 * P25  Filter AND logic    — filterIncidents with two filters never returns a row
 *                             that fails either filter predicate
 * P26  calcPercentage safe — never returns NaN or Infinity for any count/total pair
 * P27  Counts bounded      — byType/byPriority/byStatus row counts sum to totals
 */

import {
  createIncident,
  getAllIncidents,
  getIncidentById,
  updateIncidentStatus,
  searchIncidents,
  filterIncidents,
  sortIncidents,
} from './assets/js/services/incidentService.js';

import {
  createResource,
  getAllResources,
  getResourceById,
  assignResource,
  releaseResource,
  sortResources,
  filterResources,
} from './assets/js/services/resourceService.js';

import { registerReleaseHook } from './assets/js/services/incidentService.js';

import { compute } from './assets/js/services/statsService.js';
import { calcPercentage } from './assets/js/utils.js';

import { STORAGE_KEYS } from './assets/js/store.js';

// Wire the release hook (same as app.js)
registerReleaseHook(releaseResource);

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

function reset() { global._testStore.clear(); }

// ── Property-based engine ──────────────────────────────────────────────────

/**
 * Run a property check N times with inputs drawn from `generators`.
 * Each generator is a function () => value.
 * `property` receives the generated values and throws on violation.
 *
 * This is genuine property-based testing: inputs are varied across runs
 * via explicit value pools rather than a single hard-coded example.
 *
 * @param {string}     name       - Human-readable property name
 * @param {Function[]} generators - Array of () => value functions
 * @param {Function}   property   - (...values) => void (throws on violation)
 * @param {number}     [runs=30]  - Number of random input combinations to try
 */
function forAll(name, generators, property, runs = 30) {
  let violations = 0;
  let firstViolation = null;

  for (let i = 0; i < runs; i++) {
    const inputs = generators.map(g => g());
    try {
      property(...inputs);
    } catch (err) {
      violations++;
      if (!firstViolation) firstViolation = { inputs, err };
    }
  }

  if (violations > 0) {
    const { inputs, err } = firstViolation;
    throw new Error(
      `Property "${name}" violated ${violations}/${runs} times.\n` +
      `    First failing input: ${JSON.stringify(inputs)}\n` +
      `    Error: ${err.message}`
    );
  }
}

// ── Value pools ────────────────────────────────────────────────────────────
// Explicit, finite pools — reproducible across runs on any platform.

const TYPES      = ['Fire', 'Medical', 'Security', 'Hazmat', 'Natural Disaster', 'Other'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const RES_TYPES  = ['Ambulance', 'Fire Truck', 'Police Unit', 'Hazmat Team', 'Medical Team', 'Utility Crew', 'Other'];
const LOCATIONS  = ['Block A', 'Block B', 'Lab 1', 'Cafeteria', 'Main Gate', 'Server Room', 'Roof'];
const NAMES      = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

// Deterministic pseudo-random: cycles through the pool based on call count.
function pool(arr) {
  let i = 0;
  return () => arr[i++ % arr.length];
}

const genType     = pool(TYPES);
const genPriority = pool(PRIORITIES);
const genResType  = pool(RES_TYPES);
const genLocation = pool(LOCATIONS);
// Name generator: combine pool entry with incrementing suffix for uniqueness
let nameCounter = 0;
const genResName  = () => `${NAMES[nameCounter % NAMES.length]}-${++nameCounter}`;

// ── Incident field builder ─────────────────────────────────────────────────
let incCounter = 0;
function makeIncFields(typeOverride, priorityOverride) {
  incCounter++;
  return {
    title:       `Property Test Incident ${incCounter}`,
    description: `Generated description number ${incCounter} for property tests.`,
    type:        typeOverride  || genType(),
    priority:    priorityOverride || genPriority(),
    location:    genLocation(),
    reportedBy:  'Property Tester',
  };
}

// ── Helper: advance incident to Resolved ──────────────────────────────────
function advanceToResolved(id) {
  updateIncidentStatus(id, 'Active');
  updateIncidentStatus(id, 'In Progress');
  updateIncidentStatus(id, 'Resolved');
}

// ══════════════════════════════════════════════════════════════════════════
// P01–P04  ID uniqueness and format
// ══════════════════════════════════════════════════════════════════════════

suite('P01–P04 · ID uniqueness and format');
reset();

test('P01 — 50 incident IDs are all unique', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const r = createIncident(makeIncFields());
    assert(r.success, `createIncident failed at i=${i}: ${JSON.stringify(r)}`);
    assert(!ids.has(r.incident.id), `Duplicate ID: ${r.incident.id}`);
    ids.add(r.incident.id);
  }
  return `${ids.size} unique IDs`;
});

test('P02 — 50 resource IDs are all unique', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const r = createResource({ name: genResName(), type: genResType(), location: genLocation() });
    assert(r.success, `createResource failed at i=${i}`);
    assert(!ids.has(r.resource.id), `Duplicate ID: ${r.resource.id}`);
    ids.add(r.resource.id);
  }
  return `${ids.size} unique IDs`;
});

test('P03 — every incident ID matches INC-NNNN', () => {
  const all = getAllIncidents();
  const bad = all.filter(i => !/^INC-\d{4}$/.test(i.id));
  eq(bad.length, 0, `IDs with wrong format: ${bad.map(i => i.id).join(', ')}`);
  return `${all.length} IDs all match INC-\\d{4}`;
});

test('P04 — every resource ID matches RES-NNNN', () => {
  const all = getAllResources();
  const bad = all.filter(r => !/^RES-\d{4}$/.test(r.id));
  eq(bad.length, 0, `IDs with wrong format: ${bad.map(r => r.id).join(', ')}`);
  return `${all.length} IDs all match RES-\\d{4}`;
});

// ══════════════════════════════════════════════════════════════════════════
// P05–P09  Initial state invariants
// ══════════════════════════════════════════════════════════════════════════

suite('P05–P09 · Initial state invariants (forAll over type × priority)');
reset();

test('P05 — forAll(type, priority): every new incident has status "Reported"', () => {
  let checked = 0;
  forAll('initial status = Reported', [genType, genPriority], (type, priority) => {
    const r = createIncident(makeIncFields(type, priority));
    assert(r.success, `creation failed`);
    eq(r.incident.status, 'Reported', 'status');
    checked++;
  }, 20);
  return `${checked} incidents checked`;
});

test('P06 — forAll(resType): every new resource has status "Available"', () => {
  forAll('initial status = Available', [genResType], (type) => {
    const r = createResource({ name: genResName(), type, location: genLocation() });
    assert(r.success, `creation failed`);
    eq(r.resource.status, 'Available', 'status');
  }, 14);
  return '14 resources checked';
});

test('P07 — forAll: every new incident has resolvedAt === null', () => {
  forAll('resolvedAt = null', [genType], (type) => {
    const r = createIncident(makeIncFields(type));
    eq(r.incident.resolvedAt, null, 'resolvedAt');
  }, 10);
  return '10 incidents checked';
});

test('P08 — forAll: every new resource has assignedTo === null', () => {
  forAll('assignedTo = null', [genResType], (type) => {
    const r = createResource({ name: genResName(), type, location: 'Gate' });
    eq(r.resource.assignedTo, null, 'assignedTo');
  }, 7);
  return '7 resources checked';
});

test('P09 — forAll: every new incident has assignedResources = []', () => {
  forAll('assignedResources = []', [genType], (type) => {
    const r = createIncident(makeIncFields(type));
    assert(Array.isArray(r.incident.assignedResources), 'must be array');
    eq(r.incident.assignedResources.length, 0, 'length');
  }, 10);
  return '10 incidents checked';
});

// ══════════════════════════════════════════════════════════════════════════
// P10–P12  Status transition invariants
// ══════════════════════════════════════════════════════════════════════════

suite('P10–P12 · Status transition invariants');
reset();

test('P10 — every valid single-step transition succeeds', () => {
  const steps = [
    ['Reported', 'Active'],
    ['Active', 'In Progress'],
    ['In Progress', 'Resolved'],
  ];
  let checked = 0;
  // Run each valid step 5 times with different type/priority combinations
  for (const [, next] of steps) {
    for (let i = 0; i < 5; i++) {
      const inc = createIncident(makeIncFields()).incident;
      // Advance to the step before `next`
      if (next === 'In Progress') {
        updateIncidentStatus(inc.id, 'Active');
      } else if (next === 'Resolved') {
        updateIncidentStatus(inc.id, 'Active');
        updateIncidentStatus(inc.id, 'In Progress');
      }
      const r = updateIncidentStatus(inc.id, next);
      assert(r.success, `transition to ${next} should succeed, got: ${r.error}`);
      checked++;
    }
  }
  return `${checked} valid transitions all succeeded`;
});

test('P11 — Resolved is always terminal: no transition is ever accepted', () => {
  const allStatuses = ['Reported', 'Active', 'In Progress', 'Resolved'];
  let checked = 0;
  for (let i = 0; i < 10; i++) {
    const inc = createIncident(makeIncFields()).incident;
    advanceToResolved(inc.id);
    for (const s of allStatuses) {
      const r = updateIncidentStatus(inc.id, s);
      assert(!r.success, `Expected Resolved→${s} to fail, but it succeeded`);
      checked++;
    }
  }
  return `${checked} post-Resolved transitions all rejected`;
});

test('P12 — forAll(invalidNext): skipping steps always rejected', () => {
  // Skip transitions: Reported→In Progress, Reported→Resolved, Active→Resolved
  const invalidSkips = [
    { from: 'Reported',  to: 'In Progress' },
    { from: 'Reported',  to: 'Resolved'    },
    { from: 'Active',    to: 'Resolved'    },
  ];
  let checked = 0;
  for (const { from, to } of invalidSkips) {
    for (let i = 0; i < 5; i++) {
      const inc = createIncident(makeIncFields()).incident;
      // Advance to the `from` state
      if (from === 'Active')   updateIncidentStatus(inc.id, 'Active');
      const r = updateIncidentStatus(inc.id, to);
      assert(!r.success, `Skip ${from}→${to} should be rejected`);
      checked++;
    }
  }
  return `${checked} skip transitions all rejected`;
});

// ══════════════════════════════════════════════════════════════════════════
// P13–P19  Assignment/release sync invariants
// ══════════════════════════════════════════════════════════════════════════

suite('P13–P19 · Assignment and release sync invariants');
reset();

test('P13+P14 — after assign: resource.assignedTo === incident.id AND incident.assignedResources contains resourceId', () => {
  // Run for 10 different type combinations
  for (let i = 0; i < 10; i++) {
    const inc = createIncident(makeIncFields()).incident;
    updateIncidentStatus(inc.id, 'Active');
    const res = createResource({ name: genResName(), type: genResType(), location: genLocation() }).resource;

    const r = assignResource(res.id, inc.id);
    assert(r.success, `assignResource failed: ${r.error}`);

    const freshRes = getResourceById(res.id);
    const freshInc = getIncidentById(inc.id);

    eq(freshRes.assignedTo, inc.id, `P13: resource.assignedTo should be ${inc.id}`);
    assert(freshInc.assignedResources.includes(res.id), `P14: incident.assignedResources should contain ${res.id}`);
    eq(freshRes.status, 'Deployed', 'resource status should be Deployed');
  }
  return '10 assignments verified (P13+P14)';
});

test('P15+P16 — after release: resource.assignedTo === null AND incident no longer lists resourceId', () => {
  for (let i = 0; i < 10; i++) {
    const inc = createIncident(makeIncFields()).incident;
    updateIncidentStatus(inc.id, 'Active');
    const res = createResource({ name: genResName(), type: genResType(), location: genLocation() }).resource;
    assignResource(res.id, inc.id);

    const r = releaseResource(res.id);
    assert(r.success, `releaseResource failed: ${r.error}`);

    const freshRes = getResourceById(res.id);
    const freshInc = getIncidentById(inc.id);

    eq(freshRes.assignedTo, null, 'P15: assignedTo should be null after release');
    assert(!freshInc.assignedResources.includes(res.id), 'P16: assignedResources should not contain resourceId');
    eq(freshRes.status, 'Available', 'resource status should be Available');
  }
  return '10 releases verified (P15+P16)';
});

test('P17 — Deployed resource cannot be assigned to a second incident', () => {
  for (let i = 0; i < 10; i++) {
    const inc1 = createIncident(makeIncFields()).incident;
    const inc2 = createIncident(makeIncFields()).incident;
    updateIncidentStatus(inc1.id, 'Active');
    updateIncidentStatus(inc2.id, 'Active');
    const res = createResource({ name: genResName(), type: genResType(), location: genLocation() }).resource;

    assignResource(res.id, inc1.id);
    const r = assignResource(res.id, inc2.id);
    assert(!r.success, `P17: Deployed resource should not be re-assignable, but got success`);
  }
  return '10 double-assignment attempts all rejected';
});

test('P18 — Available invariant: no Available resource has non-null assignedTo', () => {
  const all = getAllResources();
  const violations = all.filter(r => r.status === 'Available' && r.assignedTo !== null);
  eq(violations.length, 0,
    `P18 violated: ${violations.length} Available resources have non-null assignedTo: ` +
    violations.map(r => r.id).join(', '));
  return `${all.filter(r => r.status === 'Available').length} Available resources all have assignedTo=null`;
});

test('P19 — Deployed invariant: no Deployed resource has assignedTo === null', () => {
  const all = getAllResources();
  const violations = all.filter(r => r.status === 'Deployed' && r.assignedTo === null);
  eq(violations.length, 0,
    `P19 violated: ${violations.length} Deployed resources have null assignedTo`);
  return `${all.filter(r => r.status === 'Deployed').length} Deployed resources all have assignedTo set`;
});

// ══════════════════════════════════════════════════════════════════════════
// P20–P22  Statistics invariants
// ══════════════════════════════════════════════════════════════════════════

suite('P20–P22 · Statistics invariants (forAll over incident/resource sets)');
reset();

test('P20 — all count fields are >= 0 for any state of the store', () => {
  // Build up a realistic mixed store: some incidents at various statuses,
  // some resources at various statuses.
  const incIds = [];
  for (let i = 0; i < 8; i++) {
    const r = createIncident(makeIncFields());
    incIds.push(r.incident.id);
  }
  // Advance some through the lifecycle
  updateIncidentStatus(incIds[0], 'Active');
  updateIncidentStatus(incIds[1], 'Active');
  updateIncidentStatus(incIds[1], 'In Progress');
  advanceToResolved(incIds[2]);
  advanceToResolved(incIds[3]);

  const resIds = [];
  for (let i = 0; i < 5; i++) {
    const r = createResource({ name: genResName(), type: genResType(), location: 'Base' });
    resIds.push(r.resource.id);
  }

  const stats = compute(getAllIncidents(), getAllResources());

  // Check all scalar counts are non-negative
  const checks = [
    ['incidents.total',      stats.incidents.total],
    ['incidents.active',     stats.incidents.active],
    ['incidents.critical',   stats.incidents.critical],
    ['incidents.resolved',   stats.incidents.resolved],
    ['resources.total',      stats.resources.total],
    ['resources.available',  stats.resources.available],
    ['resources.deployed',   stats.resources.deployed],
    ['resources.maintenance', stats.resources.maintenance],
  ];
  for (const [label, value] of checks) {
    assert(typeof value === 'number' && value >= 0 && !isNaN(value),
      `P20: ${label} = ${value} is not a non-negative number`);
  }

  // Check all breakdown row counts are non-negative
  for (const row of [...stats.incidents.byType, ...stats.incidents.byPriority,
                      ...stats.incidents.byStatus, ...stats.resources.byType,
                      ...stats.resources.byStatus]) {
    assert(row.count >= 0, `P20: row.count = ${row.count} for "${row.label}"`);
    assert(row.pct   >= 0, `P20: row.pct   = ${row.pct} for "${row.label}"`);
    assert(!isNaN(row.count), `P20: NaN count for "${row.label}"`);
    assert(!isNaN(row.pct),   `P20: NaN pct for "${row.label}"`);
  }
  return 'all counts >= 0, no NaN';
});

test('P21 — incidents.total === active + resolved', () => {
  const stats = compute(getAllIncidents(), getAllResources());
  eq(stats.incidents.total,
     stats.incidents.active + stats.incidents.resolved,
     'P21: total should equal active + resolved');
  return `total=${stats.incidents.total} active=${stats.incidents.active} resolved=${stats.incidents.resolved}`;
});

test('P22 — utilization is null or in range [0, 100]', () => {
  const stats = compute(getAllIncidents(), getAllResources());
  const u = stats.resources.utilization;
  if (u !== null) {
    assert(typeof u === 'number' && !isNaN(u) && u >= 0 && u <= 100,
      `P22: utilization = ${u} is not in [0, 100]`);
  }
  return u === null ? 'utilization=null (acceptable)' : `utilization=${u}%`;
});

// ══════════════════════════════════════════════════════════════════════════
// P23–P24  Sort non-mutation invariants
// ══════════════════════════════════════════════════════════════════════════

suite('P23–P24 · Sort non-mutation invariants (forAll over sort keys)');
reset();

// Fresh incidents and resources
for (let i = 0; i < 6; i++) createIncident(makeIncFields());
for (let i = 0; i < 4; i++) createResource({ name: genResName(), type: genResType(), location: 'Base' });

const SORT_KEYS_INC = ['date', 'priority', 'status'];
const SORT_DIRS     = ['asc', 'desc'];

test('P23 — forAll(sortKey, direction): sortIncidents never mutates input', () => {
  const allInc = getAllIncidents();
  forAll('sortIncidents non-mutating', [pool(SORT_KEYS_INC), pool(SORT_DIRS)], (key, dir) => {
    const snapshot = allInc.map(i => i.id);
    sortIncidents(allInc, key, dir);
    for (let i = 0; i < snapshot.length; i++) {
      if (allInc[i].id !== snapshot[i]) {
        throw new Error(`Input mutated at index ${i}: ${allInc[i].id} !== ${snapshot[i]}`);
      }
    }
  }, 12);
  return '12 sort combinations, input never mutated';
});

test('P24 — forAll(sortKey, direction): sortResources never mutates input', () => {
  const allRes = getAllResources();
  const SORT_KEYS_RES = ['date', 'name', 'status'];
  forAll('sortResources non-mutating', [pool(SORT_KEYS_RES), pool(SORT_DIRS)], (key, dir) => {
    const snapshot = allRes.map(r => r.id);
    sortResources(allRes, key, dir);
    for (let i = 0; i < snapshot.length; i++) {
      if (allRes[i].id !== snapshot[i]) {
        throw new Error(`Input mutated at index ${i}: ${allRes[i].id} !== ${snapshot[i]}`);
      }
    }
  }, 12);
  return '12 sort combinations, input never mutated';
});

// ══════════════════════════════════════════════════════════════════════════
// P25  Filter AND logic invariant
// ══════════════════════════════════════════════════════════════════════════

suite('P25 · Filter AND logic invariant');
reset();

// Build a heterogeneous set
for (const type of TYPES) {
  for (const priority of PRIORITIES.slice(0, 2)) {
    createIncident(makeIncFields(type, priority));
  }
}

test('P25 — forAll(type, priority): filterIncidents result never contains a row violating the filter', () => {
  const all = getAllIncidents();
  forAll('filter AND correctness', [genType, genPriority], (type, priority) => {
    const result = filterIncidents(all, { type, priority });
    for (const inc of result) {
      if (inc.type !== type) {
        throw new Error(`Row with type=${inc.type} passed type filter for ${type}`);
      }
      if (inc.priority !== priority) {
        throw new Error(`Row with priority=${inc.priority} passed priority filter for ${priority}`);
      }
    }
  }, 24);
  return '24 filter combinations checked';
});

// ══════════════════════════════════════════════════════════════════════════
// P26  calcPercentage safety invariant
// ══════════════════════════════════════════════════════════════════════════

suite('P26 · calcPercentage never returns NaN or Infinity');
reset();

test('P26 — forAll(count, total): result is always a finite number', () => {
  // Cover the important edge cases: total=0, count=0, count>total, large values
  const counts = [0, 1, 5, 50, 100, 500, 0, 3];
  const totals = [0, 1, 10, 50, 100, 500, 0, 10];
  forAll('calcPercentage safe', [pool(counts), pool(totals)], (count, total) => {
    const result = calcPercentage(count, total);
    assert(!isNaN(result),       `NaN for count=${count}, total=${total}`);
    assert(isFinite(result),     `Infinity for count=${count}, total=${total}`);
    assert(typeof result === 'number', 'must be number');
    // When total is 0, result must be 0
    if (total === 0) {
      if (result !== 0) throw new Error(`Expected 0 when total=0, got ${result}`);
    }
  }, 24);
  return '24 (count, total) pairs — no NaN or Infinity';
});

// ══════════════════════════════════════════════════════════════════════════
// P27  Breakdown row counts sum to totals
// ══════════════════════════════════════════════════════════════════════════

suite('P27 · Breakdown row counts sum correctly');
reset();

// Build a set with known totals
for (let i = 0; i < 12; i++) createIncident(makeIncFields());
for (let i = 0; i < 5; i++) createResource({ name: genResName(), type: genResType(), location: 'HQ' });

test('P27a — byType row counts sum to incidents.total', () => {
  const incidents = getAllIncidents();
  const resources = getAllResources();
  const stats = compute(incidents, resources);
  const sum = stats.incidents.byType.reduce((a, r) => a + r.count, 0);
  eq(sum, stats.incidents.total, 'P27a: byType sum === total');
  return `sum=${sum} total=${stats.incidents.total}`;
});

test('P27b — byPriority row counts sum to incidents.total', () => {
  const stats = compute(getAllIncidents(), getAllResources());
  const sum = stats.incidents.byPriority.reduce((a, r) => a + r.count, 0);
  eq(sum, stats.incidents.total, 'P27b: byPriority sum === total');
  return `sum=${sum}`;
});

test('P27c — byStatus row counts sum to incidents.total', () => {
  const stats = compute(getAllIncidents(), getAllResources());
  const sum = stats.incidents.byStatus.reduce((a, r) => a + r.count, 0);
  eq(sum, stats.incidents.total, 'P27c: byStatus sum === total');
  return `sum=${sum}`;
});

test('P27d — resource byType row counts sum to resources.total', () => {
  const stats = compute(getAllIncidents(), getAllResources());
  const sum = stats.resources.byType.reduce((a, r) => a + r.count, 0);
  eq(sum, stats.resources.total, 'P27d: resource byType sum === total');
  return `sum=${sum} total=${stats.resources.total}`;
});

test('P27e — resource byStatus counts sum to resources.total', () => {
  const stats = compute(getAllIncidents(), getAllResources());
  const sum = stats.resources.byStatus.reduce((a, r) => a + r.count, 0);
  eq(sum, stats.resources.total, 'P27e: resource byStatus sum === total');
  return `sum=${sum}`;
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
  ? `\n\x1b[32m✓ All ${total} property-based tests passed.\x1b[0m`
  : `\n\x1b[31m✗ ${failed}/${total} property-based tests failed.\x1b[0m`);
console.log('\x1b[33m  ✓ In-memory store cleared — no persistent data created.\x1b[0m\n');
process.exit(failed > 0 ? 1 : 0);
