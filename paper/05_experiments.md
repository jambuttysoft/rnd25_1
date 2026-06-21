# 5. Experiments

Each experiment is presented with: hypothesis, setup, results, problems encountered and solutions, and discussion. The six experiments build incrementally—E1 establishes the extraction baseline, E2–E3 compare reasoning strategies, E4–E5 probe specific model capabilities, and E6 stress-tests the full pipeline under adversarial conditions.

---

## E1: OCR Extraction Baseline

**Hypothesis.** A multimodal LLM can reliably extract structured fields (vendor, date, amount, currency, category) from real-world receipt photographs and PDFs of varying quality and language. We hypothesize high precision on vendor, amount, and currency (which are typically prominently displayed), and lower precision on category (which requires inference rather than direct reading).

**Setup.** All 26 receipts are processed via the `/api/extract` endpoint using `google/gemini-2.5-flash` as the vision model. The extraction prompt instructs the model to return a JSON object with six fields and to return `null` rather than guess for any unreadable field. Extracted fields are compared against manual ground-truth annotations. Field-level precision is computed for each of the five verifiable fields (vendor, date, amount, currency, category). For amounts, a match is defined as agreement within ±0.01 after rounding to two decimal places. For dates, an exact ISO 8601 match is required. For vendor, category, and currency, exact string match after lowercase normalization is used.

Two secondary metrics are also computed: null rate (proportion of responses returning `null` for each field) and hallucination rate (proportion of non-null responses that differ from the ground truth—indicating a confident but incorrect extraction).

**Results.**

**[Results: TBD — fill after running experiments]**

**Problems Encountered.**

*JSON parsing failures.* In some cases the model wraps its JSON response in a markdown code fence (` ```json ... ``` `), causing direct `JSON.parse()` to fail. Solution: a post-processing step strips markdown fences before parsing. If parsing still fails, the raw response is returned with an `extraction_error` flag.

*PDF first-page cropping.* Multi-page PDF invoices contain the total amount on a page other than the first. The current pipeline only processes the first page. Solution documented as a known limitation; single-page PDFs and receipts are prioritized in the evaluation set.

*Language detection.* The prompt does not specify an expected language. For Russian and German receipts, the model successfully reads the text but sometimes returns vendor names in transliterated form rather than the original script. Solution: the ground-truth annotation accepts both forms for string matching.

*Category inference errors.* The model occasionally assigns a plausible but incorrect category (e.g., classifying a software subscription as "services" rather than "software"). This is expected since category assignment requires interpretation, not just reading. The category field is analyzed separately as an inference task rather than an OCR task.

**Discussion.**

The extraction experiment establishes whether the downstream reasoning pipeline operates on reliable inputs. A high null rate would indicate that the model is appropriately conservative but limits the volume of receipts available for E2–E6. A high hallucination rate on key fields (date, amount, currency) would indicate that the model is generating plausible-sounding but incorrect values—a more serious problem that would corrupt verdict reasoning.

The category field is qualitatively different from the other five fields: it requires the model to apply a predefined taxonomy rather than read a value directly from the image. Imprecision on category is expected and tolerated, since the Layer 3 reasoning step also sees the full list of line items and can override or refine the category assignment during policy evaluation.

---

## E2: Zero-Shot Classification Without CoT

**Hypothesis.** A model given policy context and extracted expense fields, but without chain-of-thought instruction, produces verdicts with low agreement with human judgment. The absence of explicit reasoning forces the model to apply priors about appropriate expenses rather than systematically checking the policy, leading to higher rates of unjustified "justified" verdicts on borderline expenses.

**Setup.** E1 extraction output is fed into `/api/verdict` with `useCot: false`. All 26 receipts are evaluated against the clear policy at Phase 2 (Experimentation)—chosen because Phase 2 has the most nuanced policy constraints (equipment is allowed only if existing equipment has failed; software must be project-use only). The verdict prompt provides the serialized policy text and extracted fields, then asks for a JSON object with `verdict` and `reason` only. All three models (Gemini 2.5 Flash, Qwen2.5-72B, Mixtral-8x7B) are evaluated independently. Cohen's κ is computed for each model against the human annotation.

**Results.**

**[Results: TBD — fill after running experiments]**

**Problems Encountered.**

*Verdict schema violations.* Some model responses return verdict labels outside the three defined values (e.g., "approved," "compliant," "not justified"). Solution: a normalization step maps common synonyms to the canonical three-class schema before computing κ. Responses that cannot be normalized are marked as `parse_error` and excluded from the κ computation with a note.

*One-sentence reason length.* Despite the prompt specifying "one-sentence reason," some models return multi-sentence explanations. This does not affect the verdict computation but is noted as a prompt compliance observation.

**Discussion.**

The no-CoT condition establishes a baseline for how well models perform with a minimal prompt—the simplest possible deployment. The expectation is that without explicit reasoning steps, models will apply coarse-grained category matching (does the expense type appear in the allowed list?) rather than nuanced policy interpretation (is it restricted, and is the restriction condition met?). This produces correct verdicts on clear-cut cases but fails on borderline ones.

A secondary observation will be the distribution of verdicts: a model that systematically avoids the "unclear" verdict is applying inappropriate confidence. We expect the no-CoT condition to produce fewer "unclear" verdicts than the human annotation, since the model has no explicit instruction to flag ambiguity.

---

## E3: Zero-Shot CoT Reasoning

**Hypothesis.** Chain-of-thought prompting improves verdict accuracy (Cohen's κ) compared to E2 and produces auditable explanations that correctly cite policy clauses. We additionally hypothesize that CoT increases the rate of "unclear" verdicts on genuinely ambiguous receipts, bringing the verdict distribution closer to the human annotation.

**Setup.** Identical to E2 but with `useCot: true`. The same 26 receipts, the same clear policy at Phase 2, and the same three models. The four-step reasoning instruction is added to the prompt. Results are compared to E2 on Cohen's κ. In addition to κ, a qualitative human evaluation of reasoning quality is performed on a random sample of 10 receipts: the reasoning chain is rated on a 1–3 scale for policy groundedness (1 = reasoning does not reference the policy; 2 = reasoning references the policy but incompletely; 3 = reasoning explicitly cites the relevant policy clause and correctly applies it to the expense).

**Results.**

**[Results: TBD — fill after running experiments]**

**Problems Encountered.**

*Reasoning field missing.* Some model responses return the verdict and reason fields but omit the `reasoning` field, despite the CoT instruction. This is more common with Mixtral-8x7B than with Gemini 2.5 Flash. Solution: when the `reasoning` field is absent or empty, the response is included in the κ computation but excluded from the reasoning quality evaluation.

*Circular reasoning.* In some cases the reasoning chain restates the verdict rather than deriving it (e.g., "This expense is justified because it is a justified expense for the project"). These cases receive a quality rating of 1 and are analyzed as a failure mode.

*Policy clause hallucination.* In some cases the reasoning chain cites a policy clause that does not exist in the policy text (e.g., "The policy allows expenses up to €300 per item" when no such limit is specified). These are flagged as hallucination instances.

**Discussion.**

The CoT versus no-CoT comparison is the central empirical question of this study. A significant κ improvement under CoT would support the hypothesis that explicit reasoning steps cause the model to engage more carefully with the policy text. However, as noted by Turpin et al. (2023), CoT can also produce unfaithful reasoning—correct verdicts with incorrect chains. The qualitative reasoning quality rating allows us to distinguish between these cases.

The comparison across models is also informative: a large-scale model (Gemini 2.5 Flash) may benefit less from CoT prompting if it already implicitly applies multi-step reasoning, while a smaller model (Mixtral-8x7B) may show a larger relative improvement.

---

## E4: Phase-Sensitive Reasoning

**Hypothesis.** The same expense receives a different verdict when the project phase changes, demonstrating that the model is performing genuine semantic grounding against the policy rather than applying phase-invariant priors about appropriate expenses.

**Setup.** Six to eight receipts are selected from the full set where the expense category is explicitly phase-dependent under the clear policy: equipment purchases (allowed in Phase 1, restricted in Phase 2, forbidden in Phase 3), software licenses (allowed in Phase 1, restricted in Phase 2, forbidden in Phase 3), and API credits (allowed in Phase 1, allowed in Phase 2, restricted in Phase 3). Each selected receipt is evaluated with `useCot: true` against the clear policy at all three phases. For each receipt, we record whether the verdict changes between Phase 1 and Phase 3 as the primary phase-sensitivity metric. We also record whether Phase 2 verdicts are appropriately intermediate (restricted rather than fully allowed or forbidden).

**Results.**

**[Results: TBD — fill after running experiments]**

**Problems Encountered.**

*Phase-invariant reasoning.* In preliminary testing, some models produce the same verdict across all phases, with the reasoning chain only nominally referencing the phase name. This is the primary failure mode for this experiment: the model uses the policy structure but does not actually modulate its verdict based on phase-specific constraints. Solution: this is reported as a result rather than a technical problem—it is the key finding if observed.

*Ambiguous receipt–phase matching.* Some receipts are ambiguous in ways that are independent of phase (e.g., the receipt does not clearly indicate whether a restaurant meal was a team dinner or a personal meal). For these, phase-sensitivity analysis is not meaningful since the verdict is "unclear" at all phases. Such receipts are excluded from the phase-sensitivity count with a note.

**Discussion.**

Phase sensitivity is a necessary property for a policy compliance pipeline to be useful: if verdicts are identical regardless of phase, the pipeline is not reading the policy—it is applying a static judgment about expense categories. The ideal result is that equipment purchases are "justified" in Phase 1, "suspicious" in Phase 2 (unless the existing equipment failure condition is met), and clearly "suspicious" or "not justified" in Phase 3.

A model that shows high phase sensitivity is demonstrating contextual policy grounding—the expense is not inherently good or bad but must be evaluated in context. This is exactly the capability that rule-based systems lack and that motivates the LLM-based approach.

---

## E5: Ambiguity and Uncertainty Handling

**Hypothesis.** For receipts that are genuinely ambiguous, the model expresses uncertainty (verdict = "unclear") rather than forcing a confident verdict in one direction. We hypothesize that this behavior requires CoT prompting that explicitly includes an ambiguity-flagging step; without it, models tend toward confident verdicts.

**Setup.** Five to seven receipts flagged as `is_ambiguous: true` in the human annotation are selected. These are cases where the annotator judged that a reasonable reviewer might reach a different verdict—for example, a meal that could be either a team working dinner (restricted but allowed) or a personal dinner (forbidden), with no additional context available from the receipt. All selected receipts are evaluated with CoT prompting against the clear policy at Phase 2. The primary metric is the uncertainty expression rate: the proportion of responses where the model assigns `verdict: "unclear"`. A secondary metric is the quality of the ambiguity flag in the reasoning chain—whether the model correctly identifies the source of the ambiguity.

**Results.**

**[Results: TBD — fill after running experiments]**

**Problems Encountered.**

*Overconfidence under ambiguity.* The most common failure mode is confident verdicts on genuinely ambiguous receipts, particularly in the "justified" direction. Models appear to have a prior toward charitable interpretation of expenses, which overrides the explicit ambiguity-flagging instruction in some cases.

*Spurious "unclear" verdicts.* The opposite failure also occurs: some models return "unclear" for receipts that are unambiguously justified or suspicious, possibly due to over-triggering the ambiguity-flagging step. This reduces the precision of the "unclear" label.

**Discussion.**

The ability to express appropriate uncertainty is a precondition for meaningful human–AI collaboration in compliance review. If the model always produces a confident verdict, a human reviewer cannot use the "unclear" flag to prioritize their attention. If the model over-uses "unclear," the flag loses its discriminative value.

The comparison between models is particularly interesting for this experiment. Larger models with stronger instruction-following may be better at implementing the four-step reasoning protocol, including its ambiguity-flagging step. However, larger models may also have stronger priors that override the protocol. This experiment tests the interplay between instruction-following quality and prior strength.

---

## E6: Adversarial Policy Stress Test

**Hypothesis.** Under vague or contradictory policies, weaker models hallucinate confident justifications while stronger models flag the policy ambiguity. Specifically, we hypothesize that the hallucination rate (reporting `policy_clarity: "clear"` on a non-clear policy) is higher for Mixtral-8x7B than for Gemini 2.5 Flash, and that models assign `policy_clarity: "contradictory"` for the contradictory policy at a substantially lower rate than a human would.

**Setup.** Ten receipts are selected to span the verdict space: three to four clearly justified under the clear policy, three to four clearly suspicious, and two to three genuinely ambiguous. All ten receipts are evaluated against all three policy variants (clear, vague, contradictory) using CoT prompting with all three models, giving a total of 90 evaluation runs. The E6 CoT prompt adds a `policy_clarity` field to the requested JSON output: before reasoning about the expense, the model is asked to assess the policy and assign one of `clear`, `vague`, or `contradictory`. Hallucination is defined as assigning `policy_clarity: "clear"` when the input policy is vague or contradictory.

Secondary analysis examines verdict drift: how does the distribution of verdicts (justified / suspicious / unclear) shift when the same receipt is evaluated under the three policies? Under the vague policy, a higher rate of "unclear" verdicts is expected. Under the contradictory policy, an ideal model should produce either "unclear" or an explicit refusal to verdict; instead, we expect to observe some models still producing confident verdicts.

**Results.**

**[Results: TBD — fill after running experiments]**

**Problems Encountered.**

*Policy clarity field omitted.* Some models omit the `policy_clarity` field from their JSON output despite the explicit prompt instruction, particularly on the clear policy where the model apparently judges that no policy assessment is needed. Solution: omitted fields are coded as `null` (not as "clear") to avoid inflating the non-hallucination count.

*Contradictory policy producing confident verdicts.* Preliminary testing shows that some models produce highly confident verdicts even under the contradictory policy, with reasoning chains that selectively use the "allowed" clauses while ignoring the contradicting "forbidden" clauses. This is the primary adversarial failure mode and is documented in detail in the results.

*Reasoning chain self-contradiction.* Under the contradictory policy, some models produce reasoning chains that first note a contradiction and then proceed to derive a confident verdict anyway ("While the policy is somewhat inconsistent, the expense appears to be justified because..."). These are counted as failures to flag the contradiction appropriately despite being internally contradictory reasoning.

**Discussion.**

The adversarial stress test is the most practically significant experiment in the study. Real-world expense policies are often vague, inconsistently written, or internally contradictory—particularly in early-stage R&D projects where policies are written quickly and not formally reviewed. A compliance pipeline that produces confident verdicts under such policies provides false assurance and may actively mislead auditors.

The comparison across models on hallucination rate has direct implications for model selection in production deployment. A model with a low hallucination rate under adversarial policies is safer to deploy even if its absolute verdict accuracy under clear policies is slightly lower. The trade-off between accuracy and hallucination resistance is a key output of this experiment.
