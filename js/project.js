/* ============================================================
   PROJECT SAVE SYSTEM — js/project.js
   Phase 1.3: Auto-save, session restore, version history,
   project manager UI, backend API sync.

   Storage strategy:
     cc_autosave          — current session (every 30s + beforeunload)
     cc_projects          — metadata index [{id,name,createdAt,updatedAt,...}]
     cc_proj_{id}         — full project payload

   All saves also POST to /project/save for backend persistence.
   ============================================================ */

(function () {

/* ── Constants ───────────────────────────────────────────── */
const KEY_AUTO   = 'cc_autosave';
const KEY_INDEX  = 'cc_projects';
const KEY_PROJ   = id => 'cc_proj_' + id;
const MAX_HIST   = 15;   // history states kept per save (to limit storage)
const AUTO_SECS  = 30;   // auto-save interval

/* ── State ───────────────────────────────────────────────── */
let _autoTimer     = null;
let _lastAutoSave  = 0;
let _dirty         = false;   // any change since last save

/* ── Serialization ───────────────────────────────────────── */
function _serializeState (name) {
  const titleEl = document.getElementById('proj-title');
  const pname   = (name || (titleEl ? titleEl.textContent : '') || 'Untitled Project').trim();

  // tracks — strip blob audioUrls (not portable)
  const rawTracks = typeof tracks !== 'undefined' ? tracks : [];
  const tracksCopy = JSON.parse(JSON.stringify(rawTracks)).map(tr => ({
    ...tr,
    clips: tr.clips.map(c => {
      const { audioUrl, ...rest } = c;
      if (audioUrl) rest._hadAudio = true;
      return rest;
    })
  }));

  // subtitles — full SubEngine-enhanced data
  const subsCopy = JSON.parse(JSON.stringify(typeof subtitles !== 'undefined' ? subtitles : []));

  // history — keep last MAX_HIST states to limit storage size
  const rawHist = typeof historyStack !== 'undefined' ? historyStack : [];
  const histSlice = rawHist.slice(-MAX_HIST);
  const histIdx   = typeof historyIdx !== 'undefined'
    ? Math.max(-1, Math.min(historyIdx, rawHist.length - 1) - (rawHist.length - histSlice.length))
    : -1;

  return {
    name: pname,
    version: '1.3',
    editorState: {
      tracks:       tracksCopy,
      subtitles:    subsCopy,
      playhead:     typeof playhead   !== 'undefined' ? playhead   : 0,
      zoomIdx:      typeof zoomIdx    !== 'undefined' ? zoomIdx    : 2,
      ratio:        typeof ratio      !== 'undefined' ? ratio      : '9:16',
      nextId:       typeof nextId     !== 'undefined' ? nextId     : 9,
      nextSubId:    typeof nextSubId  !== 'undefined' ? nextSubId  : 1,
      historyStack: histSlice,
      historyIdx:   histIdx,
    }
  };
}

function _deserializeState (payload) {
  const state = payload.editorState || {};

  if (typeof audioPause === 'function') audioPause();
  if (typeof audioPlayers !== 'undefined' && typeof disposeAudioPlayer === 'function') {
    Object.keys(audioPlayers).forEach(id => disposeAudioPlayer(id));
  }

  if (Array.isArray(state.tracks))    tracks    = state.tracks;
  if (Array.isArray(state.subtitles)) subtitles = state.subtitles;

  if (typeof state.playhead  === 'number') playhead  = state.playhead;
  if (typeof state.zoomIdx   === 'number') zoomIdx   = state.zoomIdx;
  if (state.ratio)                         ratio     = state.ratio;
  if (typeof state.nextId    === 'number') nextId    = state.nextId;
  if (typeof state.nextSubId === 'number') nextSubId = state.nextSubId;

  // history
  if (Array.isArray(state.historyStack)) {
    historyStack = state.historyStack;
    historyIdx   = typeof state.historyIdx === 'number' ? state.historyIdx : historyStack.length - 1;
  } else {
    historyStack = []; historyIdx = -1;
  }

  // project name
  const titleEl = document.getElementById('proj-title');
  if (titleEl && payload.name) titleEl.textContent = payload.name;

  // ratio UI
  if (typeof setRatio === 'function' && state.ratio) {
    setRatio(state.ratio);
  } else if (state.ratio) {
    document.querySelectorAll('.ratio-btn').forEach(b => {
      b.classList.toggle('on', b.textContent.trim() === state.ratio);
    });
  }

  if (typeof selected !== 'undefined') selected.clear();
  if (typeof renderAll        === 'function') renderAll();
  if (typeof _renderSubList   === 'function') _renderSubList();
  if (typeof updateHistDots   === 'function') updateHistDots();
  if (typeof updateRightInfo  === 'function') updateRightInfo();
  _dirty = false;
}

/* ── localStorage helpers ────────────────────────────────── */
function _lsGet (key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function _lsSet (key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('[ProjectManager] localStorage write failed:', e.message); return false; }
}
function _lsDel (key) {
  try { localStorage.removeItem(key); } catch {}
}

/* ── Project index helpers ───────────────────────────────── */
function _getIndex () { return _lsGet(KEY_INDEX) || []; }
function _setIndex (idx) { _lsSet(KEY_INDEX, idx); }

function _indexMeta (payload, id, createdAt) {
  const state = payload.editorState || {};
  const allClips = (state.tracks || []).flatMap(t => t.clips || []);
  const dur = allClips.reduce((m, c) => Math.max(m, c.start + (c.dur || 0)), 0);
  const trackCount = (state.tracks || []).filter(t => (t.clips || []).length > 0).length;
  return {
    id, name: payload.name,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: Math.round(dur),
    trackCount,
  };
}

/* ── Auto-save ───────────────────────────────────────────── */
function _triggerAutoSave () {
  if (!_dirty) return;
  const payload = _serializeState();
  payload.updatedAt = new Date().toISOString();
  _lsSet(KEY_AUTO, payload);
  _lastAutoSave = Date.now();
  _dirty = false;
  _setAutoSaveUI('ok');
}

function _markDirty () { _dirty = true; }

function _startAutoSave () {
  if (_autoTimer) clearInterval(_autoTimer);
  _autoTimer = setInterval(() => {
    _triggerAutoSave();
    _tickAutoSaveLabel();
  }, AUTO_SECS * 1000);
  // Also save on page hide (covers tab close and navigation)
  window.addEventListener('beforeunload', _triggerAutoSave);
  // Mark dirty on any saveState call (patch it)
  const _origSaveState = window.saveState;
  window.saveState = function () {
    if (typeof _origSaveState === 'function') _origSaveState();
    _markDirty();
  };
}

let _tickTimer = null;
function _tickAutoSaveLabel () {
  const el = document.getElementById('as-label');
  if (!el) return;
  if (clearTimeout) clearTimeout(_tickTimer);
  function update () {
    const secs = Math.round((Date.now() - _lastAutoSave) / 1000);
    if (!_lastAutoSave) { el.textContent = 'Auto-save on'; return; }
    el.textContent = secs < 60 ? `Saved ${secs}s ago` : `Saved ${Math.floor(secs/60)}m ago`;
    _tickTimer = setTimeout(update, 5000);
  }
  update();
}

function _setAutoSaveUI (state) {
  const dot = document.getElementById('as-dot');
  const lbl = document.getElementById('as-label');
  if (!dot || !lbl) return;
  if (state === 'saving') { dot.className = 'as-dot saving'; lbl.textContent = 'Saving…'; }
  else if (state === 'ok') { dot.className = 'as-dot ok'; _tickAutoSaveLabel(); }
  else if (state === 'err') { dot.className = 'as-dot err'; lbl.textContent = 'Save failed'; }
}

/* ── Restore last session ────────────────────────────────── */
function restoreLastSession () {
  const payload = _lsGet(KEY_AUTO);
  if (!payload || !payload.editorState || !Array.isArray(payload.editorState.tracks)) return;
  try {
    _deserializeState(payload);
    const t = payload.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString() : '';
    if (typeof toast === 'function') toast(`📂 Session restored${t ? ' (saved ' + t + ')' : ''}`);
    _lastAutoSave = Date.now();
    _setAutoSaveUI('ok');
  } catch (e) {
    console.warn('[ProjectManager] Session restore failed:', e);
  }
}

/* ── Save project (manual) ───────────────────────────────── */
function saveProject (name) {
  const id = 'proj_' + Date.now();
  const payload = _serializeState(name);
  payload.id        = id;
  payload.createdAt = new Date().toISOString();
  payload.updatedAt = new Date().toISOString();

  // Store in localStorage
  _lsSet(KEY_PROJ(id), payload);

  // Update index
  const idx = _getIndex();
  idx.unshift(_indexMeta(payload, id, payload.createdAt));
  _setIndex(idx);

  // Also persist auto-save slot
  _lsSet(KEY_AUTO, payload);
  _lastAutoSave = Date.now();
  _dirty = false;
  _setAutoSaveUI('ok');

  // Backend sync (non-blocking)
  _syncToBackend(payload);

  if (typeof toast === 'function') toast(`💾 Saved "${payload.name}"`);
  renderProjectList();
  return id;
}

/* ── Load project ────────────────────────────────────────── */
function loadProject (id) {
  let payload = _lsGet(KEY_PROJ(id));
  if (!payload) {
    if (typeof toast === 'function') toast('❌ Project not found');
    return;
  }
  _deserializeState(payload);
  _lsSet(KEY_AUTO, payload);
  _lastAutoSave = Date.now();
  _dirty = false;
  _setAutoSaveUI('ok');
  closeManager();
  if (typeof toast === 'function') toast(`📂 Opened "${payload.name}"`);
}

/* ── Delete project ──────────────────────────────────────── */
function deleteProject (id) {
  _lsDel(KEY_PROJ(id));
  const idx = _getIndex().filter(p => p.id !== id);
  _setIndex(idx);
  renderProjectList();
  // Backend sync
  fetch('/project/' + id, { method: 'DELETE' }).catch(() => {});
}

/* ── List projects ───────────────────────────────────────── */
function listProjects () { return _getIndex(); }

/* ── Backend sync (fire-and-forget) ─────────────────────── */
async function _syncToBackend (payload) {
  try {
    await fetch('/project/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch { /* backend optional */ }
}

/* ═══════════════════════════════════════════════════════════
   UI — Project Manager Panel
   ═══════════════════════════════════════════════════════════ */

function _createModal () {
  if (document.getElementById('pm-overlay')) return;
  const el = document.createElement('div');
  el.id = 'pm-overlay';
  el.innerHTML = `
<div id="pm-modal">
  <div class="pm-header">
    <div class="pm-header-left">
      <svg class="ic" width="16" height="16" viewBox="0 0 24 24">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      Projects
    </div>
    <button class="pm-close" onclick="ProjectManager.closeManager()">✕</button>
  </div>

  <div class="pm-save-row">
    <div class="pm-save-field">
      <input class="pm-name-input" id="pm-save-name" type="text" placeholder="Project name…"
        onkeydown="if(event.key==='Enter') ProjectManager.saveProject(this.value)">
      <button class="pm-save-btn" onclick="ProjectManager.saveProject(document.getElementById('pm-save-name').value)">
        💾 Save
      </button>
    </div>
    <div class="pm-autosave-row">
      <span class="as-dot ok" id="pm-as-dot"></span>
      <span id="pm-as-label" style="font-size:10px;color:var(--t3)">—</span>
    </div>
  </div>

  <div class="pm-section-title" id="pm-count-title">MY PROJECTS</div>
  <div id="pm-list" class="pm-list">
    <div class="pm-empty">No saved projects yet.</div>
  </div>
</div>`;
  el.addEventListener('click', e => { if (e.target === el) closeManager(); });
  document.body.appendChild(el);
}

function renderProjectList () {
  const list = document.getElementById('pm-list');
  if (!list) return;
  const projects = listProjects();
  const countEl  = document.getElementById('pm-count-title');
  if (countEl) countEl.textContent = `MY PROJECTS (${projects.length})`;

  if (!projects.length) {
    list.innerHTML = '<div class="pm-empty">No saved projects yet.<br>Save your current project above.</div>';
    return;
  }

  // Group by name for version history
  const groups = {};
  projects.forEach(p => {
    const key = p.name || 'Untitled';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  list.innerHTML = Object.entries(groups).map(([name, versions]) => {
    const latest  = versions[0];
    const dur     = latest.duration || 0;
    const durFmt  = Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0');
    const updated = _relTime(latest.updatedAt);
    const multiVer = versions.length > 1;

    const versionRows = versions.map((v, i) => `
      <div class="pm-version-row">
        <span class="pm-ver-label">v${versions.length - i}</span>
        <span class="pm-ver-time">${_relTime(v.updatedAt)}</span>
        <span class="pm-ver-info">${v.trackCount || 0} tracks · ${Math.floor((v.duration||0)/60)}:${String((v.duration||0)%60).padStart(2,'0')}</span>
        <button class="pm-ver-open" onclick="ProjectManager.loadProject('${v.id}')">Open</button>
        <button class="pm-ver-del" onclick="ProjectManager.deleteProject('${v.id}')" title="Delete this version">✕</button>
      </div>`).join('');

    return `
<div class="pm-project-card" id="pmcard-${_esc(latest.id)}">
  <div class="pm-card-header" onclick="this.parentElement.classList.toggle('expanded')">
    <div class="pm-card-info">
      <div class="pm-card-name">🎬 ${_esc(name)}</div>
      <div class="pm-card-meta">
        ${versions.length} save${versions.length > 1 ? 's' : ''} &nbsp;·&nbsp; ${durFmt} &nbsp;·&nbsp; ${updated}
      </div>
    </div>
    <div class="pm-card-actions">
      <button class="pm-open-btn" onclick="event.stopPropagation();ProjectManager.loadProject('${latest.id}')">Open</button>
      ${multiVer ? `<span class="pm-expand-arr">▶</span>` : ''}
    </div>
  </div>
  ${multiVer ? `<div class="pm-versions">${versionRows}</div>` : ''}
</div>`;
  }).join('');
}

function _syncModalAutoSave () {
  const dot = document.getElementById('pm-as-dot');
  const lbl = document.getElementById('pm-as-label');
  if (!dot || !lbl) return;
  const mainDot = document.getElementById('as-dot');
  if (mainDot) dot.className = mainDot.className.replace('as-dot', 'as-dot');
  const mainLbl = document.getElementById('as-label');
  if (mainLbl) lbl.textContent = mainLbl.textContent;
}

function openManager () {
  _createModal();
  // Pre-fill name input with current project name
  const inp = document.getElementById('pm-save-name');
  const titleEl = document.getElementById('proj-title');
  if (inp && titleEl) inp.value = titleEl.textContent.trim();
  renderProjectList();
  _syncModalAutoSave();
  document.getElementById('pm-overlay').classList.add('open');
  setTimeout(() => document.getElementById('pm-save-name')?.focus(), 80);
}

function closeManager () {
  const el = document.getElementById('pm-overlay');
  if (el) el.classList.remove('open');
}

/* ── Helpers ─────────────────────────────────────────────── */
function _relTime (iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff/60)}m ago`;
  if (diff < 86400) return `${Math.round(diff/3600)}h ago`;
  return `${Math.round(diff/86400)}d ago`;
}
function _esc (s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Wire up Ctrl+S to save project ─────────────────────── */
const _origKS = window.onkeydown;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && e.shiftKey) {
    e.preventDefault();
    openManager();
  }
});

/* ── Init ────────────────────────────────────────────────── */
function init () {
  _startAutoSave();
  // Restore last session after a 200ms delay (let renderAll finish first)
  setTimeout(restoreLastSession, 200);
  // Tick label every 5s
  setInterval(_tickAutoSaveLabel, 5000);
  // Mark initial state as the current auto-save baseline
  _lastAutoSave = Date.now();
  _setAutoSaveUI('ok');
  console.log('[ProjectManager] Project Save System v1.3 loaded');
}

/* ── Public API ──────────────────────────────────────────── */
window.ProjectManager = {
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  restoreLastSession,
  openManager,
  closeManager,
  renderProjectList,
};

// Init on DOM ready (defer scripts run after DOMContentLoaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
