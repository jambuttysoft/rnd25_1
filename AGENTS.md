# PROJECT KNOWLEDGE BASE

**Generated:** 2026-07-14
**Commit:** 361423e
**Branch:** main

## OVERVIEW
`policy-semantic-audit` — Node.js/Express SPA for AI-driven expense policy compliance research. Runs 6 LLM experiments (E1–E6) over 26 real receipts using OpenRouter API. Companion academic paper lives in `paper/`.

## STRUCTURE
```
RND1/
├── server.js            # Express entry — 12 API routes, all under /api/
├── package.json         # ESM, 3 deps, no devDependencies
├── config.json          # Runtime model names (mutable, tracked in git)
├── lib/                 # Server-side modules: OpenRouter client + policy loader + prompts
├── public/              # Frontend SPA: index.html + app.js + style.css (no build)
├── data/
│   ├── policy/          # 3 policy variants: clear, vague, contradictory
│   └── annotations/     # ground_truth.json (writable "database")
├── CASH_RECIEPTS/       # ⚠ TYPO. 25 receipt images (JPG/PNG/PDF). IMMUTABLE.
├── paper/               # 9-section research paper draft + references.bib
├── docs/superpowers/    # Project specs (00-project-context.md is the source of truth)
│   ├── specs/           # task3–task7 implementation specs
│   └── plans/           # 2026-06-21 implementation plan
└── .claude/             # Claude/agent settings (checked in)
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add new API route | `server.js` (single file, add before `app.listen`) |
| Modify LLM prompts | `lib/prompts.js` |
| Change OpenRouter client behavior | `lib/openrouter.js` |
| Edit policy data | `data/policy/policy_{clear,vague,contradictory}.json` |
| Add new tab to UI | `public/index.html` (markup) + `public/app.js` (logic) |
| Read project conventions | `docs/superpowers/specs/00-project-context.md` |
| Write paper | `paper/00_abstract.md` … `paper/08_conclusion.md` |
| Understand a specific experiment design | `docs/superpowers/specs/task{N}-{name}.md` |
| See why a code change was made | `docs/superpowers/specs/` + `docs/superpowers/plans/` |
| Edit experiment policies | `public/index.html` (Policy Editor tab) + `public/app.js` (`loadPolicyEditor`/`savePolicy`) |
| Download experiment results | Export JSON/CSV buttons on each experiment tab |
| Read experiment methodology | ℹ info button on each experiment tab heading |
| Reset a policy to defaults | Policy Editor tab → Reset to Default button |

## CONVENTIONS (deviations only)
- **ESM only.** `import`/`export`. `package.json` has `"type": "module"`. No `require()`.
- **No build step.** Tailwind via CDN. Vanilla JS served as-is. No webpack/vite/tsc.
- **No test framework, no linter, no formatter, no CI.** Repo is research prototype.
- **2-space indent, no semicolons, `const` only, arrow fns, template literals.**
- **API key lives in browser memory only** (passed per-request). Never server-side.
- **Mutable runtime config in git.** `config.json` and `data/annotations/ground_truth.json` are read/written at runtime but committed.
- **Single `server.js` exports `app` AFTER `app.listen()`** — side-effect on import. Don't `import './server.js'` from another module.

## ANTI-PATTERNS (THIS PROJECT)
| Forbidden | Reason |
|-----------|--------|
| `require()` / `module.exports` | ESM only |
| Bundler/transpiler (webpack, vite, babel, esbuild, tsc) | No build step allowed |
| `JSON.parse()` on raw model output | Use `extractJson()` from `lib/openrouter.js` (handles markdown fences, embedded JSON) |
| Saving `apiKey` to disk (config.json, DB, etc.) | Security; key lives in browser memory only |
| Direct calls to OpenAI/Anthropic/Google SDKs | All LLM via OpenRouter only |
| Hardcoding `OPENROUTER_API_KEY` in source | Use `.env` (gitignored) |
| Routes outside `/api/` prefix | Convention from `00-project-context.md` |
| `multer.diskStorage()` | Use `memoryStorage()` — files never written to disk |
| Modifying/renaming files in `CASH_RECIEPTS/` | Immutable test corpus |
| Importing `server.js` from another module | Side-effect starts HTTP server |

## UNIQUE STYLES
- **Three-layer pipeline** is the central abstraction: Layer 1 (OCR via vision model) → Layer 2 (policy text injection) → Layer 3 (CoT reasoning → verdict). Each layer is independently swappable.
- **Three-class verdict schema** (`justified` / `suspicious` / `unclear`) — not binary. "unclear" is a first-class outcome.
- **Three policy variants** (`clear` / `vague` / `contradictory`) used adversarially in E6.
- **`verdict` strings normalized** via `normalizeVerdict()` — models return synonyms ("approved", "compliant", "ambiguous") that map to canonical three-class.
- **Currency amounts normalized** via `normalizeAmount()` — handles European "1.249,00" and currency symbols.
- **All prompts are template strings** in `lib/prompts.js` with `{placeholder}` tokens. `fillPrompt()` substitutes and falls back to `"unknown"`.

## COMMANDS
```bash
npm install              # install 3 deps
cp .env.example .env     # set OPENROUTER_API_KEY
npm start                # production: node server.js (port 3000)
npm run dev              # dev: node --watch server.js
```
Test API health: `curl http://localhost:3000/api/health`

## NOTES
- **No `"engines"`, no `"license"` in package.json.** Add if publishing.
- **`.DS_Store` exists on disk but is now in `.gitignore`.** (Added during CSS polish).
- **CASH_RECIEPTS is a misspelling of CASH_RECEIPTS** — propagated everywhere. Don't "fix" it without updating all references (`server.js:18`).
- **Project context doc is authoritative:** `docs/superpowers/specs/00-project-context.md` predates code; spec/plan files are append-only history.
- **Two commits in git history.** Feature branches not used.
- **API key in browser**: refresh → re-enter. The Settings tab persists model names in localStorage but NOT the key.
- **26 receipts → 25 files on disk**: `CASH_RECIEPTS/` listed 26 in spec, ls shows 25 — possible missing file or spec drift; verify if relevant.
- **New tabs**: "Policy Editor" (9th tab), experiment info modals (ℹ)
- **State persistence**: sessionStorage — receipt and tab state survive F5
- **Extraction caching**: Same receipt across experiments uses one vision API call
- **Export**: CSV for E1/E2/E3/E5, JSON for E4/E6, global export in Settings
- **Editable policies**: All 3 policy variants editable via Policy Editor tab
