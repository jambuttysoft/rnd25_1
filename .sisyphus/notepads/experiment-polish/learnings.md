# F3 QA Learnings

## Execution
- F3 Manual QA executed via Playwright browser automation
- All 6 scenarios verified with screenshots captured to `.sisyphus/evidence/`

## Key Findings
- **S1 Navigation**: All 9 tab buttons (E1-E6, Annotate, Policy Editor, Settings) exist and are clickable
- **S2 Info Modals**: Modal opens with correct title "E1: OCR Extraction Baseline", shows Hypothesis/Methodology sections, closes via Escape key
- **S3 Policy Editor**: Contradictory policy loads with E6 warning banner. Save Policy shows "✓ Policy saved" confirmation. Changes persist after page reload (Phase 1 name "Phase 1: QA Modified" and allowed list item "qa-test-item" persisted)
- **S4 Receipt Bar**: Receipt upload via `setInputFiles()` followed by clicking Extract Fields triggers receipt bar with filename. Receipt bar survives tab switches (E1↔E2↔E1)
- **S5 Export**: Export JSON button is present and clickable. Download requires experiment results (needs API key). Button click produces no console errors.
- **S6 Settings API Key**: localStorage `psa_settings` contains only model config, NO `apiKey` field. Security requirement confirmed.
- Console errors: Only favicon.ico 404 (negligible)

## Technical Notes
- Receipt bar appears only after clicking Extract Fields (not on file selection alone)
- Policy Editor save persists to server-side `data/policy/` JSON files
- API key held in memory (`_apiKey` variable), never persisted to disk/localStorage
- Tab state persisted via sessionStorage (survives F5 but not full navigation redirect)

## 2026-07-17: Added modal system helpers, constants, status card

### What was added
1. **Status Card state machine** (`setExperimentState(prefix, state)`) — toggles ready/complete/running states with visibility and loading control. Uses `btn.id` not DOM element due to existing `setLoading` signature.

2. **Result Actions** (`copyResultAsJSON`, `viewRawResponse`) — clipboard copy with "Copied!" feedback; raw response viewer reuses existing `showModal`.

3. **Modal Content Constants** (18 total) — `RD_CONTENT_E1`–`PE_CONTENT_ST` with full Research Design + Practical Example text from `docs/changes/*.html`. Each section is `<div><h4>heading</h4><p>text</p></div>` format.

### Key observations
- Existing modal system at line 850+ already had `showModal`/`closeModal`/ESC handler/click-outside — no need to duplicate.
- `setLoading(btnId, isLoading)` takes string ID, not DOM element — task spec showed `setLoading(btn, true)` (bug), used `btn.id` instead.
- Content extracted from 9 SingleFile HTML exports using Python HTML parser skipping script/style/svg tags.
- ST (Research Configuration) is not an experiment — its "Research Design" maps to the Page Guide modal content (Purpose + control descriptions).

### Files touched
- `public/app.js` — added functions between export section and modal system; added constants after expose section.
