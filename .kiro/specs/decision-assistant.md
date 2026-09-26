# Decision-Support Assistant — Feature Specification

**Project:** ResQGrid — Smart Emergency Resource Coordinator
**Spec version:** 1.0
**Status:** Approved
**References:** #[[file:.kiro/steering/project-standards.md]] · #[[file:.kiro/steering/data-models.md]] · #[[file:.kiro/specs/incident-management.md]]

---

> ⚠️ **Prototype Notice**
> The Decision-Support Assistant is a rule-based keyword matching tool.
> It is **not** an AI, machine-learning model, or LLM.
> All suggestions are advisory only. The coordinator makes every final decision.
> This must be clearly communicated in the UI at all times.

---

## 1. Requirements

### Functional Requirements

| ID | Requirement |
|----|-------------|
| DA-F01 | The system shall provide a text input where the coordinator can describe an incident in natural language. |
| DA-F02 | The system shall analyze the description using a transparent, documented keyword rule engine. |
| DA-F03 | The system shall suggest an incident type based on matched keyword categories. |
| DA-F04 | The system shall suggest a priority level based on severity indicators in the description. |
| DA-F05 | The system shall suggest a list of required resource types based on the matched incident type and severity. |
| DA-F06 | The system shall produce a confidence level (High / Medium / Low) based on the number and quality of matched indicators. |
| DA-F07 | The system shall produce a short human-readable explanation listing the specific indicators detected. |
| DA-F08 | The system shall return a safe, documented fallback result when no meaningful indicators are detected. |
| DA-F09 | The system shall allow the coordinator to accept the suggestion as-is. |
| DA-F10 | The system shall allow the coordinator to edit any suggested field before accepting. |
| DA-F11 | The system shall allow the coordinator to clear the analysis and start over. |
| DA-F12 | On acceptance, the system shall transfer the (possibly edited) suggestion values into the incident creation form. |
| DA-F13 | The system shall log every analysis result to LocalStorage under key `resqgrid_assistant_log`. |
| DA-F14 | The system shall record whether the coordinator accepted or dismissed the suggestion. |
| DA-F15 | The assistant must never block or gate the incident creation form. |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| DA-N01 | The rule engine must be implemented as a standalone, testable module with no UI dependencies. |
| DA-N02 | All keyword rules must be defined in a single, well-commented configuration object — not scattered through logic. |
| DA-N03 | The assistant UI must display a permanent prototype disclaimer. |
| DA-N04 | No external API calls are permitted. All analysis runs locally in the browser. |
| DA-N05 | The feature must use no external libraries or frameworks. |
| DA-N06 | The assistant must meet the accessibility requirements defined in `project-standards.md`. |

---

## 2. User Stories

**US-01 — Analyze an incident description**
> As a coordinator, I want to type a plain-language description of what I am seeing and have the assistant suggest a type, priority, and resources, so that I can make faster and more consistent triage decisions.

**US-02 — Understand the reasoning**
> As a coordinator, I want to see which words or phrases triggered the suggestion, so that I can trust the result and verify it makes sense for the situation.

**US-03 — Edit a suggestion before accepting**
> As a coordinator, I want to change any suggested value before I accept it, so that I am never forced to use an incorrect classification.

**US-04 — Accept and transfer to the incident form**
> As a coordinator, I want to click "Accept" and have the suggestion values automatically fill in the incident form, so that I do not have to retype information.

**US-05 — Handle an unrecognized description**
> As a coordinator, I want the assistant to tell me clearly when it could not classify my description, rather than give me a confident but wrong suggestion, so that I know to classify the incident myself.

**US-06 — Review past assistant suggestions**
> As a coordinator, I want the assistant log to record what was suggested and whether I accepted it, so that there is a transparent audit trail of how the assistant was used.

---

## 3. Acceptance Criteria

### DA-F01 — Description Input
- [ ] A textarea labeled "Describe the incident" is displayed in the assistant panel.
- [ ] The textarea accepts plain text up to 1000 characters.
- [ ] A character counter displays remaining characters.
- [ ] The "Analyze" button is disabled when the textarea is empty or contains only whitespace.

### DA-F02 — Rule Engine Analysis
- [ ] Submitting a non-empty description invokes `assistantService.analyze(description)`.
- [ ] The rule engine normalizes the input before matching (lowercase, trim, collapse whitespace).
- [ ] Analysis completes synchronously — no loading spinner required (all processing is local).

### DA-F03–DA-F06 — Suggestion Output
- [ ] The result panel shows: suggested Type, suggested Priority, suggested Resource types, Confidence level, and Explanation.
- [ ] Each field is clearly labeled.
- [ ] Confidence is displayed as both a text label and a visual indicator (e.g., colored badge or simple bar).
- [ ] The explanation lists the specific keywords/phrases that were matched.
- [ ] If no indicators are matched, the explanation states: "No strong classification indicators were detected in the description. Please review and adjust the suggestion."

### DA-F08 — Fallback
- [ ] When no rules match, the result is: Type = `Other`, Priority = `Medium`, Resources = `[]`, Confidence = `Low`.
- [ ] The fallback result is visually distinct from a High-confidence result.

### DA-F09 & DA-F10 — Accept / Edit
- [ ] An "Accept Suggestion" button is shown when a result is displayed.
- [ ] Each suggested field (Type, Priority, Resources) has an inline edit control (select or checkbox list) that appears when the coordinator clicks "Edit".
- [ ] Editing does not re-run the analysis — it only modifies the displayed suggestion.
- [ ] An "Accept Edited Suggestion" button replaces "Accept Suggestion" when edits are made.
- [ ] Accepting records `accepted: true` in the log entry.

### DA-F11 — Clear / Reset
- [ ] A "Clear" button resets the textarea and hides the result panel.
- [ ] Clearing after a result records `accepted: false` in the log entry if not already accepted.

### DA-F12 — Transfer to Incident Form
- [ ] On acceptance, the `type`, `priority`, and `description` values are passed to the incident creation form.
- [ ] If the incident form is on a different route, the app navigates to it and pre-fills the values.
- [ ] Pre-filled fields are visually indicated (e.g., subtle highlight) so the coordinator knows they were auto-filled.
- [ ] The coordinator can still change any pre-filled value in the incident form.

### DA-F13 & DA-F14 — Logging
- [ ] Every `analyze()` call that produces a result creates a log entry in `resqgrid_assistant_log`.
- [ ] The log entry includes: `id`, `inputDescription`, `suggestedType`, `suggestedPriority`, `suggestedResources`, `confidence`, `matchedKeywords`, `accepted`, `timestamp`.
- [ ] `accepted` defaults to `false` and is updated to `true` only if the coordinator explicitly accepts.

### DA-F15 — Non-blocking
- [ ] The incident creation form is always reachable directly without passing through the assistant.
- [ ] Using or not using the assistant has no effect on the coordinator's ability to report an incident.

---

## 4. Rule Engine Design

The rule engine is implemented in `assets/js/services/assistantService.js` as a pure function module with no DOM dependencies.

### Architecture

```
Input description (string)
        │
        ▼
  normalize(input)          → lowercase, trim, collapse whitespace
        │
        ▼
  matchRules(normalized)    → iterate RULE_CATEGORIES, collect all matches
        │
        ▼
  scoreMatches(matches)     → count matches per category, select winner
        │
        ▼
  determinePriority(matches)→ check SEVERITY_KEYWORDS against normalized input
        │
        ▼
  buildResources(type)      → look up RESOURCE_MAP for winning type
        │
        ▼
  calculateConfidence(matches) → apply confidence rules (Section 6)
        │
        ▼
  buildExplanation(matches) → list matched keywords in plain language
        │
        ▼
  AssistantResult object
```

### AssistantResult shape

```js
{
  suggestedType: 'Fire',           // Incident Type enum value
  suggestedPriority: 'Critical',   // Incident Priority enum value
  suggestedResources: ['Fire Truck', 'Medical Team'],  // Resource Type enum values
  confidence: 'High',              // 'High' | 'Medium' | 'Low'
  matchedKeywords: ['smoke', 'laboratory'],
  explanation: 'Fire-related indicators detected: "smoke", location "laboratory".',
  isFallback: false                // true when no rules matched
}
```

### Rule Categories Configuration

All rules are defined in a single exported constant `RULE_CATEGORIES`. Each category maps to an incident type and contains a keyword list.

```js
const RULE_CATEGORIES = {
  Fire: {
    keywords: [
      'fire', 'smoke', 'flame', 'blaze', 'burning', 'burnt', 'arson',
      'explosion', 'explode', 'ignite', 'ignition', 'flammable',
      'combustion', 'ember', 'ash', 'firefighter', 'extinguisher'
    ],
    locationBoosts: ['kitchen', 'laboratory', 'lab', 'canteen', 'cafeteria',
                     'boiler', 'generator', 'storage', 'warehouse']
  },
  Medical: {
    keywords: [
      'injured', 'injury', 'hurt', 'wound', 'bleeding', 'blood',
      'unconscious', 'unresponsive', 'collapsed', 'collapse', 'seizure',
      'cardiac', 'heart attack', 'stroke', 'breathing', 'choking',
      'ambulance', 'medical', 'hospital', 'overdose', 'allergic',
      'broken', 'fracture', 'fainted', 'faint', 'dizzy', 'nausea',
      'pain', 'not responding', 'emergency medical'
    ],
    locationBoosts: ['cafeteria', 'gym', 'sports', 'field', 'parking',
                     'stairwell', 'corridor', 'restroom', 'bathroom']
  },
  Security: {
    keywords: [
      'threat', 'violence', 'violent', 'assault', 'attacked', 'attack',
      'weapon', 'gun', 'knife', 'fight', 'fighting', 'suspicious',
      'intruder', 'intrusion', 'trespassing', 'trespasser', 'robbery',
      'theft', 'stolen', 'vandalism', 'vandal', 'break-in', 'break in',
      'lockdown', 'evacuation', 'evacuate', 'disturbance', 'harassment',
      'security breach', 'unauthorized', 'unidentified person'
    ],
    locationBoosts: ['gate', 'entrance', 'exit', 'parking', 'perimeter',
                     'server room', 'admin', 'office', 'lobby']
  },
  Hazmat: {
    keywords: [
      'chemical', 'chemicals', 'spill', 'leak', 'leaking', 'gas',
      'toxic', 'toxin', 'fume', 'fumes', 'hazardous', 'hazmat',
      'contamination', 'contaminated', 'radiation', 'radioactive',
      'biohazard', 'biological', 'acid', 'solvent', 'reagent',
      'pipeline', 'cylinder', 'container', 'drum', 'vapour', 'vapor'
    ],
    locationBoosts: ['laboratory', 'lab', 'chemistry', 'biology',
                     'storage', 'warehouse', 'loading bay', 'dock']
  },
  'Natural Disaster': {
    keywords: [
      'flood', 'flooding', 'flooded', 'earthquake', 'tremor', 'quake',
      'hurricane', 'tornado', 'cyclone', 'storm', 'lightning', 'thunder',
      'landslide', 'mudslide', 'tsunami', 'wildfire', 'drought',
      'power outage', 'blackout', 'infrastructure', 'structural damage',
      'roof collapsed', 'ceiling collapsed', 'wall collapsed', 'dam'
    ],
    locationBoosts: ['campus', 'building', 'road', 'bridge', 'river',
                     'basement', 'ground floor']
  }
};
```

If no category matches, the result falls back to type `Other` (see Section 7).

---

## 5. Keyword Categories

### Severity Keywords (for priority determination)

Severity keywords are evaluated independently of type keywords. They modify the suggested priority.

```js
const SEVERITY_KEYWORDS = {
  Critical: [
    'critical', 'life-threatening', 'life threatening', 'not breathing',
    'no pulse', 'unresponsive', 'unconscious', 'not responding',
    'major explosion', 'large fire', 'mass casualty', 'multiple injured',
    'cardiac arrest', 'severe bleeding', 'structural collapse', 'imminent danger'
  ],
  High: [
    'serious', 'severe', 'significant', 'urgent', 'multiple', 'spreading',
    'out of control', 'escalating', 'large', 'major', 'armed',
    'collapsed', 'explosion', 'heavy smoke', 'fully involved', 'confirmed'
  ],
  Medium: [
    'moderate', 'possible', 'suspected', 'limited', 'contained',
    'minor injury', 'small', 'slow', 'reported', 'potential', 'single'
  ],
  Low: [
    'minor', 'small', 'superficial', 'no injury', 'no injuries',
    'under control', 'resolved', 'false alarm', 'precautionary', 'drill'
  ]
};
```

Priority determination logic:
1. Check for `Critical` severity keywords → return `Critical`
2. Else check for `High` severity keywords → return `High`
3. Else check for `Medium` severity keywords → return `Medium`
4. Else check for `Low` severity keywords → return `Low`
5. Else use the **type-default priority** from `TYPE_DEFAULT_PRIORITY`

```js
const TYPE_DEFAULT_PRIORITY = {
  Fire:               'High',
  Medical:            'High',
  Security:           'Medium',
  Hazmat:             'High',
  'Natural Disaster': 'High',
  Other:              'Medium'
};
```

### Resource Map

```js
const RESOURCE_MAP = {
  Fire:               ['Fire Truck', 'Medical Team'],
  Medical:            ['Ambulance', 'Medical Team'],
  Security:           ['Police Unit'],
  Hazmat:             ['Hazmat Team', 'Medical Team'],
  'Natural Disaster': ['Utility Crew', 'Medical Team', 'Ambulance'],
  Other:              []
};
```

Resource suggestions are a starting point only. Coordinators may add or remove resources in the assignment panel.

---

## 6. Confidence Calculation

Confidence is a transparent count-based score — not a statistical probability.

### Scoring rules

| Condition | Score |
|-----------|-------|
| Each matched type keyword | +1 point |
| Each matched location boost keyword | +1 point |
| Matched severity keyword (any level) | +1 point |
| Winning category has ≥ 2× the score of the second-highest category | +1 point (disambiguation bonus) |

### Confidence thresholds

| Total score | Confidence level |
|-------------|-----------------|
| 0 | Fallback (Low, type = Other) |
| 1 | Low |
| 2–3 | Medium |
| 4+ | High |

### Confidence label meanings (must be shown in UI)

- **High** — multiple strong indicators detected. Suggestion is likely accurate. Still verify before submitting.
- **Medium** — some indicators detected. Suggestion may be accurate but review carefully.
- **Low** — few or ambiguous indicators detected. Treat suggestion as a starting point only.

---

## 7. Fallback Behavior

A fallback result is returned when `totalScore === 0` (no keywords matched in any category).

```js
// Fallback result
{
  suggestedType: 'Other',
  suggestedPriority: 'Medium',
  suggestedResources: [],
  confidence: 'Low',
  matchedKeywords: [],
  explanation: 'No classification indicators were detected. '
             + 'Please review the suggestion and select the correct type and priority.',
  isFallback: true
}
```

Fallback rules:
- The result is always returned — the engine never throws an error or returns `null`.
- The fallback is visually distinct in the UI (e.g., amber/warning styling, prominent review prompt).
- The "Accept Suggestion" button label changes to "Accept & Review" for fallback results to signal that manual review is especially important.

---

## 8. UI Behavior

### Assistant Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│  ⚠ Decision-Support Assistant (Prototype)               │
│  This tool uses keyword matching — not AI. All          │
│  suggestions must be reviewed by the coordinator.        │
├─────────────────────────────────────────────────────────┤
│  Describe the incident:                                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  [textarea — up to 1000 chars]                    │  │
│  └───────────────────────────────────────────────────┘  │
│  [character count: 0 / 1000]                            │
│                                    [Analyze]  [Clear]   │
├─────────────────────────────────────────────────────────┤
│  SUGGESTION                    Confidence: [HIGH ●●●]   │
│                                                         │
│  Type:      Fire               [Edit ▾]                 │
│  Priority:  Critical           [Edit ▾]                 │
│  Resources: Fire Truck         [Edit ▾]                 │
│             Medical Team                                │
│                                                         │
│  📋 Why this suggestion:                                │
│  Fire-related indicators detected: "smoke",             │
│  location "laboratory".                                  │
│                                                         │
│           [Accept Suggestion]   [Dismiss]               │
└─────────────────────────────────────────────────────────┘
```

### Interaction states

| State | Description |
|-------|-------------|
| **Idle** | Textarea empty. Analyze button disabled. No result panel. |
| **Input** | Coordinator is typing. Character counter updates. Analyze button enabled once input is non-empty. |
| **Result — High/Medium** | Result panel shown with suggestion, explanation, confidence badge, Accept and Dismiss buttons. |
| **Result — Low / Fallback** | Result panel shown with amber/warning styling, prominent review prompt, "Accept & Review" button. |
| **Edit mode** | Inline select/checkbox controls visible for Type, Priority, Resources. Accept button label updates to "Accept Edited Suggestion". |
| **Accepted** | Result panel replaced with a confirmation: "Suggestion transferred to incident form." Link to incident form shown. |
| **Dismissed** | Result panel collapses. Textarea remains with current text. Coordinator can re-analyze or clear. |

### Confidence visual indicator

Display as a colored badge + dot-score (3 dots, filled based on level):
- High: green badge, 3 filled dots `●●●`
- Medium: amber badge, 2 filled dots `●●○`
- Low: red/grey badge, 1 filled dot `●○○`

### Editing suggestions

Each of the three suggestion fields (Type, Priority, Resources) has an "Edit" toggle:
- **Type**: renders a `<select>` pre-selected with the suggested value.
- **Priority**: renders a `<select>` pre-selected with the suggested value.
- **Resources**: renders a checklist of all Resource Type enum values, pre-checked with suggested values.

Editing one field does not affect others. Changes are local to the result panel and do not re-trigger analysis.

---

## 9. Incident Form Integration

When the coordinator accepts a suggestion (original or edited):

1. `assistantService.buildTransferPayload(result)` returns:
   ```js
   { type: 'Fire', priority: 'Critical', description: '<original input text>' }
   ```
2. The app navigates to `#incidents/new` (or opens the incident form panel).
3. The incident form receives the payload and pre-fills: `type`, `priority`, `description`.
4. Pre-filled fields are marked with a subtle highlight class (e.g., `.field--prefilled`) and an info tooltip: "Pre-filled by Decision-Support Assistant."
5. The coordinator can modify any pre-filled field before submitting.
6. `title`, `location`, and `reportedBy` are never pre-filled — these require explicit coordinator input.

The transfer is one-way and one-time. There is no live binding between the assistant and the form.

---

## 10. Validation Rules

| Input | Rule | Behaviour |
|-------|------|-----------|
| Description | Required for analysis. Non-empty after trim. Max 1000 characters. | "Analyze" button disabled when empty or whitespace-only. |
| Description | Min length for meaningful analysis: 10 characters. | If under 10 chars, show inline hint: "Please provide more detail for a better suggestion." Analysis still runs. |
| Edited Type | Must be one of the Incident Type enum values. | Enforced by `<select>` options — no free-text entry. |
| Edited Priority | Must be one of the Incident Priority enum values. | Enforced by `<select>` options. |
| Edited Resources | Each must be one of the Resource Type enum values. | Enforced by checklist options. |
| Log entry | Saved after every analysis. | If LocalStorage write fails, log silently (do not show error to user — logging is non-critical). |

---

## 11. Edge Cases

| Case | Handling |
|------|----------|
| Description with only stopwords (e.g., "the a it is") | No rules match → fallback result. |
| Description mentioning multiple incident types (e.g., "fire and chemical spill") | Category with highest score wins. Explanation lists indicators from both. |
| Tie between two categories | Use the category that appears first in `RULE_CATEGORIES` definition order as the tiebreaker. Document this in code. |
| Very short input (1–9 characters) | Analysis runs. Likely fallback. Show hint for more detail. |
| Very long input (close to 1000 characters) | Analysis runs on full text. Performance is not a concern for local string matching. |
| All-caps input ("FIRE IN BUILDING B") | Normalization lowercases before matching — matches correctly. |
| Input with punctuation ("fire!! help!!") | Normalization handles — punctuation does not prevent matches. |
| Coordinator analyzes, edits all fields, accepts | Log records the original suggestion, not the edited values. The `accepted` flag reflects the final action. |
| Coordinator analyzes multiple times without clearing | Each analysis overwrites the previous result panel. Each analysis creates a new log entry. |
| LocalStorage full when writing log | Catch `QuotaExceededError`. Silently skip the log write. Show no error (logging is non-critical). |
| Assistant panel opened with no incidents existing | No change — assistant does not depend on existing incidents. |

---

## 12. Accessibility Considerations

- The disclaimer banner must use `role="note"` or be placed in a `<section>` with an accessible heading.
- The textarea must have a visible `<label>`: "Describe the incident".
- The character counter must be linked to the textarea via `aria-describedby`.
- The "Analyze" button must reflect its disabled state via `disabled` attribute (not just visual styling).
- When the result panel appears, focus must move to the result heading or a visually prominent result element using `focus()` — do not silently update the DOM.
- The result panel must use `aria-live="polite"` so screen readers announce the new suggestion without interrupting the coordinator.
- The confidence indicator dots must have a text equivalent (`aria-label="Confidence: High"`) — do not rely on color alone.
- Edit controls (selects, checkboxes) must have associated `<label>` elements.
- The "Accept", "Dismiss", and "Clear" buttons must have descriptive `aria-label` attributes if the visual label alone is ambiguous.
- The pre-filled field highlight in the incident form must include a text indicator (tooltip or inline note), not just a color change.

---

## 13. Implementation Tasks

Tasks are ordered by dependency. Complete each group before starting the next.

### Group A — Rule Engine (no UI)

- [ ] **A1** — Create `assets/js/services/assistantService.js`.
- [ ] **A2** — Define and export `RULE_CATEGORIES` constant with all keyword arrays and location boosts.
- [ ] **A3** — Define and export `SEVERITY_KEYWORDS`, `TYPE_DEFAULT_PRIORITY`, and `RESOURCE_MAP` constants.
- [ ] **A4** — Implement `normalize(input)`: lowercase, trim, collapse whitespace, remove special characters that would prevent matching.
- [ ] **A5** — Implement `matchRules(normalized)`: iterate `RULE_CATEGORIES`, return array of `{ type, keyword, isLocationBoost }` match objects.
- [ ] **A6** — Implement `scoreMatches(matches)`: count score per category, identify winning type, calculate disambiguation bonus.
- [ ] **A7** — Implement `determinePriority(normalized, winningType)`: check `SEVERITY_KEYWORDS` in priority order, fall back to `TYPE_DEFAULT_PRIORITY`.
- [ ] **A8** — Implement `calculateConfidence(score)`: apply threshold table from Section 6.
- [ ] **A9** — Implement `buildExplanation(matches, isFallback)`: produce human-readable explanation string.
- [ ] **A10** — Implement `buildResources(type)`: look up `RESOURCE_MAP`, return array of resource type strings.
- [ ] **A11** — Implement top-level `analyze(description)`: orchestrate all steps, always return a valid `AssistantResult` object, never throw.
- [ ] **A12** — Implement `buildTransferPayload(result)`: return `{ type, priority, description }` for form pre-fill.
- [ ] **A13** — Manual browser-console tests: verify each rule category with representative inputs, verify fallback, verify severity overrides, verify disambiguation tiebreaker.

### Group B — Logging

- [ ] **B1** — Implement `logResult(result, inputDescription, accepted)` in `assistantService.js`: creates a log entry matching the `AssistantLog` model and writes to `resqgrid_assistant_log` via `store.js`.
- [ ] **B2** — Implement `getAllLogs()`: returns full log array from store.
- [ ] **B3** — Handle `QuotaExceededError` silently in `logResult`.

### Group C — Assistant Panel UI

- [ ] **C1** — Create `assets/js/ui/assistantPanel.js` that renders the full assistant panel into a target container.
- [ ] **C2** — Render the permanent prototype disclaimer banner.
- [ ] **C3** — Render description textarea with character counter linked via `aria-describedby`.
- [ ] **C4** — Implement Analyze button: disabled state when input empty/whitespace; calls `assistantService.analyze()` on click.
- [ ] **C5** — Implement Clear button: resets textarea, hides result panel, logs `accepted: false` if result was showing.
- [ ] **C6** — Render result panel with: Type, Priority, Resources, Confidence badge + dots, Explanation text.
- [ ] **C7** — Apply fallback styling (amber/warning) when `result.isFallback === true`.
- [ ] **C8** — Implement Edit toggles for Type, Priority, and Resources fields.
- [ ] **C9** — Implement Accept button: calls `assistantService.buildTransferPayload()`, logs `accepted: true`, triggers form pre-fill, shows confirmation message.
- [ ] **C10** — Implement Dismiss button: collapses result panel, logs `accepted: false`.
- [ ] **C11** — Move focus to result panel heading when result appears (accessibility).
- [ ] **C12** — Add `aria-live="polite"` to the result panel container.

### Group D — Incident Form Integration

- [ ] **D1** — Define a transfer event or shared state mechanism (e.g., a module-level `pendingPrefill` object in `app.js`) that the assistant panel sets on accept and the incident form reads on render.
- [ ] **D2** — Update `incidentForm.js` (from incident-management spec) to check for a pending prefill on render and apply `type`, `priority`, `description` values if present.
- [ ] **D3** — Add `.field--prefilled` CSS class and info tooltip to pre-filled fields.
- [ ] **D4** — Clear the pending prefill after the form has consumed it (one-time transfer).

### Group E — CSS Styling

- [ ] **E1** — Style the assistant panel container and disclaimer banner in `components.css`.
- [ ] **E2** — Style the result panel: normal state and fallback/warning state.
- [ ] **E3** — Style confidence badges and dot indicators (three variants: High/Medium/Low).
- [ ] **E4** — Style Edit toggle controls within the result panel.
- [ ] **E5** — Style the `.field--prefilled` highlight for incident form fields.
- [ ] **E6** — Add responsive layout for the assistant panel in `responsive.css`.

### Group F — Integration & Polish

- [ ] **F1** — Wire `assistantPanel` into the router/app shell at route `#assistant`.
- [ ] **F2** — Add navigation link to assistant in the main nav.
- [ ] **F3** — Verify the full flow end-to-end: enter description → analyze → edit suggestion → accept → incident form pre-filled → submit incident → log entry created.
- [ ] **F4** — Verify fallback flow: enter unrecognizable text → fallback result shown → accept & review → incident form opens with `Other` / `Medium`.
- [ ] **F5** — Accessibility pass: focus management, aria-live, disabled state, label associations, color-independent confidence indicator.
- [ ] **F6** — Verify the assistant does not interfere with direct incident creation (bypass path still works).
