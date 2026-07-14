# lib/ — Server-side modules

ESM modules imported by `server.js`. **No build, no transpilation, no tests in this folder.**

## STRUCTURE
```
lib/
├── openrouter.js   # OpenRouter HTTP client + JSON parsers + normalizers
├── policy.js       # Policy JSON loader + text serializer
└── prompts.js      # All 5 LLM prompt templates + fillPrompt()
```

## WHERE TO LOOK
| To change... | File | Function |
|-------------|------|----------|
| How requests hit OpenRouter | `openrouter.js` | `callText`, `callVision` |
| How model JSON is parsed | `openrouter.js` | `extractJson` (3-stage fallback) |
| How amount strings are normalized | `openrouter.js` | `normalizeAmount` (handles `1.249,00` and `€ 649.99`) |
| How verdict strings are normalized | `openrouter.js` | `normalizeVerdict` (synonym map → `justified`/`suspicious`/`unclear`) |
| Which policy variants exist | `policy.js` | `valid = ['clear', 'vague', 'contradictory']` (hardcoded list) |
| How a policy is rendered for the LLM | `policy.js` | `policyAsText(policy, phaseIndex)` |
| Any prompt template | `prompts.js` | `PROMPTS.{extraction,verdictNoCot,verdictCot,verdictCotE5,adversarial}` |
| Prompt variable substitution | `prompts.js` | `fillPrompt(template, vars)` (uses `{key}` placeholders, falls back to `'unknown'`) |

## CONVENTIONS
- **All exports are named.** No default exports.
- **No `try/catch` in `openrouter.js` fetch wrappers** — errors propagate to route handlers.
- **`extractJson` is 3-stage:** direct parse → strip ` ```json ` fences → extract first `{...}` block. Unwraps single-key wrapper objects (`{"response": {...}}` → `{...}`).
- **Prompts return raw template strings with `{placeholder}` tokens.** Substituted at the call site via `fillPrompt()`. Unknown placeholders left as `unknown`.
- **Each `PROMPTS.*` block has a JSDoc comment** describing which experiment (E1–E6) uses it.

## ANTI-PATTERNS
| Forbidden | Reason |
|-----------|--------|
| Using `JSON.parse()` directly on model output | `extractJson()` handles fence-wrapped and prose-embedded JSON; `JSON.parse()` throws on first backtick |
| Adding a fourth policy variant without updating `valid` array | `loadPolicy(name)` validates against hardcoded `['clear', 'vague', 'contradictory']` |
| Calling `fetch()` directly for OpenRouter | Use `callText` / `callVision` — they add required `HTTP-Referer` and `X-Title` headers |
| Modifying prompt templates without updating the corresponding spec | Each prompt is documented in `docs/superpowers/specs/task3-openrouter-client.md` and exercised by specific experiments |

## UNIQUE STYLES
- **`normalizeVerdict` synonym map** is intentionally permissive — `approved`, `compliant`, `valid` all → `justified`; `denied`, `rejected`, `prohibited` → `suspicious`; `ambiguous`, `uncertain`, `inconclusive` → `unclear`. Unknown values return `null` (excluded from metrics).
- **`normalizeAmount` regex** `^\d{1,3}(\.\d{3})*(,\d{1,2})?$` distinguishes European `1.249,00` (period = thousands) from US `1,249.00` (comma = thousands). Currency symbols `€$£¥₽` and whitespace stripped first.
- **`policyAsText` is a pure function** — takes a loaded policy object, returns a string. No file I/O.

## NOTES
- All three files use JSDoc but no TypeScript.
- `callText` and `callVision` set `HTTP-Referer: http://localhost:3000` and `X-Title: Policy Semantic Audit` — required by OpenRouter for attribution.
- 5 prompt templates × 3 policy variants × 3 phases = the full experimental space for E1–E6.
- `prompts.js` is the single source of truth for what the model sees. Changes here directly affect every experiment's results.
