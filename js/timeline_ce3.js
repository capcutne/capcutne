/* ═══════════════════════════════════════════════════════════════
   CE-3: Advanced Multi-Track Timeline
   Track controls: lock · mute · hide · rename · color
   Clip actions : split · ripple-delete · duplicate · group · ungroup
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Context menu state ─────────────────────────────────────── */
let _ce3CtxClipId  = null;
let _ce3CtxTrackId = null;

/* ─── Track Controls ─────────────────────────────────────────── */

function ce3_toggleLock(trackId) {
  const tr = tracks.find(t => t.id === trackId);
  if (!tr) return;
  tr.locked = !tr.locked;
  saveState();
  renderAll();
  toast(tr.locked ? '🔒 Track đã khoá' : '🔓 Track đã mở khoá');
}

function ce3_toggleMute(trackId) {
  const tr = tracks.find(t => t.id === trackId);
  if (!tr) return;
  tr.muted = !tr.muted;
  saveState();
  renderAll();
  toast(tr.muted ? '🔇 Track đã tắt tiếng' : '🔊 Track đã bật tiếng');
}

function ce3_toggleHide(trackId) {
  const tr = tracks.find(t => t.id === trackId);
  if (!tr) return;
  tr.hidden = !tr.hidden;
  saveState();
  renderAll();
  toast(tr.hidden ? '🙈 Track đã ẩn' : '👁 Track đã hiện');
}

function ce3_renameTrack(trackId, el) {
  const tr = tracks.find(t => t.id === trackId);
  if (!tr) return;
  const oldLabel = tr.label;
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish() {
    el.contentEditable = 'false';
    const newLabel = el.textContent.trim();
    tr.label = newLabel || oldLabel;
    el.textContent = tr.label;
    el.removeEventListener('blur', finish);
    el.removeEventListener('keydown', onKey);
    saveState();
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = oldLabel; el.blur(); }
  }
  el.addEventListener('blur', finish);
  el.addEventListener('keydown', onKey);
}

function ce3_setTrackColor(trackId, color) {
  const tr = tracks.find(t => t.id === trackId);
  if (!tr) return;
  tr.color = color;
  saveState();
  renderAll();
}

/* ─── Add / Remove Tracks ────────────────────────────────────── */

function ce3_addTrack(type) {
  const count  = tracks.filter(t => t.type === type).length + 1;
  const LABELS = { video:'Video', overlay:'Overlay', effect:'Hiệu ứng', text:'Văn bản', audio:'Âm thanh' };
  const label  = (LABELS[type] || type) + (count > 1 ? ' ' + count : '');
  saveState();
  tracks.push({
    id    : 'tr' + (nextId++),
    type,
    label,
    icon  : (typeof ICONS !== 'undefined' ? (ICONS[type] || ICONS.video) : ''),
    color : (typeof CE3_TRACK_COLORS !== 'undefined' ? CE3_TRACK_COLORS[type] : '#6b7280') || '#6b7280',
    locked: false,
    muted : false,
    hidden: false,
    trans : type === 'video' || type === 'overlay',
    clips : []
  });
  renderAll();
  toast('✅ Đã thêm track ' + label);
}

function ce3_removeTrack(trackId) {
  const idx = tracks.findIndex(t => t.id === trackId);
  if (idx === -1) return;
  if (tracks.length <= 1) { toast('⚠ Không thể xoá track cuối cùng'); return; }
  const tr = tracks[idx];
  tr.clips.forEach(c => selected.delete(c.id));
  saveState();
  tracks.splice(idx, 1);
  renderAll();
  toast('🗑 Đã xoá track ' + tr.label);
  ce3_hideCtxMenu();
}

/* ─── Clip Actions ───────────────────────────────────────────── */

function ce3_splitClip(clipId) {
  const id = clipId || (_ce3CtxClipId) || (selected.size === 1 ? [...selected][0] : null);
  if (!id) { toast('⚠ Chọn 1 clip rồi nhấn S để cắt'); return; }
  const found = findClip(id);
  if (!found) return;
  const { clip, track } = found;
  if (track.locked) { toast('🔒 Track đã khoá'); return; }
  const splitAt = playhead;
  if (splitAt <= clip.start + 0.05 || splitAt >= clip.start + clip.dur - 0.05) {
    toast('⚠ Playhead phải nằm trong clip để cắt'); return;
  }
  saveState();
  const right = {
    ...JSON.parse(JSON.stringify(clip)),
    id   : 'c' + Date.now(),
    start: splitAt,
    dur  : clip.start + clip.dur - splitAt
  };
  clip.dur = splitAt - clip.start;
  track.clips.push(right);
  renderAll();
  toast('✂ Đã cắt tại ' + fmt(splitAt));
  ce3_hideCtxMenu();
}

function ce3_rippleDelete(clipId) {
  const id = clipId || (_ce3CtxClipId) || (selected.size === 1 ? [...selected][0] : null);
  if (!id) { toast('⚠ Chọn 1 clip để xoá ripple'); return; }
  const found = findClip(id);
  if (!found) return;
  const { clip, track } = found;
  if (track.locked) { toast('🔒 Track đã khoá'); return; }
  saveState();
  const gap       = clip.dur;
  const deleteEnd = clip.start + clip.dur;
  track.clips = track.clips.filter(c => c.id !== id);
  track.clips.forEach(c => { if (c.start >= deleteEnd) c.start = Math.max(0, c.start - gap); });
  selected.delete(id);
  renderAll();
  toast('⬅ Ripple delete — đã bù lấp khoảng trống');
  ce3_hideCtxMenu();
}

function ce3_duplicateClip(clipId) {
  const id = clipId || (_ce3CtxClipId) || (selected.size === 1 ? [...selected][0] : null);
  if (!id) { toast('⚠ Chọn 1 clip để nhân đôi'); return; }
  const found = findClip(id);
  if (!found) return;
  const { clip, track } = found;
  if (track.locked) { toast('🔒 Track đã khoá'); return; }
  saveState();
  const dup = { ...JSON.parse(JSON.stringify(clip)), id: 'c' + Date.now(), start: clip.start + clip.dur };
  track.clips.push(dup);
  selected.clear();
  selected.add(dup.id);
  renderAll();
  toast('⧉ Đã nhân đôi clip');
  ce3_hideCtxMenu();
}

function ce3_groupSelected() {
  if (selected.size < 2) { toast('⚠ Chọn ít nhất 2 clip để nhóm'); return; }
  const gid = 'g' + Date.now();
  saveState();
  tracks.forEach(tr => tr.clips.forEach(c => { if (selected.has(c.id)) c.group = gid; }));
  renderAll();
  toast('📦 Đã nhóm ' + selected.size + ' clip');
  ce3_hideCtxMenu();
}

function ce3_ungroupSelected() {
  if (selected.size === 0) { toast('⚠ Chọn clip để bỏ nhóm'); return; }
  saveState();
  tracks.forEach(tr => tr.clips.forEach(c => { if (selected.has(c.id)) delete c.group; }));
  renderAll();
  toast('📭 Đã bỏ nhóm');
  ce3_hideCtxMenu();
}

/* ─── Context Menu ───────────────────────────────────────────── */

function ce3_showCtxMenu(e, clipId, trackId) {
  e.preventDefault();
  e.stopPropagation();
  _ce3CtxClipId  = clipId  || null;
  _ce3CtxTrackId = trackId || null;

  /* Update menu item availability */
  const found     = clipId ? findClip(clipId) : null;
  const tr        = trackId ? tracks.find(t => t.id === trackId) : null;
  const hasClip   = !!found;
  const multiSel  = selected.size >= 2;
  const isGrouped = hasClip && !!found.clip.group;

  const menu = document.getElementById('ce3-ctx-menu');
  if (!menu) return;

  menu.querySelector('[data-action="split"]')  && (menu.querySelector('[data-action="split"]').style.opacity  = hasClip ? '1' : '.4');
  menu.querySelector('[data-action="ripple"]') && (menu.querySelector('[data-action="ripple"]').style.opacity = hasClip ? '1' : '.4');
  menu.querySelector('[data-action="dup"]')    && (menu.querySelector('[data-action="dup"]').style.opacity    = hasClip ? '1' : '.4');
  menu.querySelector('[data-action="group"]')  && (menu.querySelector('[data-action="group"]').style.opacity  = multiSel ? '1' : '.4');
  menu.querySelector('[data-action="ungroup"]')&& (menu.querySelector('[data-action="ungroup"]').style.opacity= isGrouped ? '1' : '.4');

  /* Track label in remove */
  const removeLbl = menu.querySelector('[data-action="remove-track"]');
  if (removeLbl && tr) removeLbl.textContent = '🗑 Xoá track "' + tr.label + '"';

  /* Position */
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX, y = e.clientY;
  menu.style.display = 'block';
  if (x + 190 > vw) x = vw - 195;
  if (y + menu.offsetHeight > vh) y = Math.max(5, vh - menu.offsetHeight - 5);
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

function ce3_hideCtxMenu() {
  const menu = document.getElementById('ce3-ctx-menu');
  if (menu) menu.style.display = 'none';
}

document.addEventListener('click', ce3_hideCtxMenu);
document.addEventListener('scroll', ce3_hideCtxMenu, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') ce3_hideCtxMenu(); });

/* ─── Track context menu (right-click on track head) ────────── */
function ce3_showTrackCtx(e, trackId) {
  e.preventDefault();
  e.stopPropagation();
  _ce3CtxClipId  = null;
  _ce3CtxTrackId = trackId;
  const tr   = tracks.find(t => t.id === trackId);
  const menu = document.getElementById('ce3-track-ctx-menu');
  if (!menu || !tr) return;

  menu.querySelector('[data-action="t-lock"]').textContent  = (tr.locked ? '🔓 Mở khoá' : '🔒 Khoá') + ' track';
  menu.querySelector('[data-action="t-mute"]').textContent  = (tr.muted  ? '🔊 Bật tiếng' : '🔇 Tắt tiếng') + ' track';
  menu.querySelector('[data-action="t-hide"]').textContent  = (tr.hidden ? '👁 Hiện' : '🙈 Ẩn') + ' track';

  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX, y = e.clientY;
  menu.style.display = 'block';
  if (x + 190 > vw) x = vw - 195;
  if (y + menu.offsetHeight > vh) y = Math.max(5, vh - menu.offsetHeight - 5);
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

function ce3_hideTrackCtxMenu() {
  const menu = document.getElementById('ce3-track-ctx-menu');
  if (menu) menu.style.display = 'none';
}

document.addEventListener('click', ce3_hideTrackCtxMenu);

/* ─── Override existing addVideoTrack / addAudioTrack ────────── */
window.addVideoTrack = () => ce3_addTrack('video');
window.addAudioTrack = () => ce3_addTrack('audio');

/* ─── Keyboard shortcuts ─────────────────────────────────────── */
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault(); ce3_splitClip(); return;
  }
  if (e.key === 'Backspace' && e.shiftKey) {
    e.preventDefault(); ce3_rippleDelete(); return;
  }
  if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault(); ce3_duplicateClip(); return;
  }
});

console.log('[CE-3] Advanced Multi-Track Timeline loaded — split(S) · ripple(⇧⌫) · dup(D)');
