# paper/ — Research paper draft

9-section scientific manuscript in Markdown. **No build step, no LaTeX, no bibliography processor configured.** The source of truth is the prose in these files.

## STRUCTURE
```
paper/
├── 00_abstract.md         # 1 paragraph + keywords (results TBD)
├── 01_introduction.md    # Auditability gap, research question, contributions
├── 02_related_work.md     # LLM doc understanding, expense audit, CoT prompting
├── 03_architecture.md     # 3-layer pipeline, policy variants, implementation
├── 04_methodology.md      # Synthetic policy design, prompt engineering, metrics
├── 05_experiments.md      # E1–E6 each with hypothesis + setup + problems + results
├── 06_results.md          # Cross-experiment analysis, model comparison tables (TBD)
├── 07_limitations.md      # Known failure modes, future work
├── 08_conclusion.md       # Summary of contributions
└── references.bib         # BibTeX (not yet compiled)
```

## WHERE TO LOOK
| To write/edit... | File |
|------------------|------|
| Abstract / one-paragraph summary | `00_abstract.md` |
| Problem statement and contributions | `01_introduction.md` |
| How each experiment was built (problems + solutions) | `05_experiments.md` |
| Quantitative results tables | `06_results.md` (TBD — fill after running experiments) |
| Failure mode discussion | `07_limitations.md` |
| Citations | `references.bib` (BibTeX format) |

## CONVENTIONS
- **Section numbers are zero-padded** (`00_abstract.md` … `08_conclusion.md`) — preserves lexicographic ordering.
- **IMRaD-adjacent** structure (Abstract → Intro → Related → Architecture → Methodology → Experiments → Results → Limitations → Conclusion) but with `architecture` preceding `methodology` because the architecture IS the contribution.
- **Each experiment in `05_experiments.md` has the same template:** Hypothesis → Setup → Results → Problems Encountered (with code) → Discussion.
- **"TBD" markers** explicitly flag sections that need experiment runs to complete. Don't delete them — fill them in.
- **In-line code references** use backticks: `lib/openrouter.js`, `extractJson()`, `PROMPTS.verdictCot`.
- **Self-referential data:** the receipts in `CASH_RECIEPTS/` are from the project that produced this paper.

## ANTI-PATTERNS
| Forbidden | Reason |
|-----------|--------|
| Renaming `00_abstract.md` to `abstract.md` | Numbering is the only sort key; removing it breaks the reading order |
| Adding `09_*.md` to extend beyond conclusion | Paper is 9 sections by design (matches `docs/superpowers/specs/2026-06-21-policy-semantic-audit-design.md` §5) |
| Editing `05_experiments.md` without also editing the corresponding `task{N}` spec | The two MUST agree on hypotheses and setup |
| Changing the 3-class verdict schema (`justified`/`suspicious`/`unclear`) in prose | Code (`lib/prompts.js`, `lib/openrouter.js normalizeVerdict`) and prompt templates all assume this exact set |
| Quoting large blocks of model output verbatim | Paraphrase; verbatim model output is in the paper's appendices (not yet generated) |
| Adding LaTeX files | The paper is Markdown-only. Converting to LaTeX is out of scope. |

## UNIQUE STYLES
- **"Problems Encountered" pattern** in `05_experiments.md` — every experiment has a dedicated subsection documenting specific failures, root causes, and the code/solution applied. This is the paper's primary methodological contribution.
- **Self-citation:** the paper evaluates the LLM pipeline on receipts from the project that built the pipeline. Section 1.3 calls this out as "ecological validity."
- **"Documented failure mode taxonomy"** (Section 8) is named explicitly as a contribution alongside quantitative results.
- **Three-model comparison** (Gemini 2.5 Flash, Qwen2.5-72B, Mixtral-8x7B) is the experimental frame — but only Gemini is wired up in the current `lib/openrouter.js` code. The other two are mentioned in `public/index.html` Settings dropdown but not yet tested.

## NOTES
- `06_results.md` is the most incomplete — it's the experiment output. Run experiments first, fill results last.
- `references.bib` exists but is not yet compiled. No `.tex` or PDF output is generated. The paper is submission-ready Markdown.
- The paper title: *"AI-Driven Policy Semantic Audit: Zero-Shot Chain-of-Thought Reasoning for Expense Justification in R&D Projects"*.
- `04_methodology.md` discusses prompt engineering rationale — if you change a prompt, update the methodology section too.
- The 26 receipts are dated October 2025 – January 2026 (per `00_abstract.md`); the CASH_RECIEPTS directory reflects this date range.
