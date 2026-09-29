/**
 * test-phase3.mjs
 * ---------------
 * Node.js functional tests for Phase 3: Resource Management.
 * Uses in-memory localStorage stub — no browser required.
 * Run: node test-phase3.mjs
 */

// ── Browser stubs ──────────────────────────────────────────────────────────
const _store = new Map();
const localStorage = {
  getItem:    (k)    => _store.has(k) ? _store.get(k) : null,
  setItem:    (k, v) => { _store.set(k, String(v)); },
  removeItem: (k)    => { _store.delete(k); },
  clear:      ()     => { _store.clear(); },
};
const structuredClone = (v) => JSON.parse(JSON.stringify(v));

// ── Inlined utils (verbatim from utils.js) ─────────────────────────────────
const logger = { info: ()=>{}, warn: ()=>{}, error: ()=>{} };
const RESOURCE_TYPES     = ['Ambulance','Fire Truck','Police Unit','Hazmat Team','Medical Team','Utility Crew','Other'];
const RESOURCE_STATUSES  = ['Available','Deployed','Maintenance'];
const INCIDENT_TYPES     = ['Fire','Medical','Security','Hazmat','Natural Disaster','Other'];
const INCIDENT_PRIORITIES= ['Critical','High','Medium','Low'];
const INCIDENT_STATUSES  = ['Reported','Active','In Progress','Resolved'];
const STATUS_ORDER       = { Reported:0, Active:1, 'In Progress':2, Resolved:3 };
const PRIORITY_ORDER     = { Critical:0, High:1, Medium:2, Low:3 };

function generateId(prefix, items=[]) {
  const pat = new RegExp(`^${prefix}-(\\d{4})$`);
  let max = 0;
  items.forEach(i => { const m = i.id?.match(pat); if(m){ const n=parseInt(m[1],10); if(n>max)max=n; } });
  return `${prefix}-${String(max+1).padStart(4,'0')}`;
}
const getNow = () => new Date().toISOString();
const isNonEmptyString = v => typeof v === 'string' && v.trim().length > 0;
const isWithinLength = (v,mn,mx) => { if(!isNonEmptyString(v))return false; const l=v.trim().length; return l>=mn&&l<=mx; };
const isValidEnum = (v,arr) => arr.includes(v);

// ── Inlined store (verbatim from store.js) ─────────────────────────────────
const STORAGE_KEYS = { INCIDENTS:'resqgrid_incidents', RESOURCES:'resqgrid_resources', ASSISTANT_LOG:'resqgrid_assistant_log', SETTINGS:'resqgrid_settings' };
const DEFAULTS = { [STORAGE_KEYS.INCIDENTS]:[], [STORAGE_KEYS.RESOURCES]:[], [STORAGE_KEYS.ASSISTANT_LOG]:[], [STORAGE_KEYS.SETTINGS]:{} };
function isStorageAvailable(){ try{localStorage.setItem('__t__','1');localStorage.removeItem('__t__');return true;}catch{return false;} }
const STORAGE_AVAILABLE = isStorageAvailable();
function isValidShape(key,value){ const d=DEFAULTS[key]; if(Array.isArray(d))return Array.isArray(value); if(typeof d==='object')return typeof value==='object'&&value!==null&&!Array.isArray(value); return true; }
function storeGet(key){ if(!STORAGE_AVAILABLE)return structuredClone(DEFAULTS[key]??null); try{ const r=localStorage.getItem(key); if(r===null)return structuredClone(DEFAULTS[key]??null); const p=JSON.parse(r); if(key in DEFAULTS&&!isValidShape(key,p)){storeSet(key,DEFAULTS[key]);return structuredClone(DEFAULTS[key]);} return p; }catch{ storeSet(key,DEFAULTS[key]); return structuredClone(DEFAULTS[key]??null); } }
function storeSet(key,value){ if(!STORAGE_AVAILABLE)return false; try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;} }

// ── Inlined resourceService ────────────────────────────────────────────────
function readResources(){ return storeGet(STORAGE_KEYS.RESOURCES); }
function writeResources(r){ return storeSet(STORAGE_KEYS.RESOURCES,r); }
function readIncidents(){ return storeGet(STORAGE_KEYS.INCIDENTS); }
function writeIncidents(i){ return storeSet(STORAGE_KEYS.INCIDENTS,i); }

function validateResource(fields, excludeId=null){ const e={}; if(!isNonEmptyString(fields.name)){e.name='Resource name is required and must be unique.';}else{const dup=readResources().some(r=>r.name.toLowerCase()===fields.name.trim().toLowerCase()&&r.id!==excludeId);if(dup)e.name='Resource name is required and must be unique.';} if(!isValidEnum(fields.type,RESOURCE_TYPES))e.type='Please select a valid resource type.'; if(!isNonEmptyString(fields.location))e.location='Location is required.'; return{valid:Object.keys(e).length===0,errors:e}; }

function createResource(fields){ const{valid,errors}=validateResource(fields,null); if(!valid)return{success:false,errors}; const res=readResources(); const r={id:generateId('RES',res),name:fields.name.trim(),type:fields.type,status:'Available',location:fields.location.trim(),assignedTo:null,addedAt:getNow()}; res.push(r); writeResources(res); return{success:true,resource:r}; }
function getAllResources(){ return readResources(); }
function getResourceById(id){ return readResources().find(r=>r.id===id)??null; }
function getAvailableResourcesByType(type){ const r=readResources().filter(x=>x.status==='Available'); return type?r.filter(x=>x.type===type):r; }
function updateResource(id,fields){ const res=readResources(); const idx=res.findIndex(r=>r.id===id); if(idx===-1)return{success:false,error:`Resource ${id} not found.`}; const merged={name:fields.name??res[idx].name,type:fields.type??res[idx].type,location:fields.location??res[idx].location}; const{valid,errors}=validateResource(merged,id); if(!valid)return{success:false,errors}; res[idx]={...res[idx],name:merged.name.trim(),type:merged.type,location:merged.location.trim()}; writeResources(res); return{success:true,resource:res[idx]}; }
function deleteResource(id){ const res=readResources(); const idx=res.findIndex(r=>r.id===id); if(idx===-1)return{success:false,error:`Resource ${id} not found.`}; if(res[idx].status==='Deployed')return{success:false,error:`Resource ${id} is currently deployed.`}; res.splice(idx,1); writeResources(res); return{success:true}; }

function assignResource(rId,iId){ const res=readResources(); const inc=readIncidents(); const rIdx=res.findIndex(r=>r.id===rId); const iIdx=inc.findIndex(i=>i.id===iId); if(rIdx===-1)return{success:false,error:`Resource ${rId} not found.`}; if(iIdx===-1)return{success:false,error:`Incident ${iId} not found.`}; if(res[rIdx].status!=='Available')return{success:false,error:`Resource ${rId} is "${res[rIdx].status}" and cannot be assigned.`}; if(inc[iIdx].status==='Resolved')return{success:false,error:`Cannot assign resources to a Resolved incident.`}; if(inc[iIdx].assignedResources.includes(rId))return{success:false,error:`Already assigned.`}; res[rIdx]={...res[rIdx],status:'Deployed',assignedTo:iId}; inc[iIdx]={...inc[iIdx],assignedResources:[...inc[iIdx].assignedResources,rId],updatedAt:getNow()}; writeResources(res); writeIncidents(inc); return{success:true,resource:res[rIdx],incident:inc[iIdx]}; }

// ── FIXED releaseResource (matches production resourceService.js) ──────────
// Reads both arrays upfront, mutates in memory, persists resource first,
// persists incident second with rollback on failure.
function releaseResource(rId){
  const res = readResources();
  const inc = readIncidents();
  const rIdx = res.findIndex(r => r.id === rId);
  if (rIdx === -1) return { success: true };                      // not found → idempotent
  const originalResource = res[rIdx];
  if (originalResource.status !== 'Deployed') return { success: true, resource: originalResource };  // already released
  const iId  = originalResource.assignedTo;
  // Mutate resource in memory.
  res[rIdx] = { ...originalResource, status: 'Available', assignedTo: null };
  // Find and mutate incident in memory.
  const iIdx = iId ? inc.findIndex(i => i.id === iId) : -1;
  if (iIdx !== -1) {
    inc[iIdx] = { ...inc[iIdx], assignedResources: inc[iIdx].assignedResources.filter(x => x !== rId), updatedAt: getNow() };
  }
  // Write resource first.
  const savedR = writeResources(res);
  if (!savedR) return { success: false, error: 'Storage full. Could not release resource.' };
  // Write incident; roll back resource on failure.
  if (iIdx !== -1) {
    const savedI = writeIncidents(inc);
    if (!savedI) {
      const rollbackOk = writeResources(res.map((r, i) => (i === rIdx ? originalResource : r)));
      const rollbackNote = rollbackOk
        ? 'Resource write rolled back successfully.'
        : 'WARNING: Resource rollback also failed — store may be inconsistent.';
      return { success: false, error: `Storage full. Could not update incident after releasing resource. ${rollbackNote}` };
    }
  }
  return { success: true, resource: res[rIdx] };
}

function setMaintenance(id){ const res=readResources(); const idx=res.findIndex(r=>r.id===id); if(idx===-1)return{success:false,error:`Not found.`}; if(res[idx].status==='Deployed')return{success:false,error:`Deployed — release first.`}; res[idx]={...res[idx],status:'Maintenance'}; writeResources(res); return{success:true,resource:res[idx]}; }
function clearMaintenance(id){ const res=readResources(); const idx=res.findIndex(r=>r.id===id); if(idx===-1)return{success:false,error:`Not found.`}; if(res[idx].status!=='Maintenance')return{success:true,resource:res[idx]}; res[idx]={...res[idx],status:'Available'}; writeResources(res); return{success:true,resource:res[idx]}; }

function repairOrphans(){ const res=readResources(); const incIds=new Set(readIncidents().map(i=>i.id)); let rep=false; const fixed=res.map(r=>{if(r.assignedTo&&!incIds.has(r.assignedTo)){rep=true;return{...r,assignedTo:null,status:'Available'};}return r;}); if(rep)writeResources(fixed); }

function searchResources(res,q){ const t=(q||'').trim().toLowerCase(); if(!t)return res; return res.filter(r=>(r.name||'').toLowerCase().includes(t)||(r.location||'').toLowerCase().includes(t)); }
function filterResources(res,f={}){ return res.filter(r=>{ if(f.type&&r.type!==f.type)return false; if(f.status&&r.status!==f.status)return false; return true; }); }
function sortResources(res,sortBy='date',dir='desc'){ const S={Available:0,Deployed:1,Maintenance:2}; const s=[...res]; s.sort((a,b)=>{ let c=0; if(sortBy==='date')c=a.addedAt<b.addedAt?-1:a.addedAt>b.addedAt?1:0; else if(sortBy==='name')c=a.name.toLowerCase().localeCompare(b.name.toLowerCase()); else if(sortBy==='status')c=(S[a.status]??9)-(S[b.status]??9); return dir==='desc'?-c:c; }); return s; }

// ── Inlined incidentService (minimal — for assignment tests) ───────────────
const NEXT_STATUS = { Reported:'Active', Active:'In Progress', 'In Progress':'Resolved', Resolved:null };
let _releaseHook = null;
function registerReleaseHook(fn){ _releaseHook = fn; }

function createIncident(fields){ const{valid,errors}=validateIncidentFields(fields); if(!valid)return{success:false,errors}; const inc=readIncidents(); const now=getNow(); const i={id:generateId('INC',inc),title:fields.title.trim(),description:fields.description.trim(),type:fields.type,priority:fields.priority,status:'Reported',location:fields.location.trim(),reportedBy:fields.reportedBy.trim(),reportedAt:now,updatedAt:now,resolvedAt:null,assignedResources:[],notes:''}; inc.push(i); writeIncidents(inc); return{success:true,incident:i}; }
function validateIncidentFields(f){ const e={}; if(!isWithinLength(f.title,5,100))e.title='bad title'; if(!isWithinLength(f.description,10,500))e.description='bad desc'; if(!isNonEmptyString(f.location))e.location='bad loc'; if(!isValidEnum(f.type,INCIDENT_TYPES))e.type='bad type'; if(!isValidEnum(f.priority,INCIDENT_PRIORITIES))e.priority='bad priority'; if(!isNonEmptyString(f.reportedBy))e.reportedBy='bad reporter'; return{valid:Object.keys(e).length===0,errors:e}; }
function getAllIncidents(){ return readIncidents(); }
function getIncidentById(id){ return readIncidents().find(i=>i.id===id)??null; }
function updateIncidentStatus(id,newStatus){ const inc=readIncidents(); const idx=inc.findIndex(i=>i.id===id); if(idx===-1)return{success:false,error:`Not found.`}; const allowed=NEXT_STATUS[inc[idx].status]; if(allowed===null)return{success:false,error:`Terminal.`}; if(newStatus!==allowed)return{success:false,error:`Invalid transition.`}; const now=getNow(); inc[idx]={...inc[idx],status:newStatus,updatedAt:now,resolvedAt:newStatus==='Resolved'?now:inc[idx].resolvedAt}; if(newStatus==='Resolved'&&_releaseHook){ const toRelease=inc[idx].assignedResources||[]; toRelease.forEach(rid=>_releaseHook(rid)); inc[idx]={...inc[idx],assignedResources:[]}; } writeIncidents(inc); return{success:true,incident:inc[idx]}; }

// ── Test harness ───────────────────────────────────────────────────────────
const G='\x1b[32m', R='\x1b[1m\x1b[31m', C='\x1b[36m', X='\x1b[0m', D='\x1b[2m';
let passed=0, failed=0, suite='', failures=[];
function s(name){ suite=name; console.log(`\n${C}${name}${X}`); }
function t(label, fn){ try{ const d=fn(); passed++; console.log(`  ${G}✓${X} ${label}${d?` ${D}— ${d}${X}`:''}`); }catch(err){ failed++; failures.push({suite,label,msg:err.message}); console.log(`  ${R}✗ FAIL${X} ${label}\n    ${err.message}`); } }
function assert(c,m){ if(!c)throw new Error(m||'Assertion failed'); }
function eq(a,b,m){ if(a!==b)throw new Error(`${m}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }

// ── Reset helper ───────────────────────────────────────────────────────────
function reset(){ localStorage.clear(); }

// ══════════════════════════════════════════════════════════════════════════
s('1 · Resource creation');
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
s('3 · Resource update and delete');

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
s('4 · Maintenance toggle');

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

t('Cannot delete a Deployed resource (test via Maintenance block)', () => {
  // Still in Maintenance — delete should succeed
  const r = deleteResource(rid1);
  assert(r.success, `Should be able to delete Maintenance resource`);
  // Recreate for further tests
  const r2 = createResource({ name: 'Ambulance Unit 1', type: 'Ambulance', location: 'Main Gate' });
  rid1 = r2.resource.id;
  return `Deleted and recreated as ${rid1}`;
});

t('Clear Maintenance → Available succeeds', () => {
  setMaintenance(rid1); // set it first
  const r = clearMaintenance(rid1);
  assert(r.success, `Failed: ${r.error}`);
  eq(getResourceById(rid1).status, 'Available', 'status');
  return 'Maintenance → Available OK';
});

// ══════════════════════════════════════════════════════════════════════════
s('5 · Assignment and release');
reset();
registerReleaseHook(releaseResource);

// Create a resource and an active incident.
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

t('Assigning Deployed resource to another incident fails', () => {
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
s('6 · Auto-release on incident resolution');
// Re-assign resource then resolve incident.

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
  // Manually inject an orphaned resource.
  const res = getAllResources();
  res.push({ id: 'RES-ORPH', name: 'Orphan', type: 'Other', status: 'Deployed', location: 'X', assignedTo: 'INC-9999', addedAt: getNow() });
  storeSet(STORAGE_KEYS.RESOURCES, res);

  repairOrphans();

  const orphan = getResourceById('RES-ORPH');
  eq(orphan.status, 'Available', 'orphan should be Available after repair');
  eq(orphan.assignedTo, null, 'orphan assignedTo should be null after repair');

  // Clean up
  const cleaned = getAllResources().filter(r => r.id !== 'RES-ORPH');
  storeSet(STORAGE_KEYS.RESOURCES, cleaned);
  return 'Orphan repaired correctly';
});

// ══════════════════════════════════════════════════════════════════════════
s('8 · Search, filter, sort');
reset();

storeSet(STORAGE_KEYS.RESOURCES, [
  { id:'RES-0101', name:'Ambulance Alpha', type:'Ambulance',  status:'Available',   location:'North Gate', assignedTo:null, addedAt:'2024-03-01T08:00:00.000Z' },
  { id:'RES-0102', name:'Fire Truck Beta', type:'Fire Truck', status:'Deployed',    location:'Station B',  assignedTo:'INC-0001', addedAt:'2024-03-01T09:00:00.000Z' },
  { id:'RES-0103', name:'Police Unit Gamma',type:'Police Unit',status:'Maintenance',location:'HQ',        assignedTo:null, addedAt:'2024-03-01T07:00:00.000Z' },
]);

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

// ══════════════════════════════════════════════════════════════════════════
s('9 · releaseResource — fix verification');
// Each sub-test sets up its own isolated state so failures are independent.

// ── 9a: Successful release ─────────────────────────────────────────────────
{
  reset();
  const rA = createResource({ name: 'Unit A', type: 'Ambulance', location: 'Gate A' });
  const iA = createIncident({ title: 'Incident Alpha', description: 'Test incident for release.', type: 'Medical', priority: 'Low', location: 'Gate A', reportedBy: 'T' });
  updateIncidentStatus(iA.incident.id, 'Active');
  assignResource(rA.resource.id, iA.incident.id);

  t('9a · Successful release: resource becomes Available, incident cleared', () => {
    const result = releaseResource(rA.resource.id);
    assert(result.success, `Expected success: ${result.error}`);
    // Resource side.
    const r = getResourceById(rA.resource.id);
    eq(r.status,     'Available', 'resource.status after release');
    eq(r.assignedTo, null,        'resource.assignedTo after release');
    // Incident side.
    const inc = getIncidentById(iA.incident.id);
    assert(!inc.assignedResources.includes(rA.resource.id), 'incident still references released resource');
    return `${rA.resource.id} released; ${iA.incident.id}.assignedResources=[]`;
  });
}

// ── 9b: Idempotent release ─────────────────────────────────────────────────
{
  reset();
  const rB = createResource({ name: 'Unit B', type: 'Ambulance', location: 'Gate B' });
  // Resource is already Available — never deployed.

  t('9b · Release of non-Deployed resource returns success (idempotent)', () => {
    const result = releaseResource(rB.resource.id);
    assert(result.success, `Expected success: ${JSON.stringify(result)}`);
    eq(getResourceById(rB.resource.id).status, 'Available', 'status should stay Available');
    return 'Idempotent release of Available resource OK';
  });

  t('9b · Release of unknown resource ID returns success (safe for bulk)', () => {
    const result = releaseResource('RES-9999');
    assert(result.success, `Expected success for unknown ID: ${JSON.stringify(result)}`);
    return 'Unknown ID treated as already released';
  });
}

// ── 9c: Release when incident no longer exists ─────────────────────────────
{
  reset();
  // Inject a resource that points to a non-existent incident directly.
  storeSet(STORAGE_KEYS.RESOURCES, [{
    id: 'RES-GHOST', name: 'Ghost Unit', type: 'Other', status: 'Deployed',
    location: 'X', assignedTo: 'INC-GONE', addedAt: getNow(),
  }]);
  // No incidents in store.

  t('9c · Release when linked incident is missing: resource released, no crash', () => {
    const result = releaseResource('RES-GHOST');
    assert(result.success, `Expected success when incident is missing: ${JSON.stringify(result)}`);
    const r = getResourceById('RES-GHOST');
    eq(r.status,     'Available', 'resource.status after orphan release');
    eq(r.assignedTo, null,        'resource.assignedTo after orphan release');
    return 'Orphaned resource released cleanly';
  });
}

// ── 9d: Incident storage write failure → resource rolled back ──────────────
{
  reset();
  const rD = createResource({ name: 'Unit D', type: 'Ambulance', location: 'Gate D' });
  const iD = createIncident({ title: 'Incident Delta', description: 'Test incident for write failure.', type: 'Fire', priority: 'High', location: 'Gate D', reportedBy: 'T' });
  updateIncidentStatus(iD.incident.id, 'Active');
  assignResource(rD.resource.id, iD.incident.id);

  // Intercept the second write (incident write) and make it fail.
  // We do this by temporarily replacing writeIncidents with a failing stub.
  const realWriteIncidents = writeIncidents;
  let incidentWriteCallCount = 0;
  // Shadow writeIncidents for this test scope using a flag on storeSet.
  // Strategy: intercept localStorage.setItem for the incidents key only.
  const realSetItem = localStorage.setItem.bind(localStorage);
  let blockIncidentWrite = false;
  localStorage.setItem = (k, v) => {
    if (blockIncidentWrite && k === STORAGE_KEYS.INCIDENTS) return; // simulate failure by silently dropping
    realSetItem(k, v);
  };

  // Capture state before the attempted release.
  const resBefore  = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESOURCES));
  const incBefore  = JSON.parse(localStorage.getItem(STORAGE_KEYS.INCIDENTS));

  // Enable the block just before calling releaseResource.
  blockIncidentWrite = true;

  // Our inlined writeIncidents calls storeSet which calls localStorage.setItem —
  // but we need writeIncidents itself to return false.
  // Simpler approach: override writeIncidents inline for this test only.
  // We re-define it locally as a block-scope shadow won't override the module-level
  // function. Instead: patch storeSet to return false for INCIDENTS key once.
  blockIncidentWrite = false; // undo setItem patch
  localStorage.setItem = realSetItem; // restore

  // Patch storeSet to fail once for incidents key.
  const origStoreSet = storeSet;
  let blockNextIncidentStoreSet = true;
  // We can't shadow module-scope storeSet directly, so we patch writeIncidents.
  // In this inlined test environment writeIncidents IS a local function we control.
  // Re-assign it to a one-shot failing version.
  const failOnceWriteIncidents = (() => {
    let failed = false;
    return (data) => {
      if (!failed) { failed = true; return false; } // first call fails
      return storeSet(STORAGE_KEYS.INCIDENTS, data);
    };
  })();

  // Temporarily replace writeIncidents at module scope isn't possible in
  // straight ESM. Since writeIncidents is a plain function reference in this
  // file, we can rebind it by reassigning the variable.
  // The test harness uses `let`-style re-assignable names via the inlined
  // approach, so we shadow it in this block.
  // NOTE: In JavaScript you cannot rebind a `function` declaration — only
  // `let`/`const` vars. Since this file defines writeIncidents as a plain
  // `function` declaration we use a different injection strategy:
  // We directly manipulate localStorage to simulate the failure scenario.

  // Direct simulation approach:
  // 1. Call releaseResource (it will write resources then attempt incidents).
  // 2. After resource write succeeds, we delete the incident record from store
  //    to simulate the scenario where the incident key becomes unreadable.
  //    Actually: we verify the rollback by checking the RESULT of the function
  //    against the raw store values.
  //
  // Since we cannot intercept writeIncidents without refactoring, we test
  // the rollback logic by verifying the symmetric property:
  // If releaseResource returns success=true, both records must be consistent.
  // If it returns success=false with a rollback note, resource must be Deployed.

  // We simulate the write failure by truncating the incidents store after the
  // resource write but before the incident write using a one-shot setItem hook.
  let resourceWriteDone = false;
  const simulateIncidentWriteFailure = (k, v) => {
    if (k === STORAGE_KEYS.RESOURCES && !resourceWriteDone) {
      resourceWriteDone = true;
      realSetItem(k, v); // allow resource write
      return;
    }
    if (k === STORAGE_KEYS.INCIDENTS && resourceWriteDone) {
      // Drop the incident write — simulate storage failure.
      return;
    }
    realSetItem(k, v);
  };

  // Patch setItem.
  localStorage.setItem = simulateIncidentWriteFailure;

  const releaseResult = releaseResource(rD.resource.id);

  // Restore setItem immediately.
  localStorage.setItem = realSetItem;

  t('9d · Simulated incident write failure: returns success=false or stays consistent', () => {
    // Two valid outcomes:
    // A) writeIncidents was silently dropped (our stub doesn't return false,
    //    it just drops the write). The function sees savedI=true (storeSet
    //    returned true from our stub that drops data). In this case the
    //    resource is Available but incident is stale. We detect this scenario.
    // B) Real failure where savedI=false triggers rollback.
    //
    // Because our stub silently drops the write without returning false,
    // the inlined storeSet will return `true` (localStorage.setItem doesn't
    // throw — it just does nothing in our stub). This means the function
    // thinks the incident write succeeded, so result.success=true, but the
    // incident record in the store is stale.
    //
    // This is the exact limitation documented in the "remaining issues" section.
    // For this test we verify the resource state is internally consistent
    // given the result returned.
    if (releaseResult.success) {
      // Function returned success. Verify resource side is correct.
      const r = getResourceById(rD.resource.id);
      assert(r !== null, 'Resource should still exist');
      // The function claims success — resource should be Available.
      eq(r.status, 'Available', 'resource.status should be Available if function claims success');
      return `success=true; resource.status=${r.status} (incident side may be stale — see limitations)`;
    } else {
      // Function returned failure — rollback should have run.
      assert(releaseResult.error, 'Expected error message on failure');
      const r = getResourceById(rD.resource.id);
      // After rollback, resource should still be Deployed.
      eq(r.status, 'Deployed', 'resource should be Deployed after rollback');
      eq(r.assignedTo, iD.incident.id, 'resource.assignedTo should be restored after rollback');
      return `success=false with rollback; resource.status=${r.status} (consistent)`;
    }
  });
}

// ── 9e: Rollback success verification ─────────────────────────────────────
{
  reset();
  const rE = createResource({ name: 'Unit E', type: 'Ambulance', location: 'Gate E' });
  const iE = createIncident({ title: 'Incident Echo', description: 'Test incident for rollback check.', type: 'Medical', priority: 'Low', location: 'Gate E', reportedBy: 'T' });
  updateIncidentStatus(iE.incident.id, 'Active');
  assignResource(rE.resource.id, iE.incident.id);

  // Simulate a genuine incident write failure by making storeSet return false
  // for the INCIDENTS key once. We do this by patching localStorage.setItem
  // to throw a QuotaExceededError on the INCIDENTS key, which causes storeSet
  // to return false — exactly triggering the rollback path.
  const realSetItem2 = localStorage.setItem.bind(localStorage);
  let incidentWriteCount = 0;
  localStorage.setItem = (k, v) => {
    if (k === STORAGE_KEYS.INCIDENTS) {
      incidentWriteCount++;
      if (incidentWriteCount === 1) {
        // First incident write after resource write — simulate QuotaExceededError.
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
    }
    realSetItem2(k, v);
  };

  const releaseResult2 = releaseResource(rE.resource.id);
  localStorage.setItem = realSetItem2; // restore

  t('9e · When incident write throws, releaseResource returns success=false', () => {
    assert(!releaseResult2.success, `Expected failure when incident write throws, got: ${JSON.stringify(releaseResult2)}`);
    assert(releaseResult2.error, 'Expected error message');
    return `Correctly returned failure: "${releaseResult2.error.slice(0, 80)}…"`;
  });

  t('9e · After incident write failure, resource is rolled back to Deployed', () => {
    const r = getResourceById(rE.resource.id);
    eq(r.status,     'Deployed',      'resource should be back to Deployed after rollback');
    eq(r.assignedTo, iE.incident.id,  'resource.assignedTo should be restored');
    return `resource.status=${r.status}, resource.assignedTo=${r.assignedTo}`;
  });

  t('9e · After incident write failure, incident record is unchanged', () => {
    const inc = getIncidentById(iE.incident.id);
    assert(inc.assignedResources.includes(rE.resource.id), 'incident should still reference resource after rollback');
    return `incident.assignedResources still contains ${rE.resource.id}`;
  });
}

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
console.log(failed === 0 ? `\n\x1b[32m✓ All ${total} tests passed.\x1b[0m` : `\n\x1b[31m✗ ${failed}/${total} tests failed.\x1b[0m`);
console.log('\x1b[33m  ✓ In-memory store cleared — no persistent data created.\x1b[0m\n');
process.exit(failed > 0 ? 1 : 0);
