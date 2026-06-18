/* ============================================================
   AI SHORTS GENERATOR — js/shorts.js
   Phase 1.2: Viral segment detection → Shorts timeline creation

   Flow:
     editorState → POST /ai/generate-shorts → shorts[]
     → result cards (title, duration, score)
     → user clicks → applyShort() → trims timeline to range

   Depends on: tracks, subtitles, nextId, saveState,
               renderAll, toast  (all globals from capcut.html)
   ============================================================ */

(function () {

/* ── Panel creation ─────────────────────────────────────── */
function _createPanel () {
  if (document.getElementById('shorts-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'shorts-panel';
  panel.innerHTML = `
    <div class="sg-header">
      <div class="sg-header-left">
        <svg class="ic" width="16" height="16" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span>AI Shorts Generator</span>
      </div>
      <button class="sg-close" onclick="ShortsGen.close()" title="Close">✕</button>
    </div>

    <div class="sg-body">
      <div class="sg-intro">
        <p>Analyze your timeline and find the top 10 most viral-worthy segments — ready to clip for TikTok, Reels, or YouTube Shorts.</p>
      </div>

      <button class="sg-generate-btn" id="sg-gen-btn" onclick="ShortsGen.generate()">
        <svg class="ic" width="14" height="14" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        Generate Top 10 Shorts
      </button>

      <div id="sg-status" class="sg-status" style="display:none"></div>
      <div id="sg-results" class="sg-results"></div>
    </div>
  `;
  document.body.appendChild(panel);
}

/* ── Total project duration ─────────────────────────────── */
function _totalDuration () {
  if (typeof tracks === 'undefined') return 0;
  return tracks.reduce((max, tr) =>
    tr.clips.reduce((m, c) => Math.max(m, c.start + (c.dur || 0)), max), 0);
}

/* ── Generate: call the API ─────────────────────────────── */
async function generate () {
  const btn = document.getElementById('sg-gen-btn');
  const status = document.getElementById('sg-status');
  const results = document.getElementById('sg-results');
  if (!btn || !status || !results) return;

  const totalDur = _totalDuration();
  if (totalDur < 5 && typeof tracks !== 'undefined') {
    _setStatus('⚠️ Add some clips to the timeline first.', 'warn');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';
  _setStatus('Sending timeline to AI — analyzing for viral potential…', 'info');
  results.innerHTML = '';

  // Pull transcript segments from TranscriptEngine if available
  const transcriptSegs = (
    typeof TranscriptEngine !== 'undefined' && typeof TranscriptEngine.getSegments === 'function'
      ? TranscriptEngine.getSegments()
      : (window._activeTranscriptSegs || [])
  ).slice(0, 80);

  const payload = {
    editorState: {
      tracks: (typeof tracks !== 'undefined' ? tracks : []).map(tr => ({
        type: tr.type,
        label: tr.label || '',
        clips: (tr.clips || []).map(c => ({
          id: c.id, label: c.label || '', start: c.start, dur: c.dur || 0
        }))
      })),
      subtitles: (typeof subtitles !== 'undefined' ? subtitles : []).map(s => ({
        start: s.start, dur: s.dur || 3, text: s.text || ''
      })).slice(0, 20),
      totalDuration: totalDur,
      transcriptSegments: transcriptSegs
    }
  };

  try {
    const res = await fetch('/ai/generate-shorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.error) {
      _setStatus('⚠️ ' + data.error, 'warn');
    } else {
      const shorts = data.shorts || [];
      _setStatus(`Found ${shorts.length} viral candidate${shorts.length !== 1 ? 's' : ''} — click any to apply.`, 'ok');
      _renderResults(shorts);
    }
  } catch (e) {
    _setStatus('❌ Network error: ' + e.message, 'warn');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="ic" width="14" height="14" viewBox="0 0 24 24">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg> Regenerate`;
  }
}

/* ── Render result cards ─────────────────────────────────── */
function _renderResults (shorts) {
  const el = document.getElementById('sg-results');
  if (!el) return;
  if (!shorts.length) {
    el.innerHTML = '<div class="sg-empty">No segments found. Try adding more clips to your timeline.</div>';
    return;
  }

  el.innerHTML = shorts.map((s, i) => {
    const dur     = Math.round(s.end - s.start);
    const pct     = Math.round((s.score || 0) * 100);
    const emoji   = pct >= 90 ? '🔥' : pct >= 75 ? '⚡' : pct >= 60 ? '👍' : '📊';
    const barCls  = pct >= 75 ? 'high' : pct >= 55 ? 'mid' : 'low';
    const startFmt = _fmt(s.start);
    const endFmt   = _fmt(s.end);

    return `
<div class="sg-card" data-idx="${i}">
  <div class="sg-card-top">
    <div class="sg-card-rank">#${i + 1}</div>
    <div class="sg-card-title">${_esc(s.title || 'Untitled Short')}</div>
    <div class="sg-card-score">${emoji} ${pct}%</div>
  </div>
  <div class="sg-card-meta">
    <span class="sg-tag">🕐 ${startFmt} → ${endFmt}</span>
    <span class="sg-tag">⏱ ${dur}s</span>
  </div>
  <div class="sg-score-bar">
    <div class="sg-score-fill ${barCls}" style="width:${pct}%"></div>
  </div>
  ${s.hook ? `<div class="sg-hook">"${_esc(s.hook)}"</div>` : ''}
  ${s.reason ? `<div class="sg-reason">${_esc(s.reason)}</div>` : ''}
  <button class="sg-apply-btn" onclick="ShortsGen.applyShort(${JSON.stringify(s).replace(/"/g,'&quot;')})">
    ✂️ Apply to Timeline
  </button>
</div>`;
  }).join('');
}

/* ── Apply short: trim timeline to [start, end] ──────────── */
function applyShort (short) {
  if (typeof saveState !== 'function' || typeof tracks === 'undefined') return;

  const start = Number(short.start) || 0;
  const end   = Number(short.end)   || 30;
  if (end <= start) return;

  saveState();

  tracks.forEach(tr => {
    tr.clips = (tr.clips || [])
      .filter(c => c.start < end && (c.start + (c.dur || 0)) > start)
      .map(c => {
        const cS = Math.max(c.start, start);
        const cE = Math.min(c.start + (c.dur || 0), end);
        return { ...c, start: +(cS - start).toFixed(3), dur: +(cE - cS).toFixed(3) };
      })
      .filter(c => c.dur > 0.05);
  });

  // also trim subtitles to range
  if (typeof subtitles !== 'undefined') {
    subtitles = subtitles
      .filter(s => s.start < end && (s.start + (s.dur || 3)) > start)
      .map(s => ({
        ...s,
        start: +(Math.max(s.start, start) - start).toFixed(3),
        dur:    +(Math.min(s.start + (s.dur || 3), end) - Math.max(s.start, start)).toFixed(3)
      }))
      .filter(s => s.dur > 0.05);
  }

  if (typeof renderAll === 'function') renderAll();
  if (typeof _renderSubList === 'function') _renderSubList();
  if (typeof toast === 'function') {
    toast(`✅ Short applied: "${short.title}" (${Math.round(end - start)}s)`);
  }

  // Close the panel so the user sees the result
  close();
}

/* ── Status helper ──────────────────────────────────────── */
function _setStatus (msg, type) {
  const el = document.getElementById('sg-status');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'sg-status sg-status-' + (type || 'info');
}

/* ── Format seconds → mm:ss ─────────────────────────────── */
function _fmt (t) {
  if (typeof fmt === 'function') return fmt(t);
  const s = Math.floor(t), m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function _esc (s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Open / Close ────────────────────────────────────────── */
function open () {
  _createPanel();
  const p = document.getElementById('shorts-panel');
  if (p) p.classList.add('open');
}
function close () {
  const p = document.getElementById('shorts-panel');
  if (p) p.classList.remove('open');
  // deactivate toolbar button
  document.querySelectorAll('#lsb .tb').forEach(b => {
    if (b.getAttribute('onclick')?.includes("'shorts'")) b.classList.remove('on');
  });
}

/* ── Hook into setTool ───────────────────────────────────── */
const _origSetTool = window.setTool;
window.setTool = function (el, name) {
  if (name === 'shorts') {
    // Toggle — if panel already open, close it
    const p = document.getElementById('shorts-panel');
    if (p && p.classList.contains('open')) {
      close();
      // reset button state (setTool would have set .on already — undo it)
      if (el) el.classList.remove('on');
    } else {
      // Let setTool highlight the button, then open panel
      if (typeof _origSetTool === 'function') _origSetTool(el, name);
      open();
    }
    return;
  }
  // Any other tool — close shorts panel if open
  close();
  if (typeof _origSetTool === 'function') _origSetTool(el, name);
};

/* ── Public API ──────────────────────────────────────────── */
window.ShortsGen = { generate, applyShort, open, close };

console.log('[ShortsGen] AI Shorts Generator loaded');

})();
