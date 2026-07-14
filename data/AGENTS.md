# data/ — Runtime data

JSON data files read at server startup, written by the API. **No build step, no migrations, no schema validation.**

## STRUCTURE
```
data/
├── policy/                          # 3 policy variants — read-only at runtime
│   ├── policy_clear.json            # Specific allowed/restricted/forbidden per phase
│   ├── policy_vague.json            # Generic language ("work-related expenses")
│   └── policy_contradictory.json    # Internal contradictions (Phase 2 allows + forbids travel)
└── annotations/
    └── ground_truth.json            # Writable array of human annotation records
```

## WHERE TO LOOK
| To change... | File | Notes |
|-------------|------|-------|
| Add a new policy variant | `data/policy/policy_{name}.json` | Also update `valid = [...]` in `lib/policy.js` |
| Modify a phase's allowed list | `data/policy/policy_clear.json` | Touched by E1–E6 experiments |
| Read human annotations | `data/annotations/ground_truth.json` | GET `/api/annotations` |
| Save a new annotation | POST `/api/annotations` with `{filename, vendor, ...}` | Upsert by `filename` |
| Clear all annotations | Write `[]` to `ground_truth.json` | Server has no DELETE route |

## CONVENTIONS
- **Policy schema is rigid:**
  ```json
  {
    "policy_name": "clear" | "vague" | "contradictory",
    "project_name": "AI Receipt Audit System — R&D Project",
    "description": "...",
    "phases": [
      { "name": "...", "description": "...", "allowed": [...], "restricted": [...], "forbidden": [...] }
    ]
  }
  ```
  Exactly 3 phases, each with `name`, `description`, and three string arrays.
- **Annotation record schema:**
  ```json
  {
    "filename": "receipt_001.jpg",   // PK
    "vendor": "MediaMarkt GmbH",
    "date": "2025-10-07",            // YYYY-MM-DD
    "amount": 649.99,                // float
    "currency": "EUR",               // ISO 4217
    "category": "equipment",         // enum below
    "human_verdict": "justified",    // justified | suspicious | unclear
    "human_verdict_reason": "...",
    "is_ambiguous": false,           // bool
    "notes": ""
  }
  ```
- **Category enum (closed set, used in both prompts and annotations):** `equipment` | `software` | `travel` | `meals` | `services` | `supplies` | `other`.
- **Verdict enum (closed set, 3-class):** `justified` | `suspicious` | `unclear`. Same as `PROMPTS.*` output and the option values in `public/index.html`.
- **`amount` is always a float** (or `null`). European format `"1.249,00"` is normalized by `normalizeAmount()` in `lib/openrouter.js` before persistence.

## ANTI-PATTERNS
| Forbidden | Reason |
|-----------|--------|
| Adding fields to the annotation schema without updating `public/app.js saveAnnotation()` | Frontend POSTs a fixed shape; unknown fields are saved but never read back |
| Adding a fourth phase to a policy | `policyAsText(policy, 3)` returns `undefined`; routes call `parseInt(phase ?? 1)` and clamp implicitly |
| Editing `ground_truth.json` by hand while the server runs | Server caches nothing, but concurrent POST will overwrite the file (no locking) |
| Committing real personal data to annotations | The annotation records contain vendor/amount/date — never customer PII |

## UNIQUE STYLES
- **Contradictory policy is the "test fixture"** for E6 — it deliberately lists the same item in `allowed` AND `forbidden` to detect model hallucination. Phase 1 has `equipment` in both. Phase 2 has `travel` in both. Phase 3 has conflicting description vs. forbidden list.
- **`ground_truth.json` IS the database.** No SQLite/Postgres. Each POST upserts by `filename` (findIndex + replace or push). Atomic via single `writeFileSync`.
- **Vague policy uses abstract language** ("work-related expenses", "obvious personal expenses", "necessary tools") — designed to test if the model can refuse or hedge when no specific category matches.
- **Clear policy is grounded in real R&D activities** — phase names map to actual research stages (Infrastructure Setup → Experimentation → Evaluation & Documentation).

## NOTES
- The `paper/05_experiments.md` documents the design intent for each policy variant.
- `data/annotations/ground_truth.json` is currently `[]` (empty) — annotators fill it via the Annotate tab.
- Policy files are read every request (no cache) — fine for research scale, not production.
- Phase indices are 0-based in the API (`phase=0|1|2`), 1-based in user-facing labels.
