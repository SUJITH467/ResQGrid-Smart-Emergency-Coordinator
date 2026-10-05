---
inclusion: auto
name: resqgrid-dev-power
description: Activates the ResQGrid development power — guides spec-driven workflow, test commands, data model rules, and project conventions for ResQGrid contributors and Kiro sessions.
---

# ResQGrid Development Power

## Overview

This power provides reusable ResQGrid-specific workflow guidance, project conventions,
and quick-reference resources for every Kiro session working on the project.

It is the workspace-level equivalent of an installed Kiro Power: it ships steering
(this file, auto-activated when relevant) and a skill
(`.kiro/skills/resqgrid-dev-workflow.md`, loaded on demand).

---

## What This Power Provides

### 1. Spec-Driven Development Workflow

Every feature in ResQGrid follows this pipeline:

```
Requirement → .kiro/specs/<feature>.md → Implementation → test-<feature>.mjs → Verification
```

Use the skill `.kiro/skills/resqgrid-dev-workflow.md` for step-by-step guidance.

### 2. Test Commands (Quick Reference)

```bash
node test-phase3.mjs
node --require ./test-globals-preload.cjs test-production-modules.mjs
node --require ./test-globals-preload.cjs test-phase4.mjs
node --require ./test-globals-preload.cjs test-phase5.mjs
node --require ./test-globals-preload.cjs test-incident-service.mjs
node --require ./test-globals-preload.cjs test-property-based.mjs
```

All suites must pass (`Failed: 0`) before any commit.

### 3. Architecture Rules

- **Vanilla JS only** — no React, no npm packages, no build step
- **LocalStorage via store.js only** — `storeGet(key)` / `storeSet(key, value)`
- **Service layer validates** all user input before any store write
- **No direct localStorage calls** from UI components
- Stats are **computed on demand** — never stored

### 4. Data Model Quick Reference

| Entity | ID Format | Example |
|--------|-----------|---------|
| Incident | `INC-NNNN` | `INC-0001` |
| Resource | `RES-NNNN` | `RES-0042` |
| Log entry | `LOG-NNNN` | `LOG-0007` |

Status lifecycle (incident):
```
Reported → Active → In Progress → Resolved  (terminal)
```

Resource status transitions:
```
Available → Deployed (via assign)   Deployed → Available (via release)
Available → Maintenance (manual)    Maintenance → Available (manual)
```

Assignment sync rule — always update both sides:
```
resource.assignedTo = incidentId   +   incident.assignedResources.push(resourceId)
resource.status = 'Deployed'
```

### 5. Existing Specifications

| Spec file | Feature |
|-----------|---------|
| `incident-management.md` | Full incident CRUD lifecycle |
| `resource-management.md` | Resource CRUD, assign, release, maintenance |
| `statistics-dashboard.md` | On-demand stats, bar charts, resolution time |
| `decision-assistant.md` | Rule-based keyword classifier |
| `incident-service-validation.md` | Direct unit test spec for incidentService.js |

---

## Power Location

```
.kiro/
├── steering/
│   └── resqgrid-power.md           ← this file (auto-activated steering)
└── skills/
    └── resqgrid-dev-workflow.md    ← step-by-step skill
```

---

## Note on Local vs Installed Powers

Kiro's installed Powers (like kironomics and aws-blocks) are published to an
external registry and provide MCP server tools. This ResQGrid power is a
**workspace-local power** — it ships its guidance as steering (auto-included)
and skills (on-demand) rather than as an MCP server, which is appropriate for
a vanilla JS project with no backend service.

The MCP integration for ResQGrid is implemented separately in `mcp/`.
