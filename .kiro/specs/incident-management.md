# Incident Management — Feature Specification

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec version:** 1.0
**Status:** Approved
**References:** #[[file:.kiro/steering/project-standards.md]] · #[[file:.kiro/steering/data-models.md]]

---

## 1. Requirements

### Functional Requirements

| ID | Requirement |
|----|-------------|
| IM-F01 | The system shall allow a coordinator to create a new incident by submitting a form. |
| IM-F02 | The system shall accept a title, description, location, type, priority, and reporter name for each incident. |
| IM-F03 | The system shall automatically generate a unique incident ID in the format `INC-NNNN` at creation time. |
| IM-F04 | The system shall automatically record `reportedAt` and `updatedAt` timestamps at creation time. |
| IM-F05 | The system shall set the initial incident status to `"Reported"` automatically. |
| IM-F06 | The system shall display all incidents in a list view. |
| IM-F07 | The system shall allow a coordinator to search incidents by title, description, or location. |
| IM-F08 | The system shall allow filtering incidents by type, priority, and status independently or in combination. |
| IM-F09 | The system shall allow sorting incidents by date reported, priority, and status. |
| IM-F10 | The system shall display complete incident details in a detail view or modal. |
| IM-F11 | The system shall allow a coordinator to advance an incident's status through the defined lifecycle. |
| IM-F12 | The system shall prevent invalid status transitions. |
| IM-F13 | The system shall allow a coordinator to add or update free-text notes on any incident. |
| IM-F14 | The system shall allow deletion of a `Resolved` incident with a confirmation step. |
| IM-F15 | The system shall not allow deletion of incidents with status `Reported`, `Active`, or `In Progress`. |
| IM-F16 | The system shall persist all incident data in LocalStorage under the key `resqgrid_incidents`. |
| IM-F17 | The system shall recover gracefully from corrupted or missing LocalStorage data. |
| IM-F18 | The system shall warn the coordinator if a new incident appears to be a duplicate of a recent one. |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| IM-N01 | All incident data must survive a full browser page refresh. |
| IM-N02 | The incident list must handle zero incidents with a meaningful empty state. |
| IM-N03 | Long text fields (title, description) must be safely truncated in list views — no overflow or layout breakage. |
| IM-N04 | All UI must meet the accessibility requirements defined in `project-standards.md`. |
| IM-N05 | The feature must use no external libraries or frameworks. |

---

## 2. User Stories

**US-01 — Report an incident**
> As a coordinator, I want to fill in an incident form and submit it, so that the incident is recorded with a unique ID and timestamp and immediately appears in the incident list.

**US-02 — View all incidents**
> As a coordinator, I want to see a list of all incidents, so that I can monitor the current situation at a glance.

**US-03 — Find a specific incident**
> As a coordinator, I want to search and filter incidents by keywords, type, priority, and status, so that I can quickly locate the incident I need to act on.

**US-04 — View full incident details**
> As a coordinator, I want to open a full detail view of an incident, so that I can read the complete description, see assigned resources, review notes, and check timestamps.

**US-05 — Advance incident status**
> As a coordinator, I want to move an incident through its status lifecycle (Reported → Active → In Progress → Resolved), so that the team always knows the current state of each incident.

**US-06 — Add notes to an incident**
> As a coordinator, I want to add or update notes on an incident at any time, so that I can record observations, actions taken, or context that does not fit the main description.

**US-07 — Delete a resolved incident**
> As a coordinator, I want to delete a resolved incident after confirming the action, so that I can keep the incident list clean without accidentally removing active ones.

**US-08 — Survive a page refresh**
> As a coordinator, I want my incident data to still be there after I reload the page, so that I do not lose records between sessions.

---

## 3. Acceptance Criteria

### IM-F01 — Create Incident
- [ ] Submitting the form with all valid fields creates a new incident object.
- [ ] The new incident appears at the top of the incident list immediately after submission.
- [ ] The form resets to its default empty state after a successful submission.
- [ ] A success toast notification confirms the incident was created.

### IM-F03 — Auto-generated ID
- [ ] Every new incident has an `id` matching the pattern `INC-` followed by exactly 4 zero-padded digits.
- [ ] No two incidents share the same ID.
- [ ] The ID field is never editable by the user.

### IM-F04 — Auto-generated Timestamps
- [ ] `reportedAt` is set to the current UTC time at creation and never changes.
- [ ] `updatedAt` is updated to the current UTC time on every save (status change, notes update).
- [ ] `resolvedAt` is set when status is changed to `"Resolved"` and remains `null` otherwise.

### IM-F05 — Initial Status
- [ ] Every newly created incident has `status === "Reported"`.
- [ ] The status field is not visible or editable in the creation form.

### IM-F06 — Incident List
- [ ] All incidents are displayed in a list/table with at minimum: ID, title, type, priority, status, and reported date.
- [ ] Priority is shown as a colored badge with a text label.
- [ ] Status is shown as a colored badge with a text label.
- [ ] The list defaults to sorted by `reportedAt` descending (newest first).

### IM-F07 — Search
- [ ] Typing in the search box filters the list in real time (on each keystroke or with debounce).
- [ ] Search matches against `title`, `description`, and `location` fields (case-insensitive).
- [ ] Clearing the search box restores the full list.

### IM-F08 — Filters
- [ ] Filter controls exist for Type, Priority, and Status.
- [ ] Multiple filters can be active simultaneously; results match all active filters (AND logic).
- [ ] A "Clear filters" control resets all active filters at once.
- [ ] The count of visible incidents updates when filters change.

### IM-F09 — Sort
- [ ] Incidents can be sorted by: Date Reported (asc/desc), Priority (high→low / low→high), Status (lifecycle order).
- [ ] The active sort is visually indicated.

### IM-F11 — Status Update
- [ ] The detail view shows the current status and a button to advance to the next valid status.
- [ ] The button label reflects the next status (e.g., "Mark Active", "Mark In Progress", "Mark Resolved").
- [ ] Advancing status saves the change to LocalStorage and updates `updatedAt`.
- [ ] A success toast confirms the status change.

### IM-F12 — Invalid Transitions
- [ ] There is no UI control to move status backward.
- [ ] There is no UI control to skip a status step.
- [ ] Attempting a transition via code that violates the lifecycle throws an error and does not save.

### IM-F13 — Notes
- [ ] A notes textarea is visible in the incident detail view.
- [ ] Saving notes updates the incident's `notes` field and `updatedAt` in LocalStorage.
- [ ] An empty notes field is valid and saves as `""`.

### IM-F14 & IM-F15 — Delete
- [ ] A delete button is only rendered for incidents with `status === "Resolved"`.
- [ ] Clicking delete shows a confirmation dialog with the incident ID and title.
- [ ] Confirming removes the incident from LocalStorage and the list.
- [ ] Cancelling leaves the incident untouched.
- [ ] No delete control is visible for `Reported`, `Active`, or `In Progress` incidents.

### IM-F16 — Persistence
- [ ] All incidents are written to `localStorage` under key `resqgrid_incidents` as a JSON array after every create, update, or delete.
- [ ] On page load, incidents are read from LocalStorage before any rendering occurs.

### IM-F17 — Corrupted Data Recovery
- [ ] If `resqgrid_incidents` contains invalid JSON, the store resets to `[]` and logs a warning via the logger utility.
- [ ] If the parsed value is not an array, the store resets to `[]`.
- [ ] The user sees the empty-state view, not a crash or blank screen.

### IM-F18 — Duplicate Warning
- [ ] Before saving a new incident, the system checks for an existing incident with the same `type` and `location` reported within the last 5 minutes.
- [ ] If a match is found, a non-blocking warning is shown: "A similar incident was recently reported at this location. Please verify before submitting."
- [ ] The coordinator can still submit without changing anything.

---

## 4. Data Interactions

All data operations go through `incidentService.js`. UI components never call `localStorage` directly.

| Operation | Service function | Store action |
|-----------|-----------------|--------------|
| Create | `createIncident(fields)` | Appends to array, writes full array |
| Read all | `getAllIncidents()` | Returns full array from store |
| Read one | `getIncidentById(id)` | Finds by ID in array |
| Update status | `updateIncidentStatus(id, newStatus)` | Updates `status`, `updatedAt`, `resolvedAt`; writes array |
| Update notes | `updateIncidentNotes(id, notes)` | Updates `notes`, `updatedAt`; writes array |
| Delete | `deleteIncident(id)` | Removes from array by ID; writes array |
| Validate | `validateIncident(fields)` | Returns `{ valid: boolean, errors: object }` — no store write |

`store.js` exposes only `store.get(key)` and `store.set(key, value)`. `incidentService.js` uses these exclusively.

---

## 5. Validation Rules

All validation runs inside `validateIncident(fields)` before any service write.

| Field | Rule | Error message |
|-------|------|---------------|
| `title` | Required. String. 5–100 characters. | "Title is required and must be between 5 and 100 characters." |
| `description` | Required. String. 10–500 characters. | "Description is required and must be between 10 and 500 characters." |
| `location` | Required. Non-empty string after trim. | "Location is required." |
| `type` | Required. Must be one of the allowed Incident Type enum values. | "Please select a valid incident type." |
| `priority` | Required. Must be one of the allowed Incident Priority enum values. | "Please select a valid priority level." |
| `reportedBy` | Required. Non-empty string after trim. | "Reporter name is required." |
| `id` | Never accepted from user input. Always auto-generated. | — |
| `reportedAt` | Never accepted from user input. Always set to `new Date().toISOString()`. | — |
| `status` | Never accepted from user input on creation. Always set to `"Reported"`. | — |

Error messages are shown inline beneath the relevant form field. The form submit button is not disabled; errors appear only on submission attempt and clear as the user corrects each field.

---

## 6. Status Transition Rules

```
Reported ──► Active ──► In Progress ──► Resolved
```

| Current status | Allowed next status | Blocked transitions |
|----------------|--------------------|--------------------|
| `Reported` | `Active` | `In Progress`, `Resolved` |
| `Active` | `In Progress` | `Reported`, `Resolved` |
| `In Progress` | `Resolved` | `Reported`, `Active` |
| `Resolved` | *(none)* | All — terminal state |

Enforcement rules:
- `updateIncidentStatus(id, newStatus)` must validate the transition before writing.
- If the transition is invalid, the function must return `{ success: false, error: "Invalid status transition." }` and not modify the store.
- The UI must only present the single valid "next step" button — it must not show all statuses as options.
- When an incident is set to `Resolved`, `resolvedAt` is set to the current UTC timestamp.
- When an incident is set to `Resolved`, the resource release workflow defined in `data-models.md` is triggered by `incidentService.js`.

---

## 7. Error and Empty States

| Scenario | Behaviour |
|----------|-----------|
| No incidents exist | Show a centered empty-state panel: an icon, heading "No incidents reported yet", and a "Report Incident" call-to-action button. |
| Search returns no results | Show inline message: "No incidents match your search." with a "Clear search" link. |
| Filters return no results | Show inline message: "No incidents match the selected filters." with a "Clear filters" link. |
| LocalStorage is corrupted | Reset to `[]`, show empty state, show a dismissible banner: "Incident data could not be loaded and has been reset." |
| LocalStorage is unavailable | Show a persistent banner: "Storage is unavailable. Data will not be saved this session." |
| Delete fails unexpectedly | Show inline error: "Could not delete incident. Please try again." |
| Status update fails | Show inline error: "Status could not be updated. Please try again." |

---

## 8. UI Behaviour

### Incident Creation Form
- Located at route `#incidents/new` or in a slide-in panel — implementation decision at build time.
- Fields: Title (text input), Description (textarea), Location (text input), Type (select), Priority (select), Reporter name (text input).
- Submit button label: "Report Incident".
- On successful submit: show success toast, reset form, redirect/scroll to incident list.
- On validation failure: show field-level errors, keep form open, scroll to first error.

### Incident List View
- Route: `#incidents`
- Toolbar: search input, Type filter (select), Priority filter (select), Status filter (select), Sort control, "Clear filters" button, "Report Incident" button.
- Each list row/card shows: ID, title (truncated at ~60 chars with ellipsis), type badge, priority badge, status badge, reported date (formatted as `DD MMM YYYY HH:mm`), and an "View Details" action.
- Critical priority incidents must be visually distinguishable (e.g., left border accent color `--resq-color-critical`).

### Incident Detail View
- Route: `#incidents/:id` or modal overlay.
- Shows all fields including full description, full notes, assigned resources list, all timestamps.
- Status advancement button (disabled and hidden when `Resolved`).
- Notes textarea with a "Save Notes" button.
- Delete button (only visible when `status === "Resolved"`).
- A "Back to Incidents" navigation link.

### Badges
- Priority badges: `Critical` = red, `High` = orange, `Medium` = yellow, `Low` = blue. Always include text label.
- Status badges: `Reported` = grey, `Active` = blue, `In Progress` = amber, `Resolved` = green. Always include text label.

### Confirmation Dialog
- Native `confirm()` is acceptable for MVP. A custom modal is preferred for a polished result.
- Dialog text: "Delete incident [INC-NNNN]: [title]? This action cannot be undone."

### Toast Notifications
- Non-blocking, appear at top-right of screen.
- Auto-dismiss after 4 seconds.
- Types: success (green), error (red), warning (amber), info (blue).

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| Same location + type within 5 minutes | Show non-blocking duplicate warning. Do not prevent submission. |
| Title or description at exact character limit boundary | Accept at exactly 5/10 chars (min) and 100/500 chars (max). Reject at 4/9 or 101/501. |
| Whitespace-only input | Trim before validation. Treat as empty — fail required check. |
| Extremely long location string | Accept up to 200 characters. Truncate in list view. Show full text in detail view. |
| Incident list with 1000+ entries | List must remain performant. Consider rendering only visible items (virtual scroll is optional for MVP; pagination is an acceptable alternative). |
| Deleting the only incident | List shows empty state immediately after deletion. |
| Rapid double-submit | Disable submit button after first click until operation resolves. |
| LocalStorage quota exceeded | Catch `QuotaExceededError`, show error toast: "Storage full. Could not save incident." |
| Page refresh mid-form | Form data is lost (no auto-save required for MVP). Acceptable — note this limitation in UI. |

---

## 10. Design Considerations

- **Incident type color coding** — each type should have a subtle visual identity (icon + accent) to aid quick scanning.
- **Priority hierarchy** — Critical incidents must be impossible to miss. Consider a pulsing border or prominent badge.
- **Progressive disclosure** — show minimal info in the list row; full details on demand. Avoid information overload.
- **Date formatting** — always display human-readable dates (`15 Mar 2024, 09:30`) alongside ISO timestamps in tooltips or `<time datetime="...">` elements for accessibility.
- **Responsive list** — on small screens, the table/grid collapses to a stacked card layout. Filter toolbar wraps cleanly.
- **Prototype disclaimer** — a visible banner or footer note on the incidents page: "Educational prototype — do not use in real emergencies."
- **Empty state quality** — the empty state must not look like a bug. Use an SVG illustration or large icon, a clear heading, and a single clear action.
- **Keyboard navigation** — the list must be navigable by keyboard. Each row/card must be focusable and reachable via Tab.

---

## 11. Implementation Tasks

Tasks are ordered by dependency. Complete each task before starting the next group.

### Group A — Data Layer

- [ ] **A1** — Create `assets/js/store.js` with `store.get(key)`, `store.set(key, value)`, and `store.remove(key)` wrapping `localStorage` with try/catch error handling and basic schema validation.
- [ ] **A2** — Create `assets/js/utils.js` with: `generateId(prefix, existingItems)`, `formatDate(isoString)`, `truncateText(str, maxLength)`, `getNow()` (returns ISO 8601 UTC string).
- [ ] **A3** — Create `assets/js/services/incidentService.js` implementing: `createIncident`, `getAllIncidents`, `getIncidentById`, `updateIncidentStatus`, `updateIncidentNotes`, `deleteIncident`, `validateIncident`.
- [ ] **A4** — Write manual tests (browser console) for each service function: create, read, update status (valid and invalid transitions), update notes, delete (resolved and non-resolved), corrupted data recovery.

### Group B — Incident Form UI

- [ ] **B1** — Create `assets/js/ui/incidentForm.js` that renders the incident creation form into a target container element.
- [ ] **B2** — Implement field-level validation feedback: inline error messages that appear on submit and clear on correction.
- [ ] **B3** — Implement duplicate incident detection warning using `incidentService` before submission.
- [ ] **B4** — Implement submit handler: validate → warn if duplicate → create incident → show toast → reset form.
- [ ] **B5** — Disable submit button on first click; re-enable after operation resolves.

### Group C — Incident List UI

- [ ] **C1** — Create `assets/js/ui/incidentList.js` that renders the incident list into a target container.
- [ ] **C2** — Implement search: real-time filtering by title, description, location.
- [ ] **C3** — Implement filter controls: Type, Priority, Status — combined AND logic.
- [ ] **C4** — Implement sort controls: by date, priority, status.
- [ ] **C5** — Implement "Clear filters" control.
- [ ] **C6** — Implement empty state panel (no incidents, no search results, no filter results — three distinct messages).
- [ ] **C7** — Implement truncation of title and description in list rows. Full text visible on hover via `title` attribute.

### Group D — Incident Detail UI

- [ ] **D1** — Create `assets/js/ui/incidentDetail.js` that renders full incident details into a target container or modal.
- [ ] **D2** — Render status advancement button with correct next-status label; hide when `Resolved`.
- [ ] **D3** — Implement status update handler: call service → update display → show toast.
- [ ] **D4** — Render notes textarea and "Save Notes" button; implement save handler.
- [ ] **D5** — Render delete button only for `Resolved` incidents; implement confirmation dialog and delete handler.
- [ ] **D6** — Render assigned resources list (read-only at this stage — resource assignment is in the Resource Management spec).
- [ ] **D7** — Implement "Back to Incidents" navigation.

### Group E — CSS Styling

- [ ] **E1** — Define all incident-related CSS tokens in `main.css`: priority colors, status colors.
- [ ] **E2** — Style priority badges and status badges in `components.css`.
- [ ] **E3** — Style the incident list row/card, including Critical priority visual accent.
- [ ] **E4** — Style the incident creation form with field-level error states.
- [ ] **E5** — Style the incident detail view.
- [ ] **E6** — Style the empty state panel.
- [ ] **E7** — Style the toast notification component.
- [ ] **E8** — Add responsive breakpoints for the list and form in `responsive.css`.

### Group F — Integration & Polish

- [ ] **F1** — Wire incidentForm, incidentList, and incidentDetail into the router/app shell.
- [ ] **F2** — Ensure LocalStorage corruption recovery is exercised on app init (call `getAllIncidents()` on load).
- [ ] **F3** — Add the prototype disclaimer banner to the incidents section.
- [ ] **F4** — Accessibility pass: verify all labels, ARIA roles, `aria-live` on list updates, keyboard navigation.
- [ ] **F5** — Cross-browser smoke test in Chrome, Firefox, and Safari (or Edge).
