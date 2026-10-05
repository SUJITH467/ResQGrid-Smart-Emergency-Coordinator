---
inclusion: always
---

# ResQGrid — Testing Standards

**Applies to:** All contributors and Kiro sessions working on ResQGrid.
**Steering priority:** Workspace-level — overrides global settings when conflicts exist.

---

## 1. Purpose

This document defines how testing is structured, written, and run for ResQGrid.
Every Kiro session that adds or modifies service-layer code must follow these
standards. The goal is a test suite that is fast, self-contained, and trustworthy.

---

## 2. Test Infrastructure

ResQGrid uses **plain Node.js test scripts** (`.mjs` ES modules). There is no
test framework dependency (no Jest, Vitest, Mocha). This matches the project
constraint of zero external runtime dependencies.

### Preload shim

Browser globals (`localStorage`, `structuredClone`) are provided by:

```
test-globals-preload.cjs
```

All test files that import production modules **must** use this preload:

```bash
node --require ./test-globals-preload.cjs <test-file>.mjs
```

Test files that inline their own store stubs (like `test-phase3.mjs`) may run
directly without the preload:

```bash
node <test-file>.mjs
```

### In-memory store reset

Every test suite must call `global._testStore.clear()` (or the inline `reset()`
helper) **before each logical suite block**, not just once at the start.
This prevents state leakage between suites.

---

## 3. Existing Test Suites

| File | Command | Coverage |
|------|---------|----------|
| `test-phase3.mjs` | `node test-phase3.mjs` | Resource service (inlined stubs) |
| `test-production-modules.mjs` | `node --require ./test-globals-preload.cjs test-production-modules.mjs` | Resource + incident (production modules) |
| `test-phase4.mjs` | `node --require ./test-globals-preload.cjs test-phase4.mjs` | Assistant service |
| `test-phase5.mjs` | `node --require ./test-globals-preload.cjs test-phase5.mjs` | Statistics service |
| `test-incident-service.mjs` | `node --require ./test-globals-preload.cjs test-incident-service.mjs` | Incident service (direct, all 45 requirements) |
| `test-property-based.mjs` | `node --require ./test-globals-preload.cjs test-property-based.mjs` | Property/invariant testing across all services |

**Baseline:** All suites must pass before any PR or commit to `master`.

Run all suites:

```bash
node test-phase3.mjs
node --require ./test-globals-preload.cjs test-production-modules.mjs
node --require ./test-globals-preload.cjs test-phase4.mjs
node --require ./test-globals-preload.cjs test-phase5.mjs
node --require ./test-globals-preload.cjs test-incident-service.mjs
node --require ./test-globals-preload.cjs test-property-based.mjs
```

---

## 4. Test File Conventions

### Naming

- Test files live at the **project root** (same level as `index.html`).
- Names follow the pattern `test-<subject>.mjs`.
- One concern per file. Do not combine unrelated services in one test file.

### Harness

Every test file must define these four helpers (copy from any existing suite):

```js
function suite(name) { ... }   // prints suite heading in cyan
function test(label, fn) { ... } // runs fn, catches errors, prints ✓ / ✗
function assert(cond, msg) { ... }
function eq(actual, expected, label) { ... }
```

Exit code must reflect failures:

```js
process.exit(failed > 0 ? 1 : 0);
```

### Structure

1. **Imports** — production modules only. Never import UI files in unit tests.
2. **Harness** — copy the four helpers verbatim.
3. **Reset** — `function reset() { global._testStore.clear(); }` at the top.
4. **Suites** — one `suite(...)` call per logical group, `reset()` before each.
5. **Cleanup** — `reset()` as the very last statement before the summary.
6. **Summary** — print `Passed / Failed / Total`, list failures, `process.exit`.

---

## 5. What to Test

### Always test

- **Validation boundaries** — exact min/max character counts, enum values,
  whitespace-only inputs, missing required fields.
- **ID generation** — format matches `PREFIX-NNNN`; no two IDs collide across
  a realistic number of records.
- **Initial field values** — status, timestamps, null fields, empty arrays on
  object creation.
- **Business rule enforcement** — status transitions, deletion guards,
  maintenance blocks, assignment constraints.
- **Store isolation** — a failed operation must not write partial data.
- **Search/filter/sort correctness** — AND logic, empty queries, null filters,
  non-mutation of input arrays.

### Property-based invariants (see `test-property-based.mjs`)

- No resource is simultaneously `Available` and has a non-null `assignedTo`.
- No resource is `Deployed` with `assignedTo === null`.
- Incident `assignedResources` and resource `assignedTo` are always in sync.
- Resolved incidents have `resolvedAt !== null`.
- Statistics counts are never negative and never exceed array lengths.
- `sortIncidents` / `sortResources` never mutate the input.

### Do not test

- DOM rendering, CSS, or UI layout (no browser in Node.js tests).
- LocalStorage availability failure (covered by `store.js` internals).
- External network calls (there are none).

---

## 6. Property-Based Testing

Property-based tests generate varied inputs automatically to check **invariants**
rather than specific input/output pairs. For ResQGrid, use the built-in generator
utilities in `test-property-based.mjs`.

When to write property-based tests:
- When a function must hold a structural guarantee across **all** valid inputs
  (e.g., ID uniqueness, non-negative counts, bi-directional assignment sync).
- When the space of valid inputs is large enough that hand-picked examples
  might miss important cases.

Keep generators simple and reproducible — seed random values from a fixed list
so failures are repeatable.

---

## 7. Spec Traceability

Every test suite that corresponds to a spec must reference requirement IDs in
the test label. Format:

```js
test('title boundary at exactly 5 chars accepted (ISV-F02)', () => { ... });
```

This creates a traceable chain:
```
spec requirement ID → test label → passing test → verified behaviour
```

---

## 8. Adding Tests for New Features

When implementing a new feature (or modifying an existing service):

1. **Write the spec first** under `.kiro/specs/`.
2. Write acceptance criteria with requirement IDs (e.g., `XY-F01`).
3. Create `test-<feature>.mjs` that maps each AC to at least one test.
4. Run the new suite; fix failures before marking the AC as verified.
5. Run **all** existing suites to confirm no regressions.
6. Update the Implementation Status table in the spec.

---

## 9. Test Output Interpretation

The test harness prints to stdout. Logger warnings print to stderr.
PowerShell may report a non-zero exit code when stderr is non-empty
even if all tests pass. **Always check the `Passed/Failed/Total` summary line**,
not just the exit code, when running on Windows PowerShell.

A passing run looks like:

```
Passed: 89  Failed: 0  Total: 89
✓ All 89 incidentService tests passed.
```

A failing run shows each failure with suite name, test label, and error message.
