#





 Implementation Plan

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec type:** Kiro native feature spec — tasks document
**Status:** Implemented
**Derives from:** requirements.md · design.md
**Source specs:** incident-management.md · resource-management.md · decision-assistant.md · statistics-dashboard.md · incident-service-validation.md

---

## Overview

ResQGrid is a single-page, vanilla JS emergency resource coordinator built entirely without external runtime dependencies. The implementation is divided into nine sequential phases that move from foundational infrastructure (app shell, LocalStorage abstraction, shared utilities, CSS) through the four main feature domains (incident management, resource management, decision-support assistant, statistics dashboard), then cross-service property-based testing, MCP tooling integration, and Kiro workspace configuration.

Tasks are grouped by phase (foundation → features → testing → tooling). Every task that exists in the codebase is marked `[x]`. Requirement IDs trace each task back to requirements.md. Design section references (e.g. `[design §3]`) link to the matching design.md section.

**Run the full test suite to verify the implementation:**

```bash
node test-phase3.mjs
node --require ./test-globals-preload.cjs test-production-modules.mjs
node --require ./test-globals-preload.cjs test-phase4.mjs
node --require ./test-globals-preload.cjs test-phase5.mjs
node --require ./test-globals-preload.cjs test-incident-service.mjs
node --require ./test-globals-preload.cjs test-property-based.mjs
```

**Expected result:** 313 service tests + 17 MCP checks = 330 total, 0 failures.

---

## Task Dependency Graph

```
Phase 1 (Foundation)
  1.1 App Shell ──────────────────────────────────────────┐
  1.2 LocalStorage Abstraction ───────────────────────────┤
  1.3 Shared Utilities ───────────────────────────────────┤
  1.4 CSS Foundation ─────────────────────────────────────┘
          │
          ▼
Phase 2 (Incident Management)
  2.1 Incident Service ──────────────────────────────────┐
  2.2 Incident UI  (depends on 2.1) ─────────────────────┤
  2.3 Incident Validation Tests (depends on 2.1) ─────────┘
          │
          ▼
Phase 3 (Resource Management)
  3.1 Resource Service ──────────────────────────────────┐
      (depends on 2.1 for bi-directional sync)           │
  3.2 Resource UI  (depends on 3.1, 2.1) ────────────────┤
  3.3 Resource Tests (depends on 3.1, 2.1) ──────────────┘
          │
          ▼
Phase 4 (Decision-Support Assistant)
  4.1 Assistant Rule Engine ─────────────────────────────┐
  4.2 Assistant UI  (depends on 4.1, 2.1) ───────────────┤
  4.3 Assistant Tests (depends on 4.1) ───────────────────┘
          │
          ▼
Phase 5 (Statistics Dashboard)
  5.1 Statistics Service ────────────────────────────────┐
  5.2 Statistics UI  (depends on 5.1, 2.1, 3.1) ─────────┤
  5.3 Statistics Tests (depends on 5.1) ──────────────────┘
          │
          ▼
Phase 6 (Property-Based Testing)
  6.1 Cross-service invariant suite
      (depends on 2.1, 3.1, 5.1)
          │
          ▼
Phase 7 (MCP Integration)
  7.1–7.8 MCP server + verification
      (depends on Phases 1–5 services for snapshot data)
          │
          ▼
Phase 8 (Kiro Workspace Configuration)
  8.1 Steering Files ────────────────────────────────────┐
  8.2 Source Specs ───────────────────────────────────────┤
  8.3 Hooks ──────────────────────────────────────────────┤
  8.4 Custom Agent ───────────────────────────────────────┘
          │
          ▼
Phase 9 (Test Infrastructure)
  9.1–9.3 Preload shim + harness + baseline verification
      (underpins all test phases above)
```

Key constraints:
- Phase 1 must be complete before any feature phase begins (all services depend on `store.js` and `utils.js`).
- Phase 3 (`resourceService`) has a circular-import dependency with Phase 2 (`incidentService`) — resolved by the `registerReleaseHook` pattern in task 2.1.1.
- Phases 6 and 9 depend on all service phases being complete.
- Phase 7 (MCP) is independent of Phases 6, 8, and 9; it may be developed in parallel after Phase 5.
- Phase 8 (Kiro config) is independent and may be maintained incrementally throughout development.

---

## Tasks

### Phase 1 — Project Foundation

#### 1.1 Application Shell

Establishes the single-page application entry point, layout, and routing.
Satisfies: NF-01, NF-02 · [design §1 Architecture, §2 Routing]

- [x] **1.1.1** Create `index.html` as the single entry point with `<script type="module" src="assets/js/app.js">`.
- [x] **1.1.2** Define five `<section>` elements in `index.html` for routes: `#dashboard`, `#incidents`, `#resources`, `#assistant`, `#stats`.
- [x] **1.1.3** Build `assets/js/router.js` with `registerRoute(hash, renderFn)`, `initRouter()`, `navigateTo(hash)`, and `getCurrentRoute()`. Hash change listener shows/hides sections, updates `aria-hidden`, sets `document.title`, and calls the registered render function. Default route: `#dashboard`.
- [x] **1.1.4** Build `assets/js/app.js` as the application entry point: calls `initStore()`, `repairOrphans()`, registers all routes, calls `initRouter()`, and shows the storage-unavailable banner when `localStorage` is not accessible.

#### 1.2 LocalStorage Abstraction

Satisfies: NF-03, NF-04, NF-05, IM-F16, IM-F17, RM-F19, RM-F20 · [design §3 LocalStorage Layer]

- [x] **1.2.1** Create `assets/js/store.js` with `storeGet(key)` and `storeSet(key, value)`. `storeGet` handles unavailable storage, null keys, JSON parse errors, and shape validation (arrays must be arrays; settings must be a plain object). Returns `structuredClone` of the safe default on any failure.
- [x] **1.2.2** `storeSet` catches `QuotaExceededError` and other write errors, logs a warning via `logger`, and returns `false`. Returns `true` on success.
- [x] **1.2.3** Export `storeRemove(key)` and `isLocalStorageAvailable()` for cleanup and banner detection.
- [x] **1.2.4** Export `initStore()` that pre-populates missing keys with their defaults (`[]` for arrays, `{}` for settings) on app startup.
- [x] **1.2.5** Define `STORAGE_KEYS` constant with all four key names: `resqgrid_incidents`, `resqgrid_resources`, `resqgrid_assistant_log`, `resqgrid_settings`.

#### 1.3 Shared Utilities

Satisfies: NF-01, NF-07 · [design §4 ID Generation, §8 Validation Strategy]

- [x] **1.3.1** Create `assets/js/utils.js` with `generateId(prefix, existingItems)`: scans existing IDs for `PREFIX-(\d{4})`, finds the max suffix, returns `PREFIX-` + `(max+1)` zero-padded to 4 digits.
- [x] **1.3.2** Add `getNow()` returning the current UTC time as ISO 8601 string. Used everywhere a timestamp is required — never `new Date()` inline.
- [x] **1.3.3** Add `formatDate(isoString)` → human-readable `"DD MMM YYYY, HH:mm"` string; returns `"Unknown"` for falsy input.
- [x] **1.3.4** Add `formatRelativeTime(isoString)` → `"Just now"` / `"N min ago"` / `"N hr ago"` / `"N days ago"`.
- [x] **1.3.5** Add `formatDuration(minutes)` → `"< 1 min"` / `"N min"` / `"N.N hrs"` / `"N.N days"` / `"N/A"` for null.
- [x] **1.3.6** Add `truncateText(str, maxLength)` → appends `"…"` when truncated.
- [x] **1.3.7** Add `escapeHtml(str)` → escapes `&`, `<`, `>`, `"`, `'` to prevent XSS in `innerHTML`.
- [x] **1.3.8** Add validation helpers: `isNonEmptyString(value)`, `isWithinLength(value, min, max)`, `isValidEnum(value, allowedValues)`, `isValidDate(isoString)`.
- [x] **1.3.9** Add `formatNumber(num)` with `toLocaleString` and a `toString` fallback.
- [x] **1.3.10** Add `calcPercentage(count, total, decimalPlaces)` — returns `0` when `total === 0`, never `NaN`.
- [x] **1.3.11** Export enum arrays as constants: `INCIDENT_TYPES`, `INCIDENT_PRIORITIES`, `INCIDENT_STATUSES`, `RESOURCE_TYPES`, `RESOURCE_STATUSES`, `PRIORITY_ORDER`, `STATUS_ORDER`.
- [x] **1.3.12** Export `logger` utility (`info`, `warn`, `error`) controlled by a `DEBUG` flag. `console.log` is never used in production paths.

#### 1.4 CSS Foundation

Satisfies: NF-01, NF-06 · [design §7 CSS Architecture]

- [x] **1.4.1** Create `assets/css/main.css` defining all design tokens in `:root` using the `--resq-` prefix: color tokens (`--resq-color-*` for brand, text, surface, borders, priorities, statuses, incident types), typography (`--resq-font-*`), spacing on a 4px scale (`--resq-space-*`), radii (`--resq-radius-*`), shadows (`--resq-shadow-*`). Includes CSS reset and sidebar + topbar + main-content layout.
- [x] **1.4.2** Create `assets/css/components.css` with reusable styles: buttons, badges, cards, forms, tables, toasts, stat bars.
- [x] **1.4.3** Create `assets/css/responsive.css` with mobile-first breakpoints at 480px, 768px, 1024px, 1280px.
- [x] **1.4.4** Create `assets/css/enhancements.css` as the final polish layer (loaded last in `index.html`): covers sidebar, topbar, summary cards, badges, buttons, alerts, stats, empty states, assistant, quicklinks, status track, toasts, toolbar, incident management, resource management, decision assistant, statistics dashboard, and a `table-layout: fixed` fix for statistics table column alignment (§52).

---

### Phase 2 — Incident Management

Satisfies: IM-F01–F18, ISV-F01–F45, US-IM-01–US-IM-08 · [design §5 incidentService, §6 UI Layer]

#### 2.1 Incident Service

- [x] **2.1.1** Create `assets/js/services/incidentService.js`. Export `registerReleaseHook(fn)` so `resourceService` can inject `releaseResource` without a circular import.
- [x] **2.1.2** Implement `validateIncident(fields)` → `{ valid, errors }`. Rules: `title` 5–100 chars after trim (ISV-F01–F04); `description` 10–500 chars after trim (ISV-F05–F08); `location` non-empty after trim; `type` must match `INCIDENT_TYPES` enum (ISV-F10); `priority` must match `INCIDENT_PRIORITIES` enum (ISV-F11); `reportedBy` non-empty after trim (ISV-F09). Returns `{ valid: true }` when all pass (ISV-F12).
- [x] **2.1.3** Implement `checkDuplicate(fields)` — reads store, finds incident with same `type` + `location` reported within 5 minutes of `getNow()`. Returns warning string on match (ISV-F33), `null` otherwise (ISV-F34, ISV-F35).
- [x] **2.1.4** Implement `createIncident(fields)` — validates; returns `{ success: false, errors }` on failure without writing (ISV-F18); on success, builds object with auto ID via `generateId('INC', ...)` (ISV-F13), `status: "Reported"` (ISV-F14), `resolvedAt: null` (ISV-F15), `assignedResources: []` (ISV-F16), `reportedAt`/`updatedAt` set to `getNow()` (ISV-F17); appends to store array; returns `{ success: true, incident }`.
- [x] **2.1.5** Implement `getAllIncidents()` and `getIncidentById(id)` — read from store; `getIncidentById` returns `null` if not found.
- [x] **2.1.6** Implement `updateIncidentStatus(id, newStatus)` using `NEXT_STATUS` map that enforces `Reported→Active→In Progress→Resolved` only (ISV-F19–F22). Sets `resolvedAt = getNow()` when transitioning to `Resolved` (ISV-F23). Updates `updatedAt` on every successful write (ISV-F24). Calls the registered release hook for all `assignedResources` when resolving. Returns `{ success: false, error }` on invalid transitions.
- [x] **2.1.7** Implement `getNextStatus(currentStatus)` — returns the next valid status string, or `null` for `"Resolved"` (ISV-F25, ISV-F26).
- [x] **2.1.8** Implement `updateIncidentNotes(id, notes)` — accepts empty string to clear notes (ISV-F27); rejects non-string values (ISV-F28); returns `{ success: false }` for unknown ID (ISV-F29). Updates `updatedAt`.
- [x] **2.1.9** Implement `updateIncident(id, updates)` — merges updates onto existing record but protects `id`, `reportedAt`, `status`, `resolvedAt`, `assignedResources` from modification (ISV-F44). Re-runs `validateIncident` on the merged result before writing (ISV-F45).
- [x] **2.1.10** Implement `deleteIncident(id)` — succeeds only when `status === "Resolved"` (ISV-F30); returns `{ success: false }` for non-resolved statuses (ISV-F31) and unknown IDs (ISV-F32).
- [x] **2.1.11** Implement pure pipeline helpers: `searchIncidents(incidents, query)` — case-insensitive match on `title`, `description`, `location`; returns all on empty/whitespace query (ISV-F36–F38). `filterIncidents(incidents, filters)` — AND logic; skips `null`/`undefined` fields (ISV-F39–F40). `sortIncidents(incidents, sortBy, dir)` — returns a new array, never mutates input (ISV-F41–F42). `getFilteredIncidents(options)` — search → filter → sort pipeline (ISV-F43).
- [x] **2.1.12** Implement `addResourceToIncident(incidentId, resourceId)` and `removeResourceFromIncident(incidentId, resourceId)` — called by `resourceService` during assign/release to keep `assignedResources` in sync.

#### 2.2 Incident UI

- [x] **2.2.1** Create `assets/js/ui/incidentForm.js` — renders create/edit form with fields: title, description, location, type (select), priority (select), reportedBy. Implements field-level inline validation errors on submit that clear as the user corrects each field. Shows duplicate warning (`checkDuplicate`) as a non-blocking notice. Calls `validateIncident` then `createIncident`/`updateIncident`. Resets form and shows success toast on success. Supports pre-fill from assistant payload (`_pendingPrefill`).
- [x] **2.2.2** Create `assets/js/ui/incidentList.js` — renders searchable/filterable/sortable incident list. Toolbar includes: search input (real-time), Type filter, Priority filter, Status filter, sort control, "Clear filters" button, "Report Incident" button. Shows correct empty state for: no incidents, no search results, no filter results. Each row/card shows ID, title (truncated), type badge, priority badge, status badge, reported date, and "View Details" action.
- [x] **2.2.3** Create `assets/js/ui/incidentDetail.js` — full detail view: all fields, status stepper with next-status button (hidden when `Resolved`), notes textarea with "Save Notes" button, assigned resources list, delete button (only for `Resolved`), "Back to Incidents" navigation.
- [x] **2.2.4** Wire incident views into `app.js` via `renderIncidents(el)` → delegates to `showListView`, `showFormView`, or `showDetailView` based on app state. `showFormView` reads and clears `_pendingPrefill` (one-time assistant transfer, 50ms tick after navigation).

#### 2.3 Incident Service Validation Tests

Satisfies: ISV-F01–F45 · [design §12 Testing Strategy]

- [x] **2.3.1** Create `test-incident-service.mjs` at project root. Covers all 45 ISV requirements with direct unit tests against the production `incidentService.js` module. Uses the four-helper harness (`suite`, `test`, `assert`, `eq`) and `global._testStore.clear()` reset before each suite block.
- [x] **2.3.2** Run: `node --require ./test-globals-preload.cjs test-incident-service.mjs` → **89 tests, 0 failures**.

---

### Phase 3 — Resource Management

Satisfies: RM-F01–F21, US-RM-01–US-RM-08 · [design §5 resourceService, §6 UI Layer]

#### 3.1 Resource Service

- [x] **3.1.1** Create `assets/js/services/resourceService.js`. Import `addResourceToIncident` and `removeResourceFromIncident` from `incidentService` for bi-directional assignment sync.
- [x] **3.1.2** Implement `validateResource(fields, excludeId)` → `{ valid, errors }`. Rules: `name` non-empty after trim and globally unique case-insensitively (excluding `excludeId` on edits); `type` must match `RESOURCE_TYPES` enum; `location` non-empty after trim.
- [x] **3.1.3** Implement `repairOrphans()` — on app init, reads all resources and incidents; for each resource where `assignedTo` references a missing incident ID, resets `resource.assignedTo = null` and `resource.status = "Available"`. Writes repaired array back silently (RM-F21).
- [x] **3.1.4** Implement `createResource(fields)` — validates; builds object with auto ID via `generateId('RES', ...)`, `status: "Available"`, `assignedTo: null`, `addedAt: getNow()`; appends to store (RM-F01–F04).
- [x] **3.1.5** Implement `getAllResources()`, `getResourceById(id)`, `getAvailableResourcesByType(type)` — read-only accessors.
- [x] **3.1.6** Implement `updateResource(id, fields)` — updates `name`, `type`, `location` only; re-validates uniqueness excluding the resource's own ID (RM-F08).
- [x] **3.1.7** Implement `deleteResource(id)` — returns `{ success: false }` if `status === "Deployed"` (RM-F09, RM-F10).
- [x] **3.1.8** Implement `assignResource(resourceId, incidentId)` — validates: resource exists and `status === "Available"` (RM-F11, RM-F12); incident exists and `status !== "Resolved"` (RM-F13). Atomic write: mutates both arrays in memory → write resources first → if resource write fails return `{ success: false }` → write incidents → if incident write fails rollback resource write → return `{ success: true }` only when both writes succeed (RM-F16).
- [x] **3.1.9** Implement `releaseResource(resourceId)` — sets `status: "Available"`, `assignedTo: null`; removes resource ID from incident's `assignedResources` via `removeResourceFromIncident`. Applies same atomic write pattern as `assignResource` (RM-F14, RM-F16).
- [x] **3.1.10** Implement `setMaintenance(id)` — blocked if `status === "Deployed"` (RM-F17). Implement `clearMaintenance(id)` → sets `status: "Available"` (RM-F18).
- [x] **3.1.11** Implement pure pipeline helpers: `searchResources`, `filterResources`, `sortResources`, `getFilteredResources` — same pattern as incident equivalents.

#### 3.2 Resource UI

- [x] **3.2.1** Create `assets/js/ui/resourceForm.js` — renders add/edit resource form (name, type, location). Edit mode pre-fills existing values. Validates uniqueness excluding self. Shows success toast on save.
- [x] **3.2.2** Create `assets/js/ui/resourceList.js` — renders searchable/filterable resource list. Availability summary strip (Available / Deployed / Maintenance counts). Per-card action buttons depend on status: Available → Edit · Set Maintenance · Delete; Deployed → Edit · Release; Maintenance → Edit · Mark Available · Delete. Implements delete confirmation, maintenance toggle handlers, empty states.
- [x] **3.2.3** Create `assets/js/ui/assignmentPanel.js` — rendered within incident detail view. Shows incident context at top. Type filter pre-selected from incident type. Lists `Available` resources with "Assign" button. Shows "no resources available" message when empty. Assignment and release handlers call `resourceService.assignResource`/`releaseResource` and refresh the panel.
- [x] **3.2.4** Wire resource views into `app.js` via `renderResourcesSection(el)` → delegates to `showResourceListView` or `showResourceFormView`.

#### 3.3 Resource Service Tests (Early Coverage)

- [x] **3.3.1** Create `test-phase3.mjs` — tests resource service with inlined store stubs (no preload needed). Covers CRUD, validation, assignment, release, maintenance, orphan repair. Run: `node test-phase3.mjs` → **44 tests, 0 failures**.
- [x] **3.3.2** Create `test-production-modules.mjs` — integration tests using production `resourceService.js` and `incidentService.js` loaded via `test-globals-preload.cjs`. Run: `node --require ./test-globals-preload.cjs test-production-modules.mjs` → **46 tests, 0 failures**.

---

### Phase 4 — Decision-Support Assistant

Satisfies: DA-F01–F15, US-DA-01–US-DA-05 · [design §5 assistantService, §6 UI Layer]

#### 4.1 Assistant Rule Engine

- [x] **4.1.1** Create `assets/js/services/assistantService.js` as a pure rule engine — no DOM access, no store reads except log writing.
- [x] **4.1.2** Define and export rule constants: `RULE_CATEGORIES` (5 incident types with `keywords[]` and `locationBoosts[]`), `SEVERITY_KEYWORDS` (Critical/High/Medium/Low arrays), `TYPE_DEFAULT_PRIORITY` (type → fallback priority map), `RESOURCE_MAP` (type → resource type array). All rules live in these constants — none are scattered through logic (DA-F02, DA-F03).
- [x] **4.1.3** Implement `normalize(input)` — lowercase, trim, collapse whitespace.
- [x] **4.1.4** Implement `matchRules(normalized)` — iterates `RULE_CATEGORIES`, returns array of `{ type, keyword, isLocationBoost }` match objects (DA-F03).
- [x] **4.1.5** Implement `scoreMatches(matches)` — counts score per category, picks winning type, computes disambiguation bonus (+1 if winner has ≥ 2× second-place score) (DA-F06).
- [x] **4.1.6** Implement `determinePriority(normalized, winningType)` — checks `SEVERITY_KEYWORDS` in priority order (Critical → High → Medium → Low); falls back to `TYPE_DEFAULT_PRIORITY[winningType]` (DA-F04).
- [x] **4.1.7** Implement `calculateConfidence(totalScore)` — thresholds: 0 → Low (fallback), 1 → Low, 2–3 → Medium, ≥4 → High (DA-F06).
- [x] **4.1.8** Implement `buildExplanation(matches, winType, isFallback)` — produces human-readable explanation listing matched keywords (DA-F07). Fallback explanation states no indicators were detected (DA-F08).
- [x] **4.1.9** Implement `buildResources(type)` — looks up `RESOURCE_MAP` (DA-F05).
- [x] **4.1.10** Implement `analyze(description)` — orchestrates the full pipeline; wraps everything in try/catch; always returns a valid `AssistantResult` object, never throws (DA-F02, DA-F08). Fallback result: `{ suggestedType: 'Other', suggestedPriority: 'Medium', suggestedResources: [], confidence: 'Low', matchedKeywords: [], isFallback: true }`.
- [x] **4.1.11** Implement `buildTransferPayload(result, originalDescription)` → `{ type, priority, description }` for incident form pre-fill (DA-F12).
- [x] **4.1.12** Implement `logResult(result, inputDescription, accepted)` — creates `AssistantLog` entry with auto ID via `generateId('LOG', ...)`, writes to `resqgrid_assistant_log`. Silently catches `QuotaExceededError` — logging is non-critical (DA-F13, DA-F14).
- [x] **4.1.13** Implement `getAllLogs()` — returns full log array from store.

#### 4.2 Assistant UI

- [x] **4.2.1** Create `assets/js/ui/assistantPanel.js` — renders the full assistant panel. Permanent prototype disclaimer banner (NF-09). Description textarea (max 1000 chars) with character counter (DA-F01). "Analyze" button disabled when input empty/whitespace.
- [x] **4.2.2** Implement result panel: shows suggested type, priority, resources, confidence badge (colored + dot indicator: High `●●●` / Medium `●●○` / Low `●○○`), and explanation text. Fallback results use amber/warning styling (DA-F08).
- [x] **4.2.3** Implement inline edit toggles for type (select), priority (select), and resources (checklist). Editing does not re-run analysis (DA-F10).
- [x] **4.2.4** Implement "Accept Suggestion" button — calls `buildTransferPayload`, logs `accepted: true`, stores payload in `app._pendingPrefill`, navigates to `#incidents`, calls `showFormView()` after a 50ms tick (DA-F09, DA-F12, DA-F15).
- [x] **4.2.5** Implement "Dismiss" button — collapses result panel, logs `accepted: false` (DA-F11).
- [x] **4.2.6** Implement "Clear" button — resets textarea, hides result panel (DA-F11).
- [x] **4.2.7** Wire `assistantPanel` into `app.js` at route `#assistant` via `renderAssistant(el)`.

#### 4.3 Assistant Service Tests

- [x] **4.3.1** Create `test-phase4.mjs` — tests the assistant rule engine end-to-end: all 5 keyword categories, severity overrides, fallback behavior, confidence thresholds, disambiguation logic, normalization, logging. Run: `node --require ./test-globals-preload.cjs test-phase4.mjs` → **60 tests, 0 failures**.

---

### Phase 5 — Statistics Dashboard

Satisfies: SD-F01–F14, US-SD-01–US-SD-04 · [design §5 statsService, §6 UI Layer]

#### 5.1 Statistics Service

- [x] **5.1.1** Create `assets/js/services/statsService.js` as a pure computation module — no store access. All data is passed in by the caller.
- [x] **5.1.2** Implement `countByField(array, field, allowedValues)` — counts occurrences of each enum value; always iterates all `allowedValues` so no value is ever skipped, even at count 0 (SD-F02–F06).
- [x] **5.1.3** Implement `calcPercentages(rows, total)` — adds `pct` to each row; returns `0` when `total === 0`, never `NaN` (NF-07).
- [x] **5.1.4** Implement `calcUtilization(resources)` — excludes `Maintenance` resources from the denominator; returns `null` when denominator is 0 (SD-F06).
- [x] **5.1.5** Implement `calcResolutionTimes(incidents)` — computes `(resolvedAt - reportedAt) / 60000` in minutes for `Resolved` incidents only; excludes invalid timestamps and negative durations with logger warnings; returns `{ average, fastest, slowest }` as `null` when no valid resolved incidents exist (SD-F08).
- [x] **5.1.6** Implement `compute(incidents, resources)` → `StatsResult` — orchestrates all sub-calculations; wraps in try/catch, returns `emptyResult()` on unexpected errors (SD-F07, SD-F12).
- [x] **5.1.7** Export format helpers: `formatDuration(minutes)`, `formatUtilization(rate)`, `formatCount(n)` (NF-07).

#### 5.2 Statistics UI

- [x] **5.2.1** Create `assets/js/ui/statsView.js` — renders the full statistics dashboard. Calls `incidentService.getAllIncidents()` and `resourceService.getAllResources()`, passes both to `statsService.compute()`, then renders all sections (SD-F07, SD-F08, SD-F09).
- [x] **5.2.2** Render 8 summary metric cards in a responsive CSS Grid: Total Incidents, Active Incidents, Critical Incidents, Resolved Incidents, Available Resources, Deployed Resources, Resource Utilization Rate, Average Resolution Time (SD-F01). No card ever displays `NaN`, `Infinity`, or blank (NF-07).
- [x] **5.2.3** Render incident breakdowns by type (SD-F02), priority (SD-F03), and status (SD-F04) as bar-chart tables. Each breakdown uses `<table>` with `<caption>`, `<th>`, `<td>`. The visual bar `<div>` is `aria-hidden="true"`. All enum values always appear even at count 0.
- [x] **5.2.4** Render resource breakdowns by type (SD-F05) and status (SD-F06) using the same bar-chart table pattern.
- [x] **5.2.5** Render resolution time section (average, fastest, slowest) — displays `"N/A"` when no resolved incidents exist (SD-F08).
- [x] **5.2.6** Implement Refresh button — re-reads store, recomputes, re-renders all sections, updates "Updated at" label with `aria-live="polite"` (SD-F10).
- [x] **5.2.7** Show meaningful empty states with action hints when no incidents or resources exist (SD-F11).
- [x] **5.2.8** Wrap `statsService.compute()` in try/catch; show dismissible error banner on failure (SD-F12).
- [x] **5.2.9** Wire `statsView` into `app.js` at route `#stats` via `renderStats(el)`. Re-renders on every navigation.

#### 5.3 Statistics Service Tests

- [x] **5.3.1** Create `test-phase5.mjs` — tests `statsService.js` directly: `compute()`, `countByField`, `calcPercentages` (zero-total guard), `calcUtilization` (null on all-maintenance), `calcResolutionTimes` (null on no resolved, negative duration exclusion), format helpers. Run: `node --require ./test-globals-preload.cjs test-phase5.mjs` → **45 tests, 0 failures**.

---

### Phase 6 — Cross-Service Validation and Property-Based Testing

Satisfies: correctness properties from design.md · [design §Correctness Properties]

#### 6.1 Property-Based Test Suite

- [x] **6.1.1** Create `test-property-based.mjs` — inline `forAll(name, generators, property, runs)` runner. Generators draw from explicit value pools (all enum values + realistic locations) so failures are reproducible.
- [x] **6.1.2** Cover invariant **P01–P05**: ID uniqueness across N creates for both INC and RES prefixes.
- [x] **6.1.3** Cover invariant **P06–P10**: initial field values after `createIncident` and `createResource` (status, timestamps, null fields, empty arrays).
- [x] **6.1.4** Cover invariant **P11–P14**: status transition exhaustiveness — every valid `Reported→Active→In Progress→Resolved` path succeeds; every invalid skip/reverse/terminal-extend fails.
- [x] **6.1.5** Cover invariant **P15–P17**: assignment sync — after `assignResource`, `resource.status === "Deployed"`, `resource.assignedTo === incidentId`, and `incident.assignedResources` contains `resourceId`. After `releaseResource`, all three reset correctly.
- [x] **6.1.6** Cover invariant **P18–P19**: sort non-mutation — `sortIncidents` and `sortResources` never modify their input arrays.
- [x] **6.1.7** Cover invariant **P20–P21**: filter AND logic — `filterIncidents` and `filterResources` return only records satisfying all non-null filter criteria simultaneously.
- [x] **6.1.8** Cover invariant **P22–P24**: stats non-negativity — all counts and percentages in `StatsResult` are ≥ 0 and all breakdown `pct` values sum to ≤ 100.
- [x] **6.1.9** Cover invariant **P25–P27**: breakdown completeness — all enum values always appear in every breakdown, even when count is 0.
- [x] **6.1.10** Run: `node --require ./test-globals-preload.cjs test-property-based.mjs` → **29 tests, 0 failures**.

---

### Phase 7 — MCP Integration

Satisfies: design.md §10 MCP Integration · [design §10]

- [x] **7.1** Create `mcp/resqgrid-mcp-server.mjs` implementing the MCP stdio JSON-RPC 2.0 transport in plain Node.js 18+ (no npm packages).
- [x] **7.2** Implement tool `get_incidents` — reads from `mcp/data-snapshot.json` (optional export) with optional `status` and `priority` filters. Returns empty array if no snapshot exists.
- [x] **7.3** Implement tool `get_resources` — reads from snapshot with optional `status` and `type` filters.
- [x] **7.4** Implement tool `validate_consistency` — cross-checks `incident.assignedResources` ↔ `resource.assignedTo` sync integrity; reports orphaned or mismatched references.
- [x] **7.5** Implement tool `get_statistics` — calls the stats computation logic from snapshot data; returns summary metrics.
- [x] **7.6** Implement tool `run_tests` — validates suite name against a hard-coded `Set` allowlist before executing any shell operation. Invalid names produce a fixed literal error message; the user-supplied value is never interpolated into any string or command.
- [x] **7.7** Create `mcp/mcp-config.json` — configuration file to copy to `~/.kiro/settings/mcp.json` for Kiro auto-connect.
- [x] **7.8** Create `mcp/verify-mcp.mjs` — standalone protocol verification script that exercises all 5 tools over stdin/stdout. Run: `node mcp/verify-mcp.mjs` → **17 checks, 0 failures**.

---

### Phase 8 — Kiro Workspace Configuration

Satisfies: design.md §11 Kiro Configuration

#### 8.1 Steering Files

- [x] **8.1.1** Create `.kiro/steering/project-standards.md` (always-included) — technology constraints, code style, naming conventions, CSS architecture, accessibility requirements, LocalStorage conventions, error handling rules, validation requirements, decision-assistant rules, what-not-to-build list.
- [x] **8.1.2** Create `.kiro/steering/data-models.md` (always-included) — canonical Incident, Resource, and AssistantLog models with field references; all allowed enum values; ID format rules; status transition diagrams; assignment relationship sync rules; orphan prevention.
- [x] **8.1.3** Create `.kiro/steering/testing-standards.md` (always-included) — test infrastructure (plain Node.js `.mjs`, preload shim), four-helper harness pattern, reset convention, suite table, what-to-test / what-not-to-test, property-based testing guidance, spec traceability format, test output interpretation.
- [x] **8.1.4** Create `.kiro/steering/resqgrid-power.md` (auto-included) — spec-driven workflow guide; test commands; architecture quick-reference; activated on demand via `disclose_context`.

#### 8.2 Source Specs

- [x] **8.2.1** Create `.kiro/specs/incident-management.md` — IM-F01–F18 with acceptance criteria, data interactions, validation rules, status transition table, UI behaviour, edge cases, and implementation task groups A–F.
- [x] **8.2.2** Create `.kiro/specs/resource-management.md` — RM-F01–F21 with acceptance criteria, assignment rules, resource lifecycle diagram, UI behaviour, edge cases, and implementation task groups A–F.
- [x] **8.2.3** Create `.kiro/specs/decision-assistant.md` — DA-F01–F15 with acceptance criteria, rule engine architecture, `RULE_CATEGORIES` / `SEVERITY_KEYWORDS` / `RESOURCE_MAP` configuration, confidence scoring table, fallback behavior, UI layout, form integration, and implementation task groups A–F.
- [x] **8.2.4** Create `.kiro/specs/statistics-dashboard.md` — SD-F01–F14 with acceptance criteria, derived metric definitions, calculation rules, `StatsResult` shape, UI layout, visualization behavior, empty states, and implementation task groups A–D.
- [x] **8.2.5** Create `.kiro/specs/incident-service-validation.md` — ISV-F01–F45 with detailed acceptance criteria (AC-01–AC-13), edge cases, data/behavior constraints, testing requirements, and implementation status table (all groups verified ✅).
- [x] **8.2.6** Create `.kiro/specs/resqgrid-core/requirements.md` — consolidated requirements document aggregating IM, RM, DA, SD, ISV, and NF requirements with user stories.
- [x] **8.2.7** Create `.kiro/specs/resqgrid-core/design.md` — comprehensive design document covering architecture, routing, LocalStorage layer, data models, all four service layers, UI layer, CSS architecture, validation strategy, error handling, MCP integration, Kiro configuration, and testing strategy.

#### 8.3 Hooks

- [x] **8.3.1** Create `.kiro/hooks/test-on-service-save.json` — `PostFileSave` hook with matcher `assets/js/services/.*\.js$`: auto-runs all six test suites whenever a service file is saved, surfacing regressions immediately.
- [x] **8.3.2** Create `.kiro/hooks/kironomics.json` — Kironomics usage tracking hooks (`PostToolUse`, `UserPromptSubmit`, `Stop`).

#### 8.4 Custom Agent

- [x] **8.4.1** Create `.kiro/agents/resqgrid-qa-agent.md` — "ResQGrid QA & Specification Compliance Agent": read-only agent that inspects the implementation against specs, steering, tests, and data-model rules; reports findings with severity levels and recommended actions; never makes destructive changes.

---

### Phase 9 — Test Infrastructure

Satisfies: NF-10 · [design §12 Testing Strategy, steering/testing-standards.md]

- [x] **9.1** Create `test-globals-preload.cjs` at project root — CommonJS preload that installs `global.localStorage` (backed by an in-memory `Map`) and `global.structuredClone` before any ES module is loaded. Exposes `global._testStore` so test suites can call `.clear()` between suite blocks.
- [x] **9.2** Establish the four-helper harness pattern (`suite`, `test`, `assert`, `eq`) used identically in all six test files. Each file calls `global._testStore.clear()` (or an inline `reset()`) before each `suite()` block and once more as the final statement. Exit code reflects failures: `process.exit(failed > 0 ? 1 : 0)`.
- [x] **9.3** Verify baseline: all six suites pass with 0 failures before any commit.

  | Suite | Run command | Tests |
  |-------|-------------|-------|
  | `test-phase3.mjs` | `node test-phase3.mjs` | 44 |
  | `test-production-modules.mjs` | `node --require ./test-globals-preload.cjs test-production-modules.mjs` | 46 |
  | `test-phase4.mjs` | `node --require ./test-globals-preload.cjs test-phase4.mjs` | 60 |
  | `test-phase5.mjs` | `node --require ./test-globals-preload.cjs test-phase5.mjs` | 45 |
  | `test-incident-service.mjs` | `node --require ./test-globals-preload.cjs test-incident-service.mjs` | 89 |
  | `test-property-based.mjs` | `node --require ./test-globals-preload.cjs test-property-based.mjs` | 29 |
  | `mcp/verify-mcp.mjs` | `node mcp/verify-mcp.mjs` | 17 (MCP) |
  | **Total** | | **330** |

---

## Notes

- **Circular import resolution:** `incidentService` and `resourceService` have a mutual dependency (incident resolution must release resources; resource assignment must update incidents). This is resolved via `registerReleaseHook(fn)` in `incidentService` (task 2.1.1) — `resourceService` injects its `releaseResource` function at init time, avoiding a direct circular `import`.
- **Atomic write pattern:** Both `assignResource` and `releaseResource` use an in-memory-first, write-resources-first, rollback-on-incident-failure pattern to prevent store inconsistency on partial writes (task 3.1.8, 3.1.9).
- **Test preload requirement:** All test files that import production modules (which in turn import `store.js`) must be run with `--require ./test-globals-preload.cjs` to provide `localStorage` and `structuredClone` in the Node.js environment. Only `test-phase3.mjs` is exempt because it inlines its own store stub.
- **Stats are never persisted:** `statsService.js` is a pure computation module. It receives data as arguments and returns results — it never reads from or writes to `localStorage` directly (task 5.1.1).
- **MCP snapshot independence:** The MCP server reads from `mcp/data-snapshot.json` rather than `localStorage` (which is not available in Node.js). To test MCP tools against real data, export a snapshot from the browser app first.
- **Requirements → Tasks Traceability Matrix:**

  | Requirement group | Key tasks |
  |-------------------|-----------|
  | NF-01–02 (vanilla JS, ES modules) | 1.1.1, 1.1.3, 1.4.x |
  | NF-03–05 (LocalStorage persistence, isolation) | 1.2.x |
  | NF-06 (accessibility) | 1.4.x, 2.2.x, 3.2.x, 4.2.x, 5.2.x |
  | NF-07 (no NaN/broken output) | 1.3.10, 5.1.3, 5.2.2 |
  | NF-08–09 (local rule engine, labeled as prototype) | 4.1.x, 4.2.1 |
  | NF-10 (plain Node.js tests) | 9.1, 9.2 |
  | IM-F01–F05 (create incident) | 2.1.4 |
  | IM-F06–F09 (list, search, filter, sort) | 2.1.11, 2.2.2 |
  | IM-F10 (detail view) | 2.2.3 |
  | IM-F11–F12 (status transitions) | 2.1.6 |
  | IM-F13 (notes) | 2.1.8 |
  | IM-F14–F15 (delete guard) | 2.1.10 |
  | IM-F16–F17 (persistence + recovery) | 1.2.1, 1.2.2 |
  | IM-F18 (duplicate warning) | 2.1.3 |
  | ISV-F01–F45 (service boundary tests) | 2.1.2–2.1.12, 2.3.1–2.3.2 |
  | RM-F01–F04 (create resource) | 3.1.4 |
  | RM-F05–F07 (list, search, filter) | 3.1.11, 3.2.2 |
  | RM-F08 (edit) | 3.1.6, 3.2.1 |
  | RM-F09–F10 (delete guard) | 3.1.7 |
  | RM-F11–F13 (assignment constraints) | 3.1.8 |
  | RM-F14 (manual release) | 3.1.9, 3.2.3 |
  | RM-F15 (auto-release on resolve) | 2.1.6, 3.1.9 |
  | RM-F16 (atomic write) | 3.1.8, 3.1.9 |
  | RM-F17–F18 (maintenance) | 3.1.10 |
  | RM-F19–F20 (persistence + recovery) | 1.2.1, 1.2.2 |
  | RM-F21 (orphan repair) | 3.1.3 |
  | DA-F01–F08 (analysis pipeline) | 4.1.3–4.1.10 |
  | DA-F09–F11 (accept/edit/dismiss) | 4.2.3–4.2.6 |
  | DA-F12 (form transfer) | 4.1.11, 4.2.4, 2.2.1 |
  | DA-F13–F14 (logging) | 4.1.12–4.1.13 |
  | DA-F15 (non-blocking) | 4.2.7 |
  | SD-F01 (summary cards) | 5.2.2 |
  | SD-F02–F06 (breakdowns) | 5.1.2, 5.2.3–5.2.4 |
  | SD-F07–F08 (derived, never stored) | 5.1.6, 5.2.1 |
  | SD-F09–F10 (refresh) | 5.2.6, 5.2.9 |
  | SD-F11–F12 (empty states + error) | 5.2.7–5.2.8 |
  | SD-F13–F14 (HTML/CSS only, accessible) | 1.4.x, 5.2.3 |
