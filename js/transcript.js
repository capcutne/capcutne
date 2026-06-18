/* ============================================================
   TRANSCRIPT INTELLIGENCE LAYER — js/transcript.js
   Phase 1.7: Real Whisper speech-to-text + word-level timestamps
              + confidence scores + stats + multi-asset support.

   Storage key: cc_transcripts
   Schema per assetId:
     { language, generatedAt, confidence, wordCount, speakingRate,
       duration, source:"whisper"|"ai",
       segments: [{start, end, text, confidence, words:[{word,start,end,confidence}]}] }

   Public API:
     TranscriptEngine.open()
     TranscriptEngine.close()
     TranscriptEngine.generate()            — AI-inferred (GPT)
     TranscriptEngine.transcribeReal(file)  — Whisper (real speech)
     TranscriptEngine.getTranscript()       → current transcript object
     TranscriptEngine.getSegments()         → segments[]
     TranscriptEngine.search(query)         → [{text,start}]
     TranscriptEngine.jumpTo(time)
     TranscriptEngine.export(format)        'txt'|'json'|'srt'
     TranscriptEngine.serializeForProject() → called by ProjectManager
     TranscriptEngine.loadFromProject(data) → called by ProjectManager
   ============================================================ */

(function () {

/* ── Storage ─────────────────────────────────────────────── */
const LS_KEY  = 'cc_transcripts';
let _transcripts = {};   // assetId → transcript object
let _activeId    = 'default';

function _lsLoad () {
  try { const v = localStorage.getItem(LS_KEY); if (v) _transcripts = JSON.parse(v); }
  catch { _transcripts = {}; }
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
    <span class="tr-source-badge" id="tr-source-badge" style="display:none"></span>
  </div>
  <div style="display:flex;align-items:center;gap:6px">
    <div class="tr-export-wrap">
      <button class="tr-export-btn" onclick="TranscriptEngine._toggleExportMenu()">⬇ Export</button>
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

<!-- Stats bar (shown after transcription) -->
<div class="tr-stats" id="tr-stats" style="display:none">
  <div class="tr-stat" id="ts-lang"><span class="ts-label">Lang</span><span class="ts-val" id="ts-lang-val">—</span></div>
  <div class="tr-stat" id="ts-words"><span class="ts-label">Words</span><span class="ts-val" id="ts-words-val">—</span></div>
  <div class="tr-stat" id="ts-rate"><span class="ts-label">WPM</span><span class="ts-val" id="ts-rate-val">—</span></div>
  <div class="tr-stat" id="ts-conf"><span class="ts-label">Confidence</span><span class="ts-val" id="ts-conf-val">—</span></div>
</div>

<!-- Generate controls -->
<div class="tr-gen-wrap" id="tr-gen-wrap">
  <div class="tr-gen-row">
    <button class="tr-gen-btn" id="tr-gen-btn" onclick="TranscriptEngine.generate()">
      ✦ AI Transcript
    </button>
    <button class="tr-whisper-btn" id="tr-whisper-btn" onclick="TranscriptEngine._pickAndTranscribe()">
      🎙 Whisper
    </button>
  </div>
  <div class="tr-asset-row" id="tr-asset-row" style="display:none">
    <label class="tr-asset-label">Asset:</label>
    <select class="tr-asset-sel" id="tr-asset-sel" onchange="TranscriptEngine._onAssetChange(this.value)"></select>
  </div>
  <div class="tr-gen-note" id="tr-gen-note">
    <b>AI Transcript</b> — infers speech from clip labels &amp; subtitles.<br>
    <b>🎙 Whisper</b> — uploads your audio/video for real speech-to-text.
  </div>
  <!-- Hidden file input -->
  <input type="file" id="tr-file-input" accept="video/*,audio/*"
    style="display:none" onchange="TranscriptEngine._onFileChosen(this)">
</div>

<div class="tr-progress" id="tr-progress" style="display:none">
  <div class="tr-progress-bar"><div class="tr-progress-fill" id="tr-progress-fill"></div></div>
  <div class="tr-progress-label" id="tr-progress-label">Uploading…</div>
</div>

<div class="tr-status" id="tr-status" style="display:none"></div>

<div class="tr-segments" id="tr-segments">
  <div class="tr-empty">No transcript yet.<br>Click a button above to create one.</div>
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
  padding:0 12px;border-bottom:1px solid var(--border);flex-shrink:0;gap:8px;
}
.tr-header-left {
  display:flex;align-items:center;gap:6px;
  font-size:11px;font-weight:700;letter-spacing:.5px;
  text-transform:uppercase;color:var(--t2);
}
.tr-header-left .ic { stroke:var(--accent); }
.tr-source-badge {
  background:rgba(76,175,80,.15);border:1px solid rgba(76,175,80,.3);
  color:#4caf50;font-size:9px;font-weight:700;letter-spacing:.4px;
  padding:1px 5px;border-radius:4px;text-transform:uppercase;
}
.tr-source-badge.ai-badge {
  background:rgba(130,80,255,.15);border-color:rgba(130,80,255,.3);color:#b080ff;
}
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
  padding:4px;flex-direction:column;gap:2px;z-index:999;min-width:110px;
  box-shadow:0 4px 16px rgba(0,0,0,.4);
}
.tr-export-menu button {
  background:none;border:none;color:var(--t2);font-size:11px;
  padding:6px 10px;border-radius:5px;cursor:pointer;text-align:left;display:block;width:100%;
}
.tr-export-menu button:hover{background:var(--bg3);color:var(--t1)}

/* Stats bar */
.tr-stats {
  display:flex;gap:0;border-bottom:1px solid var(--border);flex-shrink:0;
}
.tr-stat {
  flex:1;display:flex;flex-direction:column;align-items:center;padding:6px 4px;
  border-right:1px solid var(--border);
}
.tr-stat:last-child { border-right:none; }
.ts-label { font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.4px; }
.ts-val   { font-size:12px;font-weight:700;color:var(--t1);margin-top:1px; }

/* Search */
.tr-search-wrap {
  padding:8px 10px 6px;display:flex;align-items:center;gap:6px;flex-shrink:0;
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

/* Gen controls */
.tr-gen-wrap {
  padding:10px 12px;display:flex;flex-direction:column;gap:7px;
  border-bottom:1px solid var(--border);flex-shrink:0;
}
.tr-gen-row { display:flex;gap:7px; }
.tr-gen-btn {
  flex:1;background:rgba(130,80,255,.15);border:1px solid rgba(130,80,255,.35);
  border-radius:8px;color:#c0a0ff;
  padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:5px;
  transition:background .15s;
}
.tr-gen-btn:hover{background:rgba(130,80,255,.25)}
.tr-gen-btn:disabled{opacity:.4;cursor:not-allowed}
.tr-whisper-btn {
  flex:1;background:var(--accent);border:none;border-radius:8px;color:#000;
  padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:5px;
  transition:opacity .15s;
}
.tr-whisper-btn:hover{opacity:.88}
.tr-whisper-btn:disabled{opacity:.4;cursor:not-allowed}

.tr-asset-row {
  display:flex;align-items:center;gap:7px;
}
.tr-asset-label { font-size:10px;color:var(--t3);white-space:nowrap; }
.tr-asset-sel {
  flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;
  color:var(--t1);font-size:11px;padding:4px 8px;outline:none;
}
.tr-gen-note {
  font-size:10px;color:var(--t3);line-height:1.6;
  background:var(--bg2);border-radius:6px;padding:7px 9px;
}
.tr-gen-note b { color:var(--t2); }

/* Progress bar */
.tr-progress {
  padding:10px 14px 8px;display:flex;flex-direction:column;gap:5px;
  flex-shrink:0;border-bottom:1px solid var(--border);
}
.tr-progress-bar {
  height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;
}
.tr-progress-fill {
  height:100%;background:var(--accent);border-radius:2px;width:0%;
  transition:width .3s ease;
}
.tr-progress-label { font-size:10px;color:var(--t3);text-align:center; }

/* Status */
.tr-status {
  padding:7px 14px;font-size:11px;text-align:center;flex-shrink:0;
  border-bottom:1px solid var(--border);
}
.tr-status.info{color:var(--t2)}
.tr-status.ok{color:#4caf50}
.tr-status.warn{color:#e57373}

/* Segments */
.tr-segments {
  flex:1;overflow-y:auto;padding:6px 4px;display:flex;flex-direction:column;gap:1px;
}
.tr-segments::-webkit-scrollbar{width:4px}
.tr-segments::-webkit-scrollbar-thumb{background:var(--bg5);border-radius:2px}

.tr-empty,.tr-no-results {
  padding:24px 16px;text-align:center;font-size:11px;color:var(--t3);line-height:1.8;
}

.tr-seg {
  display:flex;flex-direction:column;padding:7px 9px;
  border-radius:7px;cursor:pointer;transition:background .1s;
  border:1px solid transparent;
}
.tr-seg:hover { background:var(--bg3); border-color:var(--border); }
.tr-seg.active { background:rgba(212,160,23,.1); border-color:rgba(212,160,23,.4); }
.tr-seg.highlight { background:rgba(212,160,23,.2); }

.tr-seg-top { display:flex;align-items:flex-start;gap:8px; }
.tr-seg-time {
  font-size:10px;font-weight:700;color:var(--accent);
  white-space:nowrap;padding-top:1px;min-width:38px;font-variant-numeric:tabular-nums;
}
.tr-seg-text { font-size:12px;color:var(--t1);line-height:1.5;flex:1; }
.tr-seg-text mark { background:rgba(212,160,23,.35);color:var(--t1);border-radius:2px;padding:0 1px; }

/* Confidence bar (whisper segments) */
.tr-conf-row {
  display:flex;align-items:center;gap:6px;margin-top:4px;padding-left:46px;
}
.tr-conf-bar {
  flex:1;height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;
}
.tr-conf-fill {
  height:100%;border-radius:1px;transition:width .3s;
}
.tr-conf-fill.high { background:#4caf50; }
.tr-conf-fill.mid  { background:var(--accent); }
.tr-conf-fill.low  { background:#e57373; }
.tr-conf-pct { font-size:9px;color:var(--t3);white-space:nowrap; }

/* Word tooltip */
.tr-words {
  display:flex;flex-wrap:wrap;gap:3px;padding:5px 0 1px 46px;
}
.tr-word {
  font-size:10px;padding:1px 5px;border-radius:4px;cursor:default;
  border:1px solid var(--border2);color:var(--t2);background:var(--bg2);
  transition:background .1s;
}
.tr-word.w-high { border-color:rgba(76,175,80,.4);color:#4caf50;background:rgba(76,175,80,.08); }
.tr-word.w-mid  { border-color:rgba(212,160,23,.4);color:var(--accent);background:rgba(212,160,23,.08); }
.tr-word.w-low  { border-color:rgba(229,115,115,.4);color:#e57373;background:rgba(229,115,115,.08); }
.tr-word:hover  { background:var(--bg4); }
`;
  document.head.appendChild(st);
}

/* ── AI Generate (GPT-inferred) ──────────────────────────── */
async function generate () {
  const btn = document.getElementById('tr-gen-btn');
  if (!btn) return;
  const totalDur = _totalDuration();
  if (totalDur < 1) { _setStatus('⚠️ Add some clips first.', 'warn'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';
  _setStatus('Sending timeline to AI…', 'info');

  const payload = {
    editorState: {
      tracks: (typeof tracks !== 'undefined' ? tracks : []).map(tr => ({
        type: tr.type, label: tr.label || '',
        clips: (tr.clips || []).map(c => ({
          id: c.id, label: c.label || '',
          start: +c.start.toFixed(2), dur: +(c.dur || 0).toFixed(2)
        }))
      })),
      subtitles: (typeof subtitles !== 'undefined' ? subtitles : []).map(s => ({
        start: +s.start.toFixed(2), dur: +(s.dur || 3).toFixed(2), text: s.text || ''
      })).slice(0, 40),
      totalDuration: +totalDur.toFixed(2)
    }
  };

  try {
    const res  = await fetch('/ai/transcribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.error) { _setStatus('⚠️ ' + data.error, 'warn'); return; }

    const segs = data.transcript || [];
    const wordCount = segs.reduce((n, s) => n + (s.text || '').split(/\s+/).filter(Boolean).length, 0);
    _storeTranscript(_activeId, {
      language: data.language || 'en', source: 'ai',
      confidence: null, wordCount,
      speakingRate: totalDur > 0 ? Math.round(wordCount / (totalDur / 60)) : 0,
      segments: segs,
    });
    _setStatus(`✓ ${segs.length} segments — click any line to jump`, 'ok');
    _renderAll();
    if (typeof toast === 'function') toast(`📝 AI transcript — ${segs.length} segments`);
  } catch (e) {
    _setStatus('❌ ' + e.message, 'warn');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ AI Transcript';
  }
}

/* ── Whisper: file picker → upload → transcribe ─────────── */
function _pickAndTranscribe () {
  // If MediaManager has assets, show asset selector; otherwise open file picker
  const assets = _getMediaAssets().filter(a => a.type === 'video' || a.type === 'audio');
  if (assets.length > 0) {
    _populateAssetPicker(assets);
    const row = document.getElementById('tr-asset-row');
    if (row) row.style.display = 'flex';
  } else {
    document.getElementById('tr-file-input')?.click();
  }
}

function _onAssetChange (assetId) {
  if (!assetId) return;
  const assets = _getMediaAssets();
  const asset  = assets.find(a => a.id === assetId);
  if (!asset || !asset.objUrl) {
    _setStatus('⚠️ Asset not available this session — upload its file again.', 'warn');
    return;
  }
  // Fetch blob URL → File → transcribe
  _fetchBlobAndTranscribe(asset.objUrl, asset.name || 'asset');
}

function _onFileChosen (input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  transcribeReal(file);
}

async function _fetchBlobAndTranscribe (blobUrl, name) {
  try {
    _setProgress(5, 'Fetching asset from browser…');
    const resp = await fetch(blobUrl);
    const blob = await resp.blob();
    const file = new File([blob], name, { type: blob.type });
    transcribeReal(file);
  } catch (e) {
    _setStatus('❌ Could not read asset: ' + e.message, 'warn');
    _hideProgress();
  }
}

async function transcribeReal (file) {
  if (!file) { document.getElementById('tr-file-input')?.click(); return; }

  const whisperBtn = document.getElementById('tr-whisper-btn');
  const genBtn     = document.getElementById('tr-gen-btn');
  if (whisperBtn) whisperBtn.disabled = true;
  if (genBtn)     genBtn.disabled     = true;

  const MAX_MB = 200;
  if (file.size > MAX_MB * 1024 * 1024) {
    _setStatus(`❌ File is ${(file.size/1024/1024).toFixed(0)} MB — max is ${MAX_MB} MB`, 'warn');
    _hideProgress();
    _resetBtns();
    return;
  }

  try {
    /* ── Step 1: Upload ────────────────────────────────── */
    _setProgress(0, `Uploading ${(file.size/1024/1024).toFixed(1)} MB…`);
    const form = new FormData();
    form.append('file', file, file.name);

    const xhr = new XMLHttpRequest();
    const uploadResult = await new Promise((resolve, reject) => {
      xhr.open('POST', '/ai/upload-media');
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) _setProgress(Math.round(e.loaded / e.total * 45), 'Uploading…');
      };
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Upload response parse error')); }
      };
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.send(form);
    });

    if (uploadResult.error) throw new Error(uploadResult.error);
    _setProgress(50, 'Upload complete — running FFmpeg + Whisper…');

    /* ── Step 2: Transcribe ────────────────────────────── */
    _setProgress(55, 'Whisper transcribing speech…');
    const res = await fetch('/ai/transcribe-real', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: uploadResult.fileId, filename: uploadResult.filename })
    });
    _setProgress(90, 'Processing transcript…');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const segs = data.transcript || [];
    _storeTranscript(_activeId, {
      language:     data.language     || 'en',
      source:       'whisper',
      confidence:   data.confidence   ?? null,
      wordCount:    data.wordCount    || 0,
      speakingRate: data.speakingRate || 0,
      duration:     data.duration     || 0,
      segments:     segs,
    });

    _setProgress(100, 'Done!');
    setTimeout(_hideProgress, 800);
    _setStatus(`🎙 Whisper: ${segs.length} segments · ${data.wordCount} words · ${data.language}`, 'ok');
    _renderAll();
    if (typeof toast === 'function')
      toast(`🎙 Whisper transcript — ${segs.length} segments, ${data.wordCount} words`);

  } catch (e) {
    _setStatus('❌ ' + e.message, 'warn');
    _hideProgress();
  } finally {
    _resetBtns();
  }
}

/* ── Render everything ───────────────────────────────────── */
function _renderAll () {
  const tr = _getCurrentTranscript();
  _renderStats(tr);
  _renderSegments(tr ? tr.segments : [], '');
  _renderSourceBadge(tr ? tr.source : null);
  if (tr && tr.segments && tr.segments.length) _collapseGenWrap();
}

function _renderStats (tr) {
  const el = document.getElementById('tr-stats');
  if (!el) return;
  if (!tr || !tr.segments || !tr.segments.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  _setStatVal('ts-lang-val',  (tr.language || '—').toUpperCase());
  _setStatVal('ts-words-val', tr.wordCount ? tr.wordCount.toLocaleString() : '—');
  _setStatVal('ts-rate-val',  tr.speakingRate ? tr.speakingRate : '—');
  if (tr.confidence != null) {
    const pct = Math.round(tr.confidence * 100);
    const el2 = document.getElementById('ts-conf-val');
    if (el2) {
      el2.textContent = pct + '%';
      el2.style.color = pct >= 80 ? '#4caf50' : pct >= 60 ? 'var(--accent)' : '#e57373';
    }
  } else {
    _setStatVal('ts-conf-val', tr.source === 'ai' ? 'AI' : '—');
  }
}

function _setStatVal (id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _renderSourceBadge (source) {
  const el = document.getElementById('tr-source-badge');
  if (!el) return;
  if (!source) { el.style.display = 'none'; return; }
  el.style.display = 'inline-block';
  if (source === 'whisper') {
    el.textContent = '🎙 Whisper';
    el.className = 'tr-source-badge';
  } else {
    el.textContent = '✦ AI';
    el.className = 'tr-source-badge ai-badge';
  }
}

function _renderSegments (segs, query) {
  const el = document.getElementById('tr-segments');
  if (!el) return;
  if (!segs || !segs.length) {
    el.innerHTML = '<div class="tr-empty">No transcript yet.<br>Click a button above to create one.</div>';
    return;
  }
  const q = (query || '').trim().toLowerCase();
  let filtered = segs;
  if (q) filtered = segs.filter(s => s.text && s.text.toLowerCase().includes(q));
  if (q && !filtered.length) {
    el.innerHTML = '<div class="tr-no-results">No results for "' + _esc(query) + '"</div>';
    return;
  }

  el.innerHTML = filtered.map((s, i) => {
    const tFmt = _fmt(s.start);
    let text   = _esc(s.text || '');
    if (q) {
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      text = text.replace(re, '<mark>$1</mark>');
    }

    // Confidence bar (Whisper segments have s.confidence)
    let confHtml = '';
    if (s.confidence != null) {
      const pct    = Math.round(s.confidence * 100);
      const cls    = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
      confHtml = `<div class="tr-conf-row">
        <div class="tr-conf-bar"><div class="tr-conf-fill ${cls}" style="width:${pct}%"></div></div>
        <span class="tr-conf-pct">${pct}%</span>
      </div>`;
    }

    // Word chips (Whisper word-level)
    let wordsHtml = '';
    if (s.words && s.words.length) {
      const chips = s.words.map(w => {
        const wp  = Math.round((w.confidence || 0.9) * 100);
        const wcl = wp >= 80 ? 'w-high' : wp >= 60 ? 'w-mid' : 'w-low';
        return `<span class="tr-word ${wcl}" title="${w.start.toFixed(2)}s — ${wp}% confidence"
          onclick="event.stopPropagation();TranscriptEngine.jumpTo(${w.start})">${_esc(w.word)}</span>`;
      }).join('');
      wordsHtml = `<div class="tr-words">${chips}</div>`;
    }

    return `<div class="tr-seg" data-start="${s.start}" data-idx="${i}"
      onclick="TranscriptEngine.jumpTo(${s.start})">
      <div class="tr-seg-top">
        <span class="tr-seg-time">${tFmt}</span>
        <span class="tr-seg-text">${text}</span>
      </div>
      ${confHtml}${wordsHtml}
    </div>`;
  }).join('');
}

/* ── Progress bar helpers ────────────────────────────────── */
function _setProgress (pct, label) {
  const prog  = document.getElementById('tr-progress');
  const fill  = document.getElementById('tr-progress-fill');
  const lbl   = document.getElementById('tr-progress-label');
  if (prog)  prog.style.display   = 'flex';
  if (fill)  fill.style.width     = pct + '%';
  if (lbl)   lbl.textContent      = label;
}
function _hideProgress () {
  const prog = document.getElementById('tr-progress');
  if (prog) prog.style.display = 'none';
}
function _resetBtns () {
  const wb = document.getElementById('tr-whisper-btn');
  const gb = document.getElementById('tr-gen-btn');
  if (wb) wb.disabled = false;
  if (gb) gb.disabled = false;
}

/* ── Search ──────────────────────────────────────────────── */
function _onSearch (val) {
  const clear = document.getElementById('tr-search-clear');
  if (clear) clear.style.display = val ? 'block' : 'none';
  _renderSegments(_getCurrentSegs(), val);
}
function _clearSearch () {
  const inp   = document.getElementById('tr-search');
  if (inp)    inp.value = '';
  const clear = document.getElementById('tr-search-clear');
  if (clear)  clear.style.display = 'none';
  _renderSegments(_getCurrentSegs(), '');
}
function search (query) {
  const segs = _getCurrentSegs();
  if (!query) return segs.map(s => ({ text: s.text, start: s.start }));
  const q = query.toLowerCase();
  return segs
    .filter(s => s.text && s.text.toLowerCase().includes(q))
    .map(s => ({ text: s.text, start: s.start, words: s.words }));
}

/* ── Jump to timestamp ───────────────────────────────────── */
function jumpTo (time) {
  if (typeof playhead !== 'undefined') playhead = +time;
  const tl = document.getElementById('tl-scroll');
  if (tl && typeof pxPerSec !== 'undefined')
    tl.scrollLeft = Math.max(0, time * pxPerSec - 120);
  if (typeof renderAll === 'function') renderAll();
  document.querySelectorAll('#tr-segments .tr-seg').forEach(el => {
    el.classList.toggle('highlight', parseFloat(el.dataset.start) === +time);
  });
  setTimeout(() => {
    document.querySelectorAll('#tr-segments .tr-seg.highlight')
      .forEach(el => el.classList.remove('highlight'));
  }, 800);
}

/* ── Active segment tracking ─────────────────────────────── */
function _updateActive () {
  const segs = _getCurrentSegs();
  if (!segs.length) return;
  const ph  = typeof playhead !== 'undefined' ? playhead : 0;
  document.querySelectorAll('#tr-segments .tr-seg').forEach(el => {
    const start = parseFloat(el.dataset.start);
    const idx   = parseInt(el.dataset.idx, 10);
    const end   = segs[idx + 1] ? segs[idx + 1].start : start + 60;
    el.classList.toggle('active', ph >= start && ph < end);
  });
}

/* ── Asset picker from MediaManager ─────────────────────── */
function _getMediaAssets () {
  if (typeof MediaManager !== 'undefined' && typeof MediaManager.getAssets === 'function')
    return MediaManager.getAssets();
  return [];
}
function _populateAssetPicker (assets) {
  const sel = document.getElementById('tr-asset-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— pick asset —</option>' +
    assets.map(a => `<option value="${a.id}">${_esc(a.name)} (${a.type})</option>`).join('');
}

/* ── Export ──────────────────────────────────────────────── */
function exportTranscript (format) {
  const segs = _getCurrentSegs();
  if (!segs.length) { if (typeof toast === 'function') toast('⚠️ No transcript to export'); return; }
  let content = '', mime = 'text/plain', ext = 'txt';
  if (format === 'json') {
    content = JSON.stringify({ transcript: segs }, null, 2);
    mime = 'application/json'; ext = 'json';
  } else if (format === 'srt') {
    content = segs.map((s, i) => {
      const end = segs[i + 1] ? segs[i + 1].start : s.end || s.start + 5;
      return `${i + 1}\n${_srtTime(s.start)} --> ${_srtTime(end)}\n${s.text}\n`;
    }).join('\n');
    ext = 'srt';
  } else {
    content = segs.map(s => `[${_fmt(s.start)}] ${s.text}`).join('\n');
  }
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `transcript.${ext}`; a.click();
  URL.revokeObjectURL(url);
  _toggleExportMenu();
  if (typeof toast === 'function') toast(`📄 Transcript exported as .${ext}`);
}
function _toggleExportMenu () {
  const m = document.getElementById('tr-export-menu');
  if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

/* ── Project persistence ─────────────────────────────────── */
function serializeForProject () { return { transcripts: _transcripts }; }
function loadFromProject (data) {
  if (data && data.transcripts) {
    _transcripts = data.transcripts;
    _lsSave();
    const panel = document.getElementById('transcript-panel');
    if (panel && panel.classList.contains('open')) { _renderAll(); }
  }
}

/* ── Open / Close ────────────────────────────────────────── */
function open () {
  _createPanel();
  document.getElementById('transcript-panel')?.classList.add('open');
  _renderAll();
  // Refresh asset picker
  const assets = _getMediaAssets().filter(a => a.type === 'video' || a.type === 'audio');
  if (assets.length) {
    _populateAssetPicker(assets);
    const row = document.getElementById('tr-asset-row');
    if (row) row.style.display = 'flex';
  }
}
function close () {
  document.getElementById('transcript-panel')?.classList.remove('open');
  document.querySelectorAll('#lsb .tb').forEach(b => {
    if ((b.getAttribute('onclick') || '').includes("'transcript'")) b.classList.remove('on');
  });
}

/* ── setTool hook ────────────────────────────────────────── */
const _origSetTool = window.setTool;
window.setTool = function (el, name) {
  if (name === 'transcript') {
    const p = document.getElementById('transcript-panel');
    if (p && p.classList.contains('open')) { close(); if (el) el.classList.remove('on'); }
    else { if (typeof _origSetTool === 'function') _origSetTool(el, name); open(); }
    return;
  }
  close();
  if (typeof _origSetTool === 'function') _origSetTool(el, name);
};

/* ── Helpers ─────────────────────────────────────────────── */
function _storeTranscript (id, data) {
  _transcripts[id] = { ...data, generatedAt: new Date().toISOString() };
  _lsSave();
}
function _getCurrentTranscript () { return _transcripts[_activeId] || null; }
function _getCurrentSegs () { return (_transcripts[_activeId] || {}).segments || []; }
function _collapseGenWrap () {
  const gw = document.getElementById('tr-gen-wrap');
  if (gw) gw.style.padding = '6px 12px';
  const note = document.getElementById('tr-gen-note');
  if (note) note.style.display = 'none';
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
  const h = Math.floor(t / 3600), mi = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60), ms = Math.round((t % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}
function _esc (s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _setStatus (msg, type) {
  const el = document.getElementById('tr-status');
  if (!el) return;
  el.textContent = msg; el.style.display = 'block';
  el.className = 'tr-status ' + (type || 'info');
}

/* ── ProjectManager patch ────────────────────────────────── */
(function _patchPM () {
  function _try () {
    if (typeof ProjectManager === 'undefined') return false;
    if (!ProjectManager._serializeExtra)
      ProjectManager._serializeExtra = () => {};
    if (!ProjectManager._deserializeExtra)
      ProjectManager._deserializeExtra = () => {};
    const origSer = ProjectManager._serializeExtra;
    const origDes = ProjectManager._deserializeExtra;
    ProjectManager._serializeExtra = function (p) { origSer(p); p.transcriptData = serializeForProject(); };
    ProjectManager._deserializeExtra = function (p) { origDes(p); if (p.transcriptData) loadFromProject(p.transcriptData); };
    return true;
  }
  if (!_try()) { const id = setInterval(() => { if (_try()) clearInterval(id); }, 300); }
})();

/* ── Shorts Generator upgrade ────────────────────────────── */
(function _upgradeShorts () {
  function _try () {
    if (typeof ShortsGen === 'undefined' || ShortsGen._transcriptUpgraded) return false;
    ShortsGen._transcriptUpgraded = true;
    const orig = ShortsGen.generate;
    ShortsGen.generate = async function () {
      window._activeTranscriptSegs = _getCurrentSegs();
      return orig.apply(this, arguments);
    };
    return true;
  }
  if (!_try()) { const id = setInterval(() => { if (_try()) clearInterval(id); }, 400); }
})();

/* ── AI Copilot extra chips ──────────────────────────────── */
(function _upgradecopilot () {
  function _try () {
    const panel = document.getElementById('ai-copilot-panel');
    if (!panel || panel._trUpgraded) return false;
    panel._trUpgraded = true;
    const ex = panel.querySelector('.acp-examples');
    if (!ex) return true;
    [
      { e: '🔍', t: 'Find where pricing is mentioned',  p: 'Find where I mention pricing in the transcript' },
      { e: '😮', t: 'Find emotional moments',           p: 'Find the most emotional moments in the transcript' },
      { e: '📢', t: 'Find the call to action',         p: 'Find the call to action in the transcript and jump to it' },
    ].forEach(({ e, t, p }) => {
      const btn = document.createElement('button');
      btn.className = 'acp-ex-chip';
      btn.dataset.prompt = p;
      btn.textContent = e + ' ' + t;
      btn.addEventListener('click', () => {
        const inp = document.getElementById('acp-input');
        if (inp) { inp.value = p; inp.focus(); }
      });
      ex.appendChild(btn);
    });
    return true;
  }
  if (!_try()) { const id = setInterval(() => { if (_try()) clearInterval(id); }, 500); }
})();

/* ── Init ────────────────────────────────────────────────── */
_lsLoad();

/* ── Public API ──────────────────────────────────────────── */
window.TranscriptEngine = {
  open, close,
  generate,
  transcribeReal,
  getTranscript:  _getCurrentTranscript,
  getSegments:    _getCurrentSegs,
  search,
  jumpTo,
  export:         exportTranscript,
  serializeForProject,
  loadFromProject,
  _onSearch, _clearSearch,
  _toggleExportMenu,
  _pickAndTranscribe,
  _onFileChosen,
  _onAssetChange,
};

console.log('[TranscriptEngine] Transcript Intelligence Layer v1.7 loaded');

})();
