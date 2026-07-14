// ─── Tab routing ────────────────────────────────────────────────────────────

// Track current tab for state persistence
let _currentTab = 'e1'

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab

    // Save current tab state before switching away
    saveCurrentTabState()

    // Switch tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'))
    btn.classList.add('active')
    document.getElementById(`tab-${tabName}`).classList.remove('hidden')
    _currentTab = tabName

    // Lazy-load: annotate
    if (tabName === 'annotate') initAnnotate()
    // Lazy-load: policy editor
    if (tabName === 'policy-editor') setTimeout(loadPolicyEditor, 50)

    // Restore target tab state
    setTimeout(() => restoreTabState(tabName), 10)
  })
})

// ─── Per-tab state persistence ────────────────────────────────────────────────

function saveCurrentTabState() {
  const tab = _currentTab
  if (!tab || tab.startsWith('settings') || tab === 'annotate' || tab === 'policy-editor') return

  const state = { timestamp: new Date().toISOString() }

  // Save form selections
  const policyEl = document.getElementById(`${tab}-policy`)
  const phaseEl = document.getElementById(`${tab}-phase`)
  if (policyEl) state.policy = policyEl.value
  if (phaseEl) state.phase = phaseEl.value

  // Save last result HTML
  const resultEl = document.getElementById(`${tab}-result`)
  if (resultEl && resultEl.innerHTML.trim()) {
    state.lastResult = resultEl.innerHTML
  }

  // Save config snapshot for drift detection
  const settings = getSettings()
  state.configSnapshot = { model: settings.model, visionModel: settings.visionModel, policy: state.policy }

  window.APP.state.setTabState(tab, state)
}

function restoreTabState(tabName) {
  if (!tabName || tabName.startsWith('settings') || tabName === 'annotate' || tabName === 'policy-editor') return

  const state = window.APP.state.getTabState(tabName)
  if (!state) return

  // Restore form selections
  const policyEl = document.getElementById(`${tabName}-policy`)
  const phaseEl = document.getElementById(`${tabName}-phase`)
  if (policyEl && state.policy) policyEl.value = state.policy
  if (phaseEl && state.phase) phaseEl.value = state.phase

  // Restore last result
  if (state.lastResult) {
    const resultEl = document.getElementById(`${tabName}-result`)
    if (resultEl) {
      resultEl.innerHTML = state.lastResult
    }
  }

  // Check for config drift
  if (state.configSnapshot) {
    const settings = getSettings()
    const drifted = (
      state.configSnapshot.model !== settings.model ||
      state.configSnapshot.visionModel !== settings.visionModel ||
      (state.configSnapshot.policy && state.configSnapshot.policy !== settings.policy)
    )
    if (drifted) {
      const resultEl = document.getElementById(`${tabName}-result`)
      if (resultEl && !resultEl.querySelector('.config-drift-badge')) {
        const drift = document.createElement('div')
        drift.className = 'config-drift-badge mt-2'
        drift.textContent = '⚡ Settings changed since last run — results may be stale'
        resultEl.prepend(drift)
      }
    }
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

// API key persisted in localStorage for convenience (OpenRouter is a research API, not a production secret)
let _apiKey = '';

async function loadSettings() {
  const apikeyEl = document.getElementById('s-apikey');
  const modelEl = document.getElementById('s-model');
  const visionEl = document.getElementById('s-vision-model');

  const saved = localStorage.getItem('psa_settings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.apiKey) { _apiKey = s.apiKey; apikeyEl.value = s.apiKey; }
      if (s.model) modelEl.value = s.model;
      if (s.visionModel) visionEl.value = s.visionModel;
    } catch (_) {}
  }

  try {
    const res = await fetch('/api/settings');
    const cfg = await res.json();
    if (cfg.model && !saved) modelEl.value = cfg.model;
    if (cfg.visionModel && !saved) visionEl.value = cfg.visionModel;
    if (cfg.apiKey && !_apiKey) { _apiKey = cfg.apiKey; apikeyEl.value = cfg.apiKey; }
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

  localStorage.setItem('psa_settings', JSON.stringify({ apiKey, model, visionModel }));

  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, visionModel }),
  });
  showResult('settings-result', '<span class="text-green-600">✓ Settings saved</span>');
}

async function testConnection() {
  const { apiKey, model } = getSettings();
  showResult('settings-result', '<span class="text-gray-500">Testing…</span>');
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey || '', model }),
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

function buildMetaHtml(opts) {
  const parts = []
  if (opts.cached) parts.unshift(`<span class="cache-badge text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">📦 Cached from ${escHtml(opts.cached)}</span>`)
  if (opts.model) parts.push(`<span>Model: ${escHtml(opts.model)}</span>`)
  if (opts.visionModel) parts.push(`<span>Vision: ${escHtml(opts.visionModel)}</span>`)
  if (opts.policy) parts.push(`<span>Policy: ${escHtml(opts.policy)}</span>`)
  if (opts.phase !== undefined && opts.phase !== null && opts.phase !== '') {
    const phaseNum = (parseInt(opts.phase) || 0) + 1
    parts.push(`<span>Phase: ${phaseNum}</span>`)
  }
  if (opts.duration) parts.push(`<span>Time: ${escHtml(opts.duration)}s</span>`)
  if (opts.timestamp) parts.push(`<span class="meta-text">${escHtml(opts.timestamp)}</span>`)
  return parts.length
    ? `<div class="meta-row mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">${parts.join('')}</div>`
    : ''
}

function updateTabRunCounts() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab
    if (!tab || ['settings', 'annotate', 'policy-editor'].includes(tab)) return
    const count = ResultsStore.getResults(tab).length
    // Strip any existing "(N runs)" suffix to avoid stacking
    const baseLabel = btn.textContent.replace(/\s*\(\d+ runs?\)/g, '').trim()
    btn.textContent = count > 0 ? `${baseLabel} (${count} runs)` : baseLabel
  })
}

// Read file as base64 string (strips data: prefix)
async function getFileData(inputId) {
  const input = document.getElementById(inputId)
  // Check shared receipt first
  const shared = window.APP.state.getReceipt()
  if ((!input || !input.files[0]) && shared) {
    return shared
  }
  if (!input || !input.files[0]) throw new Error('Please select a file first.')
  const file = input.files[0]
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const fileData = { base64, mimeType: file.type || 'image/jpeg', filename: file.name }
  // Store in shared state
  window.APP.state.setReceipt(fileData)
  updateReceiptBar(fileData)
  return fileData
}

function updateReceiptBar(fileData) {
  const bar = document.getElementById('receipt-bar')
  const name = document.getElementById('receipt-filename')
  if (fileData && fileData.filename) {
    name.textContent = fileData.filename
    bar.classList.remove('hidden')
  } else {
    bar.classList.add('hidden')
    name.textContent = ''
  }
}

// ─── E1: OCR Extraction ───────────────────────────────────────────────────────

function renderExtractionResult(f) {
  if (!f) return ''
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
  ]
  const sections = [
    { id: 'vendor', title: 'Vendor' },
    { id: 'receipt', title: 'Receipt Details' },
    { id: 'amounts', title: 'Amounts & Tax' },
    { id: 'class', title: 'Classification' },
  ]
  const renderRow = (label, val) => {
    const d = val != null ? escHtml(typeof val === 'number' ? val.toFixed(2) : String(val)) : '<span class="text-gray-400 italic">null</span>'
    return `<tr class="border-b border-gray-100 last:border-0"><td class="py-1.5 pr-4 text-gray-500 w-36 text-xs">${escHtml(label)}</td><td class="py-1.5 font-mono text-xs">${d}</td></tr>`
  }
  let itemsHtml = ''
  if (f.line_items && f.line_items.length) {
    itemsHtml = `<h4 class="font-medium text-xs text-gray-500 mt-4 mb-2 uppercase">Line Items</h4><table class="w-full text-xs"><thead><tr class="text-gray-400 border-b border-gray-100"><td class="py-1 pr-2">#</td><td class="py-1 pr-2">Description</td><td class="py-1 pr-2 text-right">Qty</td><td class="py-1 pr-2 text-right">Unit</td><td class="py-1 text-right">Total</td></tr></thead><tbody>${f.line_items.map((item, i) => { const desc = typeof item === 'string' ? item : item.description || ''; const qty = typeof item === 'object' ? item.quantity : null; const unit = typeof item === 'object' ? item.unit_price : null; const total = typeof item === 'object' ? item.total_price : null; return `<tr class="border-b border-gray-100 last:border-0"><td class="py-1 pr-2 text-gray-400">${i+1}</td><td class="py-1 pr-2 font-mono">${escHtml(desc)}</td><td class="py-1 pr-2 text-right font-mono">${qty != null ? qty : '&mdash;'}</td><td class="py-1 pr-2 text-right font-mono">${unit != null ? Number(unit).toFixed(2) : '&mdash;'}</td><td class="py-1 text-right font-mono">${total != null ? Number(total).toFixed(2) : '&mdash;'}</td></tr>` }).join('')}</tbody></table>`
  }
  return `<div class="bg-white rounded-lg border border-gray-200 p-5"><h3 class="font-semibold text-sm mb-4">Extracted Receipt Data</h3>${sections.map(s => { const rows = fields.filter(f2 => f2.section === s.id).map(f2 => renderRow(f2.label, f[f2.key])).join(''); return `<h4 class="font-medium text-xs text-gray-500 mt-3 mb-1.5 uppercase">${s.title}</h4><table class="w-full text-xs"><tbody>${rows}</tbody></table>` }).join('')}${itemsHtml}</div>`
}

async function runE1() {
  const btnId = 'e1-btn'
  setLoading(btnId, true)
  showResult('e1-result', '')
  const startTime = performance.now()
  try {
    const { base64, mimeType } = await getFileData('e1-file')
    const { apiKey, visionModel } = getSettings()

    // Check extraction cache
    const hash = window.APP.state.computeHash(base64)
    const cached = window.APP.state.getExtraction(hash)
    if (cached && cached.visionModel === visionModel) {
      const cachedTime = new Date(cached.timestamp).toLocaleTimeString()
      const metaHtml = buildMetaHtml({ visionModel, cached: cachedTime, timestamp: cached.timestamp })
      showResult('e1-result', renderExtractionResult(cached) + metaHtml)
      ResultsStore.addResult('e1', {
        config: { visionModel, filename: window.APP.state.getReceipt()?.filename, cached: true },
        result: cached,
        hash,
      })
      saveCurrentTabState()
      updateTabRunCounts()
      return
    }

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, apiKey, model: visionModel }),
    })
    const data = await res.json()
    if (data.error) return showError('e1-result', data.error)

    // Cache the extraction
    const now = new Date().toISOString()
    window.APP.state.setExtraction(hash, { ...data.extraction, visionModel, timestamp: now })
    const duration = ((performance.now() - startTime) / 1000).toFixed(1)
    const metaHtml = buildMetaHtml({ visionModel, duration, timestamp: now })
    showResult('e1-result', renderExtractionResult(data.extraction) + metaHtml)
    ResultsStore.addResult('e1', {
      config: { visionModel, filename: window.APP.state.getReceipt()?.filename },
      result: data.extraction,
      hash: window.APP.state.computeHash(base64),
    })
    saveCurrentTabState()
    updateTabRunCounts()
  } catch (e) {
    showError('e1-result', e.message)
  } finally {
    setLoading(btnId, false)
  }
}

// ─── E2: No-CoT Verdict ───────────────────────────────────────────────────────

async function runE2() {
  const btnId = 'e2-btn';
  setLoading(btnId, true);
  showResult('e2-result', '');
  const startTime = performance.now();
  try {
    const { base64, mimeType } = await getFileData('e2-file');
    const { apiKey, visionModel, model } = getSettings();
    

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
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const policy = document.getElementById('e2-policy')?.value;
    const phase = document.getElementById('e2-phase')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, policy, phase, duration });
    showResult('e2-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center gap-3 mb-2">${verdictBadge(data.verdict)}</div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
        ${metaHtml}
      </div>`);
    ResultsStore.addResult('e2', {
      config: { model, visionModel, policy, phase: parseInt(phase) },
      result: { verdict: data.verdict, reason: data.reason, reasoning: data.reasoning },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    saveCurrentTabState();
    updateTabRunCounts();
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
  const startTime = performance.now();
  try {
    const { base64, mimeType } = await getFileData('e3-file');
    const { apiKey, visionModel, model } = getSettings();
    

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
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const policy = document.getElementById('e3-policy')?.value;
    const phase = document.getElementById('e3-phase')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, policy, phase, duration });
    showResult('e3-result', `
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="flex items-center gap-3">${verdictBadge(data.verdict)}</div>
        <p class="text-sm text-gray-700">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Show reasoning chain</summary>
            <div class="mt-2 p-3 bg-gray-50 rounded text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">${escHtml(data.reasoning)}</div>
          </details>` : ''}
        ${metaHtml}
      </div>`);
    ResultsStore.addResult('e3', {
      config: { model, visionModel, policy, phase: parseInt(phase) },
      result: { verdict: data.verdict, reason: data.reason, reasoning: data.reasoning },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    saveCurrentTabState();
    updateTabRunCounts();
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
  const startTime = performance.now();
  try {
    const { base64, mimeType } = await getFileData('e4-file');
    const { apiKey, visionModel, model } = getSettings();
    

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
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const policy = document.getElementById('e4-policy')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, policy, duration });
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
      </div>
      ${metaHtml}`);
    ResultsStore.addResult('e4', {
      config: { model, visionModel, policy },
      result: { phases: data.phases },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    saveCurrentTabState();
    updateTabRunCounts();
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
  const startTime = performance.now();
  try {
    const { base64, mimeType } = await getFileData('e5-file');
    const { apiKey, visionModel, model } = getSettings();
    

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
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const policy = document.getElementById('e5-policy')?.value;
    const phase = document.getElementById('e5-phase')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, policy, phase, duration });
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
        ${metaHtml}
      </div>`);
    ResultsStore.addResult('e5', {
      config: { model, visionModel, policy, phase: parseInt(phase) },
      result: { verdict: data.verdict, reason: data.reason, reasoning: data.reasoning },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    saveCurrentTabState();
    updateTabRunCounts();
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
  const startTime = performance.now();
  try {
    const { base64, mimeType } = await getFileData('e6-file');
    const { apiKey, visionModel, model } = getSettings();
    

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

    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const phase = document.getElementById('e6-phase')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, phase, duration });
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
      </div>
      ${metaHtml}`);
    ResultsStore.addResult('e6', {
      config: { model, visionModel, phase: parseInt(phase) },
      result: { policies: data.policies },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    saveCurrentTabState();
    updateTabRunCounts();
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

// ─── Results Store (sessionStorage-backed) ─────────────────────────────────

const ResultsStore = {
  _getAll() {
    try {
      const raw = sessionStorage.getItem('psa_results')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  },

  _saveAll(results) {
    try {
      sessionStorage.setItem('psa_results', JSON.stringify(results))
    } catch (e) {
      console.warn('sessionStorage quota exceeded for results', e.message)
    }
  },

  addResult(experimentId, data) {
    const results = this._getAll()
    const entry = {
      id: `${experimentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      experiment: experimentId,
      timestamp: new Date().toISOString(),
      ...data,
    }
    results.push(entry)
    this._saveAll(results)
    return entry
  },

  getResults(experimentId) {
    return this._getAll().filter(r => r.experiment === experimentId)
  },

  getAllResults() {
    return this._getAll()
  },

  clearResults(experimentId) {
    if (experimentId) {
      this._saveAll(this._getAll().filter(r => r.experiment !== experimentId))
    } else {
      this._saveAll([])
    }
  },

  clearAllResults() {
    this._saveAll([])
  },
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportResultAsCSV(experimentId) {
  const results = ResultsStore.getResults(experimentId)
  if (!results.length) return

  // Build CSV based on experiment type
  let headers, rows
  if (['e2', 'e3', 'e5'].includes(experimentId)) {
    headers = ['timestamp', 'model', 'policy', 'phase', 'verdict', 'reason']
    rows = results.map(r => [
      r.timestamp, r.config?.model || '', r.config?.policy || '', r.config?.phase ?? '',
      r.result?.verdict || '', r.result?.reason || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  } else if (experimentId === 'e1') {
    headers = ['timestamp', 'model', 'vendor', 'date', 'amount', 'currency', 'category']
    rows = results.map(r => [
      r.timestamp, r.config?.visionModel || '',
      r.result?.vendor || '', r.result?.date || '', r.result?.amount ?? '',
      r.result?.currency || '', r.result?.category || ''
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  } else {
    return // E4/E6 — JSON only
  }

  const csv = [headers.join(','), ...rows].join('\n')
  downloadFile(csv, `psa-${experimentId}-${Date.now()}.csv`, 'text/csv;charset=utf-8')
}

function exportResultAsJSON(experimentId) {
  const results = experimentId ? ResultsStore.getResults(experimentId) : ResultsStore.getAllResults()
  if (!results.length) return
  const filename = experimentId
    ? `psa-${experimentId}-${Date.now()}.json`
    : `psa-all-results-${Date.now()}.json`
  downloadFile(JSON.stringify(results, null, 2), filename, 'application/json')
}

// ─── Modal System ──────────────────────────────────────────────────────────

let _modalActive = false

function showModal(title, bodyHTML) {
  if (_modalActive) closeModal()
  _modalActive = true

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'psa-modal-overlay'

  const content = document.createElement('div')
  content.className = 'modal-content'

  content.innerHTML = `
    <button class="modal-close" id="psa-modal-close" aria-label="Close">&times;</button>
    <div class="modal-title">${escHtml(title)}</div>
    <div class="modal-body">${bodyHTML}</div>
  `

  overlay.appendChild(content)
  document.body.appendChild(overlay)
  document.body.classList.add('modal-open')

  // Close handlers
  const closeBtn = document.getElementById('psa-modal-close')
  closeBtn.addEventListener('click', closeModal)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal()
  })

  document.addEventListener('keydown', _modalKeyHandler)
}

function closeModal() {
  const overlay = document.getElementById('psa-modal-overlay')
  if (overlay) overlay.remove()
  document.body.classList.remove('modal-open')
  _modalActive = false
  document.removeEventListener('keydown', _modalKeyHandler)
}

function _modalKeyHandler(e) {
  if (e.key === 'Escape') closeModal()
}

function renderMetaHTML(meta) {
  if (!meta) return '<p class="text-sm text-gray-500">No description available.</p>'
  return `
    ${meta.hypothesis ? `<div class="modal-section"><div class="modal-section-label">Hypothesis</div><div class="modal-section-text">${escHtml(meta.hypothesis)}</div></div>` : ''}
    ${meta.methodology ? `<div class="modal-section"><div class="modal-section-label">Methodology</div><div class="modal-section-text">${escHtml(meta.methodology)}</div></div>` : ''}
    ${meta.expectedOutput ? `<div class="modal-section"><div class="modal-section-label">Expected Output</div><div class="modal-section-text"><code class="text-xs bg-gray-100 px-1 rounded">${escHtml(meta.expectedOutput)}</code></div></div>` : ''}
    ${meta.layer ? `<div class="modal-section"><div class="modal-section-label">Pipeline Layer</div><div class="modal-section-text">${escHtml(meta.layer)}</div></div>` : ''}
    ${meta.prompt ? `<div class="modal-section"><div class="modal-section-label">Prompt Template</div><div class="modal-section-text"><code class="text-xs bg-gray-100 px-1 rounded">${escHtml(meta.prompt)}</code></div></div>` : ''}
    ${meta.experimentsUsing ? `<div class="modal-section"><div class="modal-section-label">Dependencies</div><div class="modal-section-text">${escHtml(meta.experimentsUsing)}</div></div>` : ''}
  `
}

function showExperimentInfo(tabName) {
  const meta = EXPERIMENT_META[tabName]
  if (!meta) return
  showModal(meta.title, renderMetaHTML(meta))
}

// ─── Experiment Metadata ───────────────────────────────────────────────────

const EXPERIMENT_META = {
  e1: {
    title: 'E1: OCR Extraction Baseline',
    hypothesis: 'A multimodal LLM can reliably extract structured fields (vendor, date, amount, currency, category, line items) from real-world receipt photos of varying quality, language, and format. High precision is expected on vendor, amount, currency; lower on category (requires inference).',
    methodology: 'All 26 receipts are processed via /api/extract using google/gemini-2.5-flash. The extraction prompt instructs null-for-unreadable fields. Extracted fields are compared against manual ground-truth annotations. Field-level precision computed for vendor, date, amount, currency, category.',
    expectedOutput: 'Table of extracted fields: vendor (string), date (YYYY-MM-DD), amount (float), currency (ISO 4217), category (enum), line_items (array). Unreadable fields show as null.',
    layer: 'Layer 1 — OCR & Extraction',
    prompt: 'PROMPTS.extraction — instructs model to return null for unreadable fields. Category taxonomy: equipment, software, travel, meals, services, supplies, other.',
    experimentsUsing: 'All experiments depend on E1\'s extraction quality. E2-E6 consume Layer 1 output as the foundation for policy reasoning.',
  },
  e2: {
    title: 'E2: Zero-shot Verdict (No Chain-of-Thought)',
    hypothesis: 'Without chain-of-thought instruction, the model produces low-quality, poorly justified verdicts. This establishes the lower-bound baseline for the reasoning experiments.',
    methodology: 'Single-turn prompt with policy text + extracted fields. Model answers directly: verdict (justified/suspicious/unclear) + one-sentence reason. No step-by-step instruction. Compared against human judges (Cohen\'s kappa).',
    expectedOutput: 'Verdict badge (justified/suspicious/unclear) + one-sentence reason.',
    layer: 'Layer 3 — Reasoning & Verdict',
    prompt: 'PROMPTS.verdictNoCot — minimal prompt: policy text, expense fields, direct classification.',
    experimentsUsing: 'E3 adds CoT to this same pipeline. E2 results serve as the no-reasoning control.',
  },
  e3: {
    title: 'E3: Chain-of-Thought Reasoning',
    hypothesis: 'Adding "think step by step" CoT instruction improves verdict quality and produces auditable reasoning chains with explicit policy quotation.',
    methodology: 'Same data as E2. Prompt extended with 4-step CoT instruction: (1) identify expense type, (2) quote applicable policy clause, (3) assess amount reasonableness, (4) flag ambiguities.',
    expectedOutput: 'Verdict badge + reason + expandable "Show reasoning" section with step-by-step analysis.',
    layer: 'Layer 3 — Reasoning & Verdict',
    prompt: 'PROMPTS.verdictCot — 4-step chain-of-thought requiring explicit policy quotation in step 2.',
    experimentsUsing: 'E3 is the primary CoT baseline. E4/E5/E6 build on this approach.',
  },
  e4: {
    title: 'E4: Phase-Sensitive Reasoning',
    hypothesis: 'The same expense receives a DIFFERENT verdict when the stated project phase changes, demonstrating genuine semantic grounding rather than surface matching.',
    methodology: 'Receipt evaluated across all 3 project phases (Infrastructure Setup, Experimentation, Evaluation & Documentation) in parallel using CoT prompt. Records whether verdict changes appropriately per phase.',
    expectedOutput: '3-column grid showing verdict per phase side-by-side. Correct behavior: same receipt gets different verdicts in different phases.',
    layer: 'Layer 2 + 3 — Policy Grounding + Reasoning',
    prompt: 'PROMPTS.verdictCot injected with each of 3 phase texts. All 3 LLM calls happen in parallel via Promise.all.',
    experimentsUsing: 'E4 depends on E1 extraction. Uses only Clear policy variant for controlled comparison.',
  },
  e5: {
    title: 'E5: Ambiguity & Uncertainty Handling',
    hypothesis: 'With a 5-step CoT including an information-sufficiency check, the model will express uncertainty ("unclear") on genuinely ambiguous receipts where context is missing from the receipt alone.',
    methodology: 'Same pipeline as E3 but with extended 5-step prompt. Step 5 asks: "Does the receipt alone provide enough information to determine justification?" If not → return "unclear" and state what additional info is needed.',
    expectedOutput: 'Verdict badge + uncertainty indicator. If "unclear": green badge "✓ Uncertainty expressed". If confident verdict on ambiguous receipt: orange "⚠ Confident verdict on ambiguous receipt".',
    layer: 'Layer 3 — Reasoning & Verdict',
    prompt: 'PROMPTS.verdictCotE5 — 5-step CoT with explicit information sufficiency check as final step.',
    experimentsUsing: 'E5 reuses the /api/verdict endpoint with useE5Prompt: true flag. Compare against E3 to measure uncertainty expression improvement.',
  },
  e6: {
    title: 'E6: Adversarial Policy Stress Test',
    hypothesis: 'Models distinguish between clear, vague, and contradictory policies and adjust verdict confidence accordingly. Hallucination occurs when model claims a vague/contradictory policy is "clear".',
    methodology: 'Same receipt evaluated under all 3 policy variants (clear/vague/contradictory) in parallel. Each variant uses the adversarial prompt that includes policy_clarity assessment. Server detects hallucination: policy !== clear && model says "clear".',
    expectedOutput: '3-column grid showing verdict per policy. Policy clarity badge per column. Orange "⚠ hallucination" badge when model misassesses policy clarity.',
    layer: 'Layer 2 + 3 — Policy Grounding + Reasoning',
    prompt: 'PROMPTS.adversarial — asks model to assess policy quality (clear/vague/contradictory) AND produce verdict. Step 3: "If the policy is contradictory, return unclear — do NOT resolve contradictions."',
    experimentsUsing: 'E6 depends on all 3 policy variants. Editing the contradictory policy in Policy Editor will affect E6 results.',
  },
}

// Expose for onclick handlers
window.APP = window.APP || {}
window.APP.showExperimentInfo = showExperimentInfo
window.APP.showModal = showModal
window.APP.closeModal = closeModal

// ─── Policy Editor ─────────────────────────────────────────────────────────

async function loadPolicyEditor() {
  const sel = document.getElementById('pe-policy')
  const name = sel.value
  showResult('pe-result', '')
  try {
    const res = await fetch(`/api/policies/${name}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const policy = await res.json()
    document.getElementById('pe-project-name').value = policy.project_name || ''
    document.getElementById('pe-description').value = policy.description || ''

    const warning = document.getElementById('pe-e6-warning')
    if (name === 'contradictory') {
      warning.classList.remove('hidden')
    } else {
      warning.classList.add('hidden')
    }

    const container = document.getElementById('pe-phases')
    container.innerHTML = policy.phases.map((phase, i) => `
      <div class="border border-gray-200 rounded-lg p-4">
        <h4 class="text-sm font-semibold text-gray-700 mb-2">Phase ${i + 1}</h4>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-0.5">Phase Name</label>
            <input type="text" class="pe-phase-name block w-full text-sm border border-gray-300 rounded px-3 py-1.5" value="${escHtml(phase.name)}">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-0.5">Description</label>
            <textarea rows="1" class="pe-phase-desc block w-full text-sm border border-gray-300 rounded px-3 py-1.5">${escHtml(phase.description)}</textarea>
          </div>
          ${['allowed', 'restricted', 'forbidden'].map(listName => `
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-0.5 capitalize">${listName}</label>
              <div class="pe-tag-container flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded bg-white min-h-[2rem] text-sm" data-list="${listName}" data-phase="${i}">
                ${(phase[listName] || []).map(item => `<span class="pe-tag inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs"><span>${escHtml(item)}</span><button class="pe-tag-remove text-gray-400 hover:text-red-500 font-bold leading-none" type="button">&times;</button></span>`).join('')}
                <input type="text" class="pe-tag-input flex-1 min-w-[80px] border-0 outline-none text-xs bg-transparent" placeholder="Add item...">
              </div>
            </div>`).join('')}
        </div>
      </div>
    `).join('')
  } catch (e) {
    showError('pe-result', `Failed to load policy: ${e.message}`)
  }
}

async function savePolicy() {
  const name = document.getElementById('pe-policy').value
  const phases = []
  document.querySelectorAll('#pe-phases > div').forEach((phaseEl) => {
    const nameInput = phaseEl.querySelector('.pe-phase-name')
    const descInput = phaseEl.querySelector('.pe-phase-desc')
    const lists = {}
    phaseEl.querySelectorAll('.pe-tag-container').forEach(container => {
      const listName = container.dataset.list
      const tags = container.querySelectorAll('.pe-tag span:first-child')
      lists[listName] = Array.from(tags).map(t => t.textContent)
    })
    phases.push({
      name: nameInput ? nameInput.value : '',
      description: descInput ? descInput.value : '',
      allowed: lists.allowed || [],
      restricted: lists.restricted || [],
      forbidden: lists.forbidden || [],
    })
  })

  const data = {
    policy_name: name,
    project_name: document.getElementById('pe-project-name').value,
    description: document.getElementById('pe-description').value,
    phases,
  }

  showResult('pe-result', '<span class="text-gray-500">Saving…</span>')
  try {
    const res = await fetch(`/api/policies/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (res.ok) {
      showResult('pe-result', '<span class="text-green-600">✓ Policy saved</span>')
    } else {
      showError('pe-result', result.error + (result.details ? ': ' + result.details.join('; ') : ''))
    }
  } catch (e) {
    showError('pe-result', `Save failed: ${e.message}`)
  }
}

function clearPolicyForm() {
  if (!confirm('Clear all policy fields? This empties the form but does NOT save. You must click Save to persist changes.')) return
  document.getElementById('pe-project-name').value = ''
  document.getElementById('pe-description').value = ''
  const phases = document.querySelectorAll('#pe-phases > div')
  phases.forEach(phaseEl => {
    const nameInput = phaseEl.querySelector('.pe-phase-name')
    const descInput = phaseEl.querySelector('.pe-phase-desc')
    if (nameInput) nameInput.value = ''
    if (descInput) descInput.value = ''
    phaseEl.querySelectorAll('.pe-tag').forEach(tag => tag.remove())
  })
  showResult('pe-result', '<span class="text-gray-600">✓ Form cleared. Click Save to persist your changes.</span>')
}

async function resetPolicy() {
  const name = document.getElementById('pe-policy').value
  showResult('pe-result', '<span class="text-gray-500">Resetting…</span>')
  try {
    const res = await fetch(`/api/policies/${name}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadPolicyEditor()
    showResult('pe-result', '<span class="text-gray-600">✓ Reset to current saved version</span>')
  } catch (e) {
    showError('pe-result', `Reset failed: ${e.message}`)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'policy-editor') {
        setTimeout(loadPolicyEditor, 50)
      }
    })
  })
})

document.addEventListener('keydown', (e) => {
  if (e.target.classList && e.target.classList.contains('pe-tag-input')) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const input = e.target
      const value = input.value.replace(/,/g, '').trim()
      if (value) {
        const container = input.closest('.pe-tag-container')
        const tag = document.createElement('span')
        tag.className = 'pe-tag inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs'
        tag.innerHTML = `<span>${escHtml(value)}</span><button class="pe-tag-remove text-gray-400 hover:text-red-500 font-bold leading-none" type="button">&times;</button>`
        container.insertBefore(tag, input)
      }
      input.value = ''
    }
  }
})

document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('pe-tag-remove')) {
    e.target.closest('.pe-tag').remove()
  }
})

// ─── Shared State Manager (sessionStorage) ──────────────────────────────────

/**
 * Simple hash for receipt deduplication (first 20 chars of base64).
 * @param {string} str - base64 string to hash
 * @returns {string} first 20 chars (enough to identify unique receipts)
 */
const psaHash = (str) => {
  if (!str) return ''
  // Use first 20 chars of the base64 as a content-based identifier
  // Not crypto-secure but enough to detect same receipt
  let hash = 0
  for (let i = 0; i < Math.min(str.length, 100); i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 8)
}

const StateManager = {
  // ─── Receipt state ───
  setReceipt(fileData) {
    const entry = {
      ...fileData,
      hash: psaHash(fileData.base64),
      timestamp: new Date().toISOString(),
    }
    try {
      sessionStorage.setItem('psa_receipt', JSON.stringify(entry))
    } catch (e) {
      console.warn('sessionStorage quota exceeded for receipt', e.message)
    }
    return entry
  },

  getReceipt() {
    try {
      const raw = sessionStorage.getItem('psa_receipt')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },

  clearReceipt() {
    sessionStorage.removeItem('psa_receipt')
    // Also clear extraction caches (they reference receipt hash)
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith('psa_extraction_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k))
  },

  // ─── Per-tab state ───
  setTabState(tabName, state) {
    try {
      sessionStorage.setItem(`psa_tab_${tabName}`, JSON.stringify(state))
    } catch (e) {
      console.warn('sessionStorage quota exceeded for tab state', e.message)
    }
  },

  getTabState(tabName) {
    try {
      const raw = sessionStorage.getItem(`psa_tab_${tabName}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },

  clearTabState(tabName) {
    sessionStorage.removeItem(`psa_tab_${tabName}`)
  },

  // ─── Extraction cache ───
  computeHash(base64) {
    return psaHash(base64)
  },

  setExtraction(hash, data) {
    try {
      sessionStorage.setItem(`psa_extraction_${hash}`, JSON.stringify(data))
    } catch (e) {
      console.warn('sessionStorage quota exceeded for extraction cache', e.message)
    }
  },

  getExtraction(hash) {
    try {
      const raw = sessionStorage.getItem(`psa_extraction_${hash}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },

  clearExtraction(hash) {
    if (hash) {
      sessionStorage.removeItem(`psa_extraction_${hash}`)
    }
  },
}

// Expose for console access and onclick handlers
window.APP = window.APP || {}
window.APP.state = StateManager

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('receipt-change-btn')?.addEventListener('click', () => {
  const visibleInput = document.querySelector('.tab-panel:not(.hidden) input[type="file"]')
  if (visibleInput) visibleInput.click()
})

document.getElementById('receipt-clear-btn')?.addEventListener('click', () => {
  window.APP.state.clearReceipt()
  updateReceiptBar(null)
  document.querySelectorAll('input[type="file"]').forEach(el => el.value = '')
})

loadSettings()
updateTabRunCounts()

// Restore shared receipt on page load
const savedReceipt = window.APP.state.getReceipt()
if (savedReceipt) {
  updateReceiptBar(savedReceipt)
}
