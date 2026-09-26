# Statistics Dashboard — Feature Specification

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec version:** 1.0
**Status:** Approved
**References:** #[[file:.kiro/steering/project-standards.md]] · #[[file:.kiro/steering/data-models.md]] · #[[file:.kiro/specs/incident-management.md]] · #[[file:.kiro/specs/resource-management.md]]

---

## 1. Requirements

### Functional Requirements

| ID | Requirement |
|----|-------------|
| SD-F01 | The dashboard shall display 8 summary metric cards: Total Incidents, Active Incidents, Critical Incidents, Resolved Incidents, Available Resources, Deployed Resources, Resource Utilization Rate, and Average Resolution Time. |
| SD-F02 | The dashboard shall display a breakdown of incidents grouped by type. |
| SD-F03 | The dashboard shall display a breakdown of incidents grouped by priority. |
| SD-F04 | The dashboard shall display a breakdown of incidents grouped by status. |
| SD-F05 | The dashboard shall display a breakdown of resources grouped by type. |
| SD-F06 | The dashboard shall display a breakdown of resources grouped by status. |
| SD-F07 | All statistics shall be derived in real time from `resqgrid_incidents` and `resqgrid_resources` in LocalStorage. |
| SD-F08 | No derived statistics shall be stored in LocalStorage — they are always computed on demand. |
| SD-F09 | The dashboard shall refresh its data each time it is navigated to or the page is reloaded. |
| SD-F10 | The dashboard shall provide a manual "Refresh" control to recompute all metrics from the current store state. |
| SD-F11 | The dashboard shall display meaningful empty states when data is absent. |
| SD-F12 | The dashboard shall handle corrupted LocalStorage data without crashing. |
| SD-F13 | All visualizations shall be implemented using HTML and CSS only — no external chart libraries. |
| SD-F14 | All visual indicators must be accompanied by accessible text labels and numeric values. |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| SD-N01 | All metric computations must be pure functions with no side effects. |
| SD-N02 | The statistics module must be testable independently of the UI. |
| SD-N03 | The dashboard must remain readable and functional on screens as narrow as 320px. |
| SD-N04 | No statistic must display `NaN`, `Infinity`, `undefined`, `null`, or a broken visual element. |
| SD-N05 | The feature must use no external libraries or frameworks. |
| SD-N06 | The dashboard must meet the accessibility requirements defined in `project-standards.md`. |

---

## 2. User Stories

**US-01 — Operational overview**
> As a coordinator, I want a single-page view of all key metrics, so that I can understand the current state of incidents and resources at a glance without navigating to multiple sections.

**US-02 — Incident type analysis**
> As a coordinator, I want to see how many incidents fall into each type, so that I can identify which categories are most active and plan resources accordingly.

**US-03 — Priority distribution**
> As a coordinator, I want to see the priority breakdown of current incidents, so that I can confirm critical and high-priority items are being addressed.

**US-04 — Resource utilization**
> As a coordinator, I want to see what proportion of resources are currently deployed, so that I can assess whether capacity is stretched and whether additional resources are needed.

**US-05 — Resolution performance**
> As a coordinator, I want to see average, fastest, and slowest resolution times for resolved incidents, so that I can review response effectiveness.

**US-06 — Empty state awareness**
> As a coordinator, I want the dashboard to clearly tell me when no data exists rather than show zeroed or broken charts, so that I am not confused about the system state.

---

## 3. Acceptance Criteria

### SD-F01 — Summary Cards
- [ ] Eight metric cards are displayed in a responsive grid.
- [ ] Each card shows a label, a primary numeric value, and a secondary descriptor where applicable.
- [ ] Cards update when the "Refresh" button is clicked.
- [ ] Resource Utilization Rate displays as a percentage rounded to one decimal place, or "N/A".
- [ ] Average Resolution Time displays in minutes (< 60 min), hours (60–1439 min), or days (≥ 1440 min), rounded to one decimal place, or "N/A".
- [ ] Critical Incidents card uses `--resq-color-critical` as an accent color.
- [ ] No card ever displays `NaN`, `Infinity`, or an empty string as its primary value.

### SD-F02–SD-F06 — Breakdowns
- [ ] Each breakdown section shows one row per enum value, even if the count is zero.
- [ ] Each row displays: label, count, percentage of total, and a horizontal bar.
- [ ] Bar width is proportional to percentage (CSS `width` as a percentage of a fixed container).
- [ ] If the total is zero, all bars have zero width and all percentages display as "0%", not "NaN%".
- [ ] Bars use the color tokens defined in `main.css` for priority/status/type groups.

### SD-F07 & SD-F08 — Derived Data
- [ ] Navigating to the dashboard always calls `statsService.compute()` fresh from LocalStorage.
- [ ] No stats object is written to LocalStorage at any point.

### SD-F10 — Refresh Control
- [ ] A "Refresh" button is visible in the dashboard toolbar.
- [ ] Clicking it re-reads LocalStorage, recomputes all metrics, and re-renders all sections.
- [ ] A brief "Updated [time]" label appears after refresh.

### SD-F11 — Empty States
- [ ] When no incidents exist: incident sections show empty-state messages, not zero-filled charts.
- [ ] When no resources exist: resource sections show empty-state messages.
- [ ] When no resolved incidents exist: resolution time section shows "N/A — No resolved incidents yet."
- [ ] Empty states include a short action hint (e.g., "Report your first incident to see statistics here.").

### SD-F12 — Corrupted Data
- [ ] If LocalStorage data for incidents or resources is corrupted, `statsService.compute()` receives an empty array from the store and renders the empty state.
- [ ] No error is thrown to the user. The dashboard displays gracefully.

---

## 4. Derived Metric Definitions

All metrics are computed by `statsService.js` from the current incident and resource arrays. None are stored.

### Incident Metrics

| Metric | Definition |
|--------|-----------|
| Total Incidents | `incidents.length` |
| Active Incidents | Count where `status !== "Resolved"` |
| Critical Incidents | Count where `priority === "Critical"` |
| Resolved Incidents | Count where `status === "Resolved"` |
| Incidents by Type | For each Incident Type enum value: count where `type === value` |
| Incidents by Priority | For each Priority enum value: count where `priority === value` |
| Incidents by Status | For each Status enum value: count where `status === value` |

### Resource Metrics

| Metric | Definition |
|--------|-----------|
| Total Resources | `resources.length` |
| Available Resources | Count where `status === "Available"` |
| Deployed Resources | Count where `status === "Deployed"` |
| Resources in Maintenance | Count where `status === "Maintenance"` |
| Resources by Type | For each Resource Type enum value: count where `type === value` |
| Resources by Status | Three rows: Available, Deployed, Maintenance |

### Resource Utilization Rate

```
nonMaintenanceResources = resources where status !== "Maintenance"
utilization = (deployed / nonMaintenanceResources.length) × 100
```

- If `nonMaintenanceResources.length === 0` → result is `null` → display "N/A"
- If `deployed === 0` → result is `0.0%`
- Round to 1 decimal place: `Math.round(utilization * 10) / 10`

**Rationale:** Maintenance resources are excluded because they are intentionally offline and should not dilute the utilization rate of operational resources.

### Resolution Time Metrics

Only incidents where `status === "Resolved"` AND `resolvedAt !== null` AND `reportedAt` is a valid date contribute to these metrics.

```
durationMinutes = (Date.parse(resolvedAt) - Date.parse(reportedAt)) / 60000
```

| Metric | Definition |
|--------|-----------|
| Average Resolution Time | `sum(durationMinutes) / count` |
| Fastest Resolution Time | `Math.min(...durationMinutes)` |
| Slowest Resolution Time | `Math.max(...durationMinutes)` |

- If zero resolved incidents → all three return `null` → display "N/A"
- If `durationMinutes` is negative (data error: `resolvedAt` < `reportedAt`) → exclude that incident from the calculation, log a warning.

### Display formatting for resolution time

```
formatDuration(minutes):
  if minutes < 1     → "< 1 min"
  if minutes < 60    → "{minutes} min"
  if minutes < 1440  → "{Math.round(minutes / 60 * 10) / 10} hrs"
  else               → "{Math.round(minutes / 1440 * 10) / 10} days"
```

---

## 5. Calculation Rules

1. **Always iterate all enum values** — even if count is zero. Never skip an enum value in a breakdown. This ensures the UI structure is consistent regardless of data.
2. **Percentage of total** — `(count / total) × 100`, rounded to 1 decimal. If `total === 0`, display `"0%"` (not `NaN%`).
3. **Bar width** — set as inline CSS `style="width: X%"` where X is the percentage (capped at 100). If percentage is 0, bar renders as a zero-width element (still present in DOM for accessibility).
4. **No mutation** — all calculation functions take arrays as arguments and return new values. They must not modify the input arrays.
5. **Defensive parsing** — before using any date string, verify `!isNaN(Date.parse(value))`. If invalid, exclude the record from time-based calculations.
6. **Integer vs float display** — counts always display as integers. Rates and times display with 1 decimal place.
7. **Large numbers** — format numbers ≥ 10,000 with a thousands separator (e.g., `10,234`) using `toLocaleString()`.

---

## 6. Data Dependencies

The dashboard reads directly from the store via service functions. It does not depend on the UI state of other sections.

| Data source | Accessed via | Used for |
|-------------|-------------|----------|
| `resqgrid_incidents` | `incidentService.getAllIncidents()` | All incident metrics |
| `resqgrid_resources` | `resourceService.getAllResources()` | All resource metrics |

`statsService.compute()` accepts `incidents` and `resources` arrays as parameters (injected by the caller). This keeps the stats module pure and testable without mocking LocalStorage.

```js
// Caller pattern
const incidents = incidentService.getAllIncidents();
const resources = resourceService.getAllResources();
const stats = statsService.compute(incidents, resources);
```

`statsService.js` must not call `incidentService` or `resourceService` internally — that would create a hidden dependency. Data is always passed in.

---

## 7. UI Layout

### Page structure

```
#dashboard
├── Dashboard toolbar (heading + Refresh button + "Updated at" label)
├── Section: Summary Cards (8-card grid)
├── Section: Incident Overview
│   ├── Incidents by Type (bar chart list)
│   ├── Incidents by Priority (bar chart list)
│   └── Incidents by Status (bar chart list)
├── Section: Resource Overview
│   ├── Resources by Type (bar chart list)
│   └── Resources by Status (bar chart list)
└── Section: Resolution Time
    ├── Average Resolution Time
    ├── Fastest Resolution Time
    └── Slowest Resolution Time
```

### Summary card grid

8 cards in a responsive CSS Grid:
- Desktop (≥ 1024px): 4 columns × 2 rows
- Tablet (768–1023px): 2 columns × 4 rows
- Mobile (< 768px): 1 column × 8 rows (or 2 columns if space allows)

Card anatomy:
```
┌──────────────────────┐
│  [icon]              │
│  42                  │  ← primary value (large, bold)
│  Active Incidents    │  ← label
│  of 67 total         │  ← secondary descriptor (small, muted)
└──────────────────────┘
```

Cards with special accent colors:
- Critical Incidents: left border `--resq-color-critical`
- Available Resources: left border `--resq-color-status-available` (green)
- Deployed Resources: left border `--resq-color-status-deployed` (blue)

### Bar chart list anatomy

Each breakdown section renders as a `<dl>` (definition list) or a `<table>` for accessibility:

```
Type          Count   %        Bar
──────────────────────────────────────────────────
Fire            12   32.4%  ████████████░░░░░░░░░
Medical          9   24.3%  █████████░░░░░░░░░░░░
Security         6   16.2%  ██████░░░░░░░░░░░░░░░
Hazmat           4   10.8%  ████░░░░░░░░░░░░░░░░░
Natural Disaster 4   10.8%  ████░░░░░░░░░░░░░░░░░
Other            2    5.4%  ██░░░░░░░░░░░░░░░░░░░
──────────────────────────────────────────────────
Total           37  100%
```

- Bar track is a fixed-width container. Filled portion is a colored `<div>` with inline width %.
- Color per type/priority/status uses the CSS tokens from `main.css`.
- All rows always rendered, even with count = 0 (bar width = 0%).

---

## 8. Visualization Behavior

### CSS bar charts

Implementation pattern:
```html
<div class="stat-bar-track" role="presentation">
  <div
    class="stat-bar-fill stat-bar-fill--fire"
    style="width: 32.4%"
    aria-hidden="true"
  ></div>
</div>
```

- The bar is `aria-hidden="true"` — the accessible value is in the adjacent text (count + percentage).
- `stat-bar-fill--{type}` modifier class maps to a CSS color token.
- Bar width is capped at `max-width: 100%` in CSS to prevent overflow on edge cases.
- Minimum visual width for non-zero bars: 2px, so a bar with 0.1% is still faintly visible. Applied via CSS: `min-width: 2px` when the percentage > 0.

### Color mapping for bars

| Incident Type | CSS token |
|---------------|-----------|
| Fire | `--resq-color-type-fire` (orange-red) |
| Medical | `--resq-color-type-medical` (blue) |
| Security | `--resq-color-type-security` (purple) |
| Hazmat | `--resq-color-type-hazmat` (yellow-green) |
| Natural Disaster | `--resq-color-type-natural` (teal) |
| Other | `--resq-color-type-other` (grey) |

| Priority | CSS token |
|----------|-----------|
| Critical | `--resq-color-critical` |
| High | `--resq-color-high` |
| Medium | `--resq-color-medium` |
| Low | `--resq-color-low` |

| Status | CSS token |
|--------|-----------|
| Reported | `--resq-color-status-reported` |
| Active | `--resq-color-status-active` |
| In Progress | `--resq-color-status-inprogress` |
| Resolved | `--resq-color-status-resolved` |

| Resource Status | CSS token |
|----------------|-----------|
| Available | `--resq-color-status-available` |
| Deployed | `--resq-color-status-deployed` |
| Maintenance | `--resq-color-status-maintenance` |

New CSS tokens for incident type bars must be added to `:root` in `main.css`.

---

## 9. Empty States

| Scenario | Section | Message |
|----------|---------|---------|
| No incidents at all | Summary cards | Active: 0, Critical: 0, Total: 0, Resolved: 0 — show values as 0, not empty state |
| No incidents at all | Incident breakdowns | "No incidents have been reported yet. Report your first incident to see statistics here." |
| No resources at all | Summary cards | Available: 0, Deployed: 0, Utilization: N/A |
| No resources at all | Resource breakdowns | "No resources have been added yet. Add your first resource to see statistics here." |
| No resolved incidents | Resolution Time section | "N/A — No incidents have been resolved yet. Resolution time will appear once incidents are closed." |
| All resources in Maintenance | Utilization card | "N/A — All resources are in maintenance." |
| Corrupted incidents data | Incident sections | Treats as empty array. Shows incident empty state. |
| Corrupted resources data | Resource sections | Treats as empty array. Shows resource empty state. |

Empty state panels include:
- An icon (SVG, inline or local file)
- A heading (e.g., "No incident data")
- A one-sentence explanation
- An optional call-to-action link (e.g., "Go to Incidents →")

---

## 10. Error Handling

| Error | Behaviour |
|-------|-----------|
| `incidentService.getAllIncidents()` returns corrupted data | `store.js` returns `[]`. Dashboard renders empty state for incident sections. |
| `resourceService.getAllResources()` returns corrupted data | `store.js` returns `[]`. Dashboard renders empty state for resource sections. |
| `Date.parse()` fails on a timestamp | Exclude the record from time calculations. Log a warning via `logger`. Do not show error to user. |
| `statsService.compute()` throws unexpectedly | Wrap call in try/catch in the dashboard UI. Show a dismissible error banner: "Statistics could not be computed. Please refresh the page." |
| Division by zero in percentage calculation | Return `0` — handled by calculation rule (Section 5, rule 2). Never return `NaN` or `Infinity`. |
| `toLocaleString()` not supported | Wrap in try/catch; fall back to plain `toString()`. |

---

## 11. Accessibility Requirements

- The dashboard uses a `<main>` element with `aria-label="Statistics Dashboard"`.
- Each section (`Summary`, `Incident Overview`, `Resource Overview`, `Resolution Time`) is a `<section>` with a visible `<h2>` heading.
- Summary cards are rendered as `<article>` elements with an `aria-label` combining the value and label (e.g., `aria-label="42 Active Incidents"`).
- Bar chart rows use a `<table>` with `<caption>`, `<th>` for column headers, and `<td>` for data cells. This gives screen readers the full row context (label + count + percentage) without relying on the visual bar.
- The visual bar `<div>` inside each row is `aria-hidden="true"`.
- The Refresh button must have `aria-label="Refresh statistics"`.
- The "Updated at" label must update its text content — if it uses `aria-live="polite"`, screen readers will announce the refresh.
- Color-coded cards and bars must always include a text label — color alone does not convey meaning.
- The utilization rate and resolution time cards must include a brief tooltip or `<abbr>` title explaining the metric.
- Focus order follows the visual layout: toolbar → summary cards → incident sections → resource sections → resolution time.

---

## 12. Responsive Behavior

| Breakpoint | Summary grid | Breakdown tables |
|------------|-------------|-----------------|
| < 480px | 1 column | Table collapses: label + count on one line, bar below |
| 480–767px | 2 columns | Full table visible; bar column may be narrower |
| 768–1023px | 2 columns | Full table with comfortable column widths |
| ≥ 1024px | 4 columns | Full table, bar track at least 200px wide |

Breakdown table responsive pattern for < 480px:
- Hide the explicit column headers.
- Each row becomes a stacked card: type label (bold), count + percentage on the same line, bar below.
- Use `display: block` on `<tr>` and `<td>` at the smallest breakpoint.
- Provide visually hidden column header context via `data-label` attributes on `<td>` elements.

Summary card primary values must remain legible at the smallest size — minimum font size 1.5rem for the numeric value.

---

## 13. Edge Cases

| Case | Handling |
|------|----------|
| Zero incidents, zero resources | Summary cards show `0` for counts, `N/A` for rates. Breakdowns show empty states. |
| All incidents are `Resolved` | Active Incidents = 0 (shows as `0`, not empty state). Resolution time computable. |
| All incidents are `Critical` | Critical bar = 100%, others = 0% (bars render at 0 width, not hidden). |
| Single resolved incident | Resolution time = average = fastest = slowest (all same value). Display all three. |
| Incident with negative duration (`resolvedAt` < `reportedAt`) | Exclude from calculations. Log warning. Do not display a negative time. |
| 1000+ incidents | `compute()` iterates the full array. No pagination needed — stats are aggregates. Performance acceptable for client-side JS. |
| Very large count (e.g., 12,345) | Format with `toLocaleString()`: `"12,345"`. |
| Utilization = 100% | Bar renders at full width. Display `"100.0%"`. No special treatment needed. |
| Resource count = 1, that resource is Deployed | Utilization = `"100.0%"`. |
| Resource count = 1, that resource is in Maintenance | Utilization = `"N/A"`. |
| Dashboard navigated to mid-session after incidents were deleted | `compute()` re-reads store on every navigation — reflects current state accurately. |
| LocalStorage completely empty (first run) | Both services return `[]`. Dashboard renders all empty states gracefully. |

---

## 14. Implementation Tasks

Tasks are ordered by dependency. Complete each group before starting the next.

### Group A — Statistics Service

- [ ] **A1** — Create `assets/js/services/statsService.js`.
- [ ] **A2** — Implement `compute(incidents, resources)`: orchestrates all sub-calculations and returns a single `StatsResult` object (defined below).
- [ ] **A3** — Implement `countByField(array, field, allowedValues)`: generic group-count utility used for type/priority/status breakdowns.
- [ ] **A4** — Implement `calcUtilization(resources)`: returns a number (rounded to 1dp) or `null`.
- [ ] **A5** — Implement `calcResolutionTimes(incidents)`: returns `{ average, fastest, slowest }` in minutes (or `null` for each if no resolved incidents).
- [ ] **A6** — Implement `calcPercentages(countMap, total)`: returns same structure with added `pct` field per group; guards against `total === 0`.
- [ ] **A7** — Implement `formatDuration(minutes)`: returns human-readable string or `"N/A"` if `null`.
- [ ] **A8** — Implement `formatUtilization(rate)`: returns `"{rate}%"` or `"N/A"` if `null`.
- [ ] **A9** — Define `StatsResult` shape in a JSDoc comment at the top of the file.
- [ ] **A10** — Manual browser-console tests: verify each function with representative inputs, zero cases, single-item cases, negative duration exclusion, and all-maintenance utilization.

#### StatsResult shape

```js
/**
 * @typedef {Object} StatsResult
 * @property {Object} incidents
 * @property {number} incidents.total
 * @property {number} incidents.active
 * @property {number} incidents.critical
 * @property {number} incidents.resolved
 * @property {Array<{label:string, count:number, pct:number}>} incidents.byType
 * @property {Array<{label:string, count:number, pct:number}>} incidents.byPriority
 * @property {Array<{label:string, count:number, pct:number}>} incidents.byStatus
 * @property {Object} resources
 * @property {number} resources.total
 * @property {number} resources.available
 * @property {number} resources.deployed
 * @property {number} resources.maintenance
 * @property {number|null} resources.utilization   // null → display N/A
 * @property {Array<{label:string, count:number, pct:number}>} resources.byType
 * @property {Array<{label:string, count:number, pct:number}>} resources.byStatus
 * @property {Object} resolution
 * @property {number|null} resolution.average      // minutes, null → N/A
 * @property {number|null} resolution.fastest      // minutes, null → N/A
 * @property {number|null} resolution.slowest      // minutes, null → N/A
 */
```

### Group B — Dashboard UI

- [ ] **B1** — Create `assets/js/ui/statsView.js` that renders the full dashboard into a target container.
- [ ] **B2** — Implement `renderSummaryCards(stats)`: renders the 8-card grid using `stats.incidents.*` and `stats.resources.*`.
- [ ] **B3** — Implement `renderBarChart(rows, colorClass)`: generic bar chart list renderer used by all breakdown sections; accepts an array of `{ label, count, pct }` objects.
- [ ] **B4** — Implement `renderIncidentOverview(stats)`: renders three bar chart lists (by type, priority, status) in the Incident Overview section.
- [ ] **B5** — Implement `renderResourceOverview(stats)`: renders two bar chart lists (by type, status) in the Resource Overview section.
- [ ] **B6** — Implement `renderResolutionTime(stats)`: renders the three time metrics; handles `null` → "N/A" display.
- [ ] **B7** — Implement `renderEmptyState(container, message, ctaText, ctaHref)`: reusable empty state panel renderer.
- [ ] **B8** — Implement Refresh button handler: re-fetches data from services, calls `statsService.compute()`, re-renders all sections, updates "Updated at" label.
- [ ] **B9** — Wrap `statsService.compute()` call in try/catch; render error banner on failure.

### Group C — CSS Styling

- [ ] **C1** — Add incident type CSS color tokens to `:root` in `main.css`: `--resq-color-type-fire`, `--resq-color-type-medical`, `--resq-color-type-security`, `--resq-color-type-hazmat`, `--resq-color-type-natural`, `--resq-color-type-other`.
- [ ] **C2** — Style summary cards grid and individual card anatomy in `components.css`.
- [ ] **C3** — Style summary card accent borders for Critical, Available, Deployed cards.
- [ ] **C4** — Style the bar chart list: track, fill, fill color modifiers per type/priority/status.
- [ ] **C5** — Style the resolution time section.
- [ ] **C6** — Style the dashboard empty state panels.
- [ ] **C7** — Style the "Updated at" label and Refresh button in the toolbar.
- [ ] **C8** — Add responsive layout rules for summary card grid and breakdown tables in `responsive.css`.
- [ ] **C9** — Add stacked-card responsive pattern for breakdown rows at < 480px.

### Group D — Integration & Polish

- [ ] **D1** — Wire `statsView` into the router/app shell at route `#dashboard` (or the app's main landing route).
- [ ] **D2** — Ensure `statsView` re-renders on every navigation to `#dashboard` (not cached).
- [ ] **D3** — Verify all 13 edge cases from Section 13 manually in the browser.
- [ ] **D4** — Accessibility pass: `<table>` structure for bars, `aria-hidden` on bar fills, `aria-label` on cards, `aria-live` on "Updated at" label, focus order.
- [ ] **D5** — Responsive pass: verify layout at 320px, 480px, 768px, 1024px, 1280px.
- [ ] **D6** — Add prototype disclaimer banner consistent with other dashboard sections.
- [ ] **D7** — Cross-browser smoke test in Chrome, Firefox, and Edge/Safari.
