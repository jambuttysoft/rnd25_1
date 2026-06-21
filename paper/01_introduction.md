# 1. Introduction

## 1.1 The Auditability Gap

Modern expense management platforms—such as SAP Concur, Expensify, and custom ERP solutions—automate the verification of expense reports at the structural level: they confirm that a receipt is present, that it shows a valid date, that the amount matches the claim, and that required fields are populated. This format-level validation is necessary but not sufficient for genuine financial governance.

A receipt for a high-end restaurant dinner is structurally valid. But is it semantically justified? The answer depends on context: a team working dinner during a product launch sprint is different from a personal dinner charged to a research project in its documentation phase. No rule-based system can make this distinction reliably; it requires understanding the project's current goals, constraints, and phase.

The gap between structural validation and semantic justification is most acute in project-based accounting environments: R&D grants, startup seed funding, public research projects, and consulting engagements. In these contexts, each expense must be defensible not merely as a real transaction but as an appropriate one given what the project is trying to achieve at its current stage. Auditors—whether internal controllers or external grant reviewers—must read dozens of receipts per month and evaluate each against loosely worded policy documents. The cognitive burden is high, the criteria are often subjective, and mistakes have financial and reputational consequences.

Large language models (LLMs) offer a plausible path toward automating this judgment. They can read natural language policy documents, extract fields from document images, and reason about whether a specific expense is consistent with stated constraints. The critical question is whether their reasoning is reliable, auditable, and robust to poorly specified policies—properties that have not been systematically evaluated in the expense-auditing domain.

## 1.2 Research Question

We ask: **Can a large language model, given a natural-language project policy and a receipt, reason zero-shot about whether the expense is semantically justified?**

This question has three important sub-questions that structure our experimental design:

1. **Accuracy:** Do LLM verdicts align with human expert judgments, and does chain-of-thought prompting improve that alignment?
2. **Phase sensitivity:** Does the model genuinely use the stated project phase when reaching a verdict, or does it reason in a policy-agnostic way?
3. **Robustness:** What happens when the policy is vague or internally contradictory—does the model flag the ambiguity or hallucinate a confident but unsupported verdict?

This question has practical significance in R&D finance, startup accounting, and public grant management, where human reviewers audit dozens of receipts per month against loosely defined project scopes. A reliable, auditable LLM pipeline could substantially reduce this burden while generating written justifications that themselves serve as audit trail artifacts.

## 1.3 Contributions

This paper makes the following contributions:

1. **Pipeline design.** A three-layer architecture—multimodal OCR extraction → policy grounding → CoT reasoning and verdict—implemented as a functioning web application that can process real expense receipts in real time.

2. **Synthetic policy framework.** A methodology for constructing project expense policies with three variants (clear, vague, contradictory) to stress-test model behavior. The policies are grounded in the project itself—the AI Receipt Audit System R&D project—creating a self-referential and ecologically valid evaluation scenario.

3. **Six-experiment empirical evaluation.** Run on 26 real expense receipts spanning OCR accuracy, reasoning quality, phase sensitivity, uncertainty handling, and adversarial policy robustness. Each experiment is paired with a falsifiable hypothesis that guides result interpretation.

4. **Failure mode taxonomy.** Systematic documentation of problems encountered at each stage—prompt injection risks, JSON parsing failures, vision model hallucinations, over-confident verdicts under contradictory policies—together with the solutions applied. This documentation is a contribution to reproducibility in applied LLM research.

5. **Open research artifact.** An interactive web application enabling real-time replication of all experiments, with configurable model selection, policy variant, and project phase.

## 1.4 Scope and Non-Goals

This study is explicitly a zero-shot evaluation: we do not fine-tune any model on expense audit data, nor do we train a classifier. The goal is to characterize what off-the-shelf LLMs, accessed via a standard API, can do with well-engineered prompts. We are not building a production system; we are conducting a controlled empirical study to establish a baseline for this task and identify the most significant failure modes.

The paper is structured as follows. Section 2 surveys related work on document understanding, policy compliance in NLP, and chain-of-thought prompting. Section 3 describes the system architecture. Section 4 presents the methodology, including the dataset and prompt design. Sections 5 and 6 present the experimental setup and results. Sections 7 and 8 discuss limitations and conclusions.
