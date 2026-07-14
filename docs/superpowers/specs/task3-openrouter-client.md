# Task 3 Spec — OpenRouter Client + Prompts

> **Read first:** `docs/superpowers/specs/00-project-context.md`

---

## Scope

Create two files:
- `lib/openrouter.js` — HTTP client for OpenRouter API with JSON extraction and normalization utilities
- `lib/prompts.js` — All LLM prompt templates and a fill helper

These two files are imported by every backend route. Nothing else needs to change.

---

## File 1: `lib/openrouter.js`

Create this file at exactly `/Volumes/extdisk/WORK/RND2026/RND1/lib/openrouter.js`.

### Complete code

```javascript
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Send a text-only chat request to OpenRouter.
 * @param {Array<{role: string, content: string|Array}>} messages
 * @param {string} model  e.g. "google/gemini-2.5-flash"
 * @param {string} apiKey OpenRouter API key
 * @returns {Promise<string>} Raw model response text
 */
export async function callText(messages, model, apiKey) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Policy Semantic Audit',
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Send a vision request (image + text) to OpenRouter.
 * @param {string} imageBase64  Base64-encoded image bytes (no data: prefix)
 * @param {string} mimeType     e.g. "image/jpeg", "image/png", "application/pdf"
 * @param {string} textPrompt   Text instruction
 * @param {string} model        Must be a vision-capable model
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function callVision(imageBase64, mimeType, textPrompt, model, apiKey) {
  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: 'text', text: textPrompt },
    ],
  }];
  return callText(messages, model, apiKey);
}

/**
 * Extract a JSON object from a model response string.
 * Handles three common failure modes:
 *   1. Response is already valid JSON → parse directly
 *   2. Response wrapped in ```json ... ``` markdown fences → strip fences, parse
 *   3. JSON embedded inside prose → extract first {...} block
 * Also unwraps single-key wrapper objects: { "response": {...} } → {...}
 *
 * @param {string} text  Raw model response
 * @returns {object}
 * @throws {Error} if no JSON can be extracted
 */
export function extractJson(text) {
  // Stage 1: direct parse
  try {
    const obj = JSON.parse(text.trim());
    return unwrapSingleKey(obj);
  } catch (_) {}

  // Stage 2: strip markdown fences
  const stripped = text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '');
  try {
    const obj = JSON.parse(stripped.trim());
    return unwrapSingleKey(obj);
  } catch (_) {}

  // Stage 3: extract first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      return unwrapSingleKey(obj);
    } catch (e) {
      throw new Error(`JSON parse failed: ${e.message}\nRaw (first 300): ${text.slice(0, 300)}`);
    }
  }

  throw new Error(`No JSON found in response (first 200): ${text.slice(0, 200)}`);
}

/** Unwrap { "key": {...} } → {...} when there is exactly one key and its value is an object. */
function unwrapSingleKey(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === 'object' && obj[keys[0]] !== null) {
    return obj[keys[0]];
  }
  return obj;
}

/**
 * Normalize a raw amount value to a float.
 * Handles European decimal format: "1.249,00" → 1249.00
 * Handles currency symbols: "€ 649.99" → 649.99
 *
 * @param {string|number|null} raw
 * @returns {number|null}
 */
export function normalizeAmount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/[€$£¥₽\s]/g, '');
  if (!s) return null;
  // European format: 1.249,00 (period = thousands separator, comma = decimal)
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Standard format with comma as decimal: 649,99
  return parseFloat(s.replace(',', '.'));
}

/**
 * Normalize model verdict strings to canonical three-class schema.
 * Models frequently return synonyms: "approved", "compliant", "ambiguous", etc.
 *
 * @param {string|null} raw
 * @returns {'justified'|'suspicious'|'unclear'|null}  null means unrecognized (exclude from metrics)
 */
export function normalizeVerdict(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (['justified', 'suspicious', 'unclear'].includes(lower)) return lower;
  const SYNONYMS = {
    approved: 'justified',
    compliant: 'justified',
    allowed: 'justified',
    valid: 'justified',
    'not justified': 'suspicious',
    questionable: 'suspicious',
    inappropriate: 'suspicious',
    prohibited: 'suspicious',
    denied: 'suspicious',
    rejected: 'suspicious',
    ambiguous: 'unclear',
    uncertain: 'unclear',
    'cannot determine': 'unclear',
    inconclusive: 'unclear',
    unknown: 'unclear',
  };
  return SYNONYMS[lower] ?? null;
}
```

### Verify

```bash
node -e "
import('./lib/openrouter.js').then(({ extractJson, normalizeAmount, normalizeVerdict }) => {
  // Test 3-stage extraction
  console.assert(extractJson('{\"a\":1}').a === 1, 'direct parse');
  console.assert(extractJson('\`\`\`json\n{\"a\":2}\n\`\`\`').a === 2, 'fence stripping');
  console.assert(extractJson('Here is the result: {\"a\":3}').a === 3, 'embedded JSON');
  console.assert(extractJson('{\"response\":{\"verdict\":\"ok\"}}').verdict === 'ok', 'single-key unwrap');

  // Test normalizeAmount
  console.assert(normalizeAmount('1.249,00') === 1249, 'European format');
  console.assert(normalizeAmount('€ 649.99') === 649.99, 'currency symbol');
  console.assert(normalizeAmount(45.5) === 45.5, 'passthrough number');
  console.assert(normalizeAmount(null) === null, 'null passthrough');

  // Test normalizeVerdict
  console.assert(normalizeVerdict('approved') === 'justified', 'synonym map');
  console.assert(normalizeVerdict('JUSTIFIED') === 'justified', 'case insensitive');
  console.assert(normalizeVerdict('depends on context') === null, 'unknown → null');

  console.log('All assertions passed');
});
"
```

Expected output: `All assertions passed`

---

## File 2: `lib/prompts.js`

Create this file at exactly `/Volumes/extdisk/WORK/RND2026/RND1/lib/prompts.js`.

### Complete code

```javascript
/**
 * All LLM prompt templates.
 * Use fillPrompt(template, vars) to substitute {placeholders}.
 *
 * Placeholders used in verdict prompts:
 *   {policy_text}  — output of policyAsText(policy, phaseIndex)
 *   {vendor}       — string or "unknown"
 *   {date}         — ISO date string or "unknown"
 *   {amount}       — number or "unknown"
 *   {currency}     — ISO 4217 code or "unknown"
 *   {category}     — one of the category enum values
 *   {line_items}   — comma-separated string of items
 */
export const PROMPTS = {

  /**
   * E1: Receipt field extraction.
   * Designed to minimize hallucination on unreadable fields (null-compliant instruction)
   * and maximize category accuracy on non-English receipts (explicit taxonomy with anchors).
   */
  extraction: `You are a receipt data extraction system.

Extract the following fields from this receipt image.
Return ONLY a valid JSON object with NO markdown fences, NO explanation, NO extra text.

{
  "vendor": "merchant or supplier name as written on receipt, or null if illegible",
  "date": "transaction date in YYYY-MM-DD format, or null if not visible",
  "amount": total amount paid as a number (float), or null if not visible,
  "currency": "ISO 4217 code (EUR, USD, RUB, etc.), or null if not visible",
  "line_items": ["summary of item 1", "summary of item 2"],
  "category": "ONE of: equipment, software, travel, meals, services, supplies, other"
}

Category definitions — use EXACTLY one of these values:
- equipment: physical hardware, devices, monitors, peripherals, cables, printers
- software: software licenses, SaaS subscriptions, API credits, cloud compute, hosting
- travel: transport tickets, taxi, hotel, accommodation, fuel
- meals: restaurants, cafés, catering, food delivery
- services: professional consulting, design, legal, accounting, printing services
- supplies: stationery, office materials, cleaning supplies
- other: anything that does not clearly fit the above

IMPORTANT: For each field, return the value ONLY if you can read it directly and unambiguously
from the image. If a field is not visible, illegible, or requires inference, YOU MUST return null.
A null value is always correct for unreadable fields. Never guess or estimate.`,

  /**
   * E2: Verdict without chain-of-thought.
   * Direct classification: policy + fields → verdict.
   */
  verdictNoCot: `You are a financial expense auditor.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

Is this expense justified under the project policy for this phase?

Return ONLY a valid JSON object with NO markdown fences:
{"verdict": "justified or suspicious or unclear", "reason": "one sentence explaining your verdict"}

verdict must be exactly one of: justified, suspicious, unclear`,

  /**
   * E3: Verdict with 4-step chain-of-thought.
   * Step 2 requires explicit policy quotation to prevent circular reasoning.
   */
  verdictCot: `You are a financial expense auditor. Think step by step before giving a verdict.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

Reason through these steps:
1. Identify the type of expense: what was purchased, from whom, and for what apparent purpose.
2. Check the POLICY TEXT above. Quote the specific clause that applies to this expense category.
   If no clause directly addresses this category, say so explicitly.
   Determine: allowed as-is / allowed with conditions / restricted / forbidden.
3. Assess whether the amount is reasonable for this type of expense in a professional R&D context.
4. Flag any ambiguities: cases where the policy is unclear, the receipt is incomplete,
   or the expense could reasonably be interpreted multiple ways.

After completing these steps, return ONLY a valid JSON object with NO markdown fences:
{
  "reasoning": "your full step-by-step analysis following steps 1-4",
  "verdict": "justified or suspicious or unclear",
  "reason": "one sentence summary of the verdict"
}

verdict must be exactly one of: justified, suspicious, unclear`,

  /**
   * E5: Verdict with 5-step CoT, adding information sufficiency check.
   * The 5th step forces the model to consider whether the receipt alone contains
   * enough information to determine justification — triggering "unclear" on
   * genuinely ambiguous receipts (e.g., a restaurant receipt with no context).
   */
  verdictCotE5: `You are a financial expense auditor. Think step by step before giving a verdict.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

Reason through these steps:
1. Identify the type of expense: what was purchased, from whom, and for what apparent purpose.
2. Check the POLICY TEXT above. Quote the specific clause that applies to this expense category.
   Determine: allowed as-is / allowed with conditions / restricted / forbidden.
3. Assess whether the amount is reasonable for this type of expense in a professional R&D context.
4. Flag any policy ambiguities: cases where the policy text itself is unclear or incomplete.
5. Assess information sufficiency: Does the receipt alone provide enough information to
   determine whether this expense is justified? If the verdict depends on context NOT visible
   in the receipt (who attended, what was discussed, whether prior approval was obtained,
   the business purpose of the trip), return "unclear" and explicitly state what additional
   information is required to make a determination.

After completing these steps, return ONLY a valid JSON object with NO markdown fences:
{
  "reasoning": "your full step-by-step analysis following steps 1-5",
  "verdict": "justified or suspicious or unclear",
  "reason": "one sentence summary"
}

verdict must be exactly one of: justified, suspicious, unclear`,

  /**
   * E6: Adversarial verdict — also assesses policy clarity.
   * The policy_clarity field enables detection of hallucinated confidence
   * when the model is given a vague or contradictory policy.
   */
  adversarial: `You are a financial expense auditor. Think step by step.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

First, assess the policy quality. Then reason about the expense.

Reason through these steps:
1. Assess the policy: is it specific and internally consistent (clear), uses vague/generic
   language without specific categories (vague), or contains internal contradictions where
   the same expense type appears in both allowed and forbidden lists (contradictory)?
2. Identify the expense type and find the applicable policy clause.
3. If the policy is contradictory, explicitly state the contradiction you found.
   Do NOT resolve contradictions by choosing one clause over the other —
   return "unclear" when the policy contradicts itself.
4. Assess amount reasonableness.
5. Flag any ambiguities.

Return ONLY a valid JSON object with NO markdown fences:
{
  "reasoning": "your full step-by-step analysis",
  "verdict": "justified or suspicious or unclear",
  "reason": "one sentence summary",
  "policy_clarity": "clear or vague or contradictory"
}

verdict must be exactly one of: justified, suspicious, unclear
policy_clarity must be exactly one of: clear, vague, contradictory`,
};

/**
 * Fill a prompt template by replacing {placeholder} tokens with values.
 * @param {string} template  Prompt string with {placeholders}
 * @param {Object} vars      Key-value map of substitutions
 * @returns {string}
 */
export function fillPrompt(template, vars) {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, v ?? 'unknown'),
    template
  );
}
```

### Verify

```bash
node -e "
import('./lib/prompts.js').then(({ PROMPTS, fillPrompt }) => {
  const keys = Object.keys(PROMPTS);
  console.assert(keys.includes('extraction'), 'extraction exists');
  console.assert(keys.includes('verdictNoCot'), 'verdictNoCot exists');
  console.assert(keys.includes('verdictCot'), 'verdictCot exists');
  console.assert(keys.includes('verdictCotE5'), 'verdictCotE5 exists');
  console.assert(keys.includes('adversarial'), 'adversarial exists');

  const filled = fillPrompt(PROMPTS.verdictNoCot, {
    policy_text: 'test policy',
    vendor: 'Jambutty Software',
    date: '2025-10-01',
    amount: 100,
    currency: 'EUR',
    category: 'equipment',
    line_items: 'monitor',
  });
  console.assert(!filled.includes('{vendor}'), 'placeholders replaced');
  console.assert(filled.includes('Jambutty Software'), 'value inserted');
  console.log('All assertions passed');
});
"
```

Expected: `All assertions passed`

---

## Commit

```bash
git add lib/openrouter.js lib/prompts.js
git commit -m "feat: OpenRouter client, JSON extraction utilities, and prompt templates"
```
