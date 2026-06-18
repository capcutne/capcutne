/* ============================================================
   AUTO CONTENT FACTORY — js/content_factory.js
   Phase 4.0: 1 video dài → hệ sinh thái nội dung hoàn chỉnh

   Pipeline: Transcript → Viral → Brand → Plan → Generate → Export

   Storage keys:
     cc_cfactory_runs    — run history
     cc_cfactory_current — current run state

   Public API: window.ContentFactory
   ============================================================ */

(function () {

const KEY_RUNS    = 'cc_cfactory_runs';
const KEY_CURRENT = 'cc_cfactory_current';

/* ══════════════════════════════════════════════════════════
   1. CONTENT TYPE DEFINITIONS
   ══════════════════════════════════════════════════════════ */

const CONTENT_TYPES = {
  youtube_long:    { id:'youtube_long',    label:'YouTube Longform',    icon:'▶', platform:'youtube',   color:'#ff0000', count:1  },
  youtube_short:   { id:'youtube_short',   label:'YouTube Shorts',      icon:'⚡', platform:'youtube',   color:'#ff6600', count:10 },
  tiktok:          { id:'tiktok',          label:'TikTok',              icon:'♪', platform:'tiktok',    color:'#00f2ea', count:10 },
  instagram_reel:  { id:'instagram_reel',  label:'Instagram Reels',     icon:'◉', platform:'instagram', color:'#e1306c', count:10 },
  facebook_reel:   { id:'facebook_reel',   label:'Facebook Reels',      icon:'f', platform:'facebook',  color:'#1877f2', count:5  },
  linkedin:        { id:'linkedin',        label:'LinkedIn Post',        icon:'in',platform:'linkedin',  color:'#0a66c2', count:1  },
  x_post:          { id:'x_post',          label:'X Post',              icon:'✕', platform:'x',         color:'#aaa',    count:3  },
  blog_md:         { id:'blog_md',         label:'Blog (Markdown)',      icon:'📝',platform:'web',       color:'#9b59b6', count:1  },
  newsletter:      { id:'newsletter',      label:'Newsletter',          icon:'📧',platform:'email',     color:'#2ecc71', count:1  },
  social_post:     { id:'social_post',     label:'Social Posts',        icon:'📢',platform:'multi',     color:'#f0a500', count:20 },
  caption:         { id:'caption',         label:'Captions',            icon:'💬',platform:'multi',     color:'#3498db', count:20 },
  hashtags:        { id:'hashtags',        label:'Hashtag Sets',        icon:'#', platform:'multi',     color:'#95a5a6', count:5  },
};

/* ══════════════════════════════════════════════════════════
   2. SCHEMA & STATE
   ══════════════════════════════════════════════════════════ */

function _blankRun(override) {
  return Object.assign({
    id:           'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    projectId:    'current',
    createdAt:    new Date().toISOString(),
    status:       'idle',       // idle | planning | generating | done | error
    stage:        '',
    progress:     { current: 0, total: 0 },
    transcript:   '',
    viralSegments: [],
    brandProfile:  null,
    plan:          [],          // [{type, title, sourceRange, description}]
    outputs:       [],          // content output objects
    error:         null,
    completedAt:   null,
  }, override || {});
}

function _blankOutput(override) {
  return Object.assign({
    id:                 'co_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    runId:              '',
    type:               '',
    title:              '',
    content:            '',
    alternativeTitles:  [],
    hooks:              [],
    ctas:               [],
    hashtags:           [],
    description:        '',
    sourceRange:        [],
    status:             'pending',  // pending | generating | done | error
    errorMsg:           '',
    createdAt:          new Date().toISOString(),
  }, override || {});
}

function _load(key, def) {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch(e) {}
  return def;
}
function _save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

let _current = _load(KEY_CURRENT, null);
let _runs    = _load(KEY_RUNS,    []);
let _activeTab = 'pipeline';

function _persist() {
  _save(KEY_CURRENT, _current);
  _save(KEY_RUNS, _runs.slice(0, 20));  // keep last 20 runs
}

/* ══════════════════════════════════════════════════════════
   3. PIPELINE ENGINE
   ══════════════════════════════════════════════════════════ */

async function runFactory(selectedTypes) {
  const types = selectedTypes || Object.keys(CONTENT_TYPES);
  _current = _blankRun();
  _activeTab = 'pipeline';
  renderDashboard();
  _toast('🏭 Auto Content Factory đang khởi động...');

  try {
    // Step 1: Collect transcript
    await _step('Đang thu thập transcript...', 1, 7, async () => {
      _current.transcript = _getTranscript();
      if (!_current.transcript) {
        _current.transcript = _getFallbackTranscript();
      }
    });

    // Step 2: Viral analysis data
    await _step('Đang phân tích viral segments...', 2, 7, async () => {
      _current.viralSegments = _getViralSegments();
    });

    // Step 3: Brand profile
    await _step('Đang đọc Brand Profile...', 3, 7, async () => {
      _current.brandProfile = _getBrandProfile();
    });

    // Step 4: AI Content Planning
    await _step('AI đang lên kế hoạch nội dung...', 4, 7, async () => {
      const plan = await _planContent(types);
      _current.plan = plan;
    });

    // Step 5: Generate all content
    await _step('AI đang tạo nội dung...', 5, 7, async () => {
      await _generateAll();
    });

    // Step 6: Optionally push to Publishing Manager
    await _step('Đang tích hợp với Publishing Manager...', 6, 7, async () => {
      _pushToPublishing();
    });

    // Step 7: Done
    await _step('Hoàn thành!', 7, 7, async () => {
      _current.status = 'done';
      _current.completedAt = new Date().toISOString();
    });

    _runs.unshift(_current);
    _persist();
    _toast(`✅ Factory hoàn thành! ${_current.outputs.length} nội dung đã được tạo`);
    _activeTab = 'results';
    renderDashboard();

  } catch (err) {
    _current.status = 'error';
    _current.error = err.message || String(err);
    _persist();
    _toast('❌ Lỗi: ' + _current.error);
    renderDashboard();
  }
}

async function _step(label, current, total, fn) {
  _current.status = 'generating';
  _current.stage  = label;
  _current.progress = { current, total };
  _persist();
  renderDashboard();
  await fn();
  _persist();
}

/* ── Data collectors ── */
function _getTranscript() {
  if (window.TranscriptEngine) {
    const tData = TranscriptEngine.getTranscript?.();
    if (tData && tData.fullText) return tData.fullText;
    if (tData && Array.isArray(tData.lines)) return tData.lines.map(l=>l.text).join(' ');
  }
  // Fallback: collect from subtitles global
  if (typeof subtitles !== 'undefined' && subtitles.length) {
    return subtitles.map(s=>s.text).join(' ');
  }
  return '';
}

function _getFallbackTranscript() {
  // Build from timeline clip labels
  if (typeof editorState !== 'undefined' && editorState.tracks) {
    const labels = [];
    for (const tr of editorState.tracks) {
      if (tr.type === 'video' || tr.type === 'text') {
        for (const c of tr.clips || []) {
          if (c.label) labels.push(c.label);
        }
      }
    }
    if (labels.length) return labels.join('. ');
  }
  return 'Video content created with CapCut-style editor. Engaging content for social media platforms.';
}

function _getViralSegments() {
  if (window.ViralEngine) {
    const segs = ViralEngine.getSegments?.() || ViralEngine.getAnalysis?.()?.segments || [];
    return segs.slice(0, 10).map(s => ({
      start: s.start || s.startTime || 0,
      end:   s.end   || s.endTime   || 30,
      score: s.score || s.viralScore || 0.7,
      reason: s.reason || s.label || '',
    }));
  }
  // Generate synthetic segments from editor state
  const dur = _getProjectDuration();
  const segCount = Math.min(10, Math.max(3, Math.floor(dur / 60)));
  const segs = [];
  for (let i = 0; i < segCount; i++) {
    const start = Math.round((dur / segCount) * i);
    segs.push({ start, end: Math.min(start + 30, dur), score: 0.6 + Math.random() * 0.4, reason: 'Auto segment' });
  }
  return segs;
}

function _getBrandProfile() {
  if (window.BrandClone) {
    return BrandClone.getBrandProfile?.() || BrandClone.getProfile?.() || null;
  }
  return null;
}

function _getProjectDuration() {
  if (typeof editorState !== 'undefined' && editorState.tracks) {
    let maxEnd = 0;
    for (const tr of editorState.tracks) {
      for (const c of tr.clips || []) {
        maxEnd = Math.max(maxEnd, (c.start || 0) + (c.dur || 0));
      }
    }
    if (maxEnd > 0) return maxEnd;
  }
  return 300; // default 5 min
}

function _getProjectName() {
  return document.getElementById('proj-name')?.textContent?.trim() || 'Video của tôi';
}

/* ── AI Planning ── */
async function _planContent(types) {
  try {
    const resp = await fetch('/cfactory/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript:   _current.transcript,
        projectName:  _getProjectName(),
        duration:     _getProjectDuration(),
        viralSegments: _current.viralSegments,
        brandProfile:  _current.brandProfile,
        contentTypes:  types,
      }),
    });
    const data = await resp.json();
    if (data.contentPlan) return data.contentPlan;
  } catch(e) {}

  // Fallback: generate synthetic plan
  const name = _getProjectName();
  const plan = [];
  for (const typeId of types) {
    const td = CONTENT_TYPES[typeId];
    if (!td) continue;
    const cnt = Math.min(td.count, typeId.includes('social') || typeId === 'caption' ? 5 : td.count);
    for (let i = 0; i < cnt; i++) {
      const seg = _current.viralSegments[i % Math.max(1, _current.viralSegments.length)];
      plan.push({
        type:        typeId,
        title:       `${td.label} #${i + 1} — ${name}`,
        sourceRange: seg ? [seg.start, seg.end] : [0, 30],
        description: `Nội dung ${td.label} từ video "${name}"`,
      });
    }
  }
  return plan;
}

/* ── Generation pipeline ── */
async function _generateAll() {
  const plan = _current.plan;
  _current.outputs = [];
  _current.progress = { current: 0, total: plan.length };

  // Group by type for batch requests
  const groups = {};
  for (const item of plan) {
    if (!groups[item.type]) groups[item.type] = [];
    groups[item.type].push(item);
  }

  // Generate blog and newsletter via dedicated endpoints
  const blogItems   = groups['blog_md']   || [];
  const newsItems   = groups['newsletter'] || [];
  const socialItems = [
    ...(groups['social_post'] || []),
    ...(groups['caption'] || []),
    ...(groups['hashtags'] || []),
  ];
  const shortItems  = Object.entries(groups)
    .filter(([t]) => !['blog_md','newsletter','social_post','caption','hashtags'].includes(t))
    .flatMap(([, items]) => items);

  // Blog
  for (const item of blogItems) {
    await _generateBlog(item);
  }

  // Newsletter
  for (const item of newsItems) {
    await _generateNewsletter(item);
  }

  // Social/captions/hashtags (batch)
  if (socialItems.length > 0) {
    await _generateSocial(socialItems);
  }

  // Short-form & video metadata (titles/hooks/CTAs per item)
  for (const item of shortItems) {
    await _generateTitles(item);
  }
}

async function _generateBlog(item) {
  const out = _blankOutput({
    runId: _current.id, type: 'blog_md',
    title: item.title, sourceRange: item.sourceRange,
    status: 'generating',
  });
  _current.outputs.push(out);
  renderDashboard();

  try {
    const resp = await fetch('/cfactory/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: _current.transcript,
        title: item.title,
        brandProfile: _current.brandProfile,
        language: 'vi',
      }),
    });
    const data = await resp.json();
    Object.assign(out, {
      content: data.markdown || data.content || '',
      description: data.summary || '',
      status: 'done',
    });
  } catch(e) {
    out.status = 'error';
    out.errorMsg = e.message;
    // Fallback
    out.content = _fallbackBlog(item.title);
    out.status = 'done';
  }
  _current.progress.current++;
  renderDashboard();
}

async function _generateNewsletter(item) {
  const out = _blankOutput({
    runId: _current.id, type: 'newsletter',
    title: item.title, sourceRange: item.sourceRange,
    status: 'generating',
  });
  _current.outputs.push(out);
  renderDashboard();

  try {
    const resp = await fetch('/cfactory/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: _current.transcript,
        title: item.title,
        brandProfile: _current.brandProfile,
      }),
    });
    const data = await resp.json();
    Object.assign(out, {
      content:     data.body    || data.content || '',
      description: data.subject || '',
      status: 'done',
    });
  } catch(e) {
    out.content = _fallbackNewsletter(item.title);
    out.status = 'done';
  }
  _current.progress.current++;
  renderDashboard();
}

async function _generateSocial(items) {
  const out = _blankOutput({
    runId: _current.id, type: 'social_post',
    title: 'Social Posts & Captions Package',
    status: 'generating',
  });
  _current.outputs.push(out);
  renderDashboard();

  try {
    const resp = await fetch('/cfactory/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: _current.transcript,
        projectName: _getProjectName(),
        brandProfile: _current.brandProfile,
        count: Math.min(items.length, 20),
        language: 'vi',
      }),
    });
    const data = await resp.json();
    Object.assign(out, {
      content:    (data.posts || []).join('\n\n---\n\n'),
      hashtags:   data.hashtags || [],
      description: `${(data.posts||[]).length} posts · ${(data.captions||[]).length} captions · ${(data.hashtags||[]).length} hashtags`,
      status: 'done',
    });

    // Store individual social post outputs too
    (data.captions || []).slice(0,5).forEach((cap, i) => {
      _current.outputs.push(_blankOutput({
        runId: _current.id, type: 'caption',
        title: `Caption #${i+1}`,
        content: cap,
        hashtags: (data.hashtags || []).slice(0, 10),
        status: 'done',
      }));
    });

    // Hashtag sets
    if ((data.hashtags || []).length > 0) {
      _current.outputs.push(_blankOutput({
        runId: _current.id, type: 'hashtags',
        title: 'Hashtag Sets',
        content: data.hashtags.map(h => '#' + h.replace(/^#/, '')).join(' '),
        hashtags: data.hashtags,
        status: 'done',
      }));
    }
  } catch(e) {
    out.content = _fallbackSocial();
    out.status = 'done';
  }
  _current.progress.current += items.length;
  renderDashboard();
}

async function _generateTitles(item) {
  const out = _blankOutput({
    runId: _current.id, type: item.type,
    title: item.title, sourceRange: item.sourceRange,
    description: item.description,
    status: 'generating',
  });
  _current.outputs.push(out);
  renderDashboard();

  try {
    const resp = await fetch('/cfactory/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:        item.type,
        title:       item.title,
        transcript:  _current.transcript.slice(0, 2000),
        brandProfile: _current.brandProfile,
        language:    'vi',
      }),
    });
    const data = await resp.json();
    Object.assign(out, {
      alternativeTitles: data.titles   || [item.title],
      hooks:             data.hooks    || [],
      ctas:              data.ctas     || [],
      hashtags:          data.hashtags || [],
      content:           (data.titles?.[0] || item.title),
      status: 'done',
    });
  } catch(e) {
    out.alternativeTitles = [item.title, item.title + ' | Xem ngay!', '🔥 ' + item.title];
    out.hooks = ['Bạn có biết...', 'Đừng bỏ qua video này!', 'Sự thật về...'];
    out.ctas  = ['Subscribe ngay!', 'Follow để xem thêm!', 'Share cho bạn bè!'];
    out.status = 'done';
  }
  _current.progress.current++;
  renderDashboard();
}

/* ── Fallback content generators ── */
function _fallbackBlog(title) {
  const proj = _getProjectName();
  const tr   = (_current.transcript || '').slice(0, 800);
  return `# ${title}\n\n## Giới thiệu\n\nVideo "${proj}" cung cấp những thông tin và kiến thức hữu ích cho người xem.\n\n## Nội dung chính\n\n${tr}\n\n## Kết luận\n\nHy vọng bài viết này hữu ích với bạn. Đừng quên theo dõi kênh để cập nhật thêm nhiều nội dung chất lượng!\n\n*Subscribe · Like · Share*`;
}

function _fallbackNewsletter(title) {
  return `**Subject:** ${title}\n\nXin chào!\n\nTuần này chúng tôi có video mới: "${_getProjectName()}"\n\n${(_current.transcript || '').slice(0, 400)}\n\n👉 Xem video đầy đủ tại kênh của chúng tôi.\n\n🔔 Đăng ký nhận bản tin hàng tuần!\n\nTrân trọng,\nĐội ngũ nội dung`;
}

function _fallbackSocial() {
  const name = _getProjectName();
  const posts = [];
  for (let i = 0; i < 5; i++) {
    posts.push(`🔥 Video mới: ${name}\n\nKhám phá ngay nội dung thú vị trong video này!\n\n#viral #trending #content`);
  }
  return posts.join('\n\n---\n\n');
}

/* ── Push to PublishingManager ── */
function _pushToPublishing() {
  if (!window.PublishingManager) return;
  const platforms = ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'x'];
  const typeToPlat = {
    youtube_long: 'youtube', youtube_short: 'youtube', tiktok: 'tiktok',
    instagram_reel: 'instagram', facebook_reel: 'facebook', linkedin: 'linkedin', x_post: 'x',
  };
  const seen = new Set();
  for (const out of _current.outputs) {
    const plat = typeToPlat[out.type];
    if (!plat || seen.has(plat) || out.status !== 'done') continue;
    seen.add(plat);
    PublishingManager.createPackage({
      platform:    plat,
      title:       out.alternativeTitles?.[0] || out.title,
      description: out.content?.slice(0, 500) || out.description || '',
      hashtags:    out.hashtags || [],
    });
  }
}

/* ══════════════════════════════════════════════════════════
   4. EXPORT PACKAGE
   ══════════════════════════════════════════════════════════ */

function exportPackage() {
  if (!_current || !_current.outputs.length) {
    _toast('⚠ Chưa có nội dung để xuất. Chạy Factory trước.');
    return;
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    projectName: _getProjectName(),
    runId: _current.id,
    totalOutputs: _current.outputs.length,
    structure: {
      '/youtube':   _current.outputs.filter(o=>['youtube_long','youtube_short'].includes(o.type)).map(_outToManifest),
      '/shorts':    _current.outputs.filter(o=>o.type==='youtube_short').map(_outToManifest),
      '/tiktok':    _current.outputs.filter(o=>o.type==='tiktok').map(_outToManifest),
      '/reels':     _current.outputs.filter(o=>['instagram_reel','facebook_reel'].includes(o.type)).map(_outToManifest),
      '/blog':      _current.outputs.filter(o=>o.type==='blog_md').map(_outToManifest),
      '/newsletter':_current.outputs.filter(o=>o.type==='newsletter').map(_outToManifest),
      '/social':    _current.outputs.filter(o=>['social_post','caption','hashtags','linkedin','x_post'].includes(o.type)).map(_outToManifest),
    },
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `content_factory_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  _toast('📦 Export Package đã được tải xuống');
}

function _outToManifest(out) {
  return {
    type: out.type,
    title: out.alternativeTitles?.[0] || out.title,
    alternativeTitles: out.alternativeTitles,
    hooks: out.hooks,
    ctas: out.ctas,
    hashtags: out.hashtags,
    content: out.content,
    description: out.description,
    sourceRange: out.sourceRange,
    status: out.status,
  };
}

/* ══════════════════════════════════════════════════════════
   5. DASHBOARD RENDER
   ══════════════════════════════════════════════════════════ */

const PIPELINE_STEPS = [
  { id:'transcript', label:'Transcript',     icon:'📝' },
  { id:'viral',      label:'Viral Analysis', icon:'⚡' },
  { id:'brand',      label:'Brand Clone',    icon:'🎨' },
  { id:'plan',       label:'Content Plan',   icon:'📋' },
  { id:'generate',   label:'Generate',       icon:'🤖' },
  { id:'publish',    label:'Publishing',     icon:'📤' },
  { id:'done',       label:'Done',           icon:'✅' },
];

function renderDashboard() {
  const panel = document.getElementById('cfactory-panel');
  if (!panel) return;

  const isRunning = _current && ['planning','generating'].includes(_current.status);
  const isDone    = _current && _current.status === 'done';
  const hasOutputs = _current && _current.outputs.length > 0;

  panel.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 0;flex-shrink:0">
  <div style="font-size:14px;font-weight:700;color:var(--t1)">🏭 Content Factory</div>
  <div style="display:flex;gap:5px">
    ${hasOutputs ? `<button onclick="ContentFactory.exportPackage()" style="${_btnSm('rgba(46,204,113,.2)','#2ecc71')}">📦 Export</button>` : ''}
    ${!isRunning ? `<button onclick="ContentFactory._openSetup()" style="background:var(--accent);border:none;border-radius:6px;color:#000;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">▶ Run</button>` : ''}
    ${isRunning  ? `<button style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--t3);padding:4px 10px;font-size:11px;cursor:not-allowed" disabled>⏳ Running...</button>` : ''}
  </div>
</div>

<!-- Tabs -->
<div style="display:flex;border-bottom:1px solid var(--border2);padding:0 8px;flex-shrink:0;gap:2px;overflow-x:auto;margin-top:8px">
  ${_tabBtn('pipeline', '⚡ Pipeline', _activeTab==='pipeline')}
  ${_tabBtn('results',  `📄 Kết quả${hasOutputs?' ('+_current.outputs.length+')':''}`, _activeTab==='results')}
  ${_tabBtn('types',    '🎛 Loại nội dung', _activeTab==='types')}
  ${_tabBtn('history',  '🕐 Lịch sử', _activeTab==='history')}
</div>

<div style="flex:1;overflow-y:auto;padding:10px 12px">
  ${_activeTab==='pipeline' ? _renderPipeline() : ''}
  ${_activeTab==='results'  ? _renderResults()  : ''}
  ${_activeTab==='types'    ? _renderTypes()    : ''}
  ${_activeTab==='history'  ? _renderHistory()  : ''}
</div>`;
}

function _renderPipeline() {
  const prog = _current?.progress || { current: 0, total: 0 };
  const pct  = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;

  const stepStates = _getStepStates();

  return `
<!-- Status banner -->
${_current ? `<div style="background:${_statusBg(_current.status)};border:1px solid ${_statusColor(_current.status)}33;border-radius:8px;padding:10px;margin-bottom:12px">
  <div style="display:flex;align-items:center;gap:8px">
    <div style="font-size:18px">${_statusIcon(_current.status)}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--t1)">${_statusLabel(_current.status)}</div>
      <div style="font-size:10px;color:var(--t3)">${_current.stage || ''}</div>
    </div>
    ${_current.status === 'generating' ? `<div style="font-size:12px;font-weight:700;color:var(--accent2)">${pct}%</div>` : ''}
  </div>
  ${_current.status === 'generating' ? `<div style="margin-top:8px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">
    <div style="width:${pct}%;height:100%;background:var(--accent);border-radius:2px;transition:width .3s"></div>
  </div>` : ''}
  ${_current.error ? `<div style="margin-top:6px;font-size:10px;color:#e74c3c">⛔ ${_current.error}</div>` : ''}
</div>` : `<div style="text-align:center;padding:16px;background:var(--bg2);border:1px dashed var(--border2);border-radius:8px;margin-bottom:12px">
  <div style="font-size:24px;margin-bottom:6px">🏭</div>
  <div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:4px">Biến 1 video dài thành hệ sinh thái nội dung</div>
  <div style="font-size:10px;color:var(--t3)">YouTube · TikTok · Instagram · Blog · Newsletter · Social</div>
</div>`}

<!-- Pipeline steps -->
<div style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:.5px;margin-bottom:8px">QUY TRÌNH FACTORY</div>
<div style="display:flex;flex-direction:column;gap:0">
  ${PIPELINE_STEPS.map((step, i) => {
    const state = stepStates[i];
    const isActive = state === 'active';
    const isDone   = state === 'done';
    const isWaiting = state === 'waiting';
    return `
<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:${isActive?'rgba(255,204,0,.08)':isDone?'rgba(46,204,113,.05)':'transparent'};border-radius:7px;position:relative">
  <div style="width:28px;height:28px;border-radius:50%;background:${isDone?'rgba(46,204,113,.2)':isActive?'rgba(255,204,0,.2)':'var(--bg3)'};border:1.5px solid ${isDone?'#2ecc71':isActive?'var(--accent)':'var(--border2)'};display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">
    ${isDone?'✓':step.icon}
  </div>
  <div style="flex:1">
    <div style="font-size:11px;font-weight:${isActive?700:600};color:${isActive?'var(--accent2)':isDone?'#2ecc71':'var(--t3)'}">${step.label}</div>
    ${isActive && _current?.stage ? `<div style="font-size:9px;color:var(--t3)">${_current.stage}</div>` : ''}
  </div>
  ${isDone?'<div style="font-size:10px;color:#2ecc71">✅</div>':''}
  ${isActive?'<div style="font-size:10px;color:var(--accent)">⏳</div>':''}
</div>
${i < PIPELINE_STEPS.length-1 ? `<div style="width:1px;height:8px;background:var(--border2);margin-left:23px"></div>` : ''}`;
  }).join('')}
</div>

${!_current || _current.status === 'idle' || _current.status === 'done' ? `
<div style="margin-top:14px">
  <button onclick="ContentFactory._openSetup()" style="width:100%;padding:10px;background:var(--accent);border:none;border-radius:8px;color:#000;font-weight:700;font-size:13px;cursor:pointer">🚀 Bắt đầu Factory</button>
</div>` : ''}`;
}

function _getStepStates() {
  if (!_current || _current.status === 'idle') return PIPELINE_STEPS.map(() => 'waiting');
  const prog = _current.progress;
  const steps = [];
  const stageMap = {
    'Đang thu thập transcript...': 0,
    'Đang phân tích viral segments...': 1,
    'Đang đọc Brand Profile...': 2,
    'AI đang lên kế hoạch nội dung...': 3,
    'AI đang tạo nội dung...': 4,
    'Đang tích hợp với Publishing Manager...': 5,
    'Hoàn thành!': 6,
  };
  const activeIdx = stageMap[_current.stage] ?? -1;
  for (let i = 0; i < PIPELINE_STEPS.length; i++) {
    if (_current.status === 'done') steps.push('done');
    else if (i < activeIdx) steps.push('done');
    else if (i === activeIdx) steps.push('active');
    else steps.push('waiting');
  }
  return steps;
}

function _renderResults() {
  if (!_current || !_current.outputs.length) {
    return `<div style="text-align:center;padding:24px;color:var(--t3);font-size:11px">
      <div style="font-size:28px;margin-bottom:8px">📭</div>
      Chưa có kết quả. Chạy Factory để bắt đầu tạo nội dung.
    </div>`;
  }

  // Group outputs by type
  const grouped = {};
  for (const out of _current.outputs) {
    if (!grouped[out.type]) grouped[out.type] = [];
    grouped[out.type].push(out);
  }

  return Object.entries(grouped).map(([typeId, items]) => {
    const td = CONTENT_TYPES[typeId] || { label: typeId, icon: '📄', color: '#888', colorDim: 'rgba(136,136,136,.1)' };
    const colorDim = td.colorDim || 'rgba(136,136,136,.12)';
    return `
<div style="margin-bottom:12px">
  <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
    <div style="width:22px;height:22px;border-radius:5px;background:${colorDim};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${td.color}">${td.icon}</div>
    <div style="font-size:11px;font-weight:700;color:var(--t1)">${td.label}</div>
    <div style="font-size:9px;color:var(--t3);margin-left:auto">${items.length} mục</div>
  </div>
  ${items.map(out => _renderOutputCard(out, td)).join('')}
</div>`;
  }).join('');
}

function _renderOutputCard(out, td) {
  const isShortContent = ['youtube_short','tiktok','instagram_reel','facebook_reel','x_post'].includes(out.type);
  const mainTitle = out.alternativeTitles?.[0] || out.title;

  return `
<div style="border:1px solid var(--border2);border-radius:8px;padding:9px;margin-bottom:6px;background:var(--bg2)">
  <div style="font-size:11px;font-weight:700;color:var(--t1);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(mainTitle)}">${mainTitle}</div>

  ${out.status === 'generating' ? `<div style="font-size:10px;color:var(--accent2)">⏳ Đang tạo...</div>` : ''}
  ${out.status === 'error' ? `<div style="font-size:10px;color:#e74c3c">⛔ ${out.errorMsg||'Lỗi'}</div>` : ''}

  ${out.status === 'done' ? `
    <!-- Alternative titles -->
    ${out.alternativeTitles?.length > 1 ? `<div style="margin-bottom:5px">
      <div style="font-size:9px;color:var(--t3);margin-bottom:3px">📌 ${out.alternativeTitles.length} Tiêu đề:</div>
      ${out.alternativeTitles.map((t,i) => `<div style="font-size:9px;color:var(--t2);padding:2px 0;border-bottom:1px solid var(--border2)">${i+1}. ${_esc(t)}</div>`).join('')}
    </div>` : ''}

    <!-- Hooks -->
    ${out.hooks?.length ? `<div style="margin-bottom:5px">
      <div style="font-size:9px;color:var(--t3);margin-bottom:3px">🎣 Hooks:</div>
      ${out.hooks.map(h => `<div style="font-size:9px;color:var(--accent2);padding:2px 0">→ ${_esc(h)}</div>`).join('')}
    </div>` : ''}

    <!-- Content preview -->
    ${out.content && out.type === 'blog_md' ? `<div style="font-size:9px;color:var(--t3);background:var(--bg3);border-radius:5px;padding:6px;margin-bottom:5px;max-height:70px;overflow:hidden;font-family:monospace;white-space:pre-wrap">${_esc(out.content.slice(0,300))}</div>` : ''}
    ${out.content && out.type === 'newsletter' ? `<div style="font-size:9px;color:var(--t3);background:var(--bg3);border-radius:5px;padding:6px;margin-bottom:5px;max-height:60px;overflow:hidden">${_esc(out.content.slice(0,250))}</div>` : ''}
    ${out.content && out.type === 'social_post' ? `<div style="font-size:9px;color:var(--t3);background:var(--bg3);border-radius:5px;padding:6px;margin-bottom:5px;max-height:60px;overflow:hidden">${_esc(out.content.slice(0,200))}</div>` : ''}
    ${out.type === 'caption' && out.content ? `<div style="font-size:10px;color:var(--t2);background:var(--bg3);border-radius:5px;padding:6px;margin-bottom:5px">${_esc(out.content)}</div>` : ''}
    ${out.type === 'hashtags' && out.content ? `<div style="font-size:9px;color:var(--t3);line-height:1.8">${_esc(out.content)}</div>` : ''}

    <!-- CTAs -->
    ${out.ctas?.length ? `<div style="margin-bottom:5px">
      <div style="font-size:9px;color:var(--t3);margin-bottom:3px">📢 CTAs:</div>
      ${out.ctas.map(c => `<span style="font-size:9px;background:rgba(255,204,0,.1);color:var(--accent2);border-radius:4px;padding:1px 6px;margin-right:4px">${_esc(c)}</span>`).join('')}
    </div>` : ''}

    <!-- Hashtags -->
    ${out.hashtags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:5px">
      ${out.hashtags.slice(0,8).map(h => `<span style="font-size:8px;background:rgba(52,152,219,.1);color:#3498db;border-radius:3px;padding:1px 5px">#${h.replace(/^#/,'')}</span>`).join('')}
      ${out.hashtags.length > 8 ? `<span style="font-size:8px;color:var(--t3)">+${out.hashtags.length-8}</span>` : ''}
    </div>` : ''}

    <!-- Copy button -->
    <button onclick="ContentFactory._copyOutput('${out.id}')" style="${_btnSm('var(--bg3)','var(--t2)')}">📋 Copy</button>
    ${out.type === 'blog_md' ? `<button onclick="ContentFactory._downloadOutput('${out.id}')" style="${_btnSm('rgba(155,89,182,.15)','#9b59b6')}">⬇ .md</button>` : ''}
  ` : ''}
</div>`;
}

function _renderTypes() {
  return `
<div style="font-size:10px;color:var(--t3);margin-bottom:10px">Chọn loại nội dung khi chạy Factory. Mỗi lần chạy có thể tạo:</div>
<div style="display:flex;flex-direction:column;gap:6px">
  ${Object.values(CONTENT_TYPES).map(td => `
<div style="display:flex;align-items:center;gap:10px;padding:9px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px">
  <div style="width:28px;height:28px;border-radius:7px;background:${td.colorDim||'rgba(136,136,136,.12)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:${td.color};flex-shrink:0">${td.icon}</div>
  <div style="flex:1">
    <div style="font-size:11px;font-weight:700;color:var(--t1)">${td.label}</div>
    <div style="font-size:9px;color:var(--t3)">Tạo ${td.count} nội dung · ${td.platform}</div>
  </div>
  <div style="font-size:11px;font-weight:700;color:${td.color}">${td.count}</div>
</div>`).join('')}
</div>

<div style="margin-top:12px;background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.2);border-radius:7px;padding:10px">
  <div style="font-size:10px;font-weight:700;color:var(--accent2);margin-bottom:4px">ℹ Kiến trúc Pipeline</div>
  <div style="font-size:9px;color:var(--t3);line-height:1.6">
    Video → Transcript → Viral Analysis → Brand Clone → Content Planning → AI Generation → Export Package<br>
    <br>
    AI sử dụng transcript thật và brand profile để tạo nội dung nhất quán với phong cách thương hiệu.
  </div>
</div>`;
}

function _renderHistory() {
  if (!_runs.length) {
    return `<div style="text-align:center;padding:24px;color:var(--t3);font-size:11px">Chưa có lịch sử Factory nào.</div>`;
  }
  return `<div style="display:flex;flex-direction:column;gap:8px">` +
    _runs.slice(0, 10).map(run => {
      const done = run.outputs.filter(o => o.status === 'done').length;
      return `
<div style="border:1px solid var(--border2);border-radius:8px;padding:10px;background:var(--bg2);cursor:pointer" onclick="ContentFactory._loadRun('${run.id}')">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
    <div style="font-size:18px">${_statusIcon(run.status)}</div>
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:var(--t1)">${new Date(run.createdAt).toLocaleString('vi-VN')}</div>
      <div style="font-size:9px;color:var(--t3)">${done} nội dung · ${run.plan?.length||0} kế hoạch</div>
    </div>
    <span style="font-size:9px;padding:2px 7px;border-radius:8px;background:${_statusBg(run.status)};color:${_statusColor(run.status)}">${_statusLabel(run.status)}</span>
  </div>
  <button onclick="event.stopPropagation();ContentFactory._loadRun('${run.id}')" style="${_btnSm('var(--bg3)','var(--t2)')}">📂 Xem kết quả</button>
</div>`;
    }).join('') + `</div>`;
}

/* ══════════════════════════════════════════════════════════
   6. SETUP MODAL
   ══════════════════════════════════════════════════════════ */

function _openSetup() {
  const html = `
<div id="cf-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9000;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)ContentFactory._closeModal()">
<div style="background:var(--bg1);border:1px solid var(--border);border-radius:13px;width:400px;max-height:88vh;overflow-y:auto;padding:20px">
  <div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:4px">🏭 Auto Content Factory</div>
  <div style="font-size:11px;color:var(--t3);margin-bottom:16px">Chọn loại nội dung muốn tạo từ video hiện tại</div>

  <div style="font-size:10px;color:var(--t3);font-weight:700;margin-bottom:8px">LOẠI NỘI DUNG</div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:16px">
    ${Object.values(CONTENT_TYPES).map(td => `
<label style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;cursor:pointer">
  <input type="checkbox" value="${td.id}" checked style="width:14px;height:14px;accent-color:var(--accent)">
  <div style="width:24px;height:24px;border-radius:5px;background:${td.colorDim||'rgba(136,136,136,.12)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${td.color};flex-shrink:0">${td.icon}</div>
  <div style="flex:1">
    <div style="font-size:11px;font-weight:700;color:var(--t1)">${td.label}</div>
    <div style="font-size:9px;color:var(--t3)">${td.count} nội dung</div>
  </div>
</label>`).join('')}
  </div>

  <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.2);border-radius:7px;padding:10px;margin-bottom:16px">
    <div style="font-size:10px;font-weight:700;color:var(--accent2);margin-bottom:3px">💡 Lưu ý</div>
    <div style="font-size:9px;color:var(--t3)">Factory sẽ đọc transcript, viral analysis và brand profile từ dữ liệu hiện có. Đảm bảo đã chạy Transcript Engine và Brand Clone trước để có kết quả tốt nhất.</div>
  </div>

  <div style="display:flex;gap:8px">
    <button onclick="ContentFactory._doRun()" style="flex:1;padding:10px;background:var(--accent);border:none;border-radius:9px;color:#000;font-weight:800;font-size:13px;cursor:pointer">🚀 Bắt đầu Factory</button>
    <button onclick="ContentFactory._closeModal()" style="padding:10px 14px;background:var(--bg3);border:1px solid var(--border2);border-radius:9px;color:var(--t2);font-size:12px;cursor:pointer">Hủy</button>
  </div>
</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _doRun() {
  const checks = [...document.querySelectorAll('#cf-modal-overlay input[type=checkbox]:checked')];
  const types  = checks.map(c => c.value).filter(Boolean);
  if (!types.length) { _toast('⚠ Chọn ít nhất một loại nội dung'); return; }
  _closeModal();
  _activeTab = 'pipeline';
  runFactory(types);
}

function _closeModal() {
  document.getElementById('cf-modal-overlay')?.remove();
}

/* ══════════════════════════════════════════════════════════
   7. INTERNAL HELPERS
   ══════════════════════════════════════════════════════════ */

function _tab(name) { _activeTab = name; renderDashboard(); }

function _loadRun(id) {
  const run = _runs.find(r => r.id === id);
  if (run) { _current = run; _activeTab = 'results'; renderDashboard(); }
}

function _copyOutput(id) {
  const out = _current?.outputs.find(o => o.id === id);
  if (!out) return;
  const text = [
    out.alternativeTitles?.join('\n'),
    out.hooks?.map(h => '🎣 ' + h).join('\n'),
    out.content,
    out.ctas?.join(' | '),
    out.hashtags?.map(h => '#'+h.replace(/^#/,'')).join(' '),
  ].filter(Boolean).join('\n\n');
  navigator.clipboard?.writeText(text).then(() => _toast('📋 Đã copy!'));
}

function _downloadOutput(id) {
  const out = _current?.outputs.find(o => o.id === id);
  if (!out || !out.content) return;
  const ext  = out.type === 'blog_md' ? '.md' : '.txt';
  const blob = new Blob([out.content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (out.title || 'content').replace(/[^a-z0-9]+/gi, '_') + ext;
  a.click();
  URL.revokeObjectURL(url);
}

function _statusIcon(s)  { return {idle:'🏭',planning:'📋',generating:'⚙️',done:'✅',error:'❌'}[s]||'🏭'; }
function _statusLabel(s) { return {idle:'Sẵn sàng',planning:'Lên kế hoạch',generating:'Đang tạo',done:'Hoàn thành',error:'Lỗi'}[s]||s; }
function _statusColor(s) { return {idle:'#888',planning:'#f0a500',generating:'#3498db',done:'#2ecc71',error:'#e74c3c'}[s]||'#888'; }
function _statusBg(s)    { return {idle:'var(--bg2)',planning:'rgba(240,165,0,.1)',generating:'rgba(52,152,219,.1)',done:'rgba(46,204,113,.1)',error:'rgba(231,76,60,.1)'}[s]||'var(--bg2)'; }

function _tabBtn(id, label, active) {
  return `<div onclick="ContentFactory._tab('${id}')" style="padding:6px 10px;font-size:11px;cursor:pointer;border-bottom:2px solid ${active?'var(--accent)':'transparent'};color:${active?'var(--t1)':'var(--t3)'};margin-bottom:-1px;white-space:nowrap">${label}</div>`;
}

function _btnSm(bg, color) {
  return `background:${bg};border:1px solid ${color}33;border-radius:5px;color:${color};font-size:9px;font-weight:600;padding:3px 8px;cursor:pointer;margin-right:4px`;
}

function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _toast(msg) {
  if (typeof toast === 'function') toast(msg);
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.ContentFactory = {
  runFactory, exportPackage,
  renderDashboard,
  getOutputs: () => _current?.outputs || [],
  getCurrentRun: () => _current,
  getRuns: () => _runs,
  CONTENT_TYPES,
  // Internal (DOM)
  _tab, _loadRun, _copyOutput, _downloadOutput, _openSetup, _doRun, _closeModal,
};

console.log('[ContentFactory] Phase 4.0 Auto Content Factory loaded');

})();
