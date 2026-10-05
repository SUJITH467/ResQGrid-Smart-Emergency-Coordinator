# ResQGrid Core — Requirements

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec type:** Kiro native feature spec
**Status:** Implemented
**Source specs:** incident-management.md · resource-management.md · decision-assistant.md · statistics-dashboard.md · incident-service-validation.md
**Data model:** .kiro/steering/data-models.md
**Standards:** .kiro/steering/project-standards.md · .kiro/steering/testing-standards.md

---

## Overview

ResQGrid is an educational browser-based prototype for campus and community
emergency coordination. A single coordinator can log incidents, manage response
resources, get rule-based classification suggestions, and review operational
statistics — entirely in the browser, with no backend or network dependency.

> ⚠️ Educational prototype. Do not use in real emergencies.

---

## User Stories

### Incident Management

**US-IM-01 — Report an incident**
As a coordinator, I want to fill in an incident form and submit it, so that the incident is recorded with a unique ID and timestamp and immediately appears in the incident list.

**US-IM-02 — Monitor all incidents**
As a coordinator, I want to see a list of all incidents so that I can monitor the current situation at a glance.

**US-IM-03 — Find a specific incident**
As a coordinator, I want to search and filter incidents by keywords, type, priority, and status so that I can quickly locate the incident I need to act on.

**US-IM-04 — View full incident details**
As a coordinator, I want to open a full detail view of an incident so that I can read the complete description, see assigned resources, review notes, and check timestamps.

**US-IM-05 — Advance incident status**
As a coordinator, I want to move an incident through its lifecycle (Reported → Active → In Progress → Resolved) so that the team always knows the current state of each incident.

**US-IM-06 — Add coordinator notes**
As a coordinator, I want to add or update free-text notes on an incident at any time so that I can record observations or actions taken.

**US-IM-07 — Delete a resolved incident**
As a coordinator, I want to delete a resolved incident after confirming, so that I can keep the incident list clean without accidentally removing active ones.

**US-IM-08 — Data survives page refresh**
As a coordinator, I want my incident data to still be there after I reload the page, so that I do not lose records between sessions.

### Resource Management

**US-RM-01 — Add a resource**
As a coordinator, I want to add a new emergency resource with a name, type, and location so that it is available for assignment to incidents.

**US-RM-02 — View all resources**
As a coordinator, I want to see a list of all resources with their current status so that I can assess capacity at a glance.

**US-RM-03 — Find a specific resource**
As a coordinator, I want to search and filter resources by name, location, type, and status so that I can quickly find what I need during an emergency.

**US-RM-04 — Edit a resource**
As a coordinator, I want to edit a resource's name, type, or location so that I can keep resource records accurate.

**US-RM-05 — Assign a resource to an incident**
As a coordinator, I want to select an available resource and assign it to an active incident so that the resource is dispatched and tracked against that incident.

**US-RM-06 — Release a resource**
As a coordinator, I want to manually release a deployed resource so that it becomes available for reassignment.

**US-RM-07 — Mark a resource as under maintenance**
As a coordinator, I want to mark a resource as under maintenance so that it cannot be accidentally assigned while unavailable.

**US-RM-08 — Auto-release on resolution**
As a coordinator, I want all resources assigned to an incident to be automatically released when I resolve that incident so that I do not have to manually release each one.

### Decision-Support Assistant

**US-DA-01 — Analyze an incident description**
As a coordinator, I want to type a plain-language description of what I am seeing and have the assistant suggest a type, priority, and resources so that I can make faster and more consistent triage decisions.

**US-DA-02 — Understand the reasoning**
As a coordinator, I want to see which words or phrases triggered the suggestion so that I can trust the result and verify it makes sense.

**US-DA-03 — Edit a suggestion before accepting**
As a coordinator, I want to change any suggested value before I accept it so that I am never forced to use an incorrect classification.

**US-DA-04 — Transfer to incident form**
As a coordinator, I want to click "Accept" and have the suggestion values automatically fill in the incident form so that I do not have to retype information.

**US-DA-05 — Handle an unrecognized description**
As a coordinator, I want the assistant to tell me clearly when it could not classify my description so that I know to classify the incident myself.

### Statistics Dashboard

**US-SD-01 — Operational overview**
As a coordinator, I want a single-page view of all key metrics so that I can understand the current state of incidents and resources at a glance.

**US-SD-02 — Incident type and priority analysis**
As a coordinator, I want to see incident breakdowns by type and priority so that I can identify which categories are most active.

**US-SD-03 — Resource utilization**
As a coordinator, I want to see what proportion of resources are currently deployed so that I can assess whether capacity is stretched.

**US-SD-04 — Resolution performance**
As a coordinator, I want to see average, fastest, and slowest resolution times so that I can review response effectiveness.

---

## Functional Requirements

### Incident Management (IM)

| ID | WHEN / THE SYSTEM SHALL |
|----|------------------------|
| IM-F01 | The system shall allow a coordinator to create a new incident by submitting a form. |
| IM-F02 | The system shall accept title (5–100 chars), description (10–500 chars), location, type, priority, and reporter name for each incident. |
| IM-F03 | The system shall automatically generate a unique incident ID in the format `INC-NNNN` at creation time. |
| IM-F04 | The system shall automatically record `reportedAt` and `updatedAt` ISO 8601 UTC timestamps at creation time. |
| IM-F05 | The system shall set the initial incident status to `"Reported"` automatically; the status field is not editable in the creation form. |
| IM-F06 | The system shall display all incidents in a list view with ID, title, type, priority, status, and reported date. |
| IM-F07 | The system shall allow searching incidents by title, description, or location (case-insensitive, real-time). |
| IM-F08 | The system shall allow filtering incidents by type, priority, and status with AND logic across active filters. |
| IM-F09 | The system shall allow sorting incidents by date reported, priority, and status. |
| IM-F10 | The system shall display complete incident details including description, notes, assigned resources, and all timestamps. |
| IM-F11 | The system shall allow a coordinator to advance an incident's status through the defined lifecycle: Reported → Active → In Progress → Resolved. |
| IM-F12 | The system shall prevent invalid status transitions — no skipping steps, no moving backwards, no transitions from Resolved. |
| IM-F13 | The system shall allow a coordinator to add or update free-text notes on any incident; an empty string is valid and clears the notes field. |
| IM-F14 | The system shall allow deletion of a `Resolved` incident after a confirmation step. |
| IM-F15 | The system shall not allow deletion of incidents with status `Reported`, `Active`, or `In Progress`. |
| IM-F16 | The system shall persist all incident data in LocalStorage under the key `resqgrid_incidents`. |
| IM-F17 | WHEN LocalStorage data is missing or corrupted, the system shall reset to an empty array and continue without crashing. |
| IM-F18 | WHEN a new incident has the same type and location as one reported within the last 5 minutes, the system shall show a non-blocking duplicate warning; the coordinator can still submit. |

### Resource Management (RM)

| ID | WHEN / THE SYSTEM SHALL |
|----|------------------------|
| RM-F01 | The system shall allow a coordinator to add a new resource by submitting a form with name, type, and location. |
| RM-F02 | The system shall automatically generate a unique resource ID in the format `RES-NNNN` at creation time. |
| RM-F03 | The system shall automatically record an `addedAt` ISO 8601 UTC timestamp at creation time. |
| RM-F04 | The system shall set the initial resource status to `"Available"` and `assignedTo` to `null` on creation. |
| RM-F05 | The system shall display all resources in a list view with ID, name, type, status, and location. |
| RM-F06 | The system shall allow searching resources by name and location (case-insensitive). |
| RM-F07 | The system shall allow filtering resources by type and status independently or in combination (AND logic). |
| RM-F08 | The system shall allow editing resource name, type, and location; resource names must be unique across all resources (case-insensitive). |
| RM-F09 | The system shall allow deletion of a resource that is not currently `Deployed`, after a confirmation step. |
| RM-F10 | The system shall prevent deletion of a `Deployed` resource. |
| RM-F11 | The system shall allow assigning an `Available` resource to an active (non-Resolved) incident. |
| RM-F12 | The system shall prevent assigning a `Deployed` or `Maintenance` resource to any incident. |
| RM-F13 | The system shall prevent assigning any resource to a `Resolved` incident. |
| RM-F14 | The system shall allow a coordinator to manually release a `Deployed` resource, returning it to `Available`. |
| RM-F15 | WHEN an incident is resolved, the system shall automatically release all resources assigned to it and set `assignedResources = []`. |
| RM-F16 | Assignment shall atomically update both the resource record (`status = "Deployed"`, `assignedTo = incidentId`) and the incident record (`assignedResources` array); if either write fails, neither change is persisted (best-effort rollback). |
| RM-F17 | The system shall allow setting a resource status to `Maintenance` manually (only from `Available`; `Deployed` resources must be released first). |
| RM-F18 | The system shall allow clearing `Maintenance` status, returning the resource to `Available`. |
| RM-F19 | The system shall persist all resource data in LocalStorage under the key `resqgrid_resources`. |
| RM-F20 | WHEN LocalStorage data is missing or corrupted, the system shall reset to an empty array and continue without crashing. |
| RM-F21 | WHEN the application starts, the system shall detect and repair any resource records whose `assignedTo` references a non-existent incident, resetting those resources to `Available`. |

### Decision-Support Assistant (DA)

| ID | WHEN / THE SYSTEM SHALL |
|----|------------------------|
| DA-F01 | The system shall provide a textarea (up to 1,000 characters) where the coordinator can describe an incident in plain language. |
| DA-F02 | The system shall analyze the description synchronously using a keyword rule engine; no external API calls are permitted. |
| DA-F03 | The system shall suggest an incident type based on matched keyword categories from `RULE_CATEGORIES`. |
| DA-F04 | The system shall suggest a priority level based on severity keywords; fallback to type-default priority when no severity keywords match. |
| DA-F05 | The system shall suggest a list of resource types based on the matched incident type using `RESOURCE_MAP`. |
| DA-F06 | The system shall produce a confidence level (`High` / `Medium` / `Low`) based on the total match score: 0 → Low (fallback), 1 → Low, 2–3 → Medium, ≥4 → High. |
| DA-F07 | The system shall produce a human-readable explanation listing the specific keywords that were matched. |
| DA-F08 | WHEN no keyword rules match (score = 0), the system shall return a documented fallback: type = `Other`, priority = `Medium`, resources = `[]`, confidence = `Low`, `isFallback = true`; never `null` or an exception. |
| DA-F09 | The system shall allow the coordinator to accept the suggestion as-is by clicking "Accept Suggestion". |
| DA-F10 | The system shall allow the coordinator to edit the suggested type, priority, and resource list inline before accepting. |
| DA-F11 | The system shall allow the coordinator to clear the analysis and reset the input. |
| DA-F12 | WHEN the coordinator accepts a suggestion, the system shall transfer `type`, `priority`, and the original `description` to the incident creation form. |
| DA-F13 | The system shall log every analysis result (including fallbacks) to LocalStorage under key `resqgrid_assistant_log`. |
| DA-F14 | Each log entry shall record whether the coordinator accepted (`accepted: true`) or dismissed (`accepted: false`) the suggestion. |
| DA-F15 | The assistant shall never block or gate the incident creation form; direct navigation to `#incidents` is always available. |

### Statistics Dashboard (SD)

| ID | WHEN / THE SYSTEM SHALL |
|----|------------------------|
| SD-F01 | The dashboard shall display 8 summary metric cards: Total Incidents, Active Incidents, Critical Incidents, Resolved Incidents, Available Resources, Deployed Resources, Resource Utilization Rate, and Average Resolution Time. |
| SD-F02 | The dashboard shall display a breakdown of incidents grouped by type (all 6 enum values always present, even at count 0). |
| SD-F03 | The dashboard shall display a breakdown of incidents grouped by priority (all 4 enum values always present). |
| SD-F04 | The dashboard shall display a breakdown of incidents grouped by status (all 4 enum values always present). |
| SD-F05 | The dashboard shall display a breakdown of resources grouped by type (all 7 enum values always present). |
| SD-F06 | The dashboard shall display a breakdown of resources grouped by status (all 3 enum values always present). |
| SD-F07 | All statistics shall be derived in real time from `resqgrid_incidents` and `resqgrid_resources`; the caller reads both arrays and passes them into `statsService.compute()`. |
| SD-F08 | No derived statistics shall be stored in LocalStorage — they are always computed on demand. |
| SD-F09 | The dashboard shall re-compute all metrics each time it is navigated to. |
| SD-F10 | The dashboard shall provide a "Refresh" button that re-reads LocalStorage and re-renders all sections. |
| SD-F11 | WHEN no incidents or resources exist, the dashboard shall display meaningful empty-state messages with action hints. |
| SD-F12 | WHEN LocalStorage data is corrupted, `statsService.compute()` receives an empty array and renders the empty state without crashing. |
| SD-F13 | All visualizations shall use HTML and CSS only — no external chart libraries. |
| SD-F14 | All visual indicators shall include accessible text labels and numeric values; color alone must not convey meaning. |

### Incident Service Validation (ISV — service-layer acceptance testing)

The following requirements document the testable behavior of `incidentService.js`
as verified by `test-incident-service.mjs`. They complement IM-F01–IM-F18 with
precise boundary conditions.

| ID | WHEN / THE SYSTEM SHALL |
|----|------------------------|
| ISV-F01 | `validateIncident` shall reject a title shorter than 5 characters. |
| ISV-F02 | `validateIncident` shall accept a title of exactly 5 characters. |
| ISV-F03 | `validateIncident` shall accept a title of exactly 100 characters. |
| ISV-F04 | `validateIncident` shall reject a title of 101 characters. |
| ISV-F05 | `validateIncident` shall reject a description shorter than 10 characters. |
| ISV-F06 | `validateIncident` shall accept a description of exactly 10 characters. |
| ISV-F07 | `validateIncident` shall accept a description of exactly 500 characters. |
| ISV-F08 | `validateIncident` shall reject a description of 501 characters. |
| ISV-F09 | `validateIncident` shall reject whitespace-only strings for title, description, location, and reportedBy. |
| ISV-F10 | `validateIncident` shall reject an invalid incident type enum value. |
| ISV-F11 | `validateIncident` shall reject an invalid priority enum value. |
| ISV-F12 | `validateIncident` shall return `valid: true` and no errors for fully valid input. |
| ISV-F13 | `createIncident` shall generate an ID matching the pattern `INC-\d{4}`. |
| ISV-F14 | `createIncident` shall set `status = "Reported"` on every new incident. |
| ISV-F15 | `createIncident` shall set `resolvedAt = null` on every new incident. |
| ISV-F16 | `createIncident` shall set `assignedResources = []` on every new incident. |
| ISV-F17 | `createIncident` shall set `reportedAt` and `updatedAt` to equal valid ISO 8601 timestamps at creation time. |
| ISV-F18 | `createIncident` shall return `{ success: false, errors }` for invalid input without writing to the store. |
| ISV-F19 | `updateIncidentStatus` shall permit only the sequential next step: Reported→Active, Active→In Progress, In Progress→Resolved. |
| ISV-F20 | `updateIncidentStatus` shall reject skipping a step (e.g., Reported→In Progress). |
| ISV-F21 | `updateIncidentStatus` shall reject moving backwards (e.g., Active→Reported). |
| ISV-F22 | `updateIncidentStatus` shall reject any transition from Resolved (terminal state). |
| ISV-F23 | `updateIncidentStatus` shall set `resolvedAt` to a valid ISO 8601 timestamp when transitioning to Resolved. |
| ISV-F24 | `updateIncidentStatus` shall update `updatedAt` on every successful transition. |
| ISV-F25 | `getNextStatus` shall return `null` for Resolved status. |
| ISV-F26 | `getNextStatus` shall return the correct next status for each non-terminal status. |
| ISV-F27 | `updateIncidentNotes` shall accept an empty string (clears notes). |
| ISV-F28 | `updateIncidentNotes` shall reject non-string values for the notes argument. |
| ISV-F29 | `updateIncidentNotes` shall return `{ success: false }` for an unknown incident ID. |
| ISV-F30 | `deleteIncident` shall succeed when status is Resolved. |
| ISV-F31 | `deleteIncident` shall reject deletion of Reported, Active, and In Progress incidents. |
| ISV-F32 | `deleteIncident` shall return `{ success: false }` for an unknown incident ID. |
| ISV-F33 | `checkDuplicate` shall return a non-null warning string when the same type and location appear within 5 minutes. |
| ISV-F34 | `checkDuplicate` shall return null when no duplicate exists (different type, different location, or no incidents). |
| ISV-F35 | `checkDuplicate` shall return null when the matching incident is older than 5 minutes. |
| ISV-F36 | `searchIncidents` shall return all incidents when the query is empty or whitespace-only. |
| ISV-F37 | `searchIncidents` shall match against title, description, and location fields (case-insensitive). |
| ISV-F38 | `searchIncidents` shall return an empty array when no incidents match the query. |
| ISV-F39 | `filterIncidents` shall apply AND logic across all provided filter fields. |
| ISV-F40 | `filterIncidents` shall skip a filter field when its value is null or undefined. |
| ISV-F41 | `sortIncidents` shall not mutate the input array; it shall return a new sorted array. |
| ISV-F42 | `sortIncidents` shall sort correctly by date, priority, and status with both asc and desc directions. |
| ISV-F43 | `getFilteredIncidents` shall apply search, filter, and sort as a combined pipeline. |
| ISV-F44 | `updateIncident` shall protect id, reportedAt, status, resolvedAt, and assignedResources from modification. |
| ISV-F45 | `updateIncident` shall re-run validation on the merged result before writing. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NF-01 | The application shall use only vanilla HTML, CSS, and JavaScript — no React, Vue, Angular, Bootstrap, Tailwind, or any external runtime dependency. |
| NF-02 | All JavaScript shall use ES modules (`<script type="module">`); no build step is required. |
| NF-03 | All data shall survive a full browser page refresh via LocalStorage persistence. |
| NF-04 | LocalStorage read/write shall go exclusively through `store.js` (`storeGet`/`storeSet`); UI components shall never call `localStorage` directly. |
| NF-05 | All services shall handle LocalStorage unavailability and quota errors gracefully, falling back to in-memory defaults. |
| NF-06 | All UI must be accessible: semantic HTML elements (`<nav>`, `<main>`, `<header>`, `<button>`), visible `:focus` styles, `aria-live` regions for dynamic updates, color paired with text labels, minimum 44×44 px touch targets. |
| NF-07 | No statistic shall display `NaN`, `Infinity`, `undefined`, `null`, or a broken visual — all formatted outputs must be valid strings. |
| NF-08 | The rule-based Decision-Support Assistant shall not call any external API; all analysis is local and synchronous. |
| NF-09 | The assistant shall be labeled "Decision-Support Assistant (Prototype)" and must clearly communicate it is not an AI or machine-learning system. |
| NF-10 | Test suites shall use plain Node.js `.mjs` modules with no external framework dependency; the preload shim (`test-globals-preload.cjs`) provides browser globals for Node.js. |
