# public/ — Frontend SPA

Vanilla HTML + JS + CSS. **No build step, no bundler, no framework.** Loaded as static files by Express.

## STRUCTURE
```
public/
├── index.html   # 8-tab SPA shell (E1–E6 + Annotate + Settings)
├── app.js       # ~520 lines: tab routing, settings persistence, all experiment UI
└── style.css    # Verdict badge colors + active tab underline (Tailwind handles rest)
```

## WHERE TO LOOK
| To change... | File | Function |
|-------------|------|----------|
| Add a new tab | `index.html` (add `<button class="tab-btn">` + `<div id="tab-X" class="tab-panel hidden">`) | `app.js` (add `runX()` handler + click listener if needed) |
| Add a new experiment endpoint | `app.js` (add `runE*()` that calls `/api/...`) | `server.js` (add matching route) |
| Settings tab logic | `app.js` `loadSettings()`, `saveSettings()`, `testConnection()` | `localStorage` key `psa_settings` |
| Annotation CRUD | `app.js` `initAnnotate()`, `loadAnnotation()`, `saveAnnotation()` | `/api/annotations` GET/POST |
| Verdict badge colors | `style.css` `.verdict-{justified,suspicious,unclear,error}` | |
| E1–E6 result rendering | `app.js` `runE1()` … `runE6()` | HTML built via template literals |
| ℹ experiment info modal | `app.js` `EXPERIMENT_META` config + `showExperimentInfo()` |
| Shared receipt bar | `app.js` `updateReceiptBar()` + `index.html` `#receipt-bar` |
| Policy Editor | `app.js` `loadPolicyEditor()`, `savePolicy()` + `index.html` `#tab-policy-editor` |
| Results export | `app.js` `ResultsStore`, `exportResultAsCSV()`, `exportResultAsJSON()` |
| Per-tab state | `app.js` `saveCurrentTabState()`, `restoreTabState()`, `_currentTab` |

## CONVENTIONS
- **Tailwind via CDN** — `<script src="https://cdn.tailwindcss.com"></script>` in `<head>`. All utility classes work; custom CSS only for verdict badges and tab underline.
- **Tab routing is classList-based**, not URL-based. Active tab = `class="active"`, all others get `class="hidden"` on the panel.
- **API key kept in `_apiKey` module-level variable** + `localStorage.psa_settings` (NOT the key — only model names persisted).
- **All experiment handlers follow the same shape:** `setLoading(btnId, true)` → fetch → render HTML into result div → `setLoading(btnId, false)` in `finally`.
- **Result rendering uses template literals with `escHtml()` for user-controlled strings.** Never `${value}` raw.
- **`data-label` attribute on buttons** preserves original label across `setLoading()` toggles.
- **State persistence via sessionStorage.** Receipt, tab selections, results, and extraction cache all use sessionStorage (survives F5, clears on tab close).
- **Extraction cache deduplicates vision calls.** Same receipt hash → same extraction used across experiments.
- **Export is structured data only.** CSV for flat results (E1/E2/E3/E5), JSON for nested (E4/E6). No HTML exported.

## ANTI-PATTERNS
| Forbidden | Reason |
|-----------|--------|
| `import` / `require` of external libraries | No build step — no bundler to resolve imports. Only `<script src>` and CDN. |
| LocalStorage for the API key | In-memory only (`_apiKey` variable). Key re-entered on refresh by design. |
| Setting `innerHTML` with unescaped model output | Use `escHtml()` first. Model output is untrusted. |
| Adding a router library / framework | Tab switching is intentionally trivial — `classList.add/remove`. |
| Loading Tailwind via npm/postcss | CDN only — `index.html` `<head>` line. |

## UNIQUE STYLES
- **File reading** via `FileReader.readAsDataURL()` then `.split(',')[1]` to strip the `data:image/jpeg;base64,` prefix. Single utility `getFileData(inputId)`.
- **Two-button pattern for results:** verdict badge (`.verdict-justified/suspicious/unclear`) + collapsible `<details>` with reasoning chain. Used in E3, E4, E5, E6.
- **Annotation tab is lazy-loaded** — `_annotateInitialized` flag + `initAnnotate()` triggered on first tab click.
- **E4 renders 3 cards in a grid** (one per phase). E6 renders 3 cards in a grid (one per policy). Both use `grid grid-cols-3 gap-4`.
- **E6 hallucinates detection:** server returns `hallucination: true` when `policyName !== 'clear' && result.policy_clarity === 'clear'`. Frontend shows orange "⚠ hallucination" badge inline.

## NOTES
- `<script src="/app.js"></script>` at end of `<body>`. Loaded as static file by `express.static(join(__dirname, 'public'))` in `server.js`.
- The Annotate tab (`tab-annotate`) was added in Task 4 — it was not in the original spec's UI but is wired to `/api/annotations`.
- `localStorage.psa_settings` shape: `{ apiKey, model, visionModel }`. `apiKey` is set but the `loadSettings()` function intentionally does NOT repopulate the input from storage (preserves "in-memory only" promise).
- HTML uses `&amp;` in JS-string-rendered placeholders for `Phase 3: Evaluation & Documentation` — preserved through `escHtml()`.
