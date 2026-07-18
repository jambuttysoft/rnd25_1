import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { execSync } from 'child_process';

import { callText, callVision, extractJson, normalizeAmount } from "./lib/mock-openrouter.js";
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

function saveUploadedReceipt(filename, base64) {
  if (!filename || !base64) return;
  const safeFilename = basename(filename);
  if (safeFilename !== filename) return;
  const filePath = join(RECEIPTS_DIR, safeFilename);
  if (!existsSync(filePath)) {
    try {
      writeFileSync(filePath, Buffer.from(base64, 'base64'));
    } catch (err) {
      console.warn(`Failed to write uploaded receipt ${safeFilename}: ${err.message}`);
    }
  }
}

app.use(express.json({ limit: '50mb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(join(__dirname, 'public'), {
  etag: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  },
}));

function loadConfig() {
  return JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(join(__dirname, 'config.json'), JSON.stringify(cfg, null, 2));
}

// Settings routes
app.get('/api/settings', (req, res) => {
  const cfg = loadConfig();
  res.json({
    model: cfg.model,
    visionModel: cfg.visionModel,
    currency: cfg.currency,
    hasApiKey: !!process.env.OPENROUTER_API_KEY
  });
});

app.post('/api/settings', (req, res) => {
  const { model, visionModel, currency } = req.body;
  const cfg = loadConfig();
  if (model) cfg.model = model;
  if (visionModel) cfg.visionModel = visionModel;
  if (currency) cfg.currency = currency;
  saveConfig(cfg);
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── POST /api/test-connection ────────────────────────────────────────────────
// Verify that the API key works by sending a trivial request.
app.post('/api/test-connection', async (req, res) => {
  const { model } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ ok: false, error: 'OPENROUTER_API_KEY is not set in the server environment (.env file)' });
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


app.post('/api/extract', async (req, res) => {
  const { base64, mimeType, filename, model, currency } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'OPENROUTER_API_KEY is not set in the server environment (.env file)' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    saveUploadedReceipt(filename, base64);
    const raw = await callVision(base64, mimeType || 'image/jpeg', PROMPTS.extraction, model, apiKey);
    const extraction = extractJson(raw);
    // Normalize amount to float (handles European format "1.249,00")
    extraction.amount = normalizeAmount(extraction.amount);
    
    // Normalize currency value
    if (extraction.currency) {
      const cur = String(extraction.currency).trim().toUpperCase();
      if (cur === 'NULL' || cur === 'UNKNOWN' || cur === '—') {
        extraction.currency = null;
      } else {
        extraction.currency = cur;
      }
    }
    
    // Fallback to settings currency if not detected and not 'Any'
    if (!extraction.currency && currency && currency !== 'Any') {
      extraction.currency = currency;
    }
    
    res.json({ extraction });
  } catch (e) {
    res.json({ error: e.message });
  }
});


// ─── POST /api/verdict ────────────────────────────────────────────────────────
// E2, E3, E5: Two-step pipeline — OCR extraction then reasoning verdict.
// useCot: false → E2, useCot: true → E3 (4-step), useCot: true + useE5Prompt: true → E5 (5-step)
app.post('/api/verdict', async (req, res) => {
  const { base64, mimeType, filename, model, visionModel, policy: policyName, phase, useCot, useE5Prompt, currency } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'OPENROUTER_API_KEY is not set in the server environment (.env file)' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    saveUploadedReceipt(filename, base64);
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
    if (currency && currency !== 'Any') extraction.currency = currency;

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
  const { base64, mimeType, filename, model, visionModel, policy: policyName, currency } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'OPENROUTER_API_KEY is not set in the server environment (.env file)' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    saveUploadedReceipt(filename, base64);
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
    if (currency && currency !== 'Any') extraction.currency = currency;

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
  const { base64, mimeType, filename, model, visionModel, phase, currency } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ error: 'OPENROUTER_API_KEY is not set in the server environment (.env file)' });
  if (!base64) return res.json({ error: 'base64 image data is required' });
  try {
    saveUploadedReceipt(filename, base64);
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
    if (currency && currency !== 'Any') extraction.currency = currency;

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


// ─── GET /api/receipts/:filename ──────────────────────────────────────────────
// Serve a single receipt image for the GT preview pane.
// Validates the filename against the known list to prevent directory traversal.
app.get('/api/receipts/:filename', (req, res) => {
  try {
    const files = readdirSync(RECEIPTS_DIR)
      .filter(f => /\.(jpg|jpeg|png|pdf)$/i.test(f));
    const requested = req.params.filename;
    if (!files.includes(requested)) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const filePath = join(RECEIPTS_DIR, requested);
    const ext = requested.toLowerCase().split('.').pop();
    const mime = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ─── GET /api/annotations ─────────────────────────────────────────────────────
// Return all annotation records from ground_truth.json.
app.get('/api/annotations', (req, res) => {
  res.json(loadAnnotations());
});


// ─── GET /api/annotations/stats ──────────────────────────────────────────────
// Aggregate counts for the GT KPI strip. Compares annotated filenames against
// the full receipt list to surface pending (no entry or empty verdict),
// completed (verdict set), and skipped (explicitly marked skipped).
app.get('/api/annotations/stats', (req, res) => {
  try {
    const annotations = loadAnnotations();
    let receipts = [];
    try {
      receipts = readdirSync(RECEIPTS_DIR)
        .filter(f => /\.(jpg|jpeg|png|pdf)$/i.test(f));
    } catch {
      receipts = [];
    }

    const annByName = new Map(annotations.map(a => [a.filename, a]));

    let pending = 0;
    let completed = 0;
    let skipped = 0;
    let lastUpdated = null;

    for (const filename of receipts) {
      const ann = annByName.get(filename);
      if (!ann) {
        pending += 1;
        continue;
      }
      if (ann.status === 'skipped' || ann.skipped === true) {
        skipped += 1;
      } else if (ann.human_verdict) {
        completed += 1;
      } else {
        pending += 1;
      }
      const ts = ann.updated_at || ann.updatedAt || ann.last_modified || ann.lastModified;
      if (ts && (!lastUpdated || new Date(ts) > new Date(lastUpdated))) {
        lastUpdated = ts;
      }
    }

    res.json({
      pending,
      completed,
      skipped,
      total: receipts.length,
      annotated: annotations.length,
      lastUpdated,
    });
  } catch (e) {
    res.json({ error: e.message });
  }
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
    const stamped = { ...entry, updated_at: new Date().toISOString() };
    if (idx >= 0) {
      all[idx] = stamped;
    } else {
      all.push(stamped);
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

// ─── POST /api/annotations/clear ──────────────────────────────────────────────
// Clear all ground-truth annotations and delete all receipts from the disk.
app.post('/api/annotations/clear', (req, res) => {
  try {
    saveAnnotations([]);
    
    // Clear receipts from CASH_RECIEPTS directory
    const files = readdirSync(RECEIPTS_DIR);
    for (const file of files) {
      if (file !== '.DS_Store') {
        try {
          unlinkSync(join(RECEIPTS_DIR, file));
        } catch (err) {
          console.warn(`Failed to delete ${file}: ${err.message}`);
        }
      }
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: `Failed to clear annotations: ${e.message}` });
  }
});

// ─── POST /api/receipts/restore ──────────────────────────────────────────────
// Restore default receipts by running git restore CASH_RECIEPTS/.
app.post('/api/receipts/restore', (req, res) => {
  try {
    execSync('git restore CASH_RECIEPTS/', { cwd: __dirname });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: `Failed to restore receipts: ${e.message}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${PORT}`));

export { app, upload, loadConfig };
