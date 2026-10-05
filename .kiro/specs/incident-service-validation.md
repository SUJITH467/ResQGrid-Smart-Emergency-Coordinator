# Incident Service Validation — Feature Specification

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec version:** 1.0
**Status:** Implemented and Verified
**Author:** Kiro spec-driven workflow
**References:**
- #[[file:.kiro/steering/project-standards.md]]
- #[[file:.kiro/steering/data-models.md]]
- #[[file:.kiro/steering/testing-standards.md]]
- #[[file:.kiro/specs/incident-management.md]]

---

## Workflow

```
Requirement (gap in test coverage identified)
        ↓
Specification (this document — AC written before implementation)
        ↓
Implementation (test-incident-service.mjs written to match AC)
        ↓
Tests (node --require ./test-globals-preload.cjs test-incident-service.mjs)
        ↓
Verification (each AC ticked off against actual test output)
```

---

## 1. Problem Statement

`incidentService.js` exports 17 functions implementing the full incident lifecycle
(create, read, update, delete, search, filter, sort, validation, duplicate detection).
Despite being the core data layer of ResQGrid, **no direct unit tests exist** for
this module.

The three existing test suites (`test-phase3.mjs`, `test-production-modules.mjs`,
`test-phase5.mjs`) exercise `incidentService` only as a side-effect of resource
management tests. Key behaviour — boundary validation, status transition enforcement,
duplicate detection, search/filter/sort correctness — has **zero verified coverage**.

A regression in `validateIncident`, `updateIncidentStatus`, or `deleteIncident` could
silently break the application without any test catching it.

---

## 2. Goals

1. Establish direct, isolated unit tests for every exported function in `incidentService.js`.
2. Cover every boundary condition and edge case documented in `incident-management.md`.
3. Make the spec → implementation → verification chain explicit and verifiable.
4. Produce a passing test suite that runs as: `node --require ./test-globals-preload.cjs test-incident-service.mjs`
5. Serve as a regression guard for future changes to the incident data layer.

---

## 3. Scope

This spec covers **`incidentService.js` only** — no UI, no routing, no CSS.
It targets the production module via `test-globals-preload.cjs` (same pattern as
existing test suites).

Out of scope: UI rendering, LocalStorage corruption (covered by store.js),
resource assignment UI (covered by test-production-modules.mjs).

---

## 4. User Stories

**US-01 — Validated creation**
> As a coordinator, I want the system to reject invalid incident fields with specific
> per-field error messages, so that corrupt data never enters LocalStorage.

**US-02 — Boundary enforcement**
> As a coordinator, I want the title and description character limits enforced exactly
> (5/100 and 10/500), so that I know edge-case inputs are handled correctly.

**US-03 — Status lifecycle**
> As a coordinator, I want invalid status transitions rejected with an error,
> so that incidents cannot skip steps or move backwards.

**US-04 — Resolved is terminal**
> As a coordinator, I want the Resolved status to be a permanent terminal state,
> so that closed incidents are not accidentally re-opened.

**US-05 — Notes management**
> As a coordinator, I want to clear notes by saving an empty string, so that I can
> remove notes without deleting the incident.

**US-06 — Delete guard**
> As a coordinator, I want only Resolved incidents to be deletable, so that active
> incidents cannot be accidentally removed.

**US-07 — Duplicate warning**
> As a coordinator, I want a non-blocking warning when a similar incident was
> reported in the last 5 minutes, so that I can catch accidental double-submissions.

**US-08 — Search and filter pipeline**
> As a coordinator, I want search, filter, and sort to work correctly together and
> independently, including edge cases like empty queries and unknown sort keys.

---

## 5. Functional Requirements

| ID | Requirement |
|----|-------------|
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
| ISV-F12 | `validateIncident` shall return `valid: true` and no `errors` key for fully valid input. |
| ISV-F13 | `createIncident` shall generate an ID matching `INC-NNNN`. |
| ISV-F14 | `createIncident` shall set `status = "Reported"` on every new incident. |
| ISV-F15 | `createIncident` shall set `resolvedAt = null` on every new incident. |
| ISV-F16 | `createIncident` shall set `assignedResources = []` on every new incident. |
| ISV-F17 | `createIncident` shall set `reportedAt` and `updatedAt` to valid ISO 8601 timestamps. |
| ISV-F18 | `createIncident` shall return `{ success: false, errors }` for invalid input without writing to the store. |
| ISV-F19 | `updateIncidentStatus` shall permit only the next step in the lifecycle (Reported→Active→In Progress→Resolved). |
| ISV-F20 | `updateIncidentStatus` shall reject skipping a step (e.g., Reported→In Progress). |
| ISV-F21 | `updateIncidentStatus` shall reject moving backwards (e.g., Active→Reported). |
| ISV-F22 | `updateIncidentStatus` shall reject any transition from Resolved (terminal). |
| ISV-F23 | `updateIncidentStatus` shall set `resolvedAt` to a valid ISO timestamp when transitioning to Resolved. |
| ISV-F24 | `updateIncidentStatus` shall update `updatedAt` on every successful transition. |
| ISV-F25 | `getNextStatus` shall return null for Resolved status. |
| ISV-F26 | `getNextStatus` shall return the correct next status for each non-terminal status. |
| ISV-F27 | `updateIncidentNotes` shall accept an empty string (clears notes). |
| ISV-F28 | `updateIncidentNotes` shall reject non-string notes values. |
| ISV-F29 | `updateIncidentNotes` shall return `{ success: false }` for an unknown ID. |
| ISV-F30 | `deleteIncident` shall succeed when status is Resolved. |
| ISV-F31 | `deleteIncident` shall reject deletion of Reported, Active, and In Progress incidents. |
| ISV-F32 | `deleteIncident` shall return `{ success: false }` for an unknown ID. |
| ISV-F33 | `checkDuplicate` shall return a warning string when the same type+location appears within 5 minutes. |
| ISV-F34 | `checkDuplicate` shall return null when no duplicate exists. |
| ISV-F35 | `checkDuplicate` shall return null when the matching incident is older than 5 minutes. |
| ISV-F36 | `searchIncidents` shall return all incidents when the query is empty. |
| ISV-F37 | `searchIncidents` shall match title, description, and location (case-insensitive). |
| ISV-F38 | `searchIncidents` shall return an empty array when no incidents match. |
| ISV-F39 | `filterIncidents` shall apply AND logic across multiple active filters. |
| ISV-F40 | `filterIncidents` shall skip a filter field when its value is null or undefined. |
| ISV-F41 | `sortIncidents` shall not mutate the input array. |
| ISV-F42 | `sortIncidents` shall sort by date, priority, and status correctly. |
| ISV-F43 | `getFilteredIncidents` shall apply search + filter + sort as a combined pipeline. |
| ISV-F44 | `updateIncident` shall protect id, reportedAt, status, resolvedAt, and assignedResources from change. |
| ISV-F45 | `updateIncident` shall re-run validation on the merged result. |

---

## 6. Acceptance Criteria

### AC-01 — Validate title boundaries
- [ ] `validateIncident({ title: 'ABCD', ... })` → `valid: false`, `errors.title` present (4 chars)
- [ ] `validateIncident({ title: 'ABCDE', ... })` → `valid: true` (5 chars)
- [ ] `validateIncident({ title: 'A'.repeat(100), ... })` → `valid: true` (100 chars)
- [ ] `validateIncident({ title: 'A'.repeat(101), ... })` → `valid: false`, `errors.title` present (101 chars)

### AC-02 — Validate description boundaries
- [ ] 9-char description → `valid: false`, `errors.description` present
- [ ] 10-char description → `valid: true`
- [ ] 500-char description → `valid: true`
- [ ] 501-char description → `valid: false`, `errors.description` present

### AC-03 — Whitespace-only fields rejected
- [ ] Whitespace-only title, description, location, reportedBy each produce their respective errors

### AC-04 — createIncident initial field values
- [ ] `id` matches `/^INC-\d{4}$/`
- [ ] `status === "Reported"`
- [ ] `resolvedAt === null`
- [ ] `assignedResources` is `[]`
- [ ] `reportedAt` and `updatedAt` parse as valid dates
- [ ] `reportedAt === updatedAt` at creation

### AC-05 — Status transition enforcement
- [ ] Reported→Active succeeds
- [ ] Active→In Progress succeeds
- [ ] In Progress→Resolved succeeds and sets `resolvedAt`
- [ ] Reported→In Progress returns `{ success: false }`
- [ ] Reported→Resolved returns `{ success: false }`
- [ ] Active→Reported returns `{ success: false }`
- [ ] Resolved→Active returns `{ success: false }` (terminal)

### AC-06 — Notes update
- [ ] Empty string is accepted and saved
- [ ] Non-string (number) is rejected
- [ ] Unknown ID returns `{ success: false }`

### AC-07 — Delete guard
- [ ] Deleting a Resolved incident returns `{ success: true }`
- [ ] Deleting a Reported incident returns `{ success: false }`
- [ ] Deleting an Active incident returns `{ success: false }`
- [ ] Deleting an unknown ID returns `{ success: false }`
- [ ] After deletion, `getAllIncidents()` does not contain the deleted incident

### AC-08 — Duplicate detection
- [ ] Same type+location within 5 min returns warning string
- [ ] Different location → null
- [ ] Different type → null
- [ ] Same type+location but older than 5 min → null (simulated via timestamp manipulation)

### AC-09 — Search
- [ ] Empty query returns full array (same length)
- [ ] Query matching only title returns that incident
- [ ] Query matching only description returns that incident
- [ ] Query matching only location returns that incident
- [ ] Case-insensitive: "FIRE" matches "fire"
- [ ] No match → []

### AC-10 — Filter
- [ ] Single type filter returns only that type
- [ ] Combined type+status filter uses AND logic
- [ ] null filter value → not applied (all pass)

### AC-11 — Sort (non-mutating)
- [ ] Input array is not modified after sort
- [ ] date desc → newest first
- [ ] priority asc → Critical before High
- [ ] status asc → Reported before Active

### AC-12 — getFilteredIncidents pipeline
- [ ] Search + filter + sort all applied together
- [ ] Returns empty array when no incidents match combined criteria

### AC-13 — updateIncident protected fields
- [ ] Passing `id`, `reportedAt`, `status`, `resolvedAt`, `assignedResources` in updates has no effect

---

## 7. Edge Cases

| Case | Expected behaviour |
|------|--------------------|
| `createIncident` with valid fields but `notes` omitted | `notes: ""` (empty string default) |
| `createIncident` with `notes: "  "` (whitespace) | `notes: ""` (trimmed) |
| Two incidents created rapidly | Both get unique IDs (INC-0001, INC-0002) |
| `updateIncidentStatus` on nonexistent ID | `{ success: false, error: "…not found…" }` |
| `sortIncidents` with unknown `sortBy` | Returns stable copy (no crash) |
| `filterIncidents` with all null filter fields | Returns all incidents (no filter applied) |
| `checkDuplicate` with no incidents in store | Returns null (no crash) |
| `getFilteredIncidents` called with no options | Returns all incidents sorted by date desc |

---

## 8. Data/Behavior Constraints

- All functions must respect the canonical data model from `data-models.md`.
- No function may call `localStorage` directly — only via `storeGet`/`storeSet`.
- Validation runs inside `validateIncident` before any store write.
- Status transitions follow `NEXT_STATUS` map exactly; no skips, no reversals.
- `sortIncidents` must return a **new array** (non-mutating).
- `filterIncidents` and `searchIncidents` are **pure** — they receive an array and return a new one.
- `checkDuplicate` reads from the store but does not write.

---

## 9. Testing Requirements

| Requirement | Detail |
|-------------|--------|
| Test file | `test-incident-service.mjs` at project root |
| Run command | `node --require ./test-globals-preload.cjs test-incident-service.mjs` |
| Prerequisites | Node.js 18+; `test-globals-preload.cjs` already present |
| Dependencies | None — uses same in-file harness pattern as `test-phase3.mjs` |
| Coverage target | All 45 functional requirements (ISV-F01 to ISV-F45) |
| Expected result | All tests pass; `Failed: 0` |
| Regression guard | Must not break when run after `test-production-modules.mjs` |

---

## 10. Implementation Status

> This section is updated after the test suite is written and run.

| Requirement group | Implemented | Tests written | Tests passing |
|------------------|-------------|---------------|---------------|
| validateIncident boundaries (ISV-F01–F12) | ✅ | ✅ | ✅ |
| createIncident initial state (ISV-F13–F18) | ✅ | ✅ | ✅ |
| updateIncidentStatus transitions (ISV-F19–F24) | ✅ | ✅ | ✅ |
| getNextStatus (ISV-F25–F26) | ✅ | ✅ | ✅ |
| updateIncidentNotes (ISV-F27–F29) | ✅ | ✅ | ✅ |
| deleteIncident guard (ISV-F30–F32) | ✅ | ✅ | ✅ |
| checkDuplicate (ISV-F33–F35) | ✅ | ✅ | ✅ |
| searchIncidents (ISV-F36–F38) | ✅ | ✅ | ✅ |
| filterIncidents (ISV-F39–F40) | ✅ | ✅ | ✅ |
| sortIncidents (ISV-F41–F42) | ✅ | ✅ | ✅ |
| getFilteredIncidents pipeline (ISV-F43) | ✅ | ✅ | ✅ |
| updateIncident protected fields (ISV-F44–F45) | ✅ | ✅ | ✅ |

**Overall: All acceptance criteria verified. See test output in `test-incident-service.mjs`.**
