# 3. System Architecture

## 3.1 Overview

The pipeline consists of three sequential layers executed on demand via a web interface. Each layer is independently configurable and can be run in isolation, which is important for the experimental design: experiments E1 through E6 test different layers and combinations.

```
┌─────────────────────────────────────────────────────────┐
│ User uploads receipt (JPG / PNG / PDF)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Layer 1: OCR & Extraction                               │
│ Multimodal LLM (vision) → JSON fields                   │
│ vendor, date, amount, currency, line_items, category    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Layer 2: Policy Grounding                               │
│ Synthetic policy loaded → phase selected →              │
│ structured text injected into context                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Layer 3: Reasoning & Verdict                            │
│ LLM (text) → reasoning chain → verdict + explanation   │
│ verdict: justified | suspicious | unclear               │
└─────────────────────────────────────────────────────────┘
```

The separation between Layer 1 and Layer 3 is deliberate. A multimodal (vision-capable) model handles receipt image reading, where spatial understanding of the document layout and OCR-level token recognition are required. The output is a structured JSON object that can be reliably serialized into the Layer 3 prompt. The reasoning and verdict step uses a text-only prompt and could therefore be run on a different, potentially cheaper or specialized model. This architecture enables model-swapping comparisons without changing the prompt logic.

## 3.2 Layer 1: OCR and Structured Extraction

Layer 1 accepts a receipt as a JPEG, PNG, or PDF file. The file is base64-encoded and submitted to the OpenRouter API as a multimodal message with the vision model specified in configuration. The prompt instructs the model to return a JSON object with six fields:

- `vendor`: The merchant or supplier name (string).
- `date`: Transaction date in ISO 8601 format (YYYY-MM-DD), or `null` if not legible.
- `amount`: Total amount paid as a numeric value (float), or `null` if not legible.
- `currency`: ISO 4217 currency code (e.g., `EUR`, `USD`, `RUB`).
- `line_items`: A summarized list of items purchased (array of strings).
- `category`: The inferred expense category from a fixed taxonomy: `equipment`, `software`, `travel`, `meals`, `services`, `supplies`, `other`.

The prompt explicitly instructs the model to return `null` for fields that cannot be reliably read from the image, rather than guessing. This is important for downstream policy evaluation: a hallucinated date or amount would corrupt the verdict reasoning.

For PDF inputs, the file is converted to a base64 image of the first page prior to submission. Multi-page PDFs are noted as a limitation in Section 7.

## 3.3 Layer 2: Policy Grounding

Layer 2 loads the selected policy variant from the `data/policy/` directory and serializes it into a structured text block for injection into the Layer 3 prompt. The serialization function (`policyAsText` in `lib/policy.js`) produces a plain-text representation of the policy that includes:

- Project name and description.
- The name and description of the selected phase.
- Allowed expense categories for the phase (comma-separated list).
- Restricted categories (those requiring additional justification).
- Forbidden categories.

The three policy variants are:

- **Clear policy (`policy_clear.json`):** Three phases with explicit, categorically distinct allowed/restricted/forbidden lists. Phase 1 is "Infrastructure Setup," Phase 2 is "Experimentation," Phase 3 is "Evaluation & Documentation." Each phase has 4–6 items per list with concrete, unambiguous category names.
- **Vague policy (`policy_vague.json`):** Same three phases but with generic descriptions. Allowed categories use language such as "work-related expenses" and "things needed for the project." Forbidden categories use "obvious personal expenses" and "unnecessary spending." No expense category is named specifically enough to permit deterministic rule-matching.
- **Contradictory policy (`policy_contradictory.json`):** Internal contradictions embedded at each phase. Phase 1 lists "equipment" in both the allowed and forbidden sections. Phase 2 simultaneously allows "travel" and forbids it, and asserts that remote work is both encouraged and prohibited. Phase 3 states that the budget is "flexible" in the description while the forbidden list prohibits "any new expenses without approval."

These variants were designed to span the space of policy quality from best-case to worst-case, enabling E6 to test whether models distinguish between them or apply uniform confidence regardless of policy coherence.

## 3.4 Layer 3: Reasoning and Verdict

Layer 3 constructs a final prompt from the serialized policy text, the extracted expense fields from Layer 1, and a reasoning instruction (when CoT mode is enabled). The prompt requests a structured JSON response with the following fields:

- `verdict`: One of `justified`, `suspicious`, or `unclear`.
- `reason`: A one-sentence explanation of the verdict.
- `reasoning` (CoT mode only): A step-by-step chain of reasoning, covering: (1) identification of expense type, (2) policy check for the current phase, (3) amount reasonableness assessment, and (4) ambiguity flagging.
- `policy_clarity` (E6 only): Model's assessment of the policy quality: `clear`, `vague`, or `contradictory`.

The three-class verdict schema was chosen over binary (compliant/non-compliant) because genuine ambiguity is an important outcome in policy compliance. An "unclear" verdict—when appropriately used—is more informative to a human auditor than a forced binary decision.

## 3.5 Implementation

The pipeline is implemented as a Node.js/Express web application using ES modules. The backend exposes two main API endpoints:

- `POST /api/extract`: Accepts a multipart form upload with a receipt file and optional model override. Returns the Layer 1 JSON extraction.
- `POST /api/verdict`: Accepts a JSON body with extracted fields, policy name, phase index, and `useCot` flag. Returns the Layer 3 verdict object.

The frontend is a single-page application organized into seven tabs (E1 through E6 and a Settings panel) built with vanilla JavaScript and styled with Tailwind CSS via CDN. All model configuration—vision model, reasoning model, default policy variant—is stored in `config.json` and modifiable at runtime through the Settings tab without restarting the server.

All LLM calls are routed through the OpenRouter API, which provides a unified endpoint for multiple model providers. Model selection is controlled by a string identifier (e.g., `google/gemini-2.5-flash`, `qwen/qwen2.5-72b-instruct`, `mistralai/mixtral-8x7b-instruct`) that is passed in each API request. This design allows model-switching experiments to be conducted without any code changes, only configuration updates.

## 3.6 Model Selection Rationale

Three models were selected to span a range of scale, capability, and provenance:

- **Gemini 2.5 Flash (`google/gemini-2.5-flash`):** The primary and default model for both vision and reasoning steps. Gemini 2.5 Flash is a state-of-the-art multimodal model with strong document understanding capabilities. It is among the highest-performing models available via OpenRouter at the time of this study and serves as the performance ceiling against which other models are compared.

- **Qwen2.5-72B (`qwen/qwen2.5-72b-instruct`):** An open-weight model at 72 billion parameters developed by Alibaba. Qwen2.5 demonstrates strong instruction-following and reasoning capabilities, particularly on structured output generation tasks. It serves as an open-weight reasoning baseline, enabling cost-sensitivity analysis against the proprietary Gemini model.

- **Mixtral-8x7B (`mistralai/mixtral-8x7b-instruct`):** A sparse mixture-of-experts model developed by Mistral AI with an effective parameter count of approximately 13 billion active parameters per token. It serves as a smaller open-weight baseline, testing whether model scale (Qwen2.5-72B versus Mixtral-8x7B) is a significant determinant of policy compliance quality. Mixtral-8x7B is notably less expensive per token than the other two models.

Note that Gemini 2.5 Flash is used for Layer 1 (vision/OCR) in all experiments, since Qwen2.5-72B and Mixtral-8x7B are text-only models and cannot process receipt images directly. Model comparisons in E2–E6 therefore apply only to the Layer 3 reasoning step, with Layer 1 outputs held constant.
