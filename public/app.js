// ─── Tab routing ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    // Lazy-load annotation data when that tab is first clicked
    if (btn.dataset.tab === 'annotate') initAnnotate();
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

// API key is kept only in memory — never sent to disk
let _apiKey = '';

async function loadSettings() {
  const apikeyEl = document.getElementById('s-apikey');
  const modelEl = document.getElementById('s-model');
  const visionEl = document.getElementById('s-vision-model');

  const saved = localStorage.getItem('psa_settings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.apiKey) { _apiKey = s.apiKey; }
      if (s.model) modelEl.value = s.model;
      if (s.visionModel) visionEl.value = s.visionModel;
    } catch (_) {}
  }

  try {
    const res = await fetch('/api/settings');
    const cfg = await res.json();
    if (cfg.model && !saved) modelEl.value = cfg.model;
    if (cfg.visionModel && !saved) visionEl.value = cfg.visionModel;
  } catch (_) {}
}

function getSettings() {
  return {
    model: document.getElementById('s-model').value,
    visionModel: document.getElementById('s-vision-model').value,
    apiKey: document.getElementById('s-apikey').value || _apiKey,
  };
}

async function saveSettings() {
  const { model, visionModel, apiKey } = getSettings();
  if (apiKey) _apiKey = apiKey;

  localStorage.setItem('psa_settings', JSON.stringify({ model, visionModel }));

  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, visionModel }),
  });
  showResult('settings-result', '<span class="text-green-600">✓ Settings saved</span>');
}

async function testConnection() {
  const { apiKey, model } = getSettings();
  if (!apiKey) return showError('settings-result', 'Enter your API key first.');
  showResult('settings-result', '<span class="text-gray-500">Testing…</span>');
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    });
    const data = await res.json();
    if (data.ok) showResult('settings-result', `<span class="text-green-600">✓ Connected — model replied: "${data.response}"</span>`);
    else showError('settings-result', data.error || 'Connection failed');
  } catch (e) {
    showError('settings-result', e.message);
  }
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function showResult(containerId, html) {
  document.getElementById(containerId).innerHTML = html;
}

function showError(containerId, message) {
  document.getElementById(containerId).innerHTML =
    `<div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">${escHtml(message)}</div>`;
}

function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.textContent = 'Running…';
  } else {
    btn.textContent = btn.dataset.label || btn.textContent;
  }
}

function verdictBadge(verdict) {
  const cls = {
    justified: 'verdict-justified',
    suspicious: 'verdict-suspicious',
    unclear: 'verdict-unclear',
  }[verdict] || 'verdict-error';
  return `<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${cls}">${escHtml(verdict)}</span>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Read file as base64 string (strips data: prefix)
async function getFileData(inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files[0]) throw new Error('Please select a file first.');
  const file = input.files[0];
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64, mimeType: file.type || 'image/jpeg', filename: file.name };
}

// ─── E1: OCR Extraction ───────────────────────────────────────────────────────

async function runE1() {
  const btnId = 'e1-btn';
  setLoading(btnId, true);
  showResult('e1-result', '');
  try {
    const { base64, mimeType } = await getFileData('e1-file');
    const { apiKey, visionModel } = getSettings();
    if (!apiKey) { showError('e1-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, apiKey, model: visionModel }),
    });
    const data = await res.json();
    if (data.error) return showError('e1-result', data.error);
    const f = data.extraction;
    const fields = [
      { label: 'Vendor', key: 'vendor', section: 'vendor' },
      { label: 'Vendor Address', key: 'vendor_address', section: 'vendor' },
      { label: 'Vendor Phone', key: 'vendor_phone', section: 'vendor' },
      { label: 'Vendor Tax ID', key: 'vendor_tax_id', section: 'vendor' },
      { label: 'Receipt #', key: 'receipt_number', section: 'receipt' },
      { label: 'Date', key: 'date', section: 'receipt' },
      { label: 'Time', key: 'time', section: 'receipt' },
      { label: 'Payment Method', key: 'payment_method', section: 'receipt' },
      { label: 'Subtotal', key: 'subtotal', section: 'amounts' },
      { label: 'Tax Amount', key: 'tax_amount', section: 'amounts' },
      { label: 'Tax Rate', key: 'tax_rate', section: 'amounts' },
      { label: 'Total Amount', key: 'amount', section: 'amounts' },
      { label: 'Currency', key: 'currency', section: 'amounts' },
      { label: 'Category', key: 'category', section: 'class' },
    ];

    const renderRow = (k, val) => {
      const d = val != null ? escHtml(typeof val === 'number' ? val.toFixed(2) : String(val)) : '<span class="text-gray-400 italic">null</span>';
      return `<tr class="border-b border-gray-100 last:border-0">
        <td class="py-1.5 pr-4 text-gray-500 w-36 text-xs">${escHtml(k)}</td>
        <td class="py-1.5 font-mono text-xs">${d}</td>
      </tr>`;
    };

    const sections = [
      { id: 'vendor', title: 'Vendor' },
      { id: 'receipt', title: 'Receipt Details' },
      { id: 'amounts', title: 'Amounts & Tax' },
      { id: 'class', title: 'Classification' },
    ];

    let itemsHtml = '';
    if (f.line_items && f.line_items.length) {
      itemsHtml = `
        <h4 class="font-medium text-xs text-gray-500 mt-4 mb-2 uppercase">Line Items</h4>
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-gray-100">
              <td class="py-1 pr-2 w-10">#</td>
              <td class="py-1 pr-2">Description</td>
              <td class="py-1 pr-2 text-right">Qty</td>
              <td class="py-1 pr-2 text-right">Unit</td>
              <td class="py-1 text-right">Total</td>
            </tr>
          </thead>
          <tbody>
            ${f.line_items.map((item, i) => {
              const desc = typeof item === 'string' ? item : item.description || '';
              const qty = typeof item === 'object' ? item.quantity : null;
              const unit = typeof item === 'object' ? item.unit_price : null;
              const total = typeof item === 'object' ? item.total_price : null;
              return `<tr class="border-b border-gray-100 last:border-0">
                <td class="py-1 pr-2 text-gray-400">${i + 1}</td>
                <td class="py-1 pr-2 font-mono">${escHtml(desc)}</td>
                <td class="py-1 pr-2 text-right font-mono">${qty != null ? qty : '—'}</td>
                <td class="py-1 pr-2 text-right font-mono">${unit != null ? Number(unit).toFixed(2) : '—'}</td>
                <td class="py-1 text-right font-mono">${total != null ? Number(total).toFixed(2) : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } else if (f.line_items && f.line_items.length === 0) {
      itemsHtml = '<p class="text-xs text-gray-400 mt-3">No line items extracted</p>';
    }

    showResult('e1-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <h3 class="font-semibold text-sm mb-4">Extracted Receipt Data</h3>
        ${sections.map(s => {
          const rows = fields.filter(f => f.section === s.id).map(f => renderRow(f.label, data.extraction[f.key])).join('');
          return `
            <h4 class="font-medium text-xs text-gray-500 mt-3 mb-1.5 uppercase">${s.title}</h4>
            <table class="w-full text-xs"><tbody>${rows}</tbody></table>
          `;
        }).join('')}
        ${itemsHtml}
      </div>`);
  } catch (e) {
    showError('e1-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E2: No-CoT Verdict ───────────────────────────────────────────────────────

async function runE2() {
  const btnId = 'e2-btn';
  setLoading(btnId, true);
  showResult('e2-result', '');
  try {
    const { base64, mimeType } = await getFileData('e2-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e2-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e2-policy').value,
        phase: parseInt(document.getElementById('e2-phase').value),
        useCot: false,
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e2-result', data.error);
    showResult('e2-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center gap-3 mb-2">${verdictBadge(data.verdict)}</div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
      </div>`);
  } catch (e) {
    showError('e2-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E3: CoT Verdict ─────────────────────────────────────────────────────────

async function runE3() {
  const btnId = 'e3-btn';
  setLoading(btnId, true);
  showResult('e3-result', '');
  try {
    const { base64, mimeType } = await getFileData('e3-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e3-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e3-policy').value,
        phase: parseInt(document.getElementById('e3-phase').value),
        useCot: true,
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e3-result', data.error);
    showResult('e3-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">${verdictBadge(data.verdict)}</div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Show reasoning chain</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(data.reasoning)}</div>
          </details>` : ''}
      </div>`);
  } catch (e) {
    showError('e3-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E4: Phase Sensitivity ────────────────────────────────────────────────────

async function runE4() {
  const btnId = 'e4-btn';
  setLoading(btnId, true);
  showResult('e4-result', '');
  try {
    const { base64, mimeType } = await getFileData('e4-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e4-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/phase-sensitivity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e4-policy').value,
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e4-result', data.error);
    showResult('e4-result', `
      <div class="grid grid-cols-3 gap-4">
        ${data.phases.map(p => `
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">${escHtml(p.phase)}</div>
            ${verdictBadge(p.verdict)}
            <p class="text-sm text-gray-600 mt-2">${escHtml(p.reason)}</p>
            ${p.reasoning ? `
              <details class="text-xs mt-2">
                <summary class="cursor-pointer text-gray-400">Reasoning</summary>
                <div class="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(p.reasoning)}</div>
              </details>` : ''}
          </div>`).join('')}
      </div>`);
  } catch (e) {
    showError('e4-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E5: Ambiguity ────────────────────────────────────────────────────────────
// Uses /api/verdict with useCot: true (5-step prompt variant is selected server-side for E5)

async function runE5() {
  const btnId = 'e5-btn';
  setLoading(btnId, true);
  showResult('e5-result', '');
  try {
    const { base64, mimeType } = await getFileData('e5-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e5-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        policy: document.getElementById('e5-policy').value,
        phase: parseInt(document.getElementById('e5-phase').value),
        useCot: true,
        useE5Prompt: true,  // tells backend to use the 5-step prompt
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e5-result', data.error);

    const isUnclear = data.verdict === 'unclear';
    showResult('e5-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">
          ${verdictBadge(data.verdict)}
          ${isUnclear
            ? '<span class="text-xs bg-yellow-100 border border-yellow-300 text-yellow-800 px-2 py-0.5 rounded">✓ Uncertainty expressed</span>'
            : '<span class="text-xs bg-orange-100 border border-orange-300 text-orange-700 px-2 py-0.5 rounded">⚠ Confident verdict on ambiguous receipt</span>'}
        </div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 font-medium">Show 5-step reasoning</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(data.reasoning)}</div>
          </details>` : ''}
      </div>`);
  } catch (e) {
    showError('e5-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E6: Adversarial ─────────────────────────────────────────────────────────

async function runE6() {
  const btnId = 'e6-btn';
  setLoading(btnId, true);
  showResult('e6-result', '');
  try {
    const { base64, mimeType } = await getFileData('e6-file');
    const { apiKey, visionModel, model } = getSettings();
    if (!apiKey) { showError('e6-result', 'Enter your API key in Settings first.'); return; }

    const res = await fetch('/api/adversarial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, apiKey, model, visionModel,
        phase: parseInt(document.getElementById('e6-phase').value),
      }),
    });
    const data = await res.json();
    if (data.error) return showError('e6-result', data.error);

    showResult('e6-result', `
      <div class="grid grid-cols-3 gap-4">
        ${data.policies.map(p => `
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="text-xs text-gray-500 font-semibold mb-2 uppercase">${escHtml(p.policy)} policy</div>
            ${verdictBadge(p.verdict)}
            ${p.hallucination
              ? '<span class="ml-1 text-xs bg-orange-100 border border-orange-300 text-orange-700 px-1.5 py-0.5 rounded">⚠ hallucination</span>'
              : ''}
            <p class="text-sm text-gray-600 mt-2">${escHtml(p.reason)}</p>
            ${p.policy_clarity
              ? `<p class="text-xs text-gray-400 mt-1">Policy assessed as: <strong>${escHtml(p.policy_clarity)}</strong></p>`
              : ''}
            ${p.reasoning ? `
              <details class="text-xs mt-2">
                <summary class="cursor-pointer text-gray-400">Reasoning</summary>
                <div class="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(p.reasoning)}</div>
              </details>` : ''}
          </div>`).join('')}
      </div>`);
  } catch (e) {
    showError('e6-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── Annotation ───────────────────────────────────────────────────────────────

let _annotations = [];
let _receipts = [];
let _annotateInitialized = false;

async function initAnnotate() {
  if (_annotateInitialized) return;
  _annotateInitialized = true;
  try {
    [_receipts, _annotations] = await Promise.all([
      fetch('/api/receipts').then(r => r.json()),
      fetch('/api/annotations').then(r => r.json()),
    ]);
    const sel = document.getElementById('ann-file');
    sel.innerHTML = _receipts.map(f => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join('');
    loadAnnotation();
  } catch (e) {
    showError('ann-result', `Failed to load receipts: ${e.message}`);
  }
}

function loadAnnotation() {
  const filename = document.getElementById('ann-file').value;
  const ann = _annotations.find(a => a.filename === filename) || {};
  document.getElementById('ann-vendor').value = ann.vendor || '';
  document.getElementById('ann-date').value = ann.date || '';
  document.getElementById('ann-amount').value = ann.amount || '';
  document.getElementById('ann-currency').value = ann.currency || '';
  document.getElementById('ann-category').value = ann.category || 'other';
  document.getElementById('ann-verdict').value = ann.human_verdict || 'justified';
  document.getElementById('ann-reason').value = ann.human_verdict_reason || '';
  document.getElementById('ann-ambiguous').checked = ann.is_ambiguous || false;
  document.getElementById('ann-notes').value = ann.notes || '';
  showResult('ann-result', '');
}

async function saveAnnotation() {
  const filename = document.getElementById('ann-file').value;
  const entry = {
    filename,
    vendor: document.getElementById('ann-vendor').value || null,
    date: document.getElementById('ann-date').value || null,
    amount: parseFloat(document.getElementById('ann-amount').value) || null,
    currency: document.getElementById('ann-currency').value || null,
    category: document.getElementById('ann-category').value,
    human_verdict: document.getElementById('ann-verdict').value,
    human_verdict_reason: document.getElementById('ann-reason').value || '',
    is_ambiguous: document.getElementById('ann-ambiguous').checked,
    notes: document.getElementById('ann-notes').value || '',
  };
  try {
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');
    _annotations = _annotations.filter(a => a.filename !== filename);
    _annotations.push(entry);
    showResult('ann-result', `<span class="text-green-600">✓ Saved ${escHtml(filename)}</span>`);
  } catch (e) {
    showError('ann-result', e.message);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadSettings();
