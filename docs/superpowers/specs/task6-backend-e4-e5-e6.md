# Task 6 Spec — Backend Routes: E4, E5, E6

> **Read first:** `docs/superpowers/specs/00-project-context.md`
> **Prerequisites:** Tasks 3, 4, 5 complete. The following already exist:
> - `lib/openrouter.js` — `callText`, `callVision`, `extractJson`, `normalizeAmount`
> - `lib/prompts.js` — `PROMPTS`, `fillPrompt`
> - `lib/policy.js` — `loadPolicy`, `policyAsText`
> - `server.js` — has imports for all three lib files (added in Task 5), has `/api/extract` and `/api/verdict` routes

---

## Scope

Modify only `server.js`. Add two routes:
- `POST /api/phase-sensitivity` — E4: run CoT verdict across all 3 phases in parallel
- `POST /api/adversarial` — E6: run adversarial prompt across all 3 policy variants in parallel

**E5 does not need a new route.** E5 uses `/api/verdict` with `{ useCot: true, useE5Prompt: true }` — this was already implemented in Task 5.

---

## Routes to Add

Add both routes to `server.js` **before** the `app.listen(...)` line.

```javascript
// ─── POST /api/phase-sensitivity ─────────────────────────────────────────────
// E4: Evaluate the same expense across all 3 project phases in parallel.
// Demonstrates whether the model's verdict is phase-sensitive or phase-invariant.
//
// Body:
//   base64       string   Base64-encoded image
//   mimeType     string   MIME type
//   apiKey       string   OpenRouter API key
//   model        string   Text reasoning model ID
//   visionModel  string   Vision model ID for extraction step
//   policy       string   Policy variant: "clear" | "vague" | "contradictory"
//
// Response:
//   { phases: [{phase: string, verdict: string, reason: string, reasoning: string}], extraction }
//   { error: string }  on failure
//
// Notes:
//   - Extraction runs ONCE (not per phase) to keep costs low and results comparable.
//   - Phase evaluation runs in parallel via Promise.all — wall-clock = slowest single call.
//   - Uses PROMPTS.verdictCot (4-step with policy quotation) for all three phases.
//   - The async arrow function inside .map() creates a new scope per iteration,
//     avoiding the classic closure-capture bug where all calls would use the last phase.
app.post('/api/phase-sensitivity', async (req, res) => {
  const { base64, mimeType, apiKey, model, visionModel, policy: policyName } = req.body;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    // Step 1: Extract receipt fields once
    const rawExtract = await callVision(
      base64,
      mimeType || 'image/jpeg',
      PROMPTS.extraction,
      visionModel || model,
      apiKey
    );
    const extraction = extractJson(rawExtract);
    extraction.amount = normalizeAmount(extraction.amount);

    // Step 2: Load policy
    const policy = loadPolicy(policyName || 'clear');

    // Step 3: Evaluate across all 3 phases in parallel
    // Each iteration gets its own policyText via the async closure — no variable capture bug.
    const phases = await Promise.all(
      policy.phases.map(async (phaseObj, i) => {
        const policyText = policyAsText(policy, i);
        const prompt = fillPrompt(PROMPTS.verdictCot, {
          policy_text: policyText,
          vendor: extraction.vendor,
          date: extraction.date,
          amount: extraction.amount,
          currency: extraction.currency,
          category: extraction.category,
          line_items: (extraction.line_items || []).join(', ') || 'unknown',
        });
        const raw = await callText([{ role: 'user', content: prompt }], model, apiKey);
        const result = extractJson(raw);
        return { phase: phaseObj.name, ...result };
      })
    );

    res.json({ phases, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── POST /api/adversarial ────────────────────────────────────────────────────
// E6: Evaluate the same expense under all 3 policy variants in parallel.
// Detects hallucination: model claims policy is "clear" when it is vague/contradictory.
//
// Body:
//   base64       string   Base64-encoded image
//   mimeType     string   MIME type
//   apiKey       string   OpenRouter API key
//   model        string   Text reasoning model ID
//   visionModel  string   Vision model ID for extraction step
//   phase        number   Phase index (0 | 1 | 2) — same phase used across all 3 policies
//
// Response:
//   { policies: [{policy, verdict, reason, reasoning, policy_clarity, hallucination}], extraction }
//   { error: string }  on failure
//
// Hallucination definition:
//   A response where model.policy_clarity === "clear" but the actual input policy was
//   "vague" or "contradictory". Hallucination is set to `true` in those cases.
//   For the "clear" policy variant, hallucination is always `false`.
//
// Notes:
//   - Uses PROMPTS.adversarial which requests a policy_clarity field in the JSON output.
//   - Extraction runs ONCE. Policy evaluation runs in parallel across 3 variants.
app.post('/api/adversarial', async (req, res) => {
  const { base64, mimeType, apiKey, model, visionModel, phase } = req.body;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    // Step 1: Extract receipt fields once
    const rawExtract = await callVision(
      base64,
      mimeType || 'image/jpeg',
      PROMPTS.extraction,
      visionModel || model,
      apiKey
    );
    const extraction = extractJson(rawExtract);
    extraction.amount = normalizeAmount(extraction.amount);

    const phaseIndex = Number.isInteger(phase) ? phase : parseInt(phase ?? 1);
    const policyNames = ['clear', 'vague', 'contradictory'];

    // Step 2: Evaluate under all 3 policy variants in parallel
    const policies = await Promise.all(
      policyNames.map(async (policyName) => {
        const policy = loadPolicy(policyName);
        const policyText = policyAsText(policy, phaseIndex);
        const prompt = fillPrompt(PROMPTS.adversarial, {
          policy_text: policyText,
          vendor: extraction.vendor,
          date: extraction.date,
          amount: extraction.amount,
          currency: extraction.currency,
          category: extraction.category,
          line_items: (extraction.line_items || []).join(', ') || 'unknown',
        });
        const raw = await callText([{ role: 'user', content: prompt }], model, apiKey);
        const result = extractJson(raw);

        // Hallucination: model claims policy is "clear" when it isn't
        const hallucination = policyName !== 'clear' && result.policy_clarity === 'clear';

        return { policy: policyName, ...result, hallucination };
      })
    );

    res.json({ policies, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});
```

---

## Verify

### Test 1: Server still starts

```bash
node server.js
```
Expected: `Server running at http://localhost:3000` — no errors.

### Test 2: E4 — Phase Sensitivity via browser

With server running, open `http://localhost:3000`:
1. Settings tab — enter API key, save
2. E4 tab — upload an equipment receipt (e.g., a monitor or laptop invoice from `CASH_RECIEPTS/`)
3. Select "Clear policy", click "Test All Phases"
4. Expected: 3 columns appear, one per phase. Equipment receipts should show:
   - Phase 1 (Infrastructure Setup): `justified` — equipment is explicitly allowed
   - Phase 2 (Experimentation): likely `suspicious` or `unclear` — restricted unless existing equipment fails
   - Phase 3 (Evaluation & Documentation): `suspicious` — new hardware is forbidden

If all 3 phases return `justified` for an equipment receipt, the phase-sensitivity failure mode from E4 (the primary research finding) may be reproduced — note this.

### Test 3: E5 — Ambiguity via browser

1. E5 tab — upload an ambiguous receipt (e.g., a restaurant receipt without team context)
2. Select Clear policy / Phase 2, click "Analyse Ambiguity"
3. Expected: verdict with either `unclear` (model expressed uncertainty) or `justified`/`suspicious` with the "⚠ Confident verdict on ambiguous receipt" badge
4. The `<details>` element should show the 5-step reasoning including the information sufficiency check (Step 5)

**Verify the 5-step prompt is being used:** Check that `data.reasoning` in the response contains text about "information sufficiency" or "context not visible in the receipt" — this confirms the `useE5Prompt: true` → `PROMPTS.verdictCotE5` path is working.

### Test 4: E6 — Adversarial via browser

1. E6 tab — upload any receipt
2. Click "Test All Policies"
3. Expected: 3 columns (clear, vague, contradictory)
   - Clear policy: `policy_clarity: "clear"` — no hallucination badge
   - Vague policy: if model returns `policy_clarity: "clear"` → orange "⚠ hallucination" badge appears
   - Contradictory policy: well-calibrated models return `policy_clarity: "contradictory"` — no badge; poorly calibrated models return `"clear"` → badge appears
4. The `policy_clarity` value is shown below each verdict card

---

## Commit

```bash
git add server.js
git commit -m "feat: backend routes for E4 phase-sensitivity and E6 adversarial stress test"
```
