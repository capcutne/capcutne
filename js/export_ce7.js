/**
 * export_ce7.js — CE-7: Professional Export Engine
 * Replaces ExportEngine.open() with a full-featured export drawer.
 * Features: Platform presets, MOV/MP3 formats, HW acceleration, Render Queue.
 */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────────────────── */
  const POLL_MS   = 800;
  const PRESETS   = [
    { id: 'tiktok',          label: 'TikTok',         icon: '🎵', dim: '1080×1920',  fmt: 'mp4' },
    { id: 'youtube',         label: 'YouTube',         icon: '▶️', dim: '1920×1080',  fmt: 'mp4' },
    { id: 'instagram',       label: 'Instagram',       icon: '📸', dim: '1080×1080',  fmt: 'mp4' },
    { id: 'instagram_reels', label: 'Reels',           icon: '🎬', dim: '1080×1920',  fmt: 'mp4' },
    { id: 'facebook',        label: 'Facebook',        icon: '👥', dim: '1920×1080',  fmt: 'mp4' },
    { id: 'podcast',         label: 'Podcast',         icon: '🎙', dim: 'Audio only', fmt: 'mp3' },
  ];
  const QUALITIES = ['480p','720p','1080p','1440p','4k'];
  const FPS_OPTS  = [24, 30, 60];
  const FORMATS   = [
    { id: 'mp4',  label: 'MP4',  desc: 'Universal',   video: true  },
    { id: 'mov',  label: 'MOV',  desc: 'Apple',        video: true  },
    { id: 'webm', label: 'WebM', desc: 'Web native',   video: true  },
    { id: 'gif',  label: 'GIF',  desc: 'Animated',     video: true  },
    { id: 'mp3',  label: 'MP3',  desc: 'Audio only',   video: false },
  ];

  /* ── State ─────────────────────────────────────────────────────────────── */
  let _open      = false;
  let _pollTimer = null;
  let _queue     = [];           // local job list
  let _selPreset = '';           // '' = custom
  let _selFmt    = 'mp4';
  let _selQ      = '1080p';
  let _selFps    = 30;
  let _hwaccel   = false;
  let _burnSubs  = true;
  let _voiceVol  = 1.0;
  let _musicVol  = 0.5;
  let _sfxVol    = 0.8;
  let _mp3Br     = '320k';

  /* ── DOM Helpers ───────────────────────────────────────────────────────── */
  function _esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function _el(id)  { return document.getElementById(id); }
  function _fmt_size(b) {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
  }
  function _fmt_dur(s) {
    if (!s) return '—';
    s = Math.round(s);
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }
  function _fmt_date(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }

  /* ── Build drawer HTML ──────────────────────────────────────────────────── */
  function _buildDrawer() {
    const d = document.createElement('div');
    d.id  = 'ce7-drawer';
    d.className = 'ce7-drawer';
    d.innerHTML = `
<div class="ce7-overlay" id="ce7-overlay"></div>
<div class="ce7-panel" id="ce7-panel">
  <div class="ce7-header">
    <span class="ce7-title">🎬 Export</span>
    <button class="ce7-close" id="ce7-close" title="Close">✕</button>
  </div>

  <!-- Platform Presets -->
  <div class="ce7-section">
    <div class="ce7-section-label">Platform</div>
    <div class="ce7-presets" id="ce7-presets">
      ${PRESETS.map(p=>`
      <button class="ce7-preset-btn" data-pid="${p.id}" title="${_esc(p.dim)}">
        <span class="ce7-preset-icon">${p.icon}</span>
        <span class="ce7-preset-name">${_esc(p.label)}</span>
        <span class="ce7-preset-dim">${_esc(p.dim)}</span>
      </button>`).join('')}
      <button class="ce7-preset-btn" data-pid="" title="Custom settings">
        <span class="ce7-preset-icon">⚙️</span>
        <span class="ce7-preset-name">Custom</span>
        <span class="ce7-preset-dim">Manual</span>
      </button>
    </div>
  </div>

  <!-- Format -->
  <div class="ce7-section" id="ce7-fmt-section">
    <div class="ce7-section-label">Format</div>
    <div class="ce7-chips" id="ce7-fmt-chips">
      ${FORMATS.map(f=>`
      <button class="ce7-chip${f.id==='mp4'?' on':''}" data-fmt="${f.id}" title="${f.desc}">
        ${f.label}
      </button>`).join('')}
    </div>
  </div>

  <!-- Quality + FPS (hidden when MP3) -->
  <div class="ce7-section" id="ce7-video-opts">
    <div class="ce7-row-2">
      <div>
        <div class="ce7-section-label">Quality</div>
        <div class="ce7-chips" id="ce7-q-chips">
          ${QUALITIES.map(q=>`
          <button class="ce7-chip${q==='1080p'?' on':''}" data-q="${q}">${q}</button>`).join('')}
        </div>
      </div>
      <div>
        <div class="ce7-section-label">FPS</div>
        <div class="ce7-chips" id="ce7-fps-chips">
          ${FPS_OPTS.map(f=>`
          <button class="ce7-chip${f===30?' on':''}" data-fps="${f}">${f}</button>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- MP3 Bitrate (shown only for MP3) -->
  <div class="ce7-section" id="ce7-mp3-opts" style="display:none">
    <div class="ce7-section-label">MP3 Bitrate</div>
    <div class="ce7-chips" id="ce7-br-chips">
      ${['128k','192k','256k','320k'].map(b=>`
      <button class="ce7-chip${b==='320k'?' on':''}" data-br="${b}">${b}</button>`).join('')}
    </div>
  </div>

  <!-- Audio Mix -->
  <div class="ce7-section">
    <div class="ce7-section-label">Audio Mix</div>
    <div class="ce7-mix-grid">
      <label>Voice<span id="ce7-v-val">100%</span></label>
      <input type="range" id="ce7-voice" min="0" max="200" value="100" class="ce7-slider">
      <label>Music<span id="ce7-m-val">50%</span></label>
      <input type="range" id="ce7-music" min="0" max="200" value="50"  class="ce7-slider">
      <label>SFX<span id="ce7-s-val">80%</span></label>
      <input type="range" id="ce7-sfx"   min="0" max="200" value="80"  class="ce7-slider">
    </div>
    <label class="ce7-check">
      <input type="checkbox" id="ce7-burn" checked>
      Burn-in subtitles
    </label>
  </div>

  <!-- Advanced -->
  <div class="ce7-section">
    <div class="ce7-section-label ce7-collapsible" id="ce7-adv-toggle">⚙ Advanced ▸</div>
    <div id="ce7-adv-body" style="display:none">
      <label class="ce7-check">
        <input type="checkbox" id="ce7-hwaccel">
        Hardware acceleration (GPU decoding)
      </label>
      <p class="ce7-hint">Uses -hwaccel auto. Falls back to CPU if no GPU detected.</p>
    </div>
  </div>

  <!-- Start Button -->
  <div class="ce7-section">
    <button class="ce7-start-btn" id="ce7-start">▶ Start Export</button>
  </div>

  <!-- Render Queue -->
  <div class="ce7-section">
    <div class="ce7-section-label">Render Queue</div>
    <div class="ce7-queue" id="ce7-queue">
      <div class="ce7-queue-empty">No exports yet</div>
    </div>
  </div>

</div>`;
    return d;
  }

  /* ── Preset → apply settings ────────────────────────────────────────────── */
  function _applyPreset(pid) {
    _selPreset = pid;
    const p = PRESETS.find(x => x.id === pid);

    // Highlight preset buttons
    _el('ce7-presets').querySelectorAll('.ce7-preset-btn').forEach(b => {
      b.classList.toggle('on', b.dataset.pid === pid);
    });

    if (p) {
      // Set format from preset
      if (p.fmt) _setFmt(p.fmt);
      // Podcast → always mp3 quality hidden
    } else {
      // Custom
    }
    _updateVideoOpts();
  }

  function _setFmt(fmt) {
    _selFmt = fmt;
    _el('ce7-fmt-chips').querySelectorAll('.ce7-chip').forEach(b => {
      b.classList.toggle('on', b.dataset.fmt === fmt);
    });
    _updateVideoOpts();
  }

  function _updateVideoOpts() {
    const isMp3 = _selFmt === 'mp3';
    _el('ce7-video-opts').style.display = isMp3 ? 'none' : '';
    _el('ce7-mp3-opts').style.display   = isMp3 ? '' : 'none';
  }

  /* ── Render queue row ───────────────────────────────────────────────────── */
  function _jobRow(job) {
    const st  = job.status;
    const pct = job.progress || 0;
    const isDone = st === 'done';
    const isErr  = st === 'error';
    const isRun  = st === 'running' || st === 'queued';
    const isCan  = st === 'cancelled';
    const fmt    = (job.format || 'mp4').toUpperCase();
    const q      = job.quality || '';
    const preset = job.preset  || '';
    const tag    = preset ? `${preset.replace('_',' ')} · ${fmt}` : `${q} ${fmt}`;

    const bar = isRun
      ? `<div class="ce7-prog-wrap"><div class="ce7-prog-bar" style="width:${pct}%"></div></div>`
      : '';
    const msg  = _esc(job.message || '');
    const eta  = (isRun && job.eta > 0) ? ` · ETA ${job.eta}s` : '';
    const meta = isDone
      ? `<span class="ce7-meta">${_fmt_size(job.filesize)} · ${_fmt_date(job.completed_at)}</span>`
      : isErr
        ? `<span class="ce7-meta ce7-err">${msg}</span>`
        : `<span class="ce7-meta">${msg}${eta}</span>`;
    const badge = isDone ? '✅' : isErr ? '❌' : isCan ? '⛔' : isRun ? '⏳' : '🕒';

    const dlBtn = isDone
      ? `<a class="ce7-btn-sm" href="/export/download?id=${_esc(job.job_id)}" download="${_esc(job.filename||'export')}">⬇ Download</a>`
      : '';
    const retryBtn = (isErr || isCan)
      ? `<button class="ce7-btn-sm" onclick="ExportEnginePro._retry('${_esc(job.job_id)}')">🔁 Retry</button>`
      : '';
    const cancelBtn = isRun
      ? `<button class="ce7-btn-sm ce7-btn-cancel" onclick="ExportEnginePro._cancel('${_esc(job.job_id)}')">✕ Cancel</button>`
      : '';

    return `
<div class="ce7-job" data-jid="${_esc(job.job_id)}">
  <div class="ce7-job-top">
    <span class="ce7-job-badge">${badge}</span>
    <span class="ce7-job-name">${_esc(job.name||'Export')}</span>
    <span class="ce7-job-tag">${_esc(tag)}</span>
    <div class="ce7-job-actions">${dlBtn}${retryBtn}${cancelBtn}</div>
  </div>
  ${bar}
  ${meta}
</div>`;
  }

  /* ── Render entire queue ────────────────────────────────────────────────── */
  function _renderQueue() {
    const el = _el('ce7-queue');
    if (!el) return;
    if (!_queue.length) {
      el.innerHTML = '<div class="ce7-queue-empty">No exports yet</div>';
      return;
    }
    const sorted = [..._queue].sort((a,b) => (b.created_at||0) - (a.created_at||0));
    el.innerHTML = sorted.map(_jobRow).join('');
  }

  /* ── Poll server for live updates ───────────────────────────────────────── */
  function _pollQueue() {
    fetch('/export/queue')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data.jobs)) return;
        // Merge server jobs into local queue
        data.jobs.forEach(sj => {
          const idx = _queue.findIndex(j => j.job_id === sj.id);
          const mapped = {
            job_id:       sj.id,
            name:         sj.name     || 'Export',
            status:       sj.status,
            progress:     sj.progress || 0,
            message:      sj.message  || '',
            format:       sj.format   || 'mp4',
            quality:      sj.quality  || '1080p',
            preset:       sj.preset   || '',
            fps:          sj.fps      || 30,
            eta:          sj.eta      || 0,
            filename:     sj.filename,
            filesize:     sj.filesize,
            completed_at: sj.completed_at,
            created_at:   sj.created_at,
          };
          if (idx >= 0) Object.assign(_queue[idx], mapped);
          else _queue.unshift(mapped);
        });
        _renderQueue();

        // Badge on main toolbar
        const active = _queue.filter(j => j.status === 'running' || j.status === 'queued').length;
        _updateBadge(active);
      })
      .catch(() => {});
  }

  function _updateBadge(n) {
    let badge = _el('ce7-toolbar-badge');
    const btn = document.querySelector('[data-panel="export"], #btn-export, .toolbar-export-btn');
    if (!btn) return;
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'ce7-toolbar-badge';
      badge.className = 'ce7-toolbar-badge';
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
    badge.textContent = n > 0 ? n : '';
    badge.style.display = n > 0 ? 'inline-block' : 'none';
  }

  /* ── Start a new export ─────────────────────────────────────────────────── */
  function _startExport() {
    const project = (typeof _getProjectState === 'function') ? _getProjectState()
      : (typeof ExportEngine !== 'undefined' && ExportEngine._getProjectState)
        ? ExportEngine._getProjectState()
        : {};
    const dur = project.totalDuration || 0;
    if (!dur) {
      if (typeof toast === 'function') toast('⚠ Add clips to the timeline first');
      return;
    }
    const burnSubs = _el('ce7-burn')?.checked !== false;
    const voiceV   = parseInt(_el('ce7-voice')?.value || 100) / 100;
    const musicV   = parseInt(_el('ce7-music')?.value || 50)  / 100;
    const sfxV     = parseInt(_el('ce7-sfx')?.value   || 80)  / 100;
    const hw       = _el('ce7-hwaccel')?.checked === true;
    let   fps      = _selFps;
    let   quality  = _selQ;

    // Podcast preset always → mp3
    const preset = PRESETS.find(p => p.id === _selPreset);
    if (preset && _selFmt === 'mp3') fps = 0;

    const btn = _el('ce7-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }

    fetch('/export/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format:  _selFmt,
        quality,
        fps,
        project,
        settings: {
          burnSubtitles: burnSubs,
          preset:        _selPreset,
          hwaccel:       hw,
          mp3Bitrate:    _mp3Br,
          audioMix: { voice: voiceV, music: musicV, sfx: sfxV },
        },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.job_id) throw new Error(data.error || 'No job_id');
        const job = {
          job_id:     data.job_id,
          name:       project.name || 'Export',
          format:     _selFmt,
          quality,
          fps,
          preset:     _selPreset,
          status:     'queued',
          progress:   0,
          message:    'Queued…',
          created_at: Date.now() / 1000,
        };
        _queue.unshift(job);
        _renderQueue();
        if (typeof toast === 'function') toast('🎬 Export started — rendering in background');
      })
      .catch(err => {
        if (typeof toast === 'function') toast('❌ Export failed: ' + err.message);
      })
      .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = '▶ Start Export'; }
      });
  }

  /* ── Retry a job ────────────────────────────────────────────────────────── */
  function _retry(jobId) {
    fetch('/export/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || 'Retry failed');
        if (typeof toast === 'function') toast('🔁 Retrying export…');
      })
      .catch(err => {
        if (typeof toast === 'function') toast('❌ ' + err.message);
      });
  }

  /* ── Cancel a job ───────────────────────────────────────────────────────── */
  function _cancel(jobId) {
    fetch('/export/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          const j = _queue.find(x => x.job_id === jobId);
          if (j) j.status = 'cancelled';
          _renderQueue();
        }
      })
      .catch(() => {});
  }

  /* ── Wire events ─────────────────────────────────────────────────────────── */
  function _wireEvents() {
    _el('ce7-overlay').addEventListener('click', ExportEnginePro.close);
    _el('ce7-close').addEventListener('click',   ExportEnginePro.close);
    _el('ce7-start').addEventListener('click',   _startExport);

    // Preset buttons
    _el('ce7-presets').addEventListener('click', e => {
      const btn = e.target.closest('.ce7-preset-btn');
      if (btn) _applyPreset(btn.dataset.pid);
    });

    // Format chips
    _el('ce7-fmt-chips').addEventListener('click', e => {
      const btn = e.target.closest('.ce7-chip');
      if (!btn) return;
      _el('ce7-fmt-chips').querySelectorAll('.ce7-chip').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      _selFmt = btn.dataset.fmt;
      _selPreset = '';                       // deselect preset on manual override
      _el('ce7-presets').querySelectorAll('.ce7-preset-btn').forEach(b => b.classList.remove('on'));
      _el('ce7-presets').querySelector('[data-pid=""]')?.classList.add('on');
      _updateVideoOpts();
    });

    // Quality chips
    _el('ce7-q-chips').addEventListener('click', e => {
      const btn = e.target.closest('.ce7-chip');
      if (!btn) return;
      _el('ce7-q-chips').querySelectorAll('.ce7-chip').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      _selQ = btn.dataset.q;
    });

    // FPS chips
    _el('ce7-fps-chips').addEventListener('click', e => {
      const btn = e.target.closest('.ce7-chip');
      if (!btn) return;
      _el('ce7-fps-chips').querySelectorAll('.ce7-chip').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      _selFps = parseInt(btn.dataset.fps);
    });

    // MP3 bitrate chips
    _el('ce7-br-chips').addEventListener('click', e => {
      const btn = e.target.closest('.ce7-chip');
      if (!btn) return;
      _el('ce7-br-chips').querySelectorAll('.ce7-chip').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      _mp3Br = btn.dataset.br;
    });

    // Sliders
    ['ce7-voice','ce7-music','ce7-sfx'].forEach((id, i) => {
      const labels = ['ce7-v-val','ce7-m-val','ce7-s-val'];
      const el = _el(id);
      if (!el) return;
      el.addEventListener('input', () => {
        _el(labels[i]).textContent = el.value + '%';
        if (i===0) _voiceVol = parseInt(el.value)/100;
        if (i===1) _musicVol = parseInt(el.value)/100;
        if (i===2) _sfxVol   = parseInt(el.value)/100;
      });
    });

    // Advanced collapse
    _el('ce7-adv-toggle').addEventListener('click', () => {
      const body = _el('ce7-adv-body');
      const tog  = _el('ce7-adv-toggle');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      tog.textContent = open ? '⚙ Advanced ▸' : '⚙ Advanced ▾';
    });
  }

  /* ── Load history from server on open ──────────────────────────────────── */
  function _loadHistory() {
    fetch('/export/history')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data.history)) return;
        data.history.forEach(rec => {
          if (!_queue.find(j => j.job_id === rec.id)) {
            _queue.push({
              job_id:       rec.id,
              name:         rec.name     || 'Export',
              status:       rec.status,
              progress:     rec.progress || 100,
              message:      rec.message  || '',
              format:       rec.format   || 'mp4',
              quality:      rec.quality  || '1080p',
              preset:       rec.preset   || '',
              fps:          rec.fps      || 30,
              filename:     rec.filename,
              filesize:     rec.filesize,
              completed_at: rec.completed_at,
              created_at:   rec.created_at,
            });
          }
        });
        _renderQueue();
      })
      .catch(() => {});
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  const ExportEnginePro = {
    _retry:  _retry,
    _cancel: _cancel,

    open() {
      if (_open) return;
      _open = true;

      // Build or show drawer
      let drawer = _el('ce7-drawer');
      if (!drawer) {
        drawer = _buildDrawer();
        document.body.appendChild(drawer);
        _wireEvents();
        _loadHistory();
      }

      // Animate in
      requestAnimationFrame(() => {
        drawer.classList.add('ce7-visible');
        document.body.classList.add('ce7-body-lock');
      });

      // Start polling
      _pollQueue();
      _pollTimer = setInterval(_pollQueue, POLL_MS);
    },

    close() {
      if (!_open) return;
      _open = false;
      clearInterval(_pollTimer);
      _pollTimer = null;
      const drawer = _el('ce7-drawer');
      if (drawer) {
        drawer.classList.remove('ce7-visible');
        document.body.classList.remove('ce7-body-lock');
      }
    },

    isOpen() { return _open; },
  };

  window.ExportEnginePro = ExportEnginePro;

  /* ── Override ExportEngine.open() ──────────────────────────────────────── */
  function _patchExportEngine() {
    if (typeof window.ExportEngine !== 'undefined') {
      window.ExportEngine.open = function () {
        ExportEnginePro.open();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _patchExportEngine);
  } else {
    _patchExportEngine();
  }

  // Also patch after a short delay to catch late-loaded ExportEngine
  setTimeout(_patchExportEngine, 600);

})();
