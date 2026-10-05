# ResQGrid Core — Design

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec type:** Kiro native feature spec — design document
**Status:** Implemented

---

## Overview

ResQGrid is a single-page application (SPA) for campus and community emergency
resource coordination. It is built entirely with vanilla HTML, CSS, and JavaScript
(ES modules) — no frameworks, no build step, no external runtime dependencies.
Coordinators use it to report incidents, track and assign resources, get
rule-based decision support, and view live statistics. All data is persisted in
`localStorage`; the application runs fully offline in any modern browser.

> **Disclaimer:** This is an educational prototype. Do not use in real emergencies.

---

## Architecture

ResQGrid is a **single-page application (SPA)** built with vanilla HTML, CSS,
and JavaScript (ES modules). It requires no build step, no package manager, and
no server-side runtime — a static file server is sufficient.

```
Browser
  └── index.html (single entry point)
        ├── main.css        — CSS tokens, reset, layout
        ├── components.css  — reusable UI components
        ├── responsive.css  — media-query breakpoints
        ├── enhancements.css — visual polish (loaded last)
        └── app.js (type="module") — application entry point
              ├── store.js          — localStorage abstraction
              ├── router.js         — hash-based SPA routing
              ├── utils.js          — shared constants & helpers
              ├── services/
              │   ├── incidentService.js
              │   ├── resourceService.js
              │   ├── assistantService.js
              │   └── statsService.js
              └── ui/
                  ├── incidentList.js
                  ├── incidentForm.js
                  ├── incidentDetail.js
                  ├── assignmentPanel.js
                  ├── resourceList.js
                  ├── resourceForm.js
                  ├── assistantPanel.js
                  ├── statsView.js
                  └── toast.js
```

**Key architectural constraints:**
- UI components call service functions only — never `localStorage` directly.
- Services call `storeGet`/`storeSet` only — never `localStorage` directly.
- `statsService` is a pure computation module — it accepts arrays as arguments
  and never reads from the store internally.
- `assistantService` is a pure rule engine — no DOM access, no store reads
  beyond log writing.

---

## Components and Interfaces

The application is divided into four layers: routing, storage, services, and UI components.
Each layer's responsibilities and public interfaces are documented below.

### Routing

Hash-based SPA routing is implemented in `router.js`.

**Routes:**

| Hash | Section element | Render function |
|------|----------------|-----------------|
| `#dashboard` | `#section-dashboard` | `renderDashboard(el)` |
| `#incidents` | `#section-incidents` | `renderIncidents(el)` |
| `#resources` | `#section-resources` | `renderResourcesSection(el)` |
| `#assistant` | `#section-assistant` | `renderAssistant(el)` |
| `#stats` | `#section-stats` | `renderStats(el)` |

Default route: `#dashboard` (used when hash is absent or unknown).

**Mechanism:**
1. `registerRoute(hash, renderFn)` stores render functions in a `Map`.
2. `initRouter()` attaches `window.addEventListener('hashchange', ...)` and
   renders the initial route immediately.
3. On each hash change: the matching `<section>` is shown (`hidden = false`),
   all others are hidden, `aria-hidden` is updated, the render function is
   called with the section element, and `document.title` is updated.
4. Navigation links receive `aria-current="page"` when active.

---

### LocalStorage Layer

All persistence flows through `store.js`.

**Storage keys (defined as `STORAGE_KEYS` constant):**

| Key | Content | Default |
|-----|---------|---------|
| `resqgrid_incidents` | JSON array of Incident objects | `[]` |
| `resqgrid_resources` | JSON array of Resource objects | `[]` |
| `resqgrid_assistant_log` | JSON array of AssistantLog objects | `[]` |
| `resqgrid_settings` | JSON object (UI preferences) | `{}` |

**`storeGet(key)`:**
1. If `localStorage` is unavailable, return a `structuredClone` of the default.
2. Call `localStorage.getItem(key)`. If null, return the default.
3. `JSON.parse` the raw string. If parse throws, log a warning, reset to default, return default.
4. Shape-validate: array keys must produce arrays; the settings key must produce a plain object. If the shape is wrong, reset to default and return default.
5. Return the parsed value.

**`storeSet(key, value)`:**
1. If `localStorage` is unavailable, return `false`.
2. `JSON.stringify(value)` and call `localStorage.setItem`. Return `true` on success.
3. Catch `QuotaExceededError` and other errors; log a warning; return `false`.

Services check the boolean return of `storeSet` and return `{ success: false, error: '...' }` to callers if a write fails — they never silently drop data.

---

## Data Models

Defined canonically in `.kiro/steering/data-models.md`.

### Incident

```jsonc
{
  "id": "INC-0001",              // INC- + 4-digit zero-padded, auto-generated, immutable
  "title": "...",                 // 5–100 chars
  "description": "...",           // 10–500 chars
  "type": "Fire",                 // enum: Fire|Medical|Security|Hazmat|Natural Disaster|Other
  "priority": "High",             // enum: Critical|High|Medium|Low
  "status": "Reported",           // enum: Reported|Active|In Progress|Resolved
  "location": "...",              // non-empty string
  "reportedBy": "...",            // non-empty string
  "reportedAt": "2024-03-15T09:30:00.000Z",  // ISO 8601 UTC, set at creation, immutable
  "updatedAt": "2024-03-15T09:35:00.000Z",   // ISO 8601 UTC, updated on every change
  "resolvedAt": null,             // ISO 8601 UTC when Resolved, null otherwise
  "assignedResources": ["RES-0001"],  // array of Resource IDs
  "notes": ""                     // free-text, may be empty string
}
```

**Status lifecycle (strictly enforced, no skips, no reversals):**
```
Reported → Active → In Progress → Resolved  (terminal)
```

### Resource

```jsonc
{
  "id": "RES-0001",              // RES- + 4-digit zero-padded, auto-generated, immutable
  "name": "Ambulance Unit 1",    // unique across all resources (case-insensitive)
  "type": "Ambulance",           // enum: Ambulance|Fire Truck|Police Unit|Hazmat Team|Medical Team|Utility Crew|Other
  "status": "Available",         // enum: Available|Deployed|Maintenance
  "location": "Main Campus Gate",
  "assignedTo": null,            // Incident ID when Deployed, null otherwise
  "addedAt": "2024-03-01T08:00:00.000Z"  // ISO 8601 UTC, immutable
}
```

**Resource status lifecycle:**
```
Available ──→ Deployed (assign)      Deployed ──→ Available (release / incident resolved)
Available ──→ Maintenance (manual)   Maintenance ──→ Available (manual clear)
Deployed cannot go directly to Maintenance — must release first.
```

### AssistantLog

```jsonc
{
  "id": "LOG-0001",
  "inputDescription": "...",
  "suggestedType": "Fire",
  "suggestedPriority": "High",
  "suggestedResources": ["Fire Truck", "Medical Team"],
  "confidence": "High",          // High|Medium|Low
  "matchedKeywords": ["smoke", "lab"],
  "accepted": false,             // true if coordinator clicked Accept
  "timestamp": "2024-03-15T10:15:00.000Z"
}
```

### ID Generation

`generateId(prefix, existingItems)` in `utils.js`:
1. Scan all existing item IDs for the pattern `PREFIX-(\d{4})`.
2. Find the maximum numeric suffix.
3. Return `PREFIX-` + `(max + 1)` zero-padded to 4 digits.

---

### Service Layer

### incidentService.js

Owns `resqgrid_incidents`. Exported public API:

| Function | Behavior |
|----------|----------|
| `registerReleaseHook(fn)` | Registers `resourceService.releaseResource` to be called on incident resolution; avoids circular import |
| `validateIncident(fields)` | Returns `{ valid, errors }` — title 5–100, description 10–500, location non-empty, type enum, priority enum, reportedBy non-empty |
| `checkDuplicate(fields)` | Same type+location within 5 minutes → warning string, else null |
| `createIncident(fields)` | Validate → build object with auto ID/timestamps/defaults → append → write |
| `getAllIncidents()` | Read full array |
| `getIncidentById(id)` | Find by ID or return null |
| `updateIncidentStatus(id, newStatus)` | Enforce `NEXT_STATUS` map; set resolvedAt on Resolved; call release hook; update updatedAt |
| `getNextStatus(currentStatus)` | Return next valid status or null (Resolved) |
| `updateIncidentNotes(id, notes)` | Accept empty string; reject non-string; update updatedAt |
| `updateIncident(id, updates)` | Merge updates; protect id/reportedAt/status/resolvedAt/assignedResources; re-validate |
| `deleteIncident(id)` | Only if status === "Resolved" |
| `searchIncidents(incidents, query)` | Pure; case-insensitive match on title/description/location |
| `filterIncidents(incidents, filters)` | Pure; AND logic; null/undefined values skip that filter |
| `sortIncidents(incidents, sortBy, dir)` | Pure; returns new array; does not mutate input |
| `getFilteredIncidents(options)` | Pipeline: search → filter → sort |
| `addResourceToIncident(incidentId, resourceId)` | Called by resourceService during assign |
| `removeResourceFromIncident(incidentId, resourceId)` | Called by resourceService during release |

**Circular dependency avoidance:** `incidentService` exports `registerReleaseHook`;
`resourceService` calls `releaseResource` via this hook rather than importing
`incidentService` directly.

### resourceService.js

Owns `resqgrid_resources`; cross-writes `resqgrid_incidents` for assignment sync.

| Function | Behavior |
|----------|----------|
| `validateResource(fields, excludeId)` | Name non-empty + globally unique (excludeId skips own record), type enum, location non-empty |
| `repairOrphans()` | Reset resources whose `assignedTo` references a missing incident |
| `createResource(fields)` | Validate → build with auto ID/timestamp → append → write |
| `getAllResources()` | Read full array |
| `getResourceById(id)` | Find by ID or return null |
| `getAvailableResourcesByType(type)` | Filter status === Available, optionally by type |
| `updateResource(id, fields)` | Update name/type/location; re-validate uniqueness excluding self |
| `deleteResource(id)` | Block if Deployed |
| `assignResource(resourceId, incidentId)` | Validate both records → set Deployed+assignedTo → update incident.assignedResources → atomic rollback on write failure |
| `releaseResource(resourceId)` | Set Available+assignedTo=null → update incident.assignedResources → atomic rollback on write failure |
| `setMaintenance(id)` | Set status=Maintenance (blocked if Deployed) |
| `clearMaintenance(id)` | Set status=Available |
| `searchResources / filterResources / sortResources / getFilteredResources` | Pure helpers; same pattern as incident equivalents |

**Atomic write pattern for assign/release:**
```
1. Mutate both arrays in memory
2. Write resources first (savedR)
3. If savedR fails → return { success: false } (nothing written)
4. Write incidents (savedI)
5. If savedI fails → rollback resources write → return { success: false }
6. Both written → return { success: true }
```

### assistantService.js

Pure rule engine. No DOM access. No store reads except for log writing.

**Internal pipeline for `analyze(description)`:**
```
normalize(description)        → lowercase, trim, collapse whitespace
    ↓
matchRules(normalized)        → iterate RULE_CATEGORIES, collect { type, keyword, isLocationBoost }
    ↓
scoreMatches(matches)         → count per category, pick winner, compute disambiguation bonus
    ↓
determinePriority(normalized, winningType)  → check SEVERITY_KEYWORDS in priority order
    ↓
buildResources(winningType)   → look up RESOURCE_MAP
    ↓
calculateConfidence(totalScore) → 0→Low(fallback), 1→Low, 2–3→Medium, 4+→High
    ↓
buildExplanation(matches, winType, isFallback)
    ↓
AssistantResult object
```

**Exported constants:** `RULE_CATEGORIES`, `SEVERITY_KEYWORDS`,
`TYPE_DEFAULT_PRIORITY`, `RESOURCE_MAP` — all rules live in these constants;
none are scattered through logic.

**Confidence thresholds:**

| Score | Level |
|-------|-------|
| 0 | Low (fallback — type = Other) |
| 1 | Low |
| 2–3 | Medium |
| ≥ 4 | High |

**Fallback result** (score = 0):
```js
{ suggestedType: 'Other', suggestedPriority: 'Medium', suggestedResources: [],
  confidence: 'Low', matchedKeywords: [], isFallback: true }
```

`analyze()` wraps everything in try/catch and always returns a valid object — never throws.

### statsService.js

Pure computation module. Takes arrays as arguments; no store access.

**`compute(incidents, resources)` → `StatsResult`:**

```
StatsResult {
  incidents: {
    total, active (status ≠ Resolved), critical (priority = Critical), resolved,
    byType:     [{ label, count, pct }] for all 6 type enum values,
    byPriority: [{ label, count, pct }] for all 4 priority enum values,
    byStatus:   [{ label, count, pct }] for all 4 status enum values,
  },
  resources: {
    total, available, deployed, maintenance,
    utilization: deployed / (total − maintenance) × 100, or null if denominator = 0,
    byType:   [{ label, count, pct }] for all 7 resource type enum values,
    byStatus: [{ label, count, pct }] for all 3 resource status enum values,
  },
  resolution: {
    average:  mean duration in minutes (Resolved incidents only), or null,
    fastest:  min duration in minutes, or null,
    slowest:  max duration in minutes, or null,
  }
}
```

**Key rules:**
- `calcPercentages` returns `pct: 0` when total is 0 — never `NaN%`.
- All enum values always appear in breakdowns, even at count 0.
- `calcUtilization` excludes Maintenance from the denominator; returns null if no non-maintenance resources exist.
- `calcResolutionTimes` excludes resolved incidents with invalid timestamps or negative durations (resolvedAt < reportedAt).
- `compute()` wraps everything in try/catch; returns an empty result on unexpected errors.

---

### UI Layer

UI components are thin rendering modules that call service functions. They never
read from `localStorage` directly and contain no business logic.

| File | Responsibility |
|------|---------------|
| `incidentList.js` | Renders searchable/filterable/sortable incident list; toolbar with search, type/priority/status filters, sort, "Report Incident" button |
| `incidentForm.js` | Renders create/edit form; field-level validation feedback; calls `validateIncident` then `createIncident`/`updateIncident` |
| `incidentDetail.js` | Full incident detail view: status stepper, notes editor, assigned resources list, delete zone |
| `assignmentPanel.js` | Assignment UI within incident detail: lists available resources by type, assign/release buttons |
| `resourceList.js` | Searchable/filterable resource list; summary strip (Available / Deployed / Maintenance counts); per-card action buttons |
| `resourceForm.js` | Add/edit resource form; validates name uniqueness |
| `assistantPanel.js` | Description textarea + char counter + Analyze button; result panel with confidence badge, editable fields, Accept/Dismiss; on accept: calls `buildTransferPayload`, stores prefill in `_pendingPrefill`, navigates to incident form |
| `statsView.js` | Full statistics dashboard: 8 summary cards, 3 incident breakdowns, 2 resource breakdowns, resolution time section; all rendered from `statsService.compute()` output |
| `toast.js` | Non-blocking toast notifications (success, error, warning, info); auto-dismiss after 4 seconds |

### Assistant → Incident Form Transfer

```
User clicks "Accept" in assistantPanel
    ↓
assistantPanel calls app.js onAccept callback with buildTransferPayload(result, description)
    ↓
app.js stores payload in _pendingPrefill
    ↓
app.js navigates to #incidents and calls showFormView() after 50ms tick
    ↓
showFormView() reads and clears _pendingPrefill (one-time transfer)
    ↓
renderIncidentForm() receives prefill → pre-fills type, priority, description fields
    ↓
coordinator can still edit any field before submitting
```

---

### CSS Architecture

Four stylesheets loaded in order (later sheets override earlier ones):

| File | Purpose |
|------|---------|
| `main.css` | Design tokens (CSS custom properties with `--resq-` prefix), CSS reset, app layout (sidebar + topbar + main content) |
| `components.css` | Reusable component styles: buttons, badges, cards, forms, tables, toasts, stat bars |
| `responsive.css` | Media-query breakpoints: 480px, 768px, 1024px, 1280px; mobile-first approach |
| `enhancements.css` | Loaded last; visual polish layer (shadows, gradients, hover lifts, typography refinements, statistics table alignment fix) |

**Design token conventions (`main.css` `:root`):**
- Colors: `--resq-color-*` (brand, text, surface, borders, priority levels, status levels, incident types)
- Typography: `--resq-font-*` (sizes, weights, line heights)
- Spacing: `--resq-space-*` (4px scale: 1=4px, 2=8px, 3=12px, ...)
- Radii: `--resq-radius-*`
- Shadows: `--resq-shadow-*`

**`enhancements.css` section map:**

| Sections | Area |
|----------|------|
| 1–18 | Global: sidebar, topbar, summary cards, badges, buttons, alerts, stats, empty states, assistant, quicklinks, status track, toasts, toolbar, responsive |
| 19–26 | Incident management: toolbar, card priority tinting, detail headings, form, resources list, responsive |
| 27–35 | Resource management: cards, summary strip, assignment panel, form, responsive |
| 36–43 | Decision assistant: input, result panel, confidence badge, suggestion fields, explanation, actions |
| 44–51 | Statistics dashboard: toolbar, section headings, chart blocks, stat table rows, resolution cards, responsive, accessibility, reduced-motion |
| 52 | Statistics table column alignment fix (`table-layout: fixed`) |

---

### Validation Strategy

Field validation is centralized in service functions, not UI components.

### Incident validation (`validateIncident`)

| Field | Rule |
|-------|------|
| `title` | Required; 5–100 characters after trim |
| `description` | Required; 10–500 characters after trim |
| `location` | Required; non-empty after trim |
| `type` | Must be one of the 6 Incident Type enum values |
| `priority` | Must be one of the 4 Incident Priority enum values |
| `reportedBy` | Required; non-empty after trim |

Returns `{ valid: true }` or `{ valid: false, errors: { fieldName: "message", ... } }`.

### Resource validation (`validateResource`)

| Field | Rule |
|-------|------|
| `name` | Required; non-empty after trim; globally unique (case-insensitive); excludes own record on edit |
| `type` | Must be one of the 7 Resource Type enum values |
| `location` | Required; non-empty after trim |

### Helper functions in `utils.js`

- `isNonEmptyString(value)` — typeof string && trimmed length > 0
- `isWithinLength(value, min, max)` — non-empty string && trimmed length in [min, max]
- `isValidEnum(value, allowedValues)` — `Array.includes` check
- `isValidDate(isoString)` — `!isNaN(Date.parse(isoString))`

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Validation failure | Service returns `{ success: false, errors: {...} }`; UI renders field-level inline errors |
| LocalStorage write failure (quota exceeded) | Service returns `{ success: false, error: '...' }`; UI shows error toast |
| LocalStorage parse error | `storeGet` catches, resets to default, returns default; no crash |
| Invalid status transition | `updateIncidentStatus` returns `{ success: false, error: '...' }` |
| Unknown record ID | Service returns `{ success: false, error: '...' }` |
| `analyze()` throws internally | Caught by outer try/catch; fallback result returned |
| `statsService.compute()` throws | Caught; empty result returned; dashboard shows error banner |
| `localStorage` unavailable | Warning banner shown on startup; app continues with in-memory session only |
| Assignment write failure | Atomic rollback: if incident write fails after resource write, resource write is rolled back |

---

### MCP Integration

A local MCP server (`mcp/resqgrid-mcp-server.mjs`) exposes ResQGrid development
tools over the stdio JSON-RPC 2.0 transport used by Kiro.

**Available tools:**

| Tool | Description |
|------|-------------|
| `get_incidents` | List incidents from a data snapshot with optional filters |
| `get_resources` | List resources with optional filters |
| `validate_consistency` | Check incident↔resource assignment sync integrity |
| `get_statistics` | Compute summary metrics from snapshot data |
| `run_tests` | Run an approved test suite (hard-coded allowlist; no arbitrary execution) |

**Security:** `run_tests` validates the suite name against a `Set` before any shell
operation. Invalid values return a fixed literal error message — user input is
never interpolated into any string or command.

**Configuration:** `mcp/mcp-config.json` — copy to `~/.kiro/settings/mcp.json`
for Kiro to auto-connect.

---

### Kiro Configuration

The project includes a complete set of Kiro workspace configuration files.

### Steering files (`.kiro/steering/`)

| File | Inclusion | Purpose |
|------|-----------|---------|
| `project-standards.md` | always | Technology constraints, code style, naming, CSS, accessibility |
| `data-models.md` | always | Canonical data models, ID formats, enums, status transitions, sync rules |
| `testing-standards.md` | always | Test infrastructure, conventions, property-based testing guidance, spec traceability |
| `resqgrid-power.md` | auto | Spec-driven workflow guide, test commands, architecture quick-reference |

### Specs (`.kiro/specs/`)

| File | Coverage |
|------|----------|
| `incident-management.md` | IM-F01–F18: full incident CRUD lifecycle |
| `resource-management.md` | RM-F01–F21: resource CRUD, assign, release, maintenance |
| `decision-assistant.md` | DA-F01–F15: rule-based keyword classifier |
| `statistics-dashboard.md` | SD-F01–F14: on-demand stats, bar charts, resolution time |
| `incident-service-validation.md` | ISV-F01–F45: service-layer acceptance criteria with test traceability |

### Hooks (`.kiro/hooks/`)

| File | Trigger | Purpose |
|------|---------|---------|
| `kironomics.json` | PostToolUse / UserPromptSubmit / Stop | Kiro usage tracking |
| `test-on-service-save.json` | PostFileSave (`assets/js/services/*.js`) | Auto-runs test suites on service file save |

### Custom agent (`.kiro/agents/`)

| File | Name | Purpose |
|------|------|---------|
| `resqgrid-qa-agent.md` | ResQGrid QA & Specification Compliance Agent | Read-only QA review against specs, steering, and tests |

### Skills (`.kiro/skills/`)

| File | Purpose |
|------|---------|
| `resqgrid-dev-workflow.md` | Step-by-step spec-driven development guide; activated on demand |

---

## Correctness Properties

These invariants must hold at all times across the service layer. They are verified
by the property-based test suite (`test-property-based.mjs`, invariants P01–P27).

| # | Invariant |
|---|-----------|
| P01 | No resource is simultaneously `Available` and has a non-null `assignedTo`. |
| P02 | No resource is `Deployed` with `assignedTo === null`. |
| P03 | `incident.assignedResources` and `resource.assignedTo` are always in sync (bi-directional). |
| P04 | Resolved incidents always have `resolvedAt !== null`. |
| P05 | Non-resolved incidents always have `resolvedAt === null`. |
| P06 | Statistics counts are never negative and never exceed their corresponding array lengths. |
| P07 | `sortIncidents` / `sortResources` never mutate the input array. |
| P08 | `filterIncidents` / `filterResources` use AND logic — results satisfy all applied filters. |
| P09 | All enum values always appear in breakdown arrays, even at count 0. |
| P10 | ID generation never produces collisions across a realistic number of records. |
| P11 | Resource uniqueness: no two resources share the same name (case-insensitive). |
| P12 | Resources in `Maintenance` status always have `assignedTo === null`. |
| P13 | `statsService.compute()` utilization is null when no non-maintenance resources exist. |
| P14 | Resolution time metrics return null when there are zero resolved incidents. |
| P15 | `analyze()` always returns a valid `AssistantResult` — never throws to the caller. |

---

## Testing Strategy

See `.kiro/steering/testing-standards.md` for the full specification.

**Framework:** Plain Node.js `.mjs` modules — no Jest, Vitest, or Mocha.
Browser globals (`localStorage`, `structuredClone`) are provided by
`test-globals-preload.cjs` using `node --require`.

**Test suites:**

| File | Command | Coverage |
|------|---------|----------|
| `test-phase3.mjs` | `node test-phase3.mjs` | Resource service (inlined stubs; 44 tests) |
| `test-production-modules.mjs` | `node --require ./test-globals-preload.cjs test-production-modules.mjs` | Resource + incident integration (46 tests) |
| `test-phase4.mjs` | `node --require ./test-globals-preload.cjs test-phase4.mjs` | Assistant service rule engine (60 tests) |
| `test-phase5.mjs` | `node --require ./test-globals-preload.cjs test-phase5.mjs` | Statistics service (45 tests) |
| `test-incident-service.mjs` | `node --require ./test-globals-preload.cjs test-incident-service.mjs` | Incident service (89 tests; covers ISV-F01–F45) |
| `test-property-based.mjs` | `node --require ./test-globals-preload.cjs test-property-based.mjs` | Invariant/property-based tests (29 tests; P01–P27) |
| `mcp/verify-mcp.mjs` | `node mcp/verify-mcp.mjs` | MCP server protocol (17 checks) |

**Total confirmed passing: 330 tests (313 service + 17 MCP), 0 failures.**

**Property-based testing** uses an inline `forAll(name, generators, property, runs)`
runner. Generators draw from explicit value pools (all incident types, priorities,
resource types, locations). Key invariants tested include: ID uniqueness, initial
state correctness, status transition exhaustiveness, assignment sync correctness,
sort non-mutation, filter AND correctness, stats non-negativity, and breakdown
sum correctness.

**Spec traceability:** Test labels reference requirement IDs (e.g.,
`test('4-char title rejected (ISV-F01)', ...)`). This creates a verifiable chain:
spec requirement → test label → passing test → verified behavior.
