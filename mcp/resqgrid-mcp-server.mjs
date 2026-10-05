#!/usr/bin/env node
/**
 * mcp/resqgrid-mcp-server.mjs
 * ---------------------------
 * ResQGrid local MCP server — stdio transport (JSON-RPC 2.0).
 *
 * Implements the Model Context Protocol (MCP) specification so Kiro can
 * connect to it as a local tool provider.
 *
 * Communicates over stdin/stdout using newline-delimited JSON-RPC 2.0.
 * No npm packages required — pure Node.js 18+ built-ins only.
 *
 * SECURITY CONSTRAINTS
 * --------------------
 * - Reads data from mcp/data-snapshot.json (optional export); returns empty
 *   store responses if no snapshot exists.
 * - run_tests uses a hard-coded allowlist; user input is NEVER interpolated
 *   into any shell command or error message.
 * - No arbitrary shell execution. No filesystem writes. No secrets.
 * - Every tool validates inputs before executing.
 * - Invalid suite names produce a fixed error message that does not echo
 *   back the supplied value.
 *
 * AVAILABLE TOOLS
 * ---------------
 * 1. get_incidents        — List incidents with optional status/priority filter
 * 2. get_resources        — List resources with optional status/type filter
 * 3. validate_consistency — Cross-check incident↔resource assignment sync
 * 4. get_statistics       — Compute summary metrics from current data
 * 5. run_tests            — Run one approved ResQGrid test suite
 *
 * CONFIGURATION (Kiro mcp.json)
 * -----------------------------
 * Copy mcp/mcp-config.json into .kiro/settings/mcp.json or your user-level
 * ~/.kiro/settings/mcp.json so Kiro can discover and connect to this server.
 *
 * HOW TO TEST
 * -----------
 *   node mcp/verify-mcp.mjs
 */

import { createInterface } from 'node:readline';
import { execFile }        from 'node:child_process';
import { promisify }       from 'node:util';
import { resolve, join }   from 'node:path';
import { readFile }        from 'node:fs/promises';
import { existsSync }      from 'node:fs';
import { fileURLToPath }   from 'node:url';

const execFileAsync = promisify(execFile);

// ── Project root (one level up from mcp/) ─────────────────────────────────
const __dirname    = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Approved test suite allowlist ─────────────────────────────────────────
// ONLY these exact string keys are accepted by run_tests.
// Each entry maps to a fully hard-coded Node invocation — no user-supplied
// value ever reaches the shell. The key itself is validated by a Set lookup
// before anything else happens.
const ALLOWED_SUITES = new Set([
  'phase3',
  'production',
  'phase4',
  'phase5',
  'incident-service',
  'property-based',
]);

const TEST_SUITE_CONFIG = {
  'phase3': {
    description:    'Resource management tests (inlined stubs)',
    nodeArgs:       ['test-phase3.mjs'],
    requirePreload: false,
  },
  'production': {
    description:    'Resource + incident integration tests (production modules)',
    nodeArgs:       ['--require', './test-globals-preload.cjs', 'test-production-modules.mjs'],
    requirePreload: false,          // preload already in nodeArgs
  },
  'phase4': {
    description:    'Assistant service tests',
    nodeArgs:       ['--require', './test-globals-preload.cjs', 'test-phase4.mjs'],
    requirePreload: false,
  },
  'phase5': {
    description:    'Statistics service tests',
    nodeArgs:       ['--require', './test-globals-preload.cjs', 'test-phase5.mjs'],
    requirePreload: false,
  },
  'incident-service': {
    description:    'Incident service direct tests (ISV-F01–F45)',
    nodeArgs:       ['--require', './test-globals-preload.cjs', 'test-incident-service.mjs'],
    requirePreload: false,
  },
  'property-based': {
    description:    'Property-based invariant tests (P01–P27)',
    nodeArgs:       ['--require', './test-globals-preload.cjs', 'test-property-based.mjs'],
    requirePreload: false,
  },
};

// ── LocalStorage data reader ───────────────────────────────────────────────
// ResQGrid stores data in the browser's localStorage. During development the
// coordinator can export a snapshot via the browser console and save it as
// mcp/data-snapshot.json. If no snapshot exists the tools return empty-store
// responses with an explanatory note.
async function readSnapshot() {
  const snapshotPath = join(PROJECT_ROOT, 'mcp', 'data-snapshot.json');
  if (!existsSync(snapshotPath)) {
    return {
      incidents: [],
      resources: [],
      _note: 'No mcp/data-snapshot.json found. Export LocalStorage data from the browser console to populate live data.',
    };
  }
  try {
    const raw = await readFile(snapshotPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { incidents: [], resources: [], _note: 'mcp/data-snapshot.json exists but could not be parsed.' };
  }
}

// ── Tool: get_incidents ────────────────────────────────────────────────────
async function tool_get_incidents(args) {
  const { status, priority, limit } = args || {};
  const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

  const VALID_STATUSES   = new Set(['Reported', 'Active', 'In Progress', 'Resolved']);
  const VALID_PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);

  const data     = await readSnapshot();
  let incidents  = data.incidents || [];

  if (status !== undefined && status !== null) {
    if (!VALID_STATUSES.has(status)) {
      return { error: 'Invalid status filter', allowedValues: [...VALID_STATUSES] };
    }
    incidents = incidents.filter(i => i.status === status);
  }

  if (priority !== undefined && priority !== null) {
    if (!VALID_PRIORITIES.has(priority)) {
      return { error: 'Invalid priority filter', allowedValues: [...VALID_PRIORITIES] };
    }
    incidents = incidents.filter(i => i.priority === priority);
  }

  return {
    total:     incidents.length,
    returned:  Math.min(incidents.length, safeLimit),
    incidents: incidents.slice(0, safeLimit).map(i => ({
      id:                i.id,
      title:             i.title,
      type:              i.type,
      priority:          i.priority,
      status:            i.status,
      location:          i.location,
      reportedAt:        i.reportedAt,
      resolvedAt:        i.resolvedAt,
      assignedResources: i.assignedResources || [],
    })),
    filters_applied: { status: status || null, priority: priority || null },
    note: data._note || null,
  };
}

// ── Tool: get_resources ────────────────────────────────────────────────────
async function tool_get_resources(args) {
  const { status, type, limit } = args || {};
  const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

  const VALID_STATUSES = new Set(['Available', 'Deployed', 'Maintenance']);
  const VALID_TYPES    = new Set(['Ambulance','Fire Truck','Police Unit','Hazmat Team','Medical Team','Utility Crew','Other']);

  const data     = await readSnapshot();
  let resources  = data.resources || [];

  if (status !== undefined && status !== null) {
    if (!VALID_STATUSES.has(status)) {
      return { error: 'Invalid status filter', allowedValues: [...VALID_STATUSES] };
    }
    resources = resources.filter(r => r.status === status);
  }

  if (type !== undefined && type !== null) {
    if (!VALID_TYPES.has(type)) {
      return { error: 'Invalid type filter', allowedValues: [...VALID_TYPES] };
    }
    resources = resources.filter(r => r.type === type);
  }

  return {
    total:     resources.length,
    returned:  Math.min(resources.length, safeLimit),
    resources: resources.slice(0, safeLimit).map(r => ({
      id:         r.id,
      name:       r.name,
      type:       r.type,
      status:     r.status,
      location:   r.location,
      assignedTo: r.assignedTo,
      addedAt:    r.addedAt,
    })),
    filters_applied: { status: status || null, type: type || null },
    note: data._note || null,
  };
}

// ── Tool: validate_consistency ─────────────────────────────────────────────
async function tool_validate_consistency() {
  const data      = await readSnapshot();
  const incidents = data.incidents || [];
  const resources = data.resources || [];
  const issues    = [];

  const incidentMap = new Map(incidents.map(i => [i.id, i]));
  const resourceMap = new Map(resources.map(r => [r.id, r]));

  // R01 — Every resource.assignedTo must point to a real incident
  for (const res of resources) {
    if (res.assignedTo && !incidentMap.has(res.assignedTo)) {
      issues.push({ severity: 'ERROR', type: 'ORPHANED_RESOURCE', resourceId: res.id,
        message: `Resource ${res.id} (${res.name}) has assignedTo=${res.assignedTo} but that incident does not exist.` });
    }
  }

  // R02 — Deployed resource must have assignedTo set
  for (const res of resources) {
    if (res.status === 'Deployed' && !res.assignedTo) {
      issues.push({ severity: 'ERROR', type: 'DEPLOYED_WITHOUT_INCIDENT', resourceId: res.id,
        message: `Resource ${res.id} (${res.name}) is Deployed but assignedTo is null.` });
    }
    if (res.status === 'Available' && res.assignedTo) {
      issues.push({ severity: 'ERROR', type: 'AVAILABLE_WITH_INCIDENT', resourceId: res.id,
        message: `Resource ${res.id} (${res.name}) is Available but assignedTo=${res.assignedTo}.` });
    }
  }

  // R03 — Every incident.assignedResources entry must reference a real Deployed resource
  for (const inc of incidents) {
    for (const resId of (inc.assignedResources || [])) {
      const res = resourceMap.get(resId);
      if (!res) {
        issues.push({ severity: 'ERROR', type: 'MISSING_ASSIGNED_RESOURCE',
          incidentId: inc.id, resourceId: resId,
          message: `Incident ${inc.id} lists resource ${resId} in assignedResources but that resource does not exist.` });
      } else if (res.assignedTo !== inc.id) {
        issues.push({ severity: 'ERROR', type: 'ASSIGNMENT_MISMATCH',
          incidentId: inc.id, resourceId: resId,
          message: `Incident ${inc.id} lists ${resId} but resource.assignedTo=${res.assignedTo} (expected ${inc.id}).` });
      }
    }
  }

  // R04 — Resolved incidents should have no assigned resources
  for (const inc of incidents) {
    if (inc.status === 'Resolved' && (inc.assignedResources || []).length > 0) {
      issues.push({ severity: 'WARNING', type: 'RESOLVED_WITH_RESOURCES', incidentId: inc.id,
        message: `Resolved incident ${inc.id} still has ${inc.assignedResources.length} assigned resource(s).` });
    }
  }

  // R05 — Resolved incidents must have resolvedAt set
  for (const inc of incidents) {
    if (inc.status === 'Resolved' && !inc.resolvedAt) {
      issues.push({ severity: 'WARNING', type: 'RESOLVED_WITHOUT_TIMESTAMP', incidentId: inc.id,
        message: `Incident ${inc.id} is Resolved but resolvedAt is null/missing.` });
    }
  }

  const errorCount   = issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;

  return {
    consistent: issues.length === 0,
    errors:     errorCount,
    warnings:   warningCount,
    issues,
    summary: issues.length === 0
      ? 'No consistency issues found.'
      : `${errorCount} error(s) and ${warningCount} warning(s) found.`,
    checked: { incidents: incidents.length, resources: resources.length },
    note: data._note || null,
  };
}

// ── Tool: get_statistics ───────────────────────────────────────────────────
async function tool_get_statistics() {
  const data      = await readSnapshot();
  const incidents = data.incidents || [];
  const resources = data.resources || [];

  const total    = incidents.length;
  const active   = incidents.filter(i => i.status !== 'Resolved').length;
  const resolved = incidents.filter(i => i.status === 'Resolved').length;
  const critical = incidents.filter(i => i.priority === 'Critical').length;

  const TYPES      = ['Fire','Medical','Security','Hazmat','Natural Disaster','Other'];
  const PRIORITIES = ['Critical','High','Medium','Low'];
  const STATUSES   = ['Reported','Active','In Progress','Resolved'];

  const byType     = TYPES.map(t      => ({ type: t,      count: incidents.filter(i => i.type === t).length }));
  const byPriority = PRIORITIES.map(p => ({ priority: p,  count: incidents.filter(i => i.priority === p).length }));
  const byStatus   = STATUSES.map(s   => ({ status: s,    count: incidents.filter(i => i.status === s).length }));

  const resTotal    = resources.length;
  const available   = resources.filter(r => r.status === 'Available').length;
  const deployed    = resources.filter(r => r.status === 'Deployed').length;
  const maintenance = resources.filter(r => r.status === 'Maintenance').length;
  const nonMaint    = resTotal - maintenance;
  const utilization = nonMaint > 0 ? Math.round((deployed / nonMaint) * 1000) / 10 : null;

  const resolvedWithTimes = incidents.filter(i =>
    i.status === 'Resolved' && i.resolvedAt && i.reportedAt &&
    !isNaN(Date.parse(i.resolvedAt)) && !isNaN(Date.parse(i.reportedAt))
  );
  const durations = resolvedWithTimes
    .map(i => (Date.parse(i.resolvedAt) - Date.parse(i.reportedAt)) / 60000)
    .filter(d => d >= 0);
  const avgMinutes = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10
    : null;

  return {
    incidents: { total, active, resolved, critical, byType, byPriority, byStatus },
    resources: { total: resTotal, available, deployed, maintenance, utilization_pct: utilization },
    resolution: { average_minutes: avgMinutes, sample_count: durations.length },
    note: data._note || null,
  };
}

// ── Tool: run_tests ────────────────────────────────────────────────────────
// SECURITY: the `suite` argument is validated against ALLOWED_SUITES (a Set)
// before any other operation. If validation fails, a FIXED error message is
// returned that does NOT interpolate or echo the user-supplied value.
// The node invocation uses a fully hard-coded args array looked up from
// TEST_SUITE_CONFIG — the user input never touches the shell.
async function tool_run_tests(args) {
  const { suite } = args || {};

  // Step 1 — type check (must be a non-empty string)
  if (!suite || typeof suite !== 'string') {
    return {
      success:       false,
      error:         'Missing required argument "suite".',
      allowedSuites: [...ALLOWED_SUITES],
    };
  }

  // Step 2 — strict allowlist check. If the value is not in the Set, return
  // a FIXED error message. The invalid value is NEVER included in any string.
  if (!ALLOWED_SUITES.has(suite)) {
    return {
      success:       false,
      error:         'Unsupported test suite.',
      allowedSuites: [...ALLOWED_SUITES],
    };
  }

  // Step 3 — look up the fully hard-coded config for this suite name
  const config = TEST_SUITE_CONFIG[suite];  // guaranteed to exist at this point

  try {
    const { stdout, stderr } = await execFileAsync('node', config.nodeArgs, {
      cwd:     PROJECT_ROOT,
      timeout: 120_000,
      env:     { ...process.env },
    });

    const summaryMatch = stdout.match(/Passed:\s*(\d+)\s+Failed:\s*(\d+)\s+Total:\s*(\d+)/);
    const passedCount  = summaryMatch ? parseInt(summaryMatch[1]) : null;
    const failedCount  = summaryMatch ? parseInt(summaryMatch[2]) : null;
    const totalCount   = summaryMatch ? parseInt(summaryMatch[3]) : null;

    return {
      success:      failedCount !== null ? failedCount === 0 : true,
      suite,
      description:  config.description,
      passed:       passedCount,
      failed:       failedCount,
      total:        totalCount,
      stdout:       stdout.slice(0, 4000),
      stderr_note:  stderr ? 'stderr had output (logger warnings — expected)' : null,
    };
  } catch (err) {
    return {
      success:     false,
      suite,
      description: config.description,
      error:       'Test suite execution failed.',
      details:     err.message,
      stdout:      err.stdout ? err.stdout.slice(0, 2000) : null,
    };
  }
}

// ── MCP tool schema definitions ────────────────────────────────────────────
const TOOLS = [
  {
    name:        'get_incidents',
    description: 'List ResQGrid incidents from the current data snapshot. Supports optional filtering by status and priority.',
    inputSchema: {
      type: 'object',
      properties: {
        status:   { type: 'string', enum: ['Reported','Active','In Progress','Resolved'], description: 'Filter by incident status' },
        priority: { type: 'string', enum: ['Critical','High','Medium','Low'],             description: 'Filter by incident priority' },
        limit:    { type: 'number', minimum: 1, maximum: 200, default: 50,               description: 'Max results to return (default 50)' },
      },
      required: [],
    },
  },
  {
    name:        'get_resources',
    description: 'List ResQGrid resources from the current data snapshot. Supports optional filtering by status and type.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Available','Deployed','Maintenance'],                                              description: 'Filter by resource status' },
        type:   { type: 'string', enum: ['Ambulance','Fire Truck','Police Unit','Hazmat Team','Medical Team','Utility Crew','Other'], description: 'Filter by resource type' },
        limit:  { type: 'number', minimum: 1, maximum: 200, default: 50,                                                    description: 'Max results to return (default 50)' },
      },
      required: [],
    },
  },
  {
    name:        'validate_consistency',
    description: 'Cross-check incident/resource assignment consistency. Detects orphaned resources, assignment mismatches, and resolved incidents with remaining resources.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'get_statistics',
    description: 'Compute ResQGrid summary statistics: incident counts by type/priority/status, resource utilization, and average resolution time.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'run_tests',
    description: 'Run one of the approved ResQGrid test suites. Only pre-approved suite names are accepted — no arbitrary command execution.',
    inputSchema: {
      type: 'object',
      properties: {
        suite: {
          type:        'string',
          enum:        [...ALLOWED_SUITES],
          description: 'Name of the test suite to run.',
        },
      },
      required: ['suite'],
    },
  },
];

// ── JSON-RPC 2.0 / MCP stdio transport ────────────────────────────────────

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

let initialized = false;

async function handleMessage(msg) {
  let parsed;
  try {
    parsed = JSON.parse(msg);
  } catch {
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { id, method, params } = parsed;

  if (method === 'initialize') {
    initialized = true;
    sendResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo:      { name: 'resqgrid-mcp-server', version: '1.0.0' },
      capabilities:    { tools: {} },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;  // notification — no response required
  }

  if (!initialized) {
    sendError(id, -32002, 'Server not initialized. Send initialize first.');
    return;
  }

  if (method === 'tools/list') {
    sendResult(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    let content;
    try {
      switch (name) {
        case 'get_incidents':        content = await tool_get_incidents(toolArgs);       break;
        case 'get_resources':        content = await tool_get_resources(toolArgs);       break;
        case 'validate_consistency': content = await tool_validate_consistency();        break;
        case 'get_statistics':       content = await tool_get_statistics();              break;
        case 'run_tests':            content = await tool_run_tests(toolArgs);           break;
        default:
          sendError(id, -32601, `Method not found: unknown tool "${name}"`);
          return;
      }
    } catch (err) {
      sendError(id, -32603, `Internal error: ${err.message}`);
      return;
    }

    sendResult(id, { content: [{ type: 'text', text: JSON.stringify(content, null, 2) }] });
    return;
  }

  sendError(id, -32601, `Method not found: "${method}"`);
}

// ── Start: read newline-delimited JSON from stdin ─────────────────────────
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) handleMessage(trimmed);
});

process.stderr.write('[resqgrid-mcp] Server started. Waiting for MCP messages on stdin.\n');
