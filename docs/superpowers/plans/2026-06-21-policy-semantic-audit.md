# AI-Driven Policy Semantic Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js web application with 6 interactive experiment tabs where a user uploads a receipt, runs it through LLM-powered policy audit, and sees the result — plus a paper draft documenting findings.

**Architecture:** Express.js serves a single-page app. Each experiment tab has a file upload form and results panel. All LLM calls go through OpenRouter. The model is configurable in the Settings tab. No build step — vanilla JS + Tailwind CDN.

**Tech Stack:** Node.js 18+, Express 4, Multer (file upload), OpenRouter API (fetch), Tailwind CSS (CDN), vanilla JS

## Global Constraints

- All LLM calls use OpenRouter API only — no separate Google/Gemini API key
- `OPENROUTER_API_KEY` stored in `.env` — never hardcoded
- Default vision model: `google/gemini-2.5-flash` (via OpenRouter)
- Default reasoning model: `google/gemini-2.5-flash` (same model, configurable)
- Model ID is stored in `config.json` and editable in Settings tab
- Receipt files in `CASH_RECIEPTS/` — never moved or renamed
- Policy files in `data/policy/` as JSON
- All API routes under `/api/`
- Frontend is `public/index.html` + `public/app.js` + `public/style.css`
- Server starts on port 3000 (configurable via `PORT` env var)
- Uploaded files are handled in-memory (multer memoryStorage) — not saved to disk

---

## File Map

```
RND1/
├── server.js                    # Express app, all routes
├── package.json
├── .env.example
├── config.json                  # { "model": "google/gemini-2.5-flash" }
├── lib/
│   ├── openrouter.js            # OpenRouter fetch wrapper
│   ├── policy.js                # Load and format policy files
│   └── prompts.js               # All prompt templates as named exports
├── data/
│   ├── policy/
│   │   ├── policy_clear.json
│   │   ├── policy_vague.json
│   │   └── policy_contradictory.json
│   └── annotations/
│       └── ground_truth.json    # Filled manually after running experiments
├── public/
│   ├── index.html               # Single-page app shell + all 6 experiment tabs
│   ├── app.js                   # Tab switching, form handling, results rendering
│   └── style.css                # Custom styles (Tailwind handles most)
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `config.json`
- Create: `server.js` (scaffold — routes added in later tasks)

**Interfaces:**
- Produces: `app` — Express app instance exported from `server.js`
- Produces: running server at `http://localhost:3000` serving `public/`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Volumes/extdisk/WORK/RND2026/RND1
git init
echo "node_modules/\n.env\n*.log" > .gitignore
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "policy-semantic-audit",
  "version": "1.0.0",
  "description": "AI-Driven Policy Semantic Audit — R&D Research Platform",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create .env.example**

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
PORT=3000
```

- [ ] **Step 5: Create config.json**

```json
{
  "model": "google/gemini-2.5-flash",
  "visionModel": "google/gemini-2.5-flash"
}
```

- [ ] **Step 6: Create server.js scaffold**

```javascript
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function loadConfig() {
  return JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(join(__dirname, 'config.json'), JSON.stringify(cfg, null, 2));
}

// Settings routes
app.get('/api/settings', (req, res) => {
  res.json(loadConfig());
});

app.post('/api/settings', (req, res) => {
  const cfg = loadConfig();
  Object.assign(cfg, req.body);
  saveConfig(cfg);
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Placeholder — routes added in Tasks 3–8
// TODO: import and mount experiment routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

export { app, upload, loadConfig };
```

Update `package.json` to add `"type": "module"` so ES module imports work:

```json
{
  "name": "policy-semantic-audit",
  "version": "1.0.0",
  "description": "AI-Driven Policy Semantic Audit — R&D Research Platform",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 7: Create empty public directory and placeholder index.html**

```bash
mkdir -p public
```

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Policy Semantic Audit</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900">
  <h1 class="text-2xl font-bold p-8">Policy Semantic Audit — Loading...</h1>
</body>
</html>
```

- [ ] **Step 8: Verify server starts**

```bash
node server.js
```

Expected output: `Server running at http://localhost:3000`

Open `http://localhost:3000` in browser — should show "Loading..." page.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: project setup — Express server scaffold"
```

---

## Task 2: Policy Data + lib/policy.js

**Files:**
- Create: `data/policy/policy_clear.json`
- Create: `data/policy/policy_vague.json`
- Create: `data/policy/policy_contradictory.json`
- Create: `lib/policy.js`

**Interfaces:**
- Produces: `loadPolicy(name)` → `{policy_name, project_name, description, phases}`
- Produces: `policyAsText(policy, phaseIndex)` → string
- Produces: `listPolicies()` → `["clear", "vague", "contradictory"]`

- [ ] **Step 1: Create data/policy/policy_clear.json**

```bash
mkdir -p data/policy
```

```json
{
  "policy_name": "clear",
  "project_name": "AI Receipt Audit System — R&D Project",
  "description": "An R&D project developing an AI-powered system to audit expense receipts for semantic policy compliance. The project has three sequential phases.",
  "phases": [
    {
      "name": "Phase 1: Infrastructure Setup",
      "description": "Setting up development environment, cloud accounts, APIs, hardware, and tooling.",
      "allowed": ["computer equipment", "software licenses", "cloud API credits", "office supplies", "technical books"],
      "restricted": ["team meals (max 2 per month)", "travel within city (max 3 per month)"],
      "forbidden": ["personal items", "entertainment", "non-project subscriptions", "travel abroad"]
    },
    {
      "name": "Phase 2: Experimentation",
      "description": "Running AI model experiments, data collection, annotation, and iterative development.",
      "allowed": ["API credits (LLM calls)", "data annotation tools", "compute services", "technical conferences (1 max)", "team collaboration meals"],
      "restricted": ["equipment (only if existing equipment fails)", "software (project-use only)"],
      "forbidden": ["personal items", "entertainment", "non-technical subscriptions"]
    },
    {
      "name": "Phase 3: Evaluation & Documentation",
      "description": "Final testing, writing the research paper, and preparing deliverables.",
      "allowed": ["printing and binding", "library access", "academic journal access", "small team celebration meal"],
      "restricted": ["API credits (limited budget)", "software (documentation tools only)"],
      "forbidden": ["new hardware", "travel", "entertainment", "non-documentation expenses"]
    }
  ]
}
```

- [ ] **Step 2: Create data/policy/policy_vague.json**

```json
{
  "policy_name": "vague",
  "project_name": "AI Receipt Audit System — R&D Project",
  "description": "An R&D project involving AI and data work.",
  "phases": [
    {
      "name": "Phase 1",
      "description": "Early stage work.",
      "allowed": ["work-related expenses", "necessary tools"],
      "restricted": ["excessive personal spending"],
      "forbidden": ["clearly non-work items"]
    },
    {
      "name": "Phase 2",
      "description": "Main development phase.",
      "allowed": ["things needed for the project", "reasonable expenses"],
      "restricted": ["borderline cases should be discussed"],
      "forbidden": ["obvious personal expenses"]
    },
    {
      "name": "Phase 3",
      "description": "Finishing up.",
      "allowed": ["wrap-up related expenses"],
      "restricted": ["new purchases should be minimal"],
      "forbidden": ["unnecessary spending"]
    }
  ]
}
```

- [ ] **Step 3: Create data/policy/policy_contradictory.json**

```json
{
  "policy_name": "contradictory",
  "project_name": "AI Receipt Audit System — R&D Project",
  "description": "An R&D project developing AI tools. All necessary expenses are pre-approved. Budget is strictly controlled and all purchases require approval.",
  "phases": [
    {
      "name": "Phase 1: Setup",
      "description": "Setup phase. No hardware purchases needed as all equipment is provided. Engineers should purchase any equipment they need for development.",
      "allowed": ["software licenses", "equipment", "all technical expenses"],
      "restricted": ["equipment over 500 EUR requires approval", "software must be open-source"],
      "forbidden": ["proprietary software", "hardware"]
    },
    {
      "name": "Phase 2: Development",
      "description": "Development phase. Remote work is encouraged. Team must be on-site for collaboration.",
      "allowed": ["travel", "remote work tools", "office expenses", "API credits"],
      "restricted": ["travel requires pre-approval", "no travel budget available"],
      "forbidden": ["travel", "remote work subscriptions"]
    },
    {
      "name": "Phase 3: Completion",
      "description": "Final phase with flexible budget. All spending is frozen pending final budget review.",
      "allowed": ["any completion-related expense", "celebration"],
      "restricted": ["all new expenses require written approval"],
      "forbidden": ["any new expenses without approval"]
    }
  ]
}
```

- [ ] **Step 4: Create lib/policy.js**

```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICY_DIR = join(__dirname, '..', 'data', 'policy');

export function loadPolicy(name) {
  const valid = ['clear', 'vague', 'contradictory'];
  if (!valid.includes(name)) throw new Error(`Unknown policy: ${name}`);
  return JSON.parse(readFileSync(join(POLICY_DIR, `policy_${name}.json`), 'utf8'));
}

export function policyAsText(policy, phaseIndex) {
  const phase = policy.phases[phaseIndex];
  return [
    `Project: ${policy.project_name}`,
    `Description: ${policy.description}`,
    `Current Phase: ${phase.name}`,
    `Phase Description: ${phase.description}`,
    `Allowed expenses: ${phase.allowed.join(', ')}`,
    `Restricted (need justification): ${phase.restricted.join(', ')}`,
    `Forbidden: ${phase.forbidden.join(', ')}`,
  ].join('\n');
}

export function listPolicies() {
  return ['clear', 'vague', 'contradictory'];
}

export function listPhases(policyName) {
  return loadPolicy(policyName).phases.map((p, i) => ({ index: i, name: p.name }));
}
```

- [ ] **Step 5: Verify policy loading**

```bash
node -e "
import('./lib/policy.js').then(({ loadPolicy, policyAsText, listPhases }) => {
  const p = loadPolicy('clear');
  console.log('Phases:', listPhases('clear').map(ph => ph.name));
  console.log(policyAsText(p, 1).substring(0, 200));
});
"
```

Expected: 3 phase names printed, policy text shows Phase 2 content.

- [ ] **Step 6: Commit**

```bash
git add data/ lib/policy.js
git commit -m "feat: policy data files and loader"
```

---

## Task 3: OpenRouter Client + Prompts

**Files:**
- Create: `lib/openrouter.js`
- Create: `lib/prompts.js`

**Interfaces:**
- Produces: `callText(messages, model, apiKey)` → `string` (model response text)
- Produces: `callVision(imageBase64, mimeType, textPrompt, model, apiKey)` → `string`
- Produces: `PROMPTS.extraction` — string template
- Produces: `PROMPTS.verdictNoCot` — string template with `{policy_text}`, `{vendor}`, `{date}`, `{amount}`, `{currency}`, `{category}`, `{line_items}`
- Produces: `PROMPTS.verdictCot` — same placeholders, adds step-by-step instruction
- Produces: `PROMPTS.adversarial` — same placeholders, adds policy clarity field

- [ ] **Step 1: Create lib/openrouter.js**

```javascript
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

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

export function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}
```

- [ ] **Step 2: Create lib/prompts.js**

```javascript
export const PROMPTS = {
  extraction: `Extract the following fields from this receipt image. Return ONLY valid JSON with no markdown fences.

{
  "vendor": "string or null",
  "date": "YYYY-MM-DD or null",
  "amount": number or null,
  "currency": "ISO 4217 code or null",
  "line_items": ["item description 1", "item description 2"],
  "category": "one of: equipment, software, travel, food, services, other"
}

If a field is not visible or unreadable, use null.`,

  verdictNoCot: `You are an expense auditor.

PROJECT POLICY:
{policy_text}

EXPENSE:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

Is this expense justified under the project policy?
Answer with ONLY a JSON object, no markdown:
{"verdict": "justified or suspicious or unclear", "reason": "one sentence"}`,

  verdictCot: `You are an expense auditor. Think step by step before giving a verdict.

PROJECT POLICY:
{policy_text}

EXPENSE:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

Think step by step:
1. What type of expense is this?
2. Does the project policy allow this category in the current phase?
3. Is the amount reasonable for this type of expense?
4. Are there any red flags or ambiguities?

Answer with ONLY a JSON object, no markdown:
{"reasoning": "your step-by-step analysis", "verdict": "justified or suspicious or unclear", "reason": "one sentence summary"}`,

  adversarial: `You are an expense auditor. Think step by step.

PROJECT POLICY:
{policy_text}

EXPENSE:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}

If the policy is unclear or contradictory, explicitly state that in your reasoning.
Answer with ONLY a JSON object, no markdown:
{"reasoning": "analysis", "verdict": "justified or suspicious or unclear", "reason": "one sentence", "policy_clarity": "clear or vague or contradictory"}`,
};

export function fillPrompt(template, vars) {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, v ?? 'unknown'),
    template
  );
}
```

- [ ] **Step 3: Verify OpenRouter client (requires real API key)**

Create a `.env` file with your real `OPENROUTER_API_KEY`, then:

```bash
node -e "
import { config } from 'dotenv';
config();
import('./lib/openrouter.js').then(async ({ callText }) => {
  const result = await callText(
    [{ role: 'user', content: 'Say hello in one word.' }],
    'google/gemini-2.5-flash',
    process.env.OPENROUTER_API_KEY
  );
  console.log('Response:', result);
});
"
```

Expected: a single-word greeting from the model.

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: OpenRouter client and prompt templates"
```

---

## Task 4: Frontend Shell + Settings Tab

**Files:**
- Create: `public/index.html` (full version)
- Create: `public/app.js`
- Create: `public/style.css`

**Interfaces:**
- Produces: tab navigation (E1–E6 + Settings), tab switching in JS
- Produces: `window.APP.getSettings()` → `{model, visionModel, apiKey}`
- Produces: `window.APP.uploadAndRead(fileInput)` → `{base64, mimeType, filename}`
- Produces: `window.APP.showResult(containerId, html)` — renders result HTML
- Produces: `window.APP.showError(containerId, message)`
- Produces: `window.APP.setLoading(buttonEl, isLoading)`

- [ ] **Step 1: Create public/style.css**

```css
.tab-btn.active { @apply border-b-2 border-blue-600 text-blue-600 font-semibold; }
.verdict-justified { @apply bg-green-100 border border-green-400 text-green-800; }
.verdict-suspicious { @apply bg-red-100 border border-red-400 text-red-800; }
.verdict-unclear { @apply bg-yellow-100 border border-yellow-400 text-yellow-800; }
.verdict-error { @apply bg-gray-100 border border-gray-400 text-gray-600; }
```

- [ ] **Step 2: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Policy Semantic Audit</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gray-50 min-h-screen">

  <!-- Header -->
  <header class="bg-white border-b border-gray-200 px-6 py-4">
    <h1 class="text-xl font-bold text-gray-900">Policy Semantic Audit</h1>
    <p class="text-sm text-gray-500 mt-0.5">AI-driven expense justification research platform</p>
  </header>

  <!-- Tab Navigation -->
  <nav class="bg-white border-b border-gray-200 px-6 flex gap-0 overflow-x-auto">
    <button class="tab-btn active px-4 py-3 text-sm whitespace-nowrap" data-tab="e1">E1: OCR Extraction</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e2">E2: No-CoT Verdict</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e3">E3: CoT Reasoning</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e4">E4: Phase Sensitivity</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e5">E5: Ambiguity</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e6">E6: Adversarial</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap ml-auto" data-tab="settings">⚙ Settings</button>
  </nav>

  <!-- Tab Content -->
  <main class="max-w-4xl mx-auto px-6 py-8">

    <!-- E1: OCR Extraction -->
    <div id="tab-e1" class="tab-panel">
      <h2 class="text-lg font-semibold mb-1">E1: OCR Extraction Baseline</h2>
      <p class="text-sm text-gray-500 mb-6">Upload a receipt — the model extracts structured fields (vendor, date, amount, currency, category).</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <label class="block text-sm font-medium mb-2">Receipt file (JPG, PNG, PDF)</label>
        <input type="file" id="e1-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2 mb-4">
        <button id="e1-btn" onclick="runE1()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Extract Fields
        </button>
      </div>
      <div id="e1-result" class="mt-4"></div>
    </div>

    <!-- E2: No-CoT Verdict -->
    <div id="tab-e2" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E2: Zero-shot Verdict (No Chain-of-Thought)</h2>
      <p class="text-sm text-gray-500 mb-6">Upload a receipt, select a policy and phase — model gives a verdict without step-by-step reasoning.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Receipt file</label>
          <input type="file" id="e2-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Policy variant</label>
            <select id="e2-policy" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
              <option value="clear">Clear policy</option>
              <option value="vague">Vague policy</option>
              <option value="contradictory">Contradictory policy</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Project phase</label>
            <select id="e2-phase" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
              <option value="0">Phase 1: Infrastructure Setup</option>
              <option value="1" selected>Phase 2: Experimentation</option>
              <option value="2">Phase 3: Evaluation & Documentation</option>
            </select>
          </div>
        </div>
        <button id="e2-btn" onclick="runE2()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Get Verdict
        </button>
      </div>
      <div id="e2-result" class="mt-4"></div>
    </div>

    <!-- E3: CoT Reasoning -->
    <div id="tab-e3" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E3: Zero-shot CoT Reasoning</h2>
      <p class="text-sm text-gray-500 mb-6">Same as E2, but the model thinks step by step before giving a verdict.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Receipt file</label>
          <input type="file" id="e3-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Policy variant</label>
            <select id="e3-policy" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
              <option value="clear">Clear policy</option>
              <option value="vague">Vague policy</option>
              <option value="contradictory">Contradictory policy</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Project phase</label>
            <select id="e3-phase" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
              <option value="0">Phase 1: Infrastructure Setup</option>
              <option value="1" selected>Phase 2: Experimentation</option>
              <option value="2">Phase 3: Evaluation & Documentation</option>
            </select>
          </div>
        </div>
        <button id="e3-btn" onclick="runE3()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Reason & Verdict
        </button>
      </div>
      <div id="e3-result" class="mt-4"></div>
    </div>

    <!-- E4: Phase Sensitivity -->
    <div id="tab-e4" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E4: Phase-Sensitive Reasoning</h2>
      <p class="text-sm text-gray-500 mb-6">Upload a receipt — see how the verdict changes across all 3 project phases.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Receipt file</label>
          <input type="file" id="e4-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Policy variant</label>
          <select id="e4-policy" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="clear">Clear policy</option>
            <option value="vague">Vague policy</option>
            <option value="contradictory">Contradictory policy</option>
          </select>
        </div>
        <button id="e4-btn" onclick="runE4()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Test All Phases
        </button>
      </div>
      <div id="e4-result" class="mt-4"></div>
    </div>

    <!-- E5: Ambiguity -->
    <div id="tab-e5" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E5: Ambiguity & Uncertainty Handling</h2>
      <p class="text-sm text-gray-500 mb-6">Upload an ambiguous receipt — see if the model expresses uncertainty or forces a verdict.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Receipt file</label>
          <input type="file" id="e5-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Policy variant</label>
            <select id="e5-policy" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
              <option value="clear">Clear policy</option>
              <option value="vague">Vague policy</option>
              <option value="contradictory">Contradictory policy</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Project phase</label>
            <select id="e5-phase" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
              <option value="0">Phase 1: Infrastructure Setup</option>
              <option value="1" selected>Phase 2: Experimentation</option>
              <option value="2">Phase 3: Evaluation & Documentation</option>
            </select>
          </div>
        </div>
        <button id="e5-btn" onclick="runE5()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Analyse Ambiguity
        </button>
      </div>
      <div id="e5-result" class="mt-4"></div>
    </div>

    <!-- E6: Adversarial -->
    <div id="tab-e6" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E6: Adversarial Policy Stress Test</h2>
      <p class="text-sm text-gray-500 mb-6">Upload a receipt — see verdicts under all 3 policy variants. Watch for hallucinations on vague/contradictory policies.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Receipt file</label>
          <input type="file" id="e6-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Project phase</label>
          <select id="e6-phase" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="0">Phase 1: Infrastructure Setup</option>
            <option value="1" selected>Phase 2: Experimentation</option>
            <option value="2">Phase 3: Evaluation & Documentation</option>
          </select>
        </div>
        <button id="e6-btn" onclick="runE6()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Test All Policies
        </button>
      </div>
      <div id="e6-result" class="mt-4"></div>
    </div>

    <!-- Settings -->
    <div id="tab-settings" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">Settings</h2>
      <p class="text-sm text-gray-500 mb-6">Configure the model and API key used for all experiments.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4 max-w-lg">
        <div>
          <label class="block text-sm font-medium mb-1">OpenRouter API Key</label>
          <input type="password" id="s-apikey" placeholder="sk-or-..." class="block w-full text-sm border border-gray-300 rounded px-3 py-2 font-mono">
          <p class="text-xs text-gray-400 mt-1">Stored in memory only — not persisted to disk. Re-enter on each server restart.</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Model</label>
          <select id="s-model" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (recommended)</option>
            <option value="qwen/qwen2.5-72b-instruct">qwen/qwen2.5-72b-instruct</option>
            <option value="mistralai/mixtral-8x7b-instruct">mistralai/mixtral-8x7b-instruct</option>
            <option value="anthropic/claude-sonnet-4-5">anthropic/claude-sonnet-4-5</option>
          </select>
          <p class="text-xs text-gray-400 mt-1">Used for text reasoning. Vision model always uses a multimodal model.</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Vision Model (for OCR)</label>
          <select id="s-vision-model" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (recommended)</option>
            <option value="qwen/qwen2.5-vl-72b-instruct">qwen/qwen2.5-vl-72b-instruct</option>
            <option value="anthropic/claude-sonnet-4-5">anthropic/claude-sonnet-4-5</option>
          </select>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="saveSettings()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Save Settings</button>
          <button onclick="testConnection()" class="border border-gray-300 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50">Test Connection</button>
        </div>
        <div id="settings-result" class="mt-2"></div>
      </div>
    </div>

  </main>

  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create public/app.js**

```javascript
// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

// In-memory API key (not persisted to disk)
let _apiKey = '';

async function loadSettings() {
  const res = await fetch('/api/settings');
  const cfg = await res.json();
  document.getElementById('s-model').value = cfg.model || 'google/gemini-2.5-flash';
  document.getElementById('s-vision-model').value = cfg.visionModel || 'google/gemini-2.5-flash';
}

function getSettings() {
  return {
    model: document.getElementById('s-model').value,
    visionModel: document.getElementById('s-vision-model').value,
    apiKey: document.getElementById('s-apikey').value || _apiKey,
  };
}

async function saveSettings() {
  const { model, visionModel, apiKey } = getSettings();
  _apiKey = apiKey;
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, visionModel }),
  });
  showResult('settings-result', '<p class="text-green-600 text-sm">✓ Settings saved</p>');
}

async function testConnection() {
  const { apiKey, model } = getSettings();
  if (!apiKey) return showError('settings-result', 'Enter your API key first.');
  showResult('settings-result', '<p class="text-gray-500 text-sm">Testing...</p>');
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    });
    const data = await res.json();
    if (data.ok) showResult('settings-result', '<p class="text-green-600 text-sm">✓ Connection successful</p>');
    else showError('settings-result', data.error);
  } catch (e) {
    showError('settings-result', e.message);
  }
}

function showResult(containerId, html) {
  document.getElementById(containerId).innerHTML = html;
}

function showError(containerId, message) {
  document.getElementById(containerId).innerHTML =
    `<div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">${message}</div>`;
}

function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Running...' : btn.dataset.label || btn.textContent;
}

function verdictClass(verdict) {
  if (verdict === 'justified') return 'verdict-justified';
  if (verdict === 'suspicious') return 'verdict-suspicious';
  if (verdict === 'unclear') return 'verdict-unclear';
  return 'verdict-error';
}

function verdictBadge(verdict) {
  const cls = verdictClass(verdict);
  return `<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}">${verdict}</span>`;
}

async function getFileData(inputId) {
  const input = document.getElementById(inputId);
  if (!input.files[0]) throw new Error('Please select a file first.');
  const file = input.files[0];
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64, mimeType: file.type || 'image/jpeg', filename: file.name };
}

// E1: OCR Extraction
async function runE1() {
  setLoading('e1-btn', true);
  showResult('e1-result', '');
  try {
    const { base64, mimeType, filename } = await getFileData('e1-file');
    const { apiKey, visionModel } = getSettings();
    if (!apiKey) { showError('e1-result', 'Enter API key in Settings first.'); return; }
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, filename, apiKey, model: visionModel }),
    });
    const data = await res.json();
    if (data.error) return showError('e1-result', data.error);
    const f = data.extraction;
    showResult('e1-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="font-medium mb-3">Extracted Fields</h3>
        <table class="w-full text-sm">
          <tbody>
            ${['vendor','date','amount','currency','category'].map(k =>
              `<tr class="border-b border-gray-100 last:border-0">
                <td class="py-2 pr-4 text-gray-500 w-28 capitalize">${k}</td>
                <td class="py-2 font-mono">${f[k] ?? '<span class="text-gray-400">null</span>'}</td>
              </tr>`).join('')}
            <tr>
              <td class="py-2 pr-4 text-gray-500 align-top">items</td>
              <td class="py-2 font-mono">${(f.line_items || []).join(', ') || '<span class="text-gray-400">none</span>'}</td>
            </tr>
          </tbody>
        </table>
      </div>`);
  } catch (e) {
    showError('e1-result', e.message);
  } finally {
    setLoading('e1-btn', false);
  }
}

// E2: No-CoT Verdict
async function runE2() {
  setLoading('e2-btn', true);
  showResult('e2-result', '');
  try {
    const { base64, mimeType, filename } = await getFileData('e2-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e2-result', 'Enter API key in Settings first.'); return; }
    const policy = document.getElementById('e2-policy').value;
    const phase = parseInt(document.getElementById('e2-phase').value);
    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, filename, apiKey, model, visionModel, policy, phase, useCot: false }),
    });
    const data = await res.json();
    if (data.error) return showError('e2-result', data.error);
    showResult('e2-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">${verdictBadge(data.verdict)}<span class="text-sm text-gray-600">${data.reason}</span></div>
      </div>`);
  } catch (e) {
    showError('e2-result', e.message);
  } finally {
    setLoading('e2-btn', false);
  }
}

// E3: CoT Reasoning
async function runE3() {
  setLoading('e3-btn', true);
  showResult('e3-result', '');
  try {
    const { base64, mimeType, filename } = await getFileData('e3-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e3-result', 'Enter API key in Settings first.'); return; }
    const policy = document.getElementById('e3-policy').value;
    const phase = parseInt(document.getElementById('e3-phase').value);
    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, filename, apiKey, model, visionModel, policy, phase, useCot: true }),
    });
    const data = await res.json();
    if (data.error) return showError('e3-result', data.error);
    showResult('e3-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">${verdictBadge(data.verdict)}<span class="text-sm text-gray-600">${data.reason}</span></div>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700">Show reasoning</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap">${data.reasoning}</div>
          </details>` : ''}
      </div>`);
  } catch (e) {
    showError('e3-result', e.message);
  } finally {
    setLoading('e3-btn', false);
  }
}

// E4: Phase Sensitivity
async function runE4() {
  setLoading('e4-btn', true);
  showResult('e4-result', '');
  try {
    const { base64, mimeType, filename } = await getFileData('e4-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e4-result', 'Enter API key in Settings first.'); return; }
    const policy = document.getElementById('e4-policy').value;
    const res = await fetch('/api/phase-sensitivity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, filename, apiKey, model, visionModel, policy }),
    });
    const data = await res.json();
    if (data.error) return showError('e4-result', data.error);
    const phases = data.phases;
    showResult('e4-result', `
      <div class="grid grid-cols-3 gap-4">
        ${phases.map(p => `
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-xs font-semibold text-gray-500 mb-2 uppercase">${p.phase}</div>
            ${verdictBadge(p.verdict)}
            <p class="text-sm text-gray-600 mt-2">${p.reason}</p>
          </div>`).join('')}
      </div>`);
  } catch (e) {
    showError('e4-result', e.message);
  } finally {
    setLoading('e4-btn', false);
  }
}

// E5: Ambiguity
async function runE5() {
  setLoading('e5-btn', true);
  showResult('e5-result', '');
  try {
    const { base64, mimeType, filename } = await getFileData('e5-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e5-result', 'Enter API key in Settings first.'); return; }
    const policy = document.getElementById('e5-policy').value;
    const phase = parseInt(document.getElementById('e5-phase').value);
    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, filename, apiKey, model, visionModel, policy, phase, useCot: true }),
    });
    const data = await res.json();
    if (data.error) return showError('e5-result', data.error);
    const confidenceColor = { high: 'text-green-600', medium: 'text-yellow-600', low: 'text-red-600' }[data.confidence] || 'text-gray-600';
    showResult('e5-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">
          ${verdictBadge(data.verdict)}
          ${data.confidence ? `<span class="text-sm ${confidenceColor} font-medium">Confidence: ${data.confidence}</span>` : ''}
        </div>
        <p class="text-sm text-gray-600">${data.reason}</p>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700">Show reasoning</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap">${data.reasoning}</div>
          </details>` : ''}
      </div>`);
  } catch (e) {
    showError('e5-result', e.message);
  } finally {
    setLoading('e5-btn', false);
  }
}

// E6: Adversarial
async function runE6() {
  setLoading('e6-btn', true);
  showResult('e6-result', '');
  try {
    const { base64, mimeType, filename } = await getFileData('e6-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e6-result', 'Enter API key in Settings first.'); return; }
    const phase = parseInt(document.getElementById('e6-phase').value);
    const res = await fetch('/api/adversarial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, filename, apiKey, model, visionModel, phase }),
    });
    const data = await res.json();
    if (data.error) return showError('e6-result', data.error);
    showResult('e6-result', `
      <div class="grid grid-cols-3 gap-4">
        ${data.policies.map(p => `
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-xs font-semibold text-gray-500 mb-2 uppercase">${p.policy} policy</div>
            ${verdictBadge(p.verdict)}
            ${p.hallucination ? '<span class="ml-2 text-xs bg-orange-100 text-orange-700 border border-orange-300 px-1.5 py-0.5 rounded">⚠ possible hallucination</span>' : ''}
            <p class="text-sm text-gray-600 mt-2">${p.reason}</p>
            ${p.policy_clarity ? `<p class="text-xs text-gray-400 mt-1">Model assessed policy as: ${p.policy_clarity}</p>` : ''}
          </div>`).join('')}
      </div>`);
  } catch (e) {
    showError('e6-result', e.message);
  } finally {
    setLoading('e6-btn', false);
  }
}

// Init
loadSettings();
```

- [ ] **Step 4: Verify frontend renders**

Start server and open browser:

```bash
node server.js
```

Open `http://localhost:3000`. Expected: tab navigation visible, all 6 experiment tabs + Settings tab clickable, tabs switch correctly.

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "feat: frontend shell — all 6 experiment tabs + settings UI"
```

---

## Task 5: Backend API Routes — E1, E2/E3

**Files:**
- Modify: `server.js` (add routes `/api/extract`, `/api/verdict`, `/api/test-connection`)

**Interfaces:**
- Consumes: `callVision`, `callText`, `extractJson` from `lib/openrouter.js`
- Consumes: `loadPolicy`, `policyAsText` from `lib/policy.js`
- Consumes: `PROMPTS`, `fillPrompt` from `lib/prompts.js`
- `POST /api/extract` body: `{base64, mimeType, filename, apiKey, model}` → `{extraction: {...}}`
- `POST /api/verdict` body: `{base64, mimeType, filename, apiKey, model, visionModel, policy, phase, useCot}` → `{verdict, reason, reasoning?}`
- `POST /api/test-connection` body: `{apiKey, model}` → `{ok: true}` or `{error}`

- [ ] **Step 1: Add routes to server.js**

Replace the `// Placeholder — routes added in Tasks 3–8` comment in `server.js` with:

```javascript
import { callText, callVision, extractJson } from './lib/openrouter.js';
import { loadPolicy, policyAsText } from './lib/policy.js';
import { PROMPTS, fillPrompt } from './lib/prompts.js';
```

Add at the bottom of `server.js`, before `app.listen`:

```javascript
// Test connection
app.post('/api/test-connection', async (req, res) => {
  const { apiKey, model } = req.body;
  try {
    const result = await callText(
      [{ role: 'user', content: 'Reply with the single word: OK' }],
      model,
      apiKey
    );
    res.json({ ok: true, response: result.trim() });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// E1: OCR Extraction
app.post('/api/extract', async (req, res) => {
  const { base64, mimeType, apiKey, model } = req.body;
  try {
    const raw = await callVision(base64, mimeType, PROMPTS.extraction, model, apiKey);
    const extraction = extractJson(raw);
    res.json({ extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// E2 + E3: Verdict (no-CoT and CoT)
app.post('/api/verdict', async (req, res) => {
  const { base64, mimeType, apiKey, model, visionModel, policy: policyName, phase, useCot } = req.body;
  try {
    // Step 1: extract fields from receipt
    const rawExtract = await callVision(base64, mimeType, PROMPTS.extraction, visionModel, apiKey);
    const extraction = extractJson(rawExtract);

    // Step 2: build policy context
    const policy = loadPolicy(policyName);
    const policyText = policyAsText(policy, phase);

    // Step 3: verdict prompt
    const prompt = fillPrompt(useCot ? PROMPTS.verdictCot : PROMPTS.verdictNoCot, {
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

- [ ] **Step 2: Test E1 route manually**

With server running, open Settings tab, enter API key, save. Upload a receipt in E1 tab, click Extract Fields.

Expected: table showing vendor, date, amount, currency, category fields.

- [ ] **Step 3: Test E2 route**

In E2 tab, upload same receipt, select "Clear policy", Phase 2, click Get Verdict.

Expected: verdict badge (justified/suspicious/unclear) with one-sentence reason.

- [ ] **Step 4: Test E3 route**

In E3 tab, same receipt, click Reason & Verdict.

Expected: same as E2 but with "Show reasoning" expandable section.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: API routes for E1 OCR extraction and E2/E3 verdict"
```

---

## Task 6: Backend Routes — E4, E5, E6

**Files:**
- Modify: `server.js` (add routes `/api/phase-sensitivity`, `/api/adversarial`)

**Interfaces:**
- `POST /api/phase-sensitivity` body: `{base64, mimeType, apiKey, model, visionModel, policy}` → `{phases: [{phase, verdict, reason, reasoning}]}`
- `POST /api/adversarial` body: `{base64, mimeType, apiKey, model, visionModel, phase}` → `{policies: [{policy, verdict, reason, reasoning, policy_clarity, hallucination}]}`
- Note: E5 reuses `/api/verdict` route — no new route needed

- [ ] **Step 1: Add phase-sensitivity and adversarial routes to server.js**

Add before `app.listen`:

```javascript
// E4: Phase Sensitivity
app.post('/api/phase-sensitivity', async (req, res) => {
  const { base64, mimeType, apiKey, model, visionModel, policy: policyName } = req.body;
  try {
    const rawExtract = await callVision(base64, mimeType, PROMPTS.extraction, visionModel, apiKey);
    const extraction = extractJson(rawExtract);
    const policy = loadPolicy(policyName);

    const phases = await Promise.all(
      policy.phases.map(async (phase, i) => {
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
        return { phase: phase.name, ...result };
      })
    );

    res.json({ phases, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// E6: Adversarial Policy Stress Test
app.post('/api/adversarial', async (req, res) => {
  const { base64, mimeType, apiKey, model, visionModel, phase } = req.body;
  try {
    const rawExtract = await callVision(base64, mimeType, PROMPTS.extraction, visionModel, apiKey);
    const extraction = extractJson(rawExtract);

    const policyNames = ['clear', 'vague', 'contradictory'];
    const policies = await Promise.all(
      policyNames.map(async (policyName) => {
        const policy = loadPolicy(policyName);
        const policyText = policyAsText(policy, phase);
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
        // Flag hallucination: model says "clear" policy despite input being vague/contradictory
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

- [ ] **Step 2: Test E4 — phase sensitivity**

Upload any equipment/hardware receipt in E4 tab, select "Clear policy", click Test All Phases.

Expected: 3 columns showing Phase 1 (likely justified), Phase 2 (maybe restricted), Phase 3 (likely suspicious or forbidden).

- [ ] **Step 3: Test E5 — ambiguity**

Upload an ambiguous receipt (e.g., a restaurant receipt) in E5 tab.

Expected: verdict with confidence level shown. If the model is uncertain, verdict should be "unclear".

- [ ] **Step 4: Test E6 — adversarial**

Upload any receipt in E6 tab, click Test All Policies.

Expected: 3 columns (clear/vague/contradictory), hallucination badge appears on vague/contradictory if model reports "clear" policy clarity.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: API routes for E4 phase sensitivity and E6 adversarial"
```

---

## Task 7: Annotation Helper Page

**Files:**
- Modify: `public/index.html` (add Annotate tab)
- Modify: `public/app.js` (add annotation logic)
- Modify: `server.js` (add `/api/annotations` GET/POST routes)
- Create: `data/annotations/ground_truth.json`

**Interfaces:**
- `GET /api/annotations` → array of annotation objects
- `POST /api/annotations` body: annotation object → `{ok: true}`
- `GET /api/receipts` → array of filenames from `CASH_RECIEPTS/`

- [ ] **Step 1: Create data/annotations/ground_truth.json**

```json
[]
```

- [ ] **Step 2: Add annotation routes to server.js**

```javascript
import { readdirSync } from 'fs';

const GT_PATH = join(__dirname, 'data', 'annotations', 'ground_truth.json');
const RECEIPTS_DIR = join(__dirname, 'CASH_RECIEPTS');

function loadGT() {
  try { return JSON.parse(readFileSync(GT_PATH, 'utf8')); } catch { return []; }
}

function saveGT(data) {
  writeFileSync(GT_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/receipts', (req, res) => {
  const files = readdirSync(RECEIPTS_DIR).filter(f =>
    /\.(jpg|jpeg|png|pdf)$/i.test(f)
  );
  res.json(files);
});

app.get('/api/annotations', (req, res) => res.json(loadGT()));

app.post('/api/annotations', (req, res) => {
  const gt = loadGT();
  const entry = req.body;
  const idx = gt.findIndex(e => e.filename === entry.filename);
  if (idx >= 0) gt[idx] = entry; else gt.push(entry);
  saveGT(gt);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Add Annotate tab to index.html**

Add to the tab navigation (after E6 button, before Settings button):

```html
<button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="annotate">Annotate</button>
```

Add tab panel after E6 panel:

```html
<!-- Annotate -->
<div id="tab-annotate" class="tab-panel hidden">
  <h2 class="text-lg font-semibold mb-1">Ground Truth Annotation</h2>
  <p class="text-sm text-gray-500 mb-6">Annotate receipts with ground truth for paper metrics.</p>
  <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">Receipt</label>
      <select id="ann-file" class="block w-full text-sm border border-gray-300 rounded px-3 py-2" onchange="loadAnnotation()"></select>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div><label class="block text-sm font-medium mb-1">Vendor</label><input id="ann-vendor" type="text" class="block w-full text-sm border border-gray-300 rounded px-3 py-2"></div>
      <div><label class="block text-sm font-medium mb-1">Date</label><input id="ann-date" type="text" placeholder="YYYY-MM-DD" class="block w-full text-sm border border-gray-300 rounded px-3 py-2"></div>
      <div><label class="block text-sm font-medium mb-1">Amount</label><input id="ann-amount" type="number" step="0.01" class="block w-full text-sm border border-gray-300 rounded px-3 py-2"></div>
      <div><label class="block text-sm font-medium mb-1">Currency</label><input id="ann-currency" type="text" placeholder="EUR" class="block w-full text-sm border border-gray-300 rounded px-3 py-2"></div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Category</label>
      <select id="ann-category" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        <option value="equipment">Equipment</option>
        <option value="software">Software</option>
        <option value="travel">Travel</option>
        <option value="food">Food</option>
        <option value="services">Services</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">Human Verdict</label>
      <select id="ann-verdict" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        <option value="justified">Justified</option>
        <option value="suspicious">Suspicious</option>
        <option value="unclear">Unclear</option>
      </select>
    </div>
    <div><label class="block text-sm font-medium mb-1">Verdict Reason</label><input id="ann-reason" type="text" class="block w-full text-sm border border-gray-300 rounded px-3 py-2"></div>
    <div class="flex items-center gap-2">
      <input type="checkbox" id="ann-ambiguous">
      <label for="ann-ambiguous" class="text-sm">Mark as ambiguous</label>
    </div>
    <div><label class="block text-sm font-medium mb-1">Notes</label><input id="ann-notes" type="text" class="block w-full text-sm border border-gray-300 rounded px-3 py-2"></div>
    <button onclick="saveAnnotation()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Save Annotation</button>
    <div id="ann-result" class="mt-2"></div>
  </div>
</div>
```

- [ ] **Step 4: Add annotation JS to app.js**

```javascript
let _annotations = [];
let _receipts = [];

async function initAnnotate() {
  [_receipts, _annotations] = await Promise.all([
    fetch('/api/receipts').then(r => r.json()),
    fetch('/api/annotations').then(r => r.json()),
  ]);
  const sel = document.getElementById('ann-file');
  sel.innerHTML = _receipts.map(f => `<option value="${f}">${f}</option>`).join('');
  loadAnnotation();
}

function loadAnnotation() {
  const filename = document.getElementById('ann-file').value;
  const ann = _annotations.find(a => a.filename === filename) || {};
  document.getElementById('ann-vendor').value = ann.vendor || '';
  document.getElementById('ann-date').value = ann.date || '';
  document.getElementById('ann-amount').value = ann.amount || '';
  document.getElementById('ann-currency').value = ann.currency || '';
  document.getElementById('ann-category').value = ann.category || 'other';
  document.getElementById('ann-verdict').value = ann.human_verdict || 'justified';
  document.getElementById('ann-reason').value = ann.human_verdict_reason || '';
  document.getElementById('ann-ambiguous').checked = ann.is_ambiguous || false;
  document.getElementById('ann-notes').value = ann.notes || '';
}

async function saveAnnotation() {
  const filename = document.getElementById('ann-file').value;
  const entry = {
    filename,
    vendor: document.getElementById('ann-vendor').value || null,
    date: document.getElementById('ann-date').value || null,
    amount: parseFloat(document.getElementById('ann-amount').value) || null,
    currency: document.getElementById('ann-currency').value || null,
    category: document.getElementById('ann-category').value,
    human_verdict: document.getElementById('ann-verdict').value,
    human_verdict_reason: document.getElementById('ann-reason').value,
    is_ambiguous: document.getElementById('ann-ambiguous').checked,
    notes: document.getElementById('ann-notes').value || '',
  };
  await fetch('/api/annotations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  _annotations = _annotations.filter(a => a.filename !== filename);
  _annotations.push(entry);
  showResult('ann-result', `<p class="text-green-600 text-sm">✓ Saved ${filename}</p>`);
}

// Load annotation data when tab is clicked
document.querySelector('[data-tab="annotate"]').addEventListener('click', initAnnotate);
```

- [ ] **Step 5: Test annotation flow**

Open Annotate tab, select a receipt from the dropdown, fill in fields, click Save.

Expected: `data/annotations/ground_truth.json` gains an entry; re-selecting the receipt restores the form values.

- [ ] **Step 6: Commit**

```bash
git add server.js public/ data/annotations/
git commit -m "feat: annotation tab for ground truth data entry"
```

---

## Task 8: Paper Writing

**Files:** All files in `paper/` directory (Markdown).

- [ ] **Step 1: Create paper directory**

```bash
mkdir -p paper
```

- [ ] **Step 2: Write paper/00_abstract.md**

```markdown
# Abstract

Standard expense audit systems validate the structural correctness of receipts—dates, amounts, and document formats—but do not assess whether an expense is semantically appropriate given a project's stated goals and phase. This paper introduces an AI-driven pipeline for Policy Semantic Audit, where a large language model (LLM) evaluates each expense against a natural-language project policy using zero-shot chain-of-thought (CoT) reasoning.

We implement the pipeline as an interactive web application backed by the OpenRouter API, enabling real-time evaluation across multiple models including Gemini 2.5 Flash, Qwen2.5-72B, and Mixtral-8x7B. We conduct six experiments on 26 real expense receipts: (E1) multimodal OCR field extraction, (E2) zero-shot verdict classification without reasoning, (E3) CoT-augmented reasoning, (E4) phase-sensitive verdict consistency, (E5) uncertainty expression on ambiguous expenses, and (E6) adversarial evaluation under vague and contradictory policies.

Our results demonstrate that [TBD — fill after experiments: CoT improvement delta, best-performing model, hallucination rate on adversarial policies]. For each experiment we document implementation problems encountered and solutions applied, providing a reproducible research artifact.
```

- [ ] **Step 3: Write paper/01_introduction.md**

```markdown
# 1. Introduction

## 1.1 The Auditability Gap

Modern expense management platforms—such as SAP Concur, Expensify, and custom ERP solutions—automate the verification of expense reports at the structural level: they confirm that a receipt is present, that it shows a valid date, that the amount matches the claim, and that required fields are populated. This format-level validation is necessary but not sufficient for genuine financial governance.

A receipt for a high-end restaurant dinner is structurally valid. But is it semantically justified? The answer depends on context: a team working dinner during a product launch sprint is different from a personal dinner charged to a research project in its documentation phase. No rule-based system can make this distinction reliably; it requires understanding the project's current goals, constraints, and phase.

## 1.2 Research Question

We ask: **Can a large language model, given a natural-language project policy and a receipt, reason zero-shot about whether the expense is semantically justified?**

This question has practical significance in R&D finance, startup accounting, and public grant management, where human reviewers audit dozens of receipts per month against loosely defined project scopes.

## 1.3 Contributions

This paper makes the following contributions:

1. **Pipeline design.** A three-layer architecture: multimodal OCR extraction → policy grounding → CoT reasoning and verdict.
2. **Synthetic policy framework.** A methodology for constructing project expense policies with three variants (clear, vague, contradictory) to stress-test model behavior.
3. **Six-experiment empirical evaluation.** Run on 26 real expense receipts, spanning OCR accuracy, reasoning quality, phase sensitivity, uncertainty handling, and adversarial policy robustness.
4. **Failure mode taxonomy.** Documentation of problems encountered at each stage and the solutions applied—a contribution to reproducibility in applied LLM research.
5. **Open research artifact.** An interactive web application enabling real-time replication of all experiments.
```

- [ ] **Step 4: Write paper/02_related_work.md**

```markdown
# 2. Related Work

## 2.1 Document Understanding with LLMs

Early work on automated document understanding used OCR pipelines combined with rule-based extraction [cite]. Neural approaches such as LayoutLM [Xu et al., 2020] and its successors incorporated both textual and spatial layout features, achieving strong performance on structured documents. Donut [Kim et al., 2022] introduced an end-to-end approach that reads documents directly from image pixels without an explicit OCR stage. More recently, multimodal large language models such as GPT-4V, Gemini, and Qwen-VL have demonstrated general-purpose document understanding across receipts, invoices, and forms. However, these systems focus on field extraction and do not evaluate semantic justification of the extracted content.

## 2.2 Policy Compliance in NLP

Automated compliance checking has been studied in the context of legal contracts [Chalkidis et al., 2021], regulatory documents [Holzenberger et al., 2020], and privacy policy analysis [Wilson et al., 2016]. Rule-following in LLMs—the ability to adhere to explicit constraints stated in natural language—has been studied as an alignment property [Ouyang et al., 2022]. Recent work has shown that LLMs can perform zero-shot policy adherence for simple rules but struggle with vague or contradictory constraints [cite]. Our work specifically targets the intersection of document understanding and policy compliance: not just extracting fields, but evaluating their semantic fit within a policy context.

## 2.3 Chain-of-Thought Prompting

Wei et al. [2022] demonstrated that prompting LLMs to reason step-by-step ("chain-of-thought") substantially improves performance on multi-step reasoning tasks. Subsequent work has shown CoT benefits on classification, commonsense reasoning, and factual question answering. A key open question is whether CoT improves not just accuracy but also *explainability*—the degree to which the stated reasoning correctly justifies the final verdict. Our E2 vs. E3 comparison directly tests this for policy compliance judgments.
```

- [ ] **Step 5: Write paper/03_architecture.md**

```markdown
# 3. System Architecture

## 3.1 Overview

The pipeline consists of three sequential layers executed on demand via a web interface.

```
┌─────────────────────────────────────────────────────────┐
│ User uploads receipt (JPG / PNG / PDF)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Layer 1: OCR & Extraction                               │
│ Multimodal LLM (vision) → JSON fields                   │
│ vendor, date, amount, currency, line_items, category    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Layer 2: Policy Grounding                               │
│ Synthetic policy loaded → phase selected →              │
│ structured text injected into context                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Layer 3: Reasoning & Verdict                            │
│ LLM (text) → reasoning chain → verdict + explanation   │
│ verdict: justified | suspicious | unclear               │
└─────────────────────────────────────────────────────────┘
```

## 3.2 Implementation

The pipeline is implemented as a Node.js/Express web application. The frontend is a single-page application with seven tabs (E1–E6 and Settings) built in vanilla JavaScript with Tailwind CSS. All LLM calls are routed through the OpenRouter API, enabling model switching without code changes.

The model is user-configurable: a vision model handles OCR (default: `google/gemini-2.5-flash`) and a text model handles reasoning (default: `google/gemini-2.5-flash`). The application runs locally with `node server.js` and requires only an OpenRouter API key.

## 3.3 Model Selection Rationale

- **Gemini 2.5 Flash** — Primary model. Strong multimodal capabilities, fast inference, available via OpenRouter.
- **Qwen2.5-72B** — Open-weight reasoning baseline. Strong instruction following, available via OpenRouter.
- **Mixtral-8x7B** — Smaller open-weight baseline. Tests whether model scale affects policy compliance quality.
```

- [ ] **Step 6: Write paper/04_methodology.md**

```markdown
# 4. Methodology

## 4.1 Dataset

We collected 26 real expense receipts from an active R&D project, comprising 21 JPG/PNG photographs and 5 PDF invoices, dated October 2025 to January 2026. Receipts span multiple languages (English, German, Russian) and vendors across equipment, software, travel, and services categories.

Each receipt was manually annotated with: vendor name, date (YYYY-MM-DD), total amount, currency (ISO 4217), line items (summarized), expense category, human verdict (justified/suspicious/unclear), one-sentence verdict reason, ambiguity flag, and free-text notes.

## 4.2 Synthetic Policy Design

We designed three policy variants to test model behavior across a spectrum of policy clarity:

- **Clear policy**: Detailed per-phase expense taxonomy with explicit allowed/restricted/forbidden categories. Three phases: Infrastructure Setup, Experimentation, Evaluation & Documentation.
- **Vague policy**: Uses generic language ("work-related expenses", "reasonable expenses") without specific categories.
- **Contradictory policy**: Internally inconsistent (e.g., Phase 1 simultaneously lists "equipment" as allowed and "hardware" as forbidden; Phase 2 lists "travel" as both allowed and forbidden).

The project described in all three variants is the same: the AI Receipt Audit System R&D project itself—creating a self-referential audit scenario.

## 4.3 Prompt Design

Three prompt templates are used:

**Extraction prompt:** Instructs a vision model to return a JSON object with fields vendor, date, amount, currency, line_items, and category. Returns null for unreadable fields.

**Verdict prompt (no-CoT):** Provides policy text and extracted expense fields. Asks for a JSON verdict (justified/suspicious/unclear) with a one-sentence reason. No reasoning instruction.

**Verdict prompt (CoT):** Same as above, but prefaced with a four-step reasoning instruction: (1) identify expense type, (2) check policy allowance for current phase, (3) assess amount reasonableness, (4) flag ambiguities. Returns reasoning + verdict + reason.

## 4.4 Evaluation Metrics

| Experiment | Metric |
|-----------|--------|
| E1 | Field-level precision per field (exact match vs. human annotation) |
| E2, E3 | Cohen's κ between model verdict and human verdict |
| E4 | Phase-sensitivity score: % of receipts where verdict changes between Phase 1 and Phase 3 |
| E5 | Uncertainty expression rate: % of responses with verdict = "unclear" |
| E6 | Hallucination rate: % of responses where model reports "clear" policy clarity on vague/contradictory policy |
```

- [ ] **Step 7: Write paper/05_experiments.md (structure only — fill results after running)**

```markdown
# 5. Experiments

Each experiment is presented with: hypothesis, setup, results, problems encountered and solutions, and discussion.

---

## E1: OCR Extraction Baseline

**Hypothesis:** A multimodal LLM can reliably extract structured fields (vendor, date, amount, currency, category) from real-world receipt photographs and PDFs of varying quality and language.

**Setup:** All 26 receipts processed via the `/api/extract` endpoint using `google/gemini-2.5-flash` as the vision model. Extracted fields compared against manual ground truth annotations. Field-level precision computed for: vendor, date, amount, currency, category.

**Results:**

[TABLE — run analysis after experiments]

**Problems Encountered:**

[Fill from PROBLEMS.md after running]

**Discussion:**

[Fill after results]

---

## E2: Zero-shot Classification Without CoT

**Hypothesis:** A model given policy context and extracted expense fields, but without chain-of-thought instruction, produces verdicts with low agreement with human judgment.

**Setup:** E1 extraction output fed into `/api/verdict` with `useCot: false`. All 26 receipts evaluated against the clear policy, Phase 2 (Experimentation). Model verdict compared to human ground truth using Cohen's κ.

**Results:** [TABLE]

**Problems Encountered:** [Fill]

**Discussion:** [Fill]

---

## E3: Zero-shot CoT Reasoning

**Hypothesis:** Chain-of-thought prompting improves verdict accuracy and produces auditable explanations compared to E2.

**Setup:** Identical to E2 but with `useCot: true`. Same receipts, same policy, same phase. Results compared to E2 on Cohen's κ and explanation quality (human-rated 1–3).

**Results:** [TABLE]

**Problems Encountered:** [Fill]

**Discussion:** [Fill]

---

## E4: Phase-Sensitive Reasoning

**Hypothesis:** The same expense receives a different verdict when the project phase changes, demonstrating genuine semantic grounding.

**Setup:** 6–8 receipts selected where the expense category is phase-dependent (e.g., new equipment: allowed in Phase 1, forbidden in Phase 3). Each receipt evaluated against all 3 phases of the clear policy using CoT prompting.

**Results:** [TABLE]

**Problems Encountered:** [Fill]

**Discussion:** [Fill]

---

## E5: Ambiguity and Uncertainty Handling

**Hypothesis:** For receipts that are genuinely ambiguous, the model expresses uncertainty (verdict = "unclear") rather than forcing a confident verdict.

**Setup:** 5–7 receipts flagged as `is_ambiguous: true` in annotations. Evaluated with CoT prompting, clear policy, Phase 2. Uncertainty expression rate measured.

**Results:** [TABLE]

**Problems Encountered:** [Fill]

**Discussion:** [Fill]

---

## E6: Adversarial Policy Stress Test

**Hypothesis:** Under vague or contradictory policies, weaker models hallucinate confident justifications while stronger models flag the policy ambiguity.

**Setup:** 10 receipts (3–4 clearly justified, 3–4 clearly suspicious, 2–3 ambiguous) evaluated against all 3 policy variants using CoT prompting. Hallucination defined as: model reports `policy_clarity: "clear"` when the input policy was vague or contradictory.

**Results:** [TABLE]

**Problems Encountered:** [Fill]

**Discussion:** [Fill]
```

- [ ] **Step 8: Write paper/06_results.md**

```markdown
# 6. Results and Discussion

[Fill after all experiments are run. Structure:]

## 6.1 OCR Extraction Performance (E1)
## 6.2 Impact of Chain-of-Thought Reasoning (E2 vs. E3)
## 6.3 Phase Sensitivity (E4)
## 6.4 Uncertainty Expression on Ambiguous Expenses (E5)
## 6.5 Adversarial Policy Robustness (E6)
## 6.6 Cross-Experiment Model Comparison
```

- [ ] **Step 9: Write paper/07_limitations.md**

```markdown
# 7. Limitations and Future Work

## 7.1 Limitations

**Dataset size.** The evaluation uses 26 receipts from a single project. While sufficient for qualitative findings and directional metrics, the sample size limits statistical significance of kappa values and precision scores.

**Single domain.** All receipts are from one R&D project in the technology sector. The model's performance on other domains (medical research expenses, construction projects, retail) is unknown.

**Synthetic policy.** The project policy was designed for this study. Real-world expense policies vary significantly in structure, legal grounding, and complexity. The contradictory policy variant simulates an extreme case; real-world policies may have subtler contradictions.

**Single annotator.** Human verdicts were assigned by one annotator. Inter-annotator agreement was not measured, limiting the reliability of Cohen's κ as a gold standard.

**No fine-tuning baseline.** We do not compare zero-shot CoT performance against a fine-tuned classifier, as the dataset is too small for meaningful fine-tuning.

## 7.2 Future Work

- **RAG-based policy retrieval.** For large policy documents, retrieve relevant clauses rather than injecting the full policy.
- **Fine-tuning on labeled data.** With a larger annotated dataset, fine-tune a smaller model for deployment efficiency.
- **Multi-language receipts.** The current pipeline handles Russian and German receipts through the model's multilingual capability; systematic evaluation across languages is needed.
- **Real-world policy integration.** Connect to actual policy documents (e.g., from a project management system or contract repository).
```

- [ ] **Step 10: Write paper/08_conclusion.md**

```markdown
# 8. Conclusion

We presented an AI-driven pipeline for Policy Semantic Audit — the evaluation of expense justification against a natural-language project policy using zero-shot chain-of-thought reasoning. The pipeline operates as an interactive web application, enabling researchers and practitioners to upload receipts and observe real-time LLM reasoning about policy compliance.

Our six-experiment evaluation on 26 real receipts demonstrated that [TBD: key quantitative findings]. Chain-of-thought prompting [increased/decreased] verdict accuracy by [X] Cohen's κ points compared to direct classification. Models showed [strong/moderate/weak] phase sensitivity, with verdicts [correctly/inconsistently] shifting as the project phase changed. On adversarial policies, [model X] most reliably flagged policy ambiguity, while [model Y] showed the highest hallucination rate.

The primary contribution beyond the experimental results is the documented failure mode taxonomy — problems encountered at each stage and solutions applied — which provides a practical guide for researchers building similar applied LLM pipelines. Future work should address dataset scale, multi-language evaluation, and integration with live policy management systems.
```

- [ ] **Step 11: Write paper/references.bib**

```bibtex
@article{wei2022chain,
  title={Chain-of-thought prompting elicits reasoning in large language models},
  author={Wei, Jason and Wang, Xuezhi and Schuurmans, Dale and Bosma, Maarten and Xia, Fei and Chi, Ed and Le, Quoc V and Zhou, Denny and others},
  journal={Advances in Neural Information Processing Systems},
  volume={35},
  pages={24824--24837},
  year={2022}
}

@inproceedings{xu2020layoutlm,
  title={LayoutLM: Pre-training of text and layout for document image understanding},
  author={Xu, Yiheng and Li, Minghui and Cui, Lei and Huang, Shaohan and Wei, Furu and Zhou, Ming},
  booktitle={Proceedings of the 26th ACM SIGKDD},
  pages={1192--1200},
  year={2020}
}

@inproceedings{kim2022ocr,
  title={OCR-free document understanding transformer},
  author={Kim, Geewook and Hong, Teakgyu and Yim, Moonbin and Nam, JeongYeon and Park, Jinyoung and Yim, Jinyeong and Hwang, Wonseok and Yun, Sangdoo and Han, Dongyoon and Park, Seunghyun},
  booktitle={European Conference on Computer Vision},
  pages={498--517},
  year={2022}
}

@article{ouyang2022training,
  title={Training language models to follow instructions with human feedback},
  author={Ouyang, Long and Wu, Jeffrey and Jiang, Xu and Almeida, Diogo and Wainwright, Carroll and Mishkin, Pamela and Zhang, Chong and Agarwal, Sandhini and Slama, Katarina and Ray, Alex and others},
  journal={Advances in Neural Information Processing Systems},
  volume={35},
  pages={27730--27744},
  year={2022}
}

@inproceedings{chalkidis2021lexglue,
  title={LexGLUE: A benchmark dataset for legal language understanding in English},
  author={Chalkidis, Ilias and Jana, Abhik and Hartung, Dirk and Bommarito, Michael and Androutsopoulos, Ion and Katz, Daniel and Aletras, Nikolaos},
  booktitle={Proceedings of the 60th Annual Meeting of the ACL},
  pages={4310--4330},
  year={2022}
}
```

- [ ] **Step 12: Commit**

```bash
git add paper/
git commit -m "docs: paper draft — all 9 sections (results TBD pending experiments)"
```
