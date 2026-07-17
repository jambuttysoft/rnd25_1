# TOTALFLOW UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 9 pages (E1–E6, GT, PE, ST) and add header/footer with JAMBUTTY + TOTAL FLOW logos to match the Notion design spec exported to `docs/changes/*.html`.

**Architecture:** Single-file SPA (index.html + app.js + style.css). All changes are frontend-only — no backend routes modified. New components (modal system, status card, actions) added as vanilla JS functions. Each experiment page restructured to follow a consistent template with Research Design/Practical Example buttons, About panel, Status Card, and unified Actions block.

**Tech Stack:** Vanilla HTML + Tailwind CDN + vanilla JS (no build step). No test framework.

**Design Spec:** `.sisyphus/drafts/2026-07-17-ui-redesign.md`
**Content Sources:** `docs/changes/*.html` (9 Notion export files with per-page text)

## Global Constraints

1. **No build step** — Tailwind via CDN only. No npm install, no bundler, no transpiler.
2. **No test framework** — all verification via running the app and visual inspection.
3. **data-tab attribute values MUST stay unchanged** — only display label text changes. JS routing uses data-tab, not button text.
4. **`docs/changes/*.html` files are content sources** — copy text from these files, do NOT modify them.
5. **All modal content = full text from source files** — no abbreviation.
6. **API key stays in browser memory only** — never server-side.
7. **No new external dependencies** — no new CDN scripts, no new npm packages.
8. **2-space indent, no semicolons, `const` only, arrow functions, template literals** — code style conventions.

---

## File Structure

### Modified Files

| File | Responsibility |
|------|---------------|
| `public/index.html` | Header (logo, new text), Footer (new), all 9 tab panel HTML restructured, tab button labels updated |
| `public/app.js` | Modal system, status card state machine, action handlers (Copy JSON, View Raw Response). Updated runE1–runE6 with status card transitions + about panels. Modal content constants for all RD/PE modals. GT: enhanced nav. PE: versioning. ST: page guide. |
| `public/style.css` | Modal overlay styles, status card transitions |

### New Files

| File | Source | Responsibility |
|------|--------|---------------|
| `public/jblogo.png` | `docs/changes/jblogo.png` | Header logo (JAMBUTTY) |
| `public/tflogo.png` | `docs/changes/tflogo.png` | Footer logo (TOTAL FLOW) |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Infrastructure — MAX PARALLEL):
├── T1: Header + Footer + Tab labels + Copy logos
├── T2: Common JS infrastructure (modal, status card, actions)
└── T3: style.css additions

Wave 2 (E1 as template):
└── T4: E1 complete redesign (proof of concept for E2-E6)

Wave 3 (E2–E6 — MAX PARALLEL, 5 independent tasks):
├── T5: E2: Direct Policy Reasoning Baseline
├── T6: E3: Structured Reasoning Evaluation
├── T7: E4: Context-Sensitive Reasoning (no phase dropdown)
├── T8: E5: Ambiguity & Uncertainty Handling
└── T9: E6: Adversarial Policy Stress Test (no policy dropdown)

Wave 4 (Support modules — PARALLEL, 3 tasks):
├── T10: GT: Ground Truth (structural rework)
├── T11: PE: Policy Editor (versioning, collapsible phases)
└── T12: ST: Research Configuration (rename + restructure)

Wave 5 (Verification):
└── T13: Final full verification + fixes
```

### Critical Path
T1 → T4 → T5–T9 → T10–T12 → T13
Max concurrent: 3 (Wave 1) / 5 (Wave 3)

---

## TODOs

---

- [x] 1. Header + Footer + Tab labels + Logo files

  **What to do**:
  - Copy `docs/changes/jblogo.png` → `public/jblogo.png`
  - Copy `docs/changes/tflogo.png` → `public/tflogo.png`
  - Restructure header: add logo, update title/subtitle text, flex row layout
  - Add new footer section with logo + copyright
  - Update all tab button display labels (9 tabs)

  **Must NOT do**:
  - Do NOT change `data-tab` attribute values
  - Do NOT change `id` values on tab panels

  **Files**:
  - Create: `public/jblogo.png`, `public/tflogo.png`
  - Modify: `public/index.html` (lines 10-29: header, tab nav; add footer before `</body>`)

  **Steps**:

  - [ ] **Step 1: Copy logo files**
    ```bash
    cp "docs/changes/jblogo.png" public/jblogo.png
    cp "docs/changes/tflogo.png" public/tflogo.png
    ```
    Verify: `ls -la public/*.png`

  - [ ] **Step 2: Restructure header**

    In `public/index.html`, replace the current `<header>` block (lines 13-16):

    ```html
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center gap-4">
        <img src="/jblogo.png" height="32" alt="JAMBUTTY" class="h-8 w-auto">
        <div>
          <h1 class="text-xl font-bold text-gray-900">TOTALFLOW Compliance Intelligence Engine</h1>
          <p class="text-sm text-gray-500 mt-0.5">Semantic Reasoning Research Platform</p>
        </div>
      </div>
    </header>
    ```

    Verification: Open `http://localhost:3000` → see JAMBUTTY logo + new title text in header.

  - [ ] **Step 3: Update tab button labels**

    In `public/index.html`, replace the text content of each `<button class="tab-btn">`:

    | Button | Current text | New text |
    |--------|-------------|----------|
    | Line 20 | E1: OCR | E1: OCR Baseline |
    | Line 21 | E2: No-CoT | E2: Direct Policy |
    | Line 22 | E3: CoT | E3: Structured Reasoning |
    | Line 23 | E4: Phase | E4: Context |
    | Line 24 | E5: Ambiguity | E5: Ambiguity |
    | Line 25 | E6: Adversarial | E6: Policy Stress Test |
    | Line 26 | Annotate | GT: Ground Truth |
    | Line 27 | Policy Editor | PE: Policy Editor |
    | Line 28 | ⚙ Settings | ST: Research Configuration |

    Also restore the `ml-auto` class on the Settings button (it currently has `px-4` and should keep `ml-auto` for alignment).

    Verification: All 9 tab buttons show new labels.

  - [ ] **Step 4: Add footer section**

    In `public/index.html`, before the `<script src="/app.js"></script>` line (after `</main>`):

    ```html
    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 px-6 py-4">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <img src="/tflogo.png" height="24" alt="TOTAL FLOW" class="h-6 w-auto">
        <p class="text-xs text-gray-400">© 2026 JAMBUTTY. All rights reserved. For research purposes only.</p>
      </div>
    </footer>
    ```

    Verification: Scroll to bottom → see TOTAL FLOW logo + copyright text.

  - [ ] **Step 5: Verify all changes**

    ```bash
    npm start
    ```
    Open browser → check: header logo, title text, footer logo, all 9 tab labels, page still functional.

  **Commit**: YES
  - Message: `feat: add header/footer with logos, update tab labels`
  - Files: `public/index.html`, `public/jblogo.png`, `public/tflogo.png`

---

- [x] 2. Common JS infrastructure (modal system, status card, actions)

  **What to do**:
  - Add `showModal(title, content)` function — generic modal overlay
  - Add `setExperimentState(page, state)` — status card state machine
  - Add `copyResultAsJSON(page)` — clipboard copy
  - Add `viewRawResponse(page)` — modal with raw JSON
  - Add modal content constants for ALL experiments (Research Design + Practical Example) — referenced from `docs/changes/*.html` files. Store as template literals (not fetched at runtime).
  - Add modal dismiss handlers (click outside, Escape key)

  **Must NOT do**:
  - Do NOT change existing experiment handler functions (runE1–runE6) in this task
  - Do NOT remove existing `showExperimentInfo` or `info-btn` yet

  **Files**:
  - Modify: `public/app.js` — add new functions before `// Tab Switching`

  **Steps**:

  - [ ] **Step 1: Add modal system**

    In `public/app.js`, add before `// Tab Switching` (around line 30):

    ```js
    // ─── Modal System ──────────────────────────────────────
    let modalEl = null

    function showModal(title, content) {
      hideModal()
      const overlay = document.createElement('div')
      overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40'
      overlay.onclick = (e) => { if (e.target === overlay) hideModal() }
      overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 class="text-base font-semibold text-gray-900">${escHtml(title)}</h3>
            <button onclick="hideModal()" class="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
          <div class="px-6 py-4 overflow-y-auto text-sm text-gray-700 space-y-3">${content}</div>
        </div>`
      document.body.appendChild(overlay)
      modalEl = overlay
      // Escape key handler
      document.addEventListener('keydown', handleModalKeydown)
    }

    function hideModal() {
      if (modalEl) { document.body.removeChild(modalEl); modalEl = null }
      document.removeEventListener('keydown', handleModalKeydown)
    }

    function handleModalKeydown(e) {
      if (e.key === 'Escape') hideModal()
    }
    ```

  - [ ] **Step 2: Add status card state machine**

    In the same section, add:

    ```js
    // ─── Status Card ────────────────────────────────────────
    function setExperimentState(prefix, state) {
      // prefix = 'e1', 'e2', etc.  state = 'ready' | 'running' | 'complete' | 'error'
      const readyEl = document.getElementById(`${prefix}-status-ready`)
      const completeEl = document.getElementById(`${prefix}-status-complete`)
      const statusCard = document.getElementById(`${prefix}-status`)
      const btn = document.getElementById(`${prefix}-btn`)
      const resultEl = document.getElementById(`${prefix}-result`)
      const actionsEl = document.getElementById(`${prefix}-actions`)
      
      if (!statusCard) return
      
      statusCard.classList.remove('hidden')
      if (readyEl) readyEl.classList.toggle('hidden', state !== 'ready')
      if (completeEl) completeEl.classList.toggle('hidden', state !== 'complete')
      
      if (state === 'running') {
        setLoading(btn, true)
        if (resultEl) resultEl.innerHTML = ''
        if (actionsEl) actionsEl.classList.add('hidden')
      } else {
        setLoading(btn, false)
      }
      
      if (state === 'complete' && actionsEl) {
        actionsEl.classList.remove('hidden')
      }
    }
    ```

  - [ ] **Step 3: Add Copy JSON and View Raw Response handlers**

    ```js
    // ─── Result Actions ──────────────────────────────────────
    async function copyResultAsJSON(prefix) {
      const data = ResultsStore.get(prefix)
      if (!data) return
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        // brief feedback
        const btn = document.querySelector(`[onclick*="copyResultAsJSON('${prefix}')"]`)
        if (btn) {
          const orig = btn.textContent
          btn.textContent = 'Copied!'
          setTimeout(() => { btn.textContent = orig }, 2000)
        }
      } catch (e) {
        console.error('Copy failed:', e)
      }
    }

    function viewRawResponse(prefix) {
      const data = ResultsStore.get(prefix)
      if (!data) return
      showModal('Raw Model Response', `<pre class="text-xs font-mono bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">${escHtml(JSON.stringify(data, null, 2))}</pre>`)
    }
    ```

  - [ ] **Step 4: Add modal content constants**

    Add after `ResultsStore` (end of its section, around line 200 in app.js):

    ```js
    // ─── Modal Content: Research Design & Practical Example ──
    // Full text sourced from docs/changes/*.html files.
    // Each constant is an HTML string used by showModal().

    const RD_CONTENT_E1 = `<div class="space-y-4">
      <div><h4 class="font-medium text-gray-900 mb-1">Research Objective</h4><p>Determine whether a multimodal large language model can accurately transform heterogeneous financial documents into structured accounting data suitable for downstream compliance reasoning.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Technical Uncertainty</h4><p>Real-world financial documents vary significantly in layout, language, image quality, lighting conditions, document damage and formatting. It is uncertain whether a multimodal large language model can consistently extract accounting-relevant information with sufficient accuracy for automated compliance reasoning.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Hypothesis</h4><p>A multimodal large language model can accurately extract structured accounting fields from diverse financial documents with sufficient precision to support automated compliance reasoning.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Experimental Design</h4><p>Each receipt is processed using a single extraction pipeline without manual intervention. The extracted accounting fields are compared against manually prepared ground-truth annotations. Extraction performance is independently evaluated for each accounting field.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Evaluation Metrics</h4><p>The following structured accounting fields are evaluated: Vendor, Transaction Date, Amount, Currency, Expense Category, Line Items. Performance is measured using field-level extraction accuracy.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Expected Evidence</h4><p>The experiment should demonstrate measurable extraction accuracy across each accounting field and identify which fields are sufficiently reliable for downstream semantic reasoning.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Research Significance</h4><p>This experiment establishes the data quality baseline upon which every subsequent reasoning experiment depends.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Dependencies</h4><p>None. This experiment represents Layer 1 of the Compliance Intelligence Engine.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Role within the Compliance Intelligence Engine</h4><p>E1 transforms unstructured financial documents into structured accounting information. The structured output produced by this experiment becomes the input for all downstream policy grounding, semantic reasoning and compliance decision experiments.</p></div>
    </div>`

    const PE_CONTENT_E1 = `<div class="space-y-4">
      <div><h4 class="font-medium text-gray-900 mb-1">What Happens</h4><p>The user uploads a receipt. The engine analyses the document using a multimodal large language model. Structured accounting fields are extracted. Any field that cannot be read with sufficient confidence is returned as null rather than inferred. The structured accounting data is passed to the Compliance Intelligence Engine. Downstream reasoning experiments evaluate policy compliance using the extracted information.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Practical Success</h4><p>The extracted accounting fields match the manually verified receipt data with sufficient accuracy to support downstream compliance reasoning.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Practical Failure</h4><p>The engine invents unreadable values, incorrectly extracts material accounting fields or produces structured data that cannot be relied upon for downstream reasoning.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Why This Matters</h4><p>Every downstream reasoning experiment assumes that the accounting data is accurate. If receipt extraction is unreliable, the reasoning engine cannot produce reliable compliance decisions regardless of the quality of the reasoning model.</p></div>
      <div><h4 class="font-medium text-gray-900 mb-1">Role within the Complete Research Programme</h4><p>Layer 1 — Document Understanding: Receipt → OCR Extraction → Structured Accounting Data → Policy Grounding → Semantic Reasoning → Compliance Decision</p></div>
    </div>`
    ```

    Continue adding constants for E2–E6, GT, PE, ST as `RD_CONTENT_E2`, `PE_CONTENT_E2`, etc., with full text from each HTML file in `docs/changes/`.

    **Source files for modal content:**
    - E2: `docs/changes/E2 — Direct Policy Reasoning Baseline ｜ Notion (7_17_2026 3：49：43 PM).html`
    - E3: `docs/changes/E3 — Structured Reasoning Evaluation ｜ Notion (7_17_2026 3：49：53 PM).html`
    - E4: `docs/changes/E4 — Context-Sensitive Reasoning ｜ Notion (7_17_2026 3：50：02 PM).html`
    - E5: `docs/changes/E5 — Ambiguity & Uncertainty Handling ｜ Notion (7_17_2026 3：50：09 PM).html`
    - E6: `docs/changes/E6 — Adversarial Policy Stress Test ｜ Notion (7_17_2026 3：50：16 PM).html`
    - GT: `docs/changes/GT — Ground Truth Annotation ｜ Notion (7_17_2026 3：50：26 PM).html`
    - PE: `docs/changes/PE — Policy Editor ｜ Notion (7_17_2026 3：50：34 PM).html`
    - ST: `docs/changes/ST — Research Configuration ｜ Notion (7_17_2026 3：50：43 PM).html`

  - [ ] **Step 5: Verify**

    ```bash
    npm start
    ```
    Check: Open any tab → modal buttons not yet visible (they'll be added when tab HTML is restructured in later tasks) but functions exist in console: `typeof showModal`, `typeof setExperimentState`, `typeof copyResultAsJSON`, `typeof viewRawResponse` all return `"function"`.

  **Commit**: YES
  - Message: `feat: add modal system, status card state machine, result action handlers`
  - Files: `public/app.js`

---

- [x] 3. style.css additions

  **What to do**:
  - Add modal overlay styles
  - Add status card transition animation
  - Add any missing transitions for the new components

  **Files**: `public/style.css`

  **Steps**:

  - [ ] **Step 1: Add CSS**

    Append to `public/style.css`:

    ```css
    /* ─── Modal System ─────────────────────────────────────── */
    .modal-overlay {
      animation: modalFadeIn 0.15s ease-out;
    }
    .modal-card {
      animation: modalSlideIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalSlideIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ─── Status Card ──────────────────────────────────────── */
    .status-card {
      transition: opacity 0.2s ease;
    }
    .status-card-enter {
      animation: statusEnter 0.25s ease-out;
    }
    @keyframes statusEnter {
      from { opacity: 0; max-height: 0; }
      to { opacity: 1; max-height: 100px; }
    }
    ```

  - [ ] **Step 2: Verify**

    ```bash
    npm start
    ```
    CSS file loads → no console errors.

  **Commit**: YES
  - Message: `style: add modal and status card animations`
  - Files: `public/style.css`

---

- [x] 4. E1: OCR Extraction Baseline (template/prototype)

  **What to do**:
  - Restructure E1 tab panel HTML: add Research Design + Practical Example buttons, About panel, Status Card, helper text, new button text, actions block
  - Update `runE1()` in app.js: integrate status card transitions, hide old `info-btn` usage
  - Add actions visibility logic
  - Wire up modal content constants

  **Files**:
  - Modify: `public/index.html` (tab-e1 div, lines 42-62)
  - Modify: `public/app.js` (runE1 function + add event listener in runE1 for status)

  **Steps**:

  - [ ] **Step 1: Restructure E1 HTML**

    Replace the entire `#tab-e1` content (lines 42-62) in `public/index.html`:

    ```html
    <!-- E1: OCR Extraction Baseline -->
    <div id="tab-e1" class="tab-panel">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-lg font-semibold">E1: OCR Extraction Baseline</h2>
        <div class="flex gap-2">
          <button onclick="showModal('E1: OCR Extraction Baseline — Research Design', RD_CONTENT_E1)" class="border border-gray-300 bg-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50">Research Design</button>
          <button onclick="showModal('E1: OCR Extraction Baseline — Practical Example', PE_CONTENT_E1)" class="border border-gray-300 bg-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50">Practical Example</button>
        </div>
      </div>
      <p class="text-sm text-gray-500 mb-4">Upload a receipt to evaluate the model's ability to accurately transform unstructured financial documents into structured accounting data for downstream compliance reasoning.</p>

      <!-- About This Experiment -->
      <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-600 mb-4">
        This experiment forms the foundation of the entire reasoning pipeline. Every subsequent experiment depends upon the structured accounting data produced by E1.
      </div>

      <!-- Status Card -->
      <div id="e1-status" class="bg-white rounded-lg border border-gray-200 p-4 mb-4 status-card">
        <div id="e1-status-ready">
          <p class="text-sm font-medium text-gray-900">Ready to Run</p>
          <p class="text-xs text-gray-500 mt-1">Upload a receipt file to begin the OCR extraction experiment.</p>
        </div>
        <div id="e1-status-complete" class="hidden">
          <p class="text-sm font-medium text-green-700">&#10003; Extraction Complete</p>
          <p class="text-xs text-gray-500 mt-1">Structured accounting data has been successfully extracted.</p>
        </div>
      </div>

      <!-- Controls -->
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <label class="block text-sm font-medium mb-2">Receipt file (JPG, PNG, PDF)</label>
        <input type="file" id="e1-file" accept="image/*,.pdf" class="block w-full text-sm border border-gray-300 rounded px-3 py-2 mb-4">
        <button id="e1-btn" data-label="Run Experiment" onclick="runE1()" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Run Experiment</button>
        <p class="text-xs text-gray-400 mt-2">Execute OCR extraction experiment</p>
      </div>

      <!-- Results -->
      <div id="e1-result" class="mt-4"></div>

      <!-- Actions -->
      <div id="e1-actions" class="mt-4 flex gap-2<?php /* hidden by default, shown on complete */ ?>">
        <button onclick="exportResultAsJSON('e1')" class="text-xs text-gray-400 hover:text-blue-600">Download JSON</button>
        <button onclick="exportResultAsCSV('e1')" class="text-xs text-gray-400 hover:text-blue-600">Download CSV</button>
        <button onclick="copyResultAsJSON('e1')" class="text-xs text-gray-400 hover:text-blue-600">Copy JSON</button>
        <button onclick="viewRawResponse('e1')" class="text-xs text-gray-400 hover:text-blue-600">View Raw Response</button>
        <span class="text-xs text-gray-400 ml-2">Exports include the structured extraction results. Use "View Raw Response" to inspect the unformatted model output.</span>
      </div>
    </div>
    ```

    Note: The actions div starts with class `hidden` — add it explicitly:
    ```html
    <div id="e1-actions" class="mt-4 flex gap-2 hidden">
    ```

  - [ ] **Step 2: Update runE1 in app.js**

    In `runE1()` function (around line 366 in app.js), integrate status card:

    ```js
    async function runE1() {
      const fileInput = document.getElementById('e1-file')
      const file = fileInput.files[0]
      if (!file) return showError('e1-result', 'Please select a receipt file')
      
      setExperimentState('e1', 'running')
      showResult('e1-result', '<p class="text-sm text-gray-500">Extracting fields...</p>')
      
      try {
        const data = await getFileData('e1-file')
        const result = await apiPost('/api/extract', { image: data })
        
        ResultsStore.set('e1', result)
        setExperimentState('e1', 'complete')
        renderE1Result(result)
      } catch (err) {
        setExperimentState('e1', 'error')
        showError('e1-result', err.message || 'Extraction failed')
      }
    }
    ```

  - [ ] **Step 3: Add renderE1Result helper**

    In app.js, add a helper to render the structured results panel:

    ```js
    function renderE1Result(data) {
      const fields = [
        { label: 'Vendor', key: 'vendor' },
        { label: 'Transaction Date', key: 'date' },
        { label: 'Amount', key: 'amount' },
        { label: 'Currency', key: 'currency' },
        { label: 'Expense Category', key: 'category' },
        { label: 'Line Items', key: 'lineItems' }
      ]
      const html = `<div class="bg-white rounded-lg border border-gray-200 p-6">
        <table class="w-full text-sm">
          ${fields.map(f => `<tr class="border-b border-gray-100 last:border-0">
            <td class="py-2 pr-4 text-gray-500 font-medium w-40">${f.label}</td>
            <td class="py-2 text-gray-900">${escHtml(data.result?.[f.key] ?? data[f.key] ?? '—')}</td>
          </tr>`).join('')}
        </table>
      </div>`
      showResult('e1-result', html)
    }
    ```

  - [ ] **Step 4: Verify**

    ```bash
    npm start
    ```
    Open http://localhost:3000 → E1 tab shows:
    - Research Design + Practical Example buttons (click → open modals)
    - About This Experiment panel
    - Status Card: "Ready to Run"
    - Button: "Run Experiment" with helper text
    - After running extraction → status changes to "Extraction Complete", actions appear
    - Copy JSON, View Raw Response work

  **Commit**: YES
  - Message: `feat: redesign E1 experiment page with modals, status card, and actions`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 5. E2: Direct Policy Reasoning Baseline

  **What to do**: Apply E1 template to E2. Same structure with:
  - Policy Variant dropdown + Project Phase dropdown (unlike E1 which has neither)
  - Button: "Run Experiment"
  - Helper: "Execute direct policy reasoning experiment"
  - Different about/modal/status text (from `docs/changes/E2 — Direct Policy Reasoning Baseline.html`)

  **Files**:
  - Modify: `public/index.html` (tab-e2 div, lines 64-104)
  - Modify: `public/app.js` (runE2 → integrate status card)

  **Steps**:

  - [ ] **Step 1: Restructure E2 HTML** — same template as E1 but with Policy Variant + Project Phase dropdowns preserved/repositioned inside the controls card. Button becomes "Run Experiment". Add Status Card, About panel, RD/PE buttons, actions.

  - [ ] **Step 2: Update runE2** — add `setExperimentState('e2', 'running/complete')` around existing API call.

  - [ ] **Step 3: Verify** — run npm start → E2 tab shows all new components, extraction still works.

  **Commit**: YES
  - Message: `feat: redesign E2 experiment page`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 6. E3: Structured Reasoning Evaluation

  **What to do**: Same template as E1. Differences:
  - Policy Variant + Project Phase dropdowns
  - Button: **"Reason & Verdict"**
  - Helper: "Execute structured reasoning evaluation."
  - Status: "Structured Reasoning Complete"
  - Must follow E1 hero layout exactly

  **Files**:
  - Modify: `public/index.html` (tab-e3)
  - Modify: `public/app.js` (runE3 → status card)

  **Steps**:

  - [ ] **Step 1: Restructure E3 HTML** — same template as E1/E2, with both dropdowns.

  - [ ] **Step 2: Update runE3** — add `setExperimentState('e3', ...)`.

  - [ ] **Step 3: Verify**.

  **Commit**: YES
  - Message: `feat: redesign E3 experiment page`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 7. E4: Context-Sensitive Reasoning

  **What to do**: Same template. **Key difference**: NO Project Phase dropdown (auto-evaluates all 3 phases).
  - Policy Variant dropdown only
  - Button: **"Test All Phases"**
  - Helper: "Evaluate the same transaction across every project phase."
  - Results: 3 panels side-by-side

  **Files**:
  - Modify: `public/index.html` (tab-e4)
  - Modify: `public/app.js` (runE4 → status card)

  **Steps**:

  - [ ] **Step 1: Restructure E4 HTML** — template but remove the Phase dropdown. Controls card has only file input + Policy Variant.

  - [ ] **Step 2: Update runE4** — add `setExperimentState('e4', ...)`.

  - [ ] **Step 3: Verify**.

  **Commit**: YES
  - Message: `feat: redesign E4 experiment page (auto-evaluate all phases)`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 8. E5: Ambiguity & Uncertainty Handling

  **What to do**: Same template. Has both Policy Variant + Project Phase dropdowns.
  - Button: **"Analyse Ambiguity"**
  - Helper: "Evaluate uncertainty..."
  - Results: Verdict, Confidence Level, Identified Ambiguity, Missing Information, etc.

  **Files**:
  - Modify: `public/index.html` (tab-e5)
  - Modify: `public/app.js` (runE5 → status card)

  **Steps**:

  - [ ] **Step 1: Restructure E5 HTML**

  - [ ] **Step 2: Update runE5**

  - [ ] **Step 3: Verify**.

  **Commit**: YES
  - Message: `feat: redesign E5 experiment page`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 9. E6: Adversarial Policy Stress Test

  **What to do**: Same template. **Key difference**: NO Policy Variant dropdown (auto-evaluates all 3 policies).
  - Project Phase dropdown only
  - Button: **"Test All Policies"**
  - Helper: "Evaluate the receipt against all policy variants simultaneously."
  - Results: 3 panels side-by-side (one per policy variant)
  - **Hallucination badge logic** in JS

  **Files**:
  - Modify: `public/index.html` (tab-e6)
  - Modify: `public/app.js` (runE6 → status card + hallucination badge)

  **Steps**:

  - [ ] **Step 1: Restructure E6 HTML** — template without Policy Variant dropdown.

  - [ ] **Step 2: Update runE6** — add status card. Add hallucination badge rendering.

    In `renderE6Result()` or the results display, add badge logic:
    ```js
    function renderE6HallucinationBadge(result) {
      if (result.policyName !== 'clear' && result.policy_clarity === 'clear') {
        return '<span class="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded">&#9888; hallucination</span>'
      }
      return ''
    }
    ```

  - [ ] **Step 3: Verify**.

  **Commit**: YES
  - Message: `feat: redesign E6 experiment page (auto-evaluate all policies + hallucination badges)`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 10. GT: Ground Truth Annotation (structural rework)

  **What to do**: Major restructure of the Annotate tab:
  - Receipt preview panel (image) shown side-by-side with annotation form
  - Receipt navigation: search + prev/next + "Receipt N of 132"
  - Receipt status display (New/Existing/Load Error)
  - Auto-populate fields from E1 extraction
  - Dual value recording (original E1 + human-corrected)
  - Research Design + Practical Example buttons

  **Files**:
  - Modify: `public/index.html` (tab-annotate)
  - Modify: `public/app.js` (initAnnotate, loadAnnotation, saveAnnotation — major rework)

  **Steps**:

  - [ ] **Step 1: Restructure GT HTML**

    Redesign the `#tab-annotate` div with:
    - RD/PE buttons (same pattern as experiments)
    - Receipt navigation bar (search, prev, next, counter)
    - Receipt preview (image tag, fills left column)
    - Receipt status (colored badge)
    - Fields form (right column, auto-populated)
    - Human Verdict assessment section
    - Save button + confirmation

    Layout: `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">` — preview on left, form on right.

  - [ ] **Step 2: Update GT JavaScript**

    Major rework of `initAnnotate()`, `loadAnnotation()`, and `saveAnnotation()`:
    - Add: receipt preview loading (image tag from receipt file path)
    - Add: receipt navigation with prev/next
    - Add: E1 extraction auto-populate (call `/api/extract` or read from cached E1 result)
    - Add: status display (badge/text at top of form)
    - Add: Original Value vs Corrected Value display per field
    - Add: required field validation on save

  - [ ] **Step 3: Verify**

    ```bash
    npm start
    ```
    Open GT tab → select receipt → preview shows, form auto-populates, edit fields, save.

  **Commit**: YES
  - Message: `feat: redesign ground truth annotation page with preview and enhanced navigation`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 11. PE: Policy Editor (enhancements)

  **What to do**:
  - Add Policy Status Summary before the editor form
  - Research-control notice (replace "Changes take effect immediately")
  - Version control: "Reason for Change" field, auto-increment version on save
  - Collapsible Phase 1/2/3 sections
  - Research Design + Practical Example buttons

  **Files**:
  - Modify: `public/index.html` (tab-policy-editor)
  - Modify: `public/app.js` (loadPolicyEditor, savePolicy)

  **Steps**:

  - [ ] **Step 1: Update PE HTML**

    Add before the editor form:
    ```html
    <!-- Policy Status Summary -->
    <div id="pe-status-summary" class="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
      <div><span class="text-gray-500">Status:</span> <span id="pe-status-label" class="font-medium text-green-700">Saved</span></div>
      <div><span class="text-gray-500">Version:</span> <span id="pe-version-label" class="font-medium">v1.0</span></div>
      <div><span class="text-gray-500">Last Updated:</span> <span id="pe-updated-label" class="text-gray-700">—</span></div>
      <div><span class="text-gray-500">Used in Runs:</span> <span id="pe-runs-label" class="text-gray-700">—</span></div>
    </div>
    ```

    Add "Reason for Change" field before Save button:
    ```html
    <div>
      <label class="block text-sm font-medium mb-1">Reason for Change</label>
      <input id="pe-change-reason" type="text" placeholder="Explain why this policy version is being changed" class="block w-full text-sm border border-gray-300 rounded px-3 py-2">
    </div>
    ```

    Add Research-control notice:
    ```html
    <div class="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700 mb-4">
      <strong>Research Control:</strong> Saved policy changes apply only to future experiment runs. Existing experiment results remain linked to the exact policy version used when they were generated.
    </div>
    ```

    Make Phase 1/2/3 sections collapsible:
    ```html
    <details class="border border-gray-200 rounded-lg">
      <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">Phase 1: Infrastructure Setup</summary>
      <div class="px-4 py-3 border-t border-gray-200">
        ...existing phase content...
      </div>
    </details>
    ```

  - [ ] **Step 2: Update PE JavaScript**

    - Update `loadPolicyEditor()` to populate status summary
    - Update `savePolicy()` to require change reason, increment version

  - [ ] **Step 3: Verify**

  **Commit**: YES
  - Message: `feat: enhance policy editor with versioning, status summary, collapsible phases`
  - Files: `public/index.html`, `public/app.js`

---

- [x] 12. ST: Research Configuration (rename + restructure)

  **What to do**:
  - Rename "Settings" → "Research Configuration" everywhere
  - Add Configuration Status Summary before the form
  - Rename "Model Configuration" section → "Experiment Configuration"
  - Add Page Guide button (modal explaining controls)
  - Add Research-control notice
  - Add Research Design + Practical Example buttons (with content from ST spec)

  **Files**:
  - Modify: `public/index.html` (tab-settings)
  - Modify: `public/app.js` (loadSettings, saveSettings — minor updates + page guide modal)

  **Steps**:

  - [ ] **Step 1: Update ST HTML**

    Replace section heading: "Model Configuration" → "Experiment Configuration". Add status summary before form. Add Page Guide button. Add research-control notice.

  - [ ] **Step 2: Update ST JavaScript**

    Add `showPageGuide()` function:
    ```js
    function showPageGuide() {
      showModal('ST: Research Configuration — Page Guide', `<div class="space-y-3">
        <p>This page controls the technical environment under which Experiments E1–E6 are executed, compared and reproduced.</p>
        <h4 class="font-medium">OpenRouter API Key</h4>
        <p>Authenticates requests to the model provider. Stored in browser local storage. Re-enter after switching browsers or clearing data.</p>
        <h4 class="font-medium">Vision Model (Layer 1)</h4>
        <p>Used for OCR extraction in E1. Changing this may alter E1 output and affect all downstream experiments.</p>
        <h4 class="font-medium">Reasoning Model (Layer 3)</h4>
        <p>Used for policy interpretation and verdicts in E2–E6. Switching models enables controlled comparison.</p>
        <h4 class="font-medium">Currency Override</h4>
        <p>Controls whether receipt currency or a forced currency is used in experiment prompts.</p>
        <h4 class="font-medium"><strong>Research Control:</strong></h4>
        <p>Configuration changes apply only to future experiment runs. Every completed run retains the exact configuration used when executed.</p>
      </div>`)
    }
    ```

  - [ ] **Step 3: Verify**

    Tab label shows "ST: Research Configuration". All controls functional. Page Guide opens modal.

  **Commit**: YES
  - Message: `feat: redesign research configuration page with status summary and page guide`
  - Files: `public/index.html`, `public/app.js`

---

## Final Verification Wave

- [x] F1. **Full visual audit** — Open every tab. Check:
  - Header: JAMBUTTY logo + new title text
  - Footer: TOTAL FLOW logo + copyright
  - Tab labels all updated
  - Each tab has: RD/PE buttons, About panel, Status Card, Controls card, Actions block
  - E4 has no Phase dropdown (auto-evaluates)
  - E6 has no Policy dropdown (auto-evaluates)
  - GT: receipt preview loads, navigation works
  - PE: status summary, reason field, collapsible phases
  - ST: status summary, page guide button, "Experiment Configuration" heading

- [x] F2. **Functional test** — Run each experiment (E1–E6):
  - Status transitions: Ready → Running → Complete
  - Actions appear on complete
  - Copy JSON copies to clipboard
  - View Raw Response shows modal with JSON
  - Modal opens/closes correctly (✕ click, Escape, click-outside)

- [x] F3. **Regression check** — Verify no existing functionality broke:
  - Receipt bar still works (shared across all experiments)
  - Settings save/load still works
  - Policy Editor load/save still works
  - Annotation save/load still works
  - Tab switching still works (session state persists)

- [x] F4. **Code quality check**:
  - No console errors
  - No broken image references
  - Modal HTML properly escaped (no XSS from model output)
  - No hardcoded `data-tab` ID mismatches

---

## Commit Strategy

| Task | Message | Files |
|------|---------|-------|
| 1 | `feat: add header/footer with logos, update tab labels` | `public/index.html`, `public/jblogo.png`, `public/tflogo.png` |
| 2 | `feat: add modal system, status card state machine, result action handlers` | `public/app.js` |
| 3 | `style: add modal and status card animations` | `public/style.css` |
| 4 | `feat: redesign E1 experiment page with modals, status card, and actions` | `public/index.html`, `public/app.js` |
| 5 | `feat: redesign E2 experiment page` | `public/index.html`, `public/app.js` |
| 6 | `feat: redesign E3 experiment page` | `public/index.html`, `public/app.js` |
| 7 | `feat: redesign E4 experiment page (auto-evaluate all phases)` | `public/index.html`, `public/app.js` |
| 8 | `feat: redesign E5 experiment page` | `public/index.html`, `public/app.js` |
| 9 | `feat: redesign E6 experiment page (auto-evaluate all policies)` | `public/index.html`, `public/app.js` |
| 10 | `feat: redesign ground truth annotation page with preview and navigation` | `public/index.html`, `public/app.js` |
| 11 | `feat: enhance policy editor with versioning, status summary, collapsible phases` | `public/index.html`, `public/app.js` |
| 12 | `feat: redesign research configuration page with status summary and page guide` | `public/index.html`, `public/app.js` |

---

## Success Criteria

- All 9 tabs show redesigned layout with consistent template (RD/PE buttons, About panel, Status Card, Controls, Actions)
- Header shows JAMBUTTY logo + "TOTALFLOW Compliance Intelligence Engine"
- Footer shows TOTAL FLOW logo + copyright
- Tab navigation labels updated to spec
- Modal system works (open, close, keyboard, click-outside)
- Status card transitions work (Ready → Running → Complete)
- Copy JSON and View Raw Response work on all experiments
- E4 has no Phase dropdown (auto-evaluates all phases)
- E6 has no Policy dropdown (auto-evaluates all policies)
- GT shows receipt preview with navigation and auto-populated fields
- PE has versioning, status summary, collapsible phases
- ST shows "Research Configuration" with status summary and Page Guide
- No console errors, no broken functionality
