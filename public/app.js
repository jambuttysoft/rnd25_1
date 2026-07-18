// ─── Multi-page routing ─────────────────────────────────────────────────────
//
// Each tab is now its own HTML file (e1.html, e2.html, gt.html, etc.).
// The active tab is determined by the current URL. Tabs in the nav are
// plain <a href> links — no JS routing. Auto-initialise per-page.

const _PAGE_KEYS = {
  'index.html': null,
  'e1.html': 'e1',
  'e2.html': 'e2',
  'e3.html': 'e3',
  'e4.html': 'e4',
  'e5.html': 'e5',
  'e6.html': 'e6',
  'gt.html': 'annotate',
  'pe.html': 'policy-editor',
  'st.html': 'settings',
}

let _currentTab = (() => {
  const path = window.location.pathname.replace(/^\//, '')
  return _PAGE_KEYS[path] || 'e1'
})()

// ─── Per-tab state persistence (across pages, via sessionStorage) ──────────

function saveCurrentTabState() {
  const tab = _currentTab
  if (!tab || tab === 'annotate' || tab === 'policy-editor' || tab === 'settings') return

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
  if (typeof getSettings === 'function') {
    const settings = getSettings()
    state.configSnapshot = { model: settings.model, visionModel: settings.visionModel, policy: state.policy }
  }

  window.APP.state.setTabState(tab, state)
}

function restoreTabState(tabName) {
  if (!tabName || tabName === 'annotate' || tabName === 'policy-editor' || tabName === 'settings') return

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
    setExperimentState(tabName, 'complete')
  } else {
    setExperimentState(tabName, 'ready')
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
let _settings = {
  model: 'google/gemini-2.5-flash',
  visionModel: 'google/gemini-2.5-flash',
  currency: 'Any'
};
let _hasApiKey = false;

function initSettings() {
  const saved = localStorage.getItem('psa_settings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.model) _settings.model = s.model;
      if (s.visionModel) _settings.visionModel = s.visionModel;
      if (s.currency) _settings.currency = s.currency;
    } catch (_) {}
  }
}
initSettings();

async function fetchServerSettings() {
  try {
    const res = await fetch('/api/settings?_t=' + Date.now());
    const cfg = await res.json();
    const saved = localStorage.getItem('psa_settings');
    if (cfg.model && !saved) _settings.model = cfg.model;
    if (cfg.visionModel && !saved) _settings.visionModel = cfg.visionModel;
    if (cfg.currency && !saved) _settings.currency = cfg.currency;
    if (cfg.hasApiKey !== undefined) _hasApiKey = cfg.hasApiKey;
  } catch (_) {}
}
fetchServerSettings();

async function loadSettings() {
  const modelEl = document.getElementById('s-model');
  const visionEl = document.getElementById('s-vision-model');
  const currencyEl = document.getElementById('s-currency');

  if (modelEl && visionEl) {
    const saved = localStorage.getItem('psa_settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.model) { modelEl.value = s.model; _settings.model = s.model; }
        if (s.visionModel) { visionEl.value = s.visionModel; _settings.visionModel = s.visionModel; }
        if (s.currency && currencyEl) { currencyEl.value = s.currency; _settings.currency = s.currency; }
      } catch (_) {}
    }

    try {
      const res = await fetch('/api/settings?_t=' + Date.now());
      const cfg = await res.json();
      if (cfg.model && !saved) { modelEl.value = cfg.model; _settings.model = cfg.model; }
      if (cfg.visionModel && !saved) { visionEl.value = cfg.visionModel; _settings.visionModel = cfg.visionModel; }
      if (cfg.currency && currencyEl && !currencyEl.value) { currencyEl.value = cfg.currency; _settings.currency = cfg.currency; }
      if (cfg.hasApiKey !== undefined) _hasApiKey = cfg.hasApiKey;
    } catch (_) {}

    populateStStatusSummary();
  }
}

function populateStStatusSummary() {
  const summaryEl = document.getElementById('st-status-summary');
  if (!summaryEl) return;
  const { model, visionModel } = getSettings();
  const hasSaved = !!localStorage.getItem('psa_settings');
  const statusLabel = document.getElementById('st-status-label');
  const visionLabel = document.getElementById('st-vision-label');
  const modelLabel = document.getElementById('st-model-label');
  const connLabel = document.getElementById('st-connection-label');
  if (statusLabel) {
    statusLabel.textContent = hasSaved ? 'Saved' : 'Not saved';
    statusLabel.className = hasSaved
      ? 'font-medium text-green-700'
      : 'font-medium text-amber-700';
  }
  if (visionLabel) visionLabel.textContent = visionModel || '—';
  if (modelLabel) modelLabel.textContent = model || '—';
  if (connLabel) {
    connLabel.textContent = _hasApiKey ? 'Active (server key)' : 'No key on server';
    connLabel.className = _hasApiKey ? 'text-green-700 font-medium' : 'text-red-600 font-medium';
  }
  summaryEl.classList.remove('hidden');
}

function showPageGuide() {
  showModal('ST: Research Configuration — Page Guide', `<div class="space-y-3">
    <p>This page controls the technical environment under which Experiments E1–E6 are executed, compared and reproduced.</p>
    <h4 class="font-medium">OpenRouter API Key</h4>
    <p>Authenticates requests to the model provider. Stored in browser local storage. Re-enter after switching browsers or clearing data.</p>
    <h4 class="font-medium">Vision Model (Layer 1)</h4>
    <p>Used for OCR extraction in E1. Changing this may alter E1 output and affect all downstream experiments.</p>
    <h4 class="font-medium">Reasoning Model (Layer 3)</h4>
    <p>Used for policy interpretation and verdicts in E2–E6. Switching models enables controlled comparison.</p>
    <h4 class="font-medium">Currency Override</h4>
    <p>Controls whether receipt currency or a forced currency is used in experiment prompts.</p>
    <h4 class="font-medium">Research Control</h4>
    <p>Configuration changes apply only to future experiment runs. Every completed run retains the exact configuration used when executed.</p>
  </div>`)
}

function isValidApiKey(k) {
  return k && k.startsWith('sk-') && k.length > 20
}

function getSettings() {
  const modelEl = document.getElementById('s-model');
  const visionEl = document.getElementById('s-vision-model');
  const currencyEl = document.getElementById('s-currency');

  if (modelEl && visionEl) {
    return {
      model: modelEl.value,
      visionModel: visionEl.value,
      currency: currencyEl?.value || 'Any',
    };
  }

  return {
    model: _settings.model,
    visionModel: _settings.visionModel,
    currency: _settings.currency,
  };
}

async function saveSettings() {
  const { model, visionModel, currency } = getSettings();
  _settings.model = model;
  _settings.visionModel = visionModel;
  _settings.currency = currency;

  localStorage.setItem('psa_settings', JSON.stringify({ model, visionModel, currency }));

  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, visionModel, currency }),
  });
  showResult('settings-result', '<span class="text-green-600">✓ Settings saved</span>');
  populateStStatusSummary();
}

async function testConnection() {
  const { model } = getSettings();
  showResult('settings-result', '<span class="text-gray-500">Testing…</span>');
  const connLabel = document.getElementById('st-connection-label');
  if (connLabel) {
    connLabel.textContent = 'Testing…';
    connLabel.className = 'text-gray-500';
  }
  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const data = await res.json();
    if (data.ok) {
      showResult('settings-result', `<span class="text-green-600">✓ Connected — model replied: "${data.response}"</span>`);
      _hasApiKey = true;
      if (connLabel) {
        connLabel.textContent = 'Verified';
        connLabel.className = 'text-green-700 font-medium';
      }
    } else {
      showError('settings-result', data.error || 'Connection failed');
      _hasApiKey = false;
      if (connLabel) {
        connLabel.textContent = 'Failed';
        connLabel.className = 'text-red-600 font-medium';
      }
    }
    populateStStatusSummary();
  } catch (e) {
    showError('settings-result', e.message);
    _hasApiKey = false;
    if (connLabel) {
      connLabel.textContent = 'Failed';
      connLabel.className = 'text-red-600 font-medium';
    }
    populateStStatusSummary();
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

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
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

function formatReasoningChain(reasoningText) {
  if (!reasoningText) return '';
  
  // Split by steps like "1. ", "2. ", "3. ", "4. ", or "Step 1:", "Step 2:"
  const steps = [];
  const regex = /(?:^|\n)(?:\d+[\.\)\:]|Step\s+\d+\:?)\s*/gi;
  const parts = reasoningText.split(regex);
  const matches = reasoningText.match(regex);
  
  // The first part might be introductory text (before Step 1)
  let intro = parts[0]?.trim();
  
  if (matches && matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const stepNum = matches[i].trim().replace(/[\.\)\:]/g, '').replace(/step\s+/i, '');
      const content = parts[i + 1]?.trim() || '';
      steps.push({ num: stepNum, content });
    }
  } else {
    // Fallback: if no step numbers are matched, split by lines or paragraphs
    const paragraphs = reasoningText.split(/\n+/);
    paragraphs.forEach((p, idx) => {
      if (p.trim()) {
        steps.push({ num: idx + 1, content: p.trim() });
      }
    });
    intro = '';
  }

  // Render as a beautiful vertical timeline/tree structure
  let html = '<div style="display: flex; flex-direction: column; gap: 14px; padding: 4px; font-family: var(--font-sans); margin-top: 10px;">';
  if (intro) {
    html += `<div style="font-size: 13px; color: var(--ink-soft); line-height: 1.5; margin-bottom: 4px; font-style: italic;">${escHtml(intro)}</div>`;
  }
  
  steps.forEach((step, idx) => {
    // Format bold keys or quotes inside the content (e.g. "**Bold**:" or "Quote:")
    let formattedContent = escHtml(step.content)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.04); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');

    // Add a left line/node indicator to create a tree/timeline look
    const isLast = idx === steps.length - 1;
    html += `
      <div style="display: flex; gap: 12px; position: relative;">
        ${!isLast ? `<div style="position: absolute; left: 13px; top: 28px; bottom: -20px; width: 2px; background: rgba(0,0,0,0.06); border-radius: 1px;"></div>` : ''}
        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--bg-soft); border: 2px solid var(--rule); font-size: 12px; font-weight: 700; color: var(--ink-soft); flex-shrink: 0; z-index: 1;">
          ${step.num}
        </div>
        <div style="flex: 1; padding: 4px 0 8px;">
          <div style="font-size: 12px; line-height: 1.6; color: var(--ink-soft); font-family: var(--font-sans);">${formattedContent}</div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}
function formatReasoningChainE3(reasoningText) {
  if (!reasoningText) return '';
  
  // Split by step patterns
  const steps = [];
  const regex = /(?:^|\n)(?:\d+[\.\)\:]|Step\s+\d+\:?)\s*/gi;
  const parts = reasoningText.split(regex);
  const matches = reasoningText.match(regex);
  
  let intro = parts[0]?.trim();
  
  if (matches && matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const stepNum = matches[i].trim().replace(/[\.\)\:]/g, '').replace(/step\s+/i, '');
      const rawContent = parts[i + 1]?.trim() || '';
      
      // Extract title: often the first sentence or up to a colon
      let title = `Step ${stepNum}`;
      let content = rawContent;
      const colonIdx = rawContent.indexOf(':');
      const dotIdx = rawContent.indexOf('.');
      
      if (colonIdx > 0 && colonIdx < 80) {
        title = rawContent.substring(0, colonIdx).trim();
        content = rawContent.substring(colonIdx + 1).trim();
      } else if (dotIdx > 0 && dotIdx < 80) {
        title = rawContent.substring(0, dotIdx).trim();
        content = rawContent.substring(dotIdx + 1).trim();
      }
      
      steps.push({ num: stepNum, title, content });
    }
  } else {
    const paragraphs = reasoningText.split(/\n+/);
    paragraphs.forEach((p, idx) => {
      if (p.trim()) {
        steps.push({ num: idx + 1, title: `Analysis Step ${idx + 1}`, content: p.trim() });
      }
    });
    intro = '';
  }

  const stepMeta = {
    "1": { icon: "🔍", color: "#6366f1", title: "Expense Identification" },
    "2": { icon: "📜", color: "#10b981", title: "Policy Verification" },
    "3": { icon: "⚖️", color: "#f59e0b", title: "Amount & Limit Check" },
    "4": { icon: "🏁", color: "#ef4444", title: "Ambiguity & Conflict Assessment" },
    "5": { icon: "💡", color: "#8b5cf6", title: "Final Synthesis" }
  };

  let html = '<div style="display: flex; flex-direction: column; gap: 20px; font-family: var(--font-sans); margin-top: 14px; padding: 4px 0;">';
  
  if (intro) {
    html += `<div style="font-size: 13px; color: var(--ink-soft); line-height: 1.5; font-style: italic; margin-bottom: 4px; padding-left: 2px;">${escHtml(intro)}</div>`;
  }
  
  steps.forEach((step, idx) => {
    const meta = stepMeta[step.num] || { icon: "⚙️", color: "#6366f1", title: step.title };
    const stepTitle = step.title && step.title.length < 50 ? step.title : meta.title;
    
    let formattedContent = escHtml(step.content)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.04); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');

    const isLast = idx === steps.length - 1;
    
    html += `
      <div style="background: #ffffff; border: 1px solid var(--rule); border-left: 4px solid ${meta.color}; border-radius: var(--r-md); padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.015); position: relative; transition: all 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="font-size: 18px; flex-shrink: 0; background: ${meta.color}15; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${meta.icon}</span>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint);">Step ${step.num}</span>
            <span style="font-weight: 700; font-size: 13px; color: var(--ink);">${escHtml(stepTitle)}</span>
          </div>
        </div>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: var(--ink-soft); font-family: var(--font-sans);">${formattedContent}</p>
        
        ${!isLast ? `
          <div style="position: absolute; left: 20px; bottom: -24px; width: 2px; height: 24px; background: ${meta.color}30; z-index: 1;"></div>
          <div style="position: absolute; left: 9px; bottom: -28px; width: 24px; height: 24px; border-radius: 50%; background: #ffffff; border: 1px solid var(--rule); display: flex; align-items: center; justify-content: center; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        ` : ''}
      </div>
      ${!isLast ? '<div style="height: 6px;"></div>' : ''}
    `;
  });
  
  html += '</div>';
  return html;
}
function buildMetaHtml(opts) {
  const parts = []
  if (opts.cached) parts.unshift(`<span class="cache-badge text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">📦 Cached from ${escHtml(opts.cached)}</span>`)
  if (opts.duration) parts.push(`<span>Time: ${escHtml(opts.duration)}s</span>`)
  if (opts.timestamp) parts.push(`<span class="meta-text">${escHtml(opts.timestamp)}</span>`)
  return parts.length
    ? `<div class="meta-row mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">${parts.join('')}</div>`
    : ''
}

function updateTabRunCounts() {
  // Map href -> tab key
  const tabFromHref = (href) => {
    if (!href) return null
    if (href.endsWith('e1.html')) return 'e1'
    if (href.endsWith('e2.html')) return 'e2'
    if (href.endsWith('e3.html')) return 'e3'
    if (href.endsWith('e4.html')) return 'e4'
    if (href.endsWith('e5.html')) return 'e5'
    if (href.endsWith('e6.html')) return 'e6'
    return null
  }
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = tabFromHref(btn.getAttribute('href'))
    if (!tab) return
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
  window.APP.state.setReceipt(fileData)
  updateReceiptBar(fileData)
  syncReceiptIndicator(_currentTab)
  return fileData
}

function updateReceiptBar(fileData) {
  const bar = document.getElementById('receipt-bar')
  const name = document.getElementById('receipt-filename')
  if (!bar) return

  if (fileData && fileData.filename) {
    name.textContent = fileData.filename

    // Add thumbnail if image
    let thumbContainer = bar.querySelector('.receipt-bar-thumb')
    if (!thumbContainer) {
      thumbContainer = document.createElement('div')
      thumbContainer.className = 'receipt-bar-thumb'
      thumbContainer.style = 'width: 24px; height: 24px; border-radius: var(--r-sm); overflow: hidden; background: #fff; border: 1px solid var(--rule); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;'
      thumbContainer.onclick = () => window.APP.showReceiptViewer()
      bar.firstElementChild.insertBefore(thumbContainer, name)
    }

    const isImage = fileData.mimeType && fileData.mimeType.startsWith('image/')
    if (isImage) {
      const fullSrc = `data:${fileData.mimeType || 'image/jpeg'};base64,${fileData.base64}`
      thumbContainer.innerHTML = `<img src="${fullSrc}" style="width: 100%; height: 100%; object-fit: cover;">`
      thumbContainer.style.display = 'flex'
    } else {
      thumbContainer.innerHTML = '<span style="font-size: 11px;">📄</span>'
      thumbContainer.style.display = 'flex'
    }

    bar.classList.remove('hidden')
  } else {
    bar.classList.add('hidden')
    name.textContent = ''
    const thumbContainer = bar.querySelector('.receipt-bar-thumb')
    if (thumbContainer) thumbContainer.remove()
  }
}

function syncReceiptIndicator(tabName) {
  const fileInput = document.getElementById(`${tabName}-file`)
  if (!fileInput) return
  let indicator = fileInput.parentElement.querySelector('.shared-receipt-indicator')
  const shared = window.APP.state.getReceipt()
  if (shared && shared.filename) {
    if (!indicator) {
      indicator = document.createElement('div')
      indicator.className = 'shared-receipt-indicator'
      fileInput.parentElement.insertBefore(indicator, fileInput.nextSibling)
    }
    const isImage = shared.mimeType && shared.mimeType.startsWith('image/')
    const fullSrc = `data:${shared.mimeType || 'image/jpeg'};base64,${shared.base64}`
    const thumb = isImage
      ? `<img src="${fullSrc}" class="shared-receipt-thumb" alt="receipt" onclick="window.APP.showReceiptViewer()" style="cursor:zoom-in">`
      : '<span class="text-gray-400 text-xs">📄</span>'
    const sizeStr = shared.base64
      ? `${(shared.base64.length / 1024).toFixed(0)} KB`
      : ''
    indicator.innerHTML = `
      <div class="flex items-center gap-2 mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
        ${thumb}
        <div class="flex-1 min-w-0">
          <div class="text-xs font-medium text-blue-700">Using shared receipt: ${escHtml(shared.filename)}</div>
          <div class="text-xs text-gray-400">${sizeStr}${isImage ? ' — click thumbnail to view' : ''}</div>
        </div>
        <div class="text-xs text-gray-400">Or select a different file below ↓</div>
      </div>`
    fileInput.classList.add('opacity-50')
  } else {
    if (indicator) indicator.remove()
    fileInput.classList.remove('opacity-50')
  }
}

function showReceiptViewer() {
  const shared = window.APP.state.getReceipt()
  if (!shared || !shared.base64) return
  const isImage = shared.mimeType && shared.mimeType.startsWith('image/')
  const fullSrc = `data:${shared.mimeType || 'image/jpeg'};base64,${shared.base64}`
  if (isImage) {
    showModal(escHtml(shared.filename || 'Receipt'), `<img src="${fullSrc}" style="max-width:100%; max-height:70vh; display:block; margin:0 auto; border-radius:0.5rem; box-shadow:0 4px 24px rgba(0,0,0,0.15)">`)
  } else {
    showModal(escHtml(shared.filename || 'Receipt'), `<div class="text-gray-500 text-sm">PDF preview not available in browser. File size: ${(shared.base64.length / 1024).toFixed(0)} KB</div>`)
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
    { label: 'Points Payment', key: 'points_payment', section: 'amounts' },
    { label: 'Points Earned', key: 'points_earned', section: 'amounts' },
    { label: 'Gift Card Payment', key: 'gift_card_payment', section: 'amounts' },
    { label: 'Other Virtual Payment', key: 'other_virtual_payment', section: 'amounts' },
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
  const fileInput = document.getElementById('e1-file')
  const shared = window.APP.state.getReceipt()
  if (!fileInput.files[0] && !shared) return showError('e1-result', 'Please select a receipt file')

  setExperimentState('e1', 'running')
  showResult('e1-result', '<p class="text-sm text-gray-500">Extracting fields...</p>')

  try {
    const { base64, mimeType, filename } = await getFileData('e1-file')
    const { apiKey, visionModel, currency } = getSettings()
    const filenameVal = filename || fileInput.files[0]?.name || shared?.filename
    const result = await apiPost('/api/extract', { base64, mimeType, filename: filenameVal, apiKey, model: visionModel, currency })

    ResultsStore.addResult('e1', {
      config: { visionModel, filename: filenameVal },
      result: result.extraction,
    })
    setExperimentState('e1', 'complete')
    renderE1Result(result.extraction)
  } catch (err) {
    setExperimentState('e1', 'error')
    showError('e1-result', err.message || 'Extraction failed')
  }
}

function renderE1Result(data) {
  const isImage = data?.mimeType && data.mimeType.startsWith('image/')

  // Detect discount/points items in line items
  const discountItems = Array.isArray(data?.line_items)
    ? data.line_items.filter(item => {
        const desc = (typeof item === 'string' ? item : (item.description || '')).toLowerCase()
        const total = typeof item === 'object' ? Number(item.total_price || 0) : 0
        return total < 0
          || desc.includes('point')
          || desc.includes('redeem')
          || desc.includes('discount')
          || desc.includes('credit')
          || desc.includes('coupon')
          || desc.includes('voucher')
      })
    : []
  const discountTotal = discountItems.reduce((sum, item) => {
    return sum + (typeof item === 'object' ? Number(item.total_price || 0) : 0)
  }, 0)

  const html = `
    <div style="max-width: 400px; margin: 0 auto; background: #ffffff; border: 1px dashed var(--ink-faint); border-radius: var(--r-md); box-shadow: 0 4px 20px rgba(0,0,0,0.04); padding: 24px; font-family: 'Courier New', Courier, monospace; color: var(--ink);">
      
      <!-- Receipt Header -->
      <div style="text-align: center; margin-bottom: 16px;">
        <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink);">${escHtml(data?.vendor || 'RECEIPT')}</h3>
        ${data?.vendor_address ? `<p style="margin: 0; font-size: 11px; color: var(--ink-soft); line-height: 1.4;">${escHtml(data.vendor_address)}</p>` : ''}
        ${data?.vendor_phone ? `<p style="margin: 2px 0 0; font-size: 11px; color: var(--ink-soft);">Tel: ${escHtml(data.vendor_phone)}</p>` : ''}
        ${data?.vendor_tax_id ? `<p style="margin: 2px 0 0; font-size: 11px; color: var(--ink-soft);">Tax ID: ${escHtml(data.vendor_tax_id)}</p>` : ''}
      </div>

      <div style="border-top: 1px dashed var(--ink-faint); margin: 12px 0;"></div>

      <!-- Metadata fields -->
      <div style="font-size: 11px; color: var(--ink-soft); display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin-bottom: 12px;">
        ${data?.receipt_number ? `<span>REC #:</span><span style="text-align: right; font-weight: 600;">${escHtml(data.receipt_number)}</span>` : ''}
        <span>DATE:</span><span style="text-align: right;">${escHtml(data?.date || '—')} ${escHtml(data?.time || '')}</span>
        ${data?.payment_method ? `<span>PAYMENT:</span><span style="text-align: right; text-transform: uppercase;">${escHtml(data.payment_method)}</span>` : ''}
      </div>

      <div style="border-top: 1px dashed var(--ink-faint); margin: 12px 0;"></div>

      <!-- Line items table -->
      <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 12px;">
        <thead>
          <tr style="border-bottom: 1px dashed var(--ink-faint); font-weight: 700; color: var(--ink-soft);">
            <th style="text-align: left; padding-bottom: 6px;">ITEM</th>
            <th style="text-align: right; padding-bottom: 6px; width: 40px;">QTY</th>
            <th style="text-align: right; padding-bottom: 6px; width: 60px;">PRICE</th>
            <th style="text-align: right; padding-bottom: 6px; width: 60px;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${Array.isArray(data?.line_items) && data.line_items.length ? data.line_items.map(item => {
            const desc = typeof item === 'string' ? item : (item.description || 'Item');
            const qty = typeof item === 'object' ? (item.quantity ?? 1) : 1;
            const price = typeof item === 'object' ? (item.unit_price ?? 0) : 0;
            const total = typeof item === 'object' ? (item.total_price ?? (price * qty)) : 0;
            return `
              <tr>
                <td style="padding: 4px 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(desc)}</td>
                <td style="padding: 4px 0; text-align: right;">${qty}</td>
                <td style="padding: 4px 0; text-align: right;">${Number(price).toFixed(2)}</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600;">${Number(total).toFixed(2)}</td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="4" style="text-align: center; color: var(--ink-faint); padding: 8px 0;">No items listed</td></tr>'}
        </tbody>
      </table>

      <div style="border-top: 1px dashed var(--ink-faint); margin: 12px 0;"></div>

      <!-- Totals block -->
      <div style="font-size: 12px; display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; margin-bottom: 12px;">
        ${data?.subtotal != null ? `<span>SUBTOTAL:</span><span style="text-align: right;">${Number(data.subtotal).toFixed(2)}</span>` : ''}
        ${data?.tax_amount != null ? `<span>TAX/VAT ${data.tax_rate ? `(${data.tax_rate}%)` : ''}:</span><span style="text-align: right;">${Number(data.tax_amount).toFixed(2)}</span>` : ''}
        ${data?.surcharge != null && Number(data.surcharge) !== 0 ? `<span>SURCHARGE:</span><span style="text-align: right;">${Number(data.surcharge).toFixed(2)}</span>` : ''}
        ${data?.cash_out != null && Number(data.cash_out) !== 0 ? `<span>CASH OUT:</span><span style="text-align: right;">${Number(data.cash_out).toFixed(2)}</span>` : ''}
        ${data?.points_payment != null && Number(data.points_payment) !== 0 ? `<span style="color: var(--indigo); font-weight: 600;">POINTS PAYMENT:</span><span style="text-align: right; color: var(--indigo); font-weight: 600;">${Number(data.points_payment).toFixed(2)}</span>` : ''}
        ${data?.points_earned != null && Number(data.points_earned) !== 0 ? `<span style="color: var(--green); font-weight: 600;">POINTS EARNED:</span><span style="text-align: right; color: var(--green); font-weight: 600;">+${Number(data.points_earned).toFixed(2)}</span>` : ''}
        ${data?.gift_card_payment != null && Number(data.gift_card_payment) !== 0 ? `<span style="color: var(--indigo); font-weight: 600;">GIFT CARD PAYMENT:</span><span style="text-align: right; color: var(--indigo); font-weight: 600;">${Number(data.gift_card_payment).toFixed(2)}</span>` : ''}
        ${data?.other_virtual_payment != null && Number(data.other_virtual_payment) !== 0 ? `<span style="color: var(--indigo); font-weight: 600;">OTHER VIRTUAL PAYMENT:</span><span style="text-align: right; color: var(--indigo); font-weight: 600;">${Number(data.other_virtual_payment).toFixed(2)}</span>` : ''}
        ${discountTotal !== 0 ? `<span style="color: var(--indigo); font-weight: 600;">POINTS / DISCOUNT:</span><span style="text-align: right; color: var(--indigo); font-weight: 600;">${Number(discountTotal).toFixed(2)}</span>` : ''}
        <span style="font-size: 14px; font-weight: 700; color: var(--ink);">TOTAL:</span>
        <span style="font-size: 14px; font-weight: 700; color: var(--ink); text-align: right;">${data?.currency || ''} ${Number(data?.amount || 0).toFixed(2)}</span>
      </div>

      <div style="border-top: 1px dashed var(--ink-faint); margin: 12px 0;"></div>

      <!-- Category footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-top: 4px;">
        <span style="color: var(--ink-soft);">CATEGORY:</span>
        <span style="background: var(--bg-soft); color: var(--ink); border: 1px solid var(--rule); border-radius: var(--r-sm); padding: 2px 8px; font-weight: 600; text-transform: uppercase; font-size: 10px;">${escHtml(data?.category || 'OTHER')}</span>
      </div>
    </div>
  `;
  showResult('e1-result', html)
}

// ─── E2: No-CoT Verdict ───────────────────────────────────────────────────────

async function runE2() {
  const fileInput = document.getElementById('e2-file')
  const shared = window.APP.state.getReceipt()
  if (!fileInput.files[0] && !shared) return showError('e2-result', 'Please select a receipt file')

  showResult('e2-result', '');
  setExperimentState('e2', 'running');
  const startTime = performance.now();
  try {
    const { base64, mimeType, filename } = await getFileData('e2-file');
    const { apiKey, visionModel, model, currency } = getSettings();

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, filename, apiKey, model, visionModel, currency,
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
    const verdictColors = {
      justified: {
        bg: 'background-color: var(--bg-emerald); border-color: #6ee7b7;',
        text: 'color: var(--emerald-deep);'
      },
      suspicious: {
        bg: 'background-color: #fef2f2; border-color: #fca5a5;',
        text: 'color: #b91c1c;'
      },
      unclear: {
        bg: 'background-color: var(--bg-warning); border-color: #fcd34d;',
        text: 'color: var(--amber);'
      }
    }[data.verdict] || {
      bg: 'background-color: var(--bg-soft); border-color: var(--rule);',
      text: 'color: var(--ink);'
    };

    showResult('e2-result', `
      <div style="border: 1px solid; border-radius: var(--r-md); padding: 20px; margin-bottom: 20px; transition: all 0.2s ease; ${verdictColors.bg}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; ${verdictColors.text}">Verdict Assessment</span>
          ${verdictBadge(data.verdict)}
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; font-weight: 500; line-height: 1.5; color: var(--ink);">${escHtml(data.reason)}</p>
        <div style="border-top: 1px dashed rgba(0,0,0,0.06); margin-top: 12px; padding-top: 12px;">
          ${metaHtml}
        </div>
      </div>`);
    ResultsStore.addResult('e2', {
      config: { model, visionModel, policy, phase: parseInt(phase) },
      result: { verdict: data.verdict, reason: data.reason, reasoning: data.reasoning },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    setExperimentState('e2', 'complete');
    saveCurrentTabState();
    updateTabRunCounts();
  } catch (e) {
    setExperimentState('e2', 'error');
    showError('e2-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E3: CoT Verdict ─────────────────────────────────────────────────────────

async function runE3() {
  const fileInput = document.getElementById('e3-file')
  const shared = window.APP.state.getReceipt()
  if (!fileInput.files[0] && !shared) return showError('e3-result', 'Please select a receipt file')

  setExperimentState('e3', 'running')
  showResult('e3-result', '<p class="text-sm text-gray-500">Reasoning through policy...</p>')
  const startTime = performance.now();
  try {
    const { base64, mimeType, filename } = await getFileData('e3-file');
    const { apiKey, visionModel, model, currency } = getSettings();

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, filename, apiKey, model, visionModel, currency,
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
    const verdictColors = {
      justified: {
        bg: 'background-color: var(--bg-emerald); border-color: #6ee7b7;',
        text: 'color: var(--emerald-deep);'
      },
      suspicious: {
        bg: 'background-color: #fef2f2; border-color: #fca5a5;',
        text: 'color: #b91c1c;'
      },
      unclear: {
        bg: 'background-color: var(--bg-warning); border-color: #fcd34d;',
        text: 'color: var(--amber);'
      }
    }[data.verdict] || {
      bg: 'background-color: var(--bg-soft); border-color: var(--rule);',
      text: 'color: var(--ink);'
    };

    showResult('e3-result', `
      <div style="border: 1px solid; border-radius: var(--r-md); padding: 20px; margin-bottom: 20px; transition: all 0.2s ease; ${verdictColors.bg}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; ${verdictColors.text}">Verdict Assessment</span>
          ${verdictBadge(data.verdict)}
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; font-weight: 500; line-height: 1.5; color: var(--ink);">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm" style="margin-bottom: 16px;">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Show reasoning chain</summary>
            <div class="mt-2 p-4 bg-white border border-gray-100 rounded text-gray-700">${formatReasoningChainE3(data.reasoning)}</div>
          </details>` : ''}
        <div style="border-top: 1px dashed rgba(0,0,0,0.06); margin-top: 12px; padding-top: 12px;">
          ${metaHtml}
        </div>
      </div>`);
    ResultsStore.addResult('e3', {
      config: { model, visionModel, policy, phase: parseInt(phase) },
      result: { verdict: data.verdict, reason: data.reason, reasoning: data.reasoning },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    setExperimentState('e3', 'complete')
    saveCurrentTabState();
    updateTabRunCounts();
  } catch (e) {
    setExperimentState('e3', 'error')
    showError('e3-result', e.message);
  }
}

// ─── E4: Phase Sensitivity ────────────────────────────────────────────────────

async function runE4() {
  const fileInput = document.getElementById('e4-file')
  const shared = window.APP.state.getReceipt()
  if (!fileInput.files[0] && !shared) return showError('e4-result', 'Please select a receipt file')

  setExperimentState('e4', 'running');
  showResult('e4-result', '');
  const startTime = performance.now();
  try {
    const { base64, mimeType, filename } = await getFileData('e4-file');
    const { apiKey, visionModel, model, currency } = getSettings();

    const res = await fetch('/api/phase-sensitivity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, filename, apiKey, model, visionModel, currency,
        policy: document.getElementById('e4-policy').value,
      }),
    });
    const data = await res.json();
    if (data.error) {
      setExperimentState('e4', 'error');
      return showError('e4-result', data.error);
    }
    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const policy = document.getElementById('e4-policy')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, policy, duration });
    showResult('e4-result', `
      <div class="grid grid-cols-3 gap-4" style="margin-bottom: 20px;">
        ${data.phases.map(p => {
          const colColors = {
            justified: { bg: 'background-color: var(--bg-emerald); border-color: #6ee7b7;', text: 'color: var(--emerald-deep);' },
            suspicious: { bg: 'background-color: #fef2f2; border-color: #fca5a5;', text: 'color: #b91c1c;' },
            unclear: { bg: 'background-color: var(--bg-warning); border-color: #fcd34d;', text: 'color: var(--amber);' }
          }[p.verdict] || { bg: 'background-color: var(--bg-soft); border-color: var(--rule);', text: 'color: var(--ink);' };

          return `
            <div style="border: 1px solid; border-radius: var(--r-md); padding: 16px; transition: all 0.2s ease; ${colColors.bg}">
              <div class="text-xs font-semibold mb-2 uppercase tracking-wide" style="color: var(--ink-soft);">${escHtml(p.phase)}</div>
              <div style="margin-bottom: 10px;">${verdictBadge(p.verdict)}</div>
              <p class="text-sm font-medium" style="margin: 0 0 12px; color: var(--ink);">${escHtml(p.reason)}</p>
              ${p.reasoning ? `
                <details class="text-xs mt-2">
                  <summary class="cursor-pointer text-gray-400">Reasoning</summary>
                  <div class="mt-1 p-3 bg-white border border-gray-100 rounded text-gray-700">${formatReasoningChain(p.reasoning)}</div>
                </details>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      ${metaHtml}`);
    ResultsStore.addResult('e4', {
      config: { model, visionModel, policy },
      result: { phases: data.phases },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    setExperimentState('e4', 'complete');
    saveCurrentTabState();
    updateTabRunCounts();
  } catch (e) {
    setExperimentState('e4', 'error');
    showError('e4-result', e.message);
  } finally {
    setLoading(btnId, false);
  }
}

// ─── E5: Ambiguity ────────────────────────────────────────────────────────────
// Uses /api/verdict with useCot: true (5-step prompt variant is selected server-side for E5)

async function runE5() {
  const fileInput = document.getElementById('e5-file')
  const shared = window.APP.state.getReceipt()
  if (!fileInput.files[0] && !shared) return showError('e5-result', 'Please select a receipt file')

  setExperimentState('e5', 'running');
  const startTime = performance.now();
  try {
    const { base64, mimeType, filename } = await getFileData('e5-file');
    const { apiKey, visionModel, model, currency } = getSettings();

    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, filename, apiKey, model, visionModel, currency,
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
    const verdictColors = {
      justified: {
        bg: 'background-color: var(--bg-emerald); border-color: #6ee7b7;',
        text: 'color: var(--emerald-deep);'
      },
      suspicious: {
        bg: 'background-color: #fef2f2; border-color: #fca5a5;',
        text: 'color: #b91c1c;'
      },
      unclear: {
        bg: 'background-color: var(--bg-warning); border-color: #fcd34d;',
        text: 'color: var(--amber);'
      }
    }[data.verdict] || {
      bg: 'background-color: var(--bg-soft); border-color: var(--rule);',
      text: 'color: var(--ink);'
    };

    showResult('e5-result', `
      <div style="border: 1px solid; border-radius: var(--r-md); padding: 20px; margin-bottom: 20px; transition: all 0.2s ease; ${verdictColors.bg}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${verdictBadge(data.verdict)}
            ${isUnclear
              ? '<span class="text-xs bg-green-100 border border-green-300 text-green-800 px-2 py-0.5 rounded font-sans">✓ Uncertainty expressed</span>'
              : '<span class="text-xs bg-orange-100 border border-orange-300 text-orange-700 px-2 py-0.5 rounded font-sans">⚠ Confident verdict on ambiguous receipt</span>'}
          </div>
          <span style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; ${verdictColors.text}">Ambiguity Assessment</span>
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; font-weight: 500; line-height: 1.5; color: var(--ink);">${escHtml(data.reason)}</p>
        ${data.reasoning ? `
          <details class="text-sm" style="margin-bottom: 16px;">
            <summary class="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Show 5-step reasoning</summary>
            <div class="mt-2 p-4 bg-white border border-gray-100 rounded text-gray-700">${formatReasoningChain(data.reasoning)}</div>
          </details>` : ''}
        <div style="border-top: 1px dashed rgba(0,0,0,0.06); margin-top: 12px; padding-top: 12px;">
          ${metaHtml}
        </div>
      </div>`);
    ResultsStore.addResult('e5', {
      config: { model, visionModel, policy, phase: parseInt(phase) },
      result: { verdict: data.verdict, reason: data.reason, reasoning: data.reasoning },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    saveCurrentTabState();
    updateTabRunCounts();
    setExperimentState('e5', 'complete');
  } catch (e) {
    setExperimentState('e5', 'error');
    showError('e5-result', e.message);
  }
}

// ─── E6: Adversarial ─────────────────────────────────────────────────────────

async function runE6() {
  const fileInput = document.getElementById('e6-file')
  const shared = window.APP.state.getReceipt()
  if (!fileInput.files[0] && !shared) return showError('e6-result', 'Please select a receipt file')

  setExperimentState('e6', 'running')
  showResult('e6-result', '<p class="text-sm text-gray-500">Testing against all policy variants...</p>')

  const startTime = performance.now();
  try {
    const { base64, mimeType, filename } = await getFileData('e6-file');
    const { apiKey, visionModel, model, currency } = getSettings();

    const res = await fetch('/api/adversarial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64, mimeType, filename, apiKey, model, visionModel, currency,
        phase: parseInt(document.getElementById('e6-phase').value),
      }),
    });
    const data = await res.json();
    if (data.error) {
      setExperimentState('e6', 'error')
      return showError('e6-result', data.error);
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1);
    const phase = document.getElementById('e6-phase')?.value;
    const metaHtml = buildMetaHtml({ model, visionModel, phase, duration });
    showResult('e6-result', `
      <div class="grid grid-cols-3 gap-4" style="margin-bottom: 20px;">
        ${data.policies.map(p => {
          const colColors = {
            justified: { bg: 'background-color: var(--bg-emerald); border-color: #6ee7b7;', text: 'color: var(--emerald-deep);' },
            suspicious: { bg: 'background-color: #fef2f2; border-color: #fca5a5;', text: 'color: #b91c1c;' },
            unclear: { bg: 'background-color: var(--bg-warning); border-color: #fcd34d;', text: 'color: var(--amber);' }
          }[p.verdict] || { bg: 'background-color: var(--bg-soft); border-color: var(--rule);', text: 'color: var(--ink);' };

          return `
            <div style="border: 1px solid; border-radius: var(--r-md); padding: 16px; transition: all 0.2s ease; ${colColors.bg}">
              <div class="text-xs font-semibold mb-2 uppercase" style="color: var(--ink-soft);">${escHtml(p.policy)} policy</div>
              <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                ${verdictBadge(p.verdict)}
                ${p.hallucination
                  ? '<span class="text-xs bg-orange-100 border border-orange-300 text-orange-700 px-1.5 py-0.5 rounded font-sans">⚠ hallucination</span>'
                  : ''}
              </div>
              <p class="text-sm font-medium" style="margin: 0 0 12px; color: var(--ink);">${escHtml(p.reason)}</p>
              ${p.policy_clarity
                ? `<p class="text-xs mt-1" style="color: var(--ink-mute);">Policy assessed as: <strong>${escHtml(p.policy_clarity)}</strong></p>`
                : ''}
              ${p.reasoning ? `
                <details class="text-xs mt-2">
                  <summary class="cursor-pointer text-gray-400">Reasoning</summary>
                  <div class="mt-1 p-3 bg-white border border-gray-100 rounded text-gray-700">${formatReasoningChain(p.reasoning)}</div>
                </details>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      ${metaHtml}`);
    ResultsStore.set('e6', {
      config: { model, visionModel, phase: parseInt(phase), currency },
      policies: data.policies,
      duration,
    });
    ResultsStore.addResult('e6', {
      config: { model, visionModel, phase: parseInt(phase) },
      result: { policies: data.policies },
      receipt: { filename: window.APP.state.getReceipt()?.filename },
    })
    setExperimentState('e6', 'complete')
    saveCurrentTabState();
    updateTabRunCounts();
  } catch (e) {
    setExperimentState('e6', 'error')
    showError('e6-result', e.message);
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
      fetch('/api/receipts?_t=' + Date.now()).then(r => r.json()),
      fetch('/api/annotations?_t=' + Date.now()).then(r => r.json()),
    ]);
    const sel = document.getElementById('ann-file');
    sel.innerHTML = '<option value="">Select a receipt...</option>' +
      _receipts.map(f => `<option value="${escHtml(f)}">${escHtml(f)}</option>`).join('');
    updateAnnCounter();
    loadAnnotation();
  } catch (e) {
    showError('ann-result', `Failed to load receipts: ${e.message}`);
  }
}

function updateAnnCounter() {
  const sel = document.getElementById('ann-file');
  const counter = document.getElementById('ann-counter');
  if (!sel || !counter) return;
  const total = _receipts.length;
  const value = sel.value;
  if (!value) {
    counter.textContent = total ? `0 of ${total}` : '—';
    return;
  }
  const idx = _receipts.indexOf(value);
  counter.textContent = idx >= 0 ? `Receipt ${idx + 1} of ${total}` : '—';
}

function prevReceipt() {
  if (!_receipts.length) return;
  const sel = document.getElementById('ann-file');
  const value = sel.value;
  let idx = value ? _receipts.indexOf(value) : 0;
  idx = idx <= 0 ? _receipts.length - 1 : idx - 1;
  sel.value = _receipts[idx];
  loadAnnotation();
}

function nextReceipt() {
  if (!_receipts.length) return;
  const sel = document.getElementById('ann-file');
  const value = sel.value;
  let idx = value ? _receipts.indexOf(value) : -1;
  idx = idx >= _receipts.length - 1 ? 0 : idx + 1;
  sel.value = _receipts[idx];
  loadAnnotation();
}

function showAnnPreview(filename) {
  const img = document.getElementById('ann-preview');
  const empty = document.getElementById('ann-preview-empty');
  if (!img || !empty) return;
  if (!filename) {
    img.src = '';
    img.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.textContent = 'Select a receipt to preview';
    return;
  }
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf') {
    img.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.innerHTML = `<a href="/api/receipts/${encodeURIComponent(filename)}" target="_blank" class="text-blue-600 underline">Open PDF: ${escHtml(filename)}</a>`;
    return;
  }
  empty.classList.add('hidden');
  img.classList.remove('hidden');
  img.src = `/api/receipts/${encodeURIComponent(filename)}`;
  img.alt = filename;
}

function showAnnStatus(kind, message) {
  const el = document.getElementById('ann-status');
  if (!el) return;
  if (!kind) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.classList.remove('bg-blue-50', 'border-blue-200', 'text-blue-700',
    'bg-green-50', 'border-green-200', 'text-green-700',
    'bg-red-50', 'border-red-200', 'text-red-700');
  if (kind === 'existing') {
    el.classList.add('bg-green-50', 'border-green-200', 'text-green-700');
  } else if (kind === 'error') {
    el.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
  } else {
    el.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-700');
  }
  el.textContent = message;
}

function getE1CachedExtraction(filename) {
  try {
    const fn = filename || window.APP?.state?.getReceipt?.()?.filename;
    if (!fn) return null;

    const autoKey = `psa_e1_auto_${fn}`;
    const autoRaw = sessionStorage.getItem(autoKey);
    if (autoRaw) return JSON.parse(autoRaw);

    const results = ResultsStore.getResults('e1');
    const match = results.slice().reverse().find(r => r.config?.filename === fn || r.receipt?.filename === fn);
    if (match && (match.result || match.extraction)) return match.result || match.extraction;

    const single = ResultsStore.get('e1');
    if (single && (single.filename === fn || single.config?.filename === fn)) {
      return single.result || single.extraction;
    }

    // Check in _annotations (ground truth loaded from server)
    if (typeof _annotations !== 'undefined' && Array.isArray(_annotations)) {
      const ann = _annotations.find(a => a.filename === fn);
      if (ann) {
        if (ann.original_e1_values) {
          return ann.original_e1_values;
        }
        // Fallback: construct from annotation fields
        if (ann.vendor || ann.date || ann.amount != null) {
          return {
            vendor: ann.vendor || null,
            date: ann.date || null,
            amount: ann.amount || null,
            currency: ann.currency || null,
            category: ann.category || null
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function autoFetchE1ForAnnotation(filename) {
  if (!filename) return null;

  const existing = getE1CachedExtraction(filename);
  if (existing) return existing;

  const lockKey = `psa_e1_fetching_${filename}`;
  if (sessionStorage.getItem(lockKey)) return null;
  sessionStorage.setItem(lockKey, '1');

  try {
    const imgRes = await fetch(`/api/receipts/${encodeURIComponent(filename)}`);
    if (!imgRes.ok) throw new Error(`Failed to fetch receipt: ${imgRes.status}`);
    const blob = await imgRes.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const mimeType = blob.type || 'image/jpeg';

    const { apiKey, visionModel } = getSettings();

    const extractRes = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, apiKey, model: visionModel }),
    });
    const data = await extractRes.json();
    if (data.error) throw new Error(data.error);

    sessionStorage.setItem(`psa_e1_auto_${filename}`, JSON.stringify(data.extraction));
    return data.extraction;
  } catch (e) {
    console.warn('autoFetchE1 failed:', e.message);
    return null;
  } finally {
    sessionStorage.removeItem(lockKey);
  }
}

function loadAnnotation() {
  const filename = document.getElementById('ann-file').value;
  updateAnnCounter();
  showResult('ann-result', '');

  if (!filename) {
    showAnnPreview(null);
    showAnnStatus(null);
    ['ann-vendor', 'ann-date', 'ann-amount', 'ann-currency', 'ann-reason', 'ann-notes',
     'ann-points-payment', 'ann-points-earned', 'ann-gift-card-payment', 'ann-other-virtual-payment']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('ann-category').value = 'other';
    document.getElementById('ann-verdict').value = 'justified';
    document.getElementById('ann-ambiguous').checked = false;
    return;
  }

  showAnnPreview(filename);

  const ann = _annotations.find(a => a.filename === filename);
  if (ann && ann.status !== 'skipped' && ann.skipped !== true) {
    showAnnStatus('existing', `Existing annotation loaded for ${filename}. Editing will overwrite the saved entry.`);
    document.getElementById('ann-vendor').value = ann.vendor || '';
    document.getElementById('ann-date').value = ann.date || '';
    document.getElementById('ann-amount').value = ann.amount || '';
    document.getElementById('ann-currency').value = ann.currency || '';
    document.getElementById('ann-points-payment').value = ann.points_payment || '';
    document.getElementById('ann-points-earned').value = ann.points_earned || '';
    document.getElementById('ann-gift-card-payment').value = ann.gift_card_payment || '';
    document.getElementById('ann-other-virtual-payment').value = ann.other_virtual_payment || '';
    document.getElementById('ann-category').value = ann.category || 'other';
    document.getElementById('ann-verdict').value = ann.human_verdict || 'justified';
    document.getElementById('ann-reason').value = ann.human_verdict_reason || '';
    document.getElementById('ann-ambiguous').checked = ann.is_ambiguous || false;
    document.getElementById('ann-notes').value = ann.notes || '';
    return;
  }

  if (ann && (ann.status === 'skipped' || ann.skipped === true)) {
    showAnnStatus('existing', `Receipt was marked as skipped. Fill the fields and save to overwrite.`);
  } else {
    showAnnStatus('new', `New annotation. No E1 extraction cached — fill the fields manually from the receipt preview.`);
  }

  const e1 = getE1CachedExtraction(filename);
  if (e1) {
    if (!ann || (ann.status !== 'skipped' && ann.skipped !== true)) {
      showAnnStatus('new', `New annotation. Fields pre-populated from cached E1 extraction — review and correct as needed.`);
    }
    document.getElementById('ann-vendor').value = e1.vendor || '';
    document.getElementById('ann-date').value = e1.date || '';
    document.getElementById('ann-amount').value = (e1.amount != null && e1.amount !== '') ? e1.amount : '';
    document.getElementById('ann-currency').value = e1.currency || '';
    document.getElementById('ann-points-payment').value = (e1.points_payment != null && e1.points_payment !== '') ? e1.points_payment : '';
    document.getElementById('ann-points-earned').value = (e1.points_earned != null && e1.points_earned !== '') ? e1.points_earned : '';
    document.getElementById('ann-gift-card-payment').value = (e1.gift_card_payment != null && e1.gift_card_payment !== '') ? e1.gift_card_payment : '';
    document.getElementById('ann-other-virtual-payment').value = (e1.other_virtual_payment != null && e1.other_virtual_payment !== '') ? e1.other_virtual_payment : '';
    document.getElementById('ann-category').value = e1.category || 'other';
  } else {
    document.getElementById('ann-vendor').value = '';
    document.getElementById('ann-date').value = '';
    document.getElementById('ann-amount').value = '';
    document.getElementById('ann-currency').value = '';
    document.getElementById('ann-points-payment').value = '';
    document.getElementById('ann-points-earned').value = '';
    document.getElementById('ann-gift-card-payment').value = '';
    document.getElementById('ann-other-virtual-payment').value = '';
    document.getElementById('ann-category').value = 'other';
  }
  document.getElementById('ann-verdict').value = 'justified';
  document.getElementById('ann-reason').value = '';
  document.getElementById('ann-ambiguous').checked = false;
  document.getElementById('ann-notes').value = (ann && ann.notes) || '';
}

async function saveAnnotation() {
  const filename = document.getElementById('ann-file').value;
  if (!filename) {
    return showError('ann-result', 'Select a receipt before saving.');
  }
  const reason = document.getElementById('ann-reason').value.trim();
  if (!reason) {
    return showError('ann-result', 'Verdict Reason is required. State the primary reason in one sentence.');
  }
  const parseAnnFloat = (id) => {
    const val = document.getElementById(id).value;
    if (val === null || val === undefined || val.trim() === '') return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  };
  const e1 = getE1CachedExtraction(filename);
  const entry = {
    filename,
    vendor: document.getElementById('ann-vendor').value || null,
    date: document.getElementById('ann-date').value || null,
    amount: parseAnnFloat('ann-amount'),
    currency: document.getElementById('ann-currency').value || null,
    points_payment: parseAnnFloat('ann-points-payment'),
    points_earned: parseAnnFloat('ann-points-earned'),
    gift_card_payment: parseAnnFloat('ann-gift-card-payment'),
    other_virtual_payment: parseAnnFloat('ann-other-virtual-payment'),
    category: document.getElementById('ann-category').value,
    human_verdict: document.getElementById('ann-verdict').value,
    human_verdict_reason: reason,
    is_ambiguous: document.getElementById('ann-ambiguous').checked,
    notes: document.getElementById('ann-notes').value || '',
    original_e1_values: e1 ? {
      vendor: e1.vendor || null,
      date: e1.date || null,
      amount: e1.amount || null,
      currency: e1.currency || null,
      points_payment: e1.points_payment || null,
      points_earned: e1.points_earned || null,
      gift_card_payment: e1.gift_card_payment || null,
      other_virtual_payment: e1.other_virtual_payment || null,
      category: e1.category || null
    } : null
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
    showAnnStatus('existing', `Saved annotation for ${filename}. Re-edit anytime to update.`);
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
    this.set(experimentId, entry)
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

  _getSingleMap() {
    try {
      const raw = sessionStorage.getItem('psa_single_results')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  },

  _saveSingleMap(map) {
    try {
      sessionStorage.setItem('psa_single_results', JSON.stringify(map))
    } catch (e) {
      console.warn('sessionStorage quota exceeded for single results', e.message)
    }
  },

  set(prefix, data) {
    const map = this._getSingleMap()
    map[prefix] = { ...data, timestamp: new Date().toISOString() }
    this._saveSingleMap(map)
  },

  get(prefix) {
    return this._getSingleMap()[prefix] || null
  },
}

// ─── Policy Meta Store (localStorage-backed) ───────────────────────────────

const PolicyMetaStore = {
  _KEY: 'psa_policy_meta',

  _read() {
    try {
      const raw = localStorage.getItem(this._KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  },

  _write(map) {
    try {
      localStorage.setItem(this._KEY, JSON.stringify(map))
    } catch (e) {
      console.warn('localStorage quota exceeded for policy meta', e.message)
    }
  },

  getMeta(policyName) {
    const all = this._read()
    return all[policyName] || null
  },

  recordSave(policyName) {
    const all = this._read()
    const prev = all[policyName]
    all[policyName] = {
      version: prev ? PolicyMetaStore._bumpVersion(prev.version) : 'v1.0',
      updatedAt: new Date().toISOString(),
    }
    this._write(all)
    return all[policyName]
  },

  resetMeta(policyName) {
    const all = this._read()
    delete all[policyName]
    this._write(all)
  },

  _bumpVersion(prev) {
    const m = /^v(\d+)\.(\d+)$/.exec(prev || 'v1.0')
    if (!m) return 'v1.0'
    return `v${m[1]}.${parseInt(m[2], 10) + 1}`
  },
}

function policyRunCount(policyName) {
  const all = (typeof ResultsStore !== 'undefined' && ResultsStore.getAllResults) ? ResultsStore.getAllResults() : []
  let count = 0
  for (const r of all) {
    if (r.config && r.config.policy === policyName) {
      count += 1
      continue
    }
    if (r.result && Array.isArray(r.result.policies)) {
      for (const p of r.result.policies) {
        if (p && p.policy === policyName) count += 1
      }
    }
  }
  return count
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

// ─── Status Card ────────────────────────────────────────────────────────
function setExperimentState(prefix, state) {
  const statusCard = document.getElementById(`${prefix}-status-card`)
  const icon = document.getElementById(`${prefix}-status-icon`)
  const title = document.getElementById(`${prefix}-status-title`)
  const desc = document.getElementById(`${prefix}-status-desc`)
  const btn = document.getElementById(`${prefix}-btn`)
  const resultEl = document.getElementById(`${prefix}-result`)

  const copyBtn = document.querySelector(`[onclick="copyResultAsJSON('${prefix}')"]`)
  const origCopyLabel = 'Copy JSON'
  if (copyBtn && copyBtn.textContent.trim() !== origCopyLabel) copyBtn.textContent = origCopyLabel

  if (!statusCard) return
  statusCard.classList.remove('status-card--ready', 'status-card--running', 'status-card--error')

  const readyMap = {
    e1: { title: 'Baseline Complete', desc: 'Upload a receipt file to start the baseline OCR extraction experiment.' },
    e2: { title: 'Ready to Run', desc: 'Upload a receipt file and select the required policy variant and project phase to begin the direct policy reasoning baseline experiment.' },
    e3: { title: 'Ready to Run', desc: 'Upload a receipt file and select the required policy variant and project phase to begin the structured reasoning evaluation experiment.' },
    e4: { title: 'Ready to Run', desc: 'Upload a receipt file and select the required policy variant to test across all project phases.' },
    e5: { title: 'Ready to Run', desc: 'Upload a receipt file and select the required policy variant and project phase to begin the ambiguity and uncertainty handling experiment.' },
    e6: { title: 'Ready to Run', desc: 'Upload a receipt file and select the required project phase to run the adversarial test across all 3 policy variants.' },
  }
  const completeMap = {
    e1: { title: 'Extraction Complete', desc: 'Structured accounting data has been successfully extracted.' },
    e2: { title: 'Experiment Complete', desc: 'Direct policy reasoning baseline successfully executed.' },
    e3: { title: 'Structured Reasoning Complete', desc: 'The transaction has been evaluated using a structured, policy-grounded reasoning process.' },
    e4: { title: 'Context Evaluation Complete', desc: 'The transaction has been evaluated across every defined project phase and the context-sensitive results have been recorded.' },
    e5: { title: 'Ambiguity Analysis Complete', desc: 'The transaction has been evaluated for ambiguity, missing evidence and confidence appropriateness.' },
    e6: { title: 'Policy Stress Test Complete', desc: 'The transaction has been evaluated against the clear, vague and contradictory policy variants, and the comparative results have been recorded.' },
  }

  if (state === 'running') {
    statusCard.classList.add('status-card--running')
    if (title) title.textContent = 'Running…'
    if (desc) desc.textContent = 'The experiment is currently executing.'
    if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>'
    if (btn) setLoading(btn.id, true)
    if (resultEl) resultEl.innerHTML = ''
  } else if (state === 'complete') {
    const m = completeMap[prefix] || { title: 'Complete', desc: 'The experiment completed successfully.' }
    if (title) title.textContent = m.title
    if (desc) desc.textContent = m.desc
    if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    if (btn) setLoading(btn.id, false)
  } else if (state === 'error') {
    statusCard.classList.add('status-card--error')
    if (title) title.textContent = 'Error'
    if (desc) desc.textContent = 'The experiment failed. Check the error message below.'
    if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    if (btn) setLoading(btn.id, false)
  } else {
    statusCard.classList.add('status-card--ready')
    const m = readyMap[prefix] || { title: 'Ready to Run', desc: 'Upload a receipt file to begin.' }
    if (title) title.textContent = m.title
    if (desc) desc.textContent = m.desc
    if (icon) icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    if (btn) setLoading(btn.id, false)
  }
}

// ─── Result Actions ──────────────────────────────────────────────────────
async function copyResultAsJSON(prefix) {
  const data = ResultsStore.get(prefix)
  if (!data) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    const btn = document.querySelector(`[onclick*="copyResultAsJSON('${prefix}')"]`)
    if (btn) {
      const orig = btn.textContent
      btn.textContent = 'Copied!'
      setTimeout(() => { btn.textContent = orig }, 2000)
    }
  } catch (e) { console.error('Copy failed:', e) }
}

function viewRawResponse(prefix) {
  const data = ResultsStore.get(prefix)
  if (!data) return
  showModal('Raw Model Response', `<pre class="text-xs font-mono bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">${escHtml(JSON.stringify(data, null, 2))}</pre>`)
}

function showRawResponse(prefix) {
  viewRawResponse(prefix)
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

const hideModal = closeModal
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
  if (tabName === 'e1') return showModal('E1: OCR Extraction Baseline — Research Design', RD_CONTENT_E1)
  if (tabName === 'e1-example') return showModal('E1: OCR Extraction Baseline — Practical Example', PE_CONTENT_E1)
  if (tabName === 'e2') return showModal('E2: Direct Policy Reasoning Baseline — Research Design', RD_CONTENT_E2)
  if (tabName === 'e2-example') return showModal('E2: Direct Policy Reasoning Baseline — Practical Example', PE_CONTENT_E2)
  if (tabName === 'e3') return showModal('E3: Structured Reasoning Evaluation — Research Design', RD_CONTENT_E3)
  if (tabName === 'e3-example') return showModal('E3: Structured Reasoning Evaluation — Practical Example', PE_CONTENT_E3)
  if (tabName === 'e4') return showModal('E4: Context-Sensitive Reasoning — Research Design', RD_CONTENT_E4)
  if (tabName === 'e4-example') return showModal('E4: Context-Sensitive Reasoning — Practical Example', PE_CONTENT_E4)
  if (tabName === 'e5') return showModal('E5: Ambiguity & Uncertainty Handling — Research Design', RD_CONTENT_E5)
  if (tabName === 'e5-example') return showModal('E5: Ambiguity & Uncertainty Handling — Practical Example', PE_CONTENT_E5)
  if (tabName === 'e6') return showModal('E6: Adversarial Policy Stress Test — Research Design', RD_CONTENT_E6)
  if (tabName === 'e6-example') return showModal('E6: Adversarial Policy Stress Test — Practical Example', PE_CONTENT_E6)
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
window.APP.showReceiptViewer = showReceiptViewer
window.APP.setExperimentState = setExperimentState
window.APP.copyResultAsJSON = copyResultAsJSON
window.APP.viewRawResponse = viewRawResponse
window.APP.showRawResponse = showRawResponse

window.showRawResponse = showRawResponse
window.copyResultAsJSON = copyResultAsJSON
window.exportResultAsJSON = exportResultAsJSON
window.exportResultAsCSV = exportResultAsCSV

// ─── Modal Content Constants ──────────────────────────────────────────────
// Research Design modal content for each experiment (E1–E6), Ground Truth, Policy Editor, and Research Configuration

const RD_CONTENT_E1 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determine whether a multimodal large language model can accurately transform heterogeneous financial documents into structured accounting data suitable for downstream compliance reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Real-world financial documents vary significantly in layout, language, image quality, lighting conditions, document damage and formatting. It is uncertain whether a multimodal large language model can consistently extract accounting-relevant information with sufficient accuracy for automated compliance reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A multimodal large language model can accurately extract structured accounting fields from diverse financial documents with sufficient precision to support automated compliance reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Experimental Design</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Each receipt is processed using a single extraction pipeline without manual intervention. The extracted accounting fields are compared against manually prepared ground-truth annotations. Extraction performance is independently evaluated for each accounting field.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Metrics</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The following structured accounting fields are evaluated: Vendor, Transaction Date, Amount, Currency, Expense Category, Line Items. Performance is measured using field-level extraction accuracy.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment should demonstrate measurable extraction accuracy across each accounting field and identify which fields are sufficiently reliable for downstream semantic reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This experiment establishes the data quality baseline upon which every subsequent reasoning experiment depends.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">None. This experiment represents Layer 1 of the Compliance Intelligence Engine.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E1 transforms unstructured financial documents into structured accounting information. The structured output produced by this experiment becomes the input for all downstream policy grounding, semantic reasoning and compliance decision experiments.</p>
  </div>
`

const PE_CONTENT_E1 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The user uploads a receipt. The engine analyses the document using a multimodal large language model. Structured accounting fields are extracted. Any field that cannot be read with sufficient confidence is returned as null rather than inferred. The structured accounting data is passed to the Compliance Intelligence Engine. Downstream reasoning experiments evaluate policy compliance using the extracted information.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The extracted accounting fields match the manually verified receipt data with sufficient accuracy to support downstream compliance reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The engine invents unreadable values, incorrectly extracts material accounting fields or produces structured data that cannot be relied upon for downstream reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Every downstream reasoning experiment assumes that the accounting data is accurate. If receipt extraction is unreliable, the reasoning engine cannot produce reliable compliance decisions regardless of the quality of the reasoning model.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Layer 1 — Document Understanding. Receipt → OCR Extraction → Structured Accounting Data → Policy Grounding → Semantic Reasoning → Compliance Decision.</p>
  </div>
`

const RD_CONTENT_E2 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determine whether a large language model can reliably apply organisational expense policy to structured accounting data without an explicit reasoning framework.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A large language model may be able to identify obvious policy relationships from transaction data and policy text, but it is uncertain whether direct prompting alone can produce consistent, well-grounded and sufficiently justified compliance decisions. The model may rely on surface-level language matching, overlook qualifying conditions, provide unsupported conclusions or express confidence where the available information is insufficient.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Without structured reasoning guidance, the model will produce lower-quality compliance verdicts, weaker policy justification and less consistent agreement with expert human assessment than the structured reasoning approach tested in E3.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Experimental Design</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Each transaction is evaluated using the structured accounting data produced by E1 together with the selected organisational policy variant and project phase. The model receives a single-turn instruction requiring it to return a compliance verdict and a concise reason supporting the verdict. The prompt does not instruct the model to reason step by step, identify the relevant policy clause, assess contextual factors separately or perform an information-sufficiency check. The model output is compared against the expected assessment and the results produced by E3 using the same transaction, policy variant and project phase.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Metrics</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment evaluates: Verdict accuracy, agreement with expert human assessment, consistency across repeated evaluations, relevance of the stated reason, correct use of the available policy, frequency of unsupported conclusions, frequency of inappropriate certainty.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment should produce a measurable baseline showing the level of policy interpretation that can be achieved without a structured reasoning process. The results should identify whether direct prompting is sufficient for simple cases and where it becomes unreliable when policy conditions, context or ambiguity require deeper reasoning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E2 provides the control condition for the reasoning research programme. Without this baseline, it would not be possible to determine whether the structured reasoning framework introduced in E3 produces a genuine improvement in decision quality, policy grounding and auditability.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E2 depends on the structured accounting data produced by E1. E3 applies a structured reasoning framework to the same policy and transaction inputs so that the results can be compared directly.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E2 measures the minimum reasoning capability of the engine when policy interpretation is performed without a guided reasoning process. It establishes the baseline against which all later reasoning improvements are evaluated.</p>
  </div>
`

const PE_CONTENT_E2 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The user uploads a receipt. E1 converts the receipt into structured accounting data. The user selects a policy variant. The user selects a project phase. The structured transaction data, selected policy and selected phase are presented to the model. The model returns a direct verdict and a concise reason. No structured reasoning sequence is imposed on the model. The result is recorded as the direct policy reasoning baseline. The result is compared with E3 to determine whether structured reasoning improves the outcome.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model produces the correct verdict and gives a concise reason that is supported by the selected policy, project phase and available transaction data.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model overlooks a material policy condition, relies on superficial keyword matching, produces an unsupported verdict or expresses certainty where the available evidence is insufficient.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A direct model response may appear efficient and convincing while concealing weak reasoning. E2 determines whether unaided policy interpretation is dependable enough for compliance use and establishes the performance level that the structured reasoning approach must improve upon.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Layer 1 — Document Understanding: Receipt → OCR Extraction → Structured Accounting Data. Layer 2 — Policy Grounding: Selected Policy Variant + Selected Project Phase + Structured Accounting Data. Layer 3 — Direct Reasoning and Verdict: Direct Policy Evaluation → Verdict + Concise Reason → Baseline Result for Comparison with E3.</p>
  </div>
`

const RD_CONTENT_E3 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determine whether a structured reasoning framework improves the model’s ability to interpret organisational policy, apply relevant conditions and produce reliable compliance decisions.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">It is uncertain whether requiring a large language model to follow an explicit reasoning structure will materially improve compliance decision quality when compared with direct prompting. The model may still misidentify the expense type, select an irrelevant policy clause, overlook qualifying conditions, produce unsupported reasoning or generate a plausible explanation that does not accurately support the final verdict.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A structured reasoning framework will improve verdict accuracy, policy grounding, explanation quality and agreement with expert human assessment when compared with the direct policy reasoning baseline established in E2.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Experimental Design</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Each transaction is evaluated using the same structured accounting data and organisational policy used in E2. The model is instructed to follow a defined reasoning sequence: Identify the expense type. Identify the applicable policy clause or condition. Assess whether the transaction satisfies the policy requirements. Identify ambiguity, missing information or conflicting evidence. Produce a final compliance verdict supported by a concise justification. The output is compared directly with E2 using the same transaction and policy inputs.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Metrics</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment evaluates: Verdict accuracy, agreement with expert human assessment, correct identification of the expense type, correct selection of the applicable policy clause, correct application of policy conditions, relevance and completeness of the justification, consistency across repeated evaluations, frequency of unsupported conclusions, frequency of omitted ambiguities or missing information, improvement over the E2 direct policy reasoning baseline.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment should demonstrate whether structured reasoning produces measurable improvements in policy interpretation, verdict accuracy, consistency and explanation quality. The results should also identify whether the structured process reduces unsupported conclusions and makes the basis of each compliance decision easier to inspect and audit.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E3 introduces the structured reasoning approach that subsequent experiments E4, E5 and E6 build upon. It determines whether requiring the model to follow an explicit reasoning process materially improves compliance decision quality and auditability.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E3 depends on the structured accounting data produced by E1. E3 uses the same transaction and policy inputs as E2 so that direct and structured reasoning outcomes can be compared under controlled conditions. E4, E5 and E6 extend the structured reasoning approach by testing contextual sensitivity, uncertainty recognition and policy robustness.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E3 introduces the engine’s structured policy reasoning capability. It converts extracted accounting data and policy text into an auditable reasoning process that supports the final compliance verdict.</p>
  </div>
`

const PE_CONTENT_E3 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E1 converts the uploaded receipt into structured accounting data. The structured transaction data is presented to the model together with the applicable organisational policy. The model identifies the expense type. The model identifies the relevant policy clause or condition. The model evaluates whether the transaction satisfies the policy requirements. The model identifies ambiguity, missing information or conflicting evidence. The model produces a compliance verdict supported by a structured justification. The result is compared with E2 to determine whether structured reasoning improves the outcome.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model identifies the correct expense type and policy clause, applies the relevant conditions correctly, explains the basis of the decision and produces a verdict consistent with expert review.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model selects an irrelevant policy clause, overlooks a material condition, presents reasoning that does not support the verdict or produces an explanation that appears structured but is factually or logically unsound.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A compliance decision must be more than a plausible answer. The reviewer must be able to understand which policy was applied, how the evidence was assessed and why the final conclusion was reached. E3 determines whether structured reasoning improves both decision quality and auditability.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Layer 1 — Document Understanding: Receipt → OCR Extraction → Structured Accounting Data. Layer 2 — Policy Grounding: Policy Text + Structured Accounting Data → Applicable Policy Clause and Conditions. Layer 3 — Structured Reasoning and Verdict: Expense Identification → Policy Application → Verdict with Justification.</p>
  </div>
`

const RD_CONTENT_E4 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determine whether a large language model can correctly interpret an identical accounting transaction differently when the relevant project phase changes.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A transaction may be allowable in one project phase and inappropriate in another even when the receipt, supplier, amount and expense category remain unchanged. It is uncertain whether the model can correctly incorporate project context into its policy interpretation or whether it will rely mainly on surface-level transaction attributes and return the same verdict for every phase.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A semantically grounded reasoning model will produce different compliance outcomes for the same transaction when the applicable project phase changes and the organisational policy requires different treatment in each phase.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Experimental Design</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The same structured transaction data produced by E1 is evaluated against the selected organisational policy across all defined project phases: Phase 1 — Infrastructure Setup, Phase 2 — Experimentation, Phase 3 — Evaluation and Documentation. The receipt data, supplier, amount, currency, expense category and selected policy remain unchanged across all evaluations. Only the project phase changes. For each phase, the model must identify the relevant expense type, identify the applicable policy clause or condition, evaluate whether the expense is appropriate for that project phase, and identify ambiguity, missing information or conflicting evidence.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Metrics</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment evaluates: Correct identification of the applicable project phase, correct interpretation of phase-specific policy conditions, appropriateness of verdict changes across phases, agreement with expert human assessment, relevance of the stated justification, consistency across repeated evaluations, frequency of unchanged verdicts where context should alter the result, frequency of changed verdicts where context should not alter the result.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment should demonstrate whether the model can distinguish between otherwise identical transactions by applying phase-specific policy conditions. Successful context-sensitive reasoning will be evidenced where the model changes its verdict only when the policy and project phase require a different outcome.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E4 determines whether the engine can reason beyond the visible contents of a receipt. A reliable compliance system must understand that business justification can depend on project stage, operational purpose and timing, rather than only on supplier, amount or expense category.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E4 depends on the structured accounting data produced by E1, the policy reasoning baseline established in E2, and the structured reasoning method evaluated in E3. E4 applies the same transaction and selected policy across every project phase so that context remains the controlled variable.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E4 validates the engine’s ability to combine structured transaction data, organisational policy and changing operational context when producing compliance decisions. It tests whether the engine is performing context-sensitive semantic reasoning rather than static rule matching.</p>
  </div>
`

const PE_CONTENT_E4 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E1 converts the uploaded receipt into structured accounting data. The reviewer selects the required policy variant. The same transaction is automatically evaluated under every project phase. The engine identifies whether the expense is appropriate for each phase. A separate verdict and reason are produced for each phase. The phase outcomes are presented together for comparison. The system records whether the verdict changed appropriately as the context changed.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The engine produces different verdicts where the policy requires different treatment across project phases and clearly explains the contextual condition supporting each outcome.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The engine returns the same verdict for every phase despite material policy differences, changes its verdict without policy support, or ignores the project context.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Real-world compliance decisions cannot always be made from transaction data alone. The same expense may be appropriate, premature, excessive or no longer necessary depending on when and why it was incurred. E4 establishes whether the engine can use changing business context as part of its reasoning rather than treating every transaction as an isolated document.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Layer 1 — Document Understanding: Receipt → OCR Extraction → Structured Accounting Data. Layer 2 — Policy Grounding and Context: Selected Policy + Structured Accounting Data → Automatic Evaluation Across All Project Phases. Layer 3 — Context-Sensitive Reasoning and Verdict: Phase-Specific Policy Application → Phase-Specific Verdict and Reason.</p>
  </div>
`

const RD_CONTENT_E5 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determine whether a large language model can recognise when available transaction evidence is insufficient, ambiguous or internally inconsistent and respond with an appropriately qualified compliance assessment.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A model may produce a confident and plausible answer even when the receipt, policy or contextual information does not support a reliable conclusion. It is uncertain whether the model can distinguish genuine ambiguity from ordinary variation, identify missing or conflicting evidence, lower its confidence appropriately, avoid inventing facts to complete the assessment, and recommend a proportionate next step rather than forcing approval or rejection.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A structured uncertainty-handling framework will increase the frequency of appropriately qualified verdicts, improve identification of missing information and reduce unsupported confidence when compared with direct or purely structured reasoning without an explicit ambiguity check.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Experimental Design</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model receives structured accounting data extracted from the uploaded receipt, the selected organisational policy variant, and the selected project phase. The model is instructed to assess the sufficiency and clarity of the available evidence before producing a final verdict. The model must identify the expense type, identify the applicable policy clause or condition, assess the transaction against the selected project phase, identify ambiguity, missing information or conflicting evidence, determine whether a reliable verdict is possible, assign an appropriate confidence level, recommend the next action, and produce a final compliance verdict only where the available evidence supports it.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Metrics</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment evaluates: Correct identification of ambiguity, correct identification of missing information, appropriate use of an unclear or insufficient-evidence verdict, calibration of confidence level, frequency of unsupported confident verdicts, frequency of invented or assumed facts, relevance of the recommended next action, agreement with expert human assessment, consistency across repeated evaluations, improvement over E2 and E3 where uncertainty is material.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment should demonstrate whether the model can distinguish between a transaction that is clearly compliant, clearly non-compliant, or cannot be reliably assessed from the available evidence. Successful evidence will show that the model identifies the exact source of uncertainty, lowers confidence appropriately and requests the minimum additional information required to resolve the matter.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A compliance system must know when it does not know. A model that produces confident answers in ambiguous situations creates audit, governance and decision-making risk. E5 tests whether the engine can treat uncertainty as a formal outcome rather than as a failure to answer.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E5 depends on the structured accounting data produced by E1, the direct policy baseline established in E2, the structured reasoning method established in E3, and the contextual reasoning capability tested in E4. E5 adds an explicit evidence-sufficiency and uncertainty assessment before the final verdict.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E5 introduces the engine’s uncertainty-control layer. It enables the engine to identify when a compliance decision should be deferred, qualified or escalated because the available evidence is incomplete, ambiguous or contradictory.</p>
  </div>
`

const PE_CONTENT_E5 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E1 converts the uploaded receipt into structured accounting data. The transaction is presented with the selected policy and project phase. The engine identifies the relevant expense type and policy condition. The engine checks whether the receipt and context provide sufficient evidence. Any missing, unclear or conflicting information is recorded. The engine assigns a confidence level. The engine determines whether it can produce a reliable verdict. Where evidence is insufficient, the engine returns an unclear or insufficient-evidence result and recommends the next action.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model identifies the specific ambiguity, explains why the available evidence is insufficient, assigns an appropriate confidence level and recommends obtaining the missing evidence before making a final decision.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model assumes facts not present in the receipt, forces a justified or suspicious verdict, expresses excessive confidence or fails to identify the evidence required to resolve the ambiguity.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Ambiguity is common in real financial documents. Abbreviated supplier descriptions, incomplete receipts, unclear business purpose and conflicting contextual information can make a reliable decision impossible. E5 determines whether the engine can prevent false certainty and route genuinely uncertain cases for appropriate human or documentary review.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Layer 1 — Document Understanding: Receipt → OCR Extraction → Structured Accounting Data. Layer 2 — Policy and Context Grounding: Policy Text + Structured Accounting Data + Project Phase → Applicable Policy Conditions. Layer 3 — Structured Reasoning with Uncertainty Check: Evidence Sufficiency Assessment → Verdict or Deferred Outcome with Confidence and Recommended Next Action.</p>
  </div>
`

const RD_CONTENT_E6 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determine whether a large language model can reliably distinguish between clear, vague and contradictory organisational policies and adjust its compliance verdict, confidence and explanation appropriately.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A language model may produce convincing compliance decisions even where the governing policy is incomplete, vague or internally contradictory. It is uncertain whether the model can accurately identify policy-quality problems before applying the policy, or whether it will resolve ambiguity by inventing assumptions, ignoring contradictions or forcing a confident verdict. It is also uncertain whether the model’s assessment of policy clarity will remain consistent across repeated evaluations.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A reliable policy-reasoning model will produce a stable and well-grounded verdict under the clear policy, express reduced confidence and identify missing guidance under the vague policy, and identify conflicting requirements and avoid a forced verdict under the contradictory policy. The model should not treat all three policy variants as equally clear or produce materially identical reasoning across them.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Experimental Design</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The same structured transaction data and selected project phase are evaluated against three policy variants: Clear policy, Vague policy, and Contradictory policy. The receipt, supplier, amount, expense category and project phase remain unchanged. Only the policy wording changes. For each policy variant, the model must assess the clarity and internal consistency of the policy, identify the applicable policy clause or condition, determine whether sufficient information exists to reach a compliance decision, produce a verdict or explicitly state that a reliable verdict cannot be reached, provide a confidence score, and explain the basis of the outcome. The three outputs are compared side by side.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Metrics</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment evaluates: Correct classification of policy clarity, correct identification of vague or missing policy guidance, correct identification of contradictory clauses, verdict accuracy under the clear policy, appropriate reduction in confidence under vague or contradictory policies, frequency of forced verdicts where no reliable verdict is possible, frequency of invented clauses, facts or assumptions, consistency across repeated evaluations, agreement with expert human assessment, difference in reasoning quality across policy variants.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The experiment should demonstrate whether the model’s reasoning changes appropriately when policy quality deteriorates. Successful evidence will show that the model treats clear, vague and contradictory policies differently, identifies the limitations of the available policy and avoids presenting unsupported conclusions as reliable compliance decisions.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E6 tests the robustness of the Compliance Intelligence Engine under deliberately adverse policy conditions. Real organisational policies are not always clear, complete or internally consistent. A reliable compliance system must identify those defects instead of silently converting them into confident but unsupported decisions.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E6 depends on the structured accounting data produced by E1, the policy reasoning baseline established in E2, the structured reasoning method established in E3, the context-sensitive reasoning tested in E4, and the uncertainty-handling capability tested in E5. E6 combines these capabilities in a comparative stress test across policy variants.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E6 validates the engine’s ability to assess the reliability of the governing policy before relying on it. It introduces policy-quality diagnostics, contradictory-policy detection and hallucination-risk indicators into the compliance reasoning workflow.</p>
  </div>
`

const PE_CONTENT_E6 = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">E1 converts the uploaded receipt into structured accounting data. The user selects the applicable project phase. The same transaction is evaluated against the clear policy, the vague policy, and the contradictory policy. The model assesses policy clarity for each variant. The model produces a verdict, confidence score and reason for each variant. The three results are displayed side by side. Reliability warnings appear where the model misreads policy clarity or produces unsupported certainty.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model applies the clear policy correctly, identifies the vague policy as insufficiently precise, identifies the contradictory policy as internally inconsistent, reduces confidence where appropriate, avoids inventing policy requirements, and avoids forcing a compliance verdict where the policy cannot support one.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The model treats all three policies as equally clear, produces the same verdict and confidence for every policy variant, ignores contradictory clauses, invents missing approval conditions, produces a confident verdict without adequate policy support, or misclassifies vague or contradictory policy as clear.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A compliance system can be dangerous if it produces confident answers from defective policy. E6 determines whether the engine can recognise when the governing rules themselves are unreliable and communicate that limitation to reviewers before a decision is accepted.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Layer 1 — Document Understanding: Receipt → OCR Extraction → Structured Accounting Data. Layer 2 — Context and Policy Inputs: Structured Accounting Data + Project Phase → Clear Policy / Vague Policy / Contradictory Policy. Layer 3 — Adversarial Policy Evaluation: Policy-Clarity Assessment → Clause and Conflict Identification → Verdict or Insufficient-Policy Outcome with Confidence and Supporting Reason.</p>
  </div>
`

const RD_CONTENT_GT = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Create a reliable human-reviewed reference dataset against which model extraction and compliance-reasoning outputs can be evaluated.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Human annotations may be inconsistent where source documents are unclear, policy terms are ambiguous or reviewers interpret evidence differently. It is therefore uncertain whether a single annotation is sufficient for all cases and whether disagreement between reasonable reviewers must be recorded as part of the dataset.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A structured annotation process that records corrected transaction data, human verdicts, reasons and ambiguity indicators will produce a sufficiently reliable benchmark for evaluating the model across the research programme.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Annotation Method</h4>
    <p class="text-gray-700 text-sm leading-relaxed">For each receipt, the reviewer must: Inspect the source document. Review the fields extracted by E1. Correct any extraction errors. Apply the relevant policy and context. Assign a human verdict. Record the principal reason. Identify ambiguity where reasonable disagreement may exist. Save the completed annotation with reviewer and timestamp metadata.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Quality Controls</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The annotation process should support: Required verdict reason, prevention of silent overwriting.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Evaluation Use</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The completed ground truth dataset is used to calculate: OCR field accuracy, verdict agreement, false positives, false negatives, ambiguity-recognition performance, hallucination indicators, experiment-to-experiment improvement.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The ground truth dataset should enable reliable comparison between model outputs and human judgement across all experiments, identifying specific areas where the model succeeds or requires improvement.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A model may produce a convincing verdict that is nevertheless wrong. Ground truth annotation provides the trusted reference needed to distinguish genuine model performance from plausible but unsupported output.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This module depends on the structured accounting data produced by E1 and provides the human-reviewed reference for evaluating E2 through E6.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This module provides the trusted human evidence layer required to determine whether the engine's outputs are correct, explainable and reliable.</p>
  </div>
`

const PE_CONTENT_GT = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The reviewer selects a cloud-hosting receipt. The system loads the receipt preview. E1 extraction populates the vendor, date, amount, currency and category. The reviewer corrects any inaccurate fields. The reviewer assesses the expense against the applicable policy and project context. The reviewer selects Justified, Suspicious or Unclear. The reviewer records the primary reason and any ambiguity. The annotation is saved to the ground truth dataset.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The saved annotation accurately represents the source document, the applicable policy and the considered human compliance judgement.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The reviewer cannot see the receipt, extracted values fail to load, an existing annotation is not populated, required reasoning is omitted or the system saves an incomplete result without warning.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A model may produce a convincing verdict that is nevertheless wrong. Ground truth annotation provides the trusted reference needed to distinguish genuine model performance from plausible but unsupported output.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This module provides the trusted human evidence layer required to determine whether the engine's outputs are correct, explainable and reliable across all experiments.</p>
  </div>
`

const RD_CONTENT_PE = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Objective</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Create a controlled, versioned policy dataset that allows the model's compliance reasoning to be evaluated under clear, vague and contradictory policy conditions.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Technical Uncertainty</h4>
    <p class="text-gray-700 text-sm leading-relaxed">It is uncertain whether policy wording quality materially changes the model's ability to identify applicable rules, calibrate confidence, recognise ambiguity and avoid unsupported conclusions. It is also uncertain whether experiment results remain reproducible when policies are edited without version control or immutable policy snapshots.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Hypothesis</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A versioned policy-control process using deliberately designed clear, vague and contradictory variants will provide stable experimental inputs and allow meaningful comparison of model behaviour under changing policy quality.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Policy Design Method</h4>
    <p class="text-gray-700 text-sm leading-relaxed">For each policy variant, the researcher must: Define the project scope. Define the three project phases. Define Allowed, Restricted and Forbidden rules for each phase. Define thresholds and approval conditions where applicable. Control ambiguity and contradiction according to the policy variant. Assign rule identifiers. Save the policy as a versioned research input. Link every experiment run to the exact policy version used.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Quality Controls</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The policy-control process should support: Required reason for change.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Expected Evidence</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A versioned policy-control process ensures that measured differences in model behaviour can be attributed to the experiment rather than accidental changes in the governing rules.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Research Significance</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The compliance reasoning experiments cannot be evaluated unless the policy inputs are controlled, traceable and reproducible.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Dependencies</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This module supplies policy inputs to E2, E3, E4, E5 and E6.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Compliance Intelligence Engine</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This module provides the controlled policy evidence layer required to test whether the engine can reason reliably when organisational rules vary in clarity, completeness and internal consistency.</p>
  </div>
`

const PE_CONTENT_PE = `
  <div>
    <h4 class="font-semibold text-sm mb-1">What Happens</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The researcher selects Clear Policy. The latest saved version loads. The researcher updates a Phase 2 software-subscription rule. The system identifies unsaved changes. The researcher enters a reason for change. The researcher selects Save Policy. The system validates the policy. A new version is created. Future experiment runs use the new policy version. Earlier experiment runs remain linked to the previous version.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Success</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The new policy version is validated, saved, timestamped and linked only to future experiment runs. The previous version remains available and all earlier results remain reproducible.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Practical Failure</h4>
    <p class="text-gray-700 text-sm leading-relaxed">The current policy is silently overwritten, previous results lose their original policy reference, the user is not warned about unsaved changes, or a destructive action removes research history.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A compliance experiment can appear valid while using different policy inputs across runs. The Policy Editor ensures that policy changes are controlled, visible and reproducible so that measured differences in model behaviour can be attributed to the experiment rather than accidental changes in the governing rules.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Role within the Complete Research Programme</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This module provides the controlled policy inputs required for experiments E2 through E6. Versioned policy control ensures that every experiment run remains traceable to the exact policy used at execution time.</p>
  </div>
`

const RD_CONTENT_ST = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Purpose</h4>
    <p class="text-gray-700 text-sm leading-relaxed">This page defines the technical configuration used to execute and compare the research experiments. Changes may affect future experiment outputs and must be controlled to preserve reproducibility.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">OpenRouter API Key</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Authenticates requests to the selected model provider. The key is masked, is not included in exported experiment data and must not appear in logs or error messages.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Vision Model — Layer 1</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Defines the model used for OCR and document understanding in E1. Changing this setting may alter the structured data supplied to later experiments.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Reasoning Model — Layer 3</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Defines the model used for policy reasoning and verdict generation in E2–E6. Changing this setting allows model-to-model comparison but also changes the experimental condition.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Currency Override</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Determines whether prompts use the receipt currency or a forced AUD, USD or EUR value. The selected treatment is recorded with each affected run.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Save Settings</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Stores the active research configuration for future runs and creates a traceable configuration version.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Test Connection</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Checks whether the API key, provider and selected model configuration are reachable.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Export Experiment Results</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Exports retained E1–E6 run data and supporting research metadata as JSON. Authentication secrets are excluded.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Delete All Data</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Permanently deletes saved E1–E6 outputs and ground-truth annotations only after explicit confirmation. It does not delete policies, settings or API credentials.</p>
  </div>
`

const PE_CONTENT_ST = `
  <div>
    <h4 class="font-semibold text-sm mb-1">Why This Matters</h4>
    <p class="text-gray-700 text-sm leading-relaxed">A research result is not reproducible unless the exact technical configuration used to generate it is known. This page ensures that model choice, provider connection and currency treatment are treated as controlled research inputs rather than informal application preferences.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Core Research-Control Principle</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Configuration changes apply only to future experiment runs. Every experiment result must record the vision model, reasoning model, model provider, currency treatment, configuration version or snapshot, date and time of execution, and experiment run identifier. Existing experiment results must remain linked to their original configuration even after the active settings are changed.</p>
  </div>
  <div>
    <h4 class="font-semibold text-sm mb-1">Data Requirements</h4>
    <p class="text-gray-700 text-sm leading-relaxed">Each saved configuration should include at least: Configuration identifier, configuration version, provider name, vision model, reasoning model, currency treatment, connection-test status, saved by, saved timestamp, and status. The API key itself must not be included in exported configuration metadata.</p>
  </div>
`

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

    updatePolicyStatusSummary(name, 'Saved')

    const container = document.getElementById('pe-phases')
    container.innerHTML = policy.phases.map((phase, i) => `
      <details class="border border-gray-200 rounded-lg mb-4" ${i === 0 ? 'open' : ''}>
        <summary class="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50">Phase ${i + 1}: ${escHtml(phase.name)}</summary>
        <div class="px-4 py-3 border-t border-gray-200 space-y-3">
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
      </details>
    `).join('')
  } catch (e) {
    showError('pe-result', `Failed to load policy: ${e.message}`)
  }
}

function updatePolicyStatusSummary(policyName, statusText) {
  const meta = PolicyMetaStore.getMeta(policyName)
  const statusEl = document.getElementById('pe-status-label')
  const versionEl = document.getElementById('pe-version-label')
  const updatedEl = document.getElementById('pe-updated-label')
  const runsEl = document.getElementById('pe-runs-label')
  if (!statusEl) return
  statusEl.textContent = statusText || 'Saved'
  statusEl.className = statusText === 'Unsaved changes' ? 'font-medium text-orange-600' : 'font-medium text-green-700'
  versionEl.textContent = meta ? meta.version : 'v1.0'
  updatedEl.textContent = meta ? new Date(meta.updatedAt).toLocaleString() : '—'
  runsEl.textContent = String(policyRunCount(policyName))
}

async function savePolicy() {
  const name = document.getElementById('pe-policy').value
  const reasonEl = document.getElementById('pe-change-reason')
  const reason = (reasonEl && reasonEl.value || '').trim()
  if (!reason) {
    showError('pe-result', 'Reason for Change is required. Explain why this policy version is being modified before saving.')
    if (reasonEl) reasonEl.focus()
    return
  }

  const phases = []
  document.querySelectorAll('#pe-phases > details').forEach((phaseEl) => {
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
      PolicyMetaStore.recordSave(name)
      if (reasonEl) reasonEl.value = ''
      updatePolicyStatusSummary(name, 'Saved')
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
  const phases = document.querySelectorAll('#pe-phases > details')
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
    // Clear any locally selected files so the shared receipt takes priority
    document.querySelectorAll('input[type=\"file\"]').forEach(el => el.value = '')
    
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
  const visibleInput = document.querySelector('main input[type="file"]')
  if (visibleInput) visibleInput.click()
})

document.getElementById('receipt-clear-btn')?.addEventListener('click', () => {
  window.APP.state.clearReceipt()
  updateReceiptBar(null)
  document.querySelectorAll('input[type="file"]').forEach(el => el.value = '')
  document.querySelectorAll('.shared-receipt-indicator').forEach(el => el.remove())
  document.querySelectorAll('input[type="file"]').forEach(el => el.classList.remove('opacity-50'))
})

// Per-page auto-initialisation
if (_currentTab === 'annotate') {
  initAnnotate()
} else if (_currentTab === 'policy-editor') {
  setTimeout(loadPolicyEditor, 50)
} else if (_currentTab === 'settings') {
  loadSettings()
}

// Restore state for experiment pages (E1-E6)
if (_currentTab && !['annotate', 'policy-editor', 'settings'].includes(_currentTab)) {
  setTimeout(() => restoreTabState(_currentTab), 10)
}

updateTabRunCounts()

// Restore shared receipt on page load
const savedReceipt = window.APP.state.getReceipt()
if (savedReceipt) {
  updateReceiptBar(savedReceipt)
  setTimeout(() => syncReceiptIndicator(_currentTab), 15)
}

// Automatically sync file input selections to global receipt state
document.querySelectorAll('input[type="file"]').forEach(input => {
  input.addEventListener('change', async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const fileData = { base64, mimeType: file.type || 'image/jpeg', filename: file.name };
    window.APP.state.setReceipt(fileData);
    updateReceiptBar(fileData);
    syncReceiptIndicator(_currentTab);
  });
});
