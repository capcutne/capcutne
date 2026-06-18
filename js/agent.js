/* ============================================================
   AUTONOMOUS CONTENT AGENT — js/agent.js
   Phase 5.0: ContentAgent — plan, analyze, recommend, prepare.

   The agent NEVER auto-publishes. All actions require user confirmation.

   Storage:
     cc_agent_state   — agent goals, tasks, memory snapshot
     cc_agent_ideas   — generated content ideas
     cc_agent_tasks   — task queue
     cc_agent_calendar— content calendar plans
   ============================================================ */

(function () {

const KEY_STATE    = 'cc_agent_state';
const KEY_IDEAS    = 'cc_agent_ideas';
const KEY_TASKS    = 'cc_agent_tasks';
const KEY_CALENDAR = 'cc_agent_calendar';

/* ══════════════════════════════════════════════════════════
   1. SCHEMA & STATE
   ══════════════════════════════════════════════════════════ */

function _defaultState() {
  return {
    id:              'agent_01',
    name:            'Content Agent',
    version:         '5.0',
    createdAt:       new Date().toISOString(),
    lastRunAt:       null,
    goals:           ['Tối đa hoá viral score', 'Tăng CTR qua hook đa dạng', 'Duy trì lịch đăng đều đặn'],
    memory:          {},
    runCount:        0,
  };
}

let _state    = _load(KEY_STATE,    null) || _defaultState();
let _ideas    = _load(KEY_IDEAS,    []);
let _tasks    = _load(KEY_TASKS,    []);
let _calendar = _load(KEY_CALENDAR, {});

function _load(key, def) {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch(e) {}
  return def;
}
function _save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} }

function _persist() {
  _save(KEY_STATE,    _state);
  _save(KEY_IDEAS,    _ideas);
  _save(KEY_TASKS,    _tasks);
  _save(KEY_CALENDAR, _calendar);
}

/* ══════════════════════════════════════════════════════════
   2. UNIFIED MEMORY LAYER
   Pull live data from all installed modules.
   ══════════════════════════════════════════════════════════ */

function buildMemory() {
  const mem = {
    timestamp: new Date().toISOString(),

    /* ── Analytics ── */
    analytics: (() => {
      if (!window.AnalyticsManager) return null;
      const records  = AnalyticsManager.getRecords();
      const insights = AnalyticsManager.generateInsights();
      const top      = AnalyticsManager.topContent(5);
      const worst    = AnalyticsManager.worstContent(5);
      return {
        recordCount:     records.length,
        avgScore:        records.length ? Math.round(records.reduce((s,r)=>s+r.score,0)/records.length) : 0,
        topContent:      top.map(r=>({ id:r.id, title:r.title, score:r.score, platform:r.platform, hookType:r.editorial.hookType, ctaType:r.editorial.ctaType, subtitleStyle:r.editorial.subtitleStyle })),
        worstContent:    worst.map(r=>({ id:r.id, title:r.title, score:r.score })),
        topHooks:        insights.topHooks        || [],
        ctaRanking:      insights.ctaRanking      || [],
        subtitleCTR:     insights.subtitleCTR     || [],
        recommendations: insights.recommendations || [],
        viralCalibration:insights.viralCalibration || null,
        platforms:       [...new Set(records.map(r=>r.platform))],
      };
    })(),

    /* ── Brand Clone ── */
    brand: (() => {
      if (!window.BrandClone) return null;
      try {
        const active = BrandClone.getActiveProfile ? BrandClone.getActiveProfile() : null;
        return active ? {
          id:            active.id,
          name:          active.brandName,
          confidence:    active.confidence,
          topSubtitle:   active.subtitlePatterns?.topTemplate,
          dominantHook:  active.hookPatterns?.dominantType,
          dominantCTA:   active.ctaPatterns?.dominantType,
          paceRating:    active.editingPatterns?.paceRating,
          videosAnalyzed:active.videosAnalyzed,
        } : null;
      } catch(e) { return null; }
    })(),

    /* ── Personal Style Memory ── */
    styleMemory: (() => {
      if (!window.StyleMemory) return null;
      try {
        const snap = StyleMemory.getLatestSnapshot ? StyleMemory.getLatestSnapshot() : null;
        return snap ? { cutStyle: snap.cutStyle, paceRating: snap.paceRating, dominantSubtitle: snap.dominantSubtitle } : null;
      } catch(e) { return null; }
    })(),

    /* ── Current Timeline ── */
    timeline: (() => {
      if (typeof tracks === 'undefined') return null;
      const clips = tracks.flatMap(t => t.clips);
      const dur   = clips.reduce((m,c)=>Math.max(m, c.start+(c.dur||0)), 0);
      return {
        trackCount: tracks.length,
        clipCount:  clips.length,
        duration:   Math.round(dur),
        types:      [...new Set(tracks.map(t=>t.type))],
      };
    })(),
  };

  _state.memory   = mem;
  _state.lastRunAt = mem.timestamp;
  _state.runCount++;
  _persist();
  return mem;
}

/* ══════════════════════════════════════════════════════════
   3. CONTENT OPPORTUNITY DETECTOR
   ══════════════════════════════════════════════════════════ */

const HOOK_TYPES  = ['question','shock','story','demo','challenge','reveal','reaction'];
const CTA_TYPES   = ['follow','subscribe','like','comment','share','visit','duet'];
const PLATFORMS   = ['youtube','tiktok','instagram','facebook'];
const FORMATS     = ['Short (15-60s)','Long-form (5-15m)','Podcast (20-60m)','Tutorial (3-8m)','Vlog (8-15m)','Challenge (30s)','Reaction (5-10m)'];
const SUB_STYLES  = ['tiktok','mrbeast','podcast','netflix','gaming','minimal','documentary'];

function detectOpportunities(mem) {
  const opps = [];

  /* Opportunity 1: Under-used platform */
  if (mem.analytics && mem.analytics.platforms.length > 0) {
    const allPlatforms = PLATFORMS;
    const used = mem.analytics.platforms;
    const unused = allPlatforms.filter(p => !used.includes(p));
    if (unused.length) {
      opps.push({ type:'platform', icon:'🌐', title:`Chưa khai thác: ${unused[0]}`, reason:`Nền tảng ${unused[0]} chưa có nội dung — thị trường mới`, priority:'high', expectedGain: '+25% reach' });
    }
  }

  /* Opportunity 2: Best hook type not used recently */
  if (mem.analytics && mem.analytics.topHooks.length) {
    const bestHook = mem.analytics.topHooks[0].type;
    opps.push({ type:'hook', icon:'🎣', title:`Tăng hook "${bestHook}"`, reason:`Hook dạng "${bestHook}" xuất hiện nhiều nhất trong video thành công`, priority:'high', expectedGain: '+18% CTR' });
  }

  /* Opportunity 3: Short-form gap */
  if (mem.analytics) {
    const hasShorts = mem.analytics.topContent.some(r => r.platform === 'tiktok' || r.platform === 'instagram');
    if (!hasShorts) opps.push({ type:'format', icon:'📱', title:'Thiếu Short-form Content', reason:'Không có TikTok/Reels trong top 5 — đây là định dạng viral cao nhất', priority:'high', expectedGain: '+40% views' });
  }

  /* Opportunity 4: Subtitle style CTR gain */
  if (mem.analytics && mem.analytics.subtitleCTR.length) {
    const best = mem.analytics.subtitleCTR[0];
    opps.push({ type:'subtitle', icon:'🖊', title:`Dùng subtitle "${best.style}" nhiều hơn`, reason:`Kiểu "${best.style}" có CTR trung bình ${best.avgCTR}% — cao nhất`, priority:'medium', expectedGain: `+${Math.round(best.avgCTR)}% CTR` });
  }

  /* Opportunity 5: Brand consistency */
  if (mem.brand && mem.brand.confidence < 0.6) {
    opps.push({ type:'brand', icon:'🎨', title:'Tăng nhất quán thương hiệu', reason:`Brand confidence chỉ ${Math.round(mem.brand.confidence*100)}% — cần thêm video để học`, priority:'medium', expectedGain: '+15% brand recall' });
  }

  /* Opportunity 6: Viral calibration — model underestimates */
  if (mem.analytics && mem.analytics.viralCalibration && mem.analytics.viralCalibration.avgAbsError > 15) {
    opps.push({ type:'calibration', icon:'🎯', title:'AI Viral Score cần hiệu chỉnh', reason:`Sai số trung bình ${mem.analytics.viralCalibration.avgAbsError} điểm — cần thêm data`, priority:'low', expectedGain: 'Dự báo chính xác hơn' });
  }

  /* Opportunity 7: Content velocity */
  if (mem.analytics && mem.analytics.recordCount < 5) {
    opps.push({ type:'volume', icon:'📈', title:'Tăng tần suất đăng', reason:'Ít hơn 5 records — cần nhiều nội dung hơn để AI học hiệu quả', priority:'high', expectedGain: '+30% learning speed' });
  }

  /* Always add a few generic opportunities */
  opps.push({ type:'trend', icon:'🔥', title:'Tận dụng trend hiện tại', reason:'Video theo trend thường có spike views trong 48h đầu', priority:'medium', expectedGain: '+50% viral reach' });
  opps.push({ type:'collab', icon:'🤝', title:'Nội dung hợp tác (Duet/Collab)', reason:'Collab content mở rộng audience nhanh nhất trên TikTok/Reels', priority:'low', expectedGain: '+35% new followers' });
  opps.push({ type:'seo', icon:'🔍', title:'Tối ưu tiêu đề & thumbnail', reason:'Tiêu đề dạng số (Top 5, 10 cách...) có CTR cao hơn 22%', priority:'medium', expectedGain: '+22% CTR' });

  return opps.slice(0, 10);
}

/* ══════════════════════════════════════════════════════════
   4. IDEA GENERATOR
   ══════════════════════════════════════════════════════════ */

const IDEA_TEMPLATES = [
  { titleFn: (b) => `${b.hook === 'question' ? 'Bạn có biết' : 'Khám phá'} ${_randTopic()} trong 60 giây?`, hook:'question', format:'Short (15-60s)', platform:'tiktok' },
  { titleFn: () => `${_randNum()} bí quyết ${_randTopic()} không ai nói cho bạn`, hook:'shock', format:'Long-form (5-15m)', platform:'youtube' },
  { titleFn: () => `Hành trình ${_randDays()} ngày ${_randTopic()} của tôi`, hook:'story', format:'Vlog (8-15m)', platform:'youtube' },
  { titleFn: () => `Tôi thử ${_randTopic()} lần đầu tiên — kết quả?`, hook:'reveal', format:'Short (15-60s)', platform:'instagram' },
  { titleFn: () => `Hướng dẫn ${_randTopic()} chi tiết từ A đến Z`, hook:'demo', format:'Tutorial (3-8m)', platform:'youtube' },
  { titleFn: () => `${_randNum()} lỗi sai khi ${_randTopic()} bạn không nên mắc`, hook:'shock', format:'Short (15-60s)', platform:'tiktok' },
  { titleFn: () => `React to: video ${_randTopic()} viral nhất tuần này`, hook:'reaction', format:'Reaction (5-10m)', platform:'youtube' },
  { titleFn: () => `Challenge ${_randTopic()} — ai dám thử?`, hook:'challenge', format:'Challenge (30s)', platform:'tiktok' },
  { titleFn: () => `Podcast: Sự thật về ${_randTopic()} mà ít ai biết`, hook:'story', format:'Podcast (20-60m)', platform:'youtube' },
  { titleFn: () => `So sánh ${_randTopic()} — cái nào tốt hơn?`, hook:'question', format:'Long-form (5-15m)', platform:'youtube' },
];

const TOPICS   = ['AI & công nghệ','du lịch budget','ẩm thực đường phố','thể dục tại nhà','tài chính cá nhân','sức khoẻ tinh thần','review sản phẩm','học kỹ năng mới','khởi nghiệp','lifestyle tối giản'];
const RAND_N   = [3,5,7,10,5,'Vài'];
const RAND_D   = [7,14,30,90,21];

function _randTopic() { return TOPICS[Math.floor(Math.random() * TOPICS.length)]; }
function _randNum()   { const v = RAND_N[Math.floor(Math.random() * RAND_N.length)]; return v; }
function _randDays()  { return RAND_D[Math.floor(Math.random() * RAND_D.length)]; }

function _simulateScore(idea) {
  /* Heuristic simulation — no API call */
  let base = 45;
  if (idea.hook === 'shock')     base += 18;
  if (idea.hook === 'question')  base += 12;
  if (idea.hook === 'challenge') base += 15;
  if (idea.hook === 'reveal')    base += 10;
  if (idea.hook === 'story')     base += 8;
  if (idea.platform === 'tiktok')     base += 12;
  if (idea.platform === 'instagram')  base += 8;
  if (idea.format.includes('Short'))  base += 10;
  if (idea.subtitleStyle === 'tiktok' || idea.subtitleStyle === 'mrbeast') base += 6;
  const noise = (Math.random() - 0.5) * 14;
  return Math.min(98, Math.max(20, Math.round(base + noise)));
}

function _simulateCTR(idea) {
  let base = 4.5;
  if (idea.hook === 'shock')    base += 3.5;
  if (idea.hook === 'question') base += 2.5;
  if (idea.platform === 'tiktok') base += 3;
  const noise = (Math.random() - 0.5) * 2;
  return Math.min(20, Math.max(1, +(base + noise).toFixed(1)));
}

function _simulateRetention(idea) {
  let base = 42;
  if (idea.format.includes('Short'))  base += 18;
  if (idea.hook === 'challenge')      base += 12;
  if (idea.subtitleStyle === 'tiktok') base += 8;
  const noise = (Math.random() - 0.5) * 10;
  return Math.min(90, Math.max(20, Math.round(base + noise)));
}

function generateIdeas(mem, count) {
  count = count || 10;
  const ideas = [];

  /* Pull best hook/subtitle/cta from analytics if available */
  const bestHook    = mem?.analytics?.topHooks?.[0]?.type        || 'question';
  const bestSub     = mem?.analytics?.subtitleCTR?.[0]?.style    || 'tiktok';
  const bestCTA     = mem?.analytics?.ctaRanking?.[0]?.type      || 'follow';
  const brandHook   = mem?.brand?.dominantHook  || null;
  const brandSub    = mem?.brand?.topSubtitle   || null;

  for (let i = 0; i < count; i++) {
    const tpl  = IDEA_TEMPLATES[i % IDEA_TEMPLATES.length];
    const hook = i < 3 ? bestHook : (brandHook && i < 6 ? brandHook : tpl.hook);
    const sub  = i < 4 ? bestSub  : (brandSub  && i < 7 ? brandSub  : SUB_STYLES[i % SUB_STYLES.length]);
    const cta  = i < 3 ? bestCTA  : CTA_TYPES[i % CTA_TYPES.length];

    const idea = {
      id:             'idea_' + Date.now() + '_' + i,
      title:          tpl.titleFn({ hook }),
      hook,
      ctaType:        cta,
      ctaText:        _ctaText(cta),
      format:         tpl.format,
      platform:       tpl.platform,
      subtitleStyle:  sub,
      generatedAt:    new Date().toISOString(),
      status:         'new',            // new | approved | rejected | in_progress | done
    };
    idea.simulation = {
      viralScore: _simulateScore(idea),
      ctrPercent: _simulateCTR(idea),
      retention:  _simulateRetention(idea),
    };
    ideas.push(idea);
  }

  _ideas = ideas;
  _persist();
  return ideas;
}

function _ctaText(type) {
  const map = { follow:'Follow để không bỏ lỡ!', subscribe:'Subscribe ngay!', like:'Like nếu bạn thấy hay!', comment:'Comment ý kiến của bạn!', share:'Chia sẻ cho bạn bè!', visit:'Link trong bio!', duet:'Duet với tôi!', none:'' };
  return map[type] || '';
}

/* ══════════════════════════════════════════════════════════
   5. CONTENT CALENDAR
   ══════════════════════════════════════════════════════════ */

const DAY_NAMES = ['CN','Th2','Th3','Th4','Th5','Th6','Th7'];
const PLATFORM_BEST_DAYS = {
  youtube:   [3,5],    // Wed, Fri
  tiktok:    [2,4,6],  // Tue, Thu, Sat
  instagram: [1,3,5],  // Mon, Wed, Fri
  facebook:  [2,4],
};
const PLATFORM_BEST_TIMES = { youtube:'18:00', tiktok:'20:00', instagram:'19:00', facebook:'12:00' };

function generateCalendar(days, mem) {
  days = days || 7;
  const plan = [];
  const ideas = _ideas.length ? _ideas : generateIdeas(mem, 10);
  const today = new Date();

  for (let d = 0; d < days; d++) {
    const date  = new Date(today);
    date.setDate(today.getDate() + d);
    const dow   = date.getDay();   // 0=Sun

    /* Pick up to 2 posts per day based on best days */
    const dayPosts = [];
    for (const plat of PLATFORMS) {
      const bestDays = PLATFORM_BEST_DAYS[plat] || [];
      if (!bestDays.includes(dow)) continue;
      const idea = ideas.find(i => i.platform === plat && !plan.some(p => p.posts.some(pp => pp.ideaId === i.id)));
      if (!idea) continue;
      dayPosts.push({
        id:          'cal_' + date.toISOString().slice(0,10) + '_' + plat,
        ideaId:      idea.id,
        title:       idea.title,
        platform:    plat,
        format:      idea.format,
        hook:        idea.hook,
        time:        PLATFORM_BEST_TIMES[plat],
        status:      'planned',
        viralScore:  idea.simulation.viralScore,
      });
    }

    plan.push({
      date:    date.toISOString().slice(0, 10),
      dayName: DAY_NAMES[dow],
      posts:   dayPosts,
    });
  }

  _calendar[`${days}d`] = { days, generatedAt: new Date().toISOString(), plan };
  _persist();
  return _calendar[`${days}d`];
}

/* ══════════════════════════════════════════════════════════
   6. TASK SYSTEM
   ══════════════════════════════════════════════════════════ */

const PRIORITY_ORDER = { critical:0, high:1, medium:2, low:3 };

function createTask(title, priority, reason, type) {
  const task = {
    id:         'task_' + Date.now(),
    title,
    priority:   priority || 'medium',
    reason:     reason   || '',
    type:       type     || 'general',
    status:     'pending',   // pending | in_progress | done | dismissed
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
  };
  _tasks.unshift(task);
  _persist();
  return task;
}

function updateTask(id, patch) {
  const t = _tasks.find(t => t.id === id);
  if (!t) return null;
  Object.assign(t, patch, { updatedAt: new Date().toISOString() });
  _persist();
  return t;
}

function _autoGenerateTasks(mem, opps) {
  /* Generate recommended tasks from opportunities */
  const existing = _tasks.filter(t => t.status !== 'done' && t.status !== 'dismissed').map(t => t.title);
  for (const opp of opps.slice(0, 5)) {
    const title = `[${opp.type.toUpperCase()}] ${opp.title}`;
    if (existing.includes(title)) continue;
    createTask(title, opp.priority, opp.reason, opp.type);
  }
}

/* ══════════════════════════════════════════════════════════
   7. FULL AGENT RUN
   ══════════════════════════════════════════════════════════ */

function run() {
  const mem  = buildMemory();
  const opps = detectOpportunities(mem);
  const ideas = generateIdeas(mem, 10);
  _autoGenerateTasks(mem, opps);

  /* Build autonomous recommendations */
  const recs = _buildRecommendations(mem, opps);

  return { mem, opportunities: opps, ideas, tasks: _tasks.filter(t => t.status === 'pending'), recommendations: recs };
}

function _buildRecommendations(mem, opps) {
  const recs = [];

  if (mem.analytics) {
    const { avgScore, recordCount, topHooks, ctaRanking } = mem.analytics;
    if (avgScore > 65) recs.push({ icon:'✅', type:'insight', text:`Hiệu suất nội dung đang tốt — điểm TB ${avgScore}/100` });
    else recs.push({ icon:'⚠️', type:'insight', text:`Điểm TB ${avgScore}/100 — cần cải thiện hook và subtitle` });

    if (recordCount < 10) recs.push({ icon:'📊', type:'data', text:`Chỉ có ${recordCount} records — thêm data để AI học chính xác hơn` });

    if (topHooks.length) recs.push({ icon:'🎣', type:'hook', text:`Hook dạng "${topHooks[0].type}" đang hiệu quả nhất — dùng nhiều hơn` });
    if (ctaRanking.length) recs.push({ icon:'📣', type:'cta', text:`CTA "${ctaRanking[0].type}" có điểm TB cao nhất (${ctaRanking[0].avgScore}) — ưu tiên dùng` });
  }

  if (mem.brand) {
    if (mem.brand.confidence > 0.7) recs.push({ icon:'🎨', type:'brand', text:`Brand "${mem.brand.name}" đang nhất quán — confidence ${Math.round(mem.brand.confidence*100)}%` });
    else recs.push({ icon:'🎨', type:'brand', text:`Brand "${mem.brand.name}" cần thêm video — confidence chỉ ${Math.round(mem.brand.confidence*100)}%` });
  }

  for (const opp of opps.slice(0, 3)) {
    recs.push({ icon: opp.icon, type: opp.type, text: `${opp.title} — ${opp.expectedGain}` });
  }

  return recs;
}

/* ══════════════════════════════════════════════════════════
   8. ACTION ENGINE HANDLERS
   ══════════════════════════════════════════════════════════ */

function actGenerateContentPlan(params) {
  const days = params.days || 7;
  const mem  = buildMemory();
  const cal  = generateCalendar(days, mem);
  ContentAgent.renderDashboard();
  if (typeof toast === 'function') toast(`📅 Đã tạo kế hoạch ${days} ngày — ${cal.plan.reduce((s,d)=>s+d.posts.length,0)} bài đăng`);
  return { ok: true, calendar: cal };
}

function actAnalyzeStrategy(params) {
  const result = run();
  ContentAgent.renderDashboard();
  if (typeof toast === 'function') toast(`🤖 Agent đã phân tích — ${result.recommendations.length} gợi ý, ${result.opportunities.length} cơ hội`);
  return { ok: true, ...result };
}

function actGenerateIdeas(params) {
  const mem   = buildMemory();
  const ideas = generateIdeas(mem, params.count || 10);
  ContentAgent.renderDashboard();
  if (typeof toast === 'function') toast(`💡 Đã tạo ${ideas.length} ý tưởng nội dung mới`);
  return { ok: true, ideas };
}

function actCreateTask(params) {
  const task = createTask(params.title || 'New Task', params.priority || 'medium', params.reason || '', params.type || 'general');
  ContentAgent.renderDashboard();
  if (typeof toast === 'function') toast(`✅ Đã tạo task: ${task.title}`);
  return { ok: true, task };
}

/* ══════════════════════════════════════════════════════════
   9. DASHBOARD UI
   ══════════════════════════════════════════════════════════ */

const PRIORITY_COLORS = { critical:'#c0392b', high:'#e67e22', medium:'#D4A017', low:'#27ae60' };
const SCORE_COLOR = s => s >= 70 ? '#27ae60' : s >= 45 ? '#D4A017' : '#c0392b';
const PLAT_COLORS = { youtube:'#ff4444', tiktok:'#69c9d0', instagram:'#e1306c', facebook:'#1877f2', other:'#888' };
const PLAT_ICONS  = { youtube:'▶', tiktok:'♪', instagram:'◉', facebook:'f', other:'◈' };

/* XSS guard — escape all user-controllable strings before innerHTML injection */
function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

function _scoreRing(score, size) {
  size = size || 44;
  const r = size/2 - 4; const c = 2*Math.PI*r;
  const filled = (score/100)*c; const color = SCORE_COLOR(score);
  return `<svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--bg4)" stroke-width="3"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${filled} ${c}" stroke-linecap="round"/>
    <text x="${size/2}" y="${size/2+1}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${size<40?9:11}" font-weight="700" transform="rotate(90,${size/2},${size/2})">${score}</text>
  </svg>`;
}

function renderDashboard() {
  const panel = document.getElementById('agent-panel');
  if (!panel) return;
  const TAB = ContentAgent._activeTab || 'insights';

  panel.innerHTML = `
<div style="display:flex;flex-direction:column;height:100%;overflow:hidden;font-size:13px">
  <!-- header -->
  <div style="padding:12px 14px 0;flex-shrink:0">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--t1)">🤖 Agent Center</div>
        <div style="font-size:10px;color:var(--t3);margin-top:1px">${_state.lastRunAt ? 'Cập nhật ' + _relTime(_state.lastRunAt) : 'Chưa chạy'} · Run #${_state.runCount}</div>
      </div>
      <button onclick="ContentAgent._runAgent()" style="background:var(--accent);border:none;border-radius:7px;color:#000;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">▶ Chạy Agent</button>
    </div>
  </div>
  <!-- tabs -->
  <div style="display:flex;border-bottom:1px solid var(--border);margin-top:10px;padding:0 10px;flex-shrink:0;overflow-x:auto">
    ${[['insights','💡 Insights'],['recommendations','📣 Gợi ý'],['tasks','✅ Tasks'],['opportunities','🔥 Cơ hội'],['ideas','🧠 Ý tưởng'],['calendar','📅 Lịch']].map(([t,l])=>`
    <div onclick="ContentAgent._tab('${t}')" style="padding:7px 9px;font-size:11px;cursor:pointer;border-bottom:2px solid ${TAB===t?'var(--accent)':'transparent'};color:${TAB===t?'var(--t1)':'var(--t3)'};margin-bottom:-1px;white-space:nowrap">${l}</div>`).join('')}
  </div>
  <!-- body -->
  <div id="agp-body" style="flex:1;overflow-y:auto;padding:12px 12px 20px">
    ${_renderTab(TAB)}
  </div>
</div>`;
}

function _renderTab(tab) {
  switch(tab) {
    case 'insights':       return _tabInsights();
    case 'recommendations':return _tabRecommendations();
    case 'tasks':          return _tabTasks();
    case 'opportunities':  return _tabOpportunities();
    case 'ideas':          return _tabIdeas();
    case 'calendar':       return _tabCalendar();
    default:               return _tabInsights();
  }
}

function _tabInsights() {
  const mem = _state.memory;
  if (!mem || !mem.timestamp) return _notRun();

  const anl = mem.analytics;
  const br  = mem.brand;
  const tl  = mem.timeline;

  return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px">
  ${_chip('📊', anl ? anl.recordCount : '–', 'Analytics Records')}
  ${_chip('⭐', anl ? anl.avgScore : '–', 'Avg Score')}
  ${_chip('🎬', tl ? tl.clipCount : '–', 'Timeline Clips')}
  ${_chip('🎨', br ? Math.round(br.confidence*100)+'%' : '–', 'Brand Conf.')}
</div>

${anl ? `
<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px">📈 Memory từ Analytics</div>
<div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:10px">
  <div style="display:flex;flex-wrap:wrap;gap:6px">
    <div style="font-size:11px;color:var(--t2)">🏆 Top Hook: <span style="color:var(--accent2);font-weight:600">${anl.topHooks[0]?.type||'–'}</span></div>
    <div style="font-size:11px;color:var(--t2)">📣 Best CTA: <span style="color:var(--accent2);font-weight:600">${anl.ctaRanking[0]?.type||'–'}</span></div>
    <div style="font-size:11px;color:var(--t2)">🖊 Best Style: <span style="color:var(--accent2);font-weight:600">${anl.subtitleCTR[0]?.style||'–'}</span></div>
    <div style="font-size:11px;color:var(--t2)">🌐 Platforms: <span style="color:var(--accent2);font-weight:600">${(anl.platforms||[]).join(', ')||'–'}</span></div>
  </div>
</div>` : `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;color:var(--t3);font-size:11px;margin-bottom:10px">Analytics chưa có dữ liệu — mở Analytics và import data</div>`}

${br ? `
<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px">🎨 Memory từ Brand Clone</div>
<div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:10px">
  <div style="font-size:12px;color:var(--t1);font-weight:600">${br.name}</div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
    <div style="font-size:11px;color:var(--t3)">Confidence: <span style="color:${SCORE_COLOR(br.confidence*100)};font-weight:700">${Math.round(br.confidence*100)}%</span></div>
    <div style="font-size:11px;color:var(--t3)">Hook: <span style="color:var(--t2)">${br.dominantHook||'–'}</span></div>
    <div style="font-size:11px;color:var(--t3)">Subtitle: <span style="color:var(--t2)">${br.topSubtitle||'–'}</span></div>
  </div>
</div>` : ''}

<div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px">⚙ Agent Goals</div>
${_state.goals.map(g=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--accent)">→</span><span style="font-size:11.5px;color:var(--t2)">${g}</span></div>`).join('')}`;
}

function _tabRecommendations() {
  const mem  = _state.memory;
  if (!mem || !mem.timestamp) return _notRun();
  const recs = _buildRecommendations(mem, detectOpportunities(mem));
  if (!recs.length) return `<div style="color:var(--t3);font-size:11px;text-align:center;padding:20px">Chạy Agent để nhận gợi ý</div>`;
  return recs.map(r=>`
<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:7px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">
  <span style="font-size:18px;flex-shrink:0">${_esc(r.icon)}</span>
  <div>
    <div style="font-size:11.5px;color:var(--t1);line-height:1.4">${_esc(r.text)}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:3px;text-transform:uppercase">${_esc(r.type)}</div>
  </div>
</div>`).join('');
}

function _tabTasks() {
  const pending   = _tasks.filter(t => t.status === 'pending');
  const inProg    = _tasks.filter(t => t.status === 'in_progress');
  const done      = _tasks.filter(t => t.status === 'done').slice(0, 3);

  return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
  <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px">Tasks (${pending.length + inProg.length} active)</div>
  <button onclick="ContentAgent._openAddTask()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--t2);padding:3px 8px;font-size:10px;cursor:pointer">+ Thêm</button>
</div>
${!pending.length && !inProg.length ? `<div style="color:var(--t3);font-size:11px;text-align:center;padding:16px">Không có task — chạy Agent để tự động tạo</div>` : ''}
${[...inProg, ...pending].map(t=>`
<div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ${PRIORITY_COLORS[t.priority]||'#888'};border-radius:6px;padding:9px 11px;margin-bottom:7px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
    <div style="flex:1">
      <div style="font-size:12px;color:var(--t1);line-height:1.3">${_esc(t.title)}</div>
      ${t.reason ? `<div style="font-size:10px;color:var(--t3);margin-top:3px">${_esc(t.reason)}</div>` : ''}
    </div>
    <div style="display:flex;gap:4px;flex-shrink:0">
      <button onclick="ContentAgent._taskStatus('${_esc(t.id)}','done')" style="background:rgba(39,174,96,.2);border:1px solid #27ae60;border-radius:4px;color:#27ae60;padding:2px 6px;font-size:9px;cursor:pointer">✓ Done</button>
      <button onclick="ContentAgent._taskStatus('${_esc(t.id)}','dismissed')" style="background:none;border:1px solid var(--border2);border-radius:4px;color:var(--t3);padding:2px 6px;font-size:9px;cursor:pointer">✕</button>
    </div>
  </div>
  <div style="margin-top:6px;display:flex;gap:6px">
    <span style="font-size:9px;background:${PRIORITY_COLORS[t.priority]||'#888'}22;color:${PRIORITY_COLORS[t.priority]||'#888'};padding:1px 6px;border-radius:10px;text-transform:uppercase">${_esc(t.priority)}</span>
    <span style="font-size:9px;color:var(--t3)">${_esc(t.type)}</span>
  </div>
</div>`).join('')}
${done.length ? `<div style="font-size:10px;color:var(--t3);margin:10px 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">✅ Hoàn thành</div>
${done.map(t=>`<div style="padding:6px 10px;background:var(--bg2);border-radius:5px;margin-bottom:4px;font-size:11px;color:var(--t3);text-decoration:line-through">${_esc(t.title)}</div>`).join('')}` : ''}`;
}

function _tabOpportunities() {
  const mem  = _state.memory;
  if (!mem || !mem.timestamp) return _notRun();
  const opps = detectOpportunities(mem);
  return opps.map((opp,oi) => `
<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:7px;padding:10px 12px;margin-bottom:8px">
  <div style="display:flex;align-items:flex-start;gap:9px">
    <span style="font-size:20px;flex-shrink:0">${_esc(opp.icon)}</span>
    <div style="flex:1">
      <div style="font-size:12px;color:var(--t1);font-weight:600">${_esc(opp.title)}</div>
      <div style="font-size:11px;color:var(--t3);margin-top:2px;line-height:1.35">${_esc(opp.reason)}</div>
      <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:#27ae60;font-weight:600">${_esc(opp.expectedGain)}</span>
        <span style="font-size:9px;background:${PRIORITY_COLORS[opp.priority]||'#888'}22;color:${PRIORITY_COLORS[opp.priority]||'#888'};padding:2px 7px;border-radius:10px;text-transform:uppercase">${_esc(opp.priority)}</span>
      </div>
    </div>
  </div>
  <button onclick="ContentAgent._oppToTask_idx(${oi})" style="width:100%;margin-top:8px;padding:5px;background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--t2);font-size:11px;cursor:pointer">→ Tạo Task</button>
</div>`).join('');
}

function _tabIdeas() {
  if (!_ideas.length) return `<div style="text-align:center;padding:24px 10px">
    <div style="font-size:28px;margin-bottom:8px">🧠</div>
    <div style="color:var(--t2);font-size:12px;margin-bottom:12px">Chưa có ý tưởng — chạy Agent để tạo</div>
    <button onclick="ContentAgent._runAgent()" style="background:var(--accent);border:none;border-radius:7px;color:#000;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer">▶ Chạy Agent</button>
  </div>`;

  return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
  <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px">${_ideas.length} Ý tưởng</div>
  <button onclick="ContentAgent._refreshIdeas()" style="background:var(--bg3);border:1px solid var(--border2);border-radius:5px;color:var(--t2);padding:3px 8px;font-size:10px;cursor:pointer">↻ Làm mới</button>
</div>
${_ideas.map((idea, i) => `
<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px">
  <div style="display:flex;align-items:flex-start;gap:8px">
    <div style="flex:1">
      <div style="font-size:12px;color:var(--t1);font-weight:600;line-height:1.35">${idea.title}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
        <span style="font-size:9px;background:${PLAT_COLORS[idea.platform]||'#888'}22;color:${PLAT_COLORS[idea.platform]||'#888'};padding:2px 7px;border-radius:10px">${PLAT_ICONS[idea.platform]} ${idea.platform}</span>
        <span style="font-size:9px;background:var(--bg3);color:var(--t3);padding:2px 7px;border-radius:10px">${idea.format}</span>
        <span style="font-size:9px;background:var(--bg3);color:var(--t3);padding:2px 7px;border-radius:10px">hook: ${idea.hook}</span>
        <span style="font-size:9px;background:var(--bg3);color:var(--t3);padding:2px 7px;border-radius:10px">CTA: ${idea.ctaType}</span>
      </div>
    </div>
    <div style="text-align:center;flex-shrink:0">${_scoreRing(idea.simulation.viralScore, 42)}</div>
  </div>
  <div style="display:flex;gap:10px;margin-top:8px;font-size:10px;color:var(--t3)">
    <span>CTR ~${idea.simulation.ctrPercent}%</span>
    <span>Retention ~${idea.simulation.retention}%</span>
    <span style="margin-left:auto;color:var(--t2)">Subtitle: ${idea.subtitleStyle}</span>
  </div>
  <div style="display:flex;gap:6px;margin-top:8px">
    <button onclick="ContentAgent._approveIdea('${idea.id}')" style="flex:1;padding:5px;background:rgba(39,174,96,.15);border:1px solid #27ae60;border-radius:5px;color:#27ae60;font-size:10px;cursor:pointer">✓ Dùng ý tưởng</button>
    <button onclick="ContentAgent._rejectIdea('${idea.id}')" style="padding:5px 8px;background:none;border:1px solid var(--border2);border-radius:5px;color:var(--t3);font-size:10px;cursor:pointer">✕</button>
  </div>
</div>`).join('')}`;
}

function _tabCalendar() {
  const DAYS_OPTIONS = [7, 30, 90];
  const active = ContentAgent._calDays || 7;
  const cal = _calendar[`${active}d`];

  return `
<div style="display:flex;gap:6px;margin-bottom:12px">
  ${DAYS_OPTIONS.map(d=>`<button onclick="ContentAgent._genCal(${d})" style="flex:1;padding:6px;background:${active===d?'var(--accent)':'var(--bg3)'};color:${active===d?'#000':'var(--t2)'};border:1px solid var(--border2);border-radius:6px;font-size:11px;cursor:pointer">${d} ngày</button>`).join('')}
</div>
${!cal ? `<div style="text-align:center;padding:20px">
  <div style="color:var(--t3);font-size:11px;margin-bottom:10px">Chưa tạo lịch ${active} ngày</div>
  <button onclick="ContentAgent._genCal(${active})" style="background:var(--accent);border:none;border-radius:7px;color:#000;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer">📅 Tạo lịch</button>
</div>` : `
<div style="font-size:10px;color:var(--t3);margin-bottom:8px">Tạo lúc ${_relTime(cal.generatedAt)} · ${cal.plan.reduce((s,d)=>s+d.posts.length,0)} bài đăng</div>
${cal.plan.map(day => `
<div style="margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
    <div style="font-size:11px;font-weight:700;color:var(--t2);width:28px;text-align:center;background:var(--bg3);border-radius:4px;padding:2px">${day.dayName}</div>
    <div style="font-size:10px;color:var(--t3)">${day.date}</div>
  </div>
  ${day.posts.length ? day.posts.map(post=>`
  <div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ${PLAT_COLORS[post.platform]||'#888'};border-radius:5px;padding:7px 10px;margin-bottom:4px;display:flex;align-items:center;gap:8px">
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${post.title}</div>
      <div style="font-size:9px;color:var(--t3);margin-top:2px">${PLAT_ICONS[post.platform]} ${post.platform} · ${post.time} · ${post.format}</div>
    </div>
    ${_scoreRing(post.viralScore, 32)}
  </div>`).join('') : `<div style="font-size:10px;color:var(--t3);padding:5px 10px;font-style:italic">Nghỉ đăng</div>`}
</div>`).join('')}`}`;
}

function _notRun() {
  return `<div style="text-align:center;padding:30px 10px">
    <div style="font-size:36px;margin-bottom:10px">🤖</div>
    <div style="color:var(--t2);font-size:13px;margin-bottom:6px">Agent chưa chạy</div>
    <div style="color:var(--t3);font-size:11px;margin-bottom:14px">Nhấn "Chạy Agent" để phân tích toàn bộ dữ liệu</div>
    <button onclick="ContentAgent._runAgent()" style="background:var(--accent);border:none;border-radius:8px;color:#000;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer">▶ Chạy Agent</button>
  </div>`;
}

function _chip(icon, val, label) {
  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:9px;text-align:center">
    <div style="font-size:16px">${icon}</div>
    <div style="font-size:14px;font-weight:700;color:var(--t1);margin:2px 0">${val}</div>
    <div style="font-size:9.5px;color:var(--t3)">${label}</div>
  </div>`;
}

function _relTime(iso) {
  if (!iso) return '–';
  const diff = Math.round((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return diff + 's trước';
  if (diff < 3600) return Math.round(diff/60) + 'm trước';
  if (diff < 86400)return Math.round(diff/3600) + 'h trước';
  return Math.round(diff/86400) + ' ngày trước';
}

/* ── Internal UI callbacks ── */

function _runAgent() {
  run();
  renderDashboard();
  if (typeof toast === 'function') toast('🤖 Agent đã chạy xong — xem Insights & Gợi ý');
}

function _tab(name) {
  ContentAgent._activeTab = name;
  renderDashboard();
}

function _genCal(days) {
  ContentAgent._calDays = days;
  const mem = buildMemory();
  generateCalendar(days, mem);
  renderDashboard();
  if (typeof toast === 'function') toast(`📅 Đã tạo lịch ${days} ngày`);
}

function _refreshIdeas() {
  const mem = buildMemory();
  generateIdeas(mem, 10);
  renderDashboard();
  if (typeof toast === 'function') toast('🧠 Đã làm mới ý tưởng');
}

function _approveIdea(id) {
  const idea = _ideas.find(i => i.id === id);
  if (!idea) return;
  idea.status = 'approved';
  _persist();
  createTask(`[IDEA] ${idea.title}`, 'medium', `Platform: ${idea.platform} · Hook: ${idea.hook} · Viral ~${idea.simulation.viralScore}`, 'idea');
  renderDashboard();
  if (typeof toast === 'function') toast('✅ Đã tạo task từ ý tưởng');
}

function _rejectIdea(id) {
  _ideas = _ideas.filter(i => i.id !== id);
  _persist();
  renderDashboard();
}

function _taskStatus(id, status) {
  updateTask(id, { status });
  renderDashboard();
}

function _oppToTask(type, title, priority, reason) {
  createTask(`[${type.toUpperCase()}] ${title}`, priority, reason, type);
  ContentAgent._tab('tasks');
  if (typeof toast === 'function') toast('✅ Đã tạo task từ cơ hội');
}

/* Index-based version — avoids string interpolation of user-controllable data into onclick */
function _oppToTask_idx(idx) {
  const mem  = _state.memory;
  if (!mem || !mem.timestamp) return;
  const opps = detectOpportunities(mem);
  const opp  = opps[idx];
  if (!opp) return;
  _oppToTask(opp.type, opp.title, opp.priority, opp.reason);
}

function _openAddTask() {
  const modal = document.createElement('div');
  modal.id = 'ag-task-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
<div style="background:var(--bg1);border:1px solid var(--border2);border-radius:12px;padding:22px;width:380px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;color:var(--t1)">+ Tạo Task Mới</div>
    <button onclick="document.getElementById('ag-task-modal').remove()" style="background:none;border:none;color:var(--t3);font-size:18px;cursor:pointer">×</button>
  </div>
  <div style="margin-bottom:9px"><label style="font-size:10px;color:var(--t3);display:block;margin-bottom:3px">Tiêu đề</label>
    <input id="ag-task-title" type="text" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--t1);font-size:12px;padding:6px 8px" placeholder="Mô tả task...">
  </div>
  <div style="margin-bottom:9px"><label style="font-size:10px;color:var(--t3);display:block;margin-bottom:3px">Độ ưu tiên</label>
    <select id="ag-task-priority" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--t1);font-size:12px;padding:6px 8px">
      <option value="critical">🔴 Critical</option><option value="high">🟠 High</option><option value="medium" selected>🟡 Medium</option><option value="low">🟢 Low</option>
    </select>
  </div>
  <div style="margin-bottom:14px"><label style="font-size:10px;color:var(--t3);display:block;margin-bottom:3px">Lý do</label>
    <input id="ag-task-reason" type="text" style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--t1);font-size:12px;padding:6px 8px" placeholder="Tại sao cần làm?">
  </div>
  <button onclick="ContentAgent._doAddTask()" style="width:100%;padding:9px;background:var(--accent);border:none;border-radius:7px;color:#000;font-weight:700;font-size:13px;cursor:pointer">Tạo Task</button>
</div>`;
  document.body.appendChild(modal);
}

function _doAddTask() {
  const t = (document.getElementById('ag-task-title')||{}).value || '';
  const p = (document.getElementById('ag-task-priority')||{}).value || 'medium';
  const r = (document.getElementById('ag-task-reason')||{}).value || '';
  if (!t) return;
  createTask(t, p, r, 'manual');
  const m = document.getElementById('ag-task-modal'); if(m) m.remove();
  ContentAgent._tab('tasks');
  if (typeof toast === 'function') toast('✅ Task đã được tạo');
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

/* ── CCLogger integration — log agent lifecycle events ── */
function _logInfo(msg, data)  { if (window.CCLogger) CCLogger.info ('ContentAgent', msg, data); }
function _logWarn(msg, data)  { if (window.CCLogger) CCLogger.warn ('ContentAgent', msg, data); }
function _logError(msg, data) { if (window.CCLogger) CCLogger.error('ContentAgent', msg, data); }

window.ContentAgent = {
  /* state */
  _activeTab: 'insights',
  _calDays:   7,

  /* core */
  run, buildMemory, detectOpportunities, generateIdeas, generateCalendar,
  createTask, updateTask,

  /* action engine handlers */
  actGenerateContentPlan, actAnalyzeStrategy, actGenerateIdeas, actCreateTask,

  /* ui */
  renderDashboard,

  /* internal ui (called from inline html) */
  _runAgent, _tab, _genCal, _refreshIdeas,
  _approveIdea, _rejectIdea, _taskStatus, _oppToTask, _oppToTask_idx,
  _openAddTask, _doAddTask,
};

console.log('[ContentAgent] Phase 5.0 Autonomous Content Agent loaded');

})();
