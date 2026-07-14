# docs/ — Project specs and plans

Implementation planning documents. **Not source code, not paper content — these are the working history of how the project was built.** Append-only.

## STRUCTURE
```
docs/superpowers/
├── specs/
│   ├── 00-project-context.md                    # AUTHORITATIVE conventions source
│   ├── 2026-06-21-policy-semantic-audit-design.md   # Design spec, 5 sections
│   ├── task3-openrouter-client.md               # LLM client + prompts
│   ├── task4-frontend-shell.md                  # UI shell + settings
│   ├── task5-backend-e1-e2e3.md                 # /api/extract + /api/verdict
│   ├── task6-backend-e4-e5-e6.md                # /api/phase-sensitivity + /api/adversarial
│   └── task7-annotation-page.md                 # /api/annotations + /api/receipts
└── plans/
    └── 2026-06-21-policy-semantic-audit.md      # 7-task implementation plan
```

## WHERE TO LOOK
| To find... | File |
|------------|------|
| Project conventions, data schemas, pipeline flow | `specs/00-project-context.md` |
| Overall design rationale and paper structure | `specs/2026-06-21-policy-semantic-audit-design.md` |
| How a specific task was supposed to be implemented | `specs/task{N}-*.md` |
| The full 7-task implementation plan | `plans/2026-06-21-policy-semantic-audit.md` |
| Why a code decision was made | Check the corresponding `task{N}` spec |

## CONVENTIONS
- **Numbered file prefixes preserve reading order.** `00-` is read first; `task3-` … `task7-` are read in order.
- **Spec format is consistent across `task{N}-*.md`:** Scope → Files → Interfaces → Step-by-step checklist with `[ ]` → Verify → Commit.
- **`00-project-context.md` is the single source of truth** for project conventions, data schemas, and the OpenRouter API contract. Other specs reference it but don't restate.
- **Date-prefixed files** (`2026-06-21-…`) mark foundation documents. Task files are referenced by number, not date.

## ANTI-PATTERNS
| Forbidden | Reason |
|-----------|--------|
| Deleting a `task{N}-*.md` after implementation | These are append-only history. Implementation status is reflected in git, not in these files. |
| Editing `00-project-context.md` to "fix" things that have drifted | The spec predates the code. If code has drifted, update the spec AND the code together, or note the drift. |
| Writing a new spec that contradicts `00-project-context.md` | The 00-doc wins. New specs must defer to it on conventions. |
| Adding LLM-related decisions to specs without also updating `paper/04_methodology.md` | Methodology is the paper's record of why prompts/architecture are the way they are |

## UNIQUE STYLES
- **The 7-task plan in `plans/` uses checkbox syntax** (`- [ ] Step N: …`) for incremental progress tracking. Once the project is complete, all boxes are conceptually checked.
- **Specs use markdown code blocks for file content** (e.g., `task3-openrouter-client.md` contains the complete intended code for `lib/openrouter.js`). Diff against actual files reveals drift.
- **`task7-annotation-page.md` explicitly notes** the Annotate tab UI was already created in Task 4 — Task 7 only added the backend routes. This kind of cross-task dependency is called out at the top of each spec.
- **Specs are written for "agentic workers"** (see `plans/` preamble: "Use superpowers:subagent-driven-development"). Each step is a discrete, testable action.

## NOTES
- `00-project-context.md` is **the file to read first** when onboarding. It contains: data schemas, OpenRouter headers, the 3-layer pipeline description, the existing server.js structure, and conventions.
- Task 1 and Task 2 from the plan are not in `specs/` — they're in the plan file itself. Specs start at Task 3 (the first task that creates non-trivial code).
- The design spec is dated `2026-06-21` — same date as the plan. They were written together.
- Total: ~4273 lines across 10 files. This is the largest subdirectory in the repo by line count.
