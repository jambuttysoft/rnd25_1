/**
 * All LLM prompt templates.
 * Use fillPrompt(template, vars) to substitute {placeholders}.
 *
 * Placeholders used in verdict prompts:
 *   {policy_text}  — output of policyAsText(policy, phaseIndex)
 *   {vendor}       — string or "unknown"
 *   {date}         — ISO date string or "unknown"
 *   {amount}       — number or "unknown"
 *   {currency}     — ISO 4217 code or "unknown"
 *   {category}     — one of the category enum values
 *   {line_items}   — comma-separated string of items
 */
export const PROMPTS = {

  /**
   * E1: Receipt field extraction.
   * Designed to minimize hallucination on unreadable fields (null-compliant instruction)
   * and maximize category accuracy on non-English receipts (explicit taxonomy with anchors).
   */
  /**
   * E1: Receipt field extraction — maximum information extraction.
   */
  extraction: `You are a receipt data extraction system. Extract EVERY readable field from this receipt image.
Return ONLY a valid JSON object with NO markdown fences, NO explanation, NO extra text.

{
  "vendor": "full merchant/supplier name exactly as written on receipt, or null",
  "vendor_address": "full store address including street, city, postal code, or null",
  "vendor_phone": "phone number on receipt, or null",
  "vendor_tax_id": "VAT / TIN / USt-IdNr / ИНН tax registration number, or null",
  "receipt_number": "receipt / invoice / check / bill number, or null",
  "date": "transaction date in YYYY-MM-DD format, or null",
  "time": "transaction time in HH:MM format (24h), or null",
  "subtotal": "amount before tax as float, or null",
  "tax_amount": "VAT/tax amount listed on receipt as float, or null",
  "tax_rate": "tax percentage if shown (e.g. 20, 19, 7.7), or null",
  "surcharge": "surcharge or fee or card charge listed on receipt as float, or null",
  "cash_out": "cash out or cashback amount listed on receipt as float, or null",
  "points_payment": "amount paid using loyalty points, rewards, or bonuses as float, or null",
  "points_earned": "loyalty points, rewards, or bonuses earned during this transaction as float or integer, or null",
  "gift_card_payment": "amount paid using gift cards, store credits, vouchers, or digital certificates as float, or null",
  "other_virtual_payment": "amount paid using other virtual money, mobile account balance, e-wallet funds, or promotional credits as float, or null",
  "amount": "total amount paid (after tax) as float, or null",
  "currency": "ISO 4217 code (EUR, USD, RUB, UAH, etc.), or null",
  "payment_method": "one of: cash, card, bank_transfer, online, or null",
  "line_items": [{"description": "item name", "quantity": 1, "unit_price": 9.99, "total_price": 9.99}],
  "category": "ONE of: equipment, software, travel, meals, services, supplies, other"
}

Category definitions — use EXACTLY one of these values:
- equipment: physical hardware, devices, monitors, peripherals, cables, printers
- software: software licenses, SaaS subscriptions, API credits, cloud compute, hosting
- travel: transport tickets, taxi, hotel, accommodation, fuel
- meals: restaurants, cafés, catering, food delivery
- services: professional consulting, design, legal, accounting, printing services
- supplies: stationery, office materials, cleaning supplies
- other: anything that does not clearly fit the above

IMPORTANT RULES:
- Read EVERY piece of text on the receipt — dates, numbers, addresses, tax IDs, item lines.
- Extract everything in precision: do not invent, change or adjust values. Keep them exactly as they are on the receipt.
- If there is a surcharge, card fee, service charge, etc., extract it into the surcharge field.
- Extract explicitly indicated cash out or cashback into the cash_out field. Additionally, if the payment was made by card but change was given in cash (e.g. card charged for a higher amount than the purchase total, and difference returned in cash), this cash difference/change must be recognized and extracted as cash_out.
- If the receipt indicates payment with loyalty points, bonuses, gift cards, vouchers, store credits, or other virtual/electronic money, extract the respective amounts into points_payment, gift_card_payment, or other_virtual_payment.
- If there are points/bonuses earned listed on the receipt, extract the value into points_earned.
- If a field IS visible and readable, fill it in. Do NOT skip readable fields.
- If a field is truly not visible, illegible, or not present on the receipt, use null — never guess.
- For line_items: extract each item with quantity, unit_price, and total_price if shown.
- For payment_method: look for words like "Cash", "Card", "Visa", "Mastercard", "Банковская карта", "Наличные".
- Tax IDs are common on European receipts: look for "USt-IdNr", "VAT", "ИНН", "TIN", "NIP".`,

  /**
   * E2: Verdict without chain-of-thought.
   * Direct classification: policy + fields → verdict.
   */
  verdictNoCot: `You are a financial expense auditor.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}
Points Payment: {points_payment}
Points Earned: {points_earned}
Gift Card Payment: {gift_card_payment}
Other Virtual Payment: {other_virtual_payment}

Is this expense justified under the project policy for this phase?

Return ONLY a valid JSON object with NO markdown fences:
{"verdict": "justified or suspicious or unclear", "reason": "one sentence explaining your verdict"}

verdict must be exactly one of: justified, suspicious, unclear`,

  /**
   * E3: Verdict with 4-step chain-of-thought.
   * Step 2 requires explicit policy quotation to prevent circular reasoning.
   */
  verdictCot: `You are a financial expense auditor. Think step by step before giving a verdict.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}
Points Payment: {points_payment}
Points Earned: {points_earned}
Gift Card Payment: {gift_card_payment}
Other Virtual Payment: {other_virtual_payment}

Reason through these steps:
1. Identify the type of expense: what was purchased, from whom, and for what apparent purpose.
2. Check the POLICY TEXT above. Quote the specific clause that applies to this expense category.
   If no clause directly addresses this category, say so explicitly.
   Determine: allowed as-is / allowed with conditions / restricted / forbidden.
3. Assess whether the amount is reasonable for this type of expense in a professional R&D context.
4. Flag any ambiguities: cases where the policy is unclear, the receipt is incomplete,
   or the expense could reasonably be interpreted multiple ways.

After completing these steps, return ONLY a valid JSON object with NO markdown fences:
{
  "reasoning": "your full step-by-step analysis following steps 1-4",
  "verdict": "justified or suspicious or unclear",
  "reason": "one sentence summary of the verdict"
}

verdict must be exactly one of: justified, suspicious, unclear`,

  /**
   * E5: Verdict with 5-step CoT, adding information sufficiency check.
   * The 5th step forces the model to consider whether the receipt alone contains
   * enough information to determine justification — triggering "unclear" on
   * genuinely ambiguous receipts (e.g., a restaurant receipt with no context).
   */
  verdictCotE5: `You are a financial expense auditor. Think step by step before giving a verdict.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}
Points Payment: {points_payment}
Points Earned: {points_earned}
Gift Card Payment: {gift_card_payment}
Other Virtual Payment: {other_virtual_payment}

Reason through these steps:
1. Identify the type of expense: what was purchased, from whom, and for what apparent purpose.
2. Check the POLICY TEXT above. Quote the specific clause that applies to this expense category.
   Determine: allowed as-is / allowed with conditions / restricted / forbidden.
3. Assess whether the amount is reasonable for this type of expense in a professional R&D context.
4. Flag any policy ambiguities: cases where the policy text itself is unclear or incomplete.
5. Assess information sufficiency: Does the receipt alone provide enough information to
   determine whether this expense is justified? If the verdict depends on context NOT visible
   in the receipt (who attended, what was discussed, whether prior approval was obtained,
   the business purpose of the trip), return "unclear" and explicitly state what additional
   information is required to make a determination.

After completing these steps, return ONLY a valid JSON object with NO markdown fences:
{
  "reasoning": "your full step-by-step analysis following steps 1-5",
  "verdict": "justified or suspicious or unclear",
  "reason": "one sentence summary"
}

verdict must be exactly one of: justified, suspicious, unclear`,

  /**
   * E6: Adversarial verdict — also assesses policy clarity.
   * The policy_clarity field enables detection of hallucinated confidence
   * when the model is given a vague or contradictory policy.
   */
  adversarial: `You are a financial expense auditor. Think step by step.

PROJECT POLICY:
{policy_text}

EXPENSE TO AUDIT:
Vendor: {vendor}
Date: {date}
Amount: {amount} {currency}
Category: {category}
Items: {line_items}
Points Payment: {points_payment}
Points Earned: {points_earned}
Gift Card Payment: {gift_card_payment}
Other Virtual Payment: {other_virtual_payment}

First, assess the policy quality. Then reason about the expense.

Reason through these steps:
1. Assess the policy: is it specific and internally consistent (clear), uses vague/generic
   language without specific categories (vague), or contains internal contradictions where
   the same expense type appears in both allowed and forbidden lists (contradictory)?
2. Identify the expense type and find the applicable policy clause.
3. If the policy is contradictory, explicitly state the contradiction you found.
   Do NOT resolve contradictions by choosing one clause over the other —
   return "unclear" when the policy contradicts itself.
4. Assess amount reasonableness.
5. Flag any ambiguities.

Return ONLY a valid JSON object with NO markdown fences:
{
  "reasoning": "your full step-by-step analysis",
  "verdict": "justified or suspicious or unclear",
  "reason": "one sentence summary",
  "policy_clarity": "clear or vague or contradictory"
}

verdict must be exactly one of: justified, suspicious, unclear
policy_clarity must be exactly one of: clear, vague, contradictory`,
};

/**
 * Fill a prompt template by replacing {placeholder} tokens with values.
 * @param {string} template  Prompt string with {placeholders}
 * @param {Object} vars      Key-value map of substitutions
 * @returns {string}
 */
export function fillPrompt(template, vars) {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, v ?? 'unknown'),
    template
  );
}
