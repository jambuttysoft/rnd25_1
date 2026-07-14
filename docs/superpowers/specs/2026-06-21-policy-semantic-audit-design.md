# Design Spec: AI-Driven Policy Semantic Audit

**Date:** 2026-06-21  
**Status:** Approved  
**Output format:** Hybrid scientific article + technical R&D report  
**Language:** English  
**Target length:** 15–20 pages

---

## 1. Research Title

> *AI-Driven Policy Semantic Audit: Zero-Shot Chain-of-Thought Reasoning for Expense Justification in R&D Projects*

---

## 2. Problem Statement

Standard expense audit systems validate format (date, amount, receipt present). They do not assess whether an expense is semantically justified given the project's current goals and phase. A GPU purchase is reasonable during model training; the same purchase during a documentation phase raises questions. This research builds and evaluates a pipeline that performs this semantic check using LLMs.

---

## 3. System Architecture

**Implementation:** Node.js + Express web application. Each experiment is an interactive tab in a single-page app. No build step — Express serves static files, all API calls go through the backend.

Three sequential layers (same pipeline, now exposed via web UI):

### Layer 1 — OCR & Extraction
Multimodal models extract structured fields from receipt images/PDFs:
- Fields: vendor, date, amount, currency, line items
- All models called via OpenRouter API (single API key)
- Vision model: `qwen/qwen2.5-vl-72b-instruct` or `google/gemini-2.5-flash`

### Layer 2 — Policy Grounding
Synthetic project policy is injected into the model context:
- Project description (what the R&D project is doing)
- Current phase (e.g., "Phase 2: Model Evaluation")
- Expense category taxonomy: allowed / restricted / forbidden per phase

### Layer 3 — CoT Reasoning & Verdict
The model reasons step-by-step over the extracted receipt against the grounded policy:
- Output: `verdict` (justified / suspicious / unclear) + `explanation` (free text)
- All reasoning models via OpenRouter: Gemini 2.5 Flash, Qwen2.5-72B, Mixtral-8x7B
- **Model is user-configurable in the Settings tab**

---

## 4. Data

**Real receipts:** 26 files in `/CASH_RECIEPTS/` — JPG photos and PDF invoices, October 2025 – January 2026. Manually annotated for ground truth (vendor, amount, category).

**Synthetic project policy:** Designed as part of the research methodology. Describes an R&D project with 3 phases (setup, experimentation, evaluation), each with distinct allowed/restricted expense categories. Multiple variants created for adversarial testing (clear policy, vague policy, contradictory policy).

---

## 5. Paper Structure

| Section | Content | ~Pages |
|---------|---------|--------|
| Abstract | Summary of problem, approach, key findings | 0.5 |
| 1. Introduction | Problem statement, motivation, research contributions | 1.5 |
| 2. Related Work | LLM-based document understanding, expense audit systems, CoT prompting | 2 |
| 3. System Architecture | Pipeline description, model selection rationale | 2 |
| 4. Methodology | Synthetic policy design, prompt engineering, evaluation metrics | 2 |
| 5. Experiments | E1–E6, each with: setup, hypothesis, problems encountered, solution, results | 6–8 |
| 6. Results & Discussion | Cross-experiment analysis, model comparison tables | 1.5 |
| 7. Limitations & Future Work | Known failure modes, what fine-tuning or RAG could add | 1 |
| 8. Conclusion | Summary of contributions | 0.5 |
| References | | 1 |

---

## 6. Experiments

Each experiment documents: **hypothesis → setup → problems encountered → solution applied → results**.

### E1 — OCR Extraction Baseline
- **Hypothesis:** Multimodal models can reliably extract structured fields from real-world receipt photos (varying quality, languages, formats).
- **Setup:** Run Gemini 2.5 Flash and Qwen-VL on all 26 files. Compare extracted fields against manual ground truth.
- **Metric:** Field-level precision/recall per model.
- **Expected problems:** Low image quality, non-standard layouts, mixed languages (RU/EN/DE).

### E2 — Zero-shot Classification Without CoT
- **Hypothesis:** A model prompted with policy and receipt data but *without* chain-of-thought instruction produces low-quality, poorly justified verdicts.
- **Setup:** Single-turn prompt: "Given this policy and receipt, is this expense justified? Answer: justified / suspicious / unclear."
- **Metric:** Inter-rater agreement between model verdict and two human judges (Cohen's kappa).
- **Role:** Establishes lower-bound baseline.

### E3 — Zero-shot CoT Reasoning
- **Hypothesis:** Adding "think step by step" CoT instruction improves verdict quality and produces auditable explanations.
- **Setup:** Same data as E2, prompt extended with CoT instruction. Compare all three models.
- **Metric:** Inter-rater agreement + explanation quality (human-rated 1–3 scale).
- **Expected problems:** Models may produce verbose reasoning that still leads to wrong verdict.

### E4 — Phase-Sensitive Reasoning
- **Hypothesis:** The same expense receives a different verdict when the stated project phase changes, demonstrating genuine semantic grounding rather than surface matching.
- **Setup:** Select 6–8 receipts. Run each against 3 policy variants (different phases). Record whether verdict changes appropriately.
- **Metric:** Phase-sensitivity score (% of receipts where verdict correctly flips between phases).

### E5 — Ambiguity & Uncertainty Handling
- **Hypothesis:** For inherently ambiguous expenses (e.g., restaurant receipt — team meeting or personal?), the model expresses `unclear` rather than forcing a verdict.
- **Setup:** Select 5–7 ambiguous receipts. Test whether models default to a verdict or flag uncertainty. Compare models.
- **Metric:** Uncertainty expression rate; human judge agreement on ambiguity classification.

### E6 — Adversarial Policy Stress Test
- **Hypothesis:** When the project policy is vague or internally contradictory, weaker models hallucinate confident justifications; stronger models flag the policy ambiguity.
- **Setup:** Create 3 synthetic policy variants: (a) clear, (b) vague, (c) contradictory. Run all models on the same 10 receipts across all variants.
- **Metric:** Hallucination rate (confident verdict with no valid policy basis) vs. uncertainty expression rate per model per policy variant.

---

## 7. Evaluation Metrics Summary

| Metric | Used in |
|--------|---------|
| Field-level precision/recall | E1 |
| Cohen's kappa (model vs. human) | E2, E3 |
| Explanation quality score (1–3) | E3 |
| Phase-sensitivity score | E4 |
| Uncertainty expression rate | E5, E6 |
| Hallucination rate | E6 |

---

## 8. Models Under Test

| Model | Access | Role |
|-------|--------|------|
| Gemini 2.5 Flash | Google AI API | OCR + reasoning |
| Qwen-VL | OpenRouter | OCR |
| Qwen2.5-72B | OpenRouter | Reasoning |
| Mistral / Mixtral-8x7B | OpenRouter | Reasoning (baseline) |

---

## 9. Open Questions

- [ ] What ground-truth annotation scheme to use for inter-rater agreement (binary vs. 3-class)?
- [ ] Should the synthetic policy be disclosed in the paper appendix for reproducibility?
- [ ] Which specific OpenRouter model IDs to pin (versions may affect reproducibility)?
- [ ] Are any receipts in CASH_RECIEPTS sensitive/confidential and need to be excluded or anonymized?

---

## 10. Out of Scope

- Fine-tuning any model (no labeled dataset of sufficient size)
- RAG-based retrieval over a policy vector store
- Real-time / production deployment
- Evaluation on datasets beyond the 26 available receipts
