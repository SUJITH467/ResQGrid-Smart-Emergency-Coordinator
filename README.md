# ResQGrid — Smart Emergency Resource Coordinator

> ⚠️ **Educational Prototype.** ResQGrid is built for learning purposes only.
> Do not use it in real emergencies. Always follow official emergency procedures
> and contact trained responders.

ResQGrid is a browser-based prototype for campus and community emergency coordination.
A coordinator can log incidents, manage response resources, get rule-based classification
suggestions, and review operational statistics — entirely in the browser with no backend,
no build step, and no external dependencies.

**Repository:** https://github.com/SUJITH467/ResQGrid-Smart-Emergency-Coordinator

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Local Setup](#local-setup)
7. [How LocalStorage Is Used](#how-localstorage-is-used)
8. [Running the Tests](#running-the-tests)
9. [MCP Server](#mcp-server)
10. [Kiro Workspace Configuration](#kiro-workspace-configuration)
11. [Known Limitations](#known-limitations)
12. [Future Improvements](#future-improvements)

---

## Overview

During a campus or community emergency, coordinators need a single place to:

- Record what is happening and where (incidents)
- Track which response units are available, deployed, or in maintenance (resources)
- Quickly decide what type of incident they are dealing with and what to dispatch (decision support)
- Review trends and response times (statistics)

ResQGrid demonstrates how these workflows could be designed as a cohesive web application.
All data lives in the browser's LocalStorage — no server, login, or external service required.

---

## Features

### Incident Management

- Report new incidents with title, description, type, priority, location, and reporter name.
- View all incidents in a searchable, filterable, sortable list.
- Filter by type, priority, and status; sort by date, priority, or lifecycle position.
- Open a full detail view showing metadata, a status progress stepper, notes, and assigned resources.
- Advance status through the defined lifecycle: **Reported → Active → In Progress → Resolved**.
- Resolving an incident automatically releases all assigned resources back to Available.
- Add or update free-text coordinator notes on any incident.
- Delete only Resolved incidents (active incidents are protected from accidental deletion).
- Duplicate detection warns when the same type and location are reported within 5 minutes.

### Resource Management

- Add, edit, and delete response resources (ambulances, fire trucks, police units, hazmat teams, etc.).
- View resources in a searchable, filterable list with live status badges.
- Set a resource to **Maintenance** mode to take it out of rotation without deleting it.
- Assign an **Available** resource to an active incident from the incident detail page.
- Release a resource back to **Available** from the assignment panel.
- Availability summary strip shows Available / Deployed / Maintenance counts at a glance.
- Assignment is atomic — both the resource and incident records are updated together with rollback on failure.
- Orphan repair runs on startup: resources pointing to deleted incidents are automatically reset.

### Decision-Support Assistant

- Enter a plain-text incident description and click **Analyze**.
- The assistant uses keyword-matching rules — **not AI or machine learning** — to suggest:
  - Incident type (Fire, Medical, Security, Hazmat, Natural Disaster, Other)
  - Priority level (Critical, High, Medium, Low)
  - Recommended resource types
- Confidence level (High / Medium / Low) reflects the total keyword match score.
- A full explanation shows exactly which keywords triggered the suggestion.
- Edit any suggested field inline before accepting.
- Accepting pre-fills the incident form and navigates to it automatically.
- Every analysis is logged to `resqgrid_assistant_log` for audit purposes.
- Clearly labelled as a **rule-based prototype** — never claims to be AI.

### Statistics Dashboard

- Eight summary metric cards: total, active, critical, and resolved incidents; available
  and deployed resources; utilisation rate; average resolution time.
- Incident breakdowns by type, priority, and status as accessible bar-chart tables.
- Resource breakdowns by type and status.
- Resolution time metrics: average, fastest, and slowest (in minutes, hours, or days).
- All statistics are computed on demand from LocalStorage — never stored separately.
- One-click **Refresh** button recomputes everything from the current data.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 — semantic elements throughout (`<nav>`, `<main>`, `<section>`, `<article>`) |
| Styling | CSS3 — custom properties, Grid, Flexbox, four-layer stylesheet architecture |
| Logic | Vanilla JavaScript (ES2020 modules, `<script type="module">`) |
| Persistence | Browser `localStorage` via a dedicated `store.js` abstraction |
| Routing | Custom hash-based SPA router (`router.js`) |
| Testing | Plain Node.js `.mjs` scripts — no Jest, Vitest, or Mocha |
| MCP | Local MCP server (`mcp/resqgrid-mcp-server.mjs`) over stdio JSON-RPC 2.0 |
| Build tools | None — runs directly in any modern browser |
| Dependencies | None — no npm, no framework, no CDN imports |

---

## Architecture

ResQGrid is a single-page application driven by URL hash routing. `index.html` is the
single entry point. Every JavaScript file is a focused ES module with a single
responsibility.

```
Browser loads index.html
  └─ app.js  (entry point — init, routing, wiring)
       ├─ store.js          — LocalStorage abstraction (storeGet / storeSet)
       ├─ router.js         — hash-based route registration and activation
       ├─ utils.js          — enum constants, ID generation, formatting, validation helpers
       │
       ├─ services/         — data layer (never touch localStorage directly from UI)
       │    ├─ incidentService.js   — incident CRUD, status lifecycle, search/filter/sort
       │    ├─ resourceService.js   — resource CRUD, assign/release/maintenance, orphan repair
       │    ├─ assistantService.js  — keyword rule engine, confidence scoring, audit logging
       │    └─ statsService.js      — pure on-demand statistics computation
       │
       └─ ui/               — rendering layer (calls services, never localStorage)
            ├─ incidentList.js      — searchable/filterable/sortable incident list
            ├─ incidentForm.js      — create/edit form with field-level validation
            ├─ incidentDetail.js    — detail view, status stepper, notes editor
            ├─ assignmentPanel.js   — assign/release resources within incident detail
            ├─ resourceList.js      — searchable/filterable resource list
            ├─ resourceForm.js      — create/edit resource form
            ├─ assistantPanel.js    — assistant input, result display, accept/dismiss
            ├─ statsView.js         — full statistics dashboard rendering
            └─ toast.js             — non-blocking success/error/warning notifications
```

**Layer rules:**
- UI components call service functions only — never `localStorage` directly.
- Services use `storeGet`/`storeSet` from `store.js` exclusively.
- `statsService` is a pure computation module — it accepts arrays as arguments and never reads from the store.
- `assistantService` is a pure rule engine — no DOM access, no store reads except for log writing.

**CSS layers** (applied in this order, later files override earlier):

| File | Purpose |
|------|---------|
| `main.css` | Design tokens (`--resq-*` CSS custom properties), reset, app layout |
| `components.css` | Reusable components — buttons, badges, cards, forms, tables, toasts |
| `responsive.css` | Mobile-first breakpoints: 480 / 768 / 1024 / 1280px |
| `enhancements.css` | Visual polish layer — shadows, hover lifts, typography refinements |

---

## Project Structure

```
ResQGrid-Smart-Emergency-Coordinator/
│
├── index.html                        # Single HTML entry point
│
├── assets/
│   ├── css/
│   │   ├── main.css                  # Design tokens + reset + layout
│   │   ├── components.css            # Reusable UI component styles
│   │   ├── responsive.css            # Breakpoint overrides
│   │   └── enhancements.css          # Visual polish (loaded last)
│   └── js/
│       ├── app.js                    # Application entry point + route handlers
│       ├── router.js                 # Hash-based SPA router
│       ├── store.js                  # LocalStorage read/write helpers
│       ├── utils.js                  # Constants, helpers, logger
│       ├── services/
│       │   ├── incidentService.js    # Incident CRUD + status lifecycle
│       │   ├── resourceService.js    # Resource CRUD + assign/release/maintenance
│       │   ├── assistantService.js   # Rule-based keyword classifier + audit log
│       │   └── statsService.js       # Pure statistics computation
│       └── ui/
│           ├── incidentList.js       # Incident list with search/filter/sort
│           ├── incidentForm.js       # Incident create/edit form
│           ├── incidentDetail.js     # Detail view + status stepper
│           ├── assignmentPanel.js    # Resource assignment panel
│           ├── resourceList.js       # Resource list with search/filter/sort
│           ├── resourceForm.js       # Resource create/edit form
│           ├── assistantPanel.js     # Decision-support assistant UI
│           ├── statsView.js          # Statistics dashboard
│           └── toast.js              # Toast notification system
│
├── mcp/
│   ├── resqgrid-mcp-server.mjs       # Local MCP server (5 tools, stdio JSON-RPC 2.0)
│   ├── mcp-config.json               # MCP config template (copy to .kiro/settings/)
│   └── verify-mcp.mjs                # MCP protocol verification script (17 checks)
│
├── .kiro/
│   ├── settings/
│   │   └── mcp.json                  # Workspace MCP config — registers resqgrid server
│   ├── agents/
│   │   └── resqgrid-qa-agent.md      # ResQGrid QA & Specification Compliance Agent
│   ├── hooks/
│   │   ├── kironomics.json           # Kiro usage tracking
│   │   └── test-on-service-save.json # Auto-runs tests on service file save
│   ├── specs/
│   │   ├── incident-management.md    # IM-F01–F18
│   │   ├── resource-management.md    # RM-F01–F21
│   │   ├── decision-assistant.md     # DA-F01–F15
│   │   ├── statistics-dashboard.md   # SD-F01–F14
│   │   ├── incident-service-validation.md  # ISV-F01–F45 (service-layer AC)
│   │   └── resqgrid-core/
│   │       ├── requirements.md       # Consolidated requirements
│   │       ├── design.md             # Full architecture document
│   │       └── tasks.md              # Implementation task breakdown
│   ├── steering/
│   │   ├── project-standards.md      # Tech constraints, coding style, conventions
│   │   ├── data-models.md            # Canonical data models and enum values
│   │   ├── testing-standards.md      # Test infrastructure and conventions
│   │   └── resqgrid-power.md         # Dev workflow guide (auto-activated)
│   ├── skills/
│   │   └── resqgrid-dev-workflow.md  # Step-by-step spec-driven development guide
│   └── lesson-evidence.md            # Kiro University lesson evidence document
│
├── test-globals-preload.cjs          # Browser globals shim for Node.js tests
├── test-phase3.mjs                   # Resource management tests (44)
├── test-production-modules.mjs       # Resource + incident integration tests (46)
├── test-phase4.mjs                   # Assistant rule engine tests (60)
├── test-phase5.mjs                   # Statistics service tests (45)
├── test-incident-service.mjs         # Incident service direct tests (89)
└── test-property-based.mjs           # Property/invariant-based tests (29)
```

---

## Local Setup

No build step, no package manager, no server-side runtime required. A local HTTP
server is needed only because ES modules cannot be loaded from `file://` URLs.

### Option 1 — Node.js (recommended)

```bash
# From the project root:
node scratch/server.mjs
# Open http://localhost:8085
```

### Option 2 — VS Code Live Server

1. Install the **Live Server** extension.
2. Right-click `index.html` → **Open with Live Server**.

### Option 3 — Python

```bash
python -m http.server 8080
# Open http://localhost:8080
```

### Browser requirements

Chrome 80+, Firefox 80+, Safari 14+, Edge 80+.

The `:has()` CSS selector (priority-tinted card borders) requires Chrome 105+,
Firefox 121+, or Safari 15.4+. The layout degrades gracefully without it.

---

## How LocalStorage Is Used

All data is stored in the browser's `localStorage` under four keys:

| Key | Contents |
|-----|----------|
| `resqgrid_incidents` | JSON array of Incident objects |
| `resqgrid_resources` | JSON array of Resource objects |
| `resqgrid_assistant_log` | JSON array of AssistantLog entries |
| `resqgrid_settings` | JSON object for UI preferences |

**Rules:**
- `store.js` is the only module that calls `localStorage` directly.
- Every read is wrapped in `try/catch` — corrupt data resets to an empty default.
- Shape validation ensures array keys produce arrays; the settings key produces an object.
- No sensitive personal data is stored. Locations are building/room names only.
- Data persists between page refreshes within the same browser profile.
- Clearing browser storage or using private/incognito mode resets all data.

**ID formats:**

| Entity | Format | Example |
|--------|--------|---------|
| Incident | `INC-` + 4-digit zero-padded integer | `INC-0001` |
| Resource | `RES-` + 4-digit zero-padded integer | `RES-0042` |
| Assistant log | `LOG-` + 4-digit zero-padded integer | `LOG-0007` |

IDs are auto-generated and immutable once assigned.

---

## Running the Tests

Tests run directly in Node.js against the production service layer. No browser
required. Node.js 18 or later needed.

```bash
# Resource management — 44 tests
node test-phase3.mjs

# Resource + incident integration — 46 tests
node --require ./test-globals-preload.cjs test-production-modules.mjs

# Assistant rule engine — 60 tests
node --require ./test-globals-preload.cjs test-phase4.mjs

# Statistics service — 45 tests
node --require ./test-globals-preload.cjs test-phase5.mjs

# Incident service direct tests (ISV-F01–F45) — 89 tests
node --require ./test-globals-preload.cjs test-incident-service.mjs

# Property-based invariant tests (P01–P27) — 29 tests
node --require ./test-globals-preload.cjs test-property-based.mjs
```

**Total: 313 tests, 0 failures.**

> **Windows PowerShell note:** Logger warnings print to stderr. PowerShell may
> report a non-zero exit code even when all tests pass. Always check the
> `Passed/Failed/Total` summary line, not just the exit code.

To verify the MCP server:

```bash
node mcp/verify-mcp.mjs   # 17 protocol checks, 0 failures
```

---

## MCP Server

ResQGrid includes a local [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes project data and test execution to Kiro and other MCP clients.

**Server:** `mcp/resqgrid-mcp-server.mjs`
**Transport:** stdio JSON-RPC 2.0 (no npm packages — pure Node.js built-ins)

### Available Tools

| Tool | Description |
|------|-------------|
| `get_incidents` | List incidents with optional status/priority filter |
| `get_resources` | List resources with optional status/type filter |
| `validate_consistency` | Cross-check incident↔resource assignment sync integrity |
| `get_statistics` | Compute summary metrics from the current data snapshot |
| `run_tests` | Run an approved test suite (hard-coded allowlist — no arbitrary execution) |

### Kiro Configuration

The workspace MCP config is at `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "resqgrid": {
      "command": "node",
      "args": ["mcp/resqgrid-mcp-server.mjs"],
      "disabled": false,
      "autoApprove": ["get_incidents", "get_resources", "validate_consistency",
                      "get_statistics", "run_tests"]
    }
  }
}
```

Kiro auto-connects on save. Check the **MCP Servers** tab in the Kiro panel to
confirm the `resqgrid` server is connected.

### Live Data Snapshot

The MCP tools read from `mcp/data-snapshot.json` (not the browser's localStorage,
which is inaccessible from Node.js). To populate live data, export from the browser
console:

```js
// Run in the browser console while the app is open:
copy(JSON.stringify({
  incidents: JSON.parse(localStorage.getItem('resqgrid_incidents') || '[]'),
  resources: JSON.parse(localStorage.getItem('resqgrid_resources') || '[]')
}, null, 2));
// Then paste the clipboard contents into mcp/data-snapshot.json
```

---

## Kiro Workspace Configuration

The `.kiro/` directory contains a complete workspace configuration for Kiro:

### Specs

Five feature specifications and one native Kiro spec under `.kiro/specs/`:

| File | Requirements |
|------|-------------|
| `incident-management.md` | IM-F01–F18: full incident lifecycle |
| `resource-management.md` | RM-F01–F21: resource CRUD, assignment, maintenance |
| `decision-assistant.md` | DA-F01–F15: rule engine, confidence, form transfer |
| `statistics-dashboard.md` | SD-F01–F14: on-demand stats, breakdowns, resolution time |
| `incident-service-validation.md` | ISV-F01–F45: service-layer acceptance criteria |
| `resqgrid-core/` | Native Kiro spec: requirements.md + design.md + tasks.md |

### Steering

Always-included steering files guide every Kiro session:

| File | Purpose |
|------|---------|
| `project-standards.md` | Tech constraints, code style, naming, accessibility |
| `data-models.md` | Canonical data models, enums, status transitions, sync rules |
| `testing-standards.md` | Test infrastructure, harness pattern, what to test |
| `resqgrid-power.md` | Dev workflow guide — auto-activated in relevant sessions |

### Hooks

| File | Trigger | Purpose |
|------|---------|---------|
| `test-on-service-save.json` | PostFileSave on `assets/js/services/*.js` | Auto-runs test suites on service file save |
| `kironomics.json` | PostToolUse / UserPromptSubmit / Stop | Kiro usage tracking |

### Custom Agent

`.kiro/agents/resqgrid-qa-agent.md` — **ResQGrid QA & Specification Compliance Agent**

A read-only Kiro agent that reviews the implementation against specifications,
steering documents, and tests. Reports findings with severity levels (CRITICAL /
HIGH / MEDIUM / LOW / INFO). Never makes destructive changes.

---

## Known Limitations

| Area | Limitation |
|------|-----------|
| **Single user** | No multi-user sync. Two browser tabs writing simultaneously will diverge. |
| **No authentication** | Anyone with page access can read and modify all data. |
| **LocalStorage only** | Data resets if browser storage is cleared or private mode is used. |
| **No maps** | Location is a free-text field — no geolocation or interactive maps. |
| **Rule-based assistant** | Uses fixed keyword rules, not machine learning. Advisory only. |
| **No notifications** | No push notifications when new incidents are created. |
| **No file uploads** | Incident attachments are not supported. |
| **No export** | No CSV or PDF export of data or reports. |
| **Requires HTTP server** | ES modules cannot load from `file://` URLs — a local server is needed. |
| **MCP snapshot** | MCP tools read from a file export, not live localStorage. |
| **Browser-specific storage** | Each browser profile has its own isolated data. |

---

## Future Improvements

- **Backend persistence** — REST API + database for multi-user support and data durability.
- **Real-time sync** — WebSockets or Server-Sent Events to push updates to all connected coordinators.
- **Authentication and roles** — Coordinator login with role-based permissions.
- **Map integration** — Display incident and resource locations on an interactive map.
- **Improved classification** — Replace keyword rules with a structured decision tree or trained model.
- **Push notifications** — Browser notifications for new Critical incidents.
- **Data export** — CSV or PDF export of incident logs and statistics.
- **Offline support** — Service Worker + IndexedDB for offline use with background sync.
- **Live MCP data** — Replace the snapshot approach with a small local proxy that reads localStorage directly.
- **Audit trail** — Immutable log of all status changes with timestamps and user identities.
- **Full accessibility audit** — WCAG 2.1 AA review with assistive technology testing.

---

## Disclaimer

ResQGrid is an **educational prototype**. It is **not** production-ready, **not** a
certified emergency-dispatch system, and **not** suitable for use in any real emergency.

In a real emergency, contact your local emergency services immediately.
