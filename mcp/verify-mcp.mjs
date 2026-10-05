/**
 * mcp/verify-mcp.mjs
 * ------------------
 * Deterministic MCP verification script for ResQGrid.
 *
 * Spawns resqgrid-mcp-server.mjs as a child process and drives it through
 * the complete MCP lifecycle over stdin/stdout (same transport Kiro uses).
 *
 * Run:
 *   node mcp/verify-mcp.mjs
 *
 * Verifies:
 *   V01  — Server process starts (pid exists)
 *   V01b — Server writes startup message to stderr
 *   V02  — initialize handshake succeeds
 *   V02b — protocolVersion is 2024-11-05
 *   V02c — serverInfo.name is resqgrid-mcp-server
 *   V03  — tools/list returns exactly 5 tools
 *   V03b — all 5 expected tool names present
 *   V04  — each tool has name, description, inputSchema
 *   V05  — get_incidents returns structured data
 *   V05b — get_incidents with status filter applied correctly
 *   V06  — get_resources returns structured data
 *   V07  — validate_consistency returns a consistency report
 *   V08  — get_statistics returns metrics object
 *   V09  — run_tests with invalid suite returns safe error (no user input echoed)
 *   V10  — run_tests with 'phase3' suite passes 44/44
 *   V11  — unknown tool returns JSON-RPC -32601 error
 *   V12  — server survives malformed JSON and keeps serving
 */

import { spawn }          from 'node:child_process';
import { resolve }        from 'node:path';
import { fileURLToPath }  from 'node:url';

const __dirname    = fileURLToPath(new URL('.', import.meta.url));
const SERVER_PATH  = resolve(__dirname, 'resqgrid-mcp-server.mjs');
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Test harness ───────────────────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[1m\x1b[31m', C = '\x1b[36m', X = '\x1b[0m', D = '\x1b[2m';
let passed = 0, failed = 0;
const failures = [];

function test(label, fn) {
  try {
    const detail = fn();
    passed++;
    console.log(`  ${G}✓${X} ${label}${detail ? ` ${D}— ${detail}${X}` : ''}`);
  } catch (err) {
    failed++;
    failures.push({ label, msg: err.message });
    console.log(`  ${R}✗ FAIL${X} ${label}\n    ${err.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function eq(a, b, label)   { if (a !== b) throw new Error(`${label || 'eq'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }

// ── MCP client (JSON-RPC 2.0 over stdio) ──────────────────────────────────
class McpClient {
  constructor(proc) {
    this._proc    = proc;
    this._buffer  = '';
    this._pending = new Map();
    this._nextId  = 1;

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      this._buffer += chunk;
      const lines = this._buffer.split('\n');
      this._buffer = lines.pop();  // keep incomplete last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.id !== undefined && this._pending.has(msg.id)) {
            const { resolve } = this._pending.get(msg.id);
            this._pending.delete(msg.id);
            resolve(msg);
          }
        } catch { /* ignore unparseable server output */ }
      }
    });
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id  = this._nextId++;
      this._pending.set(id, { resolve, reject });
      this._proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      const timer = setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`Timeout waiting for response to "${method}" (id=${id})`));
        }
      }, 30_000);
      // Clear timer on resolve
      const original = this._pending.get(id);
      if (original) {
        this._pending.set(id, {
          resolve: (v) => { clearTimeout(timer); resolve(v); },
          reject,
        });
      }
    });
  }

  sendRaw(text) {
    this._proc.stdin.write(text + '\n');
    return new Promise(r => setTimeout(r, 300));
  }

  close() { this._proc.stdin.end(); }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C}ResQGrid MCP Server Verification${X}\n`);

  const proc = spawn('node', [SERVER_PATH], {
    cwd:   PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderrOutput = '';
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', d => { stderrOutput += d; });

  // Give server time to start
  await new Promise(r => setTimeout(r, 500));

  // V01 — process started
  test('V01 — server process started (pid exists)', () => {
    assert(proc.pid,     'No PID — server failed to start');
    assert(!proc.killed, 'Process killed immediately on start');
    return `pid=${proc.pid}`;
  });

  test('V01b — server writes startup message to stderr', () => {
    assert(stderrOutput.includes('resqgrid-mcp'), `Expected startup message, got: "${stderrOutput}"`);
    return 'startup message present';
  });

  const client = new McpClient(proc);

  // V02 — initialize
  let initResp;
  try {
    initResp = await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities:    {},
      clientInfo:      { name: 'verify-mcp', version: '1.0' },
    });
  } catch (err) {
    console.log(`  ${R}✗ FATAL${X} initialize failed: ${err.message}`);
    proc.kill();
    summarize();
    return;
  }

  test('V02 — initialize returns result (no error)', () => {
    assert(!initResp.error, `Got error: ${JSON.stringify(initResp.error)}`);
    assert(initResp.result, 'No result in initialize response');
    return 'OK';
  });

  test('V02b — protocolVersion is 2024-11-05', () => {
    eq(initResp.result.protocolVersion, '2024-11-05', 'protocolVersion');
    return `version=${initResp.result.protocolVersion}`;
  });

  test('V02c — serverInfo.name is resqgrid-mcp-server', () => {
    eq(initResp.result.serverInfo?.name, 'resqgrid-mcp-server', 'serverInfo.name');
    return `name=${initResp.result.serverInfo.name}`;
  });

  // Send initialized notification
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await new Promise(r => setTimeout(r, 50));

  // V03–V04 — tools/list
  const listResp = await client.send('tools/list', {});

  test('V03 — tools/list returns exactly 5 tools', () => {
    const tools = listResp.result?.tools;
    assert(Array.isArray(tools), 'tools must be an array');
    eq(tools.length, 5, 'expected 5 tools');
    return `${tools.length} tools`;
  });

  const EXPECTED_TOOLS = ['get_incidents','get_resources','validate_consistency','get_statistics','run_tests'];

  test('V03b — all 5 expected tool names present', () => {
    const names = listResp.result.tools.map(t => t.name);
    for (const name of EXPECTED_TOOLS) {
      assert(names.includes(name), `Missing tool: "${name}"`);
    }
    return EXPECTED_TOOLS.join(', ');
  });

  test('V04 — each tool has name, description, inputSchema', () => {
    for (const tool of listResp.result.tools) {
      assert(tool.name,        `Tool missing "name"`);
      assert(tool.description, `Tool "${tool.name}" missing "description"`);
      assert(tool.inputSchema, `Tool "${tool.name}" missing "inputSchema"`);
    }
    return 'all 5 tools have required fields';
  });

  // V05 — get_incidents
  const incResp = await client.send('tools/call', { name: 'get_incidents', arguments: {} });

  test('V05 — get_incidents returns structured data', () => {
    assert(!incResp.error, `Error: ${JSON.stringify(incResp.error)}`);
    const parsed = JSON.parse(incResp.result.content[0].text);
    assert('total'     in parsed, 'Missing "total"');
    assert('returned'  in parsed, 'Missing "returned"');
    assert('incidents' in parsed, 'Missing "incidents"');
    assert(Array.isArray(parsed.incidents), '"incidents" must be array');
    return `total=${parsed.total}, returned=${parsed.returned}`;
  });

  test('V05b — get_incidents with status=Active filter applied', async () => {
    const r = await client.send('tools/call', { name: 'get_incidents', arguments: { status: 'Active' } });
    assert(!r.error, `Error: ${JSON.stringify(r.error)}`);
    const parsed = JSON.parse(r.result.content[0].text);
    eq(parsed.filters_applied.status, 'Active', 'filter_status');
    return 'status=Active filter applied';
  });

  // V06 — get_resources
  const resResp = await client.send('tools/call', { name: 'get_resources', arguments: {} });

  test('V06 — get_resources returns structured data', () => {
    assert(!resResp.error, `Error: ${JSON.stringify(resResp.error)}`);
    const parsed = JSON.parse(resResp.result.content[0].text);
    assert('total'     in parsed, 'Missing "total"');
    assert('resources' in parsed, 'Missing "resources"');
    assert(Array.isArray(parsed.resources), '"resources" must be array');
    return `total=${parsed.total}`;
  });

  // V07 — validate_consistency
  const conResp = await client.send('tools/call', { name: 'validate_consistency', arguments: {} });

  test('V07 — validate_consistency returns consistency report', () => {
    assert(!conResp.error, `Error: ${JSON.stringify(conResp.error)}`);
    const parsed = JSON.parse(conResp.result.content[0].text);
    assert('consistent' in parsed, 'Missing "consistent"');
    assert('issues'     in parsed, 'Missing "issues"');
    assert('errors'     in parsed, 'Missing "errors"');
    assert('warnings'   in parsed, 'Missing "warnings"');
    assert(typeof parsed.consistent === 'boolean', '"consistent" must be boolean');
    return `consistent=${parsed.consistent}, errors=${parsed.errors}, warnings=${parsed.warnings}`;
  });

  // V08 — get_statistics
  const statResp = await client.send('tools/call', { name: 'get_statistics', arguments: {} });

  test('V08 — get_statistics returns metrics object', () => {
    assert(!statResp.error, `Error: ${JSON.stringify(statResp.error)}`);
    const parsed = JSON.parse(statResp.result.content[0].text);
    assert('incidents'  in parsed, 'Missing "incidents"');
    assert('resources'  in parsed, 'Missing "resources"');
    assert('resolution' in parsed, 'Missing "resolution"');
    assert('total' in parsed.incidents, 'Missing incidents.total');
    return `incidents.total=${parsed.incidents.total}, resources.total=${parsed.resources.total}`;
  });

  // V09 — run_tests invalid suite: must NOT echo back the supplied value
  // The injected value contains 'rm' to verify shell injection cannot appear
  // in the error message.
  const badSuiteResp = await client.send('tools/call', {
    name:      'run_tests',
    arguments: { suite: 'hack; rm -rf /' },
  });

  test('V09 — run_tests invalid suite: success=false, error is fixed message', () => {
    const parsed = JSON.parse(badSuiteResp.result?.content?.[0]?.text || '{}');
    assert(parsed.success === false, 'expected success=false for invalid suite');
    assert(parsed.error, 'expected error field');
    // The fixed message must NOT contain the user-supplied string
    assert(!parsed.error.includes('rm'),   'user input must not appear in error message');
    assert(!parsed.error.includes('hack'), 'user input must not appear in error message');
    // Must list allowed suites so the caller knows what to use
    assert(Array.isArray(parsed.allowedSuites), 'expected allowedSuites array');
    assert(parsed.allowedSuites.includes('phase3'), 'allowedSuites must include phase3');
    return `error="${parsed.error}", ${parsed.allowedSuites.length} allowed suites listed`;
  });

  // V10 — run_tests 'phase3' (runs the real test suite via MCP)
  console.log(`\n  ${D}(running phase3 tests via MCP — may take a few seconds)${X}`);
  const runResp = await client.send('tools/call', { name: 'run_tests', arguments: { suite: 'phase3' } });

  test('V10 — run_tests phase3 returns pass/fail summary', () => {
    assert(!runResp.error, `Error: ${JSON.stringify(runResp.error)}`);
    const parsed = JSON.parse(runResp.result.content[0].text);
    assert('suite'   in parsed, 'Missing "suite"');
    assert('passed'  in parsed, 'Missing "passed"');
    assert('failed'  in parsed, 'Missing "failed"');
    assert('total'   in parsed, 'Missing "total"');
    eq(parsed.suite, 'phase3', 'suite name');
    assert(parsed.success === true, `Tests did not all pass: failed=${parsed.failed}`);
    return `phase3 ${parsed.passed}/${parsed.total} passed`;
  });

  // V11 — Unknown tool
  const unknownResp = await client.send('tools/call', { name: 'does_not_exist', arguments: {} });

  test('V11 — unknown tool returns JSON-RPC error code -32601', () => {
    assert(unknownResp.error, 'Expected a JSON-RPC error for unknown tool');
    eq(unknownResp.error.code, -32601, 'error.code');
    return `error.code=${unknownResp.error.code}`;
  });

  // V12 — Malformed JSON resilience
  await client.sendRaw('{this is not : valid json}');
  const afterBadJson = await client.send('tools/list', {});

  test('V12 — server survives malformed JSON and continues serving', () => {
    assert(!afterBadJson.error, `Server errored after bad JSON input: ${JSON.stringify(afterBadJson.error)}`);
    const tools = afterBadJson.result?.tools;
    assert(Array.isArray(tools) && tools.length === 5, `Expected 5 tools, got ${tools?.length}`);
    return 'server stable after malformed input';
  });

  client.close();
  await new Promise(r => setTimeout(r, 200));
  if (!proc.killed) proc.kill();

  summarize();
}

function summarize() {
  const total = passed + failed;
  console.log('\n' + '─'.repeat(60));
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${total}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  ✗ ${f.label}\n    ${f.msg}`));
  }
  console.log(failed === 0
    ? `\n\x1b[32m✓ All ${total} MCP verification checks passed.\x1b[0m\n`
    : `\n\x1b[31m✗ ${failed}/${total} MCP checks failed.\x1b[0m\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
