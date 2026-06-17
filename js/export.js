/* ============================================================
   EXPORT ENGINE — js/export.js
   Phase 1.5: FFmpeg-based export with queue + progress UI
   ============================================================ */

(function () {

/* ── State ───────────────────────────────────────────────── */
let _queue    = [];   // [{job_id, format, quality, fps, status, progress, message}]
let _pollTimer = null;
let _modalOpen = false;

/* ── Helpers ─────────────────────────────────────────────── */
function _fmtSize (bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function _timeAgo (ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() / 1000) - ts);
  if (s < 60)  return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
}
function _getProjectState () {
  // Collect timeline state from the main app
  const state = {};
  if (typeof tracks !== 'undefined')    state.tracks = tracks;
  if (typeof subtitles !== 'undefined') state.subtitles = subtitles;
  if (typeof playhead !== 'undefined')  state.playhead = playhead;
  // Get title
  const tb = document.querySelector('.tb-name input');
  state.name = tb ? tb.value : 'CapCut Export';
  // Total duration
  let dur = 0;
  if (typeof tracks !== 'undefined') {
    tracks.forEach(tr => tr.clips.forEach(c => { dur = Math.max(dur, c.start + c.dur); }));
  }
  state.totalDuration = dur;
  return state;
}

/* ══════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════ */

function _buildModal () {
  if (document.getElementById('exp-modal')) return;

  const el = document.createElement('div');
  el.id = 'exp-modal';
  el.innerHTML = `
<div id="exp-box">
  <div class="exp-header">
    <span class="exp-header-title">🎬 Export Video</span>
    <button class="exp-close" id="exp-close">✕</button>
  </div>

  <!-- Settings section -->
  <div class="exp-section" id="exp-settings-section">
    <div class="exp-row">
      <div class="exp-col">
        <div class="exp-label">Format</div>
        <div class="exp-radio-group" id="exp-fmt">
          <label class="exp-radio on"><input type="radio" name="exp-fmt" value="mp4" checked> MP4</label>
          <label class="exp-radio"><input type="radio" name="exp-fmt" value="webm"> WebM</label>
          <label class="exp-radio"><input type="radio" name="exp-fmt" value="gif"> GIF</label>
        </div>
      </div>
      <div class="exp-col">
        <div class="exp-label">FPS</div>
        <div class="exp-radio-group" id="exp-fps">
          <label class="exp-radio"><input type="radio" name="exp-fps" value="24"> 24</label>
          <label class="exp-radio on"><input type="radio" name="exp-fps" value="30" checked> 30</label>
          <label class="exp-radio"><input type="radio" name="exp-fps" value="60"> 60</label>
        </div>
      </div>
    </div>

    <div class="exp-label" style="margin-top:14px">Quality</div>
    <div class="exp-quality-grid" id="exp-quality">
      <div class="exp-quality-card" data-q="720p">
        <div class="exp-quality-name">720p</div>
        <div class="exp-quality-sub">HD · ~2 Mbps</div>
      </div>
      <div class="exp-quality-card on" data-q="1080p">
        <div class="exp-quality-name">1080p</div>
        <div class="exp-quality-sub">Full HD · ~4 Mbps</div>
      </div>
      <div class="exp-quality-card" data-q="1440p">
        <div class="exp-quality-name">1440p</div>
        <div class="exp-quality-sub">2K · ~8 Mbps</div>
      </div>
      <div class="exp-quality-card" data-q="4k">
        <div class="exp-quality-name">4K</div>
        <div class="exp-quality-sub">Ultra HD · ~15 Mbps</div>
      </div>
    </div>

    <button class="exp-start-btn" id="exp-start-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px">
        <path d="M6 3l15 9-15 9V3z"/>
      </svg>
      Start Export
    </button>
  </div>

  <!-- Active job progress -->
  <div class="exp-section" id="exp-progress-section" style="display:none">
    <div class="exp-job-active" id="exp-job-active">
      <div class="exp-job-row">
        <div class="exp-job-icon">🎬</div>
        <div class="exp-job-info">
          <div class="exp-job-name" id="exp-active-name">Rendering…</div>
          <div class="exp-job-meta" id="exp-active-meta">Initializing…</div>
        </div>
        <div class="exp-job-pct" id="exp-active-pct">0%</div>
      </div>
      <div class="exp-prog-track">
        <div class="exp-prog-fill" id="exp-active-fill" style="width:0%"></div>
        <div class="exp-prog-glow" id="exp-active-glow" style="width:0%"></div>
      </div>
      <div class="exp-cancel-row">
        <button class="exp-cancel-btn" id="exp-cancel-btn">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Queue / history -->
  <div class="exp-section" id="exp-queue-section">
    <div class="exp-label">Queue</div>
    <div class="exp-queue-list" id="exp-queue-list">
      <div class="exp-queue-empty">No exports yet</div>
    </div>
  </div>
</div>`;

  document.body.appendChild(el);

  // Backdrop close
  el.addEventListener('click', e => { if (e.target === el) ExportEngine.close(); });
  document.getElementById('exp-close').addEventListener('click', ExportEngine.close);

  // Format radio styling
  el.querySelectorAll('input[name="exp-fmt"]').forEach(r => {
    r.addEventListener('change', () => {
      el.querySelectorAll('.exp-radio[for],.exp-radio').forEach(l => l.classList.remove('on'));
      r.closest('.exp-radio')?.classList.add('on');
      // GIF: disable FPS (fixed at 12)
      const fps = document.getElementById('exp-fps');
      if (fps) fps.style.opacity = r.value === 'gif' ? '0.4' : '1';
    });
  });
  el.querySelectorAll('input[name="exp-fps"]').forEach(r => {
    r.addEventListener('change', () => {
      el.querySelectorAll('.exp-radio').forEach(l => { if (l.querySelector('input[name="exp-fps"]')) l.classList.remove('on'); });
      r.closest('.exp-radio')?.classList.add('on');
    });
  });

  // Quality cards
  el.querySelectorAll('.exp-quality-card').forEach(card => {
    card.addEventListener('click', () => {
      el.querySelectorAll('.exp-quality-card').forEach(c => c.classList.remove('on'));
      card.classList.add('on');
    });
  });

  // Start button
  document.getElementById('exp-start-btn').addEventListener('click', _startExport);
  document.getElementById('exp-cancel-btn').addEventListener('click', _cancelActive);
}

/* ── Open / Close ─────────────────────────────────────────── */
function open () {
  _buildModal();
  document.getElementById('exp-modal').classList.add('open');
  _modalOpen = true;
  _renderQueue();
  _startPolling();
}
function close () {
  const m = document.getElementById('exp-modal');
  if (m) m.classList.remove('open');
  _modalOpen = false;
}

/* ── Start export ────────────────────────────────────────── */
function _startExport () {
  const fmt     = document.querySelector('input[name="exp-fmt"]:checked')?.value  || 'mp4';
  const quality = document.querySelector('.exp-quality-card.on')?.dataset.q       || '1080p';
  const fps     = fmt === 'gif' ? 12
    : parseInt(document.querySelector('input[name="exp-fps"]:checked')?.value || '30');

  const project = _getProjectState();
  const dur     = project.totalDuration || 0;

  if (!dur) {
    if (typeof toast === 'function') toast('⚠ Add clips to the timeline first');
    return;
  }

  const btn = document.getElementById('exp-start-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }

  fetch('/export/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: fmt, quality, fps, project }),
  })
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.job_id) throw new Error(data.error || 'No job_id');
      const job = {
        job_id:   data.job_id,
        format:   fmt,
        quality,
        fps,
        status:   'queued',
        progress: 0,
        message:  'Queued…',
        name:     project.name || 'Export',
        dur:      dur,
      };
      _queue.unshift(job);
      _renderQueue();
      _showActiveJob(job);
      _startPolling();
      if (typeof toast === 'function') toast('🎬 Export started — ' + fmt.toUpperCase() + ' ' + quality);
    })
    .catch(e => {
      if (typeof toast === 'function') toast('❌ Export failed: ' + e.message);
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = ''; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px"><path d="M6 3l15 9-15 9V3z"/></svg>Start Export'; }
    });
}

function _cancelActive () {
  const activeJob = _queue.find(j => j.status === 'running' || j.status === 'queued');
  if (!activeJob) return;
  activeJob.status  = 'cancelled';
  activeJob.message = 'Cancelled by user';
  _renderQueue();
  _hideActiveJob();
  if (typeof toast === 'function') toast('🚫 Export cancelled');
}

/* ── Progress polling ────────────────────────────────────── */
function _startPolling () {
  if (_pollTimer) return;
  _pollTimer = setInterval(_poll, 700);
}
function _stopPolling () {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

function _poll () {
  const active = _queue.filter(j => j.status === 'queued' || j.status === 'running');
  if (!active.length) {
    _stopPolling();
    return;
  }
  active.forEach(job => {
    fetch('/export/status?id=' + job.job_id)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        job.status   = data.status;
        job.progress = data.progress || 0;
        job.message  = data.message  || '';
        job.filename = data.filename;
        job.filesize = data.filesize;
        job.completed_at = data.completed_at;
        _renderQueue();
        if (job.status === 'running' || job.status === 'queued') {
          _updateActiveJob(job);
        }
        if (job.status === 'done') {
          _hideActiveJob();
          if (typeof toast === 'function') {
            const sizeStr = job.filesize ? ' (' + _fmtSize(job.filesize) + ')' : '';
            toast(`✅ "${job.filename}" ready${sizeStr} — click Download`);
          }
        }
        if (job.status === 'error') {
          _hideActiveJob();
          if (typeof toast === 'function') toast('❌ Export failed: ' + job.message);
        }
      })
      .catch(() => {});
  });
}

/* ── Active job UI ───────────────────────────────────────── */
function _showActiveJob (job) {
  const sect = document.getElementById('exp-progress-section');
  if (sect) sect.style.display = '';
  _updateActiveJob(job);
}
function _hideActiveJob () {
  const sect = document.getElementById('exp-progress-section');
  if (sect) sect.style.display = 'none';
}
function _updateActiveJob (job) {
  const nm  = document.getElementById('exp-active-name');
  const mt  = document.getElementById('exp-active-meta');
  const pct = document.getElementById('exp-active-pct');
  const fill= document.getElementById('exp-active-fill');
  const glow= document.getElementById('exp-active-glow');
  if (!nm) return;
  nm.textContent  = job.name + ' · ' + job.format.toUpperCase() + ' ' + job.quality;
  mt.textContent  = job.message || 'Processing…';
  pct.textContent = job.progress + '%';
  const w = job.progress + '%';
  if (fill) fill.style.width = w;
  if (glow) glow.style.width = w;
}

/* ── Queue render ────────────────────────────────────────── */
function _renderQueue () {
  const list = document.getElementById('exp-queue-list');
  if (!list) return;
  if (!_queue.length) {
    list.innerHTML = '<div class="exp-queue-empty">No exports yet</div>';
    return;
  }
  list.innerHTML = _queue.slice(0, 20).map(job => {
    const isDone      = job.status === 'done';
    const isErr       = job.status === 'error';
    const isRunning   = job.status === 'running' || job.status === 'queued';
    const isCancelled = job.status === 'cancelled';

    const iconMap = { mp4: '🎞', webm: '🌐', gif: '🖼' };
    const icon    = iconMap[job.format] || '🎬';
    const badge   = isDone      ? `<span class="exp-badge done">Done</span>`
                  : isErr       ? `<span class="exp-badge err">Error</span>`
                  : isRunning   ? `<span class="exp-badge running">${job.progress}%</span>`
                  : isCancelled ? `<span class="exp-badge cancel">Cancelled</span>`
                  : `<span class="exp-badge">Queued</span>`;

    const dlBtn = isDone
      ? `<button class="exp-dl-btn" onclick="ExportEngine.download('${job.job_id}','${job.filename||'export.mp4'}')">⬇ Download</button>`
      : '';

    const sizeStr = job.filesize ? _fmtSize(job.filesize) : '';
    const timeStr = job.completed_at ? _timeAgo(job.completed_at) : '';

    return `
<div class="exp-queue-item ${isDone ? 'done' : isErr ? 'err' : ''}">
  <div class="exp-qi-icon">${icon}</div>
  <div class="exp-qi-info">
    <div class="exp-qi-name">${_esc(job.name || 'Export')}</div>
    <div class="exp-qi-meta">${job.format.toUpperCase()} · ${job.quality}${sizeStr ? ' · ' + sizeStr : ''}${timeStr ? ' · ' + timeStr : ''}</div>
    ${isRunning ? `<div class="exp-qi-prog-track"><div class="exp-qi-prog-fill" style="width:${job.progress}%"></div></div>` : ''}
  </div>
  <div class="exp-qi-right">${badge}${dlBtn}</div>
</div>`;
  }).join('');
}

/* ── Download ─────────────────────────────────────────────── */
function download (jobId, filename) {
  const a   = document.createElement('a');
  a.href     = `/export/download?id=${jobId}`;
  a.download = filename || 'export.mp4';
  a.click();
}

/* ── CSS injection ───────────────────────────────────────── */
function _injectStyles () {
  if (document.getElementById('exp-styles')) return;
  const st = document.createElement('style');
  st.id = 'exp-styles';
  st.textContent = `
/* Export modal */
#exp-modal{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);
  z-index:700;align-items:center;justify-content:center;
}
#exp-modal.open{display:flex}
#exp-box{
  background:var(--bg1);border:1px solid var(--border2);border-radius:14px;
  width:480px;max-width:95vw;max-height:92vh;overflow-y:auto;
  box-shadow:0 24px 80px rgba(0,0,0,.8);
}
#exp-box::-webkit-scrollbar{width:3px}
#exp-box::-webkit-scrollbar-thumb{background:var(--bg5)}
.exp-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px;border-bottom:1px solid var(--border2);background:var(--bg2);
  border-radius:14px 14px 0 0;
}
.exp-header-title{font-size:14px;font-weight:700;color:var(--t1)}
.exp-close{
  background:none;border:none;color:var(--t4);cursor:pointer;
  font-size:14px;padding:3px 7px;border-radius:5px;
}
.exp-close:hover{background:var(--bg4);color:var(--t1)}
.exp-section{padding:16px 20px;border-bottom:1px solid var(--border)}
.exp-section:last-child{border-bottom:none}
.exp-label{font-size:10.5px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
.exp-row{display:flex;gap:20px}
.exp-col{flex:1}

/* Format / FPS radios */
.exp-radio-group{display:flex;gap:6px}
.exp-radio{
  display:flex;align-items:center;gap:5px;padding:5px 12px;
  border:1.5px solid var(--border2);border-radius:8px;cursor:pointer;
  font-size:12px;font-weight:600;color:var(--t3);background:var(--bg2);
  transition:border-color .12s,color .12s;
}
.exp-radio input{display:none}
.exp-radio.on{border-color:var(--accent);color:var(--accent2);background:var(--accentdim)}
.exp-radio:hover:not(.on){border-color:var(--border2);color:var(--t2)}

/* Quality cards */
.exp-quality-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.exp-quality-card{
  border:1.5px solid var(--border2);border-radius:8px;padding:8px 6px;
  text-align:center;cursor:pointer;background:var(--bg2);
  transition:border-color .12s;
}
.exp-quality-card:hover{border-color:var(--border2);background:var(--bg3)}
.exp-quality-card.on{border-color:var(--accent);background:var(--accentdim)}
.exp-quality-name{font-size:13px;font-weight:700;color:var(--t1)}
.exp-quality-sub{font-size:9px;color:var(--t4);margin-top:2px}
.exp-quality-card.on .exp-quality-name{color:var(--accent2)}

/* Start button */
.exp-start-btn{
  width:100%;margin-top:16px;padding:11px;background:var(--accent);
  color:#000;border:none;border-radius:9px;font-size:13px;font-weight:700;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:background .12s;
}
.exp-start-btn:hover{background:var(--accent2)}
.exp-start-btn:disabled{opacity:.5;cursor:not-allowed}

/* Active job */
.exp-job-active{background:var(--bg2);border-radius:10px;padding:14px}
.exp-job-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.exp-job-icon{font-size:24px;flex-shrink:0}
.exp-job-info{flex:1;min-width:0}
.exp-job-name{font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.exp-job-meta{font-size:10.5px;color:var(--t3);margin-top:2px}
.exp-job-pct{font-size:15px;font-weight:700;color:var(--accent);flex-shrink:0;min-width:36px;text-align:right}

/* Progress bar */
.exp-prog-track{height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;position:relative}
.exp-prog-fill{height:100%;background:var(--accent);border-radius:3px;transition:width .5s ease;position:relative;z-index:2}
.exp-prog-glow{
  position:absolute;top:0;left:0;height:100%;background:var(--accent2);
  border-radius:3px;opacity:.35;filter:blur(4px);transition:width .5s ease;z-index:1;
}
.exp-cancel-row{margin-top:8px;text-align:right}
.exp-cancel-btn{
  background:none;border:1px solid var(--border2);border-radius:6px;
  color:var(--t4);font-size:10.5px;padding:3px 10px;cursor:pointer;
}
.exp-cancel-btn:hover{border-color:#e74c3c;color:#e74c3c}

/* Queue list */
.exp-queue-list{display:flex;flex-direction:column;gap:5px;max-height:260px;overflow-y:auto}
.exp-queue-list::-webkit-scrollbar{width:3px}
.exp-queue-list::-webkit-scrollbar-thumb{background:var(--bg5)}
.exp-queue-empty{font-size:11px;color:var(--t4);text-align:center;padding:14px 0}
.exp-queue-item{
  display:flex;align-items:center;gap:10px;padding:9px 10px;
  border:1px solid var(--border);border-radius:8px;background:var(--bg2);
}
.exp-queue-item.done{border-color:rgba(39,174,96,.3);background:rgba(39,174,96,.05)}
.exp-queue-item.err{border-color:rgba(231,76,60,.3);background:rgba(231,76,60,.05)}
.exp-qi-icon{font-size:18px;flex-shrink:0}
.exp-qi-info{flex:1;min-width:0}
.exp-qi-name{font-size:11px;font-weight:600;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.exp-qi-meta{font-size:10px;color:var(--t4);margin-top:1px}
.exp-qi-prog-track{height:3px;background:var(--bg4);border-radius:2px;margin-top:5px;overflow:hidden}
.exp-qi-prog-fill{height:100%;background:var(--accent);border-radius:2px;transition:width .4s}
.exp-qi-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}

.exp-badge{
  font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;
  background:var(--bg4);color:var(--t3);
}
.exp-badge.done{background:rgba(39,174,96,.2);color:#27ae60}
.exp-badge.err{background:rgba(231,76,60,.2);color:#e74c3c}
.exp-badge.running{background:var(--accentdim);color:var(--accent2)}
.exp-badge.cancel{background:var(--bg4);color:var(--t4)}
.exp-dl-btn{
  background:var(--accent);color:#000;border:none;border-radius:6px;
  padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;
}
.exp-dl-btn:hover{background:var(--accent2)}
`;
  document.head.appendChild(st);
}

/* ── Helpers ─────────────────────────────────────────────── */
function _esc (s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Init ────────────────────────────────────────────────── */
function init () {
  _injectStyles();

  // Override the fake auto-exp modal if present
  const fakeModal = document.getElementById('auto-exp');
  if (fakeModal) {
    fakeModal.style.cssText = 'display:none!important';
    // Neutralize fake click interceptor by re-owning the #auto-exp element
    fakeModal.id = 'auto-exp-disabled';
  }

  // Override startExport global
  window.startExport = function () { ExportEngine.open(); };

  // Override topbar export button onclick directly if present
  document.querySelectorAll('.tb-export').forEach(btn => {
    btn.onclick = null;
    btn.addEventListener('click', e => {
      e.stopImmediatePropagation();
      ExportEngine.open();
    }, true);
  });

  console.log('[ExportEngine] Export Engine v1.5 loaded — FFmpeg ready');
}

/* ── Public API ──────────────────────────────────────────── */
window.ExportEngine = {
  open,
  close,
  download,
  getQueue () { return [..._queue]; },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
