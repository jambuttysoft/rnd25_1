// Mock OpenRouter client for offline testing.
// Set MOCK_OPENROUTER=true in .env to use.

const MOCK_OPENROUTER = process.env.MOCK_OPENROUTER === 'true'

const defaultExtraction = {
  vendor: 'ACME Supplies',
  vendor_address: '123 Main St, Sydney NSW 2000',
  vendor_phone: '+61 2 1234 5678',
  vendor_tax_id: 'ABN 12 345 678 901',
  receipt_number: 'INV-001',
  date: '2025-10-03',
  time: '14:30',
  payment_method: 'Credit Card',
  subtotal: 90.91,
  tax_amount: 9.09,
  tax_rate: 0.10,
  amount: 100.00,
  currency: 'AUD',
  category: 'supplies',
  line_items: [
    { description: 'Office supplies', quantity: 1, unit_price: 50.00, total_price: 50.00 },
    { description: 'Stationery', quantity: 1, unit_price: 40.91, total_price: 40.91 }
  ]
}

function randomVerdict() {
  const v = ['justified', 'suspicious', 'unclear']
  return v[Math.floor(Math.random() * v.length)]
}

function buildReason(verdict, policyName, phase) {
  const phaseLabel = ['Infrastructure Setup', 'Experimentation', 'Evaluation & Documentation'][phase] || 'Unknown'
  const policyLabel = policyName || 'clear'
  if (verdict === 'justified') return `The expense is consistent with the ${policyLabel} policy during ${phaseLabel}.`
  if (verdict === 'suspicious') return `The expense conflicts with a restriction in the ${policyLabel} policy for ${phaseLabel}.`
  return `The available information is insufficient to determine compliance under the ${policyLabel} policy for ${phaseLabel}.`
}

export async function callText(messages, model, apiKey) {
  if (!MOCK_OPENROUTER) {
    const { callText: real } = await import('./openrouter.js')
    return real(messages, model, apiKey)
  }
  await new Promise(r => setTimeout(r, 80))
  const content = messages[0]?.content || ''
  const text = typeof content === 'string' ? content : content.filter(p => p.type === 'text').map(p => p.text).join('\n')
  if (text.includes('Reply with the single word: OK')) return 'OK'
  if (text.includes('extraction') || text.includes('Extract')) {
    return JSON.stringify(defaultExtraction)
  }
  if (text.includes('adversarial')) {
    return JSON.stringify({
      verdict: randomVerdict(),
      reason: 'Mock adversarial reasoning.',
      reasoning: '1. Assessed policy clarity.\n2. Applied policy.\n3. Produced verdict.',
      policy_clarity: 'clear',
      confidence: 'medium'
    })
  }
  return JSON.stringify({
    verdict: randomVerdict(),
    reason: 'Mock reasoning for offline testing.',
    reasoning: '1. Identified expense.\n2. Quoted policy.\n3. Reached verdict.',
    confidence: 'medium'
  })
}

export async function callVision(imageBase64, mimeType, textPrompt, model, apiKey) {
  if (!MOCK_OPENROUTER) {
    const { callVision: real } = await import('./openrouter.js')
    return real(imageBase64, mimeType, textPrompt, model, apiKey)
  }
  return callText([{ role: 'user', content: [{ type: 'text', text: textPrompt }] }], model, apiKey)
}

export function extractJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('No JSON found in mock response')
  }
}

export function normalizeAmount(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/[€$£¥₽\s]/g, '');
  if (!s) return null;
  // European format: 1.249,00 (period = thousands separator, comma = decimal)
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Standard format with comma as decimal: 649,99
  return parseFloat(s.replace(',', '.'));
}
