/* ============================================================
   PERFORMANCE ANALYTICS & LEARNING SYSTEM — js/analytics.js
   Phase 4.2: Content Performance Analytics & AI Learning Engine

   Storage keys:
     cc_analytics_records   — array of performance records
     cc_analytics_insights  — cached AI-generated insights
   ============================================================ */

(function () {

const KEY_RECORDS  = 'cc_analytics_records';
const KEY_INSIGHTS = 'cc_analytics_insights';

/* ══════════════════════════════════════════════════════════
   1. SCHEMA & STATE
   ══════════════════════════════════════════════════════════ */

function _blankRecord(overrides) {
  return Object.assign({
    id:          'perf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    contentId:   '',
    title:       '',
    platform:    'youtube',        // youtube | tiktok | instagram | facebook | other
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    // raw performance metrics
    metrics: {
      views:           0,
      likes:           0,
      comments:        0,
      shares:          0,
      watchTimeSec:    0,   // total watch time seconds
      ctrPercent:      0,   // click-through rate %
      retentionPercent:0,   // avg retention %
      followersGained: 0,
    },
    // editorial metadata (filled at import time or manually)
    editorial: {
      hookType:       '',    // question | shock | story | demo | other
      hookText:       '',
      ctaType:        '',    // follow | like | comment | subscribe | visit | none
      ctaText:        '',
      subtitleStyle:  '',    // tiktok | mrbeast | podcast | netflix | gaming | minimal | documentary
      duration:       0,     // seconds
      hasMusic:       false,
      hasFaceOnCamera:false,
    },
    // viral score predicted by the editor (if run through viral analysis)
    predictedScore: null,
    // computed composite performance score (0-100)
    score: 0,
    tags: [],
    notes: '',
  }, overrides);
}

let _records  = _load(KEY_RECORDS,  []);
let _insights = _load(KEY_INSIGHTS, null);

function _load(key, def) {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch(e) {}
  return def;
}
function _save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function _saveRecords()  { _save(KEY_RECORDS,  _records);  }
function _saveInsights() { _save(KEY_INSIGHTS, _insights); }

/* ══════════════════════════════════════════════════════════
   2. SCORE COMPUTATION
   ══════════════════════════════════════════════════════════ */

function _computeScore(metrics) {
  const m = metrics || {};
  const views    = m.views            || 0;
  const likes    = m.likes            || 0;
  const comments = m.comments         || 0;
  const shares   = m.shares           || 0;
  const watchT   = m.watchTimeSec     || 0;
  const ctr      = m.ctrPercent       || 0;
  const ret      = m.retentionPercent || 0;
  const follow   = m.followersGained  || 0;

  // engagement rate (likes+comments+shares / views)
  const engRate = views > 0 ? (likes + comments + shares) / views : 0;

  // normalise each dimension to 0-1 (soft caps via log)
  const nViews   = Math.min(1, Math.log10(Math.max(1, views))   / 7);   // 10M views → 1.0
  const nEng     = Math.min(1, engRate * 20);                            // 5% eng → 1.0
  const nCTR     = Math.min(1, ctr    / 15);                            // 15% CTR → 1.0
  const nRet     = Math.min(1, ret    / 70);                            // 70% ret → 1.0
  const nFollow  = Math.min(1, Math.log10(Math.max(1, follow))  / 5);   // 100k → 1.0

  const composite = (nViews * 0.35 + nEng * 0.25 + nCTR * 0.20 + nRet * 0.15 + nFollow * 0.05);
  return Math.round(composite * 100);
}

/* ══════════════════════════════════════════════════════════
   3. CRUD
   ══════════════════════════════════════════════════════════ */

function addRecord(data) {
  const rec = _blankRecord(data);
  rec.score = _computeScore(rec.metrics);
  rec.updatedAt = new Date().toISOString();
  _records.push(rec);
  _saveRecords();
  _invalidateInsights();
  return rec;
}

function updateRecord(id, patch) {
  const idx = _records.findIndex(r => r.id === id);
  if (idx < 0) return null;
  Object.assign(_records[idx], patch);
  if (patch.metrics) _records[idx].score = _computeScore(_records[idx].metrics);
  _records[idx].updatedAt = new Date().toISOString();
  _saveRecords();
  _invalidateInsights();
  return _records[idx];
}

function deleteRecord(id) {
  _records = _records.filter(r => r.id !== id);
  _saveRecords();
  _invalidateInsights();
}

function getRecords() { return _records.slice(); }

function _invalidateInsights() { _insights = null; _saveInsights(); }

/* ══════════════════════════════════════════════════════════
   4. RANKING & ANALYTICS
   ══════════════════════════════════════════════════════════ */

function _sorted() {
  return _records.slice().sort((a, b) => b.score - a.score);
}

function topContent(n)   { return _sorted().slice(0, n || 10); }
function worstContent(n) { return _sorted().slice(-Math.min(n || 10, _records.length)).reverse(); }

function _byPlatform(plat) {
  return plat ? _records.filter(r => r.platform === plat) : _records;
}

/* ── Aggregate patterns across records ── */
function _aggregateHooks(records) {
  const counts = {};
  for (const r of records) {
    const t = r.editorial.hookType;
    if (t) counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([type, count]) => ({ type, count }));
}

function _aggregateCTAs(records) {
  const sums = {};
  const cnts = {};
  for (const r of records) {
    const t = r.editorial.ctaType;
    if (!t) continue;
    sums[t] = (sums[t] || 0) + r.score;
    cnts[t] = (cnts[t] || 0) + 1;
  }
  return Object.keys(sums)
    .map(t => ({ type: t, count: cnts[t], avgScore: Math.round(sums[t] / cnts[t]) }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function _aggregateSubtitleStyles(records) {
  const sums = {}, cnts = {};
  for (const r of records) {
    const s = r.editorial.subtitleStyle;
    if (!s) continue;
    sums[s] = (sums[s] || 0) + (r.metrics.ctrPercent || 0);
    cnts[s] = (cnts[s] || 0) + 1;
  }
  return Object.keys(sums)
    .map(s => ({ style: s, count: cnts[s], avgCTR: +(sums[s] / cnts[s]).toFixed(2) }))
    .sort((a, b) => b.avgCTR - a.avgCTR);
}

/* ── Viral score calibration ── */
function viralCalibration() {
  const calibrated = _records.filter(r => r.predictedScore !== null);
  if (!calibrated.length) return null;
  const diffs = calibrated.map(r => {
    const actual = r.score;
    const pred   = r.predictedScore;
    return { title: r.title, predicted: pred, actual, delta: actual - pred };
  });
  const avgDelta = diffs.reduce((s, d) => s + Math.abs(d.delta), 0) / diffs.length;
  return { diffs, avgAbsError: Math.round(avgDelta), count: calibrated.length };
}

/* ══════════════════════════════════════════════════════════
   5. AI LEARNING ENGINE (pattern analysis, no API calls)
   ══════════════════════════════════════════════════════════ */

function generateInsights() {
  if (_insights && _insights.generatedAt) {
    const age = Date.now() - new Date(_insights.generatedAt).getTime();
    if (age < 5 * 60 * 1000) return _insights; // cache 5 min
  }
  if (_records.length < 2) {
    return { error: 'Need at least 2 records to generate insights.' };
  }

  const sorted    = _sorted();
  const topHalf   = sorted.slice(0, Math.ceil(sorted.length / 2));
  const botHalf   = sorted.slice(Math.floor(sorted.length / 2));

  // Hook pattern winners
  const topHookCounts  = {};
  const botHookCounts  = {};
  for (const r of topHalf) if (r.editorial.hookType) topHookCounts[r.editorial.hookType] = (topHookCounts[r.editorial.hookType] || 0) + 1;
  for (const r of botHalf) if (r.editorial.hookType) botHookCounts[r.editorial.hookType] = (botHookCounts[r.editorial.hookType] || 0) + 1;
  const bestHook  = Object.entries(topHookCounts).sort((a,b) => b[1]-a[1])[0];
  const worstHook = Object.entries(botHookCounts).sort((a,b) => b[1]-a[1])[0];

  // Subtitle style CTR
  const styleCTR = _aggregateSubtitleStyles(_records);
  const bestStyle = styleCTR[0] || null;

  // CTA avg scores
  const ctaAgg = _aggregateCTAs(_records);
  const bestCTA  = ctaAgg[0]  || null;
  const worstCTA = ctaAgg[ctaAgg.length - 1] || null;

  // Duration sweet spot (avg duration of top half vs bottom half)
  const topAvgDur = topHalf.reduce((s, r) => s + (r.editorial.duration || 0), 0) / (topHalf.length || 1);
  const botAvgDur = botHalf.reduce((s, r) => s + (r.editorial.duration || 0), 0) / (botHalf.length || 1);

  // Avg retention of top vs bottom
  const topAvgRet = topHalf.reduce((s, r) => s + (r.metrics.retentionPercent || 0), 0) / (topHalf.length || 1);
  const botAvgRet = botHalf.reduce((s, r) => s + (r.metrics.retentionPercent || 0), 0) / (botHalf.length || 1);

  const recommendations = [];

  if (bestHook && worstHook && bestHook[0] !== worstHook[0]) {
    const pct = topHalf.length > 1 ? Math.round((bestHook[1] / topHalf.length) * 100) : bestHook[1] * 10;
    recommendations.push({
      icon: '🎣',
      type: 'hook',
      strength: 'high',
      text: `Hook dạng "${bestHook[0]}" xuất hiện trong ${pct}% video hiệu suất cao — hiệu quả hơn "${worstHook[0]}"`
    });
  }

  if (bestStyle) {
    recommendations.push({
      icon: '🖊',
      type: 'subtitle',
      strength: 'medium',
      text: `Phụ đề kiểu "${bestStyle.style}" có CTR trung bình ${bestStyle.avgCTR.toFixed(1)}% — cao nhất trong tất cả kiểu`
    });
  }

  if (bestCTA && worstCTA && bestCTA.type !== worstCTA.type) {
    recommendations.push({
      icon: '📣',
      type: 'cta',
      strength: 'medium',
      text: `CTA "${bestCTA.type}" đạt điểm TB ${bestCTA.avgScore} — "${worstCTA.type}" chỉ đạt ${worstCTA.avgScore}`
    });
  }

  if (topAvgDur > 0 && botAvgDur > 0) {
    const diff = Math.abs(topAvgDur - botAvgDur);
    if (diff > 5) {
      const dir = topAvgDur < botAvgDur ? 'ngắn hơn' : 'dài hơn';
      recommendations.push({
        icon: '⏱',
        type: 'duration',
        strength: 'low',
        text: `Video hiệu suất cao thường ${dir} ~${Math.round(diff)}s so với video hiệu suất thấp`
      });
    }
  }

  if (topAvgRet - botAvgRet > 5) {
    recommendations.push({
      icon: '📈',
      type: 'retention',
      strength: 'high',
      text: `Retention của video top đạt ${topAvgRet.toFixed(0)}% so với ${botAvgRet.toFixed(0)}% của nhóm thấp — tập trung vào hook đầu`
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      icon: '💡',
      type: 'general',
      strength: 'low',
      text: 'Thêm dữ liệu hiệu suất để nhận gợi ý chi tiết hơn'
    });
  }

  _insights = {
    generatedAt:     new Date().toISOString(),
    recordCount:     _records.length,
    topHooks:        _aggregateHooks(topHalf),
    worstHooks:      _aggregateHooks(botHalf),
    ctaRanking:      ctaAgg,
    subtitleCTR:     styleCTR,
    viralCalibration: viralCalibration(),
    recommendations,
    topAvgDuration:  Math.round(topAvgDur),
    botAvgDuration:  Math.round(botAvgDur),
    topAvgRetention: Math.round(topAvgRet),
    botAvgRetention: Math.round(botAvgRet),
  };
  _saveInsights();
  return _insights;
}

/* ══════════════════════════════════════════════════════════
   6. BRAND FEEDBACK LOOP
   ══════════════════════════════════════════════════════════ */

function updateBrandFeedback(brandId) {
  if (typeof BrandClone === 'undefined') return { ok: false, error: 'BrandClone not loaded' };
  const records = _records.filter(r => r.tags.includes('brand:' + brandId));
  if (!records.length) return { ok: false, error: 'No analytics records tagged for this brand' };

  const avgScore = records.reduce((s, r) => s + r.score, 0) / records.length;
  // Confidence adjustment: scale from 0-100 score → confidence 0-1
  const newConf = Math.round(Math.min(1, avgScore / 80) * 100) / 100;

  const profile = BrandClone.getProfile(brandId);
  if (!profile) return { ok: false, error: 'Brand profile not found' };
  BrandClone.updateConfidence(brandId, newConf);
  return { ok: true, brandId, newConfidence: newConf, basedOnRecords: records.length };
}

/* ══════════════════════════════════════════════════════════
   7. CSV / JSON IMPORT
   ══════════════════════════════════════════════════════════ */

function importCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { ok: false, error: 'CSV cần ít nhất 2 dòng (header + data)' };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  const results = [];
  const errors  = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = _parseCSVRow(lines[i]);
    if (cols.length !== headers.length) { errors.push(`Dòng ${i+1}: số cột không khớp`); continue; }
    const row = {};
    headers.forEach((h, idx) => row[h] = cols[idx]);

    const rec = _blankRecord({
      title:    row['title'] || row['name'] || row['video_title'] || `Import #${i}`,
      platform: _guessPlatform(row['platform'] || row['source'] || ''),
      editorial: {
        hookType:        row['hook_type']       || row['hook']            || '',
        hookText:        row['hook_text']        || '',
        ctaType:         row['cta_type']         || row['cta']             || '',
        ctaText:         row['cta_text']         || '',
        subtitleStyle:   row['subtitle_style']   || row['subtitle']        || '',
        duration:        parseFloat(row['duration'] || row['length_sec'] || '0') || 0,
        hasMusic:        _parseBool(row['has_music']),
        hasFaceOnCamera: _parseBool(row['face_on_camera'] || row['face']),
      },
      metrics: {
        views:            _int(row['views']            || row['view_count']   || '0'),
        likes:            _int(row['likes']            || row['like_count']   || '0'),
        comments:         _int(row['comments']         || row['comment_count']|| '0'),
        shares:           _int(row['shares']           || row['share_count']  || '0'),
        watchTimeSec:     _int(row['watch_time_sec']   || row['watch_time']   || '0'),
        ctrPercent:       parseFloat(row['ctr']        || row['ctr_percent']  || '0') || 0,
        retentionPercent: parseFloat(row['retention']  || row['retention_pct']|| '0') || 0,
        followersGained:  _int(row['followers_gained'] || row['new_followers']|| '0'),
      },
      predictedScore: row['predicted_score'] ? parseFloat(row['predicted_score']) : null,
      notes: row['notes'] || '',
    });
    results.push(addRecord(rec));
  }
  return { ok: true, imported: results.length, errors, records: results };
}

function importJSON(jsonText) {
  let data;
  try { data = JSON.parse(jsonText); } catch(e) { return { ok: false, error: 'JSON không hợp lệ: ' + e.message }; }

  const arr = Array.isArray(data) ? data : data.records || data.data || data.items || [];
  if (!arr.length) return { ok: false, error: 'Không tìm thấy mảng records trong JSON' };

  const results = arr.map(row => addRecord(_blankRecord({
    title:    row.title || row.name || row.videoTitle || '',
    platform: _guessPlatform(row.platform || row.source || ''),
    editorial: {
      hookType:        row.hookType       || row.hook_type       || '',
      hookText:        row.hookText       || row.hook_text       || '',
      ctaType:         row.ctaType        || row.cta_type        || '',
      ctaText:         row.ctaText        || row.cta_text        || '',
      subtitleStyle:   row.subtitleStyle  || row.subtitle_style  || '',
      duration:        parseFloat(row.duration || row.length || 0) || 0,
      hasMusic:        !!(row.hasMusic || row.has_music),
      hasFaceOnCamera: !!(row.hasFaceOnCamera || row.face_on_camera),
    },
    metrics: {
      views:            _int(row.views          || row.viewCount          || 0),
      likes:            _int(row.likes          || row.likeCount          || 0),
      comments:         _int(row.comments       || row.commentCount       || 0),
      shares:           _int(row.shares         || row.shareCount         || 0),
      watchTimeSec:     _int(row.watchTimeSec   || row.watchTime          || 0),
      ctrPercent:       parseFloat(row.ctrPercent   || row.ctr               || 0) || 0,
      retentionPercent: parseFloat(row.retentionPercent || row.retention     || 0) || 0,
      followersGained:  _int(row.followersGained || row.newFollowers       || 0),
    },
    predictedScore: row.predictedScore != null ? parseFloat(row.predictedScore) : null,
    notes: row.notes || '',
  })));
  return { ok: true, imported: results.length, records: results };
}

/* helpers */
function _parseCSVRow(line) {
  const cols = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur.trim());
  return cols;
}
function _int(v)        { return parseInt(String(v).replace(/[^0-9]/g, '')) || 0; }
function _parseBool(v)  { return v === true || v === 'true' || v === '1' || v === 'yes'; }
function _guessPlatform(s) {
  s = (s || '').toLowerCase();
  if (s.includes('tiktok'))    return 'tiktok';
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('facebook'))  return 'facebook';
  if (s.includes('youtube'))   return 'youtube';
  return s || 'youtube';
}

/* ══════════════════════════════════════════════════════════
   8. ACTION ENGINE HANDLERS
   ══════════════════════════════════════════════════════════ */

function actAnalyzePerformance(params) {
  const ins = generateInsights();
  if (ins.error) return { ok: false, error: ins.error };
  if (typeof toast === 'function') toast('📊 Analytics đã phân tích ' + _records.length + ' records');
  return { ok: true, insights: ins };
}

function actCompareContent(params) {
  const ids = params.contentIds || [];
  const recs = ids.length
    ? _records.filter(r => ids.includes(r.id) || ids.includes(r.contentId))
    : topContent(5).concat(worstContent(5));
  return { ok: true, records: recs };
}

function actGenerateInsights() {
  const ins = generateInsights();
  if (ins.error) return { ok: false, error: ins.error };
  AnalyticsManager.renderDashboard();
  return { ok: true, recommendations: ins.recommendations };
}

function actImproveBrand(params) {
  const brandId = params.brandId;
  if (!brandId) return { ok: false, error: 'brandId required' };
  return updateBrandFeedback(brandId);
}

/* ══════════════════════════════════════════════════════════
   9. SAMPLE DATA (for first-run demo)
   ══════════════════════════════════════════════════════════ */

function loadSampleData() {
  if (_records.length > 0) return;
  const samples = [
    { title:'Summer Beach Vlog — Hook câu hỏi', platform:'youtube', editorial:{hookType:'question',hookText:'Bạn có biết bãi biển đẹp nhất Việt Nam?',ctaType:'subscribe',ctaText:'Đăng ký để không bỏ lỡ!',subtitleStyle:'tiktok',duration:312,hasMusic:true}, metrics:{views:148000,likes:9200,comments:430,shares:880,watchTimeSec:126000,ctrPercent:8.4,retentionPercent:54,followersGained:2100}, predictedScore:72 },
    { title:'Street Food Tour — Hook shock', platform:'tiktok', editorial:{hookType:'shock',hookText:'Tôi ăn 10 món trong 30 phút!',ctaType:'follow',ctaText:'Follow để xem thêm!',subtitleStyle:'mrbeast',duration:58,hasMusic:true}, metrics:{views:920000,likes:71000,comments:3200,shares:15000,watchTimeSec:890000,ctrPercent:12.1,retentionPercent:71,followersGained:18000}, predictedScore:88 },
    { title:'Morning Routine 2024', platform:'instagram', editorial:{hookType:'story',hookText:'Đây là lý do tôi thức dậy lúc 5AM',ctaType:'like',ctaText:'Like nếu bạn cũng làm vậy!',subtitleStyle:'minimal',duration:90,hasMusic:false}, metrics:{views:32000,likes:1800,comments:95,shares:210,watchTimeSec:28800,ctrPercent:3.2,retentionPercent:38,followersGained:310}, predictedScore:45 },
    { title:'AI Tools Review — Demo hook', platform:'youtube', editorial:{hookType:'demo',hookText:'Tool AI này thay đổi workflow của tôi hoàn toàn',ctaType:'subscribe',ctaText:'Subscribe để nhận tips AI mỗi tuần!',subtitleStyle:'netflix',duration:487,hasMusic:false}, metrics:{views:67000,likes:4100,comments:820,shares:1400,watchTimeSec:72500,ctrPercent:6.7,retentionPercent:48,followersGained:980}, predictedScore:61 },
    { title:'5 Phút Giảm Stress', platform:'tiktok', editorial:{hookType:'question',hookText:'Stress trong 3 giây? Thử ngay!',ctaType:'follow',ctaText:'Follow nhận mẹo hàng ngày',subtitleStyle:'tiktok',duration:47,hasMusic:true}, metrics:{views:2100000,likes:155000,comments:6800,shares:42000,watchTimeSec:1950000,ctrPercent:14.8,retentionPercent:79,followersGained:45000}, predictedScore:91 },
    { title:'Budget Travel Guide', platform:'youtube', editorial:{hookType:'demo',hookText:'Du lịch Đà Lạt chỉ 500k — đây là cách',ctaType:'comment',ctaText:'Comment điểm bạn muốn ghé tiếp!',subtitleStyle:'podcast',duration:628,hasMusic:true}, metrics:{views:89000,likes:5600,comments:1200,shares:2300,watchTimeSec:98000,ctrPercent:7.9,retentionPercent:52,followersGained:1500}, predictedScore:69 },
    { title:'Gym Transformation 90 Days', platform:'instagram', editorial:{hookType:'shock',hookText:'90 ngày — đây là kết quả',ctaType:'follow',ctaText:'Follow hành trình của tôi',subtitleStyle:'gaming',duration:62,hasMusic:true}, metrics:{views:185000,likes:22000,comments:980,shares:5100,watchTimeSec:168000,ctrPercent:9.3,retentionPercent:66,followersGained:7800}, predictedScore:80 },
    { title:'Boring Product Review', platform:'youtube', editorial:{hookType:'other',hookText:'Hôm nay tôi review sản phẩm này',ctaType:'none',ctaText:'',subtitleStyle:'',duration:720,hasMusic:false}, metrics:{views:1200,likes:34,comments:8,shares:2,watchTimeSec:900,ctrPercent:1.1,retentionPercent:18,followersGained:3}, predictedScore:22 },
  ];
  for (const s of samples) addRecord(_blankRecord(s));
}

/* ══════════════════════════════════════════════════════════
   10. PANEL UI
   ══════════════════════════════════════════════════════════ */

const PLATFORM_LABELS = { youtube:'YouTube', tiktok:'TikTok', instagram:'Instagram', facebook:'Facebook', other:'Khác' };
const PLATFORM_COLORS = { youtube:'#ff4444', tiktok:'#69c9d0', instagram:'#e1306c', facebook:'#1877f2', other:'#888' };
const STRENGTH_COLORS = { high:'#27ae60', medium:'#D4A017', low:'#888' };

function _scoreBar(score) {
  const c = score >= 70 ? '#27ae60' : score >= 40 ? '#D4A017' : '#c0392b';
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
      <div style="width:${score}%;height:100%;background:${c};border-radius:3px"></div>
    </div>
    <span style="font-size:11px;color:${c};font-weight:700;width:30px;text-align:right">${score}</span>
  </div>`;
}

function _fmt(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}

function renderDashboard() {
  const panel = document.getElementById('analytics-panel');
  if (!panel) return;

  const TAB = AnalyticsManager._activeTab || 'analytics';

  panel.innerHTML = `
<div style="display:flex;flex-direction:column;height:100%;overflow:hidden;font-size:13px">
  <!-- header -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 0;flex-shrink:0">
    <div style="font-size:14px;font-weight:700;color:var(--t1)">📊 Performance Analytics</div>
    <button onclick="AnalyticsManager._openImport()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--t2);padding:4px 10px;font-size:11px;cursor:pointer">⬆ Import</button>
  </div>
  <!-- tabs -->
  <div style="display:flex;border-bottom:1px solid var(--border);margin-top:10px;padding:0 10px;flex-shrink:0">
    ${['analytics','insights','performance'].map(t=>`
    <div onclick="AnalyticsManager._tab('${t}')" style="padding:7px 10px;font-size:11.5px;cursor:pointer;border-bottom:2px solid ${TAB===t?'var(--accent)':'transparent'};color:${TAB===t?'var(--t1)':'var(--t3)'};margin-bottom:-1px">
      ${t==='analytics'?'Analytics':t==='insights'?'Insights':'Performance'}
    </div>`).join('')}
  </div>
  <!-- body -->
  <div id="ap-body" style="flex:1;overflow-y:auto;padding:12px 12px 20px">
    ${TAB==='analytics' ? _renderTabAnalytics() : TAB==='insights' ? _renderTabInsights() : _renderTabPerformance()}
  </div>
</div>`;
}

function _renderTabAnalytics() {
  const ins    = generateInsights();
  const sorted = _sorted();
  const total  = _records.length;
  if (!total) return _emptyState();

  const avgScore = Math.round(sorted.reduce((s,r)=>s+r.score,0)/total);
  const totalViews = _records.reduce((s,r)=>s+(r.metrics.views||0),0);
  const topP = PLATFORM_LABELS[_records.reduce((acc,r)=>{ acc[r.platform]=(acc[r.platform]||0)+1; return acc; },{}) && Object.entries(_records.reduce((acc,r)=>{ acc[r.platform]=(acc[r.platform]||0)+1; return acc; },{})).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'youtube'] || 'YouTube';

  const top3 = sorted.slice(0, 3);
  const bot3 = sorted.slice(-Math.min(3, sorted.length)).reverse();

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
  ${_statCard('📁', total, 'Records')}
  ${_statCard('⭐', avgScore, 'Điểm TB')}
  ${_statCard('👁', _fmt(totalViews), 'Tổng Views')}
  ${_statCard('🏆', topP, 'Platform chính')}
</div>

<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">🏆 Top Nội Dung</div>
${top3.map((r,i)=>_recordRow(r, i+1, 'top')).join('')}

<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px">⚠ Kém Hiệu Quả</div>
${bot3.map((r,i)=>_recordRow(r, null, 'bot')).join('')}

<button onclick="AnalyticsManager._openAddRecord()" style="width:100%;margin-top:12px;padding:8px;background:var(--accentdim);border:1px dashed var(--accent);border-radius:7px;color:var(--accent2);font-size:12px;cursor:pointer">+ Thêm Record Thủ Công</button>`;
}

function _renderTabInsights() {
  const ins = generateInsights();
  if (ins.error) return `<div style="text-align:center;padding:30px 10px;color:var(--t3)">${ins.error}</div>`;

  const cal = ins.viralCalibration;

  return `
<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">💡 Gợi Ý AI (${ins.recordCount} records)</div>
${ins.recommendations.map(r=>`
<div style="background:var(--bg2);border:1px solid var(--border2);border-left:3px solid ${STRENGTH_COLORS[r.strength]||'#888'};border-radius:6px;padding:9px 11px;margin-bottom:8px">
  <div style="display:flex;align-items:flex-start;gap:7px">
    <span style="font-size:15px">${r.icon}</span>
    <div>
      <div style="font-size:11.5px;color:var(--t1);line-height:1.4">${r.text}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:3px;text-transform:uppercase">${r.type} · ${r.strength}</div>
    </div>
  </div>
</div>`).join('')}

<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px">🎣 Hook Rankings</div>
${ins.topHooks.slice(0,5).map(h=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg2);border-radius:5px;margin-bottom:4px"><span style="color:var(--t2)">${h.type}</span><span style="font-size:11px;color:var(--accent2);font-weight:600">${h.count} video</span></div>`).join('') || '<div style="color:var(--t3);font-size:11px">Chưa có dữ liệu hook</div>'}

<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px">🖊 Phụ Đề & CTR</div>
${ins.subtitleCTR.slice(0,5).map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg2);border-radius:5px;margin-bottom:4px"><span style="color:var(--t2)">${s.style}</span><span style="font-size:11px;color:var(--accent2);font-weight:600">CTR ${s.avgCTR}%</span></div>`).join('') || '<div style="color:var(--t3);font-size:11px">Chưa có dữ liệu subtitle</div>'}

<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px">📣 CTA Ranking</div>
${ins.ctaRanking.slice(0,5).map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg2);border-radius:5px;margin-bottom:4px"><span style="color:var(--t2)">${c.type}</span><span style="font-size:11px;color:var(--accent2);font-weight:600">Điểm TB ${c.avgScore}</span></div>`).join('') || '<div style="color:var(--t3);font-size:11px">Chưa có dữ liệu CTA</div>'}

${cal ? `
<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px">🎯 Viral Score Calibration (${cal.count} records)</div>
<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:10px">
  <div style="font-size:12px;color:var(--t1)">Sai số trung bình: <span style="color:var(--accent2);font-weight:700">${cal.avgAbsError} điểm</span></div>
  ${cal.diffs.slice(0,4).map(d=>`
  <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px">
    <span style="color:var(--t3);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.title}</span>
    <span>Dự báo <span style="color:var(--tvt)">${d.predicted}</span> → Thực tế <span style="color:${d.actual>d.predicted?'#27ae60':'#c0392b'}">${d.actual}</span></span>
  </div>`).join('')}
</div>` : ''}`;
}

function _renderTabPerformance() {
  if (!_records.length) return _emptyState();
  const sorted = _sorted();
  const tops = [10, 50, 100];

  return `
<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">📊 Xếp Hạng Nội Dung (${_records.length} records)</div>
<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
  ${tops.map(n=>`<button onclick="AnalyticsManager._setRankFilter(${n})" style="background:${(AnalyticsManager._rankFilter||10)===n?'var(--accent)':'var(--bg3)'};color:${(AnalyticsManager._rankFilter||10)===n?'#000':'var(--t2)'};border:1px solid var(--border2);border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer">Top ${n}</button>`).join('')}
</div>
${sorted.slice(0, AnalyticsManager._rankFilter||10).map((r, idx)=>`
<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:7px;margin-bottom:6px;border:1px solid var(--border)">
  <div style="width:22px;height:22px;border-radius:50%;background:${idx<3?'var(--accent)':'var(--bg4)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${idx<3?'#000':'var(--t3)'};flex-shrink:0">${idx+1}</div>
  <div style="flex:1;min-width:0">
    <div style="font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.title || 'Untitled'}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:2px;display:flex;gap:8px">
      <span style="color:${PLATFORM_COLORS[r.platform]||'#888'}">${PLATFORM_LABELS[r.platform]||r.platform}</span>
      <span>👁 ${_fmt(r.metrics.views)}</span>
      <span>❤ ${_fmt(r.metrics.likes)}</span>
    </div>
    <div style="margin-top:4px">${_scoreBar(r.score)}</div>
  </div>
  <button onclick="AnalyticsManager._deleteRecord('${r.id}')" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:14px;flex-shrink:0" title="Xóa">×</button>
</div>`).join('')}`;
}

function _statCard(icon, value, label) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;text-align:center">
    <div style="font-size:18px;margin-bottom:2px">${icon}</div>
    <div style="font-size:14px;font-weight:700;color:var(--t1)">${value}</div>
    <div style="font-size:10px;color:var(--t3)">${label}</div>
  </div>`;
}

function _recordRow(r, rank, type) {
  const rankBadge = rank ? `<span style="background:var(--accent);color:#000;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${rank}</span>` : '';
  return `<div style="display:flex;align-items:center;gap:7px;padding:7px 8px;background:var(--bg2);border-radius:6px;margin-bottom:5px;border:1px solid var(--border)">
    ${rankBadge}
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.title || 'Untitled'}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">👁 ${_fmt(r.metrics.views)} · ${PLATFORM_LABELS[r.platform]||r.platform}</div>
    </div>
    ${_scoreBar(r.score)}
  </div>`;
}

function _emptyState() {
  return `<div style="text-align:center;padding:30px 10px">
    <div style="font-size:32px;margin-bottom:10px">📭</div>
    <div style="color:var(--t2);font-size:13px;margin-bottom:6px">Chưa có dữ liệu</div>
    <div style="color:var(--t3);font-size:11px;margin-bottom:14px">Import CSV/JSON hoặc thêm record thủ công</div>
    <button onclick="AnalyticsManager._loadSample()" style="background:var(--accentdim);border:1px solid var(--accent);border-radius:7px;color:var(--accent2);padding:8px 16px;font-size:12px;cursor:pointer">📋 Tải Dữ Liệu Mẫu</button>
  </div>`;
}

/* ── Modals ── */

function _openImport() {
  const modal = document.createElement('div');
  modal.id = 'ap-import-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
<div style="background:var(--bg1);border:1px solid var(--border2);border-radius:12px;padding:22px;width:440px;max-height:80vh;overflow-y:auto">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;color:var(--t1)">⬆ Import Dữ Liệu Analytics</div>
    <button onclick="document.getElementById('ap-import-modal').remove()" style="background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer">×</button>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button id="ap-fmt-csv" onclick="AnalyticsManager._setImportFmt('csv')" style="flex:1;padding:7px;border:1px solid var(--accent);border-radius:6px;background:var(--accentdim);color:var(--accent2);font-size:12px;cursor:pointer">CSV</button>
    <button id="ap-fmt-json" onclick="AnalyticsManager._setImportFmt('json')" style="flex:1;padding:7px;border:1px solid var(--border2);border-radius:6px;background:var(--bg3);color:var(--t2);font-size:12px;cursor:pointer">JSON</button>
  </div>

  <div style="font-size:10px;color:var(--t3);margin-bottom:6px">Dán nội dung CSV hoặc JSON vào đây:</div>
  <textarea id="ap-import-text" style="width:100%;height:160px;background:var(--bg2);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:11px;padding:8px;resize:vertical;font-family:monospace" placeholder="title,platform,views,likes,comments,shares,watch_time_sec,ctr,retention,hook_type,cta_type,subtitle_style,duration&#10;My Video,youtube,100000,5000,200,500,90000,8.5,55,question,subscribe,tiktok,310"></textarea>

  <div style="font-size:10px;color:var(--t3);margin:8px 0 4px">Hoặc chọn file:</div>
  <input type="file" id="ap-import-file" accept=".csv,.json,.txt" style="font-size:11px;color:var(--t2)" onchange="AnalyticsManager._readFile(this)">

  <div style="display:flex;gap:8px;margin-top:14px">
    <button onclick="AnalyticsManager._doImport()" style="flex:1;padding:9px;background:var(--accent);border:none;border-radius:7px;color:#000;font-weight:700;font-size:13px;cursor:pointer">Import</button>
    <button onclick="document.getElementById('ap-import-modal').remove()" style="padding:9px 16px;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t2);font-size:12px;cursor:pointer">Hủy</button>
  </div>
  <div id="ap-import-result" style="margin-top:10px;font-size:11px"></div>
</div>`;
  document.body.appendChild(modal);
  AnalyticsManager._importFmt = 'csv';
}

function _setImportFmt(fmt) {
  AnalyticsManager._importFmt = fmt;
  const csv  = document.getElementById('ap-fmt-csv');
  const json = document.getElementById('ap-fmt-json');
  if (!csv || !json) return;
  if (fmt === 'csv') {
    csv.style.background  = 'var(--accentdim)'; csv.style.borderColor  = 'var(--accent)'; csv.style.color  = 'var(--accent2)';
    json.style.background = 'var(--bg3)';       json.style.borderColor = 'var(--border2)'; json.style.color = 'var(--t2)';
  } else {
    json.style.background = 'var(--accentdim)'; json.style.borderColor = 'var(--accent)'; json.style.color  = 'var(--accent2)';
    csv.style.background  = 'var(--bg3)';       csv.style.borderColor  = 'var(--border2)'; csv.style.color  = 'var(--t2)';
  }
}

function _readFile(input) {
  const f = input.files[0]; if (!f) return;
  const fmt = f.name.endsWith('.json') ? 'json' : 'csv';
  AnalyticsManager._setImportFmt(fmt);
  const reader = new FileReader();
  reader.onload = e => { const ta = document.getElementById('ap-import-text'); if (ta) ta.value = e.target.result; };
  reader.readAsText(f);
}

function _doImport() {
  const text = (document.getElementById('ap-import-text') || {}).value || '';
  const fmt  = AnalyticsManager._importFmt || 'csv';
  const res  = fmt === 'json' ? importJSON(text) : importCSV(text);
  const el   = document.getElementById('ap-import-result');
  if (el) {
    if (res.ok) {
      el.style.color = '#27ae60';
      el.textContent = `✅ Đã import ${res.imported} records thành công`;
      setTimeout(() => { const m = document.getElementById('ap-import-modal'); if(m) m.remove(); renderDashboard(); }, 1200);
    } else {
      el.style.color = '#c0392b';
      el.textContent = '❌ ' + res.error;
    }
  }
}

function _openAddRecord() {
  const modal = document.createElement('div');
  modal.id = 'ap-add-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center';
  const field = (id, label, type, opts) => `
<div style="margin-bottom:9px">
  <label style="font-size:10px;color:var(--t3);display:block;margin-bottom:3px">${label}</label>
  ${type==='select'
    ? `<select id="${id}" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--t1);font-size:12px;padding:5px 7px">${(opts||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`
    : `<input id="${id}" type="${type||'text'}" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--t1);font-size:12px;padding:5px 7px" placeholder="${opts||''}">`
  }
</div>`;
  modal.innerHTML = `
<div style="background:var(--bg1);border:1px solid var(--border2);border-radius:12px;padding:22px;width:420px;max-height:85vh;overflow-y:auto">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;color:var(--t1)">+ Thêm Record Thủ Công</div>
    <button onclick="document.getElementById('ap-add-modal').remove()" style="background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer">×</button>
  </div>
  ${field('ap-add-title','Tiêu đề video','text','Tên video...')}
  ${field('ap-add-platform','Platform','select',['youtube','tiktok','instagram','facebook','other'])}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${field('ap-add-views','Views','number','0')}
    ${field('ap-add-likes','Likes','number','0')}
    ${field('ap-add-comments','Comments','number','0')}
    ${field('ap-add-shares','Shares','number','0')}
    ${field('ap-add-watch','Watch Time (s)','number','0')}
    ${field('ap-add-ctr','CTR %','number','0')}
    ${field('ap-add-retention','Retention %','number','0')}
    ${field('ap-add-followers','Followers Gained','number','0')}
  </div>
  ${field('ap-add-hook','Hook Type','select',['','question','shock','story','demo','other'])}
  ${field('ap-add-cta','CTA Type','select',['','follow','like','comment','subscribe','visit','none'])}
  ${field('ap-add-subtitle','Subtitle Style','select',['','tiktok','mrbeast','podcast','netflix','gaming','minimal','documentary'])}
  ${field('ap-add-predicted','Predicted Viral Score (0-100, optional)','number','–')}
  <button onclick="AnalyticsManager._doAddRecord()" style="width:100%;margin-top:6px;padding:9px;background:var(--accent);border:none;border-radius:7px;color:#000;font-weight:700;font-size:13px;cursor:pointer">Lưu Record</button>
</div>`;
  document.body.appendChild(modal);
}

function _doAddRecord() {
  const g = id => (document.getElementById(id)||{}).value || '';
  const pred = parseFloat(g('ap-add-predicted'));
  addRecord(_blankRecord({
    title:    g('ap-add-title'),
    platform: g('ap-add-platform'),
    editorial:{ hookType:g('ap-add-hook'), ctaType:g('ap-add-cta'), subtitleStyle:g('ap-add-subtitle') },
    metrics:{
      views:            parseInt(g('ap-add-views'))     ||0,
      likes:            parseInt(g('ap-add-likes'))     ||0,
      comments:         parseInt(g('ap-add-comments'))  ||0,
      shares:           parseInt(g('ap-add-shares'))    ||0,
      watchTimeSec:     parseInt(g('ap-add-watch'))     ||0,
      ctrPercent:       parseFloat(g('ap-add-ctr'))     ||0,
      retentionPercent: parseFloat(g('ap-add-retention'))||0,
      followersGained:  parseInt(g('ap-add-followers')) ||0,
    },
    predictedScore: isNaN(pred) ? null : pred,
  }));
  const m = document.getElementById('ap-add-modal'); if(m) m.remove();
  renderDashboard();
  if (typeof toast === 'function') toast('✅ Đã thêm record analytics');
}

function _deleteRecord(id) {
  deleteRecord(id);
  renderDashboard();
  if (typeof toast === 'function') toast('🗑 Đã xóa record');
}

function _tab(name) {
  AnalyticsManager._activeTab = name;
  renderDashboard();
}

function _setRankFilter(n) {
  AnalyticsManager._rankFilter = n;
  renderDashboard();
}

function _loadSample() {
  loadSampleData();
  renderDashboard();
  if (typeof toast === 'function') toast('📋 Đã tải 8 records mẫu');
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.AnalyticsManager = {
  // State
  _activeTab:   'analytics',
  _rankFilter:  10,
  _importFmt:   'csv',

  // Core
  addRecord, updateRecord, deleteRecord, getRecords,
  topContent, worstContent,
  generateInsights,
  updateBrandFeedback,
  viralCalibration,

  // Import
  importCSV, importJSON,

  // Action engine
  actAnalyzePerformance, actCompareContent, actGenerateInsights, actImproveBrand,

  // UI
  renderDashboard,

  // Internal UI helpers (called from inline HTML)
  _tab, _setRankFilter, _loadSample, _deleteRecord,
  _openImport, _setImportFmt, _readFile, _doImport,
  _openAddRecord, _doAddRecord,
};

console.log('[AnalyticsManager] Phase 4.2 Performance Analytics & Learning System loaded');

})();
