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
