# Resource Management — Feature Specification

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec version:** 1.0
**Status:** Approved
**References:** #[[file:.kiro/steering/project-standards.md]] · #[[file:.kiro/steering/data-models.md]] · #[[file:.kiro/specs/incident-management.md]]

---

## 1. Requirements

### Functional Requirements

| ID | Requirement |
|----|-------------|
| RM-F01 | The system shall allow a coordinator to add a new resource by submitting a form. |
| RM-F02 | The system shall automatically generate a unique resource ID in the format `RES-NNNN` at creation time. |
| RM-F03 | The system shall automatically record an `addedAt` timestamp at creation time. |
| RM-F04 | The system shall set the initial resource status to `"Available"` on creation. |
| RM-F05 | The system shall display all resources in a list view. |
| RM-F06 | The system shall allow a coordinator to search resources by name and location. |
| RM-F07 | The system shall allow filtering resources by type and by status independently or in combination. |
| RM-F08 | The system shall allow a coordinator to edit resource name, type, and location. |
| RM-F09 | The system shall allow deletion of a resource that is not currently `Deployed`, with a confirmation step. |
| RM-F10 | The system shall prevent deletion of a `Deployed` resource. |
| RM-F11 | The system shall allow a coordinator to assign an `Available` resource to an active incident. |
| RM-F12 | The system shall prevent assigning a `Deployed` or `Maintenance` resource to any incident. |
| RM-F13 | The system shall prevent assigning a resource to a `Resolved` incident. |
| RM-F14 | The system shall allow a coordinator to manually release a `Deployed` resource from its incident. |
| RM-F15 | When an incident is resolved, the system shall automatically release all resources assigned to it. |
| RM-F16 | Assignment must update both the resource record (`assignedTo`, `status`) and the incident record (`assignedResources`) atomically. |
| RM-F17 | The system shall allow a coordinator to set a resource status to `Maintenance` manually. |
| RM-F18 | The system shall allow a coordinator to clear `Maintenance` status, returning the resource to `Available`. |
| RM-F19 | The system shall persist all resource data in LocalStorage under the key `resqgrid_resources`. |
| RM-F20 | The system shall recover gracefully from corrupted or missing LocalStorage data. |
| RM-F21 | On store load, the system shall detect and repair orphaned resource references. |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| RM-N01 | All resource data must survive a full browser page refresh. |
| RM-N02 | The resource list must handle zero resources with a meaningful empty state. |
| RM-N03 | Resource names must be unique across all stored resources. |
| RM-N04 | All UI must meet the accessibility requirements defined in `project-standards.md`. |
| RM-N05 | The feature must use no external libraries or frameworks. |

---

## 2. User Stories

**US-01 — Add a resource**
> As a coordinator, I want to add a new emergency resource with a name, type, and location, so that it is available for assignment to incidents.

**US-02 — View all resources**
> As a coordinator, I want to see a list of all resources with their current status, so that I can assess what is available at a glance.

**US-03 — Find a specific resource**
> As a coordinator, I want to search and filter resources by name, location, type, and availability status, so that I can quickly find what I need during an emergency.

**US-04 — Edit a resource**
> As a coordinator, I want to edit a resource's name, type, or location, so that I can keep resource records accurate.

**US-05 — Delete a resource**
> As a coordinator, I want to delete a resource that is no longer in service, after confirming the action, so that the resource list stays accurate.

**US-06 — Assign a resource to an incident**
> As a coordinator, I want to select an available resource and assign it to an active incident, so that the resource is dispatched and tracked against that incident.

**US-07 — Release a resource**
> As a coordinator, I want to manually release a deployed resource from an incident, so that it becomes available for reassignment.

**US-08 — Mark a resource as under maintenance**
> As a coordinator, I want to mark a resource as under maintenance, so that it cannot be accidentally assigned while it is unavailable.

**US-09 — Auto-release on resolution**
> As a coordinator, I want all resources assigned to an incident to be automatically released when I resolve that incident, so that I do not have to manually release each one.

**US-10 — Handle no available resources gracefully**
> As a coordinator, I want to be clearly informed when no resources of the needed type are currently available, so that I can make an informed decision rather than see an error or empty crash.

---

## 3. Acceptance Criteria

### RM-F01 — Add Resource
- [ ] Submitting the form with all valid fields creates a new resource object.
- [ ] The new resource appears in the resource list immediately after submission.
- [ ] The form resets to its default empty state after a successful submission.
- [ ] A success toast confirms the resource was added.

### RM-F02 — Auto-generated ID
- [ ] Every new resource has an `id` matching the pattern `RES-` followed by exactly 4 zero-padded digits.
- [ ] No two resources share the same ID.
- [ ] The ID field is never editable by the user.

### RM-F04 — Initial Status
- [ ] Every newly created resource has `status === "Available"` and `assignedTo === null`.

### RM-F05 — Resource List
- [ ] All resources are displayed with at minimum: ID, name, type, status, and location.
- [ ] Status is shown as a colored badge with a text label.
- [ ] Type is shown as a badge or tag.
- [ ] The list defaults to sorted by `addedAt` descending (newest first).

### RM-F06 — Search
- [ ] Typing in the search box filters the list in real time.
- [ ] Search matches against `name` and `location` fields (case-insensitive).
- [ ] Clearing the search restores the full list.

### RM-F07 — Filters
- [ ] Filter controls exist for Type and Status.
- [ ] Multiple filters can be active simultaneously (AND logic).
- [ ] A "Clear filters" control resets all active filters.

### RM-F08 — Edit Resource
- [ ] An edit action opens the resource form pre-populated with existing values.
- [ ] Name, type, and location can be modified.
- [ ] ID and `addedAt` cannot be modified.
- [ ] Saving a valid edit updates the resource in LocalStorage and the list.
- [ ] A success toast confirms the update.
- [ ] Editing a `Deployed` resource's name and location is allowed; changing its type is allowed but must show a warning that the resource is currently deployed.

### RM-F09 & RM-F10 — Delete Resource
- [ ] A delete button is rendered for resources with `status !== "Deployed"`.
- [ ] Clicking delete shows a confirmation dialog with the resource ID and name.
- [ ] Confirming removes the resource from LocalStorage and the list.
- [ ] Cancelling leaves the resource untouched.
- [ ] No delete control is visible for `Deployed` resources; instead show a tooltip or label: "Cannot delete a deployed resource."

### RM-F11 — Assign Resource
- [ ] Assignment UI shows only `Available` resources.
- [ ] Assignment UI can be filtered by resource type.
- [ ] Selecting a resource and confirming sets `resource.status = "Deployed"`, `resource.assignedTo = incidentId`, and adds `resourceId` to `incident.assignedResources`.
- [ ] The resource immediately appears as `Deployed` in the resource list.
- [ ] A success toast confirms the assignment.

### RM-F12 & RM-F13 — Invalid Assignments
- [ ] `Deployed` and `Maintenance` resources do not appear in the assignment selection list.
- [ ] `Resolved` incidents do not appear in the incident selection list for assignment.
- [ ] Attempting assignment via code with an invalid resource or incident returns `{ success: false, error: "..." }` and does not write to the store.

### RM-F14 — Manual Release
- [ ] A "Release" button is shown next to each deployed resource in the incident detail view and in the resource detail view.
- [ ] Releasing sets `resource.status = "Available"`, `resource.assignedTo = null`, and removes the resource ID from `incident.assignedResources`.
- [ ] A success toast confirms the release.

### RM-F15 — Auto-release on Incident Resolution
- [ ] When `incidentService.updateIncidentStatus(id, "Resolved")` is called, it iterates `incident.assignedResources` and calls `resourceService.releaseResource(resourceId)` for each.
- [ ] After auto-release, `incident.assignedResources` is set to `[]`.
- [ ] Auto-released resources appear as `Available` in the resource list.

### RM-F16 — Atomic Sync
- [ ] Both the resource and incident records are updated in the same store write operation (read both arrays → mutate both → write both).
- [ ] If writing either array fails, neither change is persisted (best-effort rollback).

### RM-F17 & RM-F18 — Maintenance Status
- [ ] A "Set Maintenance" button is shown for `Available` resources.
- [ ] A "Mark Available" button is shown for `Maintenance` resources.
- [ ] Neither button is shown for `Deployed` resources.
- [ ] Toggling maintenance updates `resource.status` in LocalStorage.

### RM-F19 — Persistence
- [ ] All resources are written to `localStorage` under key `resqgrid_resources` as a JSON array after every create, update, or delete.
- [ ] On page load, resources are read from LocalStorage before any rendering.

### RM-F20 — Corrupted Data Recovery
- [ ] If `resqgrid_resources` contains invalid JSON, the store resets to `[]` and logs a warning.
- [ ] If the parsed value is not an array, the store resets to `[]`.
- [ ] The user sees the empty-state view, not a crash.

### RM-F21 — Orphan Repair
- [ ] On store load, for each resource where `assignedTo` is set but the referenced incident does not exist, reset `resource.assignedTo = null` and `resource.status = "Available"`.
- [ ] Repaired resources are saved back to LocalStorage silently.

---

## 4. Data Interactions

All data operations go through `resourceService.js` and `incidentService.js`. UI components never call `localStorage` directly.

### resourceService.js functions

| Function | Description |
|----------|-------------|
| `createResource(fields)` | Validates, generates ID + timestamp, sets status `Available`, appends to store |
| `getAllResources()` | Returns full resource array from store |
| `getResourceById(id)` | Finds resource by ID |
| `getAvailableResourcesByType(type)` | Returns resources where `status === "Available"` and `type === type` |
| `updateResource(id, fields)` | Updates `name`, `type`, `location` only; validates uniqueness of name |
| `deleteResource(id)` | Validates not `Deployed`; removes from store |
| `assignResource(resourceId, incidentId)` | Validates both records; sets `Deployed` + `assignedTo`; updates incident's `assignedResources` |
| `releaseResource(resourceId)` | Sets `Available` + `assignedTo = null`; removes from incident's `assignedResources` |
| `setMaintenance(resourceId)` | Sets `status = "Maintenance"` |
| `clearMaintenance(resourceId)` | Sets `status = "Available"` |
| `validateResource(fields)` | Returns `{ valid: boolean, errors: object }` — no store write |
| `repairOrphans()` | Runs orphan detection and repair on load |

### Cross-service coordination

`assignResource` and `releaseResource` in `resourceService.js` must read and write **both** `resqgrid_resources` and `resqgrid_incidents` in a single coordinated update. This is the only place where a service touches another service's data key directly.

`incidentService.updateIncidentStatus` calls `resourceService.releaseResource` for each assigned resource when resolving an incident.

---

## 5. Assignment Rules

The assignment workflow follows this sequence:

1. Coordinator opens the assignment panel from an active incident's detail view.
2. The panel shows a type filter (optional) and a list of `Available` resources.
3. If a type suggestion is available from the assistant, pre-select that type filter.
4. If no `Available` resources exist for the selected type, show: *"No [type] resources are currently available. You may select a different type or check back later."* Do not hide the panel or show an error state.
5. Coordinator selects a resource from the list.
6. System calls `resourceService.assignResource(resourceId, incidentId)`.
7. Service validates:
   - Resource exists and `status === "Available"`.
   - Incident exists and `status !== "Resolved"`.
8. If valid: update both records, write to store, return `{ success: true }`.
9. If invalid: return `{ success: false, error: "<reason>" }`, show error toast, do not write.
10. On success: refresh incident detail view and resource list, show success toast.

**One-to-one constraint:** A resource can only be assigned to one incident at a time. Attempting to assign an already-`Deployed` resource returns an error even if called programmatically.

---

## 6. Validation Rules

All validation runs inside `validateResource(fields)` before any service write.

| Field | Rule | Error message |
|-------|------|---------------|
| `name` | Required. Non-empty after trim. Must be unique across all resources (case-insensitive). | "Resource name is required and must be unique." |
| `type` | Required. Must be one of the allowed Resource Type enum values. | "Please select a valid resource type." |
| `location` | Required. Non-empty after trim. | "Location is required." |
| `id` | Never accepted from user input. Always auto-generated. | — |
| `addedAt` | Never accepted from user input. Always set to `new Date().toISOString()`. | — |
| `status` | Never accepted from user input on creation. Always set to `"Available"`. | — |
| `assignedTo` | Never accepted from user input directly. Managed by `assignResource` / `releaseResource`. | — |

Edit validation: when editing an existing resource, uniqueness check for `name` must exclude the resource being edited (i.e., a resource may keep its own name).

---

## 7. Resource Lifecycle

```
                    ┌─────────────────────────────┐
                    │                             │
          Create    ▼     Assign to incident      │ Release / incident resolved
            ──► Available ────────────────────► Deployed ──────────────────────►┐
                    ▲                                                            │
                    │  Clear maintenance                                         │
                    └──────────────── Maintenance ◄────────────────────── ──────┘
                                          ▲
                                          │ Set maintenance (from Available only)
                                          │
                                       Available
```

| Current status | Allowed transitions | Blocked transitions |
|----------------|--------------------|--------------------|
| `Available` | → `Deployed` (via assign) · → `Maintenance` (manual) | — |
| `Deployed` | → `Available` (via release or incident resolved) | → `Maintenance` (must release first) |
| `Maintenance` | → `Available` (manual clear) | → `Deployed` (must clear maintenance first) |

Setting `Maintenance` on a `Deployed` resource is blocked. The coordinator must release the resource from its incident before putting it into maintenance.

---

## 8. Error and Empty States

| Scenario | Behaviour |
|----------|-----------|
| No resources exist | Show centered empty-state panel: icon, heading "No resources added yet", and an "Add Resource" call-to-action button. |
| Search returns no results | Inline message: "No resources match your search." with a "Clear search" link. |
| Filters return no results | Inline message: "No resources match the selected filters." with a "Clear filters" link. |
| No available resources for assignment (general) | Show in assignment panel: "No resources are currently available." with a note to check resource statuses. |
| No available resources of a specific type | Show: "No [type] resources are currently available." Retain type filter so coordinator can try a different type. |
| Attempting to delete a deployed resource | Hide delete button; show tooltip/label: "Cannot delete a deployed resource. Release it from its incident first." |
| LocalStorage corrupted | Reset to `[]`, show empty state, show dismissible banner: "Resource data could not be loaded and has been reset." |
| LocalStorage unavailable | Persistent banner: "Storage is unavailable. Data will not be saved this session." |
| Assignment fails (validation) | Error toast with the specific reason. |
| Delete fails unexpectedly | Inline error: "Could not delete resource. Please try again." |

---

## 9. UI Behaviour

### Resource Creation / Edit Form
- Accessible from a "Add Resource" button in the resource list toolbar.
- Edit mode opens the same form pre-filled.
- Fields: Name (text input), Type (select), Location (text input).
- Status and ID are not shown in the form.
- Submit label: "Add Resource" (create mode) / "Save Changes" (edit mode).
- On success: toast, reset/close form, refresh list.
- On validation failure: field-level inline errors.

### Resource List View
- Route: `#resources`
- Toolbar: search input, Type filter (select), Status filter (select), "Clear filters" button, "Add Resource" button.
- Each list row/card: ID, name, type badge, status badge, location, assigned incident (if `Deployed`), action buttons.
- Action buttons per row:
  - `Available`: Edit · Set Maintenance · Delete
  - `Deployed`: Edit · Release · *(no delete)*
  - `Maintenance`: Edit · Mark Available · Delete

### Assignment Panel
- Opened from within the Incident Detail view (Task Group D in incident-management spec).
- Shows: incident ID and title at top, type filter, list of `Available` resources.
- Each resource row: name, type, location, "Assign" button.
- "No resources available" message replaces the list when empty.
- After successful assignment, panel refreshes or closes.

### Resource Detail / Status Panel
- Optional modal or inline expansion showing full resource details.
- Shows: ID, name, type, status, location, addedAt, assigned incident ID (linked to incident detail if deployed).
- Shows "Release" button if `Deployed`.
- Shows "Set Maintenance" / "Mark Available" toggle buttons as appropriate.

### Badges
- Status: `Available` = green, `Deployed` = blue, `Maintenance` = amber. Always include text label.
- Type: neutral badge (grey/slate) with text label.

### Confirmation Dialog
- On delete: "Delete resource [RES-NNNN]: [name]? This action cannot be undone."
- On release (manual): "Release [name] from incident [INC-NNNN]? The resource will return to Available status."

---

## 10. Edge Cases

| Case | Handling |
|------|----------|
| Editing the name of a `Deployed` resource | Allow. Show info message: "This resource is currently deployed to [INC-NNNN]." |
| Changing the type of a `Deployed` resource | Allow with warning: "This resource is currently deployed. Changing the type will not affect the current assignment." |
| Two coordinators assigning the same resource (single tab) | Not possible — single-tab prototype. Document limitation. |
| Resolving an incident with zero assigned resources | Works normally — `assignedResources` is `[]`, nothing to release. |
| Releasing a resource whose incident no longer exists | Detect via orphan check. Set resource to `Available`. Log warning. |
| Assigning a resource to an incident that becomes Resolved between selection and confirmation | Assignment call detects `status === "Resolved"` and returns `{ success: false }`. Show error toast. |
| Resource name uniqueness check on edit (own name) | Exclude the resource's own ID from the uniqueness check. |
| LocalStorage quota exceeded on resource write | Catch `QuotaExceededError`, show error toast: "Storage full. Could not save resource." |
| Deleting a resource that was in `assignedResources` of a resolved incident | Fine — incident is resolved and assigned resources are already cleared. |
| 100+ resources in the list | List must remain performant. Pagination is acceptable for MVP. |

---

## 11. Design Considerations

- **Status-at-a-glance** — the status badge is the most important visual element in each resource row. Make it prominent and color-coded: green (Available), blue (Deployed), amber (Maintenance).
- **Availability summary** — a small summary bar or stat strip above the list (e.g., "12 Available · 4 Deployed · 1 Maintenance") helps coordinators assess capacity at a glance without counting.
- **Assignment panel context** — when opened from an incident, pre-filter by the resource types relevant to that incident type (e.g., Fire incident → suggest Fire Trucks + Medical Teams). This is a UX hint, not a hard filter.
- **Deployed resource card** — show the linked incident ID prominently so coordinators can trace back which incident a resource is supporting.
- **Release action prominence** — the "Release" button should be easy to find but protected by confirmation to avoid accidental releases during a crisis.
- **No orphaned UI state** — if a resource is released while the assignment panel is open, the panel must refresh to reflect the change.
- **Prototype disclaimer** — include the standard educational prototype disclaimer on the resources page.
- **Responsive layout** — on small screens, resource cards stack vertically. Action buttons remain accessible and meet 44×44px touch target requirement.

---

## 12. Implementation Tasks

Tasks are ordered by dependency. Complete each group before starting the next.

### Group A — Data Layer

- [ ] **A1** — Extend `assets/js/utils.js` if needed: confirm `generateId` handles `RES-` prefix correctly alongside `INC-` prefix.
- [ ] **A2** — Create `assets/js/services/resourceService.js` implementing all functions listed in Section 4: `createResource`, `getAllResources`, `getResourceById`, `getAvailableResourcesByType`, `updateResource`, `deleteResource`, `assignResource`, `releaseResource`, `setMaintenance`, `clearMaintenance`, `validateResource`, `repairOrphans`.
- [ ] **A3** — Implement `repairOrphans()` to run on app init: scan all resources where `assignedTo !== null`, verify the referenced incident exists, reset if not.
- [ ] **A4** — Update `incidentService.updateIncidentStatus` to call `resourceService.releaseResource` for each resource in `assignedResources` when transitioning to `Resolved`.
- [ ] **A5** — Write manual browser-console tests for: create, read, update, delete (available and deployed), assign (valid and invalid), release, maintenance toggle, orphan repair, corrupted data.

### Group B — Resource Form UI

- [ ] **B1** — Create `assets/js/ui/resourceForm.js` that renders the add/edit resource form into a target container.
- [ ] **B2** — Implement field-level validation feedback: inline error messages on submit, clear on correction.
- [ ] **B3** — Implement create mode submit handler: validate → create → toast → reset form.
- [ ] **B4** — Implement edit mode submit handler: validate → update → toast → close/refresh.
- [ ] **B5** — Ensure name uniqueness check excludes the current resource in edit mode.

### Group C — Resource List UI

- [ ] **C1** — Create `assets/js/ui/resourceList.js` that renders the resource list into a target container.
- [ ] **C2** — Implement availability summary strip (Available / Deployed / Maintenance counts).
- [ ] **C3** — Implement search: real-time filtering by name and location.
- [ ] **C4** — Implement filter controls: Type and Status, combined AND logic.
- [ ] **C5** — Implement "Clear filters" control.
- [ ] **C6** — Render correct action buttons per resource status (see Section 9).
- [ ] **C7** — Implement maintenance toggle handlers with store update and toast.
- [ ] **C8** — Implement delete handler with confirmation dialog and store update.
- [ ] **C9** — Implement empty state panel (no resources, no search results, no filter results).

### Group D — Assignment Panel UI

- [ ] **D1** — Create `assets/js/ui/assignmentPanel.js` that renders the resource assignment panel.
- [ ] **D2** — Show incident context (ID, title, type) at the top of the panel.
- [ ] **D3** — Render type filter pre-selected based on incident type where applicable.
- [ ] **D4** — Render list of `Available` resources with "Assign" button per row.
- [ ] **D5** — Handle "no available resources" state with clear messaging.
- [ ] **D6** — Implement assignment handler: call `resourceService.assignResource` → toast → refresh panel and incident detail.
- [ ] **D7** — Implement manual release handler: confirmation → call `resourceService.releaseResource` → toast → refresh.

### Group E — CSS Styling

- [ ] **E1** — Add resource status color tokens to `main.css` if not already present: `--resq-color-status-available`, `--resq-color-status-deployed`, `--resq-color-status-maintenance`.
- [ ] **E2** — Style resource status and type badges in `components.css`.
- [ ] **E3** — Style the resource list row/card and availability summary strip.
- [ ] **E4** — Style the resource add/edit form with field-level error states.
- [ ] **E5** — Style the assignment panel.
- [ ] **E6** — Style the empty state panel for resources.
- [ ] **E7** — Add responsive breakpoints for resource list and assignment panel in `responsive.css`.

### Group F — Integration & Polish

- [ ] **F1** — Wire `resourceForm`, `resourceList`, and `assignmentPanel` into the router/app shell.
- [ ] **F2** — Call `resourceService.repairOrphans()` on app init after loading all data.
- [ ] **F3** — Verify incident resolution auto-releases resources end-to-end: create incident → add resource → assign → resolve → confirm resource is `Available`.
- [ ] **F4** — Add the prototype disclaimer banner to the resources section.
- [ ] **F5** — Accessibility pass: labels, ARIA roles, `aria-live` on list updates, keyboard navigation, focus management on panel open/close.
- [ ] **F6** — Cross-browser smoke test in Chrome, Firefox, and Edge/Safari.
