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
