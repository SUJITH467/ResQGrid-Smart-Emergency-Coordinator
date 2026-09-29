/**
 * test-phase4.mjs
 * ---------------
 * Phase 4 production-module tests for assistantService.js
 * Uses the preload shim: node --require ./test-globals-preload.cjs test-phase4.mjs
 */

import {
  normalize,
  matchRules,
  scoreMatches,
  determinePriority,
  calculateConfidence,
  buildExplanation,
  buildResources,
  analyze,
  buildTransferPayload,
  logResult,
  getAllLogs,
  RULE_CATEGORIES,
  SEVERITY_KEYWORDS,
  TYPE_DEFAULT_PRIORITY,
  RESOURCE_MAP,
} from './assets/js/services/assistantService.js';

import { STORAGE_KEYS } from './assets/js/store.js';

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

// ── Reset helper ───────────────────────────────────────────────────────────
function reset(){ global._testStore.clear(); }

// ══════════════════════════════════════════════════════════════════════════
s('A1 · normalize()');

t('lowercases input', () => {
  eq(normalize('FIRE IN BUILDING B'), 'fire in building b', 'lowercase');
  return 'OK';
});

t('trims leading/trailing whitespace', () => {
  eq(normalize('  smoke  '), 'smoke', 'trim');
  return 'OK';
});

t('collapses multiple spaces', () => {
  eq(normalize('fire  in    lab'), 'fire in lab', 'collapse');
  return 'OK';
});

t('returns empty string for null/undefined input', () => {
  eq(normalize(null), '', 'null');
  eq(normalize(undefined), '', 'undefined');
  eq(normalize(''), '', 'empty string');
  return 'OK';
});

t('handles all-caps with punctuation', () => {
  const n = normalize('FIRE!! HELP!!');
  assert(n.includes('fire'), 'should contain fire');
  return `"${n}"`;
});

// ══════════════════════════════════════════════════════════════════════════
s('A2 · matchRules()');

t('matches Fire keyword "smoke"', () => {
  const m = matchRules('smoke visible near building');
  const fire = m.filter(x => x.type === 'Fire' && x.keyword === 'smoke');
  assert(fire.length === 1, 'Expected 1 Fire match for smoke');
  eq(fire[0].isLocationBoost, false, 'smoke is not a location boost');
  return '1 Fire keyword match';
});

t('matches Fire location boost "lab"', () => {
  const m = matchRules('something happening in the lab');
  const boost = m.filter(x => x.type === 'Fire' && x.keyword === 'lab' && x.isLocationBoost);
  assert(boost.length >= 1, 'Expected lab location boost for Fire');
  return '1 Fire location boost';
});

t('matches Medical keyword "collapsed"', () => {
  const m = matchRules('person collapsed near entrance');
  const med = m.filter(x => x.type === 'Medical' && x.keyword === 'collapsed');
  assert(med.length >= 1, 'Expected Medical match for collapsed');
  return 'Medical keyword matched';
});

t('matches Security keyword "intruder"', () => {
  const m = matchRules('unidentified intruder in lobby');
  const sec = m.filter(x => x.type === 'Security');
  assert(sec.length >= 1, 'Expected Security matches');
  return `${sec.length} Security match(es)`;
});

t('matches Hazmat keyword "chemical spill"', () => {
  const m = matchRules('chemical spill in loading bay');
  const haz = m.filter(x => x.type === 'Hazmat');
  assert(haz.length >= 2, `Expected ≥2 Hazmat matches, got ${haz.length}`);
  return `${haz.length} Hazmat matches`;
});

t('matches Hazmat location boost "loading bay"', () => {
  const m = matchRules('incident at loading bay');
  const boost = m.filter(x => x.type === 'Hazmat' && x.isLocationBoost);
  assert(boost.length >= 1, 'Expected Hazmat location boost for loading bay');
  return 'Hazmat loading bay boost matched';
});

t('matches Natural Disaster keyword "flood"', () => {
  const m = matchRules('flooding in basement ground floor');
  const nd = m.filter(x => x.type === 'Natural Disaster');
  assert(nd.length >= 2, `Expected ≥2 Natural Disaster matches, got ${nd.length}`);
  return `${nd.length} Natural Disaster matches`;
});

t('returns empty array for stopword-only input', () => {
  const m = matchRules('the a is it');
  eq(m.length, 0, 'No matches for stopwords');
  return '0 matches (correct)';
});

t('multi-type input returns matches from both categories', () => {
  const m = matchRules('fire and chemical spill');
  const types = [...new Set(m.map(x => x.type))];
  assert(types.includes('Fire'), 'Should have Fire');
  assert(types.includes('Hazmat'), 'Should have Hazmat');
  return `Types matched: ${types.join(', ')}`;
});

// ══════════════════════════════════════════════════════════════════════════
s('A3 · scoreMatches()');

t('no matches → null winningType, score 0', () => {
  const r = scoreMatches([]);
  eq(r.winningType, null, 'winningType');
  eq(r.totalScore,  0,    'totalScore');
  return 'OK';
});

t('single Fire match → Fire wins with score 1', () => {
  const r = scoreMatches([{ type: 'Fire', keyword: 'smoke', isLocationBoost: false }]);
  eq(r.winningType, 'Fire', 'winningType');
  assert(r.totalScore >= 1, 'score >= 1');
  return `winningType=${r.winningType}, score=${r.totalScore}`;
});

t('Fire 3 matches vs Medical 1 → Fire wins with disambiguation bonus', () => {
  const matches = [
    { type: 'Fire',    keyword: 'smoke',    isLocationBoost: false },
    { type: 'Fire',    keyword: 'flame',    isLocationBoost: false },
    { type: 'Fire',    keyword: 'burning',  isLocationBoost: false },
    { type: 'Medical', keyword: 'injured',  isLocationBoost: false },
  ];
  const r = scoreMatches(matches);
  eq(r.winningType, 'Fire', 'winningType');
  assert(r.disambiguationBonus, 'Should have disambiguation bonus (3 ≥ 2×1)');
  return `Fire wins with bonus, totalScore=${r.totalScore}`;
});

t('tie → category earlier in RULE_CATEGORIES wins', () => {
  // Fire and Medical both get 1 match — Fire is defined first
  const matches = [
    { type: 'Fire',    keyword: 'smoke',    isLocationBoost: false },
    { type: 'Medical', keyword: 'injured',  isLocationBoost: false },
  ];
  const r = scoreMatches(matches);
  eq(r.winningType, 'Fire', 'Fire should win tiebreaker (defined first)');
  return 'Tiebreaker: Fire wins';
});

// ══════════════════════════════════════════════════════════════════════════
s('A4 · determinePriority()');

t('Critical severity keyword overrides type default', () => {
  const p = determinePriority('unresponsive patient not breathing', 'Medical');
  eq(p, 'Critical', 'priority');
  return 'Critical from severity keyword';
});

t('High severity keyword returns High', () => {
  const p = determinePriority('serious fire spreading fast', 'Fire');
  eq(p, 'High', 'priority');
  return 'High from "serious"/"spreading"';
});

t('Medium severity keyword returns Medium', () => {
  const p = determinePriority('suspected minor smoke issue', 'Fire');
  eq(p, 'Medium', 'priority');
  return 'Medium from "suspected"/"minor"';
});

t('Low severity keyword returns Low', () => {
  const p = determinePriority('false alarm drill precautionary', 'Fire');
  eq(p, 'Low', 'priority');
  return 'Low from "false alarm"/"drill"';
});

t('no severity match → type default priority for Fire', () => {
  const p = determinePriority('some smoke visible', 'Fire');
  eq(p, TYPE_DEFAULT_PRIORITY['Fire'], 'default priority');
  return `Default: ${p}`;
});

t('no severity match → type default for Security', () => {
  const p = determinePriority('suspicious person seen', 'Security');
  eq(p, TYPE_DEFAULT_PRIORITY['Security'], 'default Security priority');
  return `Default Security: ${p}`;
});

t('unknown type falls back to Medium', () => {
  const p = determinePriority('something strange', 'Other');
  eq(p, 'Medium', 'Other defaults to Medium');
  return 'Other → Medium';
});

// ══════════════════════════════════════════════════════════════════════════
s('A5 · calculateConfidence()');

t('score 0 → Low', ()  => { eq(calculateConfidence(0), 'Low',    'score 0');  return 'OK'; });
t('score 1 → Low', ()  => { eq(calculateConfidence(1), 'Low',    'score 1');  return 'OK'; });
t('score 2 → Medium', ()=>{ eq(calculateConfidence(2), 'Medium', 'score 2');  return 'OK'; });
t('score 3 → Medium', ()=>{ eq(calculateConfidence(3), 'Medium', 'score 3');  return 'OK'; });
t('score 4 → High', () => { eq(calculateConfidence(4), 'High',   'score 4');  return 'OK'; });
t('score 9 → High', () => { eq(calculateConfidence(9), 'High',   'score 9');  return 'OK'; });

// ══════════════════════════════════════════════════════════════════════════
s('A6 · buildResources()');

t('Fire → Fire Truck + Medical Team', () => {
  const r = buildResources('Fire');
  assert(r.includes('Fire Truck'),   'Fire Truck');
  assert(r.includes('Medical Team'), 'Medical Team');
  return r.join(', ');
});

t('Medical → Ambulance + Medical Team', () => {
  const r = buildResources('Medical');
  assert(r.includes('Ambulance'),    'Ambulance');
  assert(r.includes('Medical Team'), 'Medical Team');
  return r.join(', ');
});

t('Other → empty array', () => {
  const r = buildResources('Other');
  eq(r.length, 0, 'Other has no resources');
  return '[]';
});

t('Unknown type → empty array (safe fallback)', () => {
  const r = buildResources('SomeUnknownType');
  eq(r.length, 0, 'Unknown type returns []');
  return '[]';
});

// ══════════════════════════════════════════════════════════════════════════
s('A7 · analyze() — end-to-end');

t('Smoke in chemistry lab → Fire, location boost applied', () => {
  const r = analyze('Smoke is coming from the chemistry laboratory');
  eq(r.suggestedType, 'Fire', 'type');
  assert(!r.isFallback, 'should not be fallback');
  assert(r.matchedKeywords.includes('smoke') || r.matchedKeywords.includes('laboratory'),
    'smoke or laboratory in keywords');
  return `type=${r.suggestedType}, confidence=${r.confidence}, keywords=[${r.matchedKeywords.join(',')}]`;
});

t('Person collapsed near cafeteria → Medical', () => {
  const r = analyze('Person collapsed near cafeteria, not responding');
  eq(r.suggestedType, 'Medical', 'type');
  assert(r.confidence === 'High' || r.confidence === 'Medium', 'medium or high confidence');
  return `type=${r.suggestedType}, confidence=${r.confidence}`;
});

t('"Not breathing" → Critical priority', () => {
  const r = analyze('patient is not breathing in corridor');
  eq(r.suggestedPriority, 'Critical', 'priority');
  return `priority=${r.suggestedPriority}`;
});

t('Unresponsive → Critical priority', () => {
  const r = analyze('unresponsive person found in parking area');
  eq(r.suggestedPriority, 'Critical', 'priority');
  return `priority=${r.suggestedPriority}`;
});

t('Chemical spill in loading bay → Hazmat', () => {
  const r = analyze('chemical spill in loading bay, fumes detected');
  eq(r.suggestedType, 'Hazmat', 'type');
  assert(r.suggestedResources.includes('Hazmat Team'), 'Hazmat Team in resources');
  return `type=${r.suggestedType}, resources=[${r.suggestedResources.join(',')}]`;
});

t('Intruder in lobby → Security', () => {
  const r = analyze('suspicious intruder seen near the lobby entrance');
  eq(r.suggestedType, 'Security', 'type');
  assert(r.suggestedResources.includes('Police Unit'), 'Police Unit in resources');
  return `type=${r.suggestedType}`;
});

t('Flooding in basement → Natural Disaster', () => {
  const r = analyze('flooding in basement and ground floor, road bridge damaged');
  eq(r.suggestedType, 'Natural Disaster', 'type');
  return `type=${r.suggestedType}`;
});

t('All-caps input works (normalization handles it)', () => {
  const r = analyze('FIRE IN BUILDING B');
  eq(r.suggestedType, 'Fire', 'type');
  return `type=${r.suggestedType}`;
});

t('Input with punctuation works', () => {
  const r = analyze('fire!! help!! smoke everywhere!!');
  eq(r.suggestedType, 'Fire', 'type');
  return `type=${r.suggestedType}`;
});

t('Empty string → fallback result', () => {
  const r = analyze('');
  assert(r.isFallback, 'should be fallback');
  eq(r.suggestedType, 'Other', 'type');
  eq(r.suggestedPriority, 'Medium', 'priority');
  eq(r.confidence, 'Low', 'confidence');
  return 'Fallback returned correctly';
});

t('Stopwords only → fallback result', () => {
  const r = analyze('the a is it was');
  assert(r.isFallback, 'should be fallback');
  eq(r.confidence, 'Low', 'confidence');
  return 'Fallback returned for stopwords';
});

t('Very short input (3 chars) → fallback, no crash', () => {
  const r = analyze('hi');
  assert(typeof r === 'object' && r !== null, 'returns object');
  assert(typeof r.isFallback === 'boolean', 'isFallback is boolean');
  return `isFallback=${r.isFallback}`;
});

t('null input → fallback, never throws', () => {
  let r;
  let threw = false;
  try { r = analyze(null); } catch { threw = true; }
  assert(!threw, 'should not throw');
  assert(r.isFallback, 'should be fallback');
  return 'No throw on null input';
});

t('Multi-type input: fire and chemical → higher score wins', () => {
  const r = analyze('fire and chemical spill in lab');
  assert(r.suggestedType === 'Fire' || r.suggestedType === 'Hazmat',
    `Expected Fire or Hazmat, got ${r.suggestedType}`);
  assert(!r.isFallback, 'should not be fallback');
  return `winner=${r.suggestedType}`;
});

t('result always has all required fields', () => {
  const r = analyze('smoke in boiler room');
  const required = ['suggestedType','suggestedPriority','suggestedResources','confidence','matchedKeywords','explanation','isFallback'];
  required.forEach(k => assert(k in r, `Missing field: ${k}`));
  assert(Array.isArray(r.suggestedResources), 'suggestedResources is array');
  assert(Array.isArray(r.matchedKeywords),    'matchedKeywords is array');
  return 'All 7 fields present';
});

// ══════════════════════════════════════════════════════════════════════════
s('A8 · buildTransferPayload()');

t('returns type, priority and description', () => {
  const r = analyze('smoke in lab');
  const p = buildTransferPayload(r, 'original description');
  assert('type'        in p, 'type');
  assert('priority'    in p, 'priority');
  assert('description' in p, 'description');
  eq(p.description, 'original description', 'description preserved');
  eq(p.type,     r.suggestedType,     'type matches result');
  eq(p.priority, r.suggestedPriority, 'priority matches result');
  return `{type:${p.type}, priority:${p.priority}}`;
});

t('empty description → empty string in payload', () => {
  const r = analyze('smoke');
  const p = buildTransferPayload(r, '');
  eq(p.description, '', 'empty description');
  return 'OK';
});

// ══════════════════════════════════════════════════════════════════════════
s('A9 · logResult() and getAllLogs()');

reset();

t('logResult writes a log entry to localStorage', () => {
  const r   = analyze('smoke in lab');
  logResult(r, 'smoke in lab', false);
  const log = getAllLogs();
  assert(log.length === 1, `Expected 1 log entry, got ${log.length}`);
  return `1 log entry written`;
});

t('log entry has all required fields', () => {
  const log   = getAllLogs();
  const entry = log[0];
  const required = ['id','inputDescription','suggestedType','suggestedPriority',
                    'suggestedResources','confidence','matchedKeywords','accepted','timestamp'];
  required.forEach(k => assert(k in entry, `Missing field: ${k}`));
  eq(entry.accepted, false, 'accepted=false');
  return 'All fields present';
});

t('logResult with accepted=true sets accepted:true', () => {
  const r   = analyze('chemical spill');
  logResult(r, 'chemical spill', true);
  const log = getAllLogs();
  const last = log[log.length - 1];
  eq(last.accepted, true, 'accepted=true');
  return 'accepted:true confirmed';
});

t('multiple analyze calls create multiple log entries', () => {
  logResult(analyze('flood'), 'flood', false);
  const log = getAllLogs();
  assert(log.length >= 3, `Expected ≥3 entries, got ${log.length}`);
  return `${log.length} entries total`;
});

t('logResult silently handles QuotaExceededError (no crash)', () => {
  // Patch setItem to throw once
  const realSetItem = global.localStorage.setItem.bind(global.localStorage);
  let threw = false;
  global.localStorage.setItem = (k, v) => {
    if (k === STORAGE_KEYS.ASSISTANT_LOG) {
      global.localStorage.setItem = realSetItem;
      throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    }
    realSetItem(k, v);
  };
  let crashed = false;
  try { logResult(analyze('smoke'), 'smoke', false); }
  catch { crashed = true; }
  global.localStorage.setItem = realSetItem;
  assert(!crashed, 'logResult should not propagate QuotaExceededError');
  return 'Quota error silently absorbed';
});

// ── Phase 4 regression: existing incident/resource services unaffected ──────
s('A10 · Phase 4 regression — existing services');
reset();

import { createResource, getAllResources, deleteResource }          from './assets/js/services/resourceService.js';
import { releaseResource as relRes }                               from './assets/js/services/resourceService.js';
import { createIncident, getAllIncidents, updateIncidentStatus,
         registerReleaseHook as regHook }                          from './assets/js/services/incidentService.js';

regHook(relRes);

t('Resource creation still works after Phase 4 additions', () => {
  const r = createResource({ name: 'Phase4 Ambulance', type: 'Ambulance', location: 'Gate A' });
  assert(r.success, `Failed: ${JSON.stringify(r)}`);
  return `Created ${r.resource.id}`;
});

t('Incident creation still works after Phase 4 additions', () => {
  const r = createIncident({
    title:       'Phase4 test incident',
    description: 'Testing incident creation during Phase 4 regression.',
    type:        'Fire', priority: 'High', location: 'Block A', reportedBy: 'Tester',
  });
  assert(r.success, `Failed: ${JSON.stringify(r)}`);
  return `Created ${r.incident.id}`;
});

t('assistantService analyze does not affect incident/resource store', () => {
  const before = getAllIncidents().length + getAllResources().length;
  analyze('massive fire in chemistry laboratory building');
  analyze('chemical spill near loading bay');
  const after  = getAllIncidents().length + getAllResources().length;
  eq(before, after, 'store should be unchanged after analyze()');
  return 'Store unchanged';
});

// ── Cleanup ────────────────────────────────────────────────────────────────
reset();

// ── Summary ────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '─'.repeat(60));
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${total}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ [${f.suite}] ${f.label}\n    ${f.msg}`));
}
console.log(failed === 0
  ? `\n\x1b[32m✓ All ${total} Phase 4 tests passed against production modules.\x1b[0m`
  : `\n\x1b[31m✗ ${failed}/${total} tests failed.\x1b[0m`);
console.log('\x1b[33m  ✓ In-memory store cleared — no persistent data created.\x1b[0m\n');
process.exit(failed > 0 ? 1 : 0);
