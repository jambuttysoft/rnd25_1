# Task 4 Spec — Frontend Shell + Settings Tab

> **Read first:** `docs/superpowers/specs/00-project-context.md`
> **Prerequisite:** Task 3 must be complete (`lib/openrouter.js` and `lib/prompts.js` exist).

---

## Scope

Create three files in `public/`:
- `public/index.html` — Single-page app shell: header, 8-tab nav, all tab panels
- `public/app.js` — Tab switching, Settings logic, shared helper functions, experiment runners (E1–E6)
- `public/style.css` — Minimal custom styles for verdict badges (Tailwind handles the rest)

The backend routes called by this frontend are implemented in Tasks 5 and 6. The frontend can be built and tested independently; experiment buttons will fail with a network error until the backend routes exist, which is acceptable.

---

## File 1: `public/style.css`

```css
/* Tailwind is loaded via CDN — this file only adds custom classes */

/* Active tab underline */
.tab-btn.active {
  border-bottom: 2px solid #2563eb;
  color: #2563eb;
  font-weight: 600;
}

/* Verdict badge colors */
.verdict-justified { background: #dcfce7; border: 1px solid #4ade80; color: #15803d; }
.verdict-suspicious { background: #fee2e2; border: 1px solid #f87171; color: #b91c1c; }
.verdict-unclear { background: #fef9c3; border: 1px solid #facc15; color: #92400e; }
.verdict-error { background: #f3f4f6; border: 1px solid #9ca3af; color: #374151; }
```

---

## File 2: `public/index.html`

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
    <button class="tab-btn active px-4 py-3 text-sm whitespace-nowrap" data-tab="e1">E1: OCR</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e2">E2: No-CoT</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e3">E3: CoT</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e4">E4: Phase</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e5">E5: Ambiguity</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="e6">E6: Adversarial</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="annotate">Annotate</button>
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap ml-auto" data-tab="settings">⚙ Settings</button>
  </nav>

  <!-- Tab Panels -->
  <main class="max-w-4xl mx-auto px-6 py-8">

    <!-- E1: OCR Extraction -->
    <div id="tab-e1" class="tab-panel">
      <h2 class="text-lg font-semibold mb-1">E1: OCR Extraction Baseline</h2>
      <p class="text-sm text-gray-500 mb-4">Upload a receipt — the model extracts structured fields (vendor, date, amount, currency, category).</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <label class="block text-sm font-medium mb-2">Receipt file (JPG, PNG, PDF)</label>
        <input type="file" id="e1-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2 mb-4">
        <button id="e1-btn" data-label="Extract Fields" onclick="runE1()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Extract Fields
        </button>
      </div>
      <div id="e1-result" class="mt-4"></div>
    </div>

    <!-- E2: No-CoT Verdict -->
    <div id="tab-e2" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E2: Zero-shot Verdict (No Chain-of-Thought)</h2>
      <p class="text-sm text-gray-500 mb-4">Upload a receipt — model gives a direct verdict without step-by-step reasoning.</p>
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
              <option value="2">Phase 3: Evaluation &amp; Documentation</option>
            </select>
          </div>
        </div>
        <button id="e2-btn" data-label="Get Verdict" onclick="runE2()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Get Verdict
        </button>
      </div>
      <div id="e2-result" class="mt-4"></div>
    </div>

    <!-- E3: CoT Reasoning -->
    <div id="tab-e3" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E3: Chain-of-Thought Reasoning</h2>
      <p class="text-sm text-gray-500 mb-4">Same as E2, but the model reasons step by step and shows its work.</p>
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
              <option value="2">Phase 3: Evaluation &amp; Documentation</option>
            </select>
          </div>
        </div>
        <button id="e3-btn" data-label="Reason &amp; Verdict" onclick="runE3()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Reason &amp; Verdict
        </button>
      </div>
      <div id="e3-result" class="mt-4"></div>
    </div>

    <!-- E4: Phase Sensitivity -->
    <div id="tab-e4" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E4: Phase-Sensitive Reasoning</h2>
      <p class="text-sm text-gray-500 mb-4">Upload a receipt — see how the verdict changes across all 3 project phases side by side.</p>
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
        <button id="e4-btn" data-label="Test All Phases" onclick="runE4()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Test All Phases
        </button>
      </div>
      <div id="e4-result" class="mt-4"></div>
    </div>

    <!-- E5: Ambiguity -->
    <div id="tab-e5" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E5: Ambiguity &amp; Uncertainty Handling</h2>
      <p class="text-sm text-gray-500 mb-4">Upload an ambiguous receipt — does the model express uncertainty or force a confident verdict?</p>
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
              <option value="2">Phase 3: Evaluation &amp; Documentation</option>
            </select>
          </div>
        </div>
        <button id="e5-btn" data-label="Analyse Ambiguity" onclick="runE5()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Analyse Ambiguity
        </button>
      </div>
      <div id="e5-result" class="mt-4"></div>
    </div>

    <!-- E6: Adversarial -->
    <div id="tab-e6" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">E6: Adversarial Policy Stress Test</h2>
      <p class="text-sm text-gray-500 mb-4">Upload a receipt — see verdicts under all 3 policy variants simultaneously. Hallucination badges appear when the model misassesses policy clarity.</p>
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
            <option value="2">Phase 3: Evaluation &amp; Documentation</option>
          </select>
        </div>
        <button id="e6-btn" data-label="Test All Policies" onclick="runE6()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Test All Policies
        </button>
      </div>
      <div id="e6-result" class="mt-4"></div>
    </div>

    <!-- Annotate -->
    <div id="tab-annotate" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">Ground Truth Annotation</h2>
      <p class="text-sm text-gray-500 mb-4">Annotate receipts with human verdicts for paper metrics. Data saved to <code>data/annotations/ground_truth.json</code>.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4 max-w-lg">
        <div>
          <label class="block text-sm font-medium mb-1">Receipt</label>
          <select id="ann-file" class="block w-full text-sm border border-gray-300 rounded px-3 py-2" onchange="loadAnnotation()"></select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Vendor</label>
            <input id="ann-vendor" type="text" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Date (YYYY-MM-DD)</label>
            <input id="ann-date" type="text" placeholder="2025-10-07" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Amount</label>
            <input id="ann-amount" type="number" step="0.01" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Currency</label>
            <input id="ann-currency" type="text" placeholder="EUR" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Category</label>
          <select id="ann-category" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="equipment">Equipment</option>
            <option value="software">Software</option>
            <option value="travel">Travel</option>
            <option value="meals">Meals</option>
            <option value="services">Services</option>
            <option value="supplies">Supplies</option>
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
        <div>
          <label class="block text-sm font-medium mb-1">Verdict Reason (one sentence)</label>
          <input id="ann-reason" type="text" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" id="ann-ambiguous" class="rounded">
          <label for="ann-ambiguous" class="text-sm">Mark as ambiguous (reasonable reviewers might disagree)</label>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Notes</label>
          <input id="ann-notes" type="text" placeholder="Quality issues, unusual format, etc." class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
        </div>
        <button onclick="saveAnnotation()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Save Annotation
        </button>
        <div id="ann-result" class="mt-2 text-sm"></div>
      </div>
    </div>

    <!-- Settings -->
    <div id="tab-settings" class="tab-panel hidden">
      <h2 class="text-lg font-semibold mb-1">Settings</h2>
      <p class="text-sm text-gray-500 mb-4">Configure the API key and models used for all experiments.</p>
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4 max-w-lg">
        <div>
          <label class="block text-sm font-medium mb-1">OpenRouter API Key</label>
          <input type="password" id="s-apikey" placeholder="sk-or-..." autocomplete="off"
            class="block w-full text-sm border border-gray-300 rounded px-3 py-2 font-mono">
          <p class="text-xs text-gray-400 mt-1">Kept in browser memory only — not stored on disk. Re-enter after page reload.</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Vision Model (OCR — Layer 1)</label>
          <select id="s-vision-model" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (recommended)</option>
            <option value="qwen/qwen2.5-vl-72b-instruct">qwen/qwen2.5-vl-72b-instruct</option>
            <option value="anthropic/claude-sonnet-4-5">anthropic/claude-sonnet-4-5</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Reasoning Model (Verdict — Layer 3)</label>
          <select id="s-model" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
            <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (recommended)</option>
            <option value="qwen/qwen2.5-72b-instruct">qwen/qwen2.5-72b-instruct</option>
            <option value="mistralai/mixtral-8x7b-instruct">mistralai/mixtral-8x7b-instruct</option>
            <option value="anthropic/claude-sonnet-4-5">anthropic/claude-sonnet-4-5</option>
          </select>
          <p class="text-xs text-gray-400 mt-1">Switch models to compare behavior across E2–E6.</p>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="saveSettings()"
            class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
            Save Settings
          </button>
          <button onclick="testConnection()"
            class="border border-gray-300 bg-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-50">
            Test Connection
          </button>
        </div>
        <div id="settings-result" class="mt-2 text-sm"></div>
      </div>
    </div>

  </main>

  <script src="/app.js"></script>
</body>
</html>
```

---

## File 3: `public/app.js`

```javascript
// ─── Tab routing ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    // Lazy-load annotation data when that tab is first clicked
    if (btn.dataset.tab === 'annotate') initAnnotate();
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

// API key is kept only in memory — never sent to disk
let _apiKey = '';

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const cfg = await res.json();
    document.getElementById('s-model').value = cfg.model || 'google/gemini-2.5-flash';
    document.getElementById('s-vision-model').value = cfg.visionModel || 'google/gemini-2.5-flash';
  } catch (_) {}
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
  if (apiKey) _apiKey = apiKey;
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, visionModel }),
  });
  showResult('settings-result', '<span class="text-green-600">✓ Settings saved</span>');
}

async function testConnection() {
  const { apiKey, model } = getSettings();
  if (!apiKey) return showError('settings-result', 'Enter your API key first.');
  showResult('settings-result', '<span class="text-gray-500">Testing…</span>');
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    });
    const data = await res.json();
    if (data.ok) showResult('settings-result', `<span class="text-green-600">✓ Connected — model replied: "${data.response}"</span>`);
    else showError('settings-result', data.error || 'Connection failed');
  } catch (e) {
    showError('settings-result', e.message);
  }
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function showResult(containerId, html) {
  document.getElementById(containerId).innerHTML = html;
}

function showError(containerId, message) {
  document.getElementById(containerId).innerHTML =
    `<div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">${escHtml(message)}</div>`;
}

function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.textContent = 'Running…';
  } else {
    btn.textContent = btn.dataset.label || btn.textContent;
  }
}

function verdictBadge(verdict) {
  const cls = {
    justified: 'verdict-justified',
    suspicious: 'verdict-suspicious',
    unclear: 'verdict-unclear',
  }[verdict] || 'verdict-error';
  return `<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}">${escHtml(verdict)}</span>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Read file as base64 string (strips data: prefix)
async function getFileData(inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files[0]) throw new Error('Please select a file first.');
  const file = input.files[0];
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64, mimeType: file.type || 'image/jpeg', filename: file.name };
}

// ─── E1: OCR Extraction ───────────────────────────────────────────────────────

async function runE1() {
  const btnId = 'e1-btn';
  setLoading(btnId, true);
  showResult('e1-result', '');
  try {
    const { base64, mimeType } = await getFileData('e1-file');
    const { apiKey, visionModel } = getSettings();
    if (!apiKey) { showError('e1-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, apiKey, model: visionModel }),
    });
    const data = await res.json();
    if (data.error) return showError('e1-result', data.error);
    const f = data.extraction;
    showResult('e1-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="font-medium mb-3 text-sm">Extracted Fields</h3>
        <table class="w-full text-sm">
          <tbody>
            ${['vendor', 'date', 'amount', 'currency', 'category'].map(k => `
              <tr class="border-b border-gray-100 last:border-0">
                <td class="py-2 pr-4 text-gray-500 w-24 capitalize">${k}</td>
                <td class="py-2 font-mono">${f[k] != null ? escHtml(String(f[k])) : '<span class="text-gray-400 italic">null</span>'}</td>
              </tr>`).join('')}
            <tr>
              <td class="py-2 pr-4 text-gray-500 align-top">items</td>
              <td class="py-2 font-mono text-xs">${(f.line_items || []).map(escHtml).join(', ') || '<span class="text-gray-400 italic">none</span>'}</td>
            </tr>
          </tbody>
        </table>
      </div>`);
  } catch (e) {
    showError('e1-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E2: No-CoT Verdict ───────────────────────────────────────────────────────

async function runE2() {
  const btnId = 'e2-btn';
  setLoading(btnId, true);
  showResult('e2-result', '');
  try {
    const { base64, mimeType } = await getFileData('e2-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e2-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e2-policy').value,
        phase: parseInt(document.getElementById('e2-phase').value),
        useCot: false,
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e2-result', data.error);
    showResult('e2-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center gap-3 mb-2">${verdictBadge(data.verdict)}</div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
      </div>`);
  } catch (e) {
    showError('e2-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E3: CoT Verdict ─────────────────────────────────────────────────────────

async function runE3() {
  const btnId = 'e3-btn';
  setLoading(btnId, true);
  showResult('e3-result', '');
  try {
    const { base64, mimeType } = await getFileData('e3-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e3-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e3-policy').value,
        phase: parseInt(document.getElementById('e3-phase').value),
        useCot: true,
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e3-result', data.error);
    showResult('e3-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">${verdictBadge(data.verdict)}</div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Show reasoning chain</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(data.reasoning)}</div>
          </details>` : ''}
      </div>`);
  } catch (e) {
    showError('e3-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E4: Phase Sensitivity ────────────────────────────────────────────────────

async function runE4() {
  const btnId = 'e4-btn';
  setLoading(btnId, true);
  showResult('e4-result', '');
  try {
    const { base64, mimeType } = await getFileData('e4-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e4-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/phase-sensitivity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e4-policy').value,
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e4-result', data.error);
    showResult('e4-result', `
      <div class="grid grid-cols-3 gap-4">
        ${data.phases.map(p => `
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">${escHtml(p.phase)}</div>
            ${verdictBadge(p.verdict)}
            <p class="text-sm text-gray-600 mt-2">${escHtml(p.reason)}</p>
            ${p.reasoning ? `
              <details class="text-xs mt-2">
                <summary class="cursor-pointer text-gray-400">Reasoning</summary>
                <div class="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(p.reasoning)}</div>
              </details>` : ''}
          </div>`).join('')}
      </div>`);
  } catch (e) {
    showError('e4-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E5: Ambiguity ────────────────────────────────────────────────────────────
// Uses /api/verdict with useCot: true (5-step prompt variant is selected server-side for E5)

async function runE5() {
  const btnId = 'e5-btn';
  setLoading(btnId, true);
  showResult('e5-result', '');
  try {
    const { base64, mimeType } = await getFileData('e5-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e5-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e5-policy').value,
        phase: parseInt(document.getElementById('e5-phase').value),
        useCot: true,
        useE5Prompt: true,  // tells backend to use the 5-step prompt
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e5-result', data.error);

    const isUnclear = data.verdict === 'unclear';
    showResult('e5-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">
          ${verdictBadge(data.verdict)}
          ${isUnclear
            ? '<span class="text-xs bg-yellow-100 border border-yellow-300 text-yellow-800 px-2 py-0.5 rounded">✓ Uncertainty expressed</span>'
            : '<span class="text-xs bg-orange-100 border border-orange-300 text-orange-700 px-2 py-0.5 rounded">⚠ Confident verdict on ambiguous receipt</span>'}
        </div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 font-medium">Show 5-step reasoning</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(data.reasoning)}</div>
          </details>` : ''}
      </div>`);
  } catch (e) {
    showError('e5-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E6: Adversarial ─────────────────────────────────────────────────────────

async function runE6() {
  const btnId = 'e6-btn';
  setLoading(btnId, true);
  showResult('e6-result', '');
  try {
    const { base64, mimeType } = await getFileData('e6-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e6-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/adversarial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        phase: parseInt(document.getElementById('e6-phase').value),
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e6-result', data.error);

    showResult('e6-result', `
      <div class="grid grid-cols-3 gap-4">
        ${data.policies.map(p => `
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-xs text-gray-500 font-semibold mb-2 uppercase">${escHtml(p.policy)} policy</div>
            ${verdictBadge(p.verdict)}
            ${p.hallucination
              ? '<span class="ml-1 text-xs bg-orange-100 border border-orange-300 text-orange-700 px-1.5 py-0.5 rounded">⚠ hallucination</span>'
              : ''}
            <p class="text-sm text-gray-600 mt-2">${escHtml(p.reason)}</p>
            ${p.policy_clarity
              ? `<p class="text-xs text-gray-400 mt-1">Policy assessed as: <strong>${escHtml(p.policy_clarity)}</strong></p>`
              : ''}
            ${p.reasoning ? `
              <details class="text-xs mt-2">
                <summary class="cursor-pointer text-gray-400">Reasoning</summary>
                <div class="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(p.reasoning)}</div>
              </details>` : ''}
          </div>`).join('')}
      </div>`);
  } catch (e) {
    showError('e6-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── Annotation ───────────────────────────────────────────────────────────────

let _annotations = [];
let _receipts = [];
let _annotateInitialized = false;

async function initAnnotate() {
  if (_annotateInitialized) return;
  _annotateInitialized = true;
  try {
    [_receipts, _annotations] = await Promise.all([
      fetch('/api/receipts').then(r => r.json()),
      fetch('/api/annotations').then(r => r.json()),
    ]);
    const sel = document.getElementById('ann-file');
    sel.innerHTML = _receipts.map(f => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join('');
    loadAnnotation();
  } catch (e) {
    showError('ann-result', `Failed to load receipts: ${e.message}`);
  }
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
  showResult('ann-result', '');
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
    human_verdict_reason: document.getElementById('ann-reason').value || '',
    is_ambiguous: document.getElementById('ann-ambiguous').checked,
    notes: document.getElementById('ann-notes').value || '',
  };
  try {
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');
    _annotations = _annotations.filter(a => a.filename !== filename);
    _annotations.push(entry);
    showResult('ann-result', `<span class="text-green-600">✓ Saved ${escHtml(filename)}</span>`);
  } catch (e) {
    showError('ann-result', e.message);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadSettings();
```

---

## Verify

Start the server and open the browser:

```bash
cd /Volumes/extdisk/WORK/RND2026/RND1
node server.js
```

Open `http://localhost:3000`. Check:
1. All 8 tabs render and switch without errors
2. Settings tab: select a model, enter a fake API key, click Save Settings → "✓ Settings saved" appears
3. E1 tab: select a JPG file, click Extract Fields → shows "Enter your API key in Settings first." (backend route not yet implemented — this is correct)
4. Browser console shows no JavaScript errors

---

## Commit

```bash
git add public/
git commit -m "feat: frontend shell — 8-tab SPA with E1-E6, Annotate, and Settings panels"
```
