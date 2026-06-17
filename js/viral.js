/* ============================================================
   VIRAL INTELLIGENCE SYSTEM — js/viral.js
   Phase 2: Retention heatmap, Hook Detector, Boring Segment
            Detector, Viral Score — timeline overlay + panel
   Non-invasive: does NOT modify existing editor state/DOM.
   ============================================================ */

(function () {

/* ── State ───────────────────────────────────────────────── */
let _data       = null;   // last analysis result from backend
let _loading    = false;
let _overlayOn  = false;

/* ── Colors for heatmap levels ───────────────────────────── */
const LEVEL_COLORS = {
  high:   { fill: 'rgba(39,174,96,.55)',   glow: '#27ae60' },
  medium: { fill: 'rgba(230,180,20,.5)',   glow: '#e6b414' },
  low:    { fill: 'rgba(231,76,60,.55)',   glow: '#e74c3c' },
};

/* ── Helpers ─────────────────────────────────────────────── */
function _pps () {
  if (typeof pps === 'function') return pps();
  if (typeof zoomIdx !== 'undefined') {
    const vals = [7, 14, 28, 56, 80, 120, 160, 240];
    return vals[Math.min(vals.length - 1, zoomIdx)] || 40;
  }
  return 40;
}
function _totalDur () {
  let dur = 0;
  if (typeof tracks !== 'undefined') {
    tracks.forEach(tr => tr.clips.forEach(c => { dur = Math.max(dur, c.start + c.dur); }));
  }
  return dur || 30;
}
function _getEditorState () {
  const state = {};
  if (typeof tracks !== 'undefined')    state.tracks    = tracks;
  if (typeof subtitles !== 'undefined') state.subtitles = subtitles;
  state.totalDuration = _totalDur();
  return state;
}
function _fmtTime (s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}
function _esc (s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════════
   HEATMAP OVERLAY (strip above timeline ruler)
   ══════════════════════════════════════════════════════════ */

function _getOrCreateOverlay () {
  let ov = document.getElementById('viral-heatmap-overlay');
  if (!ov) {
    const tlInner = document.getElementById('tl-inner') || document.getElementById('tl-scroll');
    if (!tlInner) return null;
    ov = document.createElement('div');
    ov.id = 'viral-heatmap-overlay';
    ov.style.cssText = `
      position:absolute;top:0;left:0;right:0;height:12px;
      pointer-events:none;z-index:20;overflow:hidden;
    `;
    tlInner.insertBefore(ov, tlInner.firstChild);
  }
  return ov;
}

function _renderHeatmap () {
  if (!_data || !_overlayOn) {
    const ov = document.getElementById('viral-heatmap-overlay');
    if (ov) ov.innerHTML = '';
    return;
  }
  const ov = _getOrCreateOverlay();
  if (!ov) return;

  const segments = _data.segments || [];
  const dur      = _totalDur();
  const pps      = _pps();
  const totalPx  = dur * pps;

  // Scroll offset for ruler sync
  const scroll   = document.getElementById('tl-scroll')?.scrollLeft || 0;
  ov.style.width  = totalPx + 'px';

  let html = '';
  segments.forEach(seg => {
    const x = seg.start * pps;
    const w = Math.max(2, (seg.end - seg.start) * pps);
    const c = LEVEL_COLORS[seg.level] || LEVEL_COLORS.medium;
    const tags = (seg.tags || []).join(' ');
    html += `<div class="vhm-seg" data-level="${seg.level}"
      style="left:${x}px;width:${w}px;background:${c.fill};box-shadow:0 0 4px ${c.glow}"
      title="${_esc(seg.detail || seg.level)} (${_fmtTime(seg.start)}–${_fmtTime(seg.end)})"></div>`;
  });

  // Hook markers
  (_data.hooks || []).forEach(h => {
    const x = h.start * pps;
    html += `<div class="vhm-hook" style="left:${x}px" title="Hook: ${_esc(h.reason || '')}">⚡</div>`;
  });

  // Boring segment markers
  (_data.boring || []).forEach(b => {
    const x  = b.start * pps;
    const w  = Math.max(4, (b.end - b.start) * pps);
    html += `<div class="vhm-boring" style="left:${x}px;width:${w}px" title="Boring: ${_esc(b.reason || '')}"></div>`;
  });

  ov.innerHTML = html;
}

/* ── Re-render heatmap when timeline scrolls or zooms ─────── */
function _hookRenderAll () {
  const origRenderAll = window.renderAll;
  if (!origRenderAll) return;
  window.renderAll = function (...args) {
    origRenderAll.apply(this, args);
    if (_overlayOn) setTimeout(_renderHeatmap, 0);
  };
}

/* ══════════════════════════════════════════════════════════
   ANALYSIS PANEL (modal)
   ══════════════════════════════════════════════════════════ */

function _buildPanel () {
  if (document.getElementById('viral-panel')) return;
  const el = document.createElement('div');
  el.id = 'viral-panel';
  el.innerHTML = `
<div id="viral-box">
  <div class="viral-header">
    <span class="viral-header-icon">⚡</span>
    <span class="viral-header-title">Viral Intelligence</span>
    <button class="viral-close" id="viral-close">✕</button>
  </div>

  <div id="viral-loading" class="viral-loading" style="display:none">
    <div class="viral-spinner"></div>
    <div class="viral-loading-txt">Analyzing with AI…</div>
  </div>

  <div id="viral-body" style="display:none">

    <!-- Viral Score -->
    <div class="viral-section viral-score-section">
      <div class="viral-score-ring-wrap">
        <svg class="viral-ring-svg" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg4)" stroke-width="8"/>
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" stroke-width="8"
            stroke-linecap="round" stroke-dasharray="213.6"
            stroke-dashoffset="213.6" id="viral-ring-arc"
            transform="rotate(-90 40 40)"/>
        </svg>
        <div class="viral-ring-label">
          <div class="viral-ring-score" id="viral-ring-score">--</div>
          <div class="viral-ring-sub">Viral Score</div>
        </div>
      </div>
      <div class="viral-breakdown" id="viral-breakdown">
        <!-- bars injected -->
      </div>
    </div>

    <!-- Heatmap toggle -->
    <div class="viral-section viral-heatmap-toggle-section">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="viral-sm-title">Retention Heatmap</div>
          <div class="viral-sm-sub">Overlay on timeline</div>
        </div>
        <label class="viral-toggle">
          <input type="checkbox" id="viral-hm-toggle">
          <span class="viral-toggle-track"><span class="viral-toggle-thumb"></span></span>
        </label>
      </div>
      <div class="viral-legend">
        <span class="viral-legend-dot" style="background:#27ae60"></span> Strong
        <span class="viral-legend-dot" style="background:#e6b414;margin-left:10px"></span> Average
        <span class="viral-legend-dot" style="background:#e74c3c;margin-left:10px"></span> Drop-off risk
      </div>
    </div>

    <!-- Hook Detector -->
    <div class="viral-section">
      <div class="viral-sm-title">⚡ Hook Detector</div>
      <div class="viral-hook-list" id="viral-hook-list"></div>
    </div>

    <!-- Boring Segments -->
    <div class="viral-section">
      <div class="viral-sm-title">😴 Boring Segments</div>
      <div class="viral-boring-list" id="viral-boring-list"></div>
    </div>

    <!-- Tips -->
    <div class="viral-section">
      <div class="viral-sm-title">💡 Improvement Tips</div>
      <div class="viral-tips" id="viral-tips"></div>
    </div>

  </div>

  <!-- Re-analyze button always visible -->
  <div class="viral-footer">
    <button class="viral-analyze-btn" id="viral-analyze-btn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <span id="viral-analyze-label">Analyze Now</span>
    </button>
    <div class="viral-footer-hint" id="viral-footer-hint"></div>
  </div>
</div>`;
  document.body.appendChild(el);

  el.addEventListener('click', e => { if (e.target === el) ViralEngine.close(); });
  document.getElementById('viral-close').addEventListener('click', ViralEngine.close);
  document.getElementById('viral-analyze-btn').addEventListener('click', _runAnalysis);
  document.getElementById('viral-hm-toggle').addEventListener('change', function () {
    _overlayOn = this.checked;
    _renderHeatmap();
  });
}

/* ── Open / Close ─────────────────────────────────────────── */
function openPanel () {
  _buildPanel();
  document.getElementById('viral-panel').classList.add('open');
  if (_data) _populatePanel(_data);
}
function closePanel () {
  const p = document.getElementById('viral-panel');
  if (p) p.classList.remove('open');
}

/* ── Run analysis ────────────────────────────────────────── */
function _runAnalysis () {
  if (_loading) return;
  _loading = true;

  const dur   = _totalDur();
  const step  = Math.max(2, dur / 20);
  const segs  = [];
  for (let t = 0; t < dur; t += step) {
    segs.push({ start: Math.round(t * 10) / 10, end: Math.round(Math.min(t + step, dur) * 10) / 10 });
  }

  const body  = document.getElementById('viral-body');
  const load  = document.getElementById('viral-loading');
  const lbl   = document.getElementById('viral-analyze-label');
  const hint  = document.getElementById('viral-footer-hint');
  if (load) load.style.display = '';
  if (body) body.style.display = 'none';
  if (lbl)  lbl.textContent   = 'Analyzing…';
  if (hint) hint.textContent  = '';

  fetch('/ai/viral-analysis', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ editorState: _getEditorState(), segments: segs }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      _data    = data;
      _loading = false;
      if (load) load.style.display = 'none';
      if (body) body.style.display = '';
      if (lbl)  lbl.textContent = 'Re-analyze';
      if (hint) hint.textContent = 'Updated just now';
      _populatePanel(data);
      if (_overlayOn) _renderHeatmap();
      if (typeof toast === 'function') toast('⚡ Viral analysis complete — score: ' + data.viral_score + '/100');
    })
    .catch(e => {
      _loading = false;
      if (load) load.style.display = 'none';
      if (body && _data) body.style.display = '';
      if (lbl)  lbl.textContent = 'Analyze Now';
      if (hint) hint.style.color = '#e74c3c';
      if (hint) hint.textContent = e.message;
      if (typeof toast === 'function') toast('❌ Analysis failed: ' + e.message);
    });
}

/* ── Populate panel with results ─────────────────────────── */
function _populatePanel (data) {
  // Viral score ring
  const score = data.viral_score || 0;
  const arc   = document.getElementById('viral-ring-arc');
  const lbl   = document.getElementById('viral-ring-score');
  if (arc) {
    const circumference = 2 * Math.PI * 34; // 213.6
    arc.style.strokeDashoffset = String(circumference * (1 - score / 100));
    arc.style.stroke = score >= 70 ? '#27ae60' : score >= 45 ? '#e6b414' : '#e74c3c';
  }
  if (lbl) { lbl.textContent = score; lbl.style.color = score >= 70 ? '#27ae60' : score >= 45 ? '#e6b414' : '#e74c3c'; }

  // Breakdown bars
  const bd = data.breakdown || {};
  const bdEl = document.getElementById('viral-breakdown');
  if (bdEl) {
    const items = [
      { key: 'hook_strength',      label: 'Hook',     icon: '⚡' },
      { key: 'pacing',             label: 'Pacing',   icon: '⏱' },
      { key: 'subtitle_density',   label: 'Subtitles',icon: '💬' },
      { key: 'emotion',            label: 'Emotion',  icon: '❤️' },
      { key: 'variety',            label: 'Variety',  icon: '🎨' },
    ];
    bdEl.innerHTML = items.map(it => {
      const val = bd[it.key] || 0;
      const col = val >= 70 ? '#27ae60' : val >= 45 ? '#e6b414' : '#e74c3c';
      return `
<div class="viral-bd-row">
  <span class="viral-bd-icon">${it.icon}</span>
  <span class="viral-bd-label">${it.label}</span>
  <div class="viral-bd-track">
    <div class="viral-bd-fill" style="width:${val}%;background:${col}"></div>
  </div>
  <span class="viral-bd-val" style="color:${col}">${val}</span>
</div>`;
    }).join('');
  }

  // Hooks
  const hookEl = document.getElementById('viral-hook-list');
  if (hookEl) {
    const hooks = data.hooks || [];
    if (!hooks.length) {
      hookEl.innerHTML = '<div class="viral-empty-note">No strong hooks detected. Consider adding a captivating opener.</div>';
    } else {
      hookEl.innerHTML = hooks.map(h => `
<div class="viral-hook-item">
  <div class="viral-hook-time">⚡ ${_fmtTime(h.start)}</div>
  <div class="viral-hook-reason">${_esc(h.reason || '')}</div>
  <div class="viral-hook-strength">Strength: ${Math.round((h.strength||0.5)*100)}%</div>
</div>`).join('');
    }
  }

  // Boring segments
  const borEl = document.getElementById('viral-boring-list');
  if (borEl) {
    const boring = data.boring || [];
    if (!boring.length) {
      borEl.innerHTML = '<div class="viral-empty-note" style="color:#27ae60">✅ No boring segments detected!</div>';
    } else {
      borEl.innerHTML = boring.map(b => `
<div class="viral-boring-item">
  <div class="viral-boring-time">😴 ${_fmtTime(b.start)}–${_fmtTime(b.end)}</div>
  <div class="viral-boring-reason">${_esc(b.reason || '')}</div>
  <button class="viral-boring-jump" onclick="typeof playhead!=='undefined'&&(playhead=${b.start},typeof updatePlayhead==='function'&&updatePlayhead())">Jump to →</button>
</div>`).join('');
    }
  }

  // Tips
  const tipsEl = document.getElementById('viral-tips');
  if (tipsEl) {
    const tips = data.tips || [];
    if (!tips.length) {
      tipsEl.innerHTML = '<div class="viral-empty-note">No suggestions available.</div>';
    } else {
      tipsEl.innerHTML = tips.map((tip, i) => `
<div class="viral-tip-item">
  <span class="viral-tip-num">${i+1}</span>
  <span class="viral-tip-text">${_esc(tip)}</span>
</div>`).join('');
    }
  }
}

/* ══════════════════════════════════════════════════════════
   TOPBAR BUTTON
   ══════════════════════════════════════════════════════════ */

function _injectTopbarButton () {
  // Only add once
  if (document.getElementById('viral-topbar-btn')) return;
  // Find the topbar (export button area)
  const tbExport = document.querySelector('.tb-export');
  if (!tbExport || !tbExport.parentNode) return;

  const btn = document.createElement('button');
  btn.id = 'viral-topbar-btn';
  btn.className = 'tb-btn viral-tb-btn';
  btn.title = 'Viral Intelligence Analysis';
  btn.innerHTML = `
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
</svg>
<span>Viral AI</span>`;
  btn.addEventListener('click', () => ViralEngine.open());
  tbExport.parentNode.insertBefore(btn, tbExport);
}

/* ══════════════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════════════ */

function _injectStyles () {
  if (document.getElementById('viral-styles')) return;
  const st = document.createElement('style');
  st.id = 'viral-styles';
  st.textContent = `
/* Heatmap overlay segments */
.vhm-seg{
  position:absolute;top:0;height:100%;border-radius:1px;
  transition:opacity .2s;cursor:default;
}
.vhm-hook{
  position:absolute;top:-1px;font-size:9px;transform:translateX(-50%);
  cursor:default;filter:drop-shadow(0 0 3px #d4a017);
}
.vhm-boring{
  position:absolute;top:0;height:100%;background:rgba(231,76,60,.18);
  border-bottom:2px dashed rgba(231,76,60,.6);cursor:default;
}

/* Viral panel modal */
#viral-panel{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);
  z-index:650;align-items:flex-start;justify-content:flex-end;padding:60px 12px 0 0;
}
#viral-panel.open{display:flex}
#viral-box{
  background:var(--bg1);border:1px solid var(--border2);border-radius:14px;
  width:340px;max-width:95vw;max-height:88vh;overflow-y:auto;
  box-shadow:0 20px 60px rgba(0,0,0,.8);display:flex;flex-direction:column;
}
#viral-box::-webkit-scrollbar{width:3px}
#viral-box::-webkit-scrollbar-thumb{background:var(--bg5)}
.viral-header{
  display:flex;align-items:center;gap:8px;padding:13px 16px;
  border-bottom:1px solid var(--border2);background:var(--bg2);
  border-radius:14px 14px 0 0;flex-shrink:0;
}
.viral-header-icon{font-size:16px}
.viral-header-title{font-size:13px;font-weight:700;color:var(--t1);flex:1}
.viral-close{
  background:none;border:none;color:var(--t4);cursor:pointer;
  font-size:13px;padding:3px 6px;border-radius:4px;
}
.viral-close:hover{background:var(--bg4);color:var(--t1)}

/* Loading */
.viral-loading{padding:40px 20px;text-align:center}
.viral-spinner{
  width:28px;height:28px;border:3px solid var(--bg4);
  border-top-color:var(--accent);border-radius:50%;
  animation:viral-spin 0.7s linear infinite;margin:0 auto 12px;
}
@keyframes viral-spin{to{transform:rotate(360deg)}}
.viral-loading-txt{font-size:12px;color:var(--t3)}

/* Sections */
.viral-section{padding:14px 16px;border-bottom:1px solid var(--border)}
.viral-section:last-of-type{border-bottom:none}
.viral-sm-title{font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px}
.viral-sm-sub{font-size:10px;color:var(--t4);margin-top:1px}
.viral-empty-note{font-size:10.5px;color:var(--t3);padding:4px 0}

/* Score ring */
.viral-score-section{display:flex;align-items:center;gap:14px}
.viral-score-ring-wrap{position:relative;flex-shrink:0;width:80px;height:80px}
.viral-ring-svg{width:80px;height:80px}
#viral-ring-arc{transition:stroke-dashoffset .8s ease,stroke .4s}
.viral-ring-label{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
}
.viral-ring-score{font-size:20px;font-weight:900;line-height:1}
.viral-ring-sub{font-size:8px;color:var(--t4);margin-top:2px}
.viral-breakdown{flex:1;min-width:0}
.viral-bd-row{display:flex;align-items:center;gap:5px;margin-bottom:5px}
.viral-bd-icon{font-size:11px;flex-shrink:0;width:16px;text-align:center}
.viral-bd-label{font-size:9.5px;color:var(--t3);width:55px;flex-shrink:0}
.viral-bd-track{flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden}
.viral-bd-fill{height:100%;border-radius:2px;transition:width .6s ease}
.viral-bd-val{font-size:9.5px;font-weight:700;width:24px;text-align:right;flex-shrink:0}

/* Heatmap toggle */
.viral-heatmap-toggle-section{}
.viral-toggle{display:inline-flex;align-items:center;cursor:pointer;flex-shrink:0}
.viral-toggle input{display:none}
.viral-toggle-track{
  width:34px;height:18px;background:var(--bg4);border-radius:9px;
  position:relative;transition:background .2s;border:1.5px solid var(--border2);
}
.viral-toggle input:checked + .viral-toggle-track{background:var(--accent);border-color:var(--accent)}
.viral-toggle-thumb{
  position:absolute;top:2px;left:2px;width:12px;height:12px;
  background:#fff;border-radius:50%;transition:left .2s;
}
.viral-toggle input:checked + .viral-toggle-track .viral-toggle-thumb{left:18px}
.viral-legend{margin-top:8px;font-size:10px;color:var(--t3);display:flex;align-items:center;flex-wrap:wrap;gap:2px}
.viral-legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;vertical-align:middle}

/* Hooks */
.viral-hook-item{
  padding:7px 10px;border-radius:7px;background:rgba(212,160,23,.1);
  border:1px solid rgba(212,160,23,.2);margin-bottom:5px;
}
.viral-hook-time{font-size:11px;font-weight:700;color:var(--accent2)}
.viral-hook-reason{font-size:10.5px;color:var(--t3);margin-top:2px}
.viral-hook-strength{font-size:9.5px;color:var(--t4);margin-top:3px}

/* Boring segments */
.viral-boring-item{
  padding:7px 10px;border-radius:7px;background:rgba(231,76,60,.07);
  border:1px solid rgba(231,76,60,.2);margin-bottom:5px;
  display:flex;align-items:center;flex-wrap:wrap;gap:6px;
}
.viral-boring-time{font-size:11px;font-weight:700;color:#e74c3c}
.viral-boring-reason{font-size:10.5px;color:var(--t3);flex:1;min-width:100px}
.viral-boring-jump{
  background:rgba(231,76,60,.15);border:1px solid rgba(231,76,60,.3);
  color:#e74c3c;border-radius:5px;padding:2px 8px;font-size:10px;
  cursor:pointer;flex-shrink:0;
}
.viral-boring-jump:hover{background:rgba(231,76,60,.25)}

/* Tips */
.viral-tip-item{display:flex;gap:8px;align-items:flex-start;margin-bottom:6px}
.viral-tip-num{
  background:var(--bg3);color:var(--t3);border-radius:50%;width:18px;height:18px;
  display:flex;align-items:center;justify-content:center;font-size:9px;
  font-weight:700;flex-shrink:0;margin-top:1px;
}
.viral-tip-text{font-size:10.5px;color:var(--t2);line-height:1.5}

/* Footer */
.viral-footer{
  padding:12px 16px;background:var(--bg2);border-top:1px solid var(--border2);
  border-radius:0 0 14px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0;
}
.viral-analyze-btn{
  flex:1;background:var(--accentdim);border:1.5px solid var(--accent);color:var(--accent2);
  border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:background .12s;
}
.viral-analyze-btn:hover{background:rgba(212,160,23,.25)}
.viral-footer-hint{font-size:10px;color:var(--t4);text-align:right;flex-shrink:0}

/* Topbar viral button */
.viral-tb-btn{
  display:flex!important;align-items:center;gap:5px;padding:6px 12px!important;
  background:rgba(39,174,96,.12)!important;border:1.5px solid rgba(39,174,96,.3)!important;
  color:#27ae60!important;border-radius:8px;font-size:12px;font-weight:600;
  cursor:pointer;flex-shrink:0;
}
.viral-tb-btn:hover{background:rgba(39,174,96,.22)!important}
`;
  document.head.appendChild(st);
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

function init () {
  _injectStyles();
  _injectTopbarButton();
  _hookRenderAll();
  console.log('[ViralEngine] Viral Intelligence System v2.0 loaded');
}

/* ── Public API ──────────────────────────────────────────── */
window.ViralEngine = {
  open:          openPanel,
  close:         closePanel,
  analyze:       _runAnalysis,
  renderHeatmap: _renderHeatmap,
  getData ()     { return _data; },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
