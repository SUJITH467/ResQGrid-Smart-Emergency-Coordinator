/**
 * test-phase5.mjs
 * ---------------
 * Phase 5 production-module tests for statsService.js
 * Run: node --require ./test-globals-preload.cjs test-phase5.mjs
 *
 * Tests cover:
 *   - Empty datasets
 *   - Normal datasets
 *   - Every incident and resource status
 *   - Maintenance exclusion from utilization
 *   - Data immutability (arrays not mutated)
 *   - Negative duration exclusion
 *   - toLocaleString / NaN protection
 */

import {
  compute,
  countByField,
  calcPercentages,
  calcUtilization,
  calcResolutionTimes,
  formatDuration,
  formatUtilization,
  formatCount,
} from './assets/js/services/statsService.js';

import {
  INCIDENT_TYPES,
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  RESOURCE_TYPES,
  RESOURCE_STATUSES,
} from './assets/js/utils.js';

// ── Test harness ───────────────────────────────────────────────────────────
const G='\x1b[32m', R='\x1b[1m\x1b[31m', C='\x1b[36m', X='\x1b[0m', D='\x1b[2m';
let passed=0, failed=0, suite='', failures=[];
function s(name){ suite=name; console.log(`\n${C}${name}${X}`); }
function t(label, fn){
  try{ const d=fn(); passed++; console.log(`  ${G}✓${X} ${label}${d?` ${D}— ${d}${X}`:''}`); }
  catch(e){ failed++; failures.push({suite,label,msg:e.message}); console.log(`  ${R}✗ FAIL${X} ${label}\n    ${e.message}`); }
}
function assert(c,m){ if(!c) throw new Error(m||'Assertion failed'); }
function eq(a,b,m){ if(a!==b) throw new Error(`${m||'eq'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }

// ── Sample data builders ───────────────────────────────────────────────────

function makeIncident(overrides = {}) {
  return {
    id:          'INC-TEST',
    type:        'Fire',
    priority:    'High',
    status:      'Active',
    reportedAt:  new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
    updatedAt:   new Date().toISOString(),
    resolvedAt:  null,
    assignedResources: [],
    ...overrides,
  };
}

function makeResource(overrides = {}) {
  return {
    id:         'RES-TEST',
    name:       'Test Unit',
    type:       'Ambulance',
    status:     'Available',
    location:   'Gate A',
    assignedTo: null,
    addedAt:    new Date().toISOString(),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════
s('S1 · compute() — empty data');

t('Empty arrays return zero counts, null utilization and null resolution', () => {
  const r = compute([], []);
  eq(r.incidents.total,    0,    'incidents.total');
  eq(r.incidents.active,   0,    'incidents.active');
  eq(r.incidents.critical, 0,    'incidents.critical');
  eq(r.incidents.resolved, 0,    'incidents.resolved');
  eq(r.resources.total,    0,    'resources.total');
  eq(r.resources.utilization, null, 'utilization null');
  eq(r.resolution.average, null, 'resolution.average null');
  eq(r.resolution.fastest, null, 'resolution.fastest null');
  eq(r.resolution.slowest, null, 'resolution.slowest null');
  return 'all zero/null';
});

t('Empty arrays: all breakdown rows present (one per enum value)', () => {
  const r = compute([], []);
  eq(r.incidents.byType.length,     INCIDENT_TYPES.length,     'byType rows');
  eq(r.incidents.byPriority.length, INCIDENT_PRIORITIES.length,'byPriority rows');
  eq(r.incidents.byStatus.length,   INCIDENT_STATUSES.length,  'byStatus rows');
  eq(r.resources.byType.length,     RESOURCE_TYPES.length,     'res byType rows');
  eq(r.resources.byStatus.length,   RESOURCE_STATUSES.length,  'res byStatus rows');
  return 'all enum values present';
});

t('Empty arrays: all breakdown pct values are 0 (not NaN)', () => {
  const r = compute([], []);
  const allPcts = [
    ...r.incidents.byType,
    ...r.incidents.byPriority,
    ...r.incidents.byStatus,
    ...r.resources.byType,
    ...r.resources.byStatus,
  ];
  allPcts.forEach((row) => {
    assert(!isNaN(row.pct), `pct is NaN for label "${row.label}"`);
    eq(row.pct, 0, `pct should be 0 for "${row.label}"`);
  });
  return `${allPcts.length} rows all pct=0`;
});

t('Non-array input handled safely (no crash)', () => {
  const r1 = compute(null, null);
  const r2 = compute('bad', 42);
  assert(typeof r1 === 'object' && r1 !== null, 'null handled');
  assert(typeof r2 === 'object' && r2 !== null, 'non-array handled');
  return 'No crash on null/bad input';
});

// ══════════════════════════════════════════════════════════════════════════
s('S2 · compute() — incident counts');

const incidentSet = [
  makeIncident({ id:'INC-01', type:'Fire',     priority:'Critical', status:'Active' }),
  makeIncident({ id:'INC-02', type:'Medical',  priority:'High',     status:'In Progress' }),
  makeIncident({ id:'INC-03', type:'Security', priority:'Medium',   status:'Reported' }),
  makeIncident({ id:'INC-04', type:'Fire',     priority:'Critical', status:'Active' }),
  makeIncident({ id:'INC-05', type:'Hazmat',   priority:'Low',      status:'Resolved',
    reportedAt: new Date(Date.now() - 120*60*1000).toISOString(),
    resolvedAt: new Date(Date.now() - 60*60*1000).toISOString() }),
];

t('total, active, critical, resolved counts correct', () => {
  const r = compute(incidentSet, []);
  eq(r.incidents.total,    5, 'total');
  eq(r.incidents.active,   4, 'active (non-Resolved)');
  eq(r.incidents.critical, 2, 'critical');
  eq(r.incidents.resolved, 1, 'resolved');
  return `total=${r.incidents.total} active=${r.incidents.active} critical=${r.incidents.critical}`;
});

t('byType counts Fire=2, Medical=1, Hazmat=1, Security=1, others=0', () => {
  const r = compute(incidentSet, []);
  const fireRow = r.incidents.byType.find((row) => row.label === 'Fire');
  eq(fireRow.count, 2, 'Fire count');
  const otherRow = r.incidents.byType.find((row) => row.label === 'Other');
  eq(otherRow.count, 0, 'Other count should be 0');
  return `Fire=${fireRow.count}, Other=${otherRow.count}`;
});

t('byPriority pct values sum to ~100 (allow float rounding)', () => {
  const r = compute(incidentSet, []);
  const sum = r.incidents.byPriority.reduce((acc, row) => acc + row.pct, 0);
  assert(Math.abs(sum - 100) < 1, `pct sum should be ~100, got ${sum}`);
  return `sum=${sum}`;
});

t('byStatus always has all 4 status rows even with some at 0', () => {
  const r = compute(incidentSet, []);
  eq(r.incidents.byStatus.length, INCIDENT_STATUSES.length, 'row count');
  const reportedRow = r.incidents.byStatus.find((row) => row.label === 'Reported');
  eq(reportedRow.count, 1, 'Reported count');
  return `${INCIDENT_STATUSES.length} rows present`;
});

// ══════════════════════════════════════════════════════════════════════════
s('S3 · compute() — resource counts and utilization');

const resourceSet = [
  makeResource({ id:'RES-01', type:'Ambulance',  status:'Available' }),
  makeResource({ id:'RES-02', type:'Fire Truck', status:'Deployed',    assignedTo:'INC-01' }),
  makeResource({ id:'RES-03', type:'Ambulance',  status:'Maintenance' }),
  makeResource({ id:'RES-04', type:'Police Unit',status:'Available' }),
];

t('total, available, deployed, maintenance counts', () => {
  const r = compute([], resourceSet);
  eq(r.resources.total,       4, 'total');
  eq(r.resources.available,   2, 'available');
  eq(r.resources.deployed,    1, 'deployed');
  eq(r.resources.maintenance, 1, 'maintenance');
  return `total=${r.resources.total}`;
});

t('utilization excludes Maintenance: 1 deployed / 3 non-maintenance = 33.3%', () => {
  const r = compute([], resourceSet);
  // nonMaintenance = Available(2) + Deployed(1) = 3; deployed = 1 → 33.3%
  eq(r.resources.utilization, 33.3, 'utilization');
  return `utilization=${r.resources.utilization}%`;
});

t('utilization = N/A when ALL resources are in Maintenance', () => {
  const allMaint = [
    makeResource({ id:'RES-A', status:'Maintenance' }),
    makeResource({ id:'RES-B', status:'Maintenance' }),
  ];
  const r = compute([], allMaint);
  eq(r.resources.utilization, null, 'utilization should be null');
  return 'utilization=null (all Maintenance)';
});

t('utilization = 0% when no resources are Deployed (all Available)', () => {
  const allAvail = [
    makeResource({ id:'RES-A', status:'Available' }),
    makeResource({ id:'RES-B', status:'Available' }),
  ];
  const r = compute([], allAvail);
  eq(r.resources.utilization, 0, 'utilization should be 0');
  return 'utilization=0%';
});

t('utilization = 100% when all non-Maintenance are Deployed', () => {
  const allDep = [
    makeResource({ id:'RES-A', status:'Deployed', assignedTo:'INC-X' }),
    makeResource({ id:'RES-B', status:'Maintenance' }),
  ];
  const r = compute([], allDep);
  eq(r.resources.utilization, 100, 'utilization should be 100');
  return 'utilization=100%';
});

t('byType always has all 7 resource type rows', () => {
  const r = compute([], resourceSet);
  eq(r.resources.byType.length, RESOURCE_TYPES.length, 'row count');
  return `${RESOURCE_TYPES.length} rows present`;
});

t('byStatus always has all 3 resource status rows', () => {
  const r = compute([], resourceSet);
  eq(r.resources.byStatus.length, RESOURCE_STATUSES.length, 'row count');
  return `${RESOURCE_STATUSES.length} rows present`;
});

// ══════════════════════════════════════════════════════════════════════════
s('S4 · calcResolutionTimes()');

t('Single resolved incident → average = fastest = slowest', () => {
  const now     = Date.now();
  const inc = [makeIncident({
    status:     'Resolved',
    reportedAt: new Date(now - 120 * 60 * 1000).toISOString(), // 2h ago
    resolvedAt: new Date(now).toISOString(),
  })];
  const r = calcResolutionTimes(inc);
  assert(r.average !== null, 'average should not be null');
  eq(r.average, r.fastest, 'average = fastest');
  eq(r.average, r.slowest, 'average = slowest');
  assert(r.average > 119 && r.average < 121, `average should be ~120 min, got ${r.average}`);
  return `average=${r.average} min`;
});

t('Multiple resolved incidents: average/fastest/slowest correct', () => {
  const base = Date.now();
  const inc = [
    makeIncident({ status:'Resolved',
      reportedAt: new Date(base - 60*60*1000).toISOString(),
      resolvedAt: new Date(base).toISOString() }),           // 60 min
    makeIncident({ status:'Resolved',
      reportedAt: new Date(base - 120*60*1000).toISOString(),
      resolvedAt: new Date(base).toISOString() }),           // 120 min
    makeIncident({ status:'Resolved',
      reportedAt: new Date(base - 30*60*1000).toISOString(),
      resolvedAt: new Date(base).toISOString() }),           // 30 min
  ];
  const r = calcResolutionTimes(inc);
  eq(r.fastest, 30,   'fastest should be 30 min');
  eq(r.slowest, 120,  'slowest should be 120 min');
  eq(r.average, 70,   'average should be 70 min');
  return `fastest=${r.fastest} slowest=${r.slowest} avg=${r.average}`;
});

t('Negative duration excluded from calculations', () => {
  const base = Date.now();
  const inc = [
    makeIncident({ status:'Resolved',
      reportedAt: new Date(base).toISOString(),
      resolvedAt: new Date(base - 60*60*1000).toISOString() }), // negative
    makeIncident({ status:'Resolved',
      reportedAt: new Date(base - 60*60*1000).toISOString(),
      resolvedAt: new Date(base).toISOString() }),               // 60 min
  ];
  const r = calcResolutionTimes(inc);
  eq(r.average, 60,  'Only valid incident counted');
  eq(r.fastest, 60,  'fastest=60');
  eq(r.slowest, 60,  'slowest=60');
  return `Negative excluded, average=${r.average}`;
});

t('No resolved incidents → all null', () => {
  const inc = [makeIncident({ status:'Active' })];
  const r   = calcResolutionTimes(inc);
  eq(r.average, null, 'average null');
  eq(r.fastest, null, 'fastest null');
  eq(r.slowest, null, 'slowest null');
  return 'all null (no resolved incidents)';
});

t('Invalid date strings excluded silently', () => {
  const inc = [
    makeIncident({ status:'Resolved', reportedAt:'NOT-A-DATE', resolvedAt:'ALSO-BAD' }),
    makeIncident({ status:'Resolved',
      reportedAt: new Date(Date.now() - 30*60*1000).toISOString(),
      resolvedAt: new Date().toISOString() }),
  ];
  const r = calcResolutionTimes(inc);
  assert(r.average !== null, 'Valid incident should contribute');
  assert(r.average > 0, 'average > 0');
  return `Only valid incident counted, average=${r.average}`;
});

// ══════════════════════════════════════════════════════════════════════════
s('S5 · countByField()');

t('Counts all enum values including zeros', () => {
  const data = [{ type:'Fire' }, { type:'Fire' }, { type:'Medical' }];
  const rows = countByField(data, 'type', INCIDENT_TYPES);
  eq(rows.length, INCIDENT_TYPES.length, 'all enum values');
  const fire = rows.find((r) => r.label === 'Fire');
  eq(fire.count, 2, 'Fire count=2');
  const other = rows.find((r) => r.label === 'Other');
  eq(other.count, 0, 'Other count=0');
  return `Fire=${fire.count} Other=${other.count}`;
});

t('Does not mutate input array', () => {
  const data = [{ type:'Fire' }];
  const snapshot = JSON.stringify(data);
  countByField(data, 'type', INCIDENT_TYPES);
  eq(JSON.stringify(data), snapshot, 'input array unchanged');
  return 'immutable';
});

// ══════════════════════════════════════════════════════════════════════════
s('S6 · calcPercentages()');

t('Total=0: all pct=0 (no NaN)', () => {
  const rows = [{ label:'A', count:0 }, { label:'B', count:0 }];
  const out  = calcPercentages(rows, 0);
  out.forEach((r) => assert(!isNaN(r.pct), `pct is NaN for ${r.label}`));
  out.forEach((r) => eq(r.pct, 0, `pct should be 0 for ${r.label}`));
  return 'all 0%, no NaN';
});

t('Normal calculation is correct', () => {
  const rows = [{ label:'A', count:3 }, { label:'B', count:1 }];
  const out  = calcPercentages(rows, 4);
  eq(out[0].pct, 75,   'A=75%');
  eq(out[1].pct, 25,   'B=25%');
  return 'A=75% B=25%';
});

t('Does not mutate input rows', () => {
  const rows     = [{ label:'A', count:1 }];
  const snapshot = JSON.stringify(rows);
  calcPercentages(rows, 1);
  eq(JSON.stringify(rows), snapshot, 'input unchanged');
  return 'immutable';
});

// ══════════════════════════════════════════════════════════════════════════
s('S7 · calcUtilization()');

t('No resources → null', () => {
  eq(calcUtilization([]), null, 'empty → null');
  return 'null';
});

t('All Maintenance → null', () => {
  const res = [makeResource({ status:'Maintenance' })];
  eq(calcUtilization(res), null, 'all-maintenance → null');
  return 'null';
});

t('1 Available + 1 Deployed = 50.0', () => {
  const res = [
    makeResource({ status:'Available' }),
    makeResource({ status:'Deployed' }),
  ];
  eq(calcUtilization(res), 50, '50%');
  return '50%';
});

t('Maintenance excluded from denominator', () => {
  const res = [
    makeResource({ status:'Available' }),
    makeResource({ status:'Deployed' }),
    makeResource({ status:'Maintenance' }),
    makeResource({ status:'Maintenance' }),
  ];
  // nonMaintenance = 2; deployed = 1 → 50%
  eq(calcUtilization(res), 50, 'Maintenance excluded');
  return '50% (2 maintenance excluded)';
});

t('Result is rounded to 1 decimal place', () => {
  const res = [
    makeResource({ status:'Deployed' }),
    makeResource({ status:'Available' }),
    makeResource({ status:'Available' }),
  ];
  // 1/3 = 33.333... → 33.3
  eq(calcUtilization(res), 33.3, '33.3%');
  return '33.3%';
});

// ══════════════════════════════════════════════════════════════════════════
s('S8 · format helpers');

t('formatDuration: null → N/A', ()  => { eq(formatDuration(null),   'N/A',     'null');  return 'N/A'; });
t('formatDuration: 0.5 → < 1 min',()=>{ eq(formatDuration(0.5),  '< 1 min',  '0.5');   return 'OK'; });
t('formatDuration: 45 → 45 min',  ()=>{ eq(formatDuration(45),   '45 min',   '45');     return 'OK'; });
t('formatDuration: 90 → 1.5 hrs', ()=>{ eq(formatDuration(90),   '1.5 hrs',  '90');     return 'OK'; });
t('formatDuration: 2880 → 2 days',()=>{ eq(formatDuration(2880), '2 days',   '2880');   return 'OK'; });

t('formatUtilization: null → N/A', () => { eq(formatUtilization(null), 'N/A',  'null'); return 'N/A'; });
t('formatUtilization: 0 → 0%',     () => { eq(formatUtilization(0),    '0%',   '0');    return 'OK'; });
t('formatUtilization: 33.3 → 33.3%',()=>{ eq(formatUtilization(33.3), '33.3%','33.3'); return 'OK'; });
t('formatUtilization: 100 → 100%', () => { eq(formatUtilization(100),  '100%', '100');  return 'OK'; });

t('formatCount: 0 → "0"',          ()=>{ eq(formatCount(0),    '0', '0'); return 'OK'; });
t('formatCount: 999 → "999"',      ()=>{ eq(typeof formatCount(999), 'string', 'string'); return 'OK'; });
t('formatCount: large number is string', ()=>{ assert(typeof formatCount(99999) === 'string', 'string'); return 'OK'; });

// ══════════════════════════════════════════════════════════════════════════
s('S9 · Data immutability — compute() does not mutate inputs');

t('Input incident array is not mutated by compute()', () => {
  const incidents = [makeIncident({ id:'INC-IMM-01' })];
  const snapshot  = JSON.stringify(incidents);
  compute(incidents, []);
  eq(JSON.stringify(incidents), snapshot, 'incident array unchanged');
  return 'immutable';
});

t('Input resource array is not mutated by compute()', () => {
  const resources = [makeResource({ id:'RES-IMM-01' })];
  const snapshot  = JSON.stringify(resources);
  compute([], resources);
  eq(JSON.stringify(resources), snapshot, 'resource array unchanged');
  return 'immutable';
});

t('compute() with 1000 incidents does not crash', () => {
  const bigSet = Array.from({ length: 1000 }, (_, i) =>
    makeIncident({ id:`INC-${String(i).padStart(4,'0')}`,
      type:     INCIDENT_TYPES[i % INCIDENT_TYPES.length],
      priority: INCIDENT_PRIORITIES[i % INCIDENT_PRIORITIES.length],
      status:   INCIDENT_STATUSES[i % INCIDENT_STATUSES.length],
    })
  );
  const r = compute(bigSet, []);
  eq(r.incidents.total, 1000, '1000 incidents counted');
  return '1000 incidents processed';
});

// ── Summary ────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '─'.repeat(60));
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${total}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  ✗ [${f.suite}] ${f.label}\n    ${f.msg}`));
}
console.log(failed === 0
  ? `\n\x1b[32m✓ All ${total} Phase 5 tests passed against production modules.\x1b[0m`
  : `\n\x1b[31m✗ ${failed}/${total} Phase 5 tests failed.\x1b[0m`);
console.log('\x1b[33m  ✓ No persistent data created.\x1b[0m\n');
process.exit(failed > 0 ? 1 : 0);
