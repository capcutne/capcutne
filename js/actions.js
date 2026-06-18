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
  GENERATE_BATCH:      'generate_batch',
  EXPORT_BATCH:        'export_batch',
  PREVIEW_SHORT:       'preview_short',
  // Phase 3.0 — Personal Editing Memory
  APPLY_MY_STYLE:      'apply_my_style',
  SAVE_STYLE_SNAPSHOT: 'save_style_snapshot',
  RESTORE_STYLE:       'restore_style',
  // Phase 3.1 — Brand Clone System
  TRAIN_BRAND:          'train_brand',
  APPLY_BRAND:          'apply_brand',
  COMPARE_BRAND:        'compare_brand',
  GENERATE_BRAND_CTA:   'generate_brand_cta',
  GENERATE_BRAND_SHORT: 'generate_brand_short',
  // Phase 4.2 — Performance Analytics & Learning System
  ANALYZE_PERFORMANCE:  'analyze_performance',
  COMPARE_CONTENT:      'compare_content',
  GENERATE_INSIGHTS:    'generate_insights',
  IMPROVE_BRAND:        'improve_brand',
  // Phase 5.0 — Autonomous Content Agent
  GENERATE_CONTENT_PLAN:'generate_content_plan',
  ANALYZE_STRATEGY:     'analyze_strategy',
  GENERATE_IDEAS:       'generate_ideas',
  CREATE_TASK:          'create_task',
  // Phase 4.1 — AI Publishing System
  OPTIMIZE_PLATFORM:       'optimize_platform',
  VALIDATE_CONTENT:        'validate_content',
  SCHEDULE_CONTENT:        'schedule_content',
  PREPARE_PUBLISH_PACKAGE: 'prepare_publish_package',
  // Phase 4.0 — Auto Content Factory
  GENERATE_CONTENT_FACTORY: 'generate_content_factory',
  EXPORT_FACTORY:            'export_factory',
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
      case ActionTypes.GENERATE_BATCH:      return _actGenerateBatch(params);
      case ActionTypes.EXPORT_BATCH:        return _actExportBatch(params);
      case ActionTypes.PREVIEW_SHORT:       return _actPreviewShort(params);
      case ActionTypes.APPLY_MY_STYLE:      return _actApplyMyStyle(params);
      case ActionTypes.SAVE_STYLE_SNAPSHOT: return _actSaveStyleSnapshot(params);
      case ActionTypes.RESTORE_STYLE:       return _actRestoreStyle(params);
      case ActionTypes.TRAIN_BRAND:          return _actTrainBrand(params);
      case ActionTypes.APPLY_BRAND:          return _actApplyBrand(params);
      case ActionTypes.COMPARE_BRAND:        return _actCompareBrand(params);
      case ActionTypes.GENERATE_BRAND_CTA:   return _actGenerateBrandCTA(params);
      case ActionTypes.GENERATE_BRAND_SHORT: return _actGenerateBrandShort(params);
      // Phase 4.2 — Performance Analytics
      case ActionTypes.ANALYZE_PERFORMANCE:  return _actAnalyzePerformance(params);
      case ActionTypes.COMPARE_CONTENT:      return _actCompareContent(params);
      case ActionTypes.GENERATE_INSIGHTS:    return _actGenerateInsights(params);
      case ActionTypes.IMPROVE_BRAND:        return _actImproveBrand(params);
      // Phase 5.0 — Autonomous Content Agent
      case ActionTypes.GENERATE_CONTENT_PLAN: return _actGenerateContentPlan(params);
      case ActionTypes.ANALYZE_STRATEGY:      return _actAnalyzeStrategy(params);
      case ActionTypes.GENERATE_IDEAS:        return _actGenerateIdeas(params);
      case ActionTypes.CREATE_TASK:           return _actCreateTask(params);
      // Phase 4.0 — Auto Content Factory
      case ActionTypes.GENERATE_CONTENT_FACTORY: return _actGenerateContentFactory(params);
      case ActionTypes.EXPORT_FACTORY:            return _actExportFactory(params);
      // Phase 4.1 — AI Publishing System
      case ActionTypes.OPTIMIZE_PLATFORM:       return _actOptimizePlatform(params);
      case ActionTypes.VALIDATE_CONTENT:        return _actValidateContent(params);
      case ActionTypes.SCHEDULE_CONTENT:        return _actScheduleContent(params);
      case ActionTypes.PREPARE_PUBLISH_PACKAGE: return _actPreparePublishPackage(params);
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

/* generate_batch — open the Batch Shorts Factory panel */
function _actGenerateBatch(params) {
  if (window.BatchFactory) {
    window.BatchFactory.open();
    if (params.maxShorts || params.template) {
      window.BatchFactory.run(params.maxShorts || 10, params.template || 'tiktok');
    }
    return { ok: true };
  }
  return { ok: false, error: 'BatchFactory not loaded' };
}

/* export_batch — export all ready shorts in current factory batch */
function _actExportBatch(params) {
  if (window.BatchFactory) {
    window.BatchFactory.exportAll();
    return { ok: true };
  }
  return { ok: false, error: 'BatchFactory not loaded' };
}

/* preview_short — apply a specific short to the main timeline */
function _actPreviewShort(params) {
  const id = params.shortId || params.id;
  if (window.BatchFactory && id) {
    window.BatchFactory.previewShort(id);
    return { ok: true };
  }
  return { ok: false, error: 'BatchFactory not loaded or shortId missing' };
}

/* ── Phase 3.0 — Personal Editing Memory actions ────────── */

/* apply_my_style — áp dụng phong cách đã học từ StyleMemory */
function _actApplyMyStyle(params) {
  if (!window.StyleMemory) return { ok: false, error: 'StyleMemory not loaded' };
  return window.StyleMemory.applyMyStyle();
}

/* save_style_snapshot — lưu preset phong cách hiện tại
   params: { name? } */
function _actSaveStyleSnapshot(params) {
  if (!window.StyleMemory) return { ok: false, error: 'StyleMemory not loaded' };
  const name = params.name || null;
  window.StyleMemory.saveSnapshot(name);
  return { ok: true, name };
}

/* restore_style — áp dụng một style preset theo tên hoặc id
   params: { id?, name? } */
function _actRestoreStyle(params) {
  if (!window.StyleMemory) return { ok: false, error: 'StyleMemory not loaded' };
  const snaps = window.StyleMemory.getSnapshots();
  let snap = null;
  if (params.id)   snap = snaps.find(s => s.id   === params.id);
  if (!snap && params.name) snap = snaps.find(s => s.name === params.name);
  if (!snap && snaps.length) snap = snaps[0];
  if (!snap) return { ok: false, error: 'Không tìm thấy preset' };
  window.StyleMemory.applySnapshot(snap.id);
  return { ok: true, applied: snap.name };
}

/* ── Phase 3.1 — Brand Clone System actions ──────────── */

/* train_brand — học từ editor hiện tại hoặc projects
   params: { source?: 'editor'|'projects' } */
function _actTrainBrand(params) {
  if (!window.BrandClone) return { ok: false, error: 'BrandClone not loaded' };
  const src = (params.source || 'editor').toLowerCase();
  if (src === 'projects') {
    window.BrandClone.trainFromProjects();
  } else {
    window.BrandClone.trainFromCurrentEditor();
  }
  return { ok: true, source: src };
}

/* apply_brand — áp dụng Brand Style vào project hiện tại */
function _actApplyBrand(params) {
  if (!window.BrandClone) return { ok: false, error: 'BrandClone not loaded' };
  return window.BrandClone.applyBrandStyle();
}

/* compare_brand — so sánh video hiện tại với Brand Profile */
function _actCompareBrand(params) {
  if (!window.BrandClone) return { ok: false, error: 'BrandClone not loaded' };
  window.BrandClone.compareToBrand();
  return { ok: true };
}

/* generate_brand_cta — tạo CTA giống phong cách brand
   params: {} */
function _actGenerateBrandCTA(params) {
  if (!window.BrandClone) return { ok: false, error: 'BrandClone not loaded' };
  window.BrandClone.generateBrandCTA();
  return { ok: true };
}

/* generate_brand_short — tạo short theo phong cách brand */
function _actGenerateBrandShort(params) {
  if (!window.BrandClone) return { ok: false, error: 'BrandClone not loaded' };
  window.BrandClone.generateBrandShort();
  return { ok: true };
}

/* ── Phase 5.0 — Autonomous Content Agent ── */

/* generate_content_plan — build 7/30/90 day calendar */
function _actGenerateContentPlan(params) {
  if (!window.ContentAgent) return { ok: false, error: 'ContentAgent not loaded' };
  return window.ContentAgent.actGenerateContentPlan(params);
}

/* analyze_strategy — full agent run: memory, opportunities, recommendations */
function _actAnalyzeStrategy(params) {
  if (!window.ContentAgent) return { ok: false, error: 'ContentAgent not loaded' };
  return window.ContentAgent.actAnalyzeStrategy(params);
}

/* generate_ideas — create 10 content ideas with simulated scores */
function _actGenerateIdeas(params) {
  if (!window.ContentAgent) return { ok: false, error: 'ContentAgent not loaded' };
  return window.ContentAgent.actGenerateIdeas(params);
}

/* create_task — add a task to the agent task queue */
function _actCreateTask(params) {
  if (!window.ContentAgent) return { ok: false, error: 'ContentAgent not loaded' };
  return window.ContentAgent.actCreateTask(params);
}

/* ── Phase 4.2 — Performance Analytics & Learning System ── */

/* analyze_performance — trigger full insight generation */
function _actAnalyzePerformance(params) {
  if (!window.AnalyticsManager) return { ok: false, error: 'AnalyticsManager not loaded' };
  return window.AnalyticsManager.actAnalyzePerformance(params);
}

/* compare_content — compare a set of content records by id */
function _actCompareContent(params) {
  if (!window.AnalyticsManager) return { ok: false, error: 'AnalyticsManager not loaded' };
  return window.AnalyticsManager.actCompareContent(params);
}

/* generate_insights — run learning engine and open insights tab */
function _actGenerateInsights(params) {
  if (!window.AnalyticsManager) return { ok: false, error: 'AnalyticsManager not loaded' };
  return window.AnalyticsManager.actGenerateInsights(params);
}

/* improve_brand — update brand confidence from performance data */
function _actImproveBrand(params) {
  if (!window.AnalyticsManager) return { ok: false, error: 'AnalyticsManager not loaded' };
  return window.AnalyticsManager.actImproveBrand(params);
}

/* ── Phase 4.0 — Auto Content Factory ── */

/* generate_content_factory — chạy pipeline đầy đủ
   params: { types?: string[] } */
function _actGenerateContentFactory(params) {
  if (!window.ContentFactory) return { ok: false, error: 'ContentFactory not loaded' };
  const types = params.types || null;
  ContentFactory.runFactory(types);
  if (typeof setTool_byName === 'function') setTool_byName('cfactory');
  return { ok: true, types: types || 'all' };
}

/* export_factory — xuất export package JSON
   params: {} */
function _actExportFactory(params) {
  if (!window.ContentFactory) return { ok: false, error: 'ContentFactory not loaded' };
  ContentFactory.exportPackage();
  return { ok: true };
}

/* ── Phase 4.1 — AI Publishing System ── */

/* optimize_platform — AI tối ưu nội dung cho nền tảng cụ thể
   params: { id?, platform? } */
function _actOptimizePlatform(params) {
  if (!window.PublishingManager) return { ok: false, error: 'PublishingManager not loaded' };
  if (params.platform && !params.id) {
    // Open publishing panel and optimize all for that platform
    const pkgs = PublishingManager.getPackages(params.platform);
    if (!pkgs.length) {
      // Auto-create from editor
      const created = PublishingManager.createFromEditor([params.platform]);
      created.forEach(p => PublishingManager.optimizeForPlatform(p.id));
      if (typeof setTool_byName === 'function') setTool_byName('publish');
      return { ok: true, created: created.length, platform: params.platform };
    }
    pkgs.forEach(p => PublishingManager.optimizeForPlatform(p.id));
    if (typeof setTool_byName === 'function') setTool_byName('publish');
    return { ok: true, optimized: pkgs.length, platform: params.platform };
  }
  if (params.id) {
    const result = PublishingManager.optimizeForPlatform(params.id);
    return result ? { ok: true, id: params.id } : { ok: false, error: 'Package not found' };
  }
  // Optimize all
  PublishingManager.optimizeAll();
  if (typeof setTool_byName === 'function') setTool_byName('publish');
  return { ok: true, optimized: 'all' };
}

/* validate_content — kiểm tra nội dung hàng loạt hoặc theo id
   params: { id? } */
function _actValidateContent(params) {
  if (!window.PublishingManager) return { ok: false, error: 'PublishingManager not loaded' };
  if (params.id) {
    const result = PublishingManager.validatePackage(params.id);
    return { ok: true, id: params.id, ...result };
  }
  const results = PublishingManager.bulkValidate(null);
  const passed = results.filter(r => r.result.passed).length;
  if (typeof setTool_byName === 'function') setTool_byName('publish');
  return { ok: true, total: results.length, passed, failed: results.length - passed };
}

/* schedule_content — lên lịch đăng nội dung
   params: { id, publishAt, platform? } */
function _actScheduleContent(params) {
  if (!window.PublishingManager) return { ok: false, error: 'PublishingManager not loaded' };
  if (!params.publishAt) return { ok: false, error: 'Cần cung cấp publishAt (ISO datetime)' };
  const ids = params.ids || (params.id ? [params.id] : PublishingManager.getPackages().filter(p=>p.status==='approved').map(p=>p.id));
  if (!ids.length) return { ok: false, error: 'Không có nội dung nào được Approved để lên lịch' };
  const results = ids.map(id => PublishingManager.scheduleContent(id, params.publishAt, params.platform));
  if (typeof setTool_byName === 'function') setTool_byName('publish');
  return { ok: true, scheduled: results.filter(Boolean).length };
}

/* prepare_publish_package — xuất export package JSON
   params: { ids? } */
function _actPreparePublishPackage(params) {
  if (!window.PublishingManager) return { ok: false, error: 'PublishingManager not loaded' };
  const pkgs = PublishingManager.getPackages();
  if (!pkgs.length) {
    // Auto-create packages for all default platforms
    PublishingManager.createFromEditor();
    PublishingManager.optimizeAll();
    PublishingManager.bulkValidate(null);
  }
  PublishingManager.downloadManifestJSON(params.ids || null);
  if (typeof setTool_byName === 'function') setTool_byName('publish');
  return { ok: true, packages: PublishingManager.getPackages().length };
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
