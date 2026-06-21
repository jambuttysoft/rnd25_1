# Abstract

Standard expense audit systems validate the structural correctness of receipts—dates, amounts, and document formats—but do not assess whether an expense is semantically appropriate given a project's stated goals and phase. This paper introduces an AI-driven pipeline for Policy Semantic Audit, where a large language model (LLM) evaluates each expense against a natural-language project policy using zero-shot chain-of-thought (CoT) reasoning.

We implement the pipeline as an interactive web application backed by the OpenRouter API, enabling real-time evaluation across multiple models including Gemini 2.5 Flash, Qwen2.5-72B, and Mixtral-8x7B. We conduct six experiments on 26 real expense receipts drawn from an active R&D project spanning October 2025 to January 2026: (E1) multimodal OCR field extraction, (E2) zero-shot verdict classification without reasoning, (E3) CoT-augmented reasoning, (E4) phase-sensitive verdict consistency, (E5) uncertainty expression on ambiguous expenses, and (E6) adversarial evaluation under vague and contradictory policies.

Our results demonstrate that **[Results: TBD — fill after running experiments]**. For each experiment we document implementation problems encountered and solutions applied, providing a reproducible research artifact. The primary practical contribution is a failure-mode taxonomy for applied LLM compliance pipelines, together with an open interactive web application enabling replication of all reported experiments.

**Keywords:** expense auditing, policy compliance, chain-of-thought reasoning, multimodal LLM, document understanding, OpenRouter, zero-shot reasoning.
