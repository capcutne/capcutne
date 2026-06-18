/* ============================================================
   TRANSCRIPT INTELLIGENCE LAYER — js/transcript.js
   Phase 1.6: Unified transcript powering Shorts, Copilot,
   Subtitle Engine, and timeline navigation.

   Storage:
     cc_transcripts  — {assetId: {language, generatedAt, segments[]}}
   Segments:  {start:number, end:number, text:string}

   Public API:
     TranscriptEngine.open()
     TranscriptEngine.close()
     TranscriptEngine.generate()
     TranscriptEngine.getTranscript()        → segments[]
     TranscriptEngine.search(query)          → [{text,start}]
     TranscriptEngine.jumpTo(time)
     TranscriptEngine.export(format)         → 'txt'|'json'|'srt'
     TranscriptEngine.loadFromProject(data)  → called by ProjectManager
     TranscriptEngine.serializeForProject()  → called by ProjectManager
   ============================================================ */

(function () {

/* ── Storage ─────────────────────────────────────────────── */
const LS_KEY = 'cc_transcripts';
let _transcripts = {};   // assetId → {language, generatedAt, segments}
let _activeId    = 'default';

function _lsLoad () {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) _transcripts = JSON.parse(v);
  } catch { _transcripts = {}; }
}
function _lsSave () {
  try { localStorage.setItem(LS_KEY, JSON.stringify(_transcripts)); } catch {}
}

/* ── Panel HTML ──────────────────────────────────────────── */
function _createPanel () {
  if (document.getElementById('transcript-panel')) return;

  const el = document.createElement('div');
  el.id = 'transcript-panel';
  el.innerHTML = `
<div class="tr-header">
  <div class="tr-header-left">
    <svg class="ic" width="15" height="15" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
    <span>Transcript</span>
  </div>
  <div style="display:flex;align-items:center;gap:6px">
    <div class="tr-export-wrap">
      <button class="tr-export-btn" title="Export transcript" onclick="TranscriptEngine._toggleExportMenu()">⬇ Export</button>
      <div class="tr-export-menu" id="tr-export-menu" style="display:none">
        <button onclick="TranscriptEngine.export('txt')">📄 TXT</button>
        <button onclick="TranscriptEngine.export('srt')">💬 SRT</button>
        <button onclick="TranscriptEngine.export('json')">{ } JSON</button>
      </div>
    </div>
    <button class="tr-close" onclick="TranscriptEngine.close()">✕</button>
  </div>
</div>

<div class="tr-search-wrap">
  <input class="tr-search" id="tr-search" type="text" placeholder="🔍 Search transcript…"
    oninput="TranscriptEngine._onSearch(this.value)">
  <button class="tr-search-clear" id="tr-search-clear" onclick="TranscriptEngine._clearSearch()" style="display:none">✕</button>
</div>

<div class="tr-gen-wrap" id="tr-gen-wrap">
  <button class="tr-gen-btn" id="tr-gen-btn" onclick="TranscriptEngine.generate()">
    <svg class="ic" width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
    Generate Transcript
  </button>
  <div class="tr-gen-note">AI analyzes your timeline clips and subtitles to create a timestamped transcript.</div>
</div>

<div class="tr-status" id="tr-status" style="display:none"></div>

<div class="tr-segments" id="tr-segments">
  <div class="tr-empty">No transcript yet.<br>Click Generate to create one.</div>
</div>`;

  document.body.appendChild(el);
  _injectStyles();
}

/* ── CSS ─────────────────────────────────────────────────── */
function _injectStyles () {
  if (document.getElementById('tr-styles')) return;
  const st = document.createElement('style');
  st.id = 'tr-styles';
  st.textContent = `
#transcript-panel {
  position:fixed;left:-380px;top:0;width:360px;height:100vh;
  background:var(--bg1);border-right:1px solid var(--border);
  display:flex;flex-direction:column;z-index:900;
  transition:left .22s cubic-bezier(.4,0,.2,1);
  box-shadow:4px 0 24px rgba(0,0,0,.4);
}
#transcript-panel.open { left:48px; }

.tr-header {
  height:42px;display:flex;align-items:center;justify-content:space-between;
  padding:0 14px;border-bottom:1px solid var(--border);flex-shrink:0;gap:8px;
}
.tr-header-left {
  display:flex;align-items:center;gap:7px;
  font-size:11px;font-weight:700;letter-spacing:.5px;
  text-transform:uppercase;color:var(--t2);
}
.tr-header-left svg { stroke:var(--accent); }
.tr-close {
  background:none;border:none;color:var(--t3);cursor:pointer;
  width:22px;height:22px;border-radius:5px;font-size:13px;
  display:flex;align-items:center;justify-content:center;
}
.tr-close:hover{background:var(--bg3);color:var(--t1)}

.tr-export-wrap { position:relative; }
.tr-export-btn {
  background:var(--bg3);border:1px solid var(--border2);border-radius:6px;
  color:var(--t2);font-size:10px;padding:4px 9px;cursor:pointer;
  transition:background .1s;
}
.tr-export-btn:hover{background:var(--bg4);color:var(--t1)}
.tr-export-menu {
  position:absolute;right:0;top:calc(100% + 4px);
  background:var(--bg2);border:1px solid var(--border2);border-radius:8px;
  padding:4px;display:flex;flex-direction:column;gap:2px;z-index:999;min-width:110px;
  box-shadow:0 4px 16px rgba(0,0,0,.4);
}
.tr-export-menu button {
  background:none;border:none;color:var(--t2);font-size:11px;
  padding:6px 10px;border-radius:5px;cursor:pointer;text-align:left;
}
.tr-export-menu button:hover{background:var(--bg3);color:var(--t1)}

.tr-search-wrap {
  padding:10px 12px 6px;display:flex;align-items:center;gap:6px;flex-shrink:0;
  border-bottom:1px solid var(--border);
}
.tr-search {
  flex:1;background:var(--bg2);border:1px solid var(--border2);
  border-radius:7px;color:var(--t1);font-size:12px;
  padding:6px 10px;outline:none;font-family:inherit;
  transition:border-color .15s;
}
.tr-search:focus{border-color:rgba(212,160,23,.5)}
.tr-search::placeholder{color:var(--t3)}
.tr-search-clear {
  background:none;border:none;color:var(--t3);cursor:pointer;
  font-size:12px;padding:2px 4px;border-radius:4px;flex-shrink:0;
}
.tr-search-clear:hover{color:var(--t1)}

.tr-gen-wrap {
  padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;
  border-bottom:1px solid var(--border);flex-shrink:0;
}
.tr-gen-btn {
  background:var(--accent);border:none;border-radius:8px;color:#000;
  padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;gap:6px;transition:opacity .15s;
}
.tr-gen-btn:hover{opacity:.88}
.tr-gen-btn:disabled{opacity:.4;cursor:not-allowed}
.tr-gen-note {
  font-size:10px;color:var(--t3);text-align:center;line-height:1.5;
}

.tr-status {
  padding:8px 14px;font-size:11px;text-align:center;flex-shrink:0;
  border-bottom:1px solid var(--border);
}
.tr-status.info{color:var(--t2)}
.tr-status.ok{color:#4caf50}
.tr-status.warn{color:#e57373}

.tr-segments {
  flex:1;overflow-y:auto;padding:8px 6px;display:flex;flex-direction:column;gap:2px;
}
.tr-segments::-webkit-scrollbar{width:4px}
.tr-segments::-webkit-scrollbar-thumb{background:var(--bg5);border-radius:2px}

.tr-empty {
  padding:24px 16px;text-align:center;font-size:11px;
  color:var(--t3);line-height:1.8;
}
.tr-seg {
  display:flex;align-items:flex-start;gap:8px;padding:7px 9px;
  border-radius:7px;cursor:pointer;transition:background .1s;
  border:1px solid transparent;
}
.tr-seg:hover { background:var(--bg3); border-color:var(--border); }
.tr-seg.active { background:rgba(212,160,23,.12); border-color:var(--accent); }
.tr-seg.highlight { background:rgba(212,160,23,.2); }
.tr-seg-time {
  font-size:10px;font-weight:700;color:var(--accent);
  white-space:nowrap;padding-top:1px;min-width:38px;font-variant-numeric:tabular-nums;
}
.tr-seg-text { font-size:12px;color:var(--t1);line-height:1.5;flex:1; }
.tr-seg-text mark { background:rgba(212,160,23,.35);color:var(--t1);border-radius:2px;padding:0 1px; }

.tr-no-results {
  padding:20px 16px;text-align:center;font-size:11px;color:var(--t3);
}
`;
  document.head.appendChild(st);
}

/* ── Generate ────────────────────────────────────────────── */
async function generate () {
  const btn    = document.getElementById('tr-gen-btn');
  const status = document.getElementById('tr-status');
  if (!btn) return;

  const totalDur = _totalDuration();
  if (totalDur < 1) {
    _setStatus('⚠️ Add some clips to the timeline first.', 'warn');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';
  _setStatus('Sending timeline to AI — generating transcript…', 'info');

  const payload = {
    editorState: {
      tracks: (typeof tracks !== 'undefined' ? tracks : []).map(tr => ({
        type: tr.type,
        label: tr.label || '',
        clips: (tr.clips || []).map(c => ({
          id: c.id, label: c.label || '', start: +c.start.toFixed(2), dur: +(c.dur || 0).toFixed(2)
        }))
      })),
      subtitles: (typeof subtitles !== 'undefined' ? subtitles : []).map(s => ({
        start: +s.start.toFixed(2), dur: +(s.dur || 3).toFixed(2), text: s.text || ''
      })).slice(0, 40),
      totalDuration: +totalDur.toFixed(2)
    }
  };

  try {
    const res = await fetch('/ai/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.error) {
      _setStatus('⚠️ ' + data.error, 'warn');
    } else {
      const segs = data.transcript || [];
      _transcripts[_activeId] = {
        language: data.language || 'en',
        generatedAt: new Date().toISOString(),
        segments: segs
      };
      _lsSave();
      _setStatus(`✓ ${segs.length} segment${segs.length !== 1 ? 's' : ''} — click any line to jump`, 'ok');
      _renderSegments(segs, '');
      _hideGenWrap();
      if (typeof toast === 'function')
        toast(`📝 Transcript generated — ${segs.length} segments`);
    }
  } catch (e) {
    _setStatus('❌ Network error: ' + e.message, 'warn');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="ic" width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg> Regenerate`;
  }
}

/* ── Render segments ─────────────────────────────────────── */
function _renderSegments (segs, query) {
  const el = document.getElementById('tr-segments');
  if (!el) return;

  if (!segs || !segs.length) {
    el.innerHTML = '<div class="tr-empty">No transcript yet.<br>Click Generate to create one.</div>';
    return;
  }

  const q = (query || '').trim().toLowerCase();
  let filtered = segs;
  if (q) {
    filtered = segs.filter(s => s.text && s.text.toLowerCase().includes(q));
  }

  if (q && !filtered.length) {
    el.innerHTML = '<div class="tr-no-results">No results for "' + _esc(query) + '"</div>';
    return;
  }

  el.innerHTML = filtered.map((s, i) => {
    const tFmt  = _fmt(s.start);
    let   text  = _esc(s.text || '');
    if (q) {
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      text = text.replace(re, '<mark>$1</mark>');
    }
    return `<div class="tr-seg" data-start="${s.start}" data-idx="${i}"
      onclick="TranscriptEngine.jumpTo(${s.start})">
      <span class="tr-seg-time">${tFmt}</span>
      <span class="tr-seg-text">${text}</span>
    </div>`;
  }).join('');
}

/* ── Active segment highlighting ────────────────────────── */
function _updateActive () {
  const segs = _getCurrentSegs();
  if (!segs.length) return;
  const ph  = typeof playhead !== 'undefined' ? playhead : 0;
  const els = document.querySelectorAll('#tr-segments .tr-seg');
  els.forEach(el => {
    const start = parseFloat(el.dataset.start);
    const idx   = parseInt(el.dataset.idx, 10);
    const nextSeg = segs[idx + 1];
    const end   = nextSeg ? nextSeg.start : start + 30;
    el.classList.toggle('active', ph >= start && ph < end);
  });
}

/* ── Search ──────────────────────────────────────────────── */
function _onSearch (val) {
  const clear = document.getElementById('tr-search-clear');
  if (clear) clear.style.display = val ? 'block' : 'none';
  _renderSegments(_getCurrentSegs(), val);
}

function _clearSearch () {
  const inp = document.getElementById('tr-search');
  if (inp) inp.value = '';
  const clear = document.getElementById('tr-search-clear');
  if (clear) clear.style.display = 'none';
  _renderSegments(_getCurrentSegs(), '');
}

function search (query) {
  const segs = _getCurrentSegs();
  if (!query) return segs.map(s => ({ text: s.text, start: s.start }));
  const q = query.toLowerCase();
  return segs
    .filter(s => s.text && s.text.toLowerCase().includes(q))
    .map(s => ({ text: s.text, start: s.start }));
}

/* ── Jump to timestamp ───────────────────────────────────── */
function jumpTo (time) {
  if (typeof playhead !== 'undefined') playhead = +time;

  // Scroll timeline to that position
  const tlScroll = document.getElementById('tl-scroll');
  if (tlScroll && typeof pxPerSec !== 'undefined') {
    tlScroll.scrollLeft = Math.max(0, time * pxPerSec - 120);
  }

  if (typeof renderAll === 'function') renderAll();
  else if (typeof _renderPlayhead === 'function') _renderPlayhead();

  // Highlight the clicked row
  document.querySelectorAll('#tr-segments .tr-seg').forEach(el => {
    el.classList.toggle('highlight', parseFloat(el.dataset.start) === +time);
  });
  setTimeout(() => {
    document.querySelectorAll('#tr-segments .tr-seg.highlight')
      .forEach(el => el.classList.remove('highlight'));
  }, 800);
}

/* ── Export ──────────────────────────────────────────────── */
function exportTranscript (format) {
  const segs = _getCurrentSegs();
  if (!segs.length) {
    if (typeof toast === 'function') toast('⚠️ No transcript to export');
    return;
  }

  let content = '', mime = 'text/plain', ext = 'txt';

  if (format === 'json') {
    content = JSON.stringify({ transcript: segs }, null, 2);
    mime = 'application/json'; ext = 'json';
  } else if (format === 'srt') {
    content = segs.map((s, i) => {
      const end = segs[i + 1] ? segs[i + 1].start : s.start + 5;
      return `${i + 1}\n${_srtTime(s.start)} --> ${_srtTime(end)}\n${s.text}\n`;
    }).join('\n');
    ext = 'srt';
  } else {
    content = segs.map(s => `[${_fmt(s.start)}] ${s.text}`).join('\n');
  }

  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `transcript.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  _toggleExportMenu();
  if (typeof toast === 'function') toast(`📄 Transcript exported as .${ext}`);
}

function _toggleExportMenu () {
  const m = document.getElementById('tr-export-menu');
  if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

/* ── Project persistence hooks ───────────────────────────── */
function serializeForProject () {
  return { transcripts: _transcripts };
}

function loadFromProject (data) {
  if (data && data.transcripts) {
    _transcripts = data.transcripts;
    _lsSave();
    // Re-render if panel is open
    const panel = document.getElementById('transcript-panel');
    if (panel && panel.classList.contains('open')) {
      _renderSegments(_getCurrentSegs(), '');
      if (_getCurrentSegs().length) _hideGenWrap();
    }
  }
}

/* ── Open / Close ────────────────────────────────────────── */
function open () {
  _createPanel();
  const panel = document.getElementById('transcript-panel');
  if (panel) panel.classList.add('open');
  _renderSegments(_getCurrentSegs(), '');
  if (_getCurrentSegs().length) _hideGenWrap();
}

function close () {
  const panel = document.getElementById('transcript-panel');
  if (panel) panel.classList.remove('open');
  document.querySelectorAll('#lsb .tb').forEach(b => {
    if ((b.getAttribute('onclick') || '').includes("'transcript'")) b.classList.remove('on');
  });
}

/* ── Hook into setTool ───────────────────────────────────── */
const _origSetTool = window.setTool;
window.setTool = function (el, name) {
  if (name === 'transcript') {
    const p = document.getElementById('transcript-panel');
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

/* ── Helpers ─────────────────────────────────────────────── */
function _getCurrentSegs () {
  return (_transcripts[_activeId] || {}).segments || [];
}
function _hideGenWrap () {
  const gw = document.getElementById('tr-gen-wrap');
  if (gw) { gw.style.borderBottom = 'none'; gw.style.padding = '6px 12px'; }
  const btn = document.getElementById('tr-gen-btn');
  if (btn) {
    btn.style.fontSize = '10px';
    btn.style.padding  = '4px 10px';
  }
  const note = gw && gw.querySelector('.tr-gen-note');
  if (note) note.style.display = 'none';
}
function _setStatus (msg, type) {
  const el = document.getElementById('tr-status');
  if (!el) return;
  el.textContent  = msg;
  el.style.display = 'block';
  el.className    = 'tr-status ' + (type || 'info');
}
function _totalDuration () {
  if (typeof tracks === 'undefined') return 0;
  return tracks.reduce((m, tr) =>
    (tr.clips || []).reduce((mm, c) => Math.max(mm, c.start + (c.dur || 0)), m), 0);
}
function _fmt (t) {
  if (typeof fmt === 'function') return fmt(t);
  const s = Math.floor(t), mi = Math.floor(s / 60);
  return mi + ':' + String(s % 60).padStart(2, '0');
}
function _srtTime (t) {
  const h  = Math.floor(t / 3600);
  const mi = Math.floor((t % 3600) / 60);
  const s  = Math.floor(t % 60);
  const ms = Math.round((t % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}
function _esc (s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Hook into ProjectManager serialization ──────────────── */
(function _patchProjectManager () {
  function _tryPatch () {
    if (typeof ProjectManager === 'undefined') return false;

    const origSerialize = ProjectManager._serializeExtra;
    const origDeserialize = ProjectManager._deserializeExtra;

    ProjectManager._serializeExtra = function (payload) {
      if (typeof origSerialize === 'function') origSerialize(payload);
      payload.transcriptData = serializeForProject();
    };
    ProjectManager._deserializeExtra = function (payload) {
      if (typeof origDeserialize === 'function') origDeserialize(payload);
      if (payload.transcriptData) loadFromProject(payload.transcriptData);
    };
    return true;
  }
  if (!_tryPatch()) {
    const id = setInterval(() => { if (_tryPatch()) clearInterval(id); }, 300);
  }
})();

/* ── Upgrade AI Shorts Generator to use transcript ──────── */
(function _upgradeShorts () {
  function _tryUpgrade () {
    if (typeof ShortsGen === 'undefined' || ShortsGen._transcriptUpgraded) return false;
    ShortsGen._transcriptUpgraded = true;

    const origGenerate = ShortsGen.generate;
    ShortsGen.generate = async function () {
      const segs = _getCurrentSegs();
      if (segs.length > 0) {
        // Inject transcript into global for the shorts endpoint to pick up
        window._activeTranscriptSegs = segs;
      }
      return origGenerate.apply(this, arguments);
    };
    return true;
  }
  if (!_tryUpgrade()) {
    const id = setInterval(() => { if (_tryUpgrade()) clearInterval(id); }, 400);
  }
})();

/* ── Upgrade AI Copilot with transcript-aware chips ─────── */
(function _upgradecopilot () {
  function _tryUpgrade () {
    const panel = document.getElementById('ai-copilot-panel');
    if (!panel || panel._trUpgraded) return false;
    panel._trUpgraded = true;

    const examplesDiv = panel.querySelector('.acp-examples');
    if (!examplesDiv) return true;

    const chips = [
      { emoji: '🔍', text: 'Find where pricing is mentioned', prompt: 'Find where I mention pricing in the transcript and jump to that moment' },
      { emoji: '😮', text: 'Find emotional moments', prompt: 'Find the most emotional moments in the transcript' },
      { emoji: '📢', text: 'Find the CTA', prompt: 'Find the call to action in the transcript and jump to it' },
    ];
    chips.forEach(c => {
      const btn = document.createElement('button');
      btn.className  = 'acp-ex-chip';
      btn.dataset.prompt = c.prompt;
      btn.textContent = c.emoji + ' ' + c.text;
      btn.addEventListener('click', () => {
        const inp = document.getElementById('acp-input');
        if (inp) { inp.value = c.prompt; inp.focus(); }
      });
      examplesDiv.appendChild(btn);
    });
    return true;
  }
  if (!_tryUpgrade()) {
    const id = setInterval(() => { if (_tryUpgrade()) clearInterval(id); }, 500);
  }
})();

/* ── Init ────────────────────────────────────────────────── */
_lsLoad();

/* ── Public API ──────────────────────────────────────────── */
window.TranscriptEngine = {
  open, close, generate,
  getTranscript: () => ({ ..._transcripts[_activeId] }),
  getSegments:   _getCurrentSegs,
  search,
  jumpTo,
  export: exportTranscript,
  serializeForProject,
  loadFromProject,
  _onSearch, _clearSearch,
  _toggleExportMenu,
};

console.log('[TranscriptEngine] Transcript Intelligence Layer v1.6 loaded');

})();
