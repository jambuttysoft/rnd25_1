import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { callText, callVision, extractJson, normalizeAmount } from './lib/openrouter.js';
import { loadPolicy, policyAsText, listPolicies, validatePolicy, writePolicy } from './lib/policy.js';
import { PROMPTS, fillPrompt } from './lib/prompts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Paths for annotation storage
const GT_PATH = join(__dirname, 'data', 'annotations', 'ground_truth.json');
const RECEIPTS_DIR = join(__dirname, 'CASH_RECIEPTS');

function loadAnnotations() {
  try {
    return JSON.parse(readFileSync(GT_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveAnnotations(data) {
  writeFileSync(GT_PATH, JSON.stringify(data, null, 2));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'public')));

function loadConfig() {
  return JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(join(__dirname, 'config.json'), JSON.stringify(cfg, null, 2));
}

// Settings routes
app.get('/api/settings', (req, res) => {
  const cfg = loadConfig();
  cfg.apiKey = process.env.OPENROUTER_API_KEY || '';
  res.json(cfg);
});

app.post('/api/settings', (req, res) => {
  const cfg = loadConfig();
  Object.assign(cfg, req.body);
  saveConfig(cfg);
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── POST /api/test-connection ────────────────────────────────────────────────
// Verify that the API key works by sending a trivial request.
app.post('/api/test-connection', async (req, res) => {
  const { apiKey: frontKey, model } = req.body;
  const apiKey = frontKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ ok: false, error: 'apiKey is required' });
  try {
    const result = await callText(
      [{ role: 'user', content: 'Reply with the single word: OK' }],
      model || 'google/gemini-2.5-flash',
      apiKey
    );
    res.json({ ok: true, response: result.trim().slice(0, 100) });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});


// ─── POST /api/extract ────────────────────────────────────────────────────────
// E1: Extract structured fields from a receipt image using the vision model.
app.post('/api/extract', async (req, res) => {
  const { base64, mimeType, apiKey: frontKey, model } = req.body;
  const apiKey = frontKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    const raw = await callVision(base64, mimeType || 'image/jpeg', PROMPTS.extraction, model, apiKey);
    const extraction = extractJson(raw);
    // Normalize amount to float (handles European format "1.249,00")
    extraction.amount = normalizeAmount(extraction.amount);
    res.json({ extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── POST /api/verdict ────────────────────────────────────────────────────────
// E2, E3, E5: Two-step pipeline — OCR extraction then reasoning verdict.
// useCot: false → E2, useCot: true → E3 (4-step), useCot: true + useE5Prompt: true → E5 (5-step)
app.post('/api/verdict', async (req, res) => {
  const { base64, mimeType, apiKey: frontKey, model, visionModel, policy: policyName, phase, useCot, useE5Prompt } = req.body;
  const apiKey = frontKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    // Step 1: Extract receipt fields using vision model
    const rawExtract = await callVision(
      base64,
      mimeType || 'image/jpeg',
      PROMPTS.extraction,
      visionModel || model,
      apiKey
    );
    const extraction = extractJson(rawExtract);
    extraction.amount = normalizeAmount(extraction.amount);

    // Step 2: Build policy text for the selected variant and phase
    const policy = loadPolicy(policyName || 'clear');
    const phaseIndex = Number.isInteger(phase) ? phase : parseInt(phase ?? 1);
    const policyText = policyAsText(policy, phaseIndex);

    // Step 3: Select prompt template
    let promptTemplate;
    if (!useCot) {
      promptTemplate = PROMPTS.verdictNoCot;
    } else if (useE5Prompt) {
      promptTemplate = PROMPTS.verdictCotE5;  // 5-step with info-sufficiency check
    } else {
      promptTemplate = PROMPTS.verdictCot;     // 4-step with policy quotation
    }

    // Step 4: Fill prompt and call reasoning model
    const prompt = fillPrompt(promptTemplate, {
      policy_text: policyText,
      vendor: extraction.vendor,
      date: extraction.date,
      amount: extraction.amount,
      currency: extraction.currency,
      category: extraction.category,
      line_items: (extraction.line_items || []).join(', ') || 'unknown',
    });

    const rawVerdict = await callText([{ role: 'user', content: prompt }], model, apiKey);
    const verdict = extractJson(rawVerdict);

    res.json({ ...verdict, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── POST /api/phase-sensitivity ─────────────────────────────────────────────
// E4: Evaluate the same expense across all 3 project phases in parallel.
app.post('/api/phase-sensitivity', async (req, res) => {
  const { base64, mimeType, apiKey: frontKey, model, visionModel, policy: policyName } = req.body;
  const apiKey = frontKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    // Step 1: Extract receipt fields once
    const rawExtract = await callVision(
      base64,
      mimeType || 'image/jpeg',
      PROMPTS.extraction,
      visionModel || model,
      apiKey
    );
    const extraction = extractJson(rawExtract);
    extraction.amount = normalizeAmount(extraction.amount);

    // Step 2: Load policy
    const policy = loadPolicy(policyName || 'clear');

    // Step 3: Evaluate across all 3 phases in parallel
    const phases = await Promise.all(
      policy.phases.map(async (phaseObj, i) => {
        const policyText = policyAsText(policy, i);
        const prompt = fillPrompt(PROMPTS.verdictCot, {
          policy_text: policyText,
          vendor: extraction.vendor,
          date: extraction.date,
          amount: extraction.amount,
          currency: extraction.currency,
          category: extraction.category,
          line_items: (extraction.line_items || []).join(', ') || 'unknown',
        });
        const raw = await callText([{ role: 'user', content: prompt }], model, apiKey);
        const result = extractJson(raw);
        return { phase: phaseObj.name, ...result };
      })
    );

    res.json({ phases, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── POST /api/adversarial ────────────────────────────────────────────────────
// E6: Evaluate the same expense under all 3 policy variants in parallel.
app.post('/api/adversarial', async (req, res) => {
  const { base64, mimeType, apiKey: frontKey, model, visionModel, phase } = req.body;
  const apiKey = frontKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'apiKey is required' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    // Step 1: Extract receipt fields once
    const rawExtract = await callVision(
      base64,
      mimeType || 'image/jpeg',
      PROMPTS.extraction,
      visionModel || model,
      apiKey
    );
    const extraction = extractJson(rawExtract);
    extraction.amount = normalizeAmount(extraction.amount);

    const phaseIndex = Number.isInteger(phase) ? phase : parseInt(phase ?? 1);
    const policyNames = ['clear', 'vague', 'contradictory'];

    // Step 2: Evaluate under all 3 policy variants in parallel
    const policies = await Promise.all(
      policyNames.map(async (policyName) => {
        const policy = loadPolicy(policyName);
        const policyText = policyAsText(policy, phaseIndex);
        const prompt = fillPrompt(PROMPTS.adversarial, {
          policy_text: policyText,
          vendor: extraction.vendor,
          date: extraction.date,
          amount: extraction.amount,
          currency: extraction.currency,
          category: extraction.category,
          line_items: (extraction.line_items || []).join(', ') || 'unknown',
        });
        const raw = await callText([{ role: 'user', content: prompt }], model, apiKey);
        const result = extractJson(raw);

        // Hallucination: model claims policy is "clear" when it isn't
        const hallucination = policyName !== 'clear' && result.policy_clarity === 'clear';

        return { policy: policyName, ...result, hallucination };
      })
    );

    res.json({ policies, extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── GET /api/receipts ────────────────────────────────────────────────────────
// List all receipt filenames from the CASH_RECIEPTS directory.
app.get('/api/receipts', (req, res) => {
  try {
    const files = readdirSync(RECEIPTS_DIR)
      .filter(f => /\.(jpg|jpeg|png|pdf)$/i.test(f))
      .sort();
    res.json(files);
  } catch (e) {
    res.json({ error: `Cannot read CASH_RECIEPTS: ${e.message}` });
  }
});


// ─── GET /api/annotations ─────────────────────────────────────────────────────
// Return all annotation records from ground_truth.json.
app.get('/api/annotations', (req, res) => {
  res.json(loadAnnotations());
});


// ─── POST /api/annotations ────────────────────────────────────────────────────
// Upsert one annotation record.
app.post('/api/annotations', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.filename) {
    return res.json({ error: 'filename is required' });
  }
  try {
    const all = loadAnnotations();
    const idx = all.findIndex(a => a.filename === entry.filename);
    if (idx >= 0) {
      all[idx] = entry;
    } else {
      all.push(entry);
    }
    saveAnnotations(all);
    res.json({ ok: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ─── GET /api/policies ──────────────────────────────────────
// List all available policy names
app.get('/api/policies', (req, res) => {
  const names = listPolicies()
  res.json(names.map(name => ({
    name,
    description: loadPolicy(name).description,
    editable: true,
  })))
})

// ─── GET /api/policies/:name ────────────────────────────────
// Get a full policy object by name
app.get('/api/policies/:name', (req, res) => {
  try {
    const policy = loadPolicy(req.params.name)
    res.json(policy)
  } catch (e) {
    if (e.message && e.message.startsWith('Unknown policy')) {
      return res.status(404).json({ error: `Policy not found: ${req.params.name}` })
    }
    res.status(500).json({ error: `Failed to load policy: ${e.message}` })
  }
})

// ─── PUT /api/policies/:name ────────────────────────────────
// Update/save a policy. Validates before writing.
app.put('/api/policies/:name', (req, res) => {
  const name = req.params.name
  const validNames = listPolicies()
  if (!validNames.includes(name)) {
    return res.status(404).json({ error: `Policy not found: ${name}` })
  }
  const validation = validatePolicy(req.body, name)
  if (!validation.valid) {
    return res.status(400).json({ error: 'Validation failed', details: validation.errors })
  }
  try {
    writePolicy(name, req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: `Failed to save policy: ${e.message}` })
  }
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

export { app, upload, loadConfig };
