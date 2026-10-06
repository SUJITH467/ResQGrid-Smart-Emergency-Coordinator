/**
 * test-phase3-real.mjs
 * --------------------
 * Runs full test suite directly against actual ES modules in assets/js/
 */

// ── Setup Browser / Storage Environment ──────────────────────────────────
const _store = new Map();
globalThis.localStorage = {
  getItem:    (k)    => _store.has(k) ? _store.get(k) : null,
  setItem:    (k, v) => { _store.set(k, String(v)); },
  removeItem: (k)    => { _store.delete(k); },
  clear:      ()     => { _store.clear(); },
};
globalThis.window = globalThis;

async function main() {
  const {
    createResource,
    getAllResources,
    getResourceById,
    getAvailableResourcesByType,
    updateResource,
    deleteResource,
    assignResource,
    releaseResource,
    setMaintenance,
    clearMaintenance,
    repairOrphans,
    searchResources,
    filterResources,
    sortResources,
  } = await import('../assets/js/services/resourceService.js');

  const {
    createIncident,
    getAllIncidents,
    getIncidentById,
    updateIncidentStatus,
    registerReleaseHook,
  } = await import('../assets/js/services/incidentService.js');

  const { STORAGE_KEYS } = await import('../assets/js/store.js');

  registerReleaseHook(releaseResource);

  const G='\x1b[32m', R='\x1b[1m\x1b[31m', C='\x1b[36m', X='\x1b[0m', D='\x1b[2m';
  let passed=0, failed=0, suite='', failures=[];
  function s(name){ suite=name; console.log(`\n${C}${name}${X}`); }
  function t(label, fn){ try{ const d=fn(); passed++; console.log(`  ${G}✓${X} ${label}${d?` ${D}— ${d}${X}`:''}`); }catch(err){ failed++; failures.push({suite,label,msg:err.message}); console.log(`  ${R}✗ FAIL${X} ${label}\n    ${err.message}`); } }
  function assert(c,m){ if(!c)throw new Error(m||'Assertion failed'); }
  function eq(a,b,m){ if(a!==b)throw new Error(`${m}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }
  function reset(){ localStorage.clear(); }

  // ══════════════════════════════════════════════════════════════════════════
  s('1 · Resource creation & validation');
  reset();
  let rid1 = null;

  t('Create valid resource returns success', () => {
    const r = createResource({ name: 'Ambulance Unit 1', type: 'Ambulance', location: 'Main Gate' });
    assert(r.success, `success=false: ${JSON.stringify(r)}`);
    assert(r.resource, 'No resource in result');
    rid1 = r.resource.id;
    return `Created ${rid1}`;
  });

  t('Generated ID matches RES-NNNN', () => {
    assert(/^RES-\d{4}$/.test(rid1), `ID format wrong: ${rid1}`);
    return `id="${rid1}"`;
  });

  t('Initial status is Available', () => {
    eq(getResourceById(rid1).status, 'Available', 'status');
    return 'status=Available';
  });

  t('Initial assignedTo is null', () => {
    eq(getResourceById(rid1).assignedTo, null, 'assignedTo');
    return 'assignedTo=null';
  });

  t('addedAt is valid ISO string', () => {
    const r = getResourceById(rid1);
    assert(!isNaN(Date.parse(r.addedAt)), `addedAt invalid: ${r.addedAt}`);
    return `addedAt="${r.addedAt}"`;
  });

  t('Persisted in localStorage', () => {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESOURCES));
    assert(raw.some(r=>r.id===rid1), `${rid1} not in store`);
    return `Found in store — ${raw.length} record(s)`;
  });

  t('Duplicate name rejected', () => {
    const r = createResource({ name: 'Ambulance Unit 1', type: 'Ambulance', location: 'Gate' });
    assert(!r.success, 'Expected failure for duplicate name');
    return `Rejected: ${JSON.stringify(r.errors)}`;
  });

  t('Missing required fields rejected', () => {
    const r = createResource({ name: '', type: '', location: '' });
    assert(!r.success, 'Expected failure');
    assert('name' in r.errors && 'type' in r.errors && 'location' in r.errors, 'Missing errors');
    return `Errors: ${Object.keys(r.errors).join(', ')}`;
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('2 · Resource retrieval');

  t('getAllResources returns array with created resource', () => {
    const all = getAllResources();
    assert(Array.isArray(all), 'Not array');
    assert(all.some(r=>r.id===rid1), `${rid1} not found`);
    return `${all.length} resource(s)`;
  });

  t('getResourceById returns correct resource', () => {
    const r = getResourceById(rid1);
    assert(r && r.id === rid1, `Expected ${rid1}`);
    return `Retrieved ${r.id}`;
  });

  t('getResourceById returns null for unknown', () => {
    eq(getResourceById('RES-9999'), null, 'Should be null');
    return 'null for unknown';
  });

  t('getAvailableResourcesByType returns only Available of that type', () => {
    const avail = getAvailableResourcesByType('Ambulance');
    assert(avail.length === 1 && avail[0].id === rid1, `Expected 1 Ambulance`);
    return `1 Ambulance found`;
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('3 · Resource editing & deletion restrictions');

  t('Update resource name, type, location', () => {
    const r = updateResource(rid1, { name: 'Ambulance Unit 1 — Updated', location: 'South Gate' });
    assert(r.success, `Failed: ${r.error}`);
    eq(getResourceById(rid1).location, 'South Gate', 'location after update');
    return `Updated ${rid1}`;
  });

  t('Edit preserves own name (uniqueness excludes self)', () => {
    const r = updateResource(rid1, { name: 'Ambulance Unit 1 — Updated' });
    assert(r.success, `Should allow keeping own name: ${JSON.stringify(r)}`);
    return 'Own name allowed on edit';
  });

  t('Delete Available resource succeeds', () => {
    const r2 = createResource({ name: 'Delete me', type: 'Other', location: 'Temp' });
    const del = deleteResource(r2.resource.id);
    assert(del.success, `Failed: ${del.error}`);
    eq(getResourceById(r2.resource.id), null, 'Should be gone');
    return `Deleted ${r2.resource.id}`;
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('4 · Maintenance restrictions');

  t('Set Available → Maintenance succeeds', () => {
    const r = setMaintenance(rid1);
    assert(r.success, `Failed: ${r.error}`);
    eq(getResourceById(rid1).status, 'Maintenance', 'status');
    return 'Available → Maintenance OK';
  });

  t('Cannot assign a Maintenance resource', () => {
    const inc = createIncident({ title: 'Test incident A', description: 'Testing assignment block.', type: 'Fire', priority: 'High', location: 'Block A', reportedBy: 'Test' });
    const a = assignResource(rid1, inc.incident.id);
    assert(!a.success, 'Expected failure for Maintenance resource');
    // Clean up
    updateIncidentStatus(inc.incident.id, 'Active');
    updateIncidentStatus(inc.incident.id, 'In Progress');
    updateIncidentStatus(inc.incident.id, 'Resolved');
    return `Blocked: "${a.error}"`;
  });

  t('Clear Maintenance → Available succeeds', () => {
    const r = clearMaintenance(rid1);
    assert(r.success, `Failed: ${r.error}`);
    eq(getResourceById(rid1).status, 'Available', 'status');
    return 'Maintenance → Available OK';
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('5 · Resource assignment & preventing double assignment & release');
  reset();

  const resR = createResource({ name: 'Fire Truck 1', type: 'Fire Truck', location: 'Station A' });
  const resId = resR.resource.id;
  const incR  = createIncident({ title: 'Fire in lab', description: 'Thick smoke observed in chemistry lab.', type: 'Fire', priority: 'High', location: 'Building A', reportedBy: 'Test' });
  updateIncidentStatus(incR.incident.id, 'Active');
  const incId = incR.incident.id;

  t('Assign Available resource to active incident succeeds', () => {
    const r = assignResource(resId, incId);
    assert(r.success, `Failed: ${r.error}`);
    eq(getResourceById(resId).status, 'Deployed', 'resource status');
    eq(getResourceById(resId).assignedTo, incId, 'assignedTo');
    assert(getIncidentById(incId).assignedResources.includes(resId), 'incident missing resource ID');
    return `Assigned ${resId} → ${incId}`;
  });

  t('Assigning Deployed resource to another incident fails (preventing double assignment)', () => {
    const inc2 = createIncident({ title: 'Second incident ok', description: 'Another test incident here.', type: 'Medical', priority: 'Low', location: 'Cafeteria', reportedBy: 'Test' });
    updateIncidentStatus(inc2.incident.id, 'Active');
    const r = assignResource(resId, inc2.incident.id);
    assert(!r.success, 'Expected failure for already-Deployed resource');
    // Clean up
    updateIncidentStatus(inc2.incident.id, 'In Progress');
    updateIncidentStatus(inc2.incident.id, 'Resolved');
    return `Blocked: "${r.error}"`;
  });

  t('Cannot set Deployed resource to Maintenance (must release first)', () => {
    const r = setMaintenance(resId);
    assert(!r.success, 'Expected failure');
    return `Blocked: "${r.error}"`;
  });

  t('Cannot delete a Deployed resource', () => {
    const r = deleteResource(resId);
    assert(!r.success, 'Expected failure');
    return `Blocked: "${r.error}"`;
  });

  t('Manual release sets resource to Available, clears incident', () => {
    const r = releaseResource(resId);
    assert(r.success, `Failed: ${r.error}`);
    eq(getResourceById(resId).status, 'Available', 'resource status after release');
    eq(getResourceById(resId).assignedTo, null, 'assignedTo after release');
    assert(!getIncidentById(incId).assignedResources.includes(resId), 'incident still has resource ID');
    return `Released ${resId}`;
  });

  t('Release idempotent — already Available returns success', () => {
    const r = releaseResource(resId);
    assert(r.success, 'Expected success for idempotent release');
    return 'Idempotent release OK';
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('6 · Automatic resource release when incident is resolved');

  t('Assign resource again for resolution test', () => {
    const r = assignResource(resId, incId);
    assert(r.success, `Failed: ${r.error}`);
    eq(getResourceById(resId).status, 'Deployed', 'should be Deployed');
    return `Re-assigned ${resId} → ${incId}`;
  });

  t('Resolving incident auto-releases assigned resources', () => {
    updateIncidentStatus(incId, 'In Progress');
    const r = updateIncidentStatus(incId, 'Resolved');
    assert(r.success, `Resolve failed: ${r.error}`);
    eq(getResourceById(resId).status, 'Available', 'resource should be Available after resolve');
    eq(getResourceById(resId).assignedTo, null, 'assignedTo should be null after resolve');
    eq(getIncidentById(incId).assignedResources.length, 0, 'incident assignedResources should be empty');
    return `Auto-released ${resId} when ${incId} resolved`;
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('7 · Orphan repair');

  t('Orphan: resource pointing to non-existent incident is repaired', () => {
    const res = getAllResources();
    res.push({ id: 'RES-ORPH', name: 'Orphan', type: 'Other', status: 'Deployed', location: 'X', assignedTo: 'INC-9999', addedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(res));

    repairOrphans();

    const orphan = getResourceById('RES-ORPH');
    eq(orphan.status, 'Available', 'orphan should be Available after repair');
    eq(orphan.assignedTo, null, 'orphan assignedTo should be null after repair');

    // Clean up
    const cleaned = getAllResources().filter(r => r.id !== 'RES-ORPH');
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(cleaned));
    return 'Orphan repaired correctly';
  });

  // ══════════════════════════════════════════════════════════════════════════
  s('8 · Search, filter, sort');
  reset();

  localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify([
    { id:'RES-0101', name:'Ambulance Alpha', type:'Ambulance',  status:'Available',   location:'North Gate', assignedTo:null, addedAt:'2024-03-01T08:00:00.000Z' },
    { id:'RES-0102', name:'Fire Truck Beta', type:'Fire Truck', status:'Deployed',    location:'Station B',  assignedTo:'INC-0001', addedAt:'2024-03-01T09:00:00.000Z' },
    { id:'RES-0103', name:'Police Unit Gamma',type:'Police Unit',status:'Maintenance',location:'HQ',        assignedTo:null, addedAt:'2024-03-01T07:00:00.000Z' },
  ]));

  t('Search by name "alpha" finds 1 result', () => {
    const r = searchResources(getAllResources(), 'alpha');
    assert(r.length===1 && r[0].id==='RES-0101', `Expected RES-0101, got ${r.map(x=>x.id)}`);
    return '"alpha" → RES-0101';
  });

  t('Search by location "station" finds 1 result', () => {
    const r = searchResources(getAllResources(), 'station');
    assert(r.length===1 && r[0].id==='RES-0102', `Expected RES-0102`);
    return '"station" → RES-0102';
  });

  t('Filter by status=Available returns 1', () => {
    const r = filterResources(getAllResources(), { status: 'Available' });
    assert(r.length===1 && r[0].id==='RES-0101', `Expected RES-0101`);
    return 'status=Available → 1';
  });

  t('Filter by type=Ambulance returns 1', () => {
    const r = filterResources(getAllResources(), { type: 'Ambulance' });
    assert(r.length===1 && r[0].id==='RES-0101', `Expected RES-0101`);
    return 'type=Ambulance → 1';
  });

  t('Filter type+status AND logic — no match returns []', () => {
    const r = filterResources(getAllResources(), { type: 'Ambulance', status: 'Deployed' });
    eq(r.length, 0, 'AND logic should return 0');
    return 'type=Ambulance AND status=Deployed → []';
  });

  t('Sort by date asc — oldest first (RES-0103)', () => {
    const r = sortResources(getAllResources(), 'date', 'asc');
    eq(r[0].id, 'RES-0103', `Expected RES-0103 first (oldest)`);
    return `date asc: ${r.map(x=>x.id).join(', ')}`;
  });

  t('Sort by name asc — alphabetical', () => {
    const r = sortResources(getAllResources(), 'name', 'asc');
    eq(r[0].name, 'Ambulance Alpha', `Expected Ambulance Alpha first`);
    return `name asc: ${r.map(x=>x.name).join(', ')}`;
  });

  t('Empty search query returns all', () => {
    const r = searchResources(getAllResources(), '');
    eq(r.length, 3, 'Expected 3');
    return '3 results for empty query';
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  localStorage.clear();

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(60));
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${total}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  ✗ [${f.suite}] ${f.label}\n    ${f.msg}`));
  }
  console.log(failed === 0 ? `\n\x1b[32m✓ All ${total} real module tests passed.\x1b[0m` : `\n\x1b[31m✗ ${failed}/${total} real module tests failed.\x1b[0m`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
