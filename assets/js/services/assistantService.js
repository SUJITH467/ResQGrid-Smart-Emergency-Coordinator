/**
 * assistantService.js
 * -------------------
 * Rule-based Decision-Support Assistant for ResQGrid.
 *
 * This module is a PURE function module — no DOM access, no UI dependencies.
 * All analysis runs locally and synchronously.
 *
 * IMPORTANT: This is NOT an AI, LLM, or machine-learning system.
 * It is a keyword matching engine. All suggestions are advisory only.
 *
 * Spec reference: .kiro/specs/decision-assistant.md
 * Data model:     .kiro/steering/data-models.md
 */

import { storeGet, storeSet, STORAGE_KEYS } from '../store.js';
import { logger, generateId, getNow }       from '../utils.js';

// ── Rule Categories ────────────────────────────────────────────────────────
// Single exported constant — all keyword rules live here.
// Each category maps to an incident type and contains:
//   keywords:       words that indicate this incident type
//   locationBoosts: location words that boost the score if also present

export const RULE_CATEGORIES = {
  Fire: {
    keywords: [
      'fire', 'smoke', 'flame', 'blaze', 'burning', 'burnt', 'arson',
      'explosion', 'explode', 'ignite', 'ignition', 'flammable',
      'combustion', 'ember', 'ash', 'firefighter', 'extinguisher',
    ],
    locationBoosts: [
      'kitchen', 'laboratory', 'lab', 'canteen', 'cafeteria',
      'boiler', 'generator', 'storage', 'warehouse',
    ],
  },
  Medical: {
    keywords: [
      'injured', 'injury', 'hurt', 'wound', 'bleeding', 'blood',
      'unconscious', 'unresponsive', 'collapsed', 'collapse', 'seizure',
      'cardiac', 'heart attack', 'stroke', 'breathing', 'choking',
      'ambulance', 'medical', 'hospital', 'overdose', 'allergic',
      'broken', 'fracture', 'fainted', 'faint', 'dizzy', 'nausea',
      'pain', 'not responding', 'emergency medical',
    ],
    locationBoosts: [
      'cafeteria', 'gym', 'sports', 'field', 'parking',
      'stairwell', 'corridor', 'restroom', 'bathroom',
    ],
  },
  Security: {
    keywords: [
      'threat', 'violence', 'violent', 'assault', 'attacked', 'attack',
      'weapon', 'gun', 'knife', 'fight', 'fighting', 'suspicious',
      'intruder', 'intrusion', 'trespassing', 'trespasser', 'robbery',
      'theft', 'stolen', 'vandalism', 'vandal', 'break-in', 'break in',
      'lockdown', 'evacuation', 'evacuate', 'disturbance', 'harassment',
      'security breach', 'unauthorized', 'unidentified person',
    ],
    locationBoosts: [
      'gate', 'entrance', 'exit', 'parking', 'perimeter',
      'server room', 'admin', 'office', 'lobby',
    ],
  },
  Hazmat: {
    keywords: [
      'chemical', 'chemicals', 'spill', 'leak', 'leaking', 'gas',
      'toxic', 'toxin', 'fume', 'fumes', 'hazardous', 'hazmat',
      'contamination', 'contaminated', 'radiation', 'radioactive',
      'biohazard', 'biological', 'acid', 'solvent', 'reagent',
      'pipeline', 'cylinder', 'container', 'drum', 'vapour', 'vapor',
    ],
    locationBoosts: [
      'laboratory', 'lab', 'chemistry', 'biology',
      'storage', 'warehouse', 'loading bay', 'dock',
    ],
  },
  'Natural Disaster': {
    keywords: [
      'flood', 'flooding', 'flooded', 'earthquake', 'tremor', 'quake',
      'hurricane', 'tornado', 'cyclone', 'storm', 'lightning', 'thunder',
      'landslide', 'mudslide', 'tsunami', 'wildfire', 'drought',
      'power outage', 'blackout', 'infrastructure', 'structural damage',
      'roof collapsed', 'ceiling collapsed', 'wall collapsed', 'dam',
    ],
    locationBoosts: [
      'campus', 'building', 'road', 'bridge', 'river',
      'basement', 'ground floor',
    ],
  },
};

// ── Severity Keywords ──────────────────────────────────────────────────────
// Checked independently of type keywords to determine priority.
// Priority order checked top-to-bottom; first match wins.

export const SEVERITY_KEYWORDS = {
  Critical: [
    'critical', 'life-threatening', 'life threatening', 'not breathing',
    'no pulse', 'unresponsive', 'unconscious', 'not responding',
    'major explosion', 'large fire', 'mass casualty', 'multiple injured',
    'cardiac arrest', 'severe bleeding', 'structural collapse', 'imminent danger',
  ],
  High: [
    'serious', 'severe', 'significant', 'urgent', 'multiple', 'spreading',
    'out of control', 'escalating', 'large', 'major', 'armed',
    'collapsed', 'explosion', 'heavy smoke', 'fully involved', 'confirmed',
  ],
  Medium: [
    'moderate', 'possible', 'suspected', 'limited', 'contained',
    'minor injury', 'small', 'slow', 'reported', 'potential', 'single',
  ],
  Low: [
    'minor', 'small', 'superficial', 'no injury', 'no injuries',
    'under control', 'resolved', 'false alarm', 'precautionary', 'drill',
  ],
};

// ── Type default priorities (when no severity keywords match) ──────────────
export const TYPE_DEFAULT_PRIORITY = {
  Fire:               'High',
  Medical:            'High',
  Security:           'Medium',
  Hazmat:             'High',
  'Natural Disaster': 'High',
  Other:              'Medium',
};

// ── Resource suggestions per type ─────────────────────────────────────────
export const RESOURCE_MAP = {
  Fire:               ['Fire Truck', 'Medical Team'],
  Medical:            ['Ambulance', 'Medical Team'],
  Security:           ['Police Unit'],
  Hazmat:             ['Hazmat Team', 'Medical Team'],
  'Natural Disaster': ['Utility Crew', 'Medical Team', 'Ambulance'],
  Other:              [],
};

// ── Fallback result ────────────────────────────────────────────────────────
const FALLBACK_RESULT = {
  suggestedType:      'Other',
  suggestedPriority:  'Medium',
  suggestedResources: [],
  confidence:         'Low',
  matchedKeywords:    [],
  explanation:
    'No classification indicators were detected. ' +
    'Please review the suggestion and select the correct type and priority.',
  isFallback: true,
};

// ── Step 1: Normalize ──────────────────────────────────────────────────────

/**
 * Normalize an input string for keyword matching.
 * Lowercases, trims, collapses whitespace.
 * Removes characters that would prevent multi-word phrase matching
 * but keeps spaces so phrases like "heart attack" still match.
 *
 * @param {string} input
 * @returns {string}
 */
export function normalize(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');      // collapse whitespace; keep single spaces
}

// ── Step 2: Match rules ────────────────────────────────────────────────────

/**
 * Iterate RULE_CATEGORIES and collect all keyword/location-boost matches.
 *
 * Returns an array of match objects:
 *   { type: string, keyword: string, isLocationBoost: boolean }
 *
 * @param {string} normalized - Already-normalized input
 * @returns {Array<{type: string, keyword: string, isLocationBoost: boolean}>}
 */
export function matchRules(normalized) {
  const matches = [];

  for (const [type, category] of Object.entries(RULE_CATEGORIES)) {
    // Regular keyword matches
    for (const keyword of category.keywords) {
      if (normalized.includes(keyword)) {
        matches.push({ type, keyword, isLocationBoost: false });
      }
    }
    // Location boost matches
    for (const boost of category.locationBoosts) {
      if (normalized.includes(boost)) {
        matches.push({ type, keyword: boost, isLocationBoost: true });
      }
    }
  }

  return matches;
}

// ── Step 3: Score matches ─────────────────────────────────────────────────

/**
 * Count the score per category and select the winning type.
 * Each match = +1 point. Disambiguation bonus: if winner ≥ 2× second-highest, +1.
 * Tiebreaker: the category that appears first in RULE_CATEGORIES definition order.
 *
 * @param {Array} matches - Output of matchRules()
 * @returns {{ winningType: string|null, scores: Object, totalScore: number, disambiguationBonus: boolean }}
 */
export function scoreMatches(matches) {
  // Count per category.
  const scores = {};
  for (const { type } of matches) {
    scores[type] = (scores[type] || 0) + 1;
  }

  if (Object.keys(scores).length === 0) {
    return { winningType: null, scores, totalScore: 0, disambiguationBonus: false };
  }

  // Sort by score descending, preserving RULE_CATEGORIES definition order for ties.
  const categoryOrder = Object.keys(RULE_CATEGORIES);
  const sorted = Object.entries(scores).sort(([typeA, scoreA], [typeB, scoreB]) => {
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Tiebreaker: earlier in RULE_CATEGORIES wins.
    return categoryOrder.indexOf(typeA) - categoryOrder.indexOf(typeB);
  });

  const [[winningType, winnerScore], second] = sorted;
  const secondScore = second ? second[1] : 0;

  // Disambiguation bonus: winner has ≥ 2× second-highest score.
  const disambiguationBonus = winnerScore >= 2 * secondScore && secondScore > 0;

  const totalScore = winnerScore + (disambiguationBonus ? 1 : 0);

  return { winningType, scores, totalScore, disambiguationBonus };
}

// ── Step 4: Determine priority ────────────────────────────────────────────

/**
 * Check SEVERITY_KEYWORDS in descending priority order.
 * Falls back to TYPE_DEFAULT_PRIORITY if no severity keyword matches.
 *
 * @param {string} normalized   - Already-normalized input
 * @param {string} winningType  - The winning incident type (may be null for fallback)
 * @returns {string} Priority level
 */
export function determinePriority(normalized, winningType) {
  const levels = ['Critical', 'High', 'Medium', 'Low'];
  for (const level of levels) {
    for (const keyword of SEVERITY_KEYWORDS[level]) {
      if (normalized.includes(keyword)) {
        return level;
      }
    }
  }
  return TYPE_DEFAULT_PRIORITY[winningType] ?? 'Medium';
}

// ── Step 5: Calculate confidence ─────────────────────────────────────────

/**
 * Map a total score to a confidence level.
 *
 * Spec section 6:
 *   0     → fallback (handled before this is called)
 *   1     → Low
 *   2–3   → Medium
 *   4+    → High
 *
 * @param {number} totalScore
 * @returns {'High'|'Medium'|'Low'}
 */
export function calculateConfidence(totalScore) {
  if (totalScore >= 4) return 'High';
  if (totalScore >= 2) return 'Medium';
  return 'Low';
}

// ── Step 6: Build explanation ─────────────────────────────────────────────

/**
 * Build a plain-English explanation of why this suggestion was made.
 *
 * @param {Array}  matches   - Output of matchRules()
 * @param {string} winType   - Winning type
 * @param {boolean} isFallback
 * @returns {string}
 */
export function buildExplanation(matches, winType, isFallback) {
  if (isFallback) {
    return (
      'No classification indicators were detected. ' +
      'Please review the suggestion and select the correct type and priority.'
    );
  }

  const typeMatches  = matches.filter((m) => !m.isLocationBoost && m.type === winType);
  const boostMatches = matches.filter((m) => m.isLocationBoost  && m.type === winType);
  // Also include matches from other categories (multi-type input)
  const otherMatches = matches.filter((m) => m.type !== winType);

  const parts = [];

  if (typeMatches.length > 0) {
    const kws = typeMatches.map((m) => `"${m.keyword}"`).join(', ');
    parts.push(`${winType}-related indicators detected: ${kws}`);
  }

  if (boostMatches.length > 0) {
    const locs = boostMatches.map((m) => `"${m.keyword}"`).join(', ');
    parts.push(`location boost from: ${locs}`);
  }

  if (otherMatches.length > 0) {
    const otherKws = otherMatches.map((m) => `"${m.keyword}" (${m.type})`).join(', ');
    parts.push(`additional indicators: ${otherKws}`);
  }

  return parts.join('. ') + '.';
}

// ── Step 7: Build resource suggestions ───────────────────────────────────

/**
 * Return resource type suggestions for a winning incident type.
 *
 * @param {string} type
 * @returns {string[]}
 */
export function buildResources(type) {
  return RESOURCE_MAP[type] ?? [];
}

// ── Top-level analyze() ────────────────────────────────────────────────────

/**
 * Analyze a natural-language description and return a classification suggestion.
 *
 * This function NEVER throws. It always returns a valid AssistantResult.
 *
 * @param {string} description - Raw user input
 * @returns {AssistantResult}
 */
export function analyze(description) {
  try {
    const normalized = normalize(description);

    // Match rules against normalized text.
    const matches = matchRules(normalized);

    // Score and find winner.
    const { winningType, scores, totalScore, disambiguationBonus } = scoreMatches(matches);

    // No matches at all → fallback.
    if (!winningType || totalScore === 0) {
      return { ...FALLBACK_RESULT };
    }

    // Also count severity keyword as +1 toward confidence score.
    const severityPriority = determinePriority(normalized, winningType);
    const hasSeverityMatch  = Object.values(SEVERITY_KEYWORDS).flat().some(
      (kw) => normalized.includes(kw)
    );

    const adjustedScore = totalScore + (hasSeverityMatch ? 1 : 0);
    const confidence    = calculateConfidence(adjustedScore);
    const resources     = buildResources(winningType);
    const explanation   = buildExplanation(matches, winningType, false);

    // Collect all matched keywords for the log.
    const matchedKeywords = [...new Set(matches.map((m) => m.keyword))];

    return {
      suggestedType:      winningType,
      suggestedPriority:  severityPriority,
      suggestedResources: resources,
      confidence,
      matchedKeywords,
      explanation,
      isFallback:         false,
    };
  } catch (err) {
    // Safety net — never crash the UI.
    logger.error('assistantService.analyze: Unexpected error.', err);
    return { ...FALLBACK_RESULT };
  }
}

// ── Transfer payload ───────────────────────────────────────────────────────

/**
 * Build the payload that gets transferred to the incident form on acceptance.
 *
 * @param {AssistantResult} result
 * @param {string}          originalDescription - The raw text the coordinator typed
 * @returns {{ type: string, priority: string, description: string }}
 */
export function buildTransferPayload(result, originalDescription) {
  return {
    type:        result.suggestedType,
    priority:    result.suggestedPriority,
    description: originalDescription || '',
  };
}

// ── Logging ────────────────────────────────────────────────────────────────

/**
 * Write a log entry for one analysis result.
 * Silently ignores QuotaExceededError — logging is non-critical.
 *
 * @param {AssistantResult} result
 * @param {string}          inputDescription
 * @param {boolean}         accepted
 */
export function logResult(result, inputDescription, accepted) {
  try {
    const logs = storeGet(STORAGE_KEYS.ASSISTANT_LOG);

    const entry = {
      id:               generateId('LOG', logs),
      inputDescription: inputDescription || '',
      suggestedType:    result.suggestedType,
      suggestedPriority:result.suggestedPriority,
      suggestedResources: result.suggestedResources,
      confidence:       result.confidence,
      matchedKeywords:  result.matchedKeywords,
      accepted:         Boolean(accepted),
      timestamp:        getNow(),
    };

    logs.push(entry);
    storeSet(STORAGE_KEYS.ASSISTANT_LOG, logs);
  } catch (err) {
    // Silently skip on QuotaExceededError or other storage issues.
    logger.warn('assistantService.logResult: Could not write log entry.', err.message);
  }
}

/**
 * Return all stored assistant log entries.
 *
 * @returns {Array<Object>}
 */
export function getAllLogs() {
  return storeGet(STORAGE_KEYS.ASSISTANT_LOG);
}
