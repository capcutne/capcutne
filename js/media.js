/* ============================================================
   MEDIA ASSET MANAGER — js/media.js
   Phase 1.4: Upload, search, preview, drag-to-timeline.

   Asset schema: { id, name, type, duration, size, thumbnail, objUrl }
   Storage: cc_assets in localStorage (metadata only; objUrl is session-only)
   ============================================================ */

(function () {

const KEY_ASSETS = 'cc_assets';

/* ── Asset store ─────────────────────────────────────────── */
let _assets  = [];   // full objects including objUrl (session)
let _tab     = 'all';
let _query   = '';

/* ── Persistence (metadata only, no blob URLs) ───────────── */
function _loadStored () {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY_ASSETS) || '[]');
    _assets = stored.map(a => ({ ...a, objUrl: null, offline: true }));
  } catch {}
}
function _saveMeta () {
  try {
    const meta = _assets.map(({ id, name, type, duration, size, thumbnail }) =>
      ({ id, name, type, duration, size, thumbnail }));
    localStorage.setItem(KEY_ASSETS, JSON.stringify(meta));
  } catch (e) { console.warn('[MediaManager] localStorage write failed:', e.message); }
}

/* ── ID generator ────────────────────────────────────────── */
function _uid () {
  return 'ast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

/* ── Public: register a new asset ───────────────────────── */
function registerAsset (asset) {
  // replace existing asset with same name + type (re-upload)
  _assets = _assets.filter(a => !(a.name === asset.name && a.type === asset.type));
  _assets.unshift(asset);
  _saveMeta();
  _render();
  // bridge: keep legacy _uploadedFiles in sync for backward compat
  if ((asset.type === 'video' || asset.type === 'image') && typeof _uploadedFiles !== 'undefined') {
    _uploadedFiles.unshift({ name: asset.name, dur: asset.duration, objUrl: asset.objUrl, thumb: asset.thumbnail });
  }
}

/* ── Public: remove an asset ─────────────────────────────── */
function removeAsset (id) {
  const a = _assets.find(x => x.id === id);
  if (a && a.objUrl) URL.revokeObjectURL(a.objUrl);
  _assets = _assets.filter(x => x.id !== id);
  _saveMeta();
  _render();
}

/* ── Filtered view ───────────────────────────────────────── */
function _filtered () {
  return _assets.filter(a => {
    if (_tab !== 'all' && a.type !== _tab) return false;
    if (_query && !a.name.toLowerCase().includes(_query.toLowerCase())) return false;
    return true;
  });
}

/* ── Duration formatter ──────────────────────────────────── */
function _fmtDur (s) {
  if (!s) return '00:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}
function _fmtSize (bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ══════════════════════════════════════════════════════════
   PANEL RENDERING
   ══════════════════════════════════════════════════════════ */

function _buildPanel () {
  const root = document.getElementById('mp-body');
  if (!root) return;

  root.innerHTML = `
<div class="mam-shell">

  <!-- Upload zone (drag files here) -->
  <div class="mam-upload-zone" id="mam-upload-zone">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <span>Drag files here or</span>
    <button class="mam-upload-btn" id="mam-upload-btn">Browse</button>
    <input type="file" id="mam-file-input" accept="video/*,image/*,audio/*" multiple style="display:none">
  </div>

  <!-- Search -->
  <div class="mam-search-row">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--t4)">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input class="mam-search-input" id="mam-search-input" type="text" placeholder="Search assets…">
    <button class="mam-search-clear" id="mam-search-clear" title="Clear">✕</button>
  </div>

  <!-- Tabs -->
  <div class="mam-tabs" id="mam-tabs">
    <button class="mam-tab on"  data-tab="all">All</button>
    <button class="mam-tab"     data-tab="video">Video</button>
    <button class="mam-tab"     data-tab="audio">Audio</button>
    <button class="mam-tab"     data-tab="image">Image</button>
  </div>

  <!-- Asset list -->
  <div class="mam-list" id="mam-list"></div>

</div>`;

  _wireEvents();
  _renderList();
}

function _wireEvents () {
  // Tab clicks
  document.querySelectorAll('.mam-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mam-tab').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      _tab = btn.dataset.tab;
      _renderList();
    });
  });

  // Search input
  const inp  = document.getElementById('mam-search-input');
  const clr  = document.getElementById('mam-search-clear');
  if (inp) {
    inp.addEventListener('input', () => {
      _query = inp.value;
      clr.style.display = _query ? 'flex' : 'none';
      _renderList();
    });
  }
  if (clr) {
    clr.style.display = 'none';
    clr.addEventListener('click', () => {
      inp.value = ''; _query = '';
      clr.style.display = 'none';
      _renderList();
    });
  }

  // Upload zone — click to browse
  const btn   = document.getElementById('mam-upload-btn');
  const input = document.getElementById('mam-file-input');
  if (btn && input) {
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { _processFiles(input.files); input.value = ''; });
  }

  // Upload zone — drag-and-drop
  const zone = document.getElementById('mam-upload-zone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      _processFiles(e.dataTransfer.files);
    });
  }
}

/* ── Render the asset list ────────────────────────────────── */
function _renderList () {
  const list = document.getElementById('mam-list');
  if (!list) return;

  const items = _filtered();
  if (!items.length) {
    list.innerHTML = `<div class="mam-empty">${_query ? 'No results for "' + _query + '"' : 'No assets yet.<br>Upload files above.'}</div>`;
    return;
  }

  // Separate by type for headers
  const videos = items.filter(a => a.type === 'video');
  const images = items.filter(a => a.type === 'image');
  const audios = items.filter(a => a.type === 'audio');

  let html = '';
  if (_tab === 'all') {
    if (videos.length) html += _sectionHTML('Video', videos, 'grid');
    if (images.length) html += _sectionHTML('Image', images, 'grid');
    if (audios.length) html += _sectionHTML('Audio', audios, 'list');
  } else if (_tab === 'video') {
    html = videos.length ? _gridHTML(videos) : _emptySection('No video assets');
  } else if (_tab === 'image') {
    html = images.length ? _gridHTML(images) : _emptySection('No image assets');
  } else if (_tab === 'audio') {
    html = audios.length ? _audioListHTML(audios) : _emptySection('No audio assets');
  }
  list.innerHTML = html;

  // Wire card events after render
  list.querySelectorAll('.mam-card[data-id]').forEach(card => {
    const id = card.dataset.id;
    const asset = _assets.find(a => a.id === id);
    if (!asset) return;
    // Click to add to timeline
    card.addEventListener('click', e => {
      if (e.target.closest('.mam-card-del') || e.target.closest('.mam-card-preview')) return;
      _addAssetToTimeline(asset);
    });
    // Preview button
    const prevBtn = card.querySelector('.mam-card-preview');
    if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); _openPreview(asset); });
    // Delete button
    const delBtn = card.querySelector('.mam-card-del');
    if (delBtn) delBtn.addEventListener('click', e => { e.stopPropagation(); removeAsset(id); });
    // Drag to timeline
    card.draggable = true;
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/x-mam-id', id);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  // Audio row events
  list.querySelectorAll('.mam-audio-row[data-id]').forEach(row => {
    const id = row.dataset.id;
    const asset = _assets.find(a => a.id === id);
    if (!asset) return;
    row.querySelector('.mam-audio-add')?.addEventListener('click', e => {
      e.stopPropagation(); _addAssetToTimeline(asset);
    });
    row.querySelector('.mam-audio-preview')?.addEventListener('click', e => {
      e.stopPropagation(); _openPreview(asset);
    });
    row.querySelector('.mam-audio-del')?.addEventListener('click', e => {
      e.stopPropagation(); removeAsset(id);
    });
    row.draggable = true;
    row.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/x-mam-id', id);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
}

function _sectionHTML (title, assets, mode) {
  return `<div class="mam-section">${title} <span class="mam-section-count">${assets.length}</span></div>` +
    (mode === 'grid' ? _gridHTML(assets) : _audioListHTML(assets));
}
function _emptySection (msg) {
  return `<div class="mam-empty">${msg}</div>`;
}
function _gridHTML (assets) {
  return `<div class="mam-grid">${assets.map(_cardHTML).join('')}</div>`;
}
function _cardHTML (a) {
  const offline = a.offline && !a.objUrl;
  const thumbStyle = a.thumbnail
    ? `background-image:url('${a.thumbnail}');background-size:cover;background-position:center`
    : 'background:var(--bg3)';
  const typeIcon = a.type === 'video' ? '🎬' : a.type === 'image' ? '🖼️' : '🎵';
  return `
<div class="mam-card${offline ? ' mam-offline' : ''}" data-id="${a.id}" title="${_esc(a.name)}">
  <div class="mam-thumb" style="${thumbStyle}">
    ${a.thumbnail ? '' : `<span class="mam-thumb-icon">${typeIcon}</span>`}
    ${a.duration  ? `<span class="mam-thumb-dur">${_fmtDur(a.duration)}</span>` : ''}
    ${offline     ? `<span class="mam-offline-badge">↑ Re-upload</span>` : ''}
    <div class="mam-card-hover">
      <button class="mam-card-preview" title="Preview">▶</button>
    </div>
  </div>
  <div class="mam-card-foot">
    <div class="mam-card-name">${_esc(a.name)}</div>
    <button class="mam-card-del" title="Remove">✕</button>
  </div>
</div>`;
}
function _audioListHTML (assets) {
  return `<div class="mam-audio-list">${assets.map(a => {
    const offline = a.offline && !a.objUrl;
    return `
<div class="mam-audio-row${offline ? ' mam-offline' : ''}" data-id="${a.id}">
  <div class="mam-audio-icon">🎵</div>
  <div class="mam-audio-info">
    <div class="mam-audio-name">${_esc(a.name)}</div>
    <div class="mam-audio-meta">${_fmtDur(a.duration)}${a.size ? ' · ' + _fmtSize(a.size) : ''}${offline ? ' · re-upload needed' : ''}</div>
  </div>
  <button class="mam-audio-preview" title="Preview">▶</button>
  <button class="mam-audio-add" title="Add to timeline">+</button>
  <button class="mam-audio-del" title="Remove">✕</button>
</div>`;
  }).join('')}</div>`;
}

/* ── Re-render helper (called after upload/delete) ───────── */
function _render () {
  if (!document.getElementById('mam-list')) return;
  _renderList();
}

/* ══════════════════════════════════════════════════════════
   FILE PROCESSING
   ══════════════════════════════════════════════════════════ */

function _processFiles (fileList) {
  if (!fileList || !fileList.length) return;
  Array.from(fileList).forEach(f => {
    if      (f.type.startsWith('video/'))  _processVideo(f);
    else if (f.type.startsWith('image/'))  _processImage(f);
    else if (f.type.startsWith('audio/'))  _processAudio(f);
  });
}

function _processVideo (f) {
  const objUrl = URL.createObjectURL(f);
  const vid    = document.createElement('video');
  vid.preload  = 'metadata';
  vid.muted    = true;
  vid.onloadedmetadata = () => { vid.currentTime = Math.min(0.5, vid.duration / 2); };
  vid.onseeked = () => {
    let thumb = null;
    try {
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
      cv.getContext('2d').drawImage(vid, 0, 0, 160, 90);
      thumb = cv.toDataURL('image/jpeg', 0.7);
    } catch {}
    registerAsset({ id: _uid(), name: f.name, type: 'video',
      duration: Math.round(vid.duration * 10) / 10,
      size: f.size, thumbnail: thumb, objUrl });
    // also dispatch to legacy capcut.html upload flow for timeline add
    _legacyVideoFinalize(f.name, Math.round(vid.duration * 10) / 10, thumb, objUrl);
  };
  vid.onerror = () => {
    registerAsset({ id: _uid(), name: f.name, type: 'video', duration: 5, size: f.size, thumbnail: null, objUrl });
    _legacyVideoFinalize(f.name, 5, null, objUrl);
  };
  vid.src = objUrl;
}

function _processImage (f) {
  const objUrl = URL.createObjectURL(f);
  const img    = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
    cv.getContext('2d').drawImage(img, 0, 0, 160, 90);
    const thumb = cv.toDataURL('image/jpeg', 0.7);
    URL.revokeObjectURL(objUrl);
    registerAsset({ id: _uid(), name: f.name, type: 'image', duration: 5, size: f.size, thumbnail: thumb, objUrl: null });
    if (typeof addVideoClipFromLib === 'function') addVideoClipFromLib(f.name, 5, null, null);
    if (typeof toast === 'function') toast(`✅ "${f.name}" added`);
  };
  img.onerror = () => {
    registerAsset({ id: _uid(), name: f.name, type: 'image', duration: 5, size: f.size, thumbnail: null, objUrl: null });
  };
  img.src = objUrl;
}

function _processAudio (f) {
  const objUrl = URL.createObjectURL(f);
  // Use AudioContext to get real duration
  const reader = new FileReader();
  reader.onload = e => {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    ac.decodeAudioData(e.target.result, buf => {
      const dur = Math.round(buf.duration * 10) / 10;
      ac.close();
      registerAsset({ id: _uid(), name: f.name, type: 'audio', duration: dur, size: f.size, thumbnail: null, objUrl });
      // Delegate to capcut's audio upload for waveform analysis
      if (typeof _legacyAudioFinalize === 'function') _legacyAudioFinalize(f, objUrl, dur);
    }, () => {
      ac.close();
      registerAsset({ id: _uid(), name: f.name, type: 'audio', duration: 10, size: f.size, thumbnail: null, objUrl });
      if (typeof _legacyAudioFinalize === 'function') _legacyAudioFinalize(f, objUrl, 10);
    });
  };
  reader.readAsArrayBuffer(f);
}

// Called by the legacy upload handlers so both systems stay in sync
function _legacyVideoFinalize (name, dur, thumb, objUrl) {
  if (typeof addVideoClipFromLib === 'function') {
    addVideoClipFromLib(name, dur, null, objUrl);
  }
}

/* ══════════════════════════════════════════════════════════
   ADD ASSET TO TIMELINE (click or drop)
   ══════════════════════════════════════════════════════════ */

function _addAssetToTimeline (asset, dropTimeSec) {
  if (asset.offline && !asset.objUrl) {
    if (typeof toast === 'function') toast('⚠ Re-upload this file to add it to the timeline');
    return;
  }
  if (asset.type === 'audio') {
    if (typeof addAudioClipFromLib === 'function') {
      addAudioClipFromLib(asset.name, asset.duration || 10, asset.objUrl);
    }
  } else {
    if (typeof addVideoClipFromLib === 'function') {
      if (typeof dropTimeSec === 'number') {
        // Drop at a specific time position
        if (typeof saveState === 'function') saveState();
        const tr = typeof tracks !== 'undefined' ? tracks.find(t => t.type === 'video') : null;
        if (tr) {
          const c = { id: 'c' + (typeof nextId !== 'undefined' ? nextId++ : Date.now()),
            start: dropTimeSec, dur: asset.duration || 5,
            label: asset.name, cls: 'cv' };
          if (asset.objUrl) c.objUrl = asset.objUrl;
          tr.clips.push(c);
          if (typeof selected !== 'undefined') { selected.clear(); selected.add(c.id); }
          if (typeof renderAll === 'function') renderAll();
          if (typeof updateRightInfo === 'function') updateRightInfo();
          if (typeof toast === 'function') toast(`Added "${asset.name}" at ${_fmtDur(dropTimeSec)}`);
          return;
        }
      }
      addVideoClipFromLib(asset.name, asset.duration || 5, null, asset.objUrl);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   PREVIEW MODAL
   ══════════════════════════════════════════════════════════ */

function _openPreview (asset) {
  let modal = document.getElementById('mam-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mam-preview-modal';
    modal.innerHTML = `
<div id="mam-preview-box">
  <div class="mam-preview-header">
    <span id="mam-preview-title" class="mam-preview-title"></span>
    <div style="display:flex;align-items:center;gap:8px">
      <button class="mam-preview-add-btn" id="mam-preview-add">+ Add to timeline</button>
      <button class="mam-preview-close" id="mam-preview-close">✕</button>
    </div>
  </div>
  <div id="mam-preview-content"></div>
  <div id="mam-preview-meta" class="mam-preview-meta"></div>
</div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) _closePreview(); });
    document.getElementById('mam-preview-close').addEventListener('click', _closePreview);
  }

  const content = document.getElementById('mam-preview-content');
  const title   = document.getElementById('mam-preview-title');
  const meta    = document.getElementById('mam-preview-meta');
  const addBtn  = document.getElementById('mam-preview-add');

  title.textContent = asset.name;
  addBtn.onclick = () => { _addAssetToTimeline(asset); _closePreview(); };

  const offline = asset.offline && !asset.objUrl;
  if (offline) {
    content.innerHTML = `<div class="mam-preview-offline">⚠ File not loaded in this session.<br>Re-upload to preview.</div>`;
  } else if (asset.type === 'video' && asset.objUrl) {
    content.innerHTML = `<video src="${asset.objUrl}" controls autoplay muted style="width:100%;max-height:280px;border-radius:6px;background:#000"></video>`;
  } else if (asset.type === 'image') {
    const src = asset.thumbnail || asset.objUrl || '';
    content.innerHTML = `<img src="${src}" style="width:100%;max-height:280px;object-fit:contain;border-radius:6px;background:#111">`;
  } else if (asset.type === 'audio' && asset.objUrl) {
    content.innerHTML = `
<div class="mam-audio-preview-wrap">
  <div class="mam-audio-preview-icon">🎵</div>
  <audio src="${asset.objUrl}" controls style="width:100%;margin-top:12px"></audio>
</div>`;
  } else {
    content.innerHTML = `<div class="mam-preview-offline">No preview available.</div>`;
  }

  meta.textContent = [
    asset.type,
    asset.duration ? _fmtDur(asset.duration) : '',
    asset.size     ? _fmtSize(asset.size) : '',
  ].filter(Boolean).join(' · ');

  modal.classList.add('open');
}

function _closePreview () {
  const modal = document.getElementById('mam-preview-modal');
  if (modal) {
    modal.classList.remove('open');
    const vid = modal.querySelector('video');
    if (vid) vid.pause();
    const aud = modal.querySelector('audio');
    if (aud) aud.pause();
  }
}

/* ══════════════════════════════════════════════════════════
   DRAG-TO-TIMELINE (drop handler on #tl-scroll)
   ══════════════════════════════════════════════════════════ */

function _registerTimelineDrop () {
  const tl = document.getElementById('tl-scroll');
  if (!tl) return;

  tl.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('application/x-mam-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    _showDropLine(e, tl);
  });
  tl.addEventListener('dragleave', e => {
    if (!e.relatedTarget || !tl.contains(e.relatedTarget)) _removeDropLine();
  });
  tl.addEventListener('drop', e => {
    const id = e.dataTransfer.getData('application/x-mam-id');
    if (!id) return;
    e.preventDefault();
    _removeDropLine();
    const asset = _assets.find(a => a.id === id);
    if (!asset) return;
    const dropSec = _dropXToTime(e, tl);
    _addAssetToTimeline(asset, dropSec);
  });
}

let _dropLineEl = null;
function _showDropLine (e, tl) {
  if (!_dropLineEl) {
    _dropLineEl = document.createElement('div');
    _dropLineEl.id = 'mam-drop-line';
    tl.style.position = 'relative';
    tl.appendChild(_dropLineEl);
  }
  const rect  = tl.getBoundingClientRect();
  const x     = e.clientX - rect.left + tl.scrollLeft;
  _dropLineEl.style.left = x + 'px';
}
function _removeDropLine () {
  if (_dropLineEl) { _dropLineEl.remove(); _dropLineEl = null; }
}

function _dropXToTime (e, tl) {
  const rect  = tl.getBoundingClientRect();
  const x     = e.clientX - rect.left + tl.scrollLeft;
  const pps   = typeof pxPerSec === 'function' ? pxPerSec()
    : (typeof zoomIdx !== 'undefined' ? [20,40,80,120,160,240][Math.min(5, zoomIdx)] : 80);
  return Math.max(0, Math.round(x / pps * 10) / 10);
}

/* ══════════════════════════════════════════════════════════
   CSS INJECTION
   ══════════════════════════════════════════════════════════ */

function _injectStyles () {
  if (document.getElementById('mam-styles')) return;
  const st = document.createElement('style');
  st.id = 'mam-styles';
  st.textContent = `
/* ── Media Asset Manager shell ── */
.mam-shell{display:flex;flex-direction:column;height:100%;overflow:hidden}

/* Upload zone */
.mam-upload-zone{
  margin:10px 10px 0;padding:10px 8px;border:1.5px dashed var(--accent);
  border-radius:8px;background:var(--accentdim);color:var(--accent2);
  display:flex;align-items:center;justify-content:center;gap:5px;
  flex-wrap:wrap;font-size:11px;transition:background .15s;flex-shrink:0;cursor:default;
}
.mam-upload-zone.drag-over{background:rgba(212,160,23,.28);border-color:var(--accent2)}
.mam-upload-btn{
  background:var(--accent);color:#000;border:none;border-radius:5px;
  padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;
}
.mam-upload-btn:hover{background:var(--accent2)}

/* Search */
.mam-search-row{
  position:relative;margin:8px 10px 0;display:flex;align-items:center;
}
.mam-search-input{
  width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;
  color:var(--t1);font-size:11px;padding:5px 28px 5px 28px;outline:none;box-sizing:border-box;
  font-family:inherit;
}
.mam-search-input:focus{border-color:var(--accent)}
.mam-search-clear{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border:none;color:var(--t4);font-size:11px;cursor:pointer;
  display:none;align-items:center;padding:2px;
}
.mam-search-clear:hover{color:var(--t2)}

/* Tabs */
.mam-tabs{
  display:flex;gap:2px;padding:6px 10px 0;flex-shrink:0;
}
.mam-tab{
  flex:1;padding:4px 0;font-size:10.5px;font-weight:600;color:var(--t3);
  background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;
  text-align:center;transition:color .12s;
}
.mam-tab:hover{color:var(--t2)}
.mam-tab.on{color:var(--accent2);border-bottom-color:var(--accent)}

/* Section headers */
.mam-section{
  font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;
  letter-spacing:.6px;padding:8px 10px 4px;
}
.mam-section-count{
  font-size:9px;background:var(--bg3);color:var(--t4);
  padding:1px 5px;border-radius:8px;margin-left:4px;vertical-align:middle;
}

/* Asset list scroll container */
.mam-list{flex:1;overflow-y:auto;padding:0 0 10px}
.mam-list::-webkit-scrollbar{width:3px}
.mam-list::-webkit-scrollbar-thumb{background:var(--bg5);border-radius:2px}
.mam-empty{font-size:11px;color:var(--t3);text-align:center;padding:20px 10px;line-height:1.8}

/* Asset grid (video/image) */
.mam-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 10px}
.mam-card{
  border-radius:7px;overflow:hidden;cursor:pointer;
  border:1.5px solid transparent;background:var(--bg2);
  transition:border-color .12s;position:relative;
}
.mam-card:hover{border-color:var(--accent)}
.mam-card.dragging{opacity:.5}
.mam-card.mam-offline{opacity:.55}
.mam-thumb{
  width:100%;aspect-ratio:16/9;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
}
.mam-thumb-icon{font-size:22px}
.mam-thumb-dur{
  position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,.75);
  border-radius:3px;padding:1px 4px;font-size:9px;color:#fff;
}
.mam-offline-badge{
  position:absolute;top:3px;left:3px;background:rgba(0,0,0,.75);
  border-radius:3px;padding:1px 5px;font-size:9px;color:#f39c12;
}
/* Hover overlay on card */
.mam-card-hover{
  position:absolute;inset:0;background:rgba(0,0,0,.45);
  display:none;align-items:center;justify-content:center;
}
.mam-card:hover .mam-card-hover{display:flex}
.mam-card-preview{
  background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.5);
  border-radius:50%;width:30px;height:30px;color:#fff;font-size:12px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
}
.mam-card-preview:hover{background:rgba(255,255,255,.3)}
/* Card footer */
.mam-card-foot{
  display:flex;align-items:center;background:var(--bg2);padding:3px 5px;gap:3px;
}
.mam-card-name{
  flex:1;font-size:9.5px;color:var(--t3);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.mam-card-del{
  background:none;border:none;color:var(--t4);font-size:9px;
  cursor:pointer;padding:1px 3px;border-radius:3px;flex-shrink:0;
}
.mam-card-del:hover{color:#e74c3c;background:rgba(231,76,60,.1)}

/* Audio list */
.mam-audio-list{padding:0 10px;display:flex;flex-direction:column;gap:3px}
.mam-audio-row{
  display:flex;align-items:center;gap:7px;padding:6px 7px;border-radius:7px;
  cursor:pointer;border:1px solid transparent;background:var(--bg2);
  transition:border-color .12s;
}
.mam-audio-row:hover{border-color:var(--border2);background:var(--bg3)}
.mam-audio-row.mam-offline{opacity:.55}
.mam-audio-icon{
  width:32px;height:32px;border-radius:50%;background:var(--bg3);
  border:1px solid var(--border2);display:flex;align-items:center;
  justify-content:center;font-size:14px;flex-shrink:0;
}
.mam-audio-info{flex:1;min-width:0}
.mam-audio-name{font-size:11px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mam-audio-meta{font-size:9.5px;color:var(--t4);margin-top:1px}
.mam-audio-preview,.mam-audio-add,.mam-audio-del{
  background:var(--bg3);border:1px solid var(--border2);border-radius:5px;
  color:var(--t3);padding:2px 7px;font-size:10px;cursor:pointer;flex-shrink:0;
}
.mam-audio-preview:hover,.mam-audio-add:hover{border-color:var(--accent);color:var(--accent2)}
.mam-audio-del:hover{color:#e74c3c;background:rgba(231,76,60,.1);border-color:transparent}

/* Preview modal */
#mam-preview-modal{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);
  z-index:600;align-items:center;justify-content:center;
}
#mam-preview-modal.open{display:flex}
#mam-preview-box{
  background:var(--bg1);border:1px solid var(--border2);border-radius:12px;
  width:440px;max-width:94vw;overflow:hidden;
  box-shadow:0 20px 60px rgba(0,0,0,.7);
}
.mam-preview-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--border2);background:var(--bg2);
}
.mam-preview-title{font-size:12px;font-weight:600;color:var(--t1);flex:1;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:10px}
.mam-preview-add-btn{
  background:var(--accent);color:#000;border:none;border-radius:7px;
  padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;
}
.mam-preview-add-btn:hover{background:var(--accent2)}
.mam-preview-close{
  background:none;border:none;color:var(--t3);cursor:pointer;
  font-size:14px;padding:2px 6px;border-radius:4px;margin-left:4px;
}
.mam-preview-close:hover{background:var(--bg4);color:var(--t1)}
#mam-preview-content{min-height:180px;background:#0d0d0d}
.mam-preview-meta{
  padding:8px 16px;font-size:10.5px;color:var(--t4);
  text-transform:capitalize;background:var(--bg2);border-top:1px solid var(--border);
}
.mam-preview-offline{
  padding:40px 20px;text-align:center;font-size:12px;color:var(--t3);line-height:1.8;
}
.mam-audio-preview-wrap{
  padding:24px 20px;display:flex;flex-direction:column;align-items:center;
}
.mam-audio-preview-icon{font-size:40px;margin-bottom:4px}

/* Timeline drop indicator */
#mam-drop-line{
  position:absolute;top:0;bottom:0;width:2px;background:var(--accent);
  z-index:50;pointer-events:none;box-shadow:0 0 6px var(--accent);
}

/* mp-body full-height fix for new manager */
#mp-body{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0}
`;
  document.head.appendChild(st);
}

/* ── Helpers ─────────────────────────────────────────────── */
function _esc (s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

function init () {
  _loadStored();
  _injectStyles();
  _buildPanel();
  _registerTimelineDrop();

  // Override legacy setMpTab — no longer needed, but keep it harmless
  if (typeof window !== 'undefined') {
    window.setMpTab = function (el, tab) {
      // Map old tab names to new
      const map = { video: 'video', audio: 'audio', stock: 'video' };
      const newTab = map[tab] || 'all';
      const btn = document.querySelector(`.mam-tab[data-tab="${newTab}"]`);
      if (btn) btn.click();
    };
  }

  console.log('[MediaManager] Media Asset Manager v1.4 loaded');
}

/* ── Public API ──────────────────────────────────────────── */
window.MediaManager = {
  registerAsset,
  removeAsset,
  processFiles: _processFiles,
  openPreview:  _openPreview,
  closePreview: _closePreview,
  setTab (tab) {
    const btn = document.querySelector(`.mam-tab[data-tab="${tab}"]`);
    if (btn) btn.click();
  },
  search (q) {
    const inp = document.getElementById('mam-search-input');
    if (inp) { inp.value = q; inp.dispatchEvent(new Event('input')); }
  },
  getAssets () { return [..._assets]; },
};

// Expose for legacy audio finalize
window._legacyAudioFinalize = function (file, objUrl, dur) {
  if (typeof analyseAudioFile !== 'function') return;
  const tr = typeof tracks !== 'undefined' ? tracks.find(t => t.type === 'audio') : null;
  if (!tr) return;
  const end = tr.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0);
  if (typeof saveState === 'function') saveState();
  const id = 'c' + (typeof nextId !== 'undefined' ? nextId++ : Date.now());
  const clip = { id, start: end, dur, label: '🎵 ' + file.name, cls: 'ca', wave: true, audioUrl: objUrl };
  tr.clips.push(clip);
  if (typeof renderAll === 'function') renderAll();
  if (typeof toast === 'function') toast('⏳ Analysing waveform…');
  analyseAudioFile(id, file, function (peaks) {
    const AC2 = new (window.AudioContext || window.webkitAudioContext)();
    const r2   = new FileReader();
    r2.onload  = function (ev) {
      AC2.decodeAudioData(ev.target.result, function (buf) {
        clip.dur = Math.round(buf.duration * 10) / 10;
        AC2.close(); if (typeof renderAll === 'function') renderAll();
        if (typeof toast === 'function') toast(`✅ "${file.name}" (${_fmtDur(clip.dur)}) — press ▶`);
      }, () => { AC2.close(); if (typeof renderAll === 'function') renderAll(); });
    };
    r2.readAsArrayBuffer(file);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
