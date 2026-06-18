/* ============================================================
   ACTIONS ENGINE — js/actions.js
   All timeline edits go through executeAction / executeActions.
   Reads/writes the global editor state (tracks, subtitles, etc.)
   declared in capcut.html.
   ============================================================ */

const ActionTypes = {
  CUT_CLIP:            'cut_clip',
  DELETE_CLIP:         'delete_clip',
  SPLIT_CLIP:          'split_clip',
  ADD_SUBTITLE:        'add_subtitle',
  REMOVE_SILENCE:      'remove_silence',
  CREATE_SHORT:        'create_short',
  APPLY_STYLE:         'apply_style',
  GENERATE_SUBTITLES:  'generate_subtitles',
  RESTYLE_SUBTITLES:   'restyle_subtitles',
  HIGHLIGHT_KEYWORDS:  'highlight_keywords',
};

/* ── Public API ─────────────────────────────────────────── */

function executeAction(action) {
  if (!action || !action.type) return { ok: false, error: 'No action type' };
  const params = action.params || {};
  try {
    switch (action.type) {
      case ActionTypes.CUT_CLIP:       return _actCutClip(params);
      case ActionTypes.DELETE_CLIP:    return _actDeleteClip(params);
      case ActionTypes.SPLIT_CLIP:     return _actSplitClip(params);
      case ActionTypes.ADD_SUBTITLE:   return _actAddSubtitle(params);
      case ActionTypes.REMOVE_SILENCE: return _actRemoveSilence(params);
      case ActionTypes.CREATE_SHORT:   return _actCreateShort(params);
      case ActionTypes.APPLY_STYLE:          return _actApplyStyle(params);
      case ActionTypes.GENERATE_SUBTITLES:  return _actGenerateSubtitles(params);
      case ActionTypes.RESTYLE_SUBTITLES:   return _actRestyleSubtitles(params);
      case ActionTypes.HIGHLIGHT_KEYWORDS:  return _actHighlightKeywords(params);
      default:
        return { ok: false, error: 'Unknown action: ' + action.type };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function executeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [];
  }
  const results = [];
  for (const action of actions) {
    results.push(executeAction(action));
  }
  if (typeof renderAll === 'function') renderAll();
  return results;
}

/* ── Helpers ────────────────────────────────────────────── */

function _getAllClips() {
  const all = [];
  if (typeof tracks === 'undefined') return all;
  tracks.forEach(tr => tr.clips.forEach(c => all.push({ clip: c, track: tr })));
  return all;
}

function _findClipById(id) {
  if (typeof tracks === 'undefined') return null;
  for (const tr of tracks) {
    const c = tr.clips.find(x => x.id === id);
    if (c) return { clip: c, track: tr };
  }
  return null;
}

function _saveHistory() {
  if (typeof saveState === 'function') saveState();
}

function _toast(msg) {
  if (typeof toast === 'function') toast(msg);
}

/* ── Action Implementations ─────────────────────────────── */

/* cut_clip — trim a clip's start and/or end
   params: { clipId, newStart?, newEnd? }
   If clipId omitted, operates on all selected clips. */
function _actCutClip(params) {
  const targets = params.clipId
    ? [_findClipById(params.clipId)].filter(Boolean)
    : [...(typeof selected !== 'undefined' ? selected : new Set())]
        .map(id => _findClipById(id)).filter(Boolean);

  if (!targets.length) return { ok: false, error: 'No target clips for cut_clip' };

  _saveHistory();
  let changed = 0;
  for (const { clip } of targets) {
    if (params.newStart !== undefined && params.newStart >= clip.start) {
      const delta = params.newStart - clip.start;
      clip.start = params.newStart;
      clip.dur = Math.max(0.1, clip.dur - delta);
      changed++;
    }
    if (params.newEnd !== undefined) {
      const end = clip.start + clip.dur;
      if (params.newEnd < end) {
        clip.dur = Math.max(0.1, params.newEnd - clip.start);
        changed++;
      }
    }
  }
  if (!changed) return { ok: false, error: 'cut_clip: no change applied' };
  _toast('✂ Đã cắt ' + changed + ' clip');
  return { ok: true, changed };
}

/* delete_clip — remove clip(s) from the timeline
   params: { clipId? }  — omit to delete all selected */
function _actDeleteClip(params) {
  const ids = params.clipId
    ? new Set([params.clipId])
    : (typeof selected !== 'undefined' ? new Set(selected) : new Set());

  if (!ids.size) return { ok: false, error: 'No clips selected for delete_clip' };

  _saveHistory();
  let removed = 0;
  tracks.forEach(tr => {
    const before = tr.clips.length;
    tr.clips = tr.clips.filter(c => !ids.has(c.id));
    removed += before - tr.clips.length;
  });
  if (typeof selected !== 'undefined') selected.clear();
  _toast('🗑 Đã xóa ' + removed + ' clip');
  return { ok: true, removed };
}

/* split_clip — split a clip at a given time
   params: { time?, clipId? }  — defaults to current playhead */
function _actSplitClip(params) {
  const t = params.time !== undefined ? params.time
    : (typeof playhead !== 'undefined' ? playhead : 0);

  const targets = params.clipId
    ? [_findClipById(params.clipId)].filter(Boolean)
    : _getAllClips().filter(({ clip }) =>
        t > clip.start + 0.05 && t < clip.start + clip.dur - 0.05);

  if (!targets.length) return { ok: false, error: 'No clip to split at t=' + t };

  _saveHistory();
  let splits = 0;
  for (const { clip, track } of targets) {
    if (t <= clip.start + 0.05 || t >= clip.start + clip.dur - 0.05) continue;
    const right = {
      ...clip,
      id: 'c' + (typeof nextId !== 'undefined' ? nextId++ : Date.now()),
      start: t,
      dur: clip.start + clip.dur - t
    };
    clip.dur = t - clip.start;
    track.clips.push(right);
    splits++;
  }
  _toast('✂ Đã cắt đôi ' + splits + ' clip tại ' + t.toFixed(1) + 's');
  return { ok: true, splits, time: t };
}

/* add_subtitle — create a new subtitle entry
   params: { start, dur, text } */
function _actAddSubtitle(params) {
  if (typeof subtitles === 'undefined')
    return { ok: false, error: 'subtitles not initialised yet' };

  const start = params.start !== undefined ? params.start
    : (typeof playhead !== 'undefined' ? playhead : 0);
  const dur   = params.dur  !== undefined ? params.dur  : 3;
  const text  = params.text || 'Phụ đề mới';

  const id = 'sub_ai_' + (typeof nextSubId !== 'undefined' ? nextSubId++ : Date.now());
  subtitles.push({ id, start, dur, text });

  if (typeof _renderSubList === 'function') _renderSubList();
  _toast('💬 Đã thêm phụ đề: "' + text.substring(0, 30) + '"');
  return { ok: true, id, start, dur, text };
}

/* remove_silence — removes clips whose label hints at silence,
   OR splits audio clips removing quiet segments (heuristic).
   params: { threshold? }  — threshold 0-1, default 0.1 */
function _actRemoveSilence(params) {
  const audioTracks = tracks.filter(t => t.type === 'audio');
  if (!audioTracks.length) return { ok: false, error: 'No audio tracks found' };

  _saveHistory();
  let removed = 0;

  audioTracks.forEach(tr => {
    const before = tr.clips.length;
    tr.clips = tr.clips.filter(c => {
      const lbl = (c.label || '').toLowerCase();
      return !(lbl.includes('silence') || lbl.includes('im lặng') || lbl.includes('quiet'));
    });
    removed += before - tr.clips.length;
  });

  _toast('🔇 Đã xử lý xóa im lặng (' + removed + ' đoạn)');
  return { ok: true, removed };
}

/* create_short — trim every track's clips so the project fits
   within `duration` seconds (default 30).
   params: { duration? } */
function _actCreateShort(params) {
  const maxDur = params.duration !== undefined ? params.duration : 30;
  if (typeof tracks === 'undefined') return { ok: false, error: 'tracks not ready' };

  _saveHistory();
  let trimmed = 0;

  tracks.forEach(tr => {
    tr.clips = tr.clips.filter(c => c.start < maxDur);
    tr.clips.forEach(c => {
      if (c.start + c.dur > maxDur) {
        c.dur = maxDur - c.start;
        trimmed++;
      }
    });
  });

  if (typeof subtitles !== 'undefined') {
    subtitles = subtitles.filter(s => s.start < maxDur);
    subtitles.forEach(s => {
      if (s.start + s.dur > maxDur) s.dur = maxDur - s.start;
    });
  }

  _toast('🎬 Short ' + maxDur + 's — đã cắt ' + trimmed + ' clip');
  return { ok: true, duration: maxDur, trimmed };
}

/* generate_subtitles — create subtitles from timeline clips
   params: { style? }  — optional template key */
function _actGenerateSubtitles(params) {
  if (typeof subtitles === 'undefined')
    return { ok: false, error: 'subtitles not initialised' };
  if (typeof tracks === 'undefined' || !tracks.length)
    return { ok: false, error: 'No tracks to generate from' };

  _saveHistory();
  subtitles.length = 0;
  let count = 0;
  tracks.forEach(tr => {
    (tr.clips || []).forEach(c => {
      const id = 'sub_act_' + (typeof nextSubId !== 'undefined' ? nextSubId++ : Date.now() + count);
      subtitles.push({ id, start: c.start, dur: c.dur || 3, text: c.label || 'Subtitle' });
      count++;
    });
  });

  if (window.SubEngine) window.SubEngine.upgradeAll();
  if (params.style && window.SubEngine) {
    window.SubEngine.applyTemplate(params.style, null);
  }
  if (typeof _renderSubList === 'function') _renderSubList();
  _toast(`💬 Generated ${count} subtitles`);
  return { ok: true, count };
}

/* restyle_subtitles — apply a template to all existing subtitles
   params: { style } */
function _actRestyleSubtitles(params) {
  if (typeof subtitles === 'undefined' || !subtitles.length)
    return { ok: false, error: 'No subtitles to restyle' };
  const style = params.style || 'tiktok';
  if (window.SubtitlePro) {
    window.SubtitlePro.bulkRestyle(style);
    return { ok: true, style, count: subtitles.length };
  }
  if (window.SubEngine) {
    subtitles.forEach(s => { s.style = style; });
    window.SubEngine.applyTemplate(style, null);
  }
  _toast(`🎨 Restyled ${subtitles.length} subtitles → ${style}`);
  return { ok: true, style, count: subtitles.length };
}

/* highlight_keywords — auto-detect and highlight keywords
   params: { keywords?: string[] }  — omit for auto-detection */
function _actHighlightKeywords(params) {
  const manual = params.keywords;
  if (manual && manual.length && window.SubEngine) {
    manual.forEach(k => window.SubEngine.addKeyword(k));
    _toast(`🔑 Added ${manual.length} keywords`);
    return { ok: true, keywords: manual };
  }
  if (window.SubtitlePro) {
    window.SubtitlePro.autoDetectKeywords();
    return { ok: true, auto: true };
  }
  return { ok: false, error: 'SubtitlePro not loaded' };
}

/* apply_style — apply a named filter/style to clip(s)
   params: { clipId?, style }
   style: 'sunset' | 'vintage' | 'mờ' | 'none' | ... */
function _actApplyStyle(params) {
  const style = params.style || 'none';
  const targets = params.clipId
    ? [_findClipById(params.clipId)].filter(Boolean)
    : [...(typeof selected !== 'undefined' ? selected : new Set())]
        .map(id => _findClipById(id)).filter(Boolean);

  if (!targets.length) return { ok: false, error: 'No clips for apply_style' };

  _saveHistory();
  targets.forEach(({ clip }) => { clip.filter = style; });
  _toast('🎨 Đã áp dụng style "' + style + '" cho ' + targets.length + ' clip');
  return { ok: true, style, count: targets.length };
}
