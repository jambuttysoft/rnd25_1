# Task 5 Spec — Backend Routes: E1, E2/E3

> **Read first:** `docs/superpowers/specs/00-project-context.md`
> **Prerequisites:**
> - Task 3 complete: `lib/openrouter.js` and `lib/prompts.js` exist
> - Task 4 complete: `public/index.html` and `public/app.js` exist

---

## Scope

Modify only `server.js`. Add four routes:
- `POST /api/test-connection` — verifies the API key works
- `POST /api/extract` — E1: vision OCR extraction
- `POST /api/verdict` — E2/E3: no-CoT and CoT verdict (controlled by `useCot` and `useE5Prompt` flags)

No new files. Only `server.js` changes.

---

## What `server.js` Looks Like Now

The current `server.js` ends with:

```javascript
// Placeholder — routes added in Tasks 3–8
// TODO: import and mount experiment routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

export { app, upload, loadConfig };
```

---

## Changes to Make

### Step 1: Add imports at the top of `server.js`

After the existing imports (after the line `import { dirname, join } from 'path';`), add:

```javascript
import { callText, callVision, extractJson, normalizeAmount } from './lib/openrouter.js';
import { loadPolicy, policyAsText } from './lib/policy.js';
import { PROMPTS, fillPrompt } from './lib/prompts.js';
```

### Step 2: Replace the placeholder comment with routes

Replace this block:
```javascript
// Placeholder — routes added in Tasks 3–8
// TODO: import and mount experiment routes
```

With:

```javascript
// ─── POST /api/test-connection ────────────────────────────────────────────────
// Verify that the API key works by sending a trivial request.
// Body: { apiKey: string, model: string }
// Response: { ok: true, response: string } | { ok: false, error: string }
app.post('/api/test-connection', async (req, res) => {
  const { apiKey, model } = req.body;
  if (!apiKey) return res.json({ ok: false, error: 'apiKey is required' });
  try {
    const result = await callText(
      [{ role: 'user', content: 'Reply with the single word: OK' }],
      model || 'google/gemini-2.5-flash',
      apiKey
    );
    res.json({ ok: true, response: result.trim().slice(0, 100) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});


// ─── POST /api/extract ────────────────────────────────────────────────────────
// E1: Extract structured fields from a receipt image using the vision model.
//
// Body:
//   base64    string   Base64-encoded image (no "data:" prefix)
//   mimeType  string   MIME type, e.g. "image/jpeg" or "application/pdf"
//   apiKey    string   OpenRouter API key
//   model     string   Vision-capable model ID (e.g. "google/gemini-2.5-flash")
//
// Response:
//   { extraction: { vendor, date, amount, currency, line_items, category } }
//   { error: string }  on failure
//
// Notes:
//   - extractJson() handles markdown fence stripping and single-key unwrapping
//   - normalizeAmount() converts European decimal strings (e.g. "1.249,00") to floats
app.post('/api/extract', async (req, res) => {
  const { base64, mimeType, apiKey, model } = req.body;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    const raw = await callVision(base64, mimeType || 'image/jpeg', PROMPTS.extraction, model, apiKey);
    const extraction = extractJson(raw);
    // Normalize amount to float (handles European format "1.249,00")
    extraction.amount = normalizeAmount(extraction.amount);
    res.json({ extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── POST /api/verdict ────────────────────────────────────────────────────────
// E2, E3, E5: Two-step pipeline — OCR extraction then reasoning verdict.
//
// Body:
//   base64       string   Base64-encoded image
//   mimeType     string   MIME type
//   apiKey       string   OpenRouter API key
//   model        string   Text reasoning model ID
//   visionModel  string   Vision model ID for extraction step
//   policy       string   Policy variant: "clear" | "vague" | "contradictory"
//   phase        number   Phase index: 0 | 1 | 2
//   useCot       boolean  false → PROMPTS.verdictNoCot, true → PROMPTS.verdictCot
//   useE5Prompt  boolean  Optional. true → PROMPTS.verdictCotE5 (5-step with info-sufficiency check)
//
// Response:
//   { verdict, reason, reasoning?, extraction }
//   { error: string }  on failure
//
// Notes:
//   - useCot: false → E2 (no reasoning chain)
//   - useCot: true  → E3 (4-step CoT with policy quotation)
//   - useCot: true + useE5Prompt: true → E5 (5-step CoT with information sufficiency check)
//   - extraction is included in response so the frontend can show what was extracted
app.post('/api/verdict', async (req, res) => {
  const { base64, mimeType, apiKey, model, visionModel, policy: policyName, phase, useCot, useE5Prompt } = req.body;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    // Step 1: Extract receipt fields using vision model
    const rawExtract = await callVision(
      base64,
      mimeType || 'image/jpeg',
      PROMPTS.extraction,
      visionModel || model,
      apiKey
    );
    const extraction = extractJson(rawExtract);
    extraction.amount = normalizeAmount(extraction.amount);

    // Step 2: Build policy text for the selected variant and phase
    const policy = loadPolicy(policyName || 'clear');
    const phaseIndex = Number.isInteger(phase) ? phase : parseInt(phase ?? 1);
    const policyText = policyAsText(policy, phaseIndex);

    // Step 3: Select prompt template
    let promptTemplate;
    if (!useCot) {
      promptTemplate = PROMPTS.verdictNoCot;
    } else if (useE5Prompt) {
      promptTemplate = PROMPTS.verdictCotE5;  // 5-step with info-sufficiency check
    } else {
      promptTemplate = PROMPTS.verdictCot;     // 4-step with policy quotation
    }

    // Step 4: Fill prompt and call reasoning model
    const prompt = fillPrompt(promptTemplate, {
      policy_text: policyText,
      vendor: extraction.vendor,
      date: extraction.date,
      amount: extraction.amount,
      currency: extraction.currency,
      category: extraction.category,
      line_items: (extraction.line_items || []).join(', ') || 'unknown',
    });

    const rawVerdict = await callText([{ role: 'user', content: prompt }], model, apiKey);
    const verdict = extractJson(rawVerdict);

    res.json({ ...verdict, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});
```

---

## Verify

### Test 1: Server starts

```bash
node server.js
```
Expected: `Server running at http://localhost:3000`  
No import errors or syntax errors.

### Test 2: Test connection (requires real API key)

Create `.env` with your real `OPENROUTER_API_KEY`, then with the server running:

```bash
curl -s -X POST http://localhost:3000/api/test-connection \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"$(grep OPENROUTER_API_KEY .env | cut -d= -f2)\", \"model\": \"google/gemini-2.5-flash\"}" \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)))"
```
Expected: `{ ok: true, response: 'OK' }` (or similar single-word reply)

### Test 3: E1 extraction via browser

With the server running, open `http://localhost:3000`:
1. Click Settings tab, enter your API key, click Save Settings
2. Click E1 tab, select any receipt from `CASH_RECIEPTS/`, click Extract Fields
3. Expected: table showing vendor, date, amount, currency, category — all populated or `null`

### Test 4: E2 verdict via browser

1. E2 tab, select the same receipt, choose Clear policy / Phase 2, click Get Verdict
2. Expected: verdict badge (justified/suspicious/unclear) with one-sentence reason

### Test 5: E3 verdict via browser

1. E3 tab, same receipt, click Reason & Verdict
2. Expected: same as E2 but with "Show reasoning chain" expandable `<details>` section

---

## Commit

```bash
git add server.js
git commit -m "feat: backend routes for test-connection, E1 OCR extraction, E2/E3 verdict"
```
