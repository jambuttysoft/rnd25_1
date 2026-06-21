# 6. Results and Discussion

This section synthesizes results across the six experiments and draws cross-experiment conclusions. Per-experiment numeric tables are produced after running the experimental pipeline; this section provides the interpretive framework and documents expected finding patterns based on the experimental hypotheses.

---

## 6.1 OCR Extraction Performance (E1)

**[Results: TBD — fill after running experiments]**

The E1 results establish the quality ceiling for all downstream experiments. We report field-level precision for each of the five primary fields (vendor, date, amount, currency, category) and the null rate per field.

Expected pattern: precision should be highest for amount and currency (these are prominently displayed on virtually all receipts and have constrained formats) and lower for vendor (which requires reading a potentially degraded or styled logo text) and category (which requires inference rather than reading). The null rate is expected to be low for amount and currency and higher for any field that is partially occluded or in poor-quality images.

A null rate near zero combined with high precision indicates that the model is both confident and accurate—the ideal result. A null rate near zero combined with low precision indicates hallucination: the model is generating plausible values rather than reading the actual receipt. This distinction is important: hallucination in the extraction layer compounds errors downstream, since a wrong amount or wrong category is used as input to the verdict reasoning.

For the German and Russian receipts, we expect lower vendor name precision due to character set differences and transliteration behavior, but similar amount and currency precision since numeric formats are internationally consistent.

---

## 6.2 Impact of Chain-of-Thought Reasoning (E2 vs. E3)

**[Results: TBD — fill after running experiments]**

The E2 vs. E3 comparison is the central result of the paper. We report Cohen's κ for each model under both conditions and the change in κ (ΔK) attributable to CoT prompting.

Expected pattern: CoT prompting should improve κ for all models, but the magnitude of improvement may vary. For Gemini 2.5 Flash, which is a highly capable instruction-following model, the baseline κ in E2 may already be moderate, with CoT providing a smaller absolute gain. For Mixtral-8x7B, which is a smaller model, we expect a lower E2 baseline and a larger absolute ΔK if the model can effectively implement the four-step reasoning protocol.

The qualitative reasoning quality ratings (1–3) are reported for the CoT condition. A distribution skewed toward 3 (reasoning explicitly cites policy clause) indicates that the CoT prompt is successfully grounding the model in the policy text. A distribution skewed toward 1–2 suggests that the model is using the CoT structure superficially—producing the appearance of systematic reasoning without genuinely checking policy clauses.

The verdict distribution comparison between E2 and E3 is also reported: we expect CoT to increase the rate of "unclear" verdicts on genuinely ambiguous receipts, bringing the model's distribution closer to the human annotation distribution.

---

## 6.3 Phase Sensitivity (E4)

**[Results: TBD — fill after running experiments]**

The phase-sensitivity results are reported as the proportion of test receipts (6–8) for which the verdict differs between Phase 1 and Phase 3. A phase-sensitivity score near 1.0 indicates that the model consistently shifts its verdict when the policy constraints change—the ideal behavior. A score near 0 indicates phase-invariant verdicts, which would demonstrate that the model is not genuinely grounding its reasoning in the phase-specific policy.

We also report the Phase 2 intermediate behavior: for receipts where Phase 1 gives "justified" and Phase 3 gives "suspicious," does Phase 2 give an intermediate verdict ("unclear" or a "suspicious" with a note about the restriction condition)? This tests whether the model correctly implements the restricted-category logic at Phase 2, which requires recognizing both that the category is conditionally allowed and that the condition may or may not be met from the available receipt information.

---

## 6.4 Uncertainty Expression on Ambiguous Expenses (E5)

**[Results: TBD — fill after running experiments]**

The E5 results are reported as the uncertainty expression rate: proportion of ambiguity-flagged receipts that receive `verdict: "unclear"` from each model. For context, the human annotation "unclear" rate on the selected ambiguous receipts is 100% by selection (all selected receipts were annotated as ambiguous).

We also report the spurious-unclear rate on the non-selected receipts (those not flagged as ambiguous): if a model frequently assigns "unclear" to unambiguous receipts, its uncertainty signals are less useful as a triage tool.

An ideal model has a high uncertainty expression rate on ambiguous receipts and a low spurious-unclear rate on unambiguous receipts. The combination of these two metrics gives a calibration picture: is the model's "unclear" verdict signal informative?

---

## 6.5 Adversarial Policy Robustness (E6)

**[Results: TBD — fill after running experiments]**

The E6 results are reported across three dimensions:

1. **Hallucination rate by policy variant and model:** The proportion of runs where `policy_clarity: "clear"` is assigned on a non-clear policy. Results are broken down by model (Gemini 2.5 Flash, Qwen2.5-72B, Mixtral-8x7B) and policy variant (vague, contradictory).

2. **Correct identification rate:** The proportion of runs where the model assigns the correct `policy_clarity` label (vague for the vague policy, contradictory for the contradictory policy).

3. **Verdict drift:** The distribution of verdicts (justified / suspicious / unclear) for the same 10 receipts under each policy variant. Under the vague policy, a shift toward "unclear" is expected. Under the contradictory policy, an ideal model should assign "unclear" at a high rate; a model with high hallucination will maintain a similar verdict distribution to the clear policy condition, ignoring the policy incoherence.

---

## 6.6 Cross-Experiment Model Comparison

**[Results: TBD — fill after running experiments]**

Across all experiments, we summarize the comparative performance of the three models on the key metrics. The cross-experiment comparison addresses the practical question of model selection for a production deployment: which model offers the best combination of accuracy, reasoning quality, phase sensitivity, uncertainty calibration, and adversarial robustness?

The cost dimension is also considered. Gemini 2.5 Flash, Qwen2.5-72B, and Mixtral-8x7B have different per-token prices via OpenRouter. If a smaller model achieves comparable accuracy on the core verdict task (E2–E3) while showing similar or better robustness properties, it may be preferred for deployment at scale.

We also report on unexpected findings, failure modes observed across multiple experiments, and any cases where all three models agreed on an incorrect verdict—which may indicate problems with the evaluation design, the ground truth annotation, or systematic prompt biases.
