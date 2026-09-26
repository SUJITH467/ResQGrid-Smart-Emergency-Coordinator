# ResQGrid — Project Standards

## Purpose & Scope

ResQGrid is an **educational prototype** for campus/community emergency coordination.
It is not a real emergency-response system and must never be presented as one.
Every page or panel that deals with emergency data must include a visible disclaimer:
> "This is an educational prototype. Do not use in real emergencies."

---

## Technology Constraints

- **HTML, CSS, and vanilla JavaScript only.** No React, Vue, Angular, or any JS framework.
- **No Bootstrap, Tailwind, or any external CSS framework.**
- **No external runtime dependencies.** All code must run directly in the browser without a build step or package manager.
- Use `<script type="module">` for all JavaScript files (ES modules).
- Use native browser APIs: `fetch` (if needed), `localStorage`, `CustomEvent`, `URLSearchParams`.
- SVG icons may be inlined or referenced as local files. No icon font CDN imports.

---

## Code Style & Modularity

- Keep each file focused on a single responsibility (one service, one UI component, one utility).
- Files should be **beginner-friendly**: clear variable names, short functions, inline comments where logic is non-obvious.
- Maximum function length: ~30 lines. Extract helpers if a function grows longer.
- No minification or obfuscation. Code is meant to be read and learned from.
- Use `const` by default; use `let` only when reassignment is needed. Never use `var`.
- Use arrow functions for callbacks and short utilities. Use named `function` declarations for top-level module functions.
- Always use strict equality (`===`, `!==`).
- No `console.log` left in production paths. Use a small `logger` utility that can be toggled off.

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| JS files | camelCase | `incidentService.js` |
| JS functions | camelCase | `createIncident()` |
| JS constants | UPPER_SNAKE_CASE | `MAX_DESCRIPTION_LENGTH` |
| CSS classes | kebab-case | `.incident-card` |
| CSS variables | `--resq-` prefix + kebab-case | `--resq-color-critical` |
| LocalStorage keys | `resqgrid_` prefix + snake_case | `resqgrid_incidents` |
| Incident IDs | `INC-` + zero-padded 4-digit number | `INC-0001` |
| Resource IDs | `RES-` + zero-padded 4-digit number | `RES-0042` |
| HTML IDs | kebab-case | `incident-form` |
| HTML data attributes | `data-` + kebab-case | `data-incident-id` |

---

## CSS Conventions

- Define all design tokens as CSS custom properties in `:root` inside `main.css`.
- Required token groups: `--resq-color-*`, `--resq-font-*`, `--resq-space-*`, `--resq-radius-*`, `--resq-shadow-*`.
- Priority and status levels must each have a dedicated color token:
  - `--resq-color-critical`, `--resq-color-high`, `--resq-color-medium`, `--resq-color-low`
  - `--resq-color-status-reported`, `--resq-color-status-active`, `--resq-color-status-inprogress`, `--resq-color-status-resolved`
- Use CSS Grid and Flexbox for layout. No float-based layouts.
- Mobile-first responsive design. Breakpoints: 480px, 768px, 1024px, 1280px.
- All interactive elements must have a visible `:focus` style.
- Do not use `!important` except to override third-party styles (none expected here).
- Separate stylesheets: `main.css` (tokens + reset + layout), `components.css` (reusable UI pieces), `responsive.css` (media queries).

---

## Accessibility Requirements

- All form inputs must have associated `<label>` elements (not placeholder-only).
- Use semantic HTML: `<nav>`, `<main>`, `<section>`, `<article>`, `<header>`, `<footer>`, `<button>`, `<table>`.
- Buttons must never be `<div>` or `<span>` elements.
- Color alone must not convey meaning — always pair color with a text label or icon + label.
- Priority badges must include a text label, not just a color swatch.
- Dynamic content updates (e.g., new incident added to list) must use `aria-live` regions where appropriate.
- Minimum touch target size: 44×44px.
- Tab order must follow visual reading order.

---

## LocalStorage Conventions

| Key | Content |
|-----|---------|
| `resqgrid_incidents` | JSON array of Incident objects |
| `resqgrid_resources` | JSON array of Resource objects |
| `resqgrid_assistant_log` | JSON array of AssistantLog objects |
| `resqgrid_settings` | JSON object for UI preferences |

- Always wrap `localStorage.getItem` / `JSON.parse` in try/catch.
- If parsed data fails basic schema validation (not an array, missing required fields), **discard and reset to an empty default** — never crash.
- Never store sensitive personal data. Location fields are building/room names only.
- Write helpers `store.get(key)` and `store.set(key, value)` used by all services — never call `localStorage` directly from UI components.

---

## Error Handling

- Every service function that reads or writes LocalStorage must handle parse/stringify errors gracefully.
- Form submissions must validate all required fields before calling any service function.
- Show user-facing error messages inline (near the field), not as `alert()` dialogs.
- Show user-facing success/confirmation messages as non-blocking toast notifications.
- If an operation cannot complete (e.g., no available resources), display a clear, actionable message — never a silent failure.

---

## Validation Requirements

| Field | Rule |
|-------|------|
| Incident title | Required. 5–100 characters. |
| Incident description | Required. 10–500 characters. |
| Incident location | Required. Non-empty string. |
| Incident type | Required. Must match allowed enum. |
| Incident priority | Required. Must match allowed enum. |
| Resource name | Required. Non-empty. Must be unique across all resources. |
| Resource type | Required. Must match allowed enum. |
| Resource location | Required. Non-empty string. |

- Validate on form submit. Show field-level error messages.
- Re-validate on input change to clear stale errors as the user corrects them.

---

## Decision-Support Assistant Rules

- The assistant is **rule-based keyword matching**. It is not an AI or machine learning model.
- It must be labeled in the UI as: **"Decision-Support Assistant (Prototype)"**
- Every suggestion must include a visible note: *"This suggestion is generated by a rule-based prototype and must be reviewed by a qualified coordinator."*
- Confidence levels (High / Medium / Low) reflect how many keyword rules matched — not a probability score from a model.
- The assistant must never block form submission. It is advisory only.
- Do not use terms like "AI-powered", "intelligent", "neural", or "smart" in UI copy for the assistant.

---

## What Not to Build

- No user authentication or login system (out of scope for this prototype).
- No real-time multi-user sync.
- No backend or API calls to external services.
- No maps or geolocation (location is a free-text field only).
- No push notifications.
- No file uploads.
