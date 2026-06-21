# 4. Methodology

## 4.1 Dataset

We collected 26 real expense receipts from an active R&D project (the AI Receipt Audit System project itself), comprising 21 JPG/PNG photographs and 5 PDF invoices. Receipts are dated between October 2025 and January 2026, spanning the Infrastructure Setup and Experimentation phases of the project. They represent genuine expenditures: vendor invoices, printed receipts, photographed paper receipts, and screenshots of digital payment confirmations.

The receipt set is intentionally heterogeneous. Image quality ranges from high-resolution scans to hand-held phone photographs taken in low light. Documents include printed receipts, invoices, and handwritten notes. Languages represented include English, German, and Russian—reflecting the geographic context of the project (DACH region and international software vendors). Vendors span multiple expense categories: hardware and equipment suppliers, cloud and API service providers, restaurants and catering venues, travel services, and professional services firms.

**Table 1: Dataset composition.**

| Category | Count |
|---|---|
| Equipment / hardware | (to confirm with annotations) |
| Software / API credits | (to confirm with annotations) |
| Meals and catering | (to confirm with annotations) |
| Travel | (to confirm with annotations) |
| Services | (to confirm with annotations) |
| Supplies | (to confirm with annotations) |
| **Total** | **26** |

Each receipt was manually annotated by a single human annotator (one of the project authors) with the following fields:

- **Vendor name** (string): The merchant or supplier as it appears on the receipt.
- **Date** (YYYY-MM-DD): The transaction or invoice date.
- **Total amount** (float): Total amount paid, net of any rounding discrepancies.
- **Currency** (ISO 4217): The currency of the transaction.
- **Line items** (array): A summarized list of purchased items or services.
- **Expense category** (enum): One of equipment, software, travel, meals, services, supplies, other.
- **Human verdict** (enum): `justified`, `suspicious`, or `unclear`—the annotator's judgment given the clear policy at Phase 2.
- **Verdict reason** (string): One sentence explaining the verdict.
- **Ambiguity flag** (boolean): True when the annotator judged the receipt to be genuinely ambiguous—cases where a reasonable reviewer might disagree.
- **Notes** (string): Free text for unusual receipt characteristics, quality issues, or edge cases.

The annotation was performed after completion of all experimental runs to minimize confirmation bias. A limitation of single-annotator annotation is discussed in Section 7.

## 4.2 Synthetic Policy Design

The three policy variants are designed to represent a spectrum of policy quality, from best-practice clarity to adversarial incoherence. All three variants describe the same project—the AI Receipt Audit System R&D project—which creates a self-referential evaluation setting: the model is being asked whether receipts from building an AI auditing system are justified under the policy governing that same system. This ecological validity is a deliberate design choice; the receipts are real, the policy is grounded in real project activities, and the verdicts have genuine interpretive weight.

**Clear policy.** The clear policy defines three sequential phases with explicitly named expense categories at each phase:
- Phase 1 (Infrastructure Setup): allows computer equipment, software licenses, cloud API credits, office supplies, and technical books; restricts team meals (maximum two per month) and local travel (maximum three per month); forbids personal items, entertainment, non-project subscriptions, and international travel.
- Phase 2 (Experimentation): allows API credits, data annotation tools, compute services, up to one technical conference, and team collaboration meals; restricts equipment (only if existing equipment fails) and software (project use only); forbids personal items, entertainment, and non-technical subscriptions.
- Phase 3 (Evaluation and Documentation): allows printing and binding, library access, academic journal access, and one small team celebration meal; restricts API credits (limited budget) and software (documentation tools only); forbids new hardware, travel, entertainment, and non-documentation expenses.

This policy is designed to be specific enough that a competent model should be able to reach consistent verdicts on unambiguous receipts and to identify genuinely unclear cases as such.

**Vague policy.** The vague policy uses generic language throughout. The project description states only "An R&D project involving AI and data work." Phase descriptions are single sentences ("Main development phase"). Allowed categories use formulations such as "work-related expenses," "necessary tools," "things needed for the project," and "reasonable expenses." Forbidden categories use "clearly non-work items," "obvious personal expenses," and "unnecessary spending." No specific expense category is mentioned anywhere in the policy. A model evaluating receipts under this policy must either fall back on general priors about appropriate R&D expenses or express uncertainty; it cannot derive a verdict from the policy text alone.

**Contradictory policy.** The contradictory policy embeds explicit logical contradictions at every phase. In Phase 1, "equipment" appears in both the allowed list and the forbidden list; simultaneously, "software must be open-source" appears in the restricted list while the allowed list includes "all technical expenses" and the forbidden list includes "proprietary software" (both constraints without bounds). In Phase 2, "travel" appears in both the allowed and forbidden lists; additionally, the description simultaneously states "remote work is encouraged" and "team must be on-site for collaboration," while the forbidden list includes "remote work subscriptions." In Phase 3, the description states "flexible budget" while the allowed list includes "celebration" and the forbidden list states "any new expenses without approval." A well-calibrated model should flag this policy as incoherent rather than proceeding to derive a verdict from it.

## 4.3 Prompt Design

Three prompt templates are used across the experiments. All prompts are stored as template strings in the server implementation and parameterized at runtime.

**Extraction prompt (Layer 1).** The vision model is given the receipt image and a system instruction defining the output schema. The instruction specifies that the model must return a valid JSON object with exactly the six defined fields, with `null` for any field that cannot be reliably read. The prompt explicitly prohibits inference or guessing: "If you cannot read a field with confidence, return null. Do not infer or estimate." This constraint is tested in E1 by measuring how often the model returns non-null values that do not match the human annotation.

**Verdict prompt — no CoT (Layer 3, E2).** The text model receives:
1. A system message establishing the auditor role: "You are a financial auditor. Your task is to determine whether an expense is justified under the project policy."
2. The serialized policy text for the selected variant and phase.
3. The extracted expense fields as a JSON block.
4. An instruction to return a JSON object with `verdict` (one of `justified`, `suspicious`, `unclear`) and `reason` (one sentence).

No reasoning instruction is provided. The model is expected to return a verdict directly.

**Verdict prompt — CoT (Layer 3, E3–E6).** Identical to the no-CoT prompt except for an additional reasoning instruction that precedes the JSON output request:

> Before reaching a verdict, reason through the following steps:
> 1. Identify the type of expense (category, vendor, amount, purpose).
> 2. Check whether this expense type is allowed, restricted, or forbidden under the current project phase.
> 3. Assess whether the amount is reasonable for this type of expense in this context.
> 4. Flag any ambiguities—cases where the policy is unclear, the receipt is incomplete, or the expense could be interpreted multiple ways.
>
> After completing these steps, return a JSON object with fields: `reasoning` (the full step-by-step analysis), `verdict` (justified/suspicious/unclear), and `reason` (one-sentence summary).

The four-step structure is designed to force the model to ground its verdict in the policy text rather than applying general priors. Step 2 explicitly requires the model to cite which policy clause applies, creating an auditable trace.

For E6, an additional field `policy_clarity` is requested in the JSON output, with the instruction: "Before reasoning about the expense, assess the policy: is it clear, vague, or contradictory? Assign one of: clear / vague / contradictory."

## 4.4 Evaluation Metrics

Each experiment uses one or more of the following metrics:

| Experiment | Primary Metric | Definition |
|---|---|---|
| E1 | Field-level precision | For each field (vendor, date, amount, currency, category): proportion of non-null model responses that exactly match the human annotation. Exact match for amounts requires rounding to two decimal places; dates require ISO 8601 format. |
| E2, E3 | Cohen's κ (kappa) | Inter-rater agreement between model verdict and human verdict across all 26 receipts. Three-class κ (justified / suspicious / unclear). |
| E4 | Phase-sensitivity score | Proportion of test receipts for which the model produces different verdicts across Phase 1 and Phase 3 (the phases most likely to diverge for the selected receipts). |
| E5 | Uncertainty expression rate | Proportion of ambiguity-flagged receipts for which the model returns `verdict: "unclear"` (rather than forcing a confident verdict). |
| E6 | Hallucination rate | Proportion of responses where the model assigns `policy_clarity: "clear"` when the input policy was vague or contradictory. |

For E2 and E3, Cohen's κ is computed using the three-class formulation. A κ above 0.6 is interpreted as substantial agreement; below 0.4 as poor agreement (Landis & Koch, 1977).

For E6, hallucination is defined conservatively: only responses that explicitly claim `policy_clarity: "clear"` on a non-clear policy are counted. Responses that omit the field, return `null`, or express hedged language are not counted as hallucinations.

## 4.5 Experimental Controls

Several controls are maintained across experiments to ensure comparability:

- **Constant OCR layer.** All experiments that use extracted expense fields (E2–E6) use the Layer 1 output from Gemini 2.5 Flash, run once and stored. This ensures that differences in verdict outcomes across models in E2–E6 are attributable to the reasoning step, not to variation in the extraction step.

- **Temperature.** All API calls use temperature=0 (or the minimum available via OpenRouter) to maximize output determinism. This is necessary for reproducibility: at temperature=0, the same prompt should produce the same output on repeated runs, allowing the experimental record to serve as a stable artifact.

- **Prompt versioning.** All prompts are version-controlled alongside the server code. No prompt changes are made between experimental runs.

- **Annotation independence.** Human annotation was completed before any experimental results were reviewed, preventing the annotator from calibrating verdicts to observed model behavior.
