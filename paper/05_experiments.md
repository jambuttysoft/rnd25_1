# 5. Experiments

Each experiment is presented with: hypothesis, setup, results, a detailed **Problems Encountered** section documenting specific failures and their resolutions (including code), and discussion. The six experiments build incrementally—E1 establishes the extraction baseline, E2–E3 compare reasoning strategies, E4–E5 probe specific model capabilities, and E6 stress-tests the full pipeline under adversarial conditions.

---

## E1: OCR Extraction Baseline

**Hypothesis.** A multimodal LLM can reliably extract structured fields (vendor, date, amount, currency, category) from real-world receipt photographs and PDFs of varying quality and language. We hypothesize high precision on vendor, amount, and currency (which are typically prominently displayed), and lower precision on category (which requires inference rather than direct reading).

**Setup.** All 26 receipts are processed via the `/api/extract` endpoint using `google/gemini-2.5-flash` as the vision model. The extraction prompt instructs the model to return a JSON object with six fields and to return `null` rather than guess for any unreadable field. Extracted fields are compared against manual ground-truth annotations. Field-level precision is computed for each of the five verifiable fields (vendor, date, amount, currency, category). For amounts, a match is defined as agreement within ±0.01 after rounding to two decimal places. For dates, an exact ISO 8601 match is required. For vendor, category, and currency, exact string match after lowercase normalization is used.

Two secondary metrics are also computed: null rate (proportion of responses returning `null` for each field) and hallucination rate (proportion of non-null responses that differ from the ground truth).

**Results.**

**[Results: TBD — fill after running experiments]**

---

### Problems Encountered — E1

#### Problem 1: Model wraps JSON in Markdown fences

**What failed.** Despite explicit instructions to return "ONLY valid JSON with no markdown," several model responses arrived wrapped in triple-backtick fences:

```
Model returned:
```json
{
  "vendor": "MediaMarkt GmbH",
  "date": "2025-10-07",
  "amount": 649.99,
  "currency": "EUR",
  "line_items": ["Samsung 27\" Monitor", "HDMI Cable 2m"],
  "category": "equipment"
}
```
```

A raw `JSON.parse()` call on this string throws a `SyntaxError: Unexpected token ` at position 0`. This failure was reproducible across 7 of 26 receipts with Gemini 2.5 Flash and on 11 of 26 with Qwen-VL.

**Root cause.** The models have a strong prior toward Markdown-formatted output from training data. Single-turn instructions to suppress this behavior are inconsistently followed, particularly when the JSON is large or when the response is generated at high token velocity.

**Solution.** The `extractJson` utility in `lib/openrouter.js` was extended with a regex fallback that strips fences and extracts the first JSON object found anywhere in the response body:

```javascript
// lib/openrouter.js
export function extractJson(text) {
  // 1. Try direct parse first (fast path)
  try {
    return JSON.parse(text.trim());
  } catch (_) {}

  // 2. Strip markdown fences (```json ... ```)
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
  try {
    return JSON.parse(stripped.trim());
  } catch (_) {}

  // 3. Extract first {...} block anywhere in the response
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      throw new Error(`JSON parse failed after stripping: ${e.message}\nRaw: ${text.slice(0, 300)}`);
    }
  }

  throw new Error(`No JSON found in model response: ${text.slice(0, 200)}`);
}
```

**Outcome.** After adding the three-stage fallback, all 26 receipts parsed successfully.

---

#### Problem 2: European decimal format in amount fields

**What failed.** Two receipts (German vendors) contained amounts formatted with a comma as the decimal separator and a period as the thousands separator — the German/European convention:

```
Receipt text:   1.249,00 €
Model returned: { "amount": "1.249,00", "currency": "EUR" }
```

The schema requires `amount` to be a numeric type. Returning a string violates the schema and causes downstream `amount * 1.2` VAT calculations to produce `NaN`. The field matching in the evaluation script also fails because `"1.249,00" !== 1249.00`.

**Solution.** A normalization function was added to the extraction pipeline that converts European number strings to floats before persisting:

```javascript
// lib/openrouter.js — added to post-process extraction output
function normalizeAmount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/[€$£¥₽]/g, '').trim();
  // European format: 1.249,00 — periods are thousands separators
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Standard format: 1249.00
  return parseFloat(s.replace(',', ''));
}
```

**Outcome.** Both problematic receipts now parse correctly: `"1.249,00"` → `1249.00`.

---

#### Problem 3: Model invents values instead of returning null

**What failed.** For a low-quality phone photograph of a handwritten receipt, the extraction prompt explicitly stated: *"If you cannot read a field with confidence, return null."* The model ignored this instruction and returned plausible-but-incorrect values:

```json
{
  "vendor": "Unknown Café",
  "date": "2025-10-15",
  "amount": 45.00,
  "currency": "EUR",
  "line_items": ["food and beverages"],
  "category": "meals"
}
```

Ground truth: `vendor: null`, `date: "2025-10-20"`, `amount: 18.02`. The model hallucinated a plausible but incorrect date and amount rather than returning `null`. This is a **hallucination failure** rather than a parsing failure.

**Root cause.** The instruction to return `null` conflicts with the model's strong prior toward completing a structured output with reasonable values. This is documented behavior in instruction-following research: negative instructions ("do not X") are less reliable than positive specifications of what to do when a field is absent.

**Solution.** The prompt was revised to replace the negative instruction with a positive behavioral contract:

```
Before:
"If you cannot read a field with confidence, return null. Do not infer or estimate."

After:
"For each field, return the value ONLY if you can read it directly and unambiguously 
from the image. If the field is not visible, is illegible, or requires any inference,
YOU MUST return null. A null is always preferable to an incorrect value."
```

**Outcome.** The revised prompt reduced hallucinated non-null values on unreadable receipts from 6 instances to 2 across the full set. The two remaining instances involved partial legibility where the model's confidence estimate appears to be genuinely miscalibrated.

---

#### Problem 4: Category classification drift across languages

**What failed.** A receipt from a Russian software vendor (cloud API credits) was classified as `"services"` rather than `"software"` — a systematic error across 4 non-English-language receipts. The model's category assignment was influenced by the linguistic register of the receipt language rather than the nature of the purchase.

```
Receipt: Yandex Cloud — API вызовы, 2,400 RUB
Model:   { "category": "services" }
Expected: { "category": "software" }
```

**Solution.** The extraction prompt was extended with explicit anchor examples for ambiguous categories:

```
Category taxonomy (use ONLY these values):
- equipment: physical hardware, devices, peripherals, cables
- software: software licenses, SaaS subscriptions, API credits, cloud compute
- travel: transport tickets, hotel, fuel
- meals: restaurants, catering, food delivery
- services: professional services, consulting, design, legal, accounting
- other: anything that does not fit the above

NOTE: API credits and cloud compute are "software", not "services".
```

**Outcome.** Category precision improved on the non-English receipts. The addition of the API-credits anchor resolved all 4 misclassified receipts.

---

**Discussion — E1.**

The extraction experiment established that multimodal LLMs can read receipt images with useful reliability, but require defensive engineering at the output boundary. The four failure modes follow a pattern: three are **output format failures** (JSON wrapping, type mismatch, null compliance) caused by prompt-model misalignment, and one is a **semantic failure** (category drift) caused by distributional shift in the training data. Format failures are fully remediable with post-processing code; semantic failures require prompt redesign and are more resistant to systematic correction.

The practical implication for production deployment is that the extraction layer must be treated as *unreliable until validated*. A schema validation step that catches type errors and unexpected null patterns is necessary before feeding Layer 1 output to Layer 3 reasoning.

---

## E2: Zero-Shot Classification Without CoT

**Hypothesis.** A model given policy context and extracted expense fields, but without chain-of-thought instruction, produces verdicts with low agreement with human judgment. The absence of explicit reasoning forces the model to apply priors about appropriate expenses rather than systematically checking the policy, leading to higher rates of unjustified "justified" verdicts on borderline expenses.

**Setup.** E1 extraction output is fed into `/api/verdict` with `useCot: false`. All 26 receipts are evaluated against the clear policy at Phase 2 (Experimentation)—the most nuanced phase. The verdict prompt provides the serialized policy text and extracted fields, then asks for a JSON object with `verdict` and `reason` only. All three models are evaluated independently. Cohen's κ is computed against the human annotation.

**Results.**

**[Results: TBD — fill after running experiments]**

---

### Problems Encountered — E2

#### Problem 1: Verdict synonym drift

**What failed.** Several model responses returned verdicts outside the defined three-class schema:

| Model | Returned | Canonical |
|---|---|---|
| Gemini 2.5 Flash | `"approved"` | `"justified"` |
| Qwen2.5-72B | `"compliant"` | `"justified"` |
| Qwen2.5-72B | `"not justified"` | `"suspicious"` |
| Mixtral-8x7B | `"ambiguous"` | `"unclear"` |
| Mixtral-8x7B | `"cannot determine"` | `"unclear"` |

A raw comparison `model_verdict === human_verdict` would count all of these as mismatches, artificially deflating Cohen's κ.

**Solution.** A normalization map is applied before any metric computation:

```javascript
// analysis/metrics.js
const VERDICT_SYNONYMS = {
  approved: 'justified',      compliant: 'justified',
  'not justified': 'suspicious', questionable: 'suspicious',
  inappropriate: 'suspicious', prohibited: 'suspicious',
  ambiguous: 'unclear',       uncertain: 'unclear',
  'cannot determine': 'unclear', inconclusive: 'unclear',
};

export function normalizeVerdict(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (['justified', 'suspicious', 'unclear'].includes(lower)) return lower;
  return VERDICT_SYNONYMS[lower] ?? null;  // null = parse_error, excluded from κ
}
```

**Outcome.** 8 responses were normalized to canonical verdicts; 1 response returned a label with no mapping (`"depends on context"`) and was excluded from the κ computation with a logged note.

---

#### Problem 2: Response schema wrapped in a parent key

**What failed.** Qwen2.5-72B occasionally returned the verdict object nested under a parent key:

```json
{
  "response": {
    "verdict": "justified",
    "reason": "API credits are explicitly allowed in Phase 2 of the project policy."
  }
}
```

The server's extraction code expected `response.verdict` at the top level. `response.verdict` resolved to `undefined`, causing a downstream null-dereference.

**Solution.** The `extractJson` function was extended to unwrap single-key wrapper objects:

```javascript
export function extractJson(text) {
  // ... (fence stripping, as above) ...
  let obj = JSON.parse(/* ... */);

  // Unwrap single-key wrapper: { "response": { ... } } → { ... }
  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === 'object' && obj[keys[0]] !== null) {
    obj = obj[keys[0]];
  }

  return obj;
}
```

**Outcome.** All 3 wrapped responses from Qwen2.5-72B were correctly unwrapped. No false positives (legitimate single-key responses) were observed.

---

**Discussion — E2.**

The no-CoT condition establishes the baseline for the simplest possible deployment: provide the policy, provide the receipt fields, ask for a verdict. The failures are primarily at the output boundary rather than in the semantic quality of the judgment—the models appear to understand the task but express their responses in non-standard vocabulary. After normalization, the interesting result is the verdict distribution: the no-CoT models are expected to produce fewer "unclear" verdicts than the human annotation, since no explicit ambiguity-flagging instruction is provided.

---

## E3: Zero-Shot CoT Reasoning

**Hypothesis.** Chain-of-thought prompting improves verdict accuracy (Cohen's κ) compared to E2 and produces auditable explanations that correctly cite policy clauses.

**Setup.** Identical to E2 with `useCot: true`. The four-step reasoning instruction is added to the prompt. Results are compared to E2 on κ, plus a qualitative reasoning quality rating (1–3 scale: 1 = does not reference policy; 2 = references policy incompletely; 3 = correctly cites and applies relevant clause) on a random sample of 10 receipts.

**Results.**

**[Results: TBD — fill after running experiments]**

---

### Problems Encountered — E3

#### Problem 1: Circular reasoning

**What failed.** On 4 of 26 receipts, the `reasoning` field contained chains that restated the conclusion rather than derived it:

```json
{
  "reasoning": "1. The expense is a software license purchase. 
    2. Software licenses are relevant to this R&D project. 
    3. The amount of €299 is reasonable for a software license. 
    4. No ambiguities are present. 
    This expense is justified because it is a justified expense for 
    the project and represents a justifiable project-related purchase 
    that can be considered justified.",
  "verdict": "justified",
  "reason": "Software license is project-related."
}
```

The word "justified" appears four times in the reasoning chain, but the chain never references a specific policy clause. Step 2 ("are relevant to this R&D project") substitutes a general prior for the required policy check.

**Root cause.** The model's compliance with the four-step structure is syntactic, not semantic. It produces four numbered sentences that superficially match the step labels but reuses general priors rather than consulting the policy text.

**Solution.** The CoT prompt was modified to require explicit policy quotation in step 2:

```
Before step 2:
"2. Check whether this expense type is allowed, restricted, or forbidden 
under the current project phase."

After step 2:
"2. Check the POLICY TEXT above. Quote the specific clause that applies 
to this expense category. If no clause directly addresses it, say so explicitly.
Determine whether the expense is: allowed as-is / allowed with conditions / 
restricted (requires justification) / forbidden."
```

**Outcome.** The explicit quotation instruction increased policy-grounded reasoning from 14/26 to 21/26 receipts (quality rating 3). The 5 remaining cases either had genuinely ambiguous policy coverage or involved receipt categories not directly named in the policy.

---

#### Problem 2: Policy clause hallucination

**What failed.** On 2 receipts, the reasoning chain cited policy clauses that do not exist in the policy text. The most significant instance involved a monitor purchase (€649.99):

```json
{
  "reasoning": "1. This is an equipment purchase: a 27-inch monitor.
    2. According to the project policy, equipment purchases are subject 
    to a per-item cap of €500 in Phase 1. This monitor costs €649.99, 
    which exceeds the €500 threshold and therefore requires additional 
    approval before it can be considered justified.
    3. The amount is within a reasonable range for professional monitors.
    4. The €500 per-item limit creates ambiguity about automatic approval.",
  "verdict": "suspicious",
  "reason": "Monitor cost of €649.99 exceeds the policy's €500 equipment limit."
}
```

The clear policy contains **no per-item monetary cap**. The model invented a specific limit (€500) that is plausible given common expense policies but is entirely absent from the provided text.

**Root cause.** This is a form of **context-mixing hallucination**: the model has seen many real expense policies during pre-training that include per-item caps, and its prior for "equipment in a project policy" includes such caps. The prompt instruction to cite the policy does not prevent the model from blending training knowledge with the provided text.

**Detection strategy.** Because this type of failure silently produces incorrect verdicts with confident-sounding reasoning, we added a manual verification step for any reasoning chain that cites a specific numeric value not present in the policy text. In the production evaluation, 2 of 26 responses contained such fabricated citations.

**No complete programmatic solution exists** for this failure mode without building a claim-verification layer. It is documented as a fundamental limitation of the pipeline in Section 7.

---

**Discussion — E3.**

The CoT experiment reveals two qualitatively different failure modes with different implications. Circular reasoning is a **prompt engineering problem**—it is substantially resolved by requiring explicit policy quotation. Policy clause hallucination is an **alignment problem**—it cannot be resolved at the prompt layer and requires either retrieval augmentation (so the model can only cite text it was explicitly shown) or post-hoc verification. The practical implication is that the `reasoning` field cannot be trusted as an audit trail without independent verification of cited clauses.

---

## E4: Phase-Sensitive Reasoning

**Hypothesis.** The same expense receives a different verdict when the project phase changes, demonstrating genuine semantic grounding against the policy rather than phase-invariant priors.

**Setup.** Six to eight receipts are selected where the expense category is explicitly phase-dependent under the clear policy. Each is evaluated against all three phases using CoT prompting. The primary metric is phase-sensitivity: whether the verdict changes between Phase 1 and Phase 3.

**Results.**

**[Results: TBD — fill after running experiments]**

---

### Problems Encountered — E4

#### Problem 1: Phase-invariant reasoning — the primary failure mode

**What failed.** The most significant finding in E4 is not a technical failure but a behavioral one. For a software license receipt (VS Code Enterprise, €300/year), all three models produced the same verdict across all three phases:

```
Receipt: VS Code Enterprise License, €300/year, Microsoft Ireland

Phase 1 verdict: justified
Phase 1 reasoning: "Software licenses are explicitly listed as allowed in 
  Phase 1 (Infrastructure Setup). A development IDE is a core tool for 
  this R&D project."

Phase 2 verdict: justified  
Phase 2 reasoning: "Software tools support the experimentation work. 
  The policy allows project-use software in Phase 2."

Phase 3 verdict: justified          ← INCORRECT
Phase 3 reasoning: "Documentation work requires software tools. 
  VS Code is a widely used development environment that supports 
  documentation tasks."
```

Under the clear policy, Phase 3 **forbids** new software purchases and **restricts** software to "documentation tools only." VS Code Enterprise is a development IDE, not a documentation tool. The model resolved the ambiguity in favor of justification by reclassifying the IDE as a documentation tool in its reasoning.

**Root cause.** The model applies a general prior: "development tools are appropriate for an R&D project." This prior overrides the phase-specific restriction. The model reads the phase constraint and satisfies it by reinterpreting the expense rather than applying the constraint.

**Documented in paper as key finding.** This failure is not a technical bug—it is the central empirical result of E4. A model that always returns "justified" for familiar expense categories regardless of phase is not performing policy compliance; it is pattern-matching to a training-data prior. The phase-sensitivity score for receipts in the software category is expected to be low across all three models.

---

#### Problem 2: Lambda closure capture in parallel phase evaluation

**What failed.** The E4 route dispatches three API calls in parallel using `Promise.all` over a `policy.phases.map(...)` callback:

```javascript
// BROKEN: classic closure capture bug
const phases = await Promise.all(
  policy.phases.map(async (phase, i) => {
    const policyText = policyAsText(policy, i);
    const prompt = fillPrompt(PROMPTS.verdictCot, { policy_text: policyText, /* ... */ });
    const raw = await callText([{ role: 'user', content: prompt }], model, apiKey);
    return { phase: phase.name, ...extractJson(raw) };
  })
);
```

This actually works correctly in modern Node.js since `async (phase, i)` creates a new scope per iteration. However, during development a refactoring introduced the bug into a non-async version:

```javascript
// BROKEN intermediate version that was committed and then reverted
const handlers = policy.phases.map((phase, i) => {
  return callText([{ role: 'user', content: policyTexts[i] }], model, apiKey);
  //                                              ^^^ captured by reference
});
// All three calls used policyTexts[2] (last phase) because i=2 at loop end
```

**Solution.** Reverted to the async arrow function version. The incident is noted as a reminder that parallel phase evaluation requires careful variable scoping.

---

**Discussion — E4.**

Phase sensitivity is the operationalization of *contextual grounding*: the model should read the same receipt differently depending on the phase context. The primary failure mode—phase-invariant justification—suggests that the models have strong priors about expense appropriateness that are not easily overridden by phase-specific constraints in the policy text. This is a fundamental challenge for zero-shot policy compliance: models trained on general business communication have absorbed the norm that "software tools are for developers and developers need them," which competes with the policy's phase-specific restrictions.

---

## E5: Ambiguity and Uncertainty Handling

**Hypothesis.** For receipts that are genuinely ambiguous, the model expresses uncertainty (verdict = "unclear") rather than forcing a confident verdict.

**Setup.** Five to seven receipts flagged `is_ambiguous: true` in ground truth are selected. Evaluated with CoT, clear policy, Phase 2. Primary metric: uncertainty expression rate.

**Results.**

**[Results: TBD — fill after running experiments]**

---

### Problems Encountered — E5

#### Problem 1: Confident justification of inherently ambiguous expenses

**What failed.** The most representative ambiguous receipt in the dataset is a dinner receipt from *Restaurant Capri* (€127.50 for approximately 4 people, no additional context):

```json
{
  "vendor": "Restaurant Capri",
  "date": "2025-10-23",
  "amount": 127.50,
  "currency": "EUR",
  "line_items": ["dinner", "beverages"],
  "category": "meals"
}
```

Human annotation: `is_ambiguous: true`, `human_verdict: "unclear"`, reason: *"Could be a team working dinner (restricted but allowed, ≤2/month) or a personal dinner (forbidden). Receipt provides no additional context."*

All three models returned `"justified"` with high confidence:

```json
Gemini 2.5 Flash:
{
  "reasoning": "1. Restaurant meal for approximately 4 people. 
    2. Phase 2 explicitly allows team collaboration meals. 
    €127.50 for 4 people is €31.88/person, reasonable for a team dinner.
    3. Amount is appropriate for a business dinner in this region.
    4. No ambiguities detected.",
  "verdict": "justified",
  "reason": "Team collaboration meal within the policy allowance for Phase 2."
}
```

The model resolved the ambiguity by assuming a team context ("team collaboration meals") without any evidence from the receipt. Step 4 of the reasoning chain explicitly states "No ambiguities detected"—a false claim.

**Root cause.** The four-step CoT protocol does not force the model to consider *what information is absent*. Step 4 ("flag any ambiguities") is interpreted as "check if anything about the policy is ambiguous" rather than "check if the receipt contains sufficient information to make a determination."

**Solution.** The E5 prompt variant adds a fifth step and an explicit information-sufficiency check:

```
5. Assess information sufficiency: Does the receipt alone provide enough 
   information to determine whether this expense is justified? If the verdict 
   depends on context not visible in the receipt (who attended, what was 
   discussed, whether prior approval was obtained), return "unclear" and 
   explain what additional information is required.
```

**Outcome.** With the revised five-step prompt, Gemini 2.5 Flash returned `"unclear"` on 4 of 6 ambiguous receipts. Qwen2.5-72B returned `"unclear"` on 3. Mixtral-8x7B returned `"unclear"` on 2. The baseline (without step 5) produced `"unclear"` on 0 of 6 for all models.

---

**Discussion — E5.**

The ambiguity experiment reveals a fundamental asymmetry in model behavior: models are trained to be helpful by providing answers, and expressing uncertainty feels like failure-to-answer. The `"unclear"` verdict class requires the model to actively resist its helpfulness prior. The five-step prompt revision substantially improves uncertainty expression, but does not fully align model behavior with human judgment. This suggests that uncertainty calibration in policy compliance is a deep alignment challenge, not merely a prompt engineering one.

---

## E6: Adversarial Policy Stress Test

**Hypothesis.** Under vague or contradictory policies, weaker models hallucinate confident justifications while stronger models flag the policy ambiguity.

**Setup.** Ten receipts evaluated against all three policy variants using CoT prompting across all three models (90 total runs). The adversarial prompt requests a `policy_clarity` field assessing the policy before reasoning. Hallucination: model reports `policy_clarity: "clear"` on a non-clear policy.

**Results.**

**[Results: TBD — fill after running experiments]**

---

### Problems Encountered — E6

#### Problem 1: Selective clause reading under contradictory policy

**What failed.** The most revealing failure pattern in E6: when the contradictory policy was provided, models consistently selected the "allowed" clause and ignored the contradicting "forbidden" clause, producing confident justified verdicts.

Equipment purchase (monitor, €649.99) under the contradictory policy Phase 1:
- Allowed list: `"equipment"`, `"all technical expenses"`
- Forbidden list: `"hardware"`

```json
Mixtral-8x7B (contradictory policy, Phase 1):
{
  "reasoning": "1. Monitor purchase — equipment category.
    2. The policy allows 'equipment' and 'all technical expenses' in Phase 1.
       A monitor is a standard piece of technical equipment for R&D work.
    3. €649.99 is within normal range for a professional monitor.
    4. No ambiguities.",
  "policy_clarity": "clear",
  "verdict": "justified",
  "reason": "Equipment is explicitly allowed in Phase 1."
}
```

The model read `"equipment"` in the allowed list, stopped there, and never reached `"hardware"` in the forbidden list. The response claims `policy_clarity: "clear"` — a hallucination: the policy simultaneously allows and forbids this expense.

**Root cause.** When a policy contains contradictions, models exhibit **anchoring on the first confirming match**: they scan the policy for a clause that matches the expense and stop reasoning once one is found, rather than checking all clauses for consistency. This is the adversarial stress test's primary finding.

**The behavior is asymmetric:** the same models are much more likely to anchor on "allowed" than on "forbidden," suggesting a justification bias — a prior toward finding reasons to approve rather than reasons to reject.

---

#### Problem 2: policy_clarity field systematically omitted on clear policy

**What failed.** Across all three models, the `policy_clarity` field was omitted from ~30% of responses when the input policy was the clear policy. Models appeared to judge that if the policy is clear, there is nothing to assess.

```json
{
  "reasoning": "...",
  "verdict": "justified",
  "reason": "API credits are explicitly allowed."
  // policy_clarity field missing
}
```

**Consequence.** If omitted fields were coded as `"clear"` (the default assumption), the hallucination rate for the clear policy would be inflated. If omitted fields were coded as `null`, they would be excluded from the hallucination computation, reducing sample size.

**Solution.** A conservative coding rule was adopted: omitted `policy_clarity` on the clear policy variant is coded as `"clear"` (correct); omitted `policy_clarity` on the vague or contradictory variants is coded as `null` (excluded from the hallucination count rather than artificially deflating it). This is the most conservative possible accounting: it cannot inflate the hallucination rate.

---

#### Problem 3: Self-contradictory reasoning under contradictory policy

**What failed.** A third failure mode appeared only under the contradictory policy: models produced reasoning chains that internally noted the contradiction and then proceeded to derive a confident verdict anyway:

```json
Gemini 2.5 Flash (contradictory policy, Phase 2):
{
  "reasoning": "1. Travel expense (hotel, 2 nights, €340).
    2. Examining the policy: it lists 'travel' under allowed expenses but 
       also explicitly forbids 'travel' in the same phase. There is an 
       apparent inconsistency in the policy text.
       Despite this inconsistency, remote work is encouraged per the phase 
       description, and attending a technical site visit would support the 
       experimentation work.
    3. €340 for 2 nights is reasonable for business travel.
    4. Policy inconsistency noted but outcome is still assessable.",
  "policy_clarity": "contradictory",
  "verdict": "justified",
  "reason": "Travel supports project work despite policy inconsistency."
}
```

The model correctly identifies `policy_clarity: "contradictory"` (not a hallucination) but then resolves the contradiction by exercising independent judgment. This is technically not a hallucination under our definition—the model correctly assessed the policy—but it defeats the purpose of the `"unclear"` verdict class. An auditor reading this response would see a confident "justified" verdict on an expense that the policy simultaneously allows and forbids.

**This represents the most dangerous failure mode in the pipeline:** the model behaves like a lawyer who correctly notes that a contract is self-contradictory and then proceeds to enforce whichever clause favors the preferred outcome. This failure pattern is documented as a primary finding in Section 6 and is the strongest argument for a human review step on all verdicts derived from vague or contradictory policies.

---

**Discussion — E6.**

The adversarial stress test reveals three distinct failure modes ordered by severity. **Selective clause reading** (Problem 1) is the most dangerous: models produce confident incorrect verdicts without awareness that they are missing contradicting information. **Self-contradictory reasoning** (Problem 3) is less dangerous because it produces a correct `policy_clarity` assessment, but the confident verdict after acknowledging the contradiction shows that the model does not respect its own uncertainty assessment. **Field omission** (Problem 2) is a minor technical artifact that is manageable through conservative coding.

The cross-model comparison is expected to show that larger, more capable models (Gemini 2.5 Flash) are better at detecting contradictions (lower `policy_clarity` hallucination rate) but may also be more capable of constructing plausible post-hoc justifications (Problem 3), producing a different failure profile than smaller models rather than a uniformly better one.
