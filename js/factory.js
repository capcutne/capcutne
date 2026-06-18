/* ============================================================
   BATCH SHORTS FACTORY — js/factory.js
   Phase 2.3: Long video → transcript → viral analysis →
              top shorts → auto subtitle → titles/desc/hashtags
              → batch export dashboard

   Public API:  window.BatchFactory
   ============================================================ */

(function () {

/* ── State ───────────────────────────────────────────────── */
let _batchId    = null;
let _shorts     = [];
let _selected   = new Set();
let _pollTimer  = null;
let _panelOpen  = false;

/* ── Helpers ─────────────────────────────────────────────── */
function _esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _fmt(t) {
  if (typeof fmt === 'function') return fmt(t);
  const s = Math.floor(t), m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function _pct(v) { return Math.round((v || 0) * 100); }
function _scoreColor(v) {
  if (v >= 0.8) return '#27ae60';
  if (v >= 0.6) return '#f39c12';
  return '#e74c3c';
}
function _getEditorState() {
  const state = {};
  if (typeof tracks    !== 'undefined') state.tracks    = tracks;
  if (typeof subtitles !== 'undefined') state.subtitles = subtitles;
  let dur = 0;
  if (typeof tracks !== 'undefined') {
    tracks.forEach(tr => tr.clips.forEach(c => { dur = Math.max(dur, c.start + c.dur); }));
  }
  state.totalDuration = dur;
  const tb = document.querySelector('.tb-name input');
  state.name = tb ? tb.value : 'Project';
  return state;
}

/* ══════════════════════════════════════════════════════════
   PANEL BUILD
   ══════════════════════════════════════════════════════════ */
function _buildPanel() {
  if (document.getElementById('factory-panel')) return;

  const el = document.createElement('div');
  el.id = 'factory-panel';
  el.innerHTML = `
<div class="fac-header">
  <div class="fac-header-left">
    <svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 3l-4 4-4-4"/>
      <line x1="12" y1="11" x2="12" y2="17"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
    <span>Batch Shorts Factory</span>
  </div>
  <button class="fac-close" onclick="BatchFactory.close()">✕</button>
</div>

<!-- Config section -->
<div class="fac-body" id="fac-config">
  <div class="fac-intro">
    Analyze your timeline and automatically generate viral-ready short clips — complete with titles, descriptions, hashtags, and subtitle styling.
  </div>

  <div class="fac-section-label">Number of Shorts</div>
  <div class="fac-pill-row" id="fac-count">
    <button class="fac-pill" data-v="5">5</button>
    <button class="fac-pill on" data-v="10">10</button>
    <button class="fac-pill" data-v="20">20</button>
  </div>

  <div class="fac-section-label" style="margin-top:12px">Subtitle Template</div>
  <div class="fac-pill-row" id="fac-tpl">
    <button class="fac-pill on" data-v="tiktok">TikTok</button>
    <button class="fac-pill" data-v="mrbeast">MrBeast</button>
    <button class="fac-pill" data-v="podcast">Podcast</button>
    <button class="fac-pill" data-v="netflix">Netflix</button>
    <button class="fac-pill" data-v="minimal">Minimal</button>
  </div>

  <!-- Pipeline visualization -->
  <div class="fac-pipeline">
    <div class="fac-pipe-step">
      <div class="fac-pipe-dot">1</div>
      <div class="fac-pipe-lbl">Viral<br>Analysis</div>
    </div>
    <div class="fac-pipe-arrow">›</div>
    <div class="fac-pipe-step">
      <div class="fac-pipe-dot">2</div>
      <div class="fac-pipe-lbl">Top Shorts<br>Selection</div>
    </div>
    <div class="fac-pipe-arrow">›</div>
    <div class="fac-pipe-step">
      <div class="fac-pipe-dot">3</div>
      <div class="fac-pipe-lbl">Titles &<br>Metadata</div>
    </div>
    <div class="fac-pipe-arrow">›</div>
    <div class="fac-pipe-step">
      <div class="fac-pipe-dot">4</div>
      <div class="fac-pipe-lbl">Ready<br>Files</div>
    </div>
  </div>

  <button class="fac-run-btn" id="fac-run-btn" onclick="BatchFactory.run()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 3l-4 4-4-4"/>
    </svg>
    Run Factory
  </button>
</div>

<!-- Progress section -->
<div id="fac-progress" style="display:none;padding:16px">
  <div class="fac-stage-pipeline" id="fac-stage-pipeline">
    <div class="fac-sp-step" id="fsp-1">
      <div class="fac-sp-dot active">1</div>
      <div class="fac-sp-lbl">Analyze</div>
    </div>
    <div class="fac-sp-line"></div>
    <div class="fac-sp-step" id="fsp-2">
      <div class="fac-sp-dot">2</div>
      <div class="fac-sp-lbl">Select</div>
    </div>
    <div class="fac-sp-line"></div>
    <div class="fac-sp-step" id="fsp-3">
      <div class="fac-sp-dot">3</div>
      <div class="fac-sp-lbl">Metadata</div>
    </div>
    <div class="fac-sp-line"></div>
    <div class="fac-sp-step" id="fsp-4">
      <div class="fac-sp-dot">4</div>
      <div class="fac-sp-lbl">Ready</div>
    </div>
  </div>
  <div class="fac-prog-track" style="margin-top:14px">
    <div class="fac-prog-fill" id="fac-prog-fill" style="width:0%"></div>
  </div>
  <div class="fac-stage-text" id="fac-stage-text">Starting…</div>
</div>

<!-- Results dashboard -->
<div id="fac-results" style="display:none">
  <div class="fac-results-header">
    <span id="fac-results-count" class="fac-results-title">0 Shorts Ready</span>
    <div class="fac-batch-btns">
      <button class="fac-batch-btn secondary" onclick="BatchFactory.selectAll()">☑ All</button>
      <button class="fac-batch-btn secondary" onclick="BatchFactory.selectNone()">☐ None</button>
      <button class="fac-batch-btn" onclick="BatchFactory.exportSelected()">⬇ Export Selected</button>
      <button class="fac-batch-btn primary" onclick="BatchFactory.exportAll()">⬇ Export All</button>
    </div>
  </div>
  <div class="fac-cards" id="fac-cards"></div>
</div>
`;

  document.body.appendChild(el);

  // Pill pickers
  el.querySelectorAll('#fac-count .fac-pill').forEach(b => {
    b.addEventListener('click', () => {
      el.querySelectorAll('#fac-count .fac-pill').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
  });
  el.querySelectorAll('#fac-tpl .fac-pill').forEach(b => {
    b.addEventListener('click', () => {
      el.querySelectorAll('#fac-tpl .fac-pill').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
  });

  _injectStyles();
}

/* ══════════════════════════════════════════════════════════
   RUN FACTORY
   ══════════════════════════════════════════════════════════ */
function run(maxShorts, subtitleTemplate) {
  _buildPanel();
  const panel = document.getElementById('factory-panel');
  if (!panel) return;

  const count = maxShorts
    || parseInt(panel.querySelector('#fac-count .fac-pill.on')?.dataset.v || '10');
  const tpl = subtitleTemplate
    || panel.querySelector('#fac-tpl .fac-pill.on')?.dataset.v || 'tiktok';

  const editorState = _getEditorState();

  // Show progress, hide others
  document.getElementById('fac-config').style.display   = 'none';
  document.getElementById('fac-progress').style.display = '';
  document.getElementById('fac-results').style.display  = 'none';

  const btn = document.getElementById('fac-run-btn');
  if (btn) { btn.disabled = true; }

  if (typeof toast === 'function') toast('🏭 Batch Factory started — ' + count + ' shorts');

  fetch('/factory/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ editorState, maxShorts: count, subtitleTemplate: tpl }),
  })
    .then(r => r.json())
    .then(data => {
      if (!data.batch_id) throw new Error(data.error || 'No batch_id');
      _batchId = data.batch_id;
      _startPolling();
    })
    .catch(e => {
      if (typeof toast === 'function') toast('❌ Factory failed: ' + e.message);
      document.getElementById('fac-config').style.display = '';
      document.getElementById('fac-progress').style.display = 'none';
    });
}

/* ── Polling ─────────────────────────────────────────────── */
function _startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(_poll, 900);
}
function _stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function _poll() {
  if (!_batchId) return;
  fetch('/factory/status?id=' + _batchId)
    .then(r => r.json())
    .then(data => {
      _updateProgress(data);
      if (data.status === 'ready') {
        _stopPolling();
        _shorts   = data.shorts || [];
        _selected = new Set(_shorts.map(s => s.id));
        _showResults();
      }
      if (data.status === 'error') {
        _stopPolling();
        if (typeof toast === 'function') toast('❌ Factory error: ' + data.stage);
        document.getElementById('fac-config').style.display   = '';
        document.getElementById('fac-progress').style.display = 'none';
        const btn = document.getElementById('fac-run-btn');
        if (btn) btn.disabled = false;
      }
    })
    .catch(() => {});
}

function _updateProgress(data) {
  const fill = document.getElementById('fac-prog-fill');
  const text = document.getElementById('fac-stage-text');
  if (fill) fill.style.width = (data.progress || 0) + '%';
  if (text) text.textContent = data.stage || 'Processing…';

  const pct = data.progress || 0;
  _setStage(1, pct >= 5);
  _setStage(2, pct >= 45);
  _setStage(3, pct >= 75);
  _setStage(4, pct >= 100);
}

function _setStage(n, done) {
  const el = document.getElementById('fsp-' + n);
  if (!el) return;
  const dot = el.querySelector('.fac-sp-dot');
  if (!dot) return;
  dot.className = 'fac-sp-dot' + (done ? ' done' : n === _currentStage() ? ' active' : '');
}
function _currentStage() {
  const fill = document.getElementById('fac-prog-fill');
  const w = parseFloat(fill?.style.width || '0');
  if (w >= 75) return 3;
  if (w >= 45) return 2;
  return 1;
}

/* ══════════════════════════════════════════════════════════
   RESULTS DASHBOARD
   ══════════════════════════════════════════════════════════ */
function _showResults() {
  document.getElementById('fac-progress').style.display = 'none';
  document.getElementById('fac-results').style.display  = '';
  document.getElementById('fac-config').style.display   = 'none';

  const countEl = document.getElementById('fac-results-count');
  if (countEl) countEl.textContent = _shorts.length + ' Shorts Ready 🎬';

  _renderCards();

  if (typeof toast === 'function') {
    toast('✅ Factory done — ' + _shorts.length + ' shorts ready!');
  }

  const btn = document.getElementById('fac-run-btn');
  if (btn) btn.disabled = false;
}

function _renderCards() {
  const container = document.getElementById('fac-cards');
  if (!container) return;
  if (!_shorts.length) {
    container.innerHTML = '<div class="fac-empty">No shorts generated. Try adding more content to your timeline.</div>';
    return;
  }

  container.innerHTML = _shorts.map((s, i) => {
    const dur    = Math.round(s.duration || (s.end - s.start));
    const pctHook = _pct(s.hook_score);
    const pctRet  = _pct(s.retention_score);
    const pctEmo  = _pct(s.emotional_score);
    const pctAll  = _pct(s.overall_score);
    const isSelected = _selected.has(s.id);
    const emoji = pctAll >= 80 ? '🔥' : pctAll >= 65 ? '⚡' : '📊';

    const titleOptions = (s.titles || [s.title]).slice(0, 3);
    const hashtags = (s.hashtags || []).slice(0, 5);

    return `
<div class="fac-card ${isSelected ? 'selected' : ''}" data-id="${_esc(s.id)}">
  <div class="fac-card-top">
    <div class="fac-card-left">
      <div class="fac-card-rank">#${i + 1}</div>
      <div class="fac-card-meta-top">
        <span class="fac-tag">⏱ ${dur}s</span>
        <span class="fac-tag">${_fmt(s.start)} → ${_fmt(s.end)}</span>
        <span class="fac-tag tpl">${_esc(s.subtitle_template || 'tiktok')}</span>
      </div>
    </div>
    <div class="fac-card-score-ring" style="--ring-color:${_scoreColor(s.overall_score)}">
      <div class="fac-ring-val">${emoji} ${pctAll}%</div>
      <div class="fac-ring-lbl">Score</div>
    </div>
    <label class="fac-checkbox">
      <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="BatchFactory._toggleSelect('${_esc(s.id)}',this.checked)">
      <span class="fac-cb-track"><span class="fac-cb-thumb"></span></span>
    </label>
  </div>

  <!-- Thumbnail placeholder -->
  <div class="fac-thumbnail" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)">
    <div class="fac-thumb-text">${_esc(s.thumbnail_text || s.title || '')}</div>
    <div class="fac-thumb-dur">${dur}s</div>
  </div>

  <!-- Score breakdown -->
  <div class="fac-scores">
    <div class="fac-score-row">
      <span class="fac-score-lbl">🎣 Hook</span>
      <div class="fac-score-bar-wrap"><div class="fac-score-bar" style="width:${pctHook}%;background:${_scoreColor(s.hook_score)}"></div></div>
      <span class="fac-score-num">${pctHook}%</span>
    </div>
    <div class="fac-score-row">
      <span class="fac-score-lbl">📺 Retain</span>
      <div class="fac-score-bar-wrap"><div class="fac-score-bar" style="width:${pctRet}%;background:${_scoreColor(s.retention_score)}"></div></div>
      <span class="fac-score-num">${pctRet}%</span>
    </div>
    <div class="fac-score-row">
      <span class="fac-score-lbl">❤️ Emotion</span>
      <div class="fac-score-bar-wrap"><div class="fac-score-bar" style="width:${pctEmo}%;background:${_scoreColor(s.emotional_score)}"></div></div>
      <span class="fac-score-num">${pctEmo}%</span>
    </div>
  </div>

  <!-- Hook line -->
  ${s.hook_line ? `<div class="fac-hook-line">"${_esc(s.hook_line)}"</div>` : ''}

  <!-- Title options -->
  <div class="fac-section-label-sm">Title Options</div>
  <div class="fac-titles">
    ${titleOptions.map((t, ti) => `
      <div class="fac-title-opt" onclick="BatchFactory._copyText('${_esc(t)}')">
        <span class="fac-title-badge">${['A','B','C'][ti]}</span>
        <span class="fac-title-text">${_esc(t)}</span>
        <span class="fac-title-copy">📋</span>
      </div>`).join('')}
  </div>

  <!-- Description -->
  ${s.description ? `
  <div class="fac-section-label-sm">Description</div>
  <div class="fac-desc">${_esc(s.description)}</div>
  <div class="fac-cta">${_esc(s.cta || '')}</div>
  ` : ''}

  <!-- Hashtags -->
  <div class="fac-hashtags">
    ${hashtags.map(h => `<span class="fac-hash" onclick="BatchFactory._copyText('${_esc(h)}')">${_esc(h)}</span>`).join('')}
  </div>

  <!-- Actions -->
  <div class="fac-card-actions">
    <button class="fac-act-btn preview" onclick="BatchFactory.previewShort('${_esc(s.id)}')">
      ▶ Preview
    </button>
    <button class="fac-act-btn export" onclick="BatchFactory.exportShort('${_esc(s.id)}')">
      ⬇ Export
    </button>
    <button class="fac-act-btn delete" onclick="BatchFactory._deleteShort('${_esc(s.id)}')">
      🗑
    </button>
  </div>
</div>`;
  }).join('');
}

/* ── Selection ───────────────────────────────────────────── */
function _toggleSelect(id, checked) {
  if (checked) _selected.add(id);
  else _selected.delete(id);
  const card = document.querySelector(`.fac-card[data-id="${id}"]`);
  if (card) card.classList.toggle('selected', checked);
}
function selectAll()  { _shorts.forEach(s => _selected.add(s.id)); _renderCards(); }
function selectNone() { _selected.clear(); _renderCards(); }

/* ── Preview: apply short to main timeline ───────────────── */
function previewShort(id) {
  const s = _shorts.find(x => x.id === id);
  if (!s) return;
  if (typeof ShortsGen !== 'undefined' && ShortsGen.applyShort) {
    ShortsGen.applyShort(s);
    close();
  } else {
    if (typeof toast === 'function') toast('⚠ ShortsGen not loaded');
  }
}

/* ── Export ──────────────────────────────────────────────── */
function exportShort(id) {
  const s = _shorts.find(x => x.id === id);
  if (!s) return;

  if (typeof ExportEngine === 'undefined') {
    if (typeof toast === 'function') toast('⚠ Export Engine not loaded');
    return;
  }

  if (typeof toast === 'function') toast(`⬇ Exporting ${s.id}…`);
  ExportEngine.open();

  const editorState = _getEditorState();
  fetch('/export/start', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'mp4',
      quality: '1080p',
      fps: 30,
      project: {
        ...editorState,
        name: s.titles?.[0] || s.title || s.id,
      },
      settings: { burnSubtitles: true },
    }),
  })
    .then(r => r.json())
    .then(data => {
      if (!data.ok) throw new Error(data.error || 'Export failed');
      if (typeof toast === 'function') toast(`🎬 Export started for ${s.id}`);
    })
    .catch(e => {
      if (typeof toast === 'function') toast('❌ ' + e.message);
    });
}

function exportSelected() {
  const sel = _shorts.filter(s => _selected.has(s.id));
  if (!sel.length) {
    if (typeof toast === 'function') toast('⚠ No shorts selected');
    return;
  }
  sel.forEach((s, i) => { setTimeout(() => exportShort(s.id), i * 800); });
  if (typeof toast === 'function') toast(`⬇ Exporting ${sel.length} shorts…`);
}

function exportAll() {
  _shorts.forEach((s, i) => { setTimeout(() => exportShort(s.id), i * 800); });
  if (typeof toast === 'function') toast(`⬇ Exporting all ${_shorts.length} shorts…`);
}

/* ── Delete ──────────────────────────────────────────────── */
function _deleteShort(id) {
  _shorts = _shorts.filter(s => s.id !== id);
  _selected.delete(id);
  const countEl = document.getElementById('fac-results-count');
  if (countEl) countEl.textContent = _shorts.length + ' Shorts Ready 🎬';
  _renderCards();
}

/* ── Copy text to clipboard ──────────────────────────────── */
function _copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof toast === 'function') toast('📋 Copied!');
    }).catch(() => {});
  }
}

/* ── Open / Close ─────────────────────────────────────────── */
function open() {
  _buildPanel();
  const p = document.getElementById('factory-panel');
  if (p) p.classList.add('open');
  _panelOpen = true;
}
function close() {
  const p = document.getElementById('factory-panel');
  if (p) p.classList.remove('open');
  _panelOpen = false;
  document.querySelectorAll('#lsb .tb').forEach(b => {
    if (b.getAttribute('onclick')?.includes("'factory'")) b.classList.remove('on');
  });
}

/* ── Hook into setTool ───────────────────────────────────── */
const _origSetTool = window.setTool;
window.setTool = function(el, name) {
  if (name === 'factory') {
    const p = document.getElementById('factory-panel');
    if (p && p.classList.contains('open')) {
      close();
      if (el) el.classList.remove('on');
    } else {
      if (typeof _origSetTool === 'function') _origSetTool(el, name);
      open();
    }
    return;
  }
  close();
  if (typeof _origSetTool === 'function') _origSetTool(el, name);
};

/* ══════════════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════════════ */
function _injectStyles() {
  if (document.getElementById('fac-styles')) return;
  const st = document.createElement('style');
  st.id = 'fac-styles';
  st.textContent = `
/* ── Panel shell ── */
#factory-panel{
  position:fixed;left:56px;top:48px;bottom:0;
  width:380px;background:var(--bg1);border-right:1px solid var(--border2);
  z-index:500;display:flex;flex-direction:column;overflow:hidden;
  transform:translateX(-110%);transition:transform .22s cubic-bezier(.4,0,.2,1);
  box-shadow:4px 0 24px rgba(0,0,0,.5);
}
#factory-panel.open{transform:translateX(0)}

.fac-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--border2);
  background:var(--bg2);flex-shrink:0;
}
.fac-header-left{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--t1)}
.fac-close{background:none;border:none;color:var(--t4);cursor:pointer;font-size:13px;padding:3px 7px;border-radius:4px}
.fac-close:hover{background:var(--bg4);color:var(--t1)}

/* Config */
#fac-config{padding:14px 16px;overflow-y:auto;flex:1}
.fac-intro{font-size:11px;color:var(--t3);line-height:1.5;margin-bottom:14px;padding:10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)}
.fac-section-label{font-size:10px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}

.fac-pill-row{display:flex;gap:6px;flex-wrap:wrap}
.fac-pill{
  padding:5px 13px;border:1.5px solid var(--border2);border-radius:20px;
  font-size:11.5px;font-weight:600;color:var(--t3);background:var(--bg2);cursor:pointer;
  transition:all .12s;
}
.fac-pill.on{border-color:var(--accent);color:var(--accent2);background:var(--accentdim)}
.fac-pill:hover:not(.on){border-color:var(--border2);color:var(--t2)}

/* Pipeline diagram */
.fac-pipeline{
  display:flex;align-items:center;justify-content:space-between;
  margin:16px 0;padding:12px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);
}
.fac-pipe-step{display:flex;flex-direction:column;align-items:center;gap:4px}
.fac-pipe-dot{
  width:26px;height:26px;border-radius:50%;background:var(--accentdim);
  border:2px solid var(--accent);color:var(--accent2);font-size:11px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
}
.fac-pipe-lbl{font-size:8px;color:var(--t4);text-align:center;line-height:1.3}
.fac-pipe-arrow{font-size:18px;color:var(--t4);flex-shrink:0}

.fac-run-btn{
  width:100%;padding:11px;background:var(--accent);color:#000;
  border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:background .12s;
  margin-top:4px;
}
.fac-run-btn:hover{background:var(--accent2)}
.fac-run-btn:disabled{opacity:.5;cursor:not-allowed}

/* Progress */
.fac-stage-pipeline{display:flex;align-items:center;gap:0}
.fac-sp-step{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0}
.fac-sp-dot{
  width:24px;height:24px;border-radius:50%;background:var(--bg4);
  border:2px solid var(--border2);color:var(--t4);font-size:10px;font-weight:700;
  display:flex;align-items:center;justify-content:center;transition:all .2s;
}
.fac-sp-dot.active{border-color:var(--accent);color:var(--accent2);background:var(--accentdim)}
.fac-sp-dot.done{border-color:#27ae60;color:#27ae60;background:rgba(39,174,96,.15)}
.fac-sp-lbl{font-size:8.5px;color:var(--t4);text-align:center}
.fac-sp-line{flex:1;height:2px;background:var(--border2)}

.fac-prog-track{height:6px;background:var(--bg4);border-radius:3px;overflow:hidden}
.fac-prog-fill{height:100%;background:var(--accent);border-radius:3px;transition:width .6s ease}
.fac-stage-text{font-size:11px;color:var(--t3);margin-top:8px;text-align:center}

/* Results header */
.fac-results-header{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;
  padding:10px 14px;border-bottom:1px solid var(--border2);background:var(--bg2);flex-shrink:0;
}
.fac-results-title{font-size:12px;font-weight:700;color:var(--t1)}
.fac-batch-btns{display:flex;gap:5px;flex-wrap:wrap}
.fac-batch-btn{
  padding:4px 10px;border:1px solid var(--border2);border-radius:6px;
  font-size:10px;font-weight:600;color:var(--t3);background:var(--bg3);cursor:pointer;
}
.fac-batch-btn.primary{background:var(--accent);color:#000;border-color:var(--accent)}
.fac-batch-btn.primary:hover{background:var(--accent2)}
.fac-batch-btn.secondary:hover{border-color:var(--accent);color:var(--accent2)}

/* Cards scroll area */
.fac-cards{overflow-y:auto;flex:1;padding:10px 12px;display:flex;flex-direction:column;gap:12px}
.fac-cards::-webkit-scrollbar{width:3px}
.fac-cards::-webkit-scrollbar-thumb{background:var(--bg5)}

/* Card */
.fac-card{
  background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;
  overflow:hidden;transition:border-color .12s;
}
.fac-card.selected{border-color:var(--accent)}
.fac-card-top{display:flex;align-items:flex-start;gap:8px;padding:10px 10px 6px}
.fac-card-left{flex:1;min-width:0}
.fac-card-rank{
  font-size:18px;font-weight:800;color:var(--accent);
  line-height:1;margin-bottom:4px;
}
.fac-card-meta-top{display:flex;gap:4px;flex-wrap:wrap}
.fac-tag{
  font-size:9px;padding:2px 6px;background:var(--bg3);border-radius:5px;
  color:var(--t3);border:1px solid var(--border);
}
.fac-tag.tpl{background:var(--accentdim);color:var(--accent2);border-color:var(--accent)}

.fac-card-score-ring{
  display:flex;flex-direction:column;align-items:center;gap:1px;
  width:54px;flex-shrink:0;
}
.fac-ring-val{font-size:11.5px;font-weight:800;color:var(--ring-color, var(--accent))}
.fac-ring-lbl{font-size:8px;color:var(--t4)}

.fac-checkbox{display:flex;align-items:center;cursor:pointer;flex-shrink:0}
.fac-checkbox input{display:none}
.fac-cb-track{
  width:28px;height:16px;background:var(--bg4);border-radius:8px;
  position:relative;transition:background .15s;
}
.fac-checkbox input:checked ~ .fac-cb-track{background:var(--accent)}
.fac-cb-thumb{
  position:absolute;top:2px;left:2px;width:12px;height:12px;
  background:#fff;border-radius:50%;transition:transform .15s;
}
.fac-checkbox input:checked ~ .fac-cb-track .fac-cb-thumb{transform:translateX(12px)}

/* Thumbnail */
.fac-thumbnail{
  height:72px;display:flex;align-items:flex-end;justify-content:space-between;
  padding:6px 8px;position:relative;overflow:hidden;
}
.fac-thumb-text{
  font-size:12px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8);
  line-height:1.2;max-width:80%;overflow:hidden;display:-webkit-box;
  -webkit-line-clamp:2;-webkit-box-orient:vertical;
}
.fac-thumb-dur{
  font-size:9px;background:rgba(0,0,0,.65);color:#fff;padding:2px 5px;
  border-radius:4px;flex-shrink:0;
}

/* Scores */
.fac-scores{padding:8px 10px;display:flex;flex-direction:column;gap:5px}
.fac-score-row{display:flex;align-items:center;gap:6px}
.fac-score-lbl{font-size:9.5px;color:var(--t4);width:50px;flex-shrink:0}
.fac-score-bar-wrap{flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden}
.fac-score-bar{height:100%;border-radius:3px;transition:width .4s}
.fac-score-num{font-size:9.5px;font-weight:700;color:var(--t3);min-width:28px;text-align:right}

.fac-hook-line{
  font-size:10px;font-style:italic;color:var(--t4);padding:5px 10px;
  border-left:2px solid var(--accent);margin:2px 10px 4px;
}

/* Titles */
.fac-section-label-sm{font-size:9px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.5px;padding:4px 10px 2px}
.fac-titles{display:flex;flex-direction:column;gap:3px;padding:0 8px 6px}
.fac-title-opt{
  display:flex;align-items:center;gap:6px;padding:5px 7px;
  background:var(--bg3);border-radius:6px;cursor:pointer;border:1px solid var(--border);
  transition:border-color .12s;
}
.fac-title-opt:hover{border-color:var(--accent)}
.fac-title-badge{
  width:16px;height:16px;border-radius:3px;background:var(--accentdim);
  color:var(--accent2);font-size:9px;font-weight:700;display:flex;
  align-items:center;justify-content:center;flex-shrink:0;
}
.fac-title-text{flex:1;font-size:10.5px;color:var(--t2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.fac-title-copy{font-size:10px;color:var(--t4);flex-shrink:0}

.fac-desc{font-size:10.5px;color:var(--t3);padding:0 10px 4px;line-height:1.5}
.fac-cta{font-size:10px;font-weight:600;color:var(--accent2);padding:0 10px 6px}

/* Hashtags */
.fac-hashtags{display:flex;flex-wrap:wrap;gap:4px;padding:4px 10px 8px}
.fac-hash{
  font-size:9.5px;padding:2px 7px;background:var(--bg3);border:1px solid var(--border);
  border-radius:10px;color:var(--t3);cursor:pointer;transition:all .12s;
}
.fac-hash:hover{border-color:var(--accent);color:var(--accent2)}

/* Card actions */
.fac-card-actions{display:flex;gap:5px;padding:0 8px 8px}
.fac-act-btn{
  flex:1;padding:5px 4px;border:1px solid var(--border2);border-radius:6px;
  font-size:10px;font-weight:600;color:var(--t3);background:var(--bg3);cursor:pointer;
  transition:all .12s;
}
.fac-act-btn.preview:hover{border-color:var(--accent);color:var(--accent2);background:var(--accentdim)}
.fac-act-btn.export{background:var(--accent);color:#000;border-color:var(--accent);font-weight:700}
.fac-act-btn.export:hover{background:var(--accent2)}
.fac-act-btn.delete:hover{border-color:#e74c3c;color:#e74c3c}
.fac-act-btn.delete{flex:0 0 32px}

.fac-empty{font-size:11px;color:var(--t4);text-align:center;padding:24px 0}

/* Results layout: header + scroll area */
#fac-results{display:flex;flex-direction:column;flex:1;overflow:hidden}
`;
  document.head.appendChild(st);
}

/* ── Init ────────────────────────────────────────────────── */
function init() {
  _buildPanel();
  console.log('[BatchFactory] Batch Shorts Factory v2.3 loaded');
}

/* ── Public API ──────────────────────────────────────────── */
window.BatchFactory = {
  open, close, run,
  previewShort, exportShort, exportSelected, exportAll,
  selectAll, selectNone,
  _toggleSelect, _deleteShort, _copyText,
  getShorts() { return [..._shorts]; },
  getBatchId() { return _batchId; },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
