# Plan: Experiment Platform Polish — Policy Editor, State Persistence, Scientific Export

## TL;DR

> **Quick Summary**: Transform the research prototype into a polished experimental platform with editable policies (Terms & Conditions), per-tab state persistence, shared receipt across experiments, experiment description modals, and CSV/JSON results export for the scientific paper.
>
> **Deliverables**:
> - ℹ Experiment info modals (hypothesis, methodology, expected output)
> - "Policy Editor" tab (edit all 3 policies: phases, allowed/restricted/forbidden)
> - Shared receipt bar + per-tab state persistence (sessionStorage, survives F5)
> - Results export (CSV for flat experiments, JSON for E4/E6, global export)
> - Extraction caching (deduplicate vision API calls for same receipt)
> - Fix API key localStorage inconsistency
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: State Manager → Shared Receipt → Per-Tab State → Results Store → Export

---

## Context

### Original Request
Пользователь хочет завершить и придать экспериментам законченный научный вид: кнопки описания для каждой вкладки, редактируемые политики (Terms & Conditions), сохранение состояния вкладок (загруженный чек, настройки), общий чек для всех экспериментов, экспорт результатов CSV/JSON.

### Interview Summary
- **Policy Editor**: Отдельная 9-я вкладка "Policy Editor" в навигации
- **Receipt persistence**: sessionStorage (переживает F5, очищается при закрытии вкладки)
- **Results export**: Да, CSV + JSON

### Metis Review
**Critical findings** (addressed in plan):
1. **API key уже сохранён в localStorage** — код на `app.js:28` читает ключ из localStorage, хотя UI говорит "только в памяти". Нужно либо исправить код, либо документацию.
2. **multer импортирован но не используется** (server.js:14) — не влияет, но стоит зачистить.
3. **Policy Editor требует нового UI-паттерна** — аннотации плоские (8 полей), политики иерархические (3 фазы × 4+ поля × массивы).
4. **Извлечение (OCR) должно кешироваться** — иначе каждый эксперимент делает отдельный vision API вызов для одного чека.
5. **E4/E6 не подходят для CSV** — вложенные массивы, нужен JSON.
6. **Валидация на сервере обязательна** — поломанный JSON политики вызывает 500 ошибку на всех экспериментах.

---

## Work Objectives

### Core Objective
Добавить 6 взаимосвязанных функций для превращения прототипа в полноценную экспериментальную научную платформу.

### Concrete Deliverables
- `public/app.js` — shared state manager, per-tab persistence, export, policy editor UI
- `public/index.html` — new Policy Editor tab, info modals, shared receipt bar
- `public/style.css` — modal overlay, receipt bar, export button styles
- `server.js` — Policy CRUD routes (GET/PUT /api/policies[/:name])
- `lib/policy.js` — validatePolicy(), resetPolicy(), writePolicy()

### Definition of Done
- [ ] All 9 tabs render without errors (E1-E6 + Annotate + Settings + Policy Editor)
- [ ] Upload receipt once → visible on all experiment tabs
- [ ] Switch tabs → selections (policy, phase) and results preserved
- [ ] F5 refresh → receipt survives, selections survive, results survive
- [ ] Edit any policy → save → immediately reflected in experiment tabs
- [ ] Export button produces downloadable CSV/JSON
- [ ] API key no longer stored in localStorage (or documented if intentional)

### Must Have
- Shared receipt state across all 6 experiment tabs
- Per-tab state persistence (sessionStorage)
- Policy Editor tab with CRUD for all 3 policies
- Experiment info modals (ℹ button per tab)
- Results export (CSV + JSON)
- Extraction caching (deduplicate vision calls for same receipt hash)
- Fix API key localStorage inconsistency

### Must NOT Have (Guardrails)
- NO create/delete policies — only edit existing 3 (clear/vague/contradictory)
- NO phase count changes — exactly 3 phases per policy (breaks server-side iteration)
- NO new npm dependencies or CDN scripts beyond existing Tailwind
- NO build step, bundler, or transpiler
- NO modification to three-layer pipeline architecture
- NO modification to three-class verdict schema (justified/suspicious/unclear)
- NO modification to category enum (equipment/software/travel/meals/services/supplies/other)
- NO batch run mode in this phase (deferred)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (no test framework)
- **Automated tests**: NO (research prototype, manual QA via browser)
- **Agent-Executed QA**: YES — Playwright for browser automation

### QA Policy
Every task includes agent-executed QA scenarios using Playwright:
- Navigate, click tabs, assert DOM content
- Upload file via `input[type=file]`, verify base64 state
- Fill form fields, save, reload page, verify persistence
- Click export buttons, verify download
- Take screenshots as evidence

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — Start Immediately):
├── Task 1: Fix API key localStorage bug [quick]
├── Task 2: Build shared state manager (sessionStorage) [quick]
├── Task 3: Backend Policy CRUD routes + validation [unspecified-high]
└── Task 4: Modal/overlay system + experiment metadata config [quick]

Wave 2 (Core Features — MAX PARALLEL):
├── Task 5: Experiment Info modal (ℹ button) [visual-engineering]
├── Task 6: Shared receipt bar + extraction cache [deep]
├── Task 7: Per-tab state persistence [quick]
└── Task 8: Policy Editor tab UI + wiring [visual-engineering]

Wave 3 (Export & Polish):
├── Task 9: Results store + CSV/JSON export [unspecified-high]
├── Task 10: Scientific polish (metadata, timestamps, config snapshots) [visual-engineering]
└── Task 11: CSS polish, edge cases, cleanup [quick]

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA — Playwright scenarios (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 2 → Task 7 → Task 9 → F1-F4
```

---

## TODOs

- [x] 1. Fix API Key localStorage Inconsistency

  **What to do**:
  - `public/app.js`: In `loadSettings()`, remove `apikeyEl.value = s.apiKey;` so the input stays empty (key is loaded into `_apiKey` variable silently but not shown).
  - `public/app.js`: In `saveSettings()`, remove `apiKey` from the `localStorage.setItem('psa_settings', ...)` call — only persist `model` and `visionModel`.
  - Update the Settings tab placeholder text: "Stored in browser session only — not persisted to disk."
  - Wait — the user chose `sessionStorage` for receipt persistence. The API key inconsistency needs resolution: make it consistent rather than just removing. Keep the key in-memory (`_apiKey` variable), do NOT persist to localStorage.

  **Must NOT do**:
  - Breaking existing functionality where `_apiKey` is used
  - Changing the server-side API key handling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: None
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] After page refresh, API key input field shows empty (not pre-filled)
  - [ ] But API key stored in `_apiKey` variable is still used for API calls
  - [ ] `localStorage.psa_settings` no longer contains `apiKey` key
  - [ ] Setting API key in input and clicking Save → works for all experiments

  **QA Scenarios**:
  ```
  Scenario: API key no longer persisted to localStorage
    Tool: Playwright
    Preconditions: Server running at localhost:3000
    Steps:
      1. Navigate to http://localhost:3000
      2. Click Settings tab
      3. Enter "sk-or-test-key" in API key input
      4. Save Settings
      5. Open DevTools → Application → Local Storage → psa_settings
    Expected Result: psa_settings does NOT contain "apiKey" field
    Evidence: screenshot of localStorage panel
  
  Scenario: API key still works for experiments
    Tool: Playwright  
    Preconditions: Server running, valid API key needed
    Steps:
      1. Enter API key in Settings tab
      2. Switch to E1 tab
      3. Upload a receipt file
      4. Click Extract Fields
    Expected Result: API call succeeds (or gives meaningful error, not "apiKey is required")
    Evidence: terminal log
  ```

- [x] 2. Build Shared State Manager (sessionStorage)

  **What to do**:
  - Create a new section in `public/app.js`: `// ─── Shared State Manager ───`
  - Build a `StateManager` object with:
    - `setReceipt(fileData)` — store `{ base64, mimeType, filename, hash, timestamp }` in `sessionStorage.psa_receipt`
    - `getReceipt()` — retrieve from sessionStorage
    - `clearReceipt()` — remove
    - `setTabState(tabName, state)` — store per-tab state in `sessionStorage.psa_tab_{tabName}`
    - `getTabState(tabName)` — retrieve
    - `clearTabState(tabName)` — remove
    - `computeHash(base64)` — simple first-20-chars hash for extraction cache key
    - `setExtraction(hash, data)` — cache OCR result in `sessionStorage.psa_extraction_{hash}`
    - `getExtraction(hash)` — retrieve cached extraction
  - Receipt storage must account for 10MB sessionStorage limit (6MB base64 images are safe)
  - Implement `window.addEventListener('beforeunload', ...)` to flush any pending writes

  **Must NOT do**:
  - Store API key in sessionStorage
  - Use synchronous operations that could freeze UI during large base64 writes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `StateManager.setReceipt(data)` → `getReceipt()` returns same data after page refresh (F5)
  - [ ] `StateManager.setTabState('e2', {policy:'vague', phase:1})` → `getTabState('e2')` returns same after tab switch
  - [ ] `StateManager.computeHash('abc123...')` returns consistent 20-char string
  - [ ] `StateManager.setExtraction(hash, data)` → `getExtraction(hash)` returns data
  - [ ] `clearReceipt()` removes all receipt-related sessionStorage entries

  **QA Scenarios**:
  ```
  Scenario: Receipt persists after F5
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Open browser, navigate to app
      2. Execute in console: window.APP.state.setReceipt({base64:'AAAA', mimeType:'image/jpeg', filename:'test.jpg'})
      3. Verify console: window.APP.state.getReceipt().filename === 'test.jpg'
      4. Reload page (F5)
      5. Execute in console: window.APP.state.getReceipt().filename
    Expected Result: filename is 'test.jpg' (survived F5)
    Evidence: console output screenshot
  ```

- [x] 3. Backend Policy CRUD Routes + Validation

  **What to do**:
  - Add to `server.js`:
    - `GET /api/policies` — return list of all 3 policies: `[{ name, description, editable: true }]`
    - `GET /api/policies/:name` — return full policy JSON (`loadPolicy(name)`)
    - `PUT /api/policies/:name` — update one policy (validate + save)
  - Add validation function to `lib/policy.js`:
    - `validatePolicy(data)` — checks: `policy_name` unchanged, `phases.length === 3`, each phase has `name`, `description`, `allowed` (array), `restricted` (array), `forbidden` (array)
    - Returns `{ valid: true }` or `{ valid: false, errors: [...] }`
  - Add `writePolicy(name, data)` to `lib/policy.js` — writes validated JSON
  - Add `resetPolicy(name)` — returns default policy content (in-memory default)
  - Handle errors gracefully: invalid JSON → 400, file write error → 500
  - **CRITICAL**: Validate before write. A corrupt policy file crashes ALL experiment routes.

  **Must NOT do**:
  - Allow changing `policy_name` (it's the lookup key)
  - Allow creating new policies (E6 iterates hardcoded `['clear','vague','contradictory']`)
  - Allow deleting policies
  - Allow changing phase count from 3

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 8 (Policy Editor UI)
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `GET /api/policies` returns array of 3 policy names
  - [ ] `GET /api/policies/clear` returns full policy JSON with all 3 phases
  - [ ] `PUT /api/policies/clear` with valid JSON → saves and returns `{ ok: true }`
  - [ ] `PUT /api/policies/clear` with invalid JSON → returns 400 with specific errors
  - [ ] `PUT /api/policies/clear` with `policy_name: "contradictory"` → returns 400 (name mismatch)
  - [ ] `PUT /api/policies/clear` with 2 phases → returns 400
  - [ ] After PUT, `GET /api/policies/clear` returns updated data
  - [ ] `GET /api/policies/nonexistent` returns 404

  **QA Scenarios**:
  ```
  Scenario: Edit clear policy — happy path
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. Read: curl http://localhost:3000/api/policies/clear | python3 -c "import sys,json; print(json.load(sys.stdin)['phases'][0]['allowed'])"
      2. PUT with modified Phase 1 allowed: curl -X PUT http://localhost:3000/api/policies/clear -H 'Content-Type: application/json' -d '{"policy_name":"clear","project_name":"Test","description":"Test","phases":[{"name":"P1","description":"","allowed":["test-item"],"restricted":[],"forbidden":[]},{"name":"P2","description":"","allowed":[],"restricted":[],"forbidden":[]},{"name":"P3","description":"","allowed":[],"restricted":[],"forbidden":[]}]}'
      3. Verify: curl http://localhost:3000/api/policies/clear | python3 -c "import sys,json; print(json.load(sys.stdin)['phases'][0]['allowed'])"
    Expected Result: Allowed list contains "test-item"
    Evidence: terminal output

  Scenario: Wrong policy_name → 400 rejection
    Tool: Bash (curl)
    Steps:
      1. PUT with mismatched name: curl -X PUT http://localhost:3000/api/policies/clear -H 'Content-Type: application/json' -d '{"policy_name":"contradictory","phases":[{},{},{}]}'
    Expected Result: HTTP 400, error message includes "policy_name mismatch"
    Evidence: terminal output

  Scenario: Corrupt policy file → graceful error
    Tool: Bash (curl)
    Steps:
      1. Write invalid JSON: echo "broken" > data/policy/policy_clear.json
      2. GET: curl http://localhost:3000/api/policies/clear
    Expected Result: HTTP 500 but returns structured JSON error, not crash
    Evidence: terminal output
  ```

- [x] 4. Modal/Overlay System + Experiment Metadata Config

  **What to do**:
  - Build a reusable modal system in `public/app.js`:
    - `showModal(title, bodyHTML)` — creates overlay + centered content box with close button
    - `closeModal()` — removes overlay, restores body scroll
    - Keyboard listener for Escape key (body-scoped, not input-scoped when textarea focused)
    - Backdrop click → close
    - Z-index: 50, fixed positioning, full viewport overlay
  - Add modal styles to `public/style.css`:
    - `.modal-overlay` — fixed inset-0, bg-black/50, z-50, flex items-center justify-center
    - `.modal-content` — bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto p-6 relative
    - `.modal-close` — absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-gray-700
  - Create experiment metadata configuration in `public/app.js`:
    ```javascript
    const EXPERIMENT_META = {
      e1: {
        title: "E1: OCR Extraction Baseline",
        hypothesis: "A multimodal LLM can reliably extract structured fields (vendor, date, amount, currency, category, line items) from real-world receipt photos of varying quality, language, and format.",
        methodology: "Run google/gemini-2.5-flash on all 26 receipts via /api/extract. Compare extracted fields against manual ground truth annotations. Field-level precision/recall per field.",
        expectedOutput: "Table of extracted fields (vendor, date, amount, currency, category, line items, vendor_address, tax_id, payment_method).",
        layer: "Layer 1 — OCR & Extraction",
        prompt: "PROMPTS.extraction — instructs model to return null for unreadable fields",
        experimentsUsing: "All experiments depend on E1's extraction quality. E2-E6 consume Layer 1 output."
      },
      // ... e2-e6 to be filled similarly
    }
    ```
  - Wire each E1-E6 tab to show modal via ℹ button in the heading
  - Include sections in modal: Hypothesis, Methodology, Expected Output, Layer, Prompt Used
  - Expose via `window.APP.showExperimentInfo(tabName)` for onclick handlers

  **Must NOT do**:
  - Import any modal library (no CDN modals)
  - Use animation libraries
  - Hardcode experiment descriptions in HTML — keep in JS config object

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 5 (ℹ button wiring)
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Modal opens with correct content for each experiment (E1-E6)
  - [ ] Close button works
  - [ ] Escape key closes modal
  - [ ] Backdrop click closes modal (except when textarea/input focused)
  - [ ] Content scrolls properly when longer than viewport
  - [ ] Same modal pattern reused for all 6 experiments
  - [ ] Body scroll is locked when modal is open

  **QA Scenarios**:
  ```
  Scenario: Open and close E1 info modal
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to http://localhost:3000
      2. Click ℹ button next to "E1: OCR Extraction Baseline"
      3. Assert modal is visible, title contains "OCR Extraction"
      4. Assert "Hypothesis" text is present in modal body
      5. Press Escape
    Expected Result: Modal closes, E1 tab content is visible again
    Evidence: screenshot 1 (modal open) + screenshot 2 (modal closed)

  Scenario: Verify E6 modal documents hallucination detection
    Tool: Playwright
    Steps:
      1. Navigate to app
      2. Click E6 tab
      3. Click ℹ button on E6 heading
      4. Scroll modal content
    Expected Result: Modal mentions "hallucination" and "policy_clarity"
    Evidence: screenshot of E6 modal content
  ```

- [x] 5. Experiment Info Button Wiring

  **What to do**:
  - In `public/index.html`, add `ℹ info-button` button next to each experiment heading:
    - Before line 35: `<div class="flex items-center gap-2"><h2 class="text-lg font-semibold mb-1">E1: OCR Extraction Baseline</h2><button onclick="window.APP.showExperimentInfo('e1')" class="info-btn text-gray-400 hover:text-blue-600 text-lg" title="About this experiment">ℹ</button></div>`
    - Same pattern for E2 (line 49), E3 (line 84), E4 (line 119), E5 (line 143), E6 (line 179)
    - Replace existing `<h2>` with `<div class="flex items-center gap-2"><h2>...</h2><button>ℹ</button></div>`
  - Wire `window.APP.showExperimentInfo(tabName)` from Task 4 to `showModal(meta.title, renderMetaHTML(meta))`
  - Add info button style to `public/style.css`:
    - `.info-btn` — no background, rounded-full, cursor-pointer, transition
    - `.info-btn:hover` — color change
  - Expose modal functions on `window.APP` for onclick access

  **Must NOT do**:
  - Overcomplicate the button styling (keep minimal)
  - Add info buttons to Annotate, Settings, or Policy Editor tabs (those are self-explanatory)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: None
  - **Blocked By**: Task 4 (Modal system)

  **Acceptance Criteria**:
  - [ ] ℹ button appears next to E1-E6 headings
  - [ ] Clicking ℹ opens modal with experiment description
  - [ ] All 6 modals have correct content (hypothesis, methodology, expected output)
  - [ ] Info button has hover effect (visual feedback)
  - [ ] No ℹ button on Annotate, Settings, Policy Editor tabs

  **QA Scenarios**:
  ```
  Scenario: All 6 experiment tabs have info buttons
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to http://localhost:3000
      2. For each experiment tab (E1-E6): click tab, assert ℹ button exists
      3. Click Annotate tab, assert no ℹ button
    Expected Result: E1-E6 show ℹ button, Annotate does not
    Evidence: screenshot per tab
  ```

- [x] 6. Shared Receipt Bar + Extraction Cache

  **What to do**:
  - Add a shared receipt upload section at the top of the main content area (above experiment panels):
    ```html
    <div id="receipt-bar" class="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex items-center gap-4 hidden">
      <div class="flex-1 min-w-0">
        <span class="text-sm font-medium text-gray-700">Receipt:</span>
        <span id="receipt-filename" class="text-sm text-gray-500 truncate"></span>
      </div>
      <button id="receipt-change-btn" class="text-xs text-blue-600 hover:text-blue-800">Change</button>
      <button id="receipt-clear-btn" class="text-xs text-gray-400 hover:text-red-600">✕ Clear</button>
    </div>
    ```
  - Modify each experiment's file input to use shared state:
    - When user uploads file in ANY experiment tab → store in `StateManager.setReceipt()`
    - Show receipt-bar with filename
    - All other experiment tabs see the receipt-bar
    - Each experiment's `getFileData()` first checks `StateManager.getReceipt()` before showing file input
  - Implement extraction cache:
    - Before calling `/api/extract` or `/api/verdict`, compute hash via `StateManager.computeHash(base64)`
    - Check `StateManager.getExtraction(hash)`
    - If cached → use cached extraction, skip vision API call
    - If not → call API, cache result
    - Show "Using cached extraction" indicator in results
    - When user uploads new receipt → clear extraction cache for old hash
  - Store extraction metadata: hash, visionModel used, timestamp, fields extracted
  - Make file inputs show "Use shared receipt" placeholder when receipt-bar is active, or keep the file input disabled with a note

  **Must NOT do**:
  - Remove individual file inputs (keep as fallback / override)
  - Store base64 in sessionStorage if it fails 10MB limit (handle gracefully)
  - Cache across different vision models (hash+model combination)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: None
  - **Blocked By**: Task 2 (State Manager)

  **Acceptance Criteria**:
  - [ ] Receipt bar appears after first file upload in any experiment
  - [ ] Receipt bar shows filename
  - [ ] All experiment tabs show the receipt bar and use the shared receipt
  - [ ] Clicking "Change" opens file picker
  - [ ] Clicking "Clear" removes receipt from all tabs
  - [ ] Same receipt → second experiment uses cached extraction (verify via network tab — no duplicate vision API calls)
  - [ ] Different receipt → new extraction call made

  **QA Scenarios**:
  ```
  Scenario: Upload once, use in another experiment
    Tool: Playwright
    Preconditions: Server running, API key configured
    Steps:
      1. Go to E1 tab
      2. Upload test receipt, click Extract Fields
      3. Wait for results to render
      4. Click E2 tab (no file input interaction)
      5. Click Get Verdict
    Expected Result: E2 uses the same receipt (no file re-upload needed), results rendered
    Evidence: screenshots of E1 result + E2 result (same filename shown)

  Scenario: Extraction cache hit
    Tool: Playwright
    Preconditions: Server running, API key set
    Steps:
      1. Open browser DevTools → Network tab
      2. Run E1 on a receipt (vision API call made)
      3. Switch to E3 tab
      4. Click Reason & Verdict
      5. Check Network tab for /api/verdict calls
    Expected Result: Single vision API call total (not two), second experiment uses cached extraction
    Evidence: network tab screenshot
  ```

- [x] 7. Per-Tab State Persistence

  **What to do**:
  - In `public/app.js`, add state save/restore for each experiment tab:
  - On tab switch (in the tab click handler): save current tab's state via `StateManager.setTabState(currentTab, state)`
  - State to save per experiment:
    - `e2`, `e3`, `e5`: `{ policy, phase }`
    - `e4`, `e6`: `{ policy, phase }`
    - `e1`: no selectors (just file + result)
    - All: `{ lastResult: resultHTML, lastTimestamp: ISO string }`
  - On tab switch TO a tab: restore via `StateManager.getTabState(tabName)`:
    - Re-populate `<select>` values
    - Re-render `lastResult` into result container
  - Modify tab click handler to run save/restore logic
  - Add save on experiment run: after result renders, auto-save to sessionStorage
  - Handle edge case: if sessionStorage fails (quota exceeded), degrade gracefully (log warning, continue without persistence)

  **Must NOT do**:
  - Persist the entire DOM (save only state data + lastResult HTML)
  - Persist across page refreshes (already handled by sessionStorage)
  - Store API key in any tab state

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 9 (Results export needs stable state)
  - **Blocked By**: Task 2 (State Manager)

  **Acceptance Criteria**:
  - [ ] E2: select policy=vague, phase=2, run → switch to E3 → switch back to E2 → policy=vague, phase=2 preserved
  - [ ] E4: run with results → switch to E5 → switch back → E4 results still visible
  - [ ] After F5: receipt is preserved (Task 6), tab selections are preserved
  - [ ] E1 has no selections to persist, but last result is shown

  **QA Scenarios**:
  ```
  Scenario: Tab state preserved across switches
    Tool: Playwright
    Preconditions: E2 has results rendered
    Steps:
      1. On E2 tab, note the selected policy and phase
      2. Click E3 tab
      3. Click E2 tab again
    Expected Result: Policy and phase selectors have same values, result is still visible
    Evidence: screenshots before and after tab switch

  Scenario: F5 preserves receipt and last tab
    Tool: Playwright
    Steps:
      1. Upload receipt on E1, get results
      2. Switch to E3 tab, select policy=contradictory, phase=1
      3. Press F5 (reload)
      4. Click E3 tab
    Expected Result: Receipt bar visible, policy=contradictory, phase=1
    Evidence: screenshot after F5
  ```

- [x] 8. Policy Editor Tab UI

  **What to do**:
  - Add new tab button in `public/index.html` navigation (before Settings):
    ```html
    <button class="tab-btn px-4 py-3 text-sm whitespace-nowrap" data-tab="policy-editor">Policy Editor</button>
    ```
  - Add `#tab-policy-editor` panel after existing experiment panels:
    - Policy selector dropdown (clear/vague/contradictory)
    - Policy name display (read-only)
    - Project name text input (editable)
    - Project description textarea (editable)
    - For each of 3 phases (side by side or vertical accordion):
      - Phase name input
      - Phase description textarea
      - Allowed items: tag-style input (type text + Enter to add, × to remove)
      - Restricted items: same tag-style input
      - Forbidden items: same tag-style input
    - Save button → PUT /api/policies/:name
    - Reset to Default button → re-read default policy
    - Status message (saved/error)
    - Warning banner when editing contradictory policy: "⚠ Internal contradictions are intentional for Experiment E6. Removing them will break the hallucination detection test."
  - Build tag-style input in `public/app.js`:
    - `createTagInput(containerId, items, onChange)` — renders tags + input field
    - Each tag is a `<span>` with × remove button
    - Enter key adds tag, Backspace on empty removes last tag
    - Commas also add tags
    - onChange callback returns updated array
  - Wire save button to `PUT /api/policies/:name`
  - Wire reset button to re-fetch default from server (or use in-memory defaults)
  - Use existing `saveAnnotation()` pattern (fetch + status message)
  - Add warning E6 note for contradictory policy in the tab UI

  **Must NOT do**:
  - Allow creating/deleting policies
  - Allow changing `policy_name`
  - Allow deleting phases or changing phase count
  - Use any external library for tag input

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: None
  - **Blocked By**: Task 3 (Backend CRUD routes)

  **Acceptance Criteria**:
  - [ ] Policy Editor tab is 9th tab in navigation
  - [ ] Select policy → loads current data from API
  - [ ] Edit phase name, save → re-read shows updated name
  - [ ] Add tag to allowed list → save → re-read shows new tag
  - [ ] Remove tag → save → tag gone
  - [ ] Reset to Default → reverts changes
  - [ ] Contradictory policy shows E6 warning banner
  - [ ] Invalid save (empty phase name) → validation error message
  - [ ] After save, experiment tabs immediately reflect new policy content

  **QA Scenarios**:
  ```
  Scenario: Edit policy phase name
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Click Policy Editor tab
      2. Clear policy selected by default
      3. Change Phase 1 name to "Custom Phase 1"
      4. Click Save
      5. Reload page
      6. Click Policy Editor tab, select Clear policy
    Expected Result: Phase 1 name is "Custom Phase 1"
    Evidence: before/after screenshots

  Scenario: Add item to allowed list
    Tool: Playwright
    Steps:
      1. Policy Editor tab
      2. Select "contradictory" policy
      3. Under Phase 1 allowed, type "test-item" and press Enter
      4. Click Save
      5. Switch to E6 tab
      6. Run E6
    Expected Result: "test-item" appears in the policy context given to the model
    Evidence: E6 result screenshot showing reasoning

  Scenario: Contradictory policy shows E6 warning
    Tool: Playwright
    Steps:
      1. Policy Editor tab
      2. Select "contradictory" from dropdown
    Expected Result: Warning banner visible: "Experiment E6 depends on contradictions"
    Evidence: screenshot
  ```

- [x] 9. Results Store + CSV/JSON Export

  **What to do**:
  - Build results store in `public/app.js`:
    - `ResultsStore` object backed by `sessionStorage.psa_results` (array)
    - `addResult(experimentId, data)` — push result with metadata
    - `getResults(experimentId)` — filter by experiment
    - `getAllResults()` — return all
    - `clearResults(experimentId)` — clear by experiment
    - `clearAllResults()` — clear all
  - Each result record:
    ```javascript
    {
      id: "e2-20260714T103021-001",
      experiment: "e2",
      timestamp: "2026-07-14T10:30:21.000Z",
      receipt: { filename: "receipt_001.jpg", hash: "..." },
      config: { model, visionModel, policy, phase },
      result: { verdict: "justified", reason: "..." }
    }
    ```
  - Auto-save result after each experiment run
  - Add export buttons on each experiment tab:
    - "Export JSON" — downloads single result as `.json`
    - "Export CSV" — downloads tabular data as `.csv` (E1/E2/E3/E5 only; E4/E6 JSON-only)
  - Add global export section in Settings tab:
    - "Export All Results (JSON)"
    - "Clear All Results"
  - Build CSV serialization per experiment type
  - Build JSON → file download utility: `downloadFile(content, filename, mimeType)`
  - Export filename format: `psa-{experiment}-{timestamp}.{csv|json}`

  **Must NOT do**:
  - Include base64 receipt data or API key in export

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11)
  - **Blocked By**: Task 7 (Per-tab state)

  **Acceptance Criteria**:
  - [ ] After running E2, result auto-saves to ResultsStore
  - [ ] "Export JSON" on E2 downloads valid `.json` with metadata
  - [ ] "Export CSV" on E2 downloads `.csv` with header + data row
  - [ ] E4 tab shows "Export JSON" but NO "Export CSV" button
  - [ ] Settings "Export All Results" downloads all results as JSON array
  - [ ] Downloaded JSON does NOT include `apiKey` or `base64`
  - [ ] Clear All Results → store empty

  **QA Scenarios**:
  ```
  Scenario: Export E2 result as CSV
    Tool: Playwright
    Preconditions: Server running, API key set, E2 has been run
    Steps:
      1. On E2 tab, click "Export CSV" button
      2. Wait for download
    Expected Result: CSV file downloaded with columns: timestamp, model, policy, phase, verdict, reason
    Evidence: read downloaded file content

  Scenario: Export all results as JSON
    Tool: Playwright
    Steps:
      1. Run E1, E2, E3
      2. Click Settings tab
      3. Click "Export All Results (JSON)"
    Expected Result: JSON file with 3 result objects
    Evidence: read downloaded file
  ```

- [x] 10. Scientific Polish — Metadata, Timestamps, Config Snapshots

  **What to do**:
  - Add experiment metadata display to each result card:
    - Timestamp, model, visionModel, policy variant, phase
    - Response time (wrap API call in `performance.now()`)
    - If cached extraction: show "Cached from [timestamp]"
  - Add "Run Info" line below verdict: `Model: ... | Policy: ... | Phase: ... | Runtime: 3.2s`
  - Add result counter to tab headings: `E2: No-CoT (3 runs)`
  - Add per-experiment run history: collapsible previous runs list
  - Add config drift detection: if model/policy changed since last run → show "⚡ Settings changed" warning
  - Show extraction metadata in E1: model used, field count, duration

  **Must NOT do**:
  - Add charts, visualizations, real-time updates, or websockets

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 11)
  - **Blocked By**: Task 7 (Per-tab state)

  **Acceptance Criteria**:
  - [ ] E1 result shows: extraction model, timestamp, field count, duration
  - [ ] E2 result shows: reasoning model, policy, phase, timestamp, duration
  - [ ] Cached extraction shows "Cached from [time]" label
  - [ ] Config drift shows warning badge
  - [ ] Tab heading shows run count: "E2: No-CoT (3 runs)"

  **QA Scenarios**:
  ```
  Scenario: Result metadata visible
    Tool: Playwright
    Preconditions: E3 has been run
    Steps:
      1. View E3 result area
    Expected Result: Small text shows model, policy, phase, timestamp, response time
    Evidence: screenshot of result with metadata

  Scenario: Config drift warning
    Tool: Playwright
    Steps:
      1. Run E2 with model=gemini-2.5-flash, policy=clear
      2. Change model in Settings
      3. View E2 tab
    Expected Result: "⚡ Settings changed since last run" badge
    Evidence: screenshot
  ```

- [x] 11. CSS Polish, Edge Cases, Cleanup

  **What to do**:
  - Add all new CSS to `public/style.css`:
    - `.modal-overlay`, `.modal-content`, `.modal-close`
    - `.info-btn`
    - `.receipt-bar`
    - `.tag-input`, `.tag` (for Policy Editor)
    - `.export-btn`
    - `.meta-text`, `.config-drift`, `.cache-badge`
  - Fix nav overflow for 9+ tabs (reduce padding, smaller font)
  - Add `.DS_Store` to `.gitignore`
  - Update `AGENTS.md` and `public/AGENTS.md` with new feature descriptions
  - Test edge cases: sessionStorage quota, receipt >10MB, empty states, error states

  **Must NOT do**:
  - Change existing visual identity or refactor existing CSS

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10)
  - **Blocked By**: Tasks 5-8 (need their CSS)

  **Acceptance Criteria**:
  - [ ] All new UI elements styled correctly
  - [ ] Nav scrolls properly with 9+ tabs on narrow viewport
  - [ ] No console errors on any tab
  - [ ] `.DS_Store` added to `.gitignore`
  - [ ] AGENTS.md files updated

  **QA Scenarios**:
  ```
  Scenario: All tabs load without console errors
    Tool: Playwright
    Steps:
      1. Visit each tab (E1-E6, Annotate, Settings, Policy Editor)
      2. Check browser console
    Expected Result: Zero console errors
    Evidence: console screenshot
  ```

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify each Must Have has implementation. Check each Must NOT Have is absent. Check evidence files in `.sisyphus/evidence/`.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `node --check server.js && node --check lib/*.js`. Review for: console.log in prod, unused imports, HTML escaping issues.
  Output: `Parse [PASS/FAIL] | Files [N clean] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright-cli`)
  Start from clean sessionStorage. Execute EVERY QA scenario from every task. Test cross-task integration. Save screenshots to `.sisyphus/evidence/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything built, nothing beyond scope.
  Output: `Tasks [N/N compliant] | Creep [CLEAN] | VERDICT`

---

## Commit Strategy

- **Tasks 1-4** (Wave 1): `feat(platform): API key fix + policy CRUD backend`
- **Tasks 5-8** (Wave 2): `feat: experiment platform — info modals, shared receipt, per-tab state, policy editor UI`
- **Tasks 9-11** (Wave 3): `feat: experiment platform — results export, scientific polish, CSS cleanup`

---

## Success Criteria

### Verification Commands
```bash
curl http://localhost:3000/api/policies
# Expected: [{"name":"clear"},{"name":"vague"},{"name":"contradictory"}]

curl http://localhost:3000/api/health
# Expected: {"ok":true}
```

### Final Checklist
- [ ] All 9 tabs render without JS errors
- [ ] Upload receipt once → shared across all experiment tabs
- [ ] Tab selections persist across switches
- [ ] F5 preserves receipt + last selections + results
- [ ] Policy edits saved → reflected in experiments immediately
- [ ] CSV/JSON exports valid files without API key or base64
- [ ] ℹ modals show correct content for each experiment
- [ ] No API key in localStorage
