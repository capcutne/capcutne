/* ============================================================
   PROJECT SAVE SYSTEM — js/project.js
   Phase 1.3: Auto-save, session restore, version history,
   project manager UI, backend API sync.

   Storage strategy:
     cc_autosave          — current session (every 30s + beforeunload)
     cc_current_id        — ID of the last explicitly saved project
     cc_projects          — metadata index [{id,name,createdAt,updatedAt,...}]
     cc_proj_{id}         — full project payload

   All manual saves also POST to /project/save for backend persistence.
   ============================================================ */

(function () {

/* ── Constants ───────────────────────────────────────────── */
const KEY_AUTO    = 'cc_autosave';
const KEY_CUR_ID  = 'cc_current_id';
const KEY_INDEX   = 'cc_projects';
const KEY_PROJ    = id => 'cc_proj_' + id;
const MAX_HIST    = 15;
const AUTO_SECS   = 30;

/* ── State ───────────────────────────────────────────────── */
let _autoTimer    = null;
let _lastAutoSave = 0;
let _dirty        = false;
let _currentId    = null;   // ID of the currently open saved project

/* ── Title helpers ───────────────────────────────────────── */
function _getTitle () {
  const inp = document.querySelector('.tb-name');
  if (inp) return (inp.value || '').trim();
  const el = document.getElementById('proj-title');
  return el ? el.textContent.trim() : '';
}
function _setTitle (name) {
  const inp = document.querySelector('.tb-name');
  if (inp) { inp.value = name; return; }
  const el = document.getElementById('proj-title');
  if (el) el.textContent = name;
}

/* ── Serialization ───────────────────────────────────────── */
function _serializeState (name) {
  const pname = (name || _getTitle() || 'Untitled Project').trim();

  const rawTracks = typeof tracks !== 'undefined' ? tracks : [];
  const tracksCopy = JSON.parse(JSON.stringify(rawTracks)).map(tr => ({
    ...tr,
    clips: tr.clips.map(c => {
      const { audioUrl, ...rest } = c;
      if (audioUrl) rest._hadAudio = true;
      return rest;
    })
  }));

  const subsCopy = JSON.parse(JSON.stringify(
    typeof subtitles !== 'undefined' ? subtitles : []
  ));

  const rawHist  = typeof historyStack !== 'undefined' ? historyStack : [];
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

  if (Array.isArray(state.historyStack)) {
    historyStack = state.historyStack;
    historyIdx   = typeof state.historyIdx === 'number'
      ? state.historyIdx : historyStack.length - 1;
  } else {
    historyStack = []; historyIdx = -1;
  }

  if (payload.name) _setTitle(payload.name);

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
  const state     = payload.editorState || {};
  const allClips  = (state.tracks || []).flatMap(t => t.clips || []);
  const dur       = allClips.reduce((m, c) => Math.max(m, c.start + (c.dur || 0)), 0);
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
  _setAutoSaveUI('saving');
  const payload    = _serializeState();
  payload.updatedAt = new Date().toISOString();
  _lsSet(KEY_AUTO, payload);

  // Also silently update the current named project's localStorage entry
  if (_currentId) {
    const existing = _lsGet(KEY_PROJ(_currentId));
    if (existing) {
      const updated = { ...existing, ...payload, id: _currentId };
      _lsSet(KEY_PROJ(_currentId), updated);
      // Update index metadata
      const idx = _getIndex().map(m =>
        m.id === _currentId ? { ...m, ...(_indexMeta(updated, _currentId, m.createdAt)) } : m
      );
      _setIndex(idx);
      // Backend sync (non-blocking)
      _syncToBackend(updated);
    }
  }

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
  window.addEventListener('beforeunload', _triggerAutoSave);
  // Patch saveState to mark dirty
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
  if (_tickTimer) clearTimeout(_tickTimer);
  function update () {
    const secs = Math.round((Date.now() - _lastAutoSave) / 1000);
    if (!_lastAutoSave) { el.textContent = 'Auto-save on'; return; }
    el.textContent = secs < 60
      ? `Saved ${secs}s ago`
      : `Saved ${Math.floor(secs / 60)}m ago`;
    _tickTimer = setTimeout(update, 5000);
  }
  update();
}

function _setAutoSaveUI (state) {
  ['as-dot', 'pm-as-dot'].forEach(dotId => {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    if      (state === 'saving') dot.className = 'as-dot saving';
    else if (state === 'ok')     dot.className = 'as-dot ok';
    else if (state === 'err')    dot.className = 'as-dot err';
  });
  const lbl = document.getElementById('as-label');
  if (lbl && state === 'saving') lbl.textContent = 'Saving…';
  else if (lbl && state === 'err') lbl.textContent = 'Save failed';
  else if (lbl && state === 'ok') _tickAutoSaveLabel();

  const pmLbl = document.getElementById('pm-as-label');
  if (pmLbl) {
    const mainLbl = document.getElementById('as-label');
    if (mainLbl) pmLbl.textContent = mainLbl.textContent;
  }
}

/* ── Restore last session ────────────────────────────────── */
function restoreLastSession () {
  const payload = _lsGet(KEY_AUTO);
  if (!payload || !payload.editorState || !Array.isArray(payload.editorState.tracks)) return;
  try {
    _deserializeState(payload);
    // Restore which project was open
    _currentId = _lsGet(KEY_CUR_ID) || null;
    const t = payload.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString() : '';
    if (typeof toast === 'function')
      toast(`📂 Session restored${t ? ' (saved ' + t + ')' : ''}`);
    _lastAutoSave = Date.now();
    _setAutoSaveUI('ok');
    _updateTopbarSavedState();
  } catch (e) {
    console.warn('[ProjectManager] Session restore failed:', e);
  }
}

/* ── Save project (new version) ──────────────────────────── */
function saveProject (name) {
  const id      = 'proj_' + Date.now();
  const payload = _serializeState(name);
  payload.id        = id;
  payload.createdAt = new Date().toISOString();
  payload.updatedAt = new Date().toISOString();

  _lsSet(KEY_PROJ(id), payload);

  const idx = _getIndex();
  idx.unshift(_indexMeta(payload, id, payload.createdAt));
  _setIndex(idx);

  _lsSet(KEY_AUTO, payload);
  _lsSet(KEY_CUR_ID, id);
  _currentId    = id;
  _lastAutoSave = Date.now();
  _dirty        = false;
  _setAutoSaveUI('ok');

  _syncToBackend(payload);

  if (typeof toast === 'function') toast(`💾 Saved "${payload.name}"`);
  renderProjectList();
  _updateTopbarSavedState();
  return id;
}

/* ── Quick save — updates current project or saves new ───── */
function quickSave () {
  if (_currentId) {
    const existing = _lsGet(KEY_PROJ(_currentId));
    if (existing) {
      _setAutoSaveUI('saving');
      const payload = _serializeState();
      payload.id        = _currentId;
      payload.createdAt = existing.createdAt || new Date().toISOString();
      payload.updatedAt = new Date().toISOString();

      _lsSet(KEY_PROJ(_currentId), payload);
      const idx = _getIndex().map(m =>
        m.id === _currentId ? _indexMeta(payload, _currentId, m.createdAt) : m
      );
      _setIndex(idx);
      _lsSet(KEY_AUTO, payload);
      _lastAutoSave = Date.now();
      _dirty = false;
      _setAutoSaveUI('ok');
      _syncToBackend(payload);
      if (typeof toast === 'function') toast(`💾 Updated "${payload.name}"`);
      renderProjectList();
      return;
    }
  }
  // No current project — open manager to save as new
  openManager();
}

/* ── New project ─────────────────────────────────────────── */
function newProject () {
  if (!confirm('Start a new project? Unsaved changes will be lost.')) return;
  if (typeof audioPause === 'function') audioPause();
  if (typeof audioPlayers !== 'undefined' && typeof disposeAudioPlayer === 'function') {
    Object.keys(audioPlayers).forEach(id => disposeAudioPlayer(id));
  }
  if (typeof tracks     !== 'undefined') tracks     = [];
  if (typeof subtitles  !== 'undefined') subtitles  = [];
  if (typeof historyStack !== 'undefined') { historyStack = []; historyIdx = -1; }
  if (typeof playhead   !== 'undefined') playhead   = 0;
  if (typeof zoomIdx    !== 'undefined') zoomIdx    = 2;
  if (typeof nextId     !== 'undefined') nextId     = 1;
  if (typeof nextSubId  !== 'undefined') nextSubId  = 1;
  if (typeof selected   !== 'undefined') selected.clear();
  _setTitle('New Project');
  _currentId = null;
  _lsDel(KEY_CUR_ID);
  _dirty = false;
  if (typeof renderAll       === 'function') renderAll();
  if (typeof updateHistDots  === 'function') updateHistDots();
  if (typeof updateRightInfo === 'function') updateRightInfo();
  _updateTopbarSavedState();
  closeManager();
  if (typeof toast === 'function') toast('🆕 New project created');
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
  _lsSet(KEY_CUR_ID, id);
  _currentId    = id;
  _lastAutoSave = Date.now();
  _dirty        = false;
  _setAutoSaveUI('ok');
  _updateTopbarSavedState();
  closeManager();
  if (typeof toast === 'function') toast(`📂 Opened "${payload.name}"`);
}

/* ── Delete project ──────────────────────────────────────── */
function deleteProject (id) {
  if (!confirm('Delete this version?')) return;
  _lsDel(KEY_PROJ(id));
  const idx = _getIndex().filter(p => p.id !== id);
  _setIndex(idx);
  if (_currentId === id) {
    _currentId = null;
    _lsDel(KEY_CUR_ID);
    _updateTopbarSavedState();
  }
  renderProjectList();
  fetch('/project/' + id, { method: 'DELETE' }).catch(() => {});
}

/* ── List projects ───────────────────────────────────────── */
function listProjects () { return _getIndex(); }

/* ── Backend sync (fire-and-forget) ─────────────────────── */
async function _syncToBackend (payload) {
  try {
    await fetch('/project/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch { /* backend optional */ }
}

/* ── Topbar saved-state indicator ────────────────────────── */
function _updateTopbarSavedState () {
  const btn = document.querySelector('.pm-open-topbar');
  if (!btn) return;
  if (_currentId) {
    btn.style.borderColor = 'var(--accent)';
    btn.title = 'Project Manager — project saved (Ctrl+Shift+S)';
  } else {
    btn.style.borderColor = '';
    btn.title = 'Project Manager (Ctrl+Shift+S)';
  }
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
    <div style="display:flex;align-items:center;gap:8px">
      <button class="pm-new-btn" onclick="ProjectManager.newProject()" title="New project">
        + New
      </button>
      <button class="pm-close" onclick="ProjectManager.closeManager()">✕</button>
    </div>
  </div>

  <div class="pm-save-row">
    <div class="pm-save-field">
      <input class="pm-name-input" id="pm-save-name" type="text" placeholder="Project name…"
        onkeydown="if(event.key==='Enter') ProjectManager.saveProject(this.value)">
      <button class="pm-save-btn" onclick="ProjectManager.saveProject(document.getElementById('pm-save-name').value)">
        💾 Save as new
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

  // Add .pm-new-btn style if not present
  if (!document.getElementById('pm-extra-style')) {
    const st = document.createElement('style');
    st.id = 'pm-extra-style';
    st.textContent = `.pm-new-btn{padding:5px 12px;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t2);font-size:11px;font-weight:600;cursor:pointer;transition:background .12s}.pm-new-btn:hover{background:var(--bg4);color:var(--t1)}`;
    document.head.appendChild(st);
  }
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
    const latest   = versions[0];
    const dur      = latest.duration || 0;
    const durFmt   = Math.floor(dur / 60) + ':' + String(dur % 60).padStart(2, '0');
    const updated  = _relTime(latest.updatedAt);
    const multiVer = versions.length > 1;
    const isCurrent = versions.some(v => v.id === _currentId);

    const versionRows = versions.map((v, i) => `
      <div class="pm-version-row">
        <span class="pm-ver-label">v${versions.length - i}</span>
        <span class="pm-ver-time">${_relTime(v.updatedAt)}</span>
        <span class="pm-ver-info">${v.trackCount || 0} tracks · ${Math.floor((v.duration||0)/60)}:${String((v.duration||0)%60).padStart(2,'0')}</span>
        <button class="pm-ver-open" onclick="ProjectManager.loadProject('${v.id}')">Open</button>
        <button class="pm-ver-del" onclick="ProjectManager.deleteProject('${v.id}')" title="Delete this version">✕</button>
      </div>`).join('');

    return `
<div class="pm-project-card${isCurrent ? ' pm-card-current' : ''}" id="pmcard-${_esc(latest.id)}">
  <div class="pm-card-header" onclick="this.parentElement.classList.toggle('expanded')">
    <div class="pm-card-info">
      <div class="pm-card-name">🎬 ${_esc(name)}${isCurrent ? ' <span style="font-size:9px;color:var(--accent);font-weight:700;letter-spacing:.4px">● OPEN</span>' : ''}</div>
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

  // Add current-card style
  if (!document.getElementById('pm-cur-style')) {
    const st = document.createElement('style');
    st.id = 'pm-cur-style';
    st.textContent = `.pm-card-current{border-color:var(--accentdim)!important;background:rgba(212,160,23,.06)!important}`;
    document.head.appendChild(st);
  }
}

function openManager () {
  _createModal();
  const inp     = document.getElementById('pm-save-name');
  const title   = _getTitle();
  if (inp && title) inp.value = title;
  renderProjectList();
  // Sync autosave indicator
  const pmDot = document.getElementById('pm-as-dot');
  const pmLbl = document.getElementById('pm-as-label');
  const dot   = document.getElementById('as-dot');
  const lbl   = document.getElementById('as-label');
  if (pmDot && dot) pmDot.className = dot.className;
  if (pmLbl && lbl) pmLbl.textContent = lbl.textContent;
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
  if (diff < 60)    return `${Math.round(diff)}s ago`;
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
function _esc (s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Keyboard shortcuts ──────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key.toLowerCase() === 's' && e.shiftKey) {
    e.preventDefault();
    openManager();
  } else if (e.key.toLowerCase() === 's' && !e.shiftKey) {
    e.preventDefault();
    quickSave();
  }
});

/* ── Init ────────────────────────────────────────────────── */
function init () {
  _startAutoSave();
  setTimeout(restoreLastSession, 200);
  setInterval(_tickAutoSaveLabel, 5000);
  _lastAutoSave = Date.now();
  _setAutoSaveUI('ok');
  console.log('[ProjectManager] Project Save System v1.3 loaded');
}

/* ── Public API ──────────────────────────────────────────── */
window.ProjectManager = {
  saveProject,
  quickSave,
  loadProject,
  deleteProject,
  listProjects,
  newProject,
  restoreLastSession,
  openManager,
  closeManager,
  renderProjectList,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
