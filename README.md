# ResQGrid — Smart Emergency Resource Coordinator

> ⚠️ **Educational Prototype.** ResQGrid is built for learning purposes only.
> Do not use it in real emergencies. Always follow official emergency procedures
> and contact trained responders.

ResQGrid is a browser-based prototype for campus and community emergency coordination.
It lets a coordinator log incidents, manage response resources, get rule-based
classification suggestions, and review operational statistics — entirely in the
browser with no backend required.

**Live repository:** https://github.com/SUJITH467/ResQGrid-Smart-Emergency-Coordinator

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
9. [Known Limitations](#known-limitations)
10. [Future Improvements](#future-improvements)

---

## Overview

### Problem Statement

During a campus or community emergency, coordinators need a single place to:

- Record what is happening and where (incidents)
- Track which response units are available, deployed, or in maintenance (resources)
- Quickly decide what type of incident they are dealing with and what to send (decision support)
- Understand trends and response times after the event (statistics)

ResQGrid demonstrates how these workflows could be designed as a cohesive web
application. Because it is an educational prototype it stores all data in the
browser's LocalStorage and requires no server, login, or external service.

---

## Features

### Incident Management

- Report new incidents with title, description, type, priority, location, and reporter name.
- View all incidents in a searchable, filterable, sortable list.
- Filter by type, priority, and status; sort by date or priority.
- Open an incident detail page showing full metadata and a status progress stepper.
- Advance status through the defined lifecycle: **Reported → Active → In Progress → Resolved**.
- Resolving an incident automatically releases all assigned resources.
- Add or update free-text coordinator notes on any incident.
- Delete unresolved incidents from the danger zone.

### Resource Management

- Add, edit, and delete response resources (ambulances, fire trucks, police units, etc.).
- View resources in a searchable, filterable list with live status indicators.
- Set a resource to **Maintenance** mode to take it out of rotation.
- Assign an **Available** resource to an active incident from the incident detail page.
- Release a resource back to **Available** from the same panel.
- Status summary strip shows Available / Deployed / Maintenance counts at a glance.

### Decision-Support Assistant

- Enter a plain-text description of an incident and click **Analyze**.
- The assistant uses keyword-matching rules (not AI or machine learning) to suggest:
  - Incident type
  - Priority level
  - Recommended resource types
- Confidence level (High / Medium / Low) reflects how many keyword rules matched.
- A full explanation and matched indicators are shown for transparency.
- The coordinator can edit the suggested type, priority, and resources inline before accepting.
- Accepting a suggestion pre-fills the incident report form and navigates to it automatically.
- Every analysis is logged to `resqgrid_assistant_log` in LocalStorage for audit purposes.
- The assistant is clearly labelled as a **rule-based prototype** — not an AI system.

### Statistics Dashboard

- Eight summary metric cards: active/critical/resolved/total incidents,
  available/deployed resources, utilisation rate, average resolution time.
- Incident breakdown by type, priority, and status as horizontal bar charts.
- Resource breakdown by type and status.
- Resolution time summary: average, fastest, and slowest.
- All statistics are computed on demand — nothing is stored separately.
- One-click **Refresh** button updates all numbers.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 (semantic elements throughout) |
| Styling | CSS3 — custom properties, Grid, Flexbox |
| Logic | Vanilla JavaScript (ES2020 modules) |
| Persistence | Browser `localStorage` |
| Routing | Custom hash-based SPA router |
| Testing | Node.js test scripts (`.mjs`) |
| Build tools | None — runs directly in any modern browser |
| Dependencies | None — no npm, no framework, no CDN imports |

---

## Architecture

ResQGrid is a single-page application (SPA) driven by URL hash routing.
`index.html` is the single entry point. JavaScript is split into focused ES modules
loaded via `<script type="module">`.

```
Browser loads index.html
  └─ app.js (entry point)
       ├─ store.js          — read/write LocalStorage helpers
       ├─ router.js         — hash-based route registration and activation
       ├─ utils.js          — shared constants, helpers, escapeHtml, logger
       ├─ services/
       │    ├─ incidentService.js   — incident CRUD, status transitions
       │    ├─ resourceService.js   — resource CRUD, assign/release/maintenance
       │    ├─ assistantService.js  — keyword-matching rules, log writing
       │    └─ statsService.js      — on-demand statistics computation
       └─ ui/
            ├─ incidentList.js      — searchable/filterable incident list
            ├─ incidentForm.js      — create/edit incident form with validation
            ├─ incidentDetail.js    — incident detail, status stepper, notes
            ├─ assignmentPanel.js   — assign/release resources within detail
            ├─ resourceList.js      — searchable/filterable resource list
            ├─ resourceForm.js      — create/edit resource form with validation
            ├─ assistantPanel.js    — assistant input, result display, transfer
            ├─ statsView.js         — statistics dashboard rendering
            └─ toast.js             — non-blocking notification toasts
```

**Data flow:**

- UI components call service functions only — they never access `localStorage` directly.
- Services use `store.js` (`store.get` / `store.set`) as the only localStorage interface.
- Statistics are derived on demand by `statsService.compute()` from the incidents and
  resources arrays — they are never stored.
- The assistant logs each analysis to `resqgrid_assistant_log` but its suggestions
  are advisory and never modify incident or resource records automatically.

**CSS layers** (applied in this order):

1. `main.css` — CSS custom-property tokens, reset, layout primitives
2. `components.css` — reusable UI components (buttons, badges, cards, forms, tables)
3. `responsive.css` — media-query overrides for all breakpoints
4. `enhancements.css` — visual polish layer loaded last; overrides only what it needs to

---

## Project Structure

```
ResQGrid-Smart-Emergency-Coordinator/
├── index.html                      # Single HTML entry point
│
├── assets/
│   ├── css/
│   │   ├── main.css                # Design tokens + reset + layout
│   │   ├── components.css          # Reusable UI component styles
│   │   ├── responsive.css          # Breakpoint overrides (480/768/1024/1280px)
│   │   └── enhancements.css        # Visual polish (loaded last)
│   │
│   └── js/
│       ├── app.js                  # Application entry point + route handlers
│       ├── router.js               # Hash-based SPA router
│       ├── store.js                # LocalStorage read/write helpers
│       ├── utils.js                # Constants, escapeHtml, logger
│       │
│       ├── services/
│       │   ├── incidentService.js  # Incident CRUD + status lifecycle
│       │   ├── resourceService.js  # Resource CRUD + assign/release/maintenance
│       │   ├── assistantService.js # Rule-based keyword classifier + audit log
│       │   └── statsService.js     # On-demand statistics computation
│       │
│       └── ui/
│           ├── incidentList.js     # Incident list with search/filter/sort
│           ├── incidentForm.js     # Incident create/edit form
│           ├── incidentDetail.js   # Incident detail + status stepper
│           ├── assignmentPanel.js  # Resource assignment within incident detail
│           ├── resourceList.js     # Resource list with search/filter/sort
│           ├── resourceForm.js     # Resource create/edit form
│           ├── assistantPanel.js   # Decision-support assistant UI
│           ├── statsView.js        # Statistics dashboard rendering
│           └── toast.js            # Toast notification system
│
├── .kiro/
│   ├── specs/                      # Kiro spec files used during development
│   │   ├── decision-assistant.md
│   │   ├── incident-management.md
│   │   ├── resource-management.md
│   │   └── statistics-dashboard.md
│   └── steering/
│       ├── project-standards.md    # Coding conventions and constraints
│       └── data-models.md          # Canonical data models and enums
│
├── test-phase3.mjs                 # Resource management test suite
├── test-production-modules.mjs     # Full integration test suite
├── test-phase5.mjs                 # Statistics service test suite
└── test-globals-preload.cjs        # Browser globals shim for Node.js tests
```

---

## Local Setup

ResQGrid requires no build step, no package manager, and no server-side runtime.
A local HTTP server is needed only because ES modules (`<script type="module">`)
cannot be loaded from `file://` URLs in most browsers.

### Option 1 — Node.js one-liner (recommended)

```bash
# From the project root:
node scratch/server.mjs
# Then open http://localhost:8085 in your browser
```

### Option 2 — VS Code Live Server extension

1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` → **Open with Live Server**.

### Option 3 — Python

```bash
# Python 3
python -m http.server 8080
# Then open http://localhost:8080
```

### Option 4 — Any static file server

Serve the project root directory over HTTP. There is no build output folder —
the source files are the deployment files.

### Browser requirements

Any modern browser supporting ES2020 modules is sufficient:
Chrome 80+, Firefox 80+, Safari 14+, Edge 80+.

The `:has()` CSS selector (used for priority-tinted incident card borders)
requires Chrome 105+, Firefox 121+, or Safari 15.4+. The layout degrades
gracefully if `:has()` is not supported — cards simply show a neutral border.

---

## How LocalStorage Is Used

All application data is stored in the browser's `localStorage` under these keys:

| Key | Contents |
|---|---|
| `resqgrid_incidents` | JSON array of Incident objects |
| `resqgrid_resources` | JSON array of Resource objects |
| `resqgrid_assistant_log` | JSON array of AssistantLog entries |
| `resqgrid_settings` | JSON object for UI preferences |

**Rules:**

- `store.js` is the only module that calls `localStorage` directly. All other modules
  use `store.get(key)` and `store.set(key, value)`.
- Every read is wrapped in a `try/catch`. If data fails schema validation,
  it is discarded and reset to an empty default — the app never crashes on corrupt data.
- No sensitive or personal data is stored. Location fields are building/room names only.
- Data persists between page refreshes within the same browser profile.
- Clearing browser storage or using private/incognito mode will reset all data.
- There is no server sync — data is local to the browser and device.

**ID formats:**

| Entity | Format | Example |
|---|---|---|
| Incident | `INC-` + 4-digit zero-padded integer | `INC-0001` |
| Resource | `RES-` + 4-digit zero-padded integer | `RES-0042` |
| Assistant log | `LOG-` + 4-digit zero-padded integer | `LOG-0007` |

IDs are immutable once assigned.

---

## Running the Tests

The tests use Node.js and run against the service layer directly.
They require Node.js 18 or later (ES module support).

```bash
# From the project root:

# Resource management — 44 tests
node test-phase3.mjs

# Full integration (resources + incidents + assignment) — 46 tests
node --require ./test-globals-preload.cjs test-production-modules.mjs

# Statistics service — 45 tests
node --require ./test-globals-preload.cjs test-phase5.mjs
```

**Expected output:**

```
Passed: 44  Failed: 0  Total: 44   ✓ All 44 tests passed.
Passed: 46  Failed: 0  Total: 46   ✓ All 46 production-module tests passed.
Passed: 45  Failed: 0  Total: 45   ✓ All 45 Phase 5 tests passed.
```

> **Note:** The production-modules and Phase 5 suites print logger warnings to
> stderr (validation failures, rollback messages). These are expected — they
> are part of the tests that verify error handling. PowerShell may report a
> non-zero exit code because of stderr output even when all tests pass; check
> the `Passed/Failed` summary line for the actual result.

The UI layer (HTML rendering, form interactions, routing) is not covered by
these suites. Functional testing of the UI requires a browser.

---

## Known Limitations

| Area | Limitation |
|---|---|
| **Single user** | There is no multi-user sync. Two browser tabs will diverge if both write data. |
| **No authentication** | Anyone with access to the page can read and modify all data. |
| **LocalStorage only** | Data is lost if browser storage is cleared or private mode is used. |
| **No real maps** | Location is a free-text field (building/room name) — no geolocation or mapping. |
| **Rule-based assistant** | The Decision-Support Assistant uses fixed keyword rules, not machine learning. It is advisory only and will miss edge cases. |
| **No notifications** | There are no push notifications or alerts when new incidents are created. |
| **No file uploads** | Incident attachments (photos, documents) are not supported. |
| **No print/export** | There is no PDF export or data export feature. |
| **No offline mode** | A local HTTP server is required to load ES modules. A `file://` URL will not work. |
| **Browser-specific storage** | Each browser profile has its own isolated LocalStorage. |

---

## Future Improvements

These are out of scope for the current prototype but represent natural next steps
if ResQGrid were developed further:

- **Backend persistence** — Replace LocalStorage with a REST API and a database so
  data survives browser clears and supports multiple users.
- **Real-time sync** — WebSockets or Server-Sent Events to push updates to all
  connected coordinators simultaneously.
- **Authentication and roles** — Coordinator login with role-based permissions
  (viewer, reporter, coordinator, admin).
- **Map integration** — Display incident and resource locations on an interactive map.
- **Improved classification** — Replace keyword rules with a more structured
  decision tree or a supervised classifier trained on historical incident data.
- **Push notifications** — Browser or mobile notifications when a new Critical
  incident is reported.
- **Data export** — CSV or PDF export of incident logs and statistics reports.
- **Offline support** — Service Worker + IndexedDB to allow the app to work offline
  and sync when connectivity is restored.
- **Audit trail** — Immutable log of all status changes with timestamps and user identities.
- **Accessibility audit** — Full WCAG 2.1 AA review with assistive technology testing.

---

## Disclaimer

ResQGrid is an **educational prototype** created as part of a learning exercise.
It is **not** production-ready, **not** a certified emergency-dispatch system,
and **not** suitable for use in any real emergency situation.

In a real emergency, contact your local emergency services immediately.
