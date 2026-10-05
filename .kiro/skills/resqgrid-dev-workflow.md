# ResQGrid Development Workflow Skill

## Purpose

This skill guides a Kiro session through the complete ResQGrid development workflow:
spec → implementation → tests → verification. Use it whenever adding a new feature
or changing existing service-layer code.

---

## When to Use This Skill

- Adding a new service function or modifying an existing one
- Writing or updating a spec in `.kiro/specs/`
- Debugging a test failure in any of the six test suites
- Verifying a complete feature implementation end-to-end

---

## Step-by-Step Workflow

### Step 1 — Inspect before changing

Before modifying any file:

```
1. Read the relevant spec in .kiro/specs/
2. Check .kiro/steering/data-models.md for the canonical data model
3. Check .kiro/steering/project-standards.md for naming and coding rules
4. Check .kiro/steering/testing-standards.md for test file conventions
5. Run git status to confirm the working tree is clean
```

### Step 2 — Write or update the spec

For any new feature, create a spec file under `.kiro/specs/` containing:

- Feature overview and problem statement
- Functional requirements with IDs (e.g. `XY-F01`)
- Acceptance criteria grouped by requirement
- Edge cases
- Testing requirements (test file name, run command)

For an existing spec, update the Implementation Status table after implementation.

### Step 3 — Implement

Follow these rules from `project-standards.md`:

- Vanilla JS only — no frameworks, no npm packages
- `const` by default; `let` only when reassignment is needed
- Arrow functions for callbacks; named `function` declarations for top-level exports
- Max ~30 lines per function
- All store access through `storeGet`/`storeSet` — never `localStorage` directly
- All user input validated in the service layer before any write

### Step 4 — Write tests

Create `test-<feature>.mjs` at the project root following `testing-standards.md`:

```js
// Run with:
// node --require ./test-globals-preload.cjs test-<feature>.mjs

import { ... } from './assets/js/services/<service>.js';

// Copy harness from any existing test suite (suite, test, assert, eq)
// reset() before each suite block
// Reference spec requirement IDs in test labels: (XY-F01)
```

### Step 5 — Run and verify

```bash
# New suite
node --require ./test-globals-preload.cjs test-<feature>.mjs

# Full regression check (all six suites)
node test-phase3.mjs
node --require ./test-globals-preload.cjs test-production-modules.mjs
node --require ./test-globals-preload.cjs test-phase4.mjs
node --require ./test-globals-preload.cjs test-phase5.mjs
node --require ./test-globals-preload.cjs test-incident-service.mjs
node --require ./test-globals-preload.cjs test-property-based.mjs
```

All suites must show `Failed: 0` before marking work complete.

### Step 6 — Update spec Implementation Status

In the spec file, tick off each acceptance criterion and fill the
"Implementation Status" table. Only mark items ✅ if the corresponding
test is passing.

---

## Quick Reference: Test Suite Commands

| Suite | Command |
|-------|---------|
| Resource service (inlined) | `node test-phase3.mjs` |
| Resource + incident integration | `node --require ./test-globals-preload.cjs test-production-modules.mjs` |
| Assistant service | `node --require ./test-globals-preload.cjs test-phase4.mjs` |
| Statistics service | `node --require ./test-globals-preload.cjs test-phase5.mjs` |
| Incident service (direct) | `node --require ./test-globals-preload.cjs test-incident-service.mjs` |
| Property-based invariants | `node --require ./test-globals-preload.cjs test-property-based.mjs` |

---

## Quick Reference: Data Model Rules

See `.kiro/steering/data-models.md` for the full model. Key rules:

- IDs are immutable once assigned
- Incident status must follow: Reported → Active → In Progress → Resolved
- Resolved is terminal — no further transitions
- Assignment sync: always update both `resource.assignedTo` AND `incident.assignedResources`
- Stats are never stored — always computed on demand

---

## Quick Reference: File Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Service files | camelCase | `incidentService.js` |
| Test files | kebab-case | `test-incident-service.mjs` |
| Spec files | kebab-case | `incident-service-validation.md` |
| CSS classes | kebab-case | `.incident-card` |
| LocalStorage keys | `resqgrid_` prefix | `resqgrid_incidents` |
