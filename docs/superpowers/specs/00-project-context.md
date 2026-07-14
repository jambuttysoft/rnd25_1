# Project Context — AI-Driven Policy Semantic Audit

> This document is the shared foundation for all task specs (task3–task7).
> Read it first before implementing any task.

---

## What This Is

A Node.js/Express web application for an R&D research project. Users upload expense receipt images, and the app runs them through an LLM pipeline that extracts structured fields and evaluates whether the expense is justified under a configurable project policy. The app has 7 tabs (E1–E6 experiments + Settings + Annotate).

All LLM calls go through the OpenRouter API. No local models. No build step.

---

## What Already Exists (do not re-create)

```
/Volumes/extdisk/WORK/RND2026/RND1/
├── server.js              ← Express scaffold. Routes NOT yet added.
├── package.json           ← { "type": "module", dependencies: express, multer, dotenv }
├── config.json            ← { "model": "google/gemini-2.5-flash", "visionModel": "google/gemini-2.5-flash" }
├── .env.example           ← OPENROUTER_API_KEY=...
├── lib/
│   └── policy.js          ← loadPolicy(), policyAsText(), listPolicies(), listPhases()
├── data/
│   └── policy/
│       ├── policy_clear.json
│       ├── policy_vague.json
│       └── policy_contradictory.json
└── CASH_RECIEPTS/         ← 26 real receipt photos (JPG/PNG/PDF). DO NOT modify.
```

**What does NOT exist yet** (the tasks create these):
- `lib/openrouter.js` — Task 3
- `lib/prompts.js` — Task 3
- `public/index.html` — Task 4
- `public/app.js` — Task 4
- `public/style.css` — Task 4
- Routes in `server.js` — Tasks 5, 6, 7
- `data/annotations/ground_truth.json` — Task 7

---

## Conventions

**ES modules everywhere.** All files use `import`/`export`, no `require()`. `package.json` has `"type": "module"`.

**No build step.** Tailwind CSS loaded via CDN in HTML. No webpack, no Vite, no compilation.

**In-memory file uploads.** Multer is configured with `memoryStorage()`. Uploaded files are never written to disk; they arrive as `Buffer` in `req.file.buffer`.

**API key in memory.** The OpenRouter API key is passed from the frontend as `apiKey` in the request body. It is NOT stored server-side in any persistent file. The `.env` file is optional and for convenience only; the Settings tab is the runtime source.

**config.json** stores only model names (strings). It is read/written by `loadConfig()`/`saveConfig()` already implemented in `server.js`.

**Ports and paths:**
- Server: `http://localhost:3000`
- All API routes under `/api/`
- Frontend static files served from `./public/`

---

## Key Data Schemas

### Receipt extraction object
```json
{
  "vendor": "MediaMarkt GmbH",
  "date": "2025-10-07",
  "amount": 649.99,
  "currency": "EUR",
  "line_items": ["Samsung Monitor 27\"", "HDMI Cable"],
  "category": "equipment"
}
```
`amount` is always a float (or `null`). `date` is always ISO 8601 (or `null`). `category` is one of: `equipment`, `software`, `travel`, `meals`, `services`, `supplies`, `other`.

### Verdict object (no-CoT)
```json
{
  "verdict": "justified",
  "reason": "API credits are explicitly allowed in Phase 2."
}
```
`verdict` is one of: `justified`, `suspicious`, `unclear`.

### Verdict object (CoT)
```json
{
  "reasoning": "1. This is a software purchase...\n2. Phase 2 allows...\n3. Amount is reasonable...\n4. No ambiguities.",
  "verdict": "justified",
  "reason": "API credits are explicitly allowed in Phase 2."
}
```

### Adversarial verdict object
```json
{
  "reasoning": "...",
  "verdict": "justified",
  "reason": "...",
  "policy_clarity": "clear"
}
```
`policy_clarity` is one of: `clear`, `vague`, `contradictory`.

### Annotation object (ground truth)
```json
{
  "filename": "receipt_001.jpg",
  "vendor": "MediaMarkt GmbH",
  "date": "2025-10-07",
  "amount": 649.99,
  "currency": "EUR",
  "category": "equipment",
  "human_verdict": "justified",
  "human_verdict_reason": "Equipment purchase in Phase 1 is explicitly allowed.",
  "is_ambiguous": false,
  "notes": ""
}
```

---

## The Three Policy Variants

All three are loaded by `lib/policy.js` using `loadPolicy('clear' | 'vague' | 'contradictory')`.

**Clear policy** — 3 phases with explicit per-phase allowed/restricted/forbidden lists:
- Phase 0 (Infrastructure Setup): allows equipment, software, cloud API credits
- Phase 1 (Experimentation): allows API credits, data annotation tools, team meals
- Phase 2 (Evaluation & Documentation): allows printing, library access; forbids new hardware, travel

**Vague policy** — same 3 phases but generic language: "work-related expenses", "reasonable expenses", "obvious personal expenses" — no specific categories named.

**Contradictory policy** — internal contradictions: Phase 0 lists "equipment" in both allowed AND forbidden; Phase 1 lists "travel" in both allowed AND forbidden.

---

## Policy Loader API (already implemented in lib/policy.js)

```javascript
import { loadPolicy, policyAsText, listPolicies, listPhases } from './lib/policy.js';

const policy = loadPolicy('clear');         // returns full policy JSON object
const text = policyAsText(policy, 1);       // returns formatted string for LLM, phase index 1
const names = listPolicies();               // ['clear', 'vague', 'contradictory']
const phases = listPhases('clear');         // [{index: 0, name: "Phase 1..."}, ...]
```

`policyAsText(policy, phaseIndex)` returns a string like:
```
Project: AI Receipt Audit System — R&D Project
Description: An R&D project developing an AI-powered system...
Current Phase: Phase 2: Experimentation
Phase Description: Running AI model experiments...
Allowed expenses: API credits (LLM calls), data annotation tools, compute services...
Restricted (need justification): equipment (only if existing equipment fails), software (project-use only)
Forbidden: personal items, entertainment, non-technical subscriptions
```

---

## OpenRouter API

Base URL: `https://openrouter.ai/api/v1/chat/completions`

Required headers:
```
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json
HTTP-Referer: http://localhost:3000
X-Title: Policy Semantic Audit
```

Standard request body:
```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [{"role": "user", "content": "..."}]
}
```

For vision (image input), `content` is an array:
```json
[
  {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<BASE64>"}},
  {"type": "text", "text": "Extract the fields..."}
]
```

Response: `data.choices[0].message.content` (string).

**Important:** Models frequently wrap JSON in markdown fences (` ```json ... ``` `). The `extractJson()` function in `lib/openrouter.js` handles this — always use it, never use `JSON.parse()` directly on model output.

---

## Pipeline Flow (3 layers)

1. **Layer 1 (OCR):** Frontend sends `{base64, mimeType, apiKey, model}` → `POST /api/extract` → calls OpenRouter vision model → returns `{extraction: {...}}`

2. **Layer 2 (Policy grounding):** Server loads policy JSON using `loadPolicy(name)`, serializes it via `policyAsText(policy, phaseIndex)`, injects into prompt.

3. **Layer 3 (Reasoning):** Server sends policy text + extraction fields to text model → returns `{verdict, reason}` or `{verdict, reason, reasoning}` (if CoT).

---

## Existing server.js Structure

The file already has:
- `loadConfig()` / `saveConfig()` functions
- `GET /api/settings` and `POST /api/settings` routes
- `GET /api/health` route
- `multer` configured as `upload` (available for file upload routes if needed)
- Static file serving from `./public/`

Import the following at the top of `server.js` to add experiment routes (Tasks 5-7 will do this):
```javascript
import { callText, callVision, extractJson, normalizeAmount } from './lib/openrouter.js';
import { loadPolicy, policyAsText } from './lib/policy.js';
import { PROMPTS, fillPrompt } from './lib/prompts.js';
```
