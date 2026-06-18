/* ============================================================
   AI PUBLISHING SYSTEM — js/publishing.js
   Phase 4.1: Multi-platform Publishing Manager

   Storage keys:
     cc_publish_packages  — content packages array
     cc_publish_schedules — schedule queue
     cc_publish_settings  — platform prefs

   Public API: window.PublishingManager
   ============================================================ */

(function () {

const KEY_PACKAGES  = 'cc_publish_packages';
const KEY_SCHEDULES = 'cc_publish_schedules';
const KEY_SETTINGS  = 'cc_publish_settings';

/* ══════════════════════════════════════════════════════════
   1. PLATFORM PROFILES
   ══════════════════════════════════════════════════════════ */

const PLATFORM_PROFILES = {
  youtube: {
    id: 'youtube', label: 'YouTube', icon: '▶',
    color: '#ff0000', colorDim: 'rgba(255,0,0,.12)',
    maxTitleLength: 100, maxDescriptionLength: 5000,
    recommendedAspectRatio: '16:9', hashtagLimit: 15,
    tips: ['Tiêu đề SEO dài 60-70 ký tự', 'Mô tả chứa từ khóa trong 2 dòng đầu', 'Dùng 3-5 hashtag liên quan'],
  },
  tiktok: {
    id: 'tiktok', label: 'TikTok', icon: '♪',
    color: '#00f2ea', colorDim: 'rgba(0,242,234,.12)',
    maxTitleLength: 150, maxDescriptionLength: 2200,
    recommendedAspectRatio: '9:16', hashtagLimit: 30,
    tips: ['Hook mạnh trong 3 giây đầu', 'Caption ngắn dưới 150 ký tự', 'Trending hashtag + niche hashtag'],
  },
  instagram: {
    id: 'instagram', label: 'Instagram Reels', icon: '◉',
    color: '#e1306c', colorDim: 'rgba(225,48,108,.12)',
    maxTitleLength: 2200, maxDescriptionLength: 2200,
    recommendedAspectRatio: '9:16', hashtagLimit: 30,
    tips: ['Cover frame hấp dẫn', 'Dùng đến 30 hashtag để tăng reach', 'Caption có CTA rõ ràng'],
  },
  facebook: {
    id: 'facebook', label: 'Facebook Reels', icon: 'f',
    color: '#1877f2', colorDim: 'rgba(24,119,242,.12)',
    maxTitleLength: 500, maxDescriptionLength: 63206,
    recommendedAspectRatio: '9:16', hashtagLimit: 30,
    tips: ['Tiêu đề rõ ràng, hấp dẫn', 'Nhắm đến cộng đồng/group', 'Thời gian đăng 12h-14h hoặc 20h-22h'],
  },
  linkedin: {
    id: 'linkedin', label: 'LinkedIn', icon: 'in',
    color: '#0a66c2', colorDim: 'rgba(10,102,194,.12)',
    maxTitleLength: 200, maxDescriptionLength: 3000,
    recommendedAspectRatio: '16:9', hashtagLimit: 5,
    tips: ['Nội dung chuyên nghiệp, có giá trị học thuật', 'Tối đa 3-5 hashtag', 'Đăng 8h-10h sáng các ngày thứ 3, 4, 5'],
  },
  x: {
    id: 'x', label: 'X (Twitter)', icon: '✕',
    color: '#ffffff', colorDim: 'rgba(255,255,255,.08)',
    maxTitleLength: 0, maxDescriptionLength: 280,
    recommendedAspectRatio: '16:9', hashtagLimit: 10,
    tips: ['Chỉ 280 ký tự kể cả link', 'Hook ngay câu đầu', '1-2 hashtag trending tối đa'],
  },
};

/* ══════════════════════════════════════════════════════════
   2. SCHEMA & STATE
   ══════════════════════════════════════════════════════════ */

function _blankPackage(override) {
  return Object.assign({
    id:          'pkg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    projectId:   '',
    platform:    'youtube',
    title:       '',
    description: '',
    hashtags:    [],
    thumbnail:   '',
    video:       '',
    status:      'draft',          // draft | review | approved | scheduled | published | failed
    schedule:    null,             // { publishAt: ISO, platform }
    validation:  null,             // { passed, warnings[] }
    optimized:   false,
    aiOptimized: {},               // per-platform optimized copy
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  }, override || {});
}

function _blankSchedule(override) {
  return Object.assign({
    id:        'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    contentId: '',
    publishAt: '',
    platform:  '',
    status:    'pending',   // pending | done | failed | cancelled
  }, override || {});
}

function _load(key, def) {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch(e) {}
  return def;
}
function _save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

let _packages  = _load(KEY_PACKAGES,  []);
let _schedules = _load(KEY_SCHEDULES, []);
let _settings  = _load(KEY_SETTINGS,  { defaultPlatforms: ['youtube','tiktok'] });
let _activeTab = 'queue';

function _persist() {
  _save(KEY_PACKAGES,  _packages);
  _save(KEY_SCHEDULES, _schedules);
  _save(KEY_SETTINGS,  _settings);
}

/* ══════════════════════════════════════════════════════════
   3. CRUD — CONTENT PACKAGES
   ══════════════════════════════════════════════════════════ */

function createPackage(data) {
  const pkg = _blankPackage(data);
  _packages.push(pkg);
  _persist();
  return pkg;
}

function updatePackage(id, patch) {
  const idx = _packages.findIndex(p => p.id === id);
  if (idx < 0) return null;
  Object.assign(_packages[idx], patch, { updatedAt: new Date().toISOString() });
  _persist();
  return _packages[idx];
}

function deletePackage(id) {
  _packages = _packages.filter(p => p.id !== id);
  _schedules = _schedules.filter(s => s.contentId !== id);
  _persist();
}

function getPackages(platform) {
  return platform ? _packages.filter(p => p.platform === platform) : _packages.slice();
}

function getPackage(id) {
  return _packages.find(p => p.id === id) || null;
}

/* ══════════════════════════════════════════════════════════
   4. CONTENT VALIDATOR
   ══════════════════════════════════════════════════════════ */

function validatePackage(id) {
  const pkg = getPackage(id);
  if (!pkg) return { passed: false, warnings: ['Package not found'] };
  const profile = PLATFORM_PROFILES[pkg.platform];
  const warnings = [];

  // Title length
  if (!pkg.title || pkg.title.trim().length === 0) {
    warnings.push({ level: 'error', field: 'title', msg: 'Thiếu tiêu đề' });
  } else if (profile.maxTitleLength > 0 && pkg.title.length > profile.maxTitleLength) {
    warnings.push({ level: 'error', field: 'title', msg: `Tiêu đề quá dài (${pkg.title.length}/${profile.maxTitleLength} ký tự)` });
  } else if (profile.maxTitleLength > 0 && pkg.title.length < 20) {
    warnings.push({ level: 'warn', field: 'title', msg: 'Tiêu đề quá ngắn — khuyến nghị ≥20 ký tự' });
  }

  // Description
  if (!pkg.description || pkg.description.trim().length === 0) {
    warnings.push({ level: 'warn', field: 'description', msg: 'Thiếu mô tả nội dung' });
  } else if (pkg.description.length > profile.maxDescriptionLength) {
    warnings.push({ level: 'error', field: 'description', msg: `Mô tả quá dài (${pkg.description.length}/${profile.maxDescriptionLength})` });
  }

  // Hashtags
  if (pkg.hashtags.length === 0) {
    warnings.push({ level: 'warn', field: 'hashtags', msg: 'Chưa có hashtag — khuyến nghị thêm để tăng reach' });
  } else if (pkg.hashtags.length > profile.hashtagLimit) {
    warnings.push({ level: 'error', field: 'hashtags', msg: `Quá nhiều hashtag (${pkg.hashtags.length}/${profile.hashtagLimit})` });
  }

  // Thumbnail
  if (!pkg.thumbnail) {
    warnings.push({ level: 'warn', field: 'thumbnail', msg: 'Thiếu thumbnail — ảnh bìa tăng CTR đáng kể' });
  }

  // CTA in description
  const ctaKeywords = ['follow', 'subscribe', 'like', 'comment', 'share', 'theo dõi', 'đăng ký', 'thích', 'bình luận'];
  const hasCtaInDesc = ctaKeywords.some(kw => (pkg.description || '').toLowerCase().includes(kw));
  if (!hasCtaInDesc) {
    warnings.push({ level: 'info', field: 'description', msg: 'Không tìm thấy CTA trong mô tả — khuyến nghị thêm lời kêu gọi' });
  }

  // Aspect ratio
  const ratioMap = { 'youtube': '16:9', 'linkedin': '16:9', 'tiktok': '9:16', 'instagram': '9:16', 'facebook': '9:16', 'x': '16:9' };
  const expectedRatio = ratioMap[pkg.platform];
  // We surface this as info since we can't verify the actual video ratio from metadata
  if (expectedRatio) {
    warnings.push({ level: 'info', field: 'video', msg: `Tỷ lệ khuyến nghị cho ${profile.label}: ${expectedRatio}` });
  }

  const errors = warnings.filter(w => w.level === 'error');
  const result = { passed: errors.length === 0, warnings };
  updatePackage(id, { validation: result, status: errors.length === 0 ? (pkg.status === 'draft' ? 'draft' : pkg.status) : 'draft' });
  return result;
}

function bulkValidate(ids) {
  const list = ids || _packages.map(p => p.id);
  return list.map(id => ({ id, result: validatePackage(id) }));
}

/* ══════════════════════════════════════════════════════════
   5. AI PLATFORM OPTIMIZER
   ══════════════════════════════════════════════════════════ */

const OPTIMIZER_RULES = {
  youtube: {
    titlePrefix: '',
    titleSuffix: '',
    descTemplate: (t, d, ht) =>
      `${d}\n\n🔔 Đăng ký kênh để không bỏ lỡ video mới!\n\n${ht.slice(0,15).map(h=>'#'+h.replace('#','')).join(' ')}`,
    hashtagCount: 10,
    optimize: (pkg) => ({
      title: pkg.title.length > 60
        ? pkg.title.slice(0, 57) + '...'
        : (pkg.title + (pkg.title.length < 40 ? ' | Xem ngay!' : '')),
      description: `📌 ${pkg.description}\n\n━━━━━━━━━━━━━━━━━━━\n🔔 Subscribe để nhận video mới!\n👍 Like nếu video hữu ích!\n💬 Comment câu hỏi bên dưới!\n━━━━━━━━━━━━━━━━━━━\n\n${pkg.hashtags.slice(0,15).map(h=>'#'+h.replace(/^#/,'')).join(' ')}`,
      hashtags: pkg.hashtags.slice(0, 15),
    }),
  },
  tiktok: {
    optimize: (pkg) => ({
      title: pkg.title.length > 100
        ? pkg.title.slice(0, 97) + '...'
        : pkg.title,
      description: (() => {
        const shortDesc = pkg.description.slice(0, 120);
        const tags = pkg.hashtags.slice(0, 8).map(h => '#' + h.replace(/^#/, '')).join(' ');
        return `${shortDesc} ${tags} #fyp #foryou`;
      })(),
      hashtags: [...pkg.hashtags.slice(0, 6), 'fyp', 'foryou', 'viral', 'trending'],
    }),
  },
  instagram: {
    optimize: (pkg) => ({
      title: pkg.title,
      description: `${pkg.description}\n\n.\n.\n.\n${pkg.hashtags.map(h => '#' + h.replace(/^#/, '')).join(' ')}\n\n📍 Follow để xem thêm!`,
      hashtags: pkg.hashtags.slice(0, 30),
    }),
  },
  facebook: {
    optimize: (pkg) => ({
      title: pkg.title,
      description: `${pkg.description}\n\n👋 ${pkg.hashtags.slice(0,5).map(h=>'#'+h.replace(/^#/,'')).join(' ')}\n\nShare nếu bạn thấy hay nhé! 🙏`,
      hashtags: pkg.hashtags.slice(0, 10),
    }),
  },
  linkedin: {
    optimize: (pkg) => ({
      title: pkg.title.slice(0, 200),
      description: `${pkg.description}\n\n━━━━━━━━\nTheo dõi để cập nhật nội dung chuyên môn.\n\n${pkg.hashtags.slice(0,5).map(h=>'#'+h.replace(/^#/,'')).join(' ')}`,
      hashtags: pkg.hashtags.slice(0, 5),
    }),
  },
  x: {
    optimize: (pkg) => {
      const tags = pkg.hashtags.slice(0, 2).map(h => '#' + h.replace(/^#/, '')).join(' ');
      const raw = `${pkg.title} ${tags}`;
      return {
        title: '',
        description: raw.length > 280 ? raw.slice(0, 277) + '...' : raw,
        hashtags: pkg.hashtags.slice(0, 2),
      };
    },
  },
};

function optimizeForPlatform(id) {
  const pkg = getPackage(id);
  if (!pkg) return null;
  const rules = OPTIMIZER_RULES[pkg.platform];
  if (!rules) return pkg;
  const optimized = rules.optimize(pkg);
  updatePackage(id, { aiOptimized: optimized, optimized: true });
  return optimized;
}

function optimizeAll() {
  return _packages.map(pkg => ({ id: pkg.id, result: optimizeForPlatform(pkg.id) }));
}

/* ══════════════════════════════════════════════════════════
   6. APPROVAL WORKFLOW
   ══════════════════════════════════════════════════════════ */

const STATUS_FLOW = ['draft', 'review', 'approved', 'scheduled', 'published', 'failed'];

function advanceStatus(id) {
  const pkg = getPackage(id);
  if (!pkg) return null;
  const idx = STATUS_FLOW.indexOf(pkg.status);
  if (idx < 0 || idx >= STATUS_FLOW.length - 2) return pkg;
  const next = STATUS_FLOW[idx + 1];
  return updatePackage(id, { status: next });
}

function setStatus(id, status) {
  if (!STATUS_FLOW.includes(status)) return null;
  return updatePackage(id, { status });
}

function submitForReview(id) { return setStatus(id, 'review'); }
function approve(id)         { return setStatus(id, 'approved'); }
function reject(id)          { return setStatus(id, 'draft'); }
function markPublished(id)   { return setStatus(id, 'published'); }

/* ══════════════════════════════════════════════════════════
   7. SCHEDULE SYSTEM
   ══════════════════════════════════════════════════════════ */

function scheduleContent(contentId, publishAt, platform) {
  const pkg = getPackage(contentId);
  if (!pkg) return null;
  const sch = _blankSchedule({ contentId, publishAt, platform: platform || pkg.platform });
  _schedules.push(sch);
  updatePackage(contentId, { status: 'scheduled', schedule: { publishAt, platform: sch.platform } });
  _persist();
  if (typeof toast === 'function') {
    const dt = new Date(publishAt);
    toast(`📅 Đã lên lịch đăng "${pkg.title.slice(0,30)}" lúc ${dt.toLocaleString('vi-VN')}`);
  }
  return sch;
}

function cancelSchedule(schId) {
  const sch = _schedules.find(s => s.id === schId);
  if (sch) {
    sch.status = 'cancelled';
    updatePackage(sch.contentId, { status: 'approved', schedule: null });
    _persist();
  }
}

function getSchedules(platform) {
  return platform ? _schedules.filter(s => s.platform === platform && s.status === 'pending') : _schedules.slice();
}

function bulkSchedule(ids, publishAt) {
  return ids.map(id => scheduleContent(id, publishAt, getPackage(id)?.platform));
}

/* ══════════════════════════════════════════════════════════
   8. EXPORT PACKAGE (ZIP structure as JSON manifest)
   ══════════════════════════════════════════════════════════ */

function buildExportManifest(ids) {
  const list = (ids || _packages.map(p => p.id))
    .map(id => getPackage(id))
    .filter(Boolean);

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalPackages: list.length,
    structure: {},
  };

  for (const plat of Object.keys(PLATFORM_PROFILES)) {
    const pkgs = list.filter(p => p.platform === plat);
    if (!pkgs.length) continue;
    manifest.structure[plat] = pkgs.map(pkg => {
      const optimized = pkg.optimized ? pkg.aiOptimized : {};
      return {
        folder: `/${plat}/${pkg.id}`,
        files: {
          'video.mp4': pkg.video || '(from export engine)',
          'thumbnail.jpg': pkg.thumbnail || '(manually add)',
          'metadata.json': {
            title:       optimized.title       || pkg.title,
            description: optimized.description || pkg.description,
            hashtags:    optimized.hashtags    || pkg.hashtags,
            platform:    plat,
            status:      pkg.status,
            schedule:    pkg.schedule,
            validation:  pkg.validation,
          },
        },
      };
    });
  }
  return manifest;
}

function downloadManifestJSON(ids) {
  const manifest = buildExportManifest(ids);
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `publish_package_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (typeof toast === 'function') toast('📦 Đã xuất Export Package JSON');
}

/* ══════════════════════════════════════════════════════════
   9. QUICK CREATE FROM EDITOR
   ══════════════════════════════════════════════════════════ */

function createFromEditor(platforms) {
  const plats = platforms || _settings.defaultPlatforms;
  const projectName = (typeof document !== 'undefined'
    ? (document.getElementById('proj-name')?.textContent || 'Video mới')
    : 'Video mới');

  const subtitlesText = (typeof subtitles !== 'undefined' && subtitles.length)
    ? subtitles.slice(0, 5).map(s => s.text).join(' ')
    : '';

  const defaultTitle = projectName.length > 10 ? projectName : 'Video của tôi';
  const defaultDesc  = subtitlesText || 'Xem video để biết thêm chi tiết!';
  const pkgs = [];

  for (const plat of plats) {
    const pkg = createPackage({
      projectId: 'current',
      platform:  plat,
      title:     defaultTitle,
      description: defaultDesc,
      hashtags:  ['viral', 'trending', 'content'],
    });
    pkgs.push(pkg);
  }

  if (typeof toast === 'function') toast(`📝 Đã tạo ${pkgs.length} content package cho ${plats.join(', ')}`);
  return pkgs;
}

/* ══════════════════════════════════════════════════════════
   10. DASHBOARD RENDER
   ══════════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: '#888',    bg: 'rgba(136,136,136,.15)' },
  review:    { label: 'Review',    color: '#f0a500', bg: 'rgba(240,165,0,.15)'   },
  approved:  { label: 'Approved',  color: '#2ecc71', bg: 'rgba(46,204,113,.15)'  },
  scheduled: { label: 'Scheduled', color: '#3498db', bg: 'rgba(52,152,219,.15)'  },
  published: { label: 'Published', color: '#9b59b6', bg: 'rgba(155,89,182,.15)'  },
  failed:    { label: 'Failed',    color: '#e74c3c', bg: 'rgba(231,76,60,.15)'   },
};

function _statusBadge(status) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return `<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;background:${c.bg};color:${c.color};white-space:nowrap">${c.label.toUpperCase()}</span>`;
}

function _tabBtn(id, label, active) {
  return `<div onclick="PublishingManager._tab('${id}')" style="padding:6px 10px;font-size:11px;cursor:pointer;border-bottom:2px solid ${active?'var(--accent)':'transparent'};color:${active?'var(--t1)':'var(--t3)'};margin-bottom:-1px;white-space:nowrap">${label}</div>`;
}

function renderDashboard() {
  const panel = document.getElementById('publish-panel');
  if (!panel) return;

  const counts = {};
  for (const s of Object.keys(STATUS_CONFIG)) counts[s] = _packages.filter(p => p.status === s).length;
  const total = _packages.length;

  panel.innerHTML = `
<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 0;flex-shrink:0">
  <div style="font-size:14px;font-weight:700;color:var(--t1)">📤 Publishing</div>
  <button onclick="PublishingManager._openCreate()" style="background:var(--accent);border:none;border-radius:6px;color:#000;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">+ Tạo</button>
</div>

<!-- Stats row -->
<div style="display:flex;gap:6px;padding:8px 12px;flex-shrink:0;overflow-x:auto">
  ${Object.entries(STATUS_CONFIG).map(([s,c])=>`
    <div style="flex:1;min-width:36px;text-align:center;background:${c.bg};border-radius:7px;padding:5px 4px">
      <div style="font-size:15px;font-weight:700;color:${c.color}">${counts[s]||0}</div>
      <div style="font-size:8px;color:${c.color};font-weight:600">${c.label.slice(0,3).toUpperCase()}</div>
    </div>`).join('')}
</div>

<!-- Tabs -->
<div style="display:flex;border-bottom:1px solid var(--border2);padding:0 8px;flex-shrink:0;gap:2px;overflow-x:auto">
  ${_tabBtn('queue','📋 Queue',_activeTab==='queue')}
  ${_tabBtn('schedule','📅 Lịch',_activeTab==='schedule')}
  ${_tabBtn('platforms','🌐 Platforms',_activeTab==='platforms')}
  ${_tabBtn('bulk','⚡ Bulk',_activeTab==='bulk')}
</div>

<div style="flex:1;overflow-y:auto;padding:10px 12px">
  ${_activeTab==='queue'     ? _renderQueue()     : ''}
  ${_activeTab==='schedule'  ? _renderSchedule()  : ''}
  ${_activeTab==='platforms' ? _renderPlatforms() : ''}
  ${_activeTab==='bulk'      ? _renderBulk()      : ''}
</div>`;
}

function _renderQueue() {
  if (!_packages.length) return `
<div style="text-align:center;padding:28px 12px;color:var(--t3)">
  <div style="font-size:28px;margin-bottom:8px">📭</div>
  <div style="font-size:12px;font-weight:600;color:var(--t2)">Chưa có nội dung</div>
  <div style="font-size:10px;margin:6px 0 14px">Tạo content package từ editor hiện tại</div>
  <button onclick="PublishingManager.createFromEditor()" style="background:var(--accent);border:none;border-radius:7px;color:#000;font-weight:700;font-size:12px;padding:8px 16px;cursor:pointer">🚀 Tạo từ Editor</button>
</div>`;

  return _packages.map(pkg => {
    const prof = PLATFORM_PROFILES[pkg.platform];
    const val  = pkg.validation;
    const errCount = val ? val.warnings.filter(w=>w.level==='error').length : 0;
    const warnCount = val ? val.warnings.filter(w=>w.level==='warn').length : 0;
    const opt  = pkg.optimized ? pkg.aiOptimized : {};

    return `
<div style="border:1px solid var(--border2);border-radius:9px;padding:10px;margin-bottom:8px;background:var(--bg2)">
  <!-- Header row -->
  <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">
    <div style="width:26px;height:26px;border-radius:6px;background:${prof.colorDim};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${prof.color};flex-shrink:0">${prof.icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${prof.label}</div>
      <div style="font-size:9px;color:var(--t3)">${new Date(pkg.createdAt).toLocaleDateString('vi-VN')}</div>
    </div>
    ${_statusBadge(pkg.status)}
  </div>

  <!-- Title -->
  <div style="font-size:11px;color:var(--t1);font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(pkg.title)}">
    ${pkg.title || '<span style="color:var(--t3);font-style:italic">Chưa có tiêu đề</span>'}
  </div>

  <!-- Description preview -->
  <div style="font-size:10px;color:var(--t3);margin-bottom:7px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">
    ${(opt.description || pkg.description || '—').slice(0, 120)}
  </div>

  <!-- Hashtags -->
  ${(pkg.hashtags.length ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:7px">
    ${(opt.hashtags || pkg.hashtags).slice(0,6).map(h=>`<span style="font-size:9px;background:rgba(255,204,0,.1);color:var(--accent2);border-radius:4px;padding:1px 5px">#${h.replace(/^#/,'')}</span>`).join('')}
    ${(opt.hashtags||pkg.hashtags).length > 6 ? `<span style="font-size:9px;color:var(--t3)">+${(opt.hashtags||pkg.hashtags).length-6}</span>` : ''}
  </div>` : '')}

  <!-- Validation badges -->
  ${val ? `<div style="display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap">
    ${errCount > 0 ? `<span style="font-size:9px;background:rgba(231,76,60,.15);color:#e74c3c;border-radius:4px;padding:2px 7px">⛔ ${errCount} lỗi</span>` : ''}
    ${warnCount > 0 ? `<span style="font-size:9px;background:rgba(240,165,0,.15);color:#f0a500;border-radius:4px;padding:2px 7px">⚠ ${warnCount} cảnh báo</span>` : ''}
    ${errCount===0&&warnCount===0 ? `<span style="font-size:9px;background:rgba(46,204,113,.15);color:#2ecc71;border-radius:4px;padding:2px 7px">✅ Hợp lệ</span>` : ''}
    ${pkg.optimized ? `<span style="font-size:9px;background:rgba(155,89,182,.15);color:#9b59b6;border-radius:4px;padding:2px 7px">✨ AI tối ưu</span>` : ''}
  </div>` : ''}

  <!-- Action buttons -->
  <div style="display:flex;gap:4px;flex-wrap:wrap">
    <button onclick="PublishingManager._openEdit('${pkg.id}')" style="${_btnSm('var(--bg3)','var(--t2)')}">✏ Sửa</button>
    <button onclick="PublishingManager._validate('${pkg.id}')" style="${_btnSm('var(--bg3)','var(--t2)')}">✓ Kiểm tra</button>
    <button onclick="PublishingManager._optimize('${pkg.id}')" style="${_btnSm('rgba(155,89,182,.2)','#9b59b6')}">✨ AI Tối ưu</button>
    ${pkg.status==='draft'    ? `<button onclick="PublishingManager._submitReview('${pkg.id}')" style="${_btnSm('rgba(240,165,0,.2)','#f0a500')}">→ Review</button>` : ''}
    ${pkg.status==='review'   ? `<button onclick="PublishingManager._approve('${pkg.id}')" style="${_btnSm('rgba(46,204,113,.2)','#2ecc71')}">✓ Approve</button><button onclick="PublishingManager._reject('${pkg.id}')" style="${_btnSm('rgba(231,76,60,.2)','#e74c3c')}">✗ Reject</button>` : ''}
    ${pkg.status==='approved' ? `<button onclick="PublishingManager._openSchedule('${pkg.id}')" style="${_btnSm('rgba(52,152,219,.2)','#3498db')}">📅 Lên lịch</button>` : ''}
    ${pkg.status==='scheduled'? `<button onclick="PublishingManager._markPublished('${pkg.id}')" style="${_btnSm('rgba(155,89,182,.2)','#9b59b6')}">✓ Published</button>` : ''}
    <button onclick="PublishingManager._delete('${pkg.id}')" style="${_btnSm('rgba(231,76,60,.1)','#e74c3c')}">🗑</button>
  </div>
</div>`;
  }).join('');
}

function _renderSchedule() {
  const pending = _schedules.filter(s => s.status === 'pending');
  if (!pending.length) return `<div style="text-align:center;padding:24px;color:var(--t3);font-size:11px">Chưa có lịch đăng nào.<br>Approve nội dung rồi nhấn "📅 Lên lịch".</div>`;

  return `<div style="display:flex;flex-direction:column;gap:8px">` +
    pending.sort((a,b)=>new Date(a.publishAt)-new Date(b.publishAt)).map(sch => {
      const pkg  = getPackage(sch.contentId);
      const prof = PLATFORM_PROFILES[sch.platform];
      const dt   = new Date(sch.publishAt);
      const isUpcoming = dt > new Date();
      return `
<div style="border:1px solid var(--border2);border-radius:8px;padding:10px;background:var(--bg2)">
  <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
    <div style="font-size:20px">📅</div>
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:var(--t1)">${pkg?.title?.slice(0,40)||'(package đã xóa)'}</div>
      <div style="font-size:9px;color:var(--t3)">${prof?.label||sch.platform}</div>
    </div>
    <span style="font-size:9px;padding:2px 6px;border-radius:8px;background:${isUpcoming?'rgba(52,152,219,.15)':'rgba(46,204,113,.15)'};color:${isUpcoming?'#3498db':'#2ecc71'}">
      ${isUpcoming ? '⏰ Chờ đăng' : '✅ Đến giờ'}
    </span>
  </div>
  <div style="font-size:11px;color:var(--accent2);font-weight:600;margin-bottom:6px">🕐 ${dt.toLocaleString('vi-VN')}</div>
  <button onclick="PublishingManager._cancelSch('${sch.id}')" style="${_btnSm('rgba(231,76,60,.15)','#e74c3c')}">✗ Hủy lịch</button>
</div>`;
    }).join('') + `</div>`;
}

function _renderPlatforms() {
  return `<div style="display:flex;flex-direction:column;gap:8px">` +
    Object.values(PLATFORM_PROFILES).map(prof => {
      const pkgCount = _packages.filter(p=>p.platform===prof.id).length;
      return `
<div style="border:1px solid var(--border2);border-radius:9px;padding:10px;background:var(--bg2)">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
    <div style="width:30px;height:30px;border-radius:8px;background:${prof.colorDim};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:${prof.color};flex-shrink:0">${prof.icon}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--t1)">${prof.label}</div>
      <div style="font-size:9px;color:var(--t3)">${pkgCount} packages · Tỷ lệ: ${prof.recommendedAspectRatio}</div>
    </div>
    <button onclick="PublishingManager.createPackage({platform:'${prof.id}'})" style="${_btnSm(prof.colorDim,prof.color)}">+ Thêm</button>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:7px">
    <div style="text-align:center;flex:1;background:var(--bg3);border-radius:6px;padding:5px">
      <div style="font-size:10px;color:var(--t3)">Title max</div>
      <div style="font-size:11px;font-weight:700;color:var(--t1)">${prof.maxTitleLength||'∞'}</div>
    </div>
    <div style="text-align:center;flex:1;background:var(--bg3);border-radius:6px;padding:5px">
      <div style="font-size:10px;color:var(--t3)">Hashtag</div>
      <div style="font-size:11px;font-weight:700;color:var(--t1)">${prof.hashtagLimit}</div>
    </div>
    <div style="text-align:center;flex:1;background:var(--bg3);border-radius:6px;padding:5px">
      <div style="font-size:10px;color:var(--t3)">Ratio</div>
      <div style="font-size:11px;font-weight:700;color:var(--t1)">${prof.recommendedAspectRatio}</div>
    </div>
  </div>
  <div style="font-size:9px;color:var(--t3)">💡 ${prof.tips[0]}</div>
</div>`;
    }).join('') + `</div>`;
}

function _renderBulk() {
  const selected = _selectedIds;
  return `
<div style="margin-bottom:10px">
  <div style="font-size:11px;font-weight:700;color:var(--t1);margin-bottom:7px">⚡ Bulk Operations</div>
  <div style="font-size:10px;color:var(--t3);margin-bottom:10px">${_packages.length} packages tổng cộng</div>

  <!-- Select all / none -->
  <div style="display:flex;gap:6px;margin-bottom:10px">
    <button onclick="PublishingManager._selectAll()" style="${_btnSm('var(--bg3)','var(--t2)')}">☑ Chọn tất cả</button>
    <button onclick="PublishingManager._selectNone()" style="${_btnSm('var(--bg3)','var(--t2)')}">☐ Bỏ chọn</button>
    <span style="font-size:10px;color:var(--accent2);align-self:center">${selected.size} đang chọn</span>
  </div>

  <!-- Package checklist -->
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
    ${_packages.map(pkg => {
      const prof = PLATFORM_PROFILES[pkg.platform];
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px;background:var(--bg2);border:1px solid ${selected.has(pkg.id)?'var(--accent)':'var(--border2)'};border-radius:7px;cursor:pointer" onclick="PublishingManager._toggleSelect('${pkg.id}')">
        <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${selected.has(pkg.id)?'var(--accent)':'var(--border2)'};background:${selected.has(pkg.id)?'var(--accent)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;flex-shrink:0">${selected.has(pkg.id)?'✓':''}</div>
        <div style="width:18px;height:18px;border-radius:4px;background:${prof.colorDim};display:flex;align-items:center;justify-content:center;font-size:9px;color:${prof.color};flex-shrink:0">${prof.icon}</div>
        <div style="flex:1;min-width:0;font-size:10px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pkg.title||'(chưa có tiêu đề)'}</div>
        ${_statusBadge(pkg.status)}
      </div>`;
    }).join('')}
  </div>

  <!-- Bulk action buttons -->
  <div style="display:flex;flex-direction:column;gap:6px">
    <button onclick="PublishingManager._bulkValidate()" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t2);font-size:11px;font-weight:600;cursor:pointer">✓ Kiểm tra hàng loạt (${selected.size||'tất cả'})</button>
    <button onclick="PublishingManager._bulkOptimize()" style="width:100%;padding:8px;background:rgba(155,89,182,.15);border:1px solid rgba(155,89,182,.3);border-radius:7px;color:#9b59b6;font-size:11px;font-weight:600;cursor:pointer">✨ AI Tối ưu hàng loạt</button>
    <div style="display:flex;gap:6px">
      <input type="datetime-local" id="bulk-schedule-dt" style="flex:1;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--t1);font-size:10px;padding:5px">
      <button onclick="PublishingManager._bulkScheduleSelected()" style="${_btnSm('rgba(52,152,219,.2)','#3498db')}">📅 Lên lịch</button>
    </div>
    <button onclick="PublishingManager._exportPackage()" style="width:100%;padding:8px;background:rgba(46,204,113,.15);border:1px solid rgba(46,204,113,.3);border-radius:7px;color:#2ecc71;font-size:11px;font-weight:600;cursor:pointer">📦 Xuất Export Package JSON</button>
    <button onclick="PublishingManager.createFromEditor()" style="width:100%;padding:8px;background:var(--accentdim);border:1px dashed var(--accent);border-radius:7px;color:var(--accent2);font-size:11px;cursor:pointer">🚀 Tạo packages từ Editor hiện tại</button>
  </div>
</div>`;
}

/* ══════════════════════════════════════════════════════════
   11. MODAL HELPERS
   ══════════════════════════════════════════════════════════ */

function _openCreate() {
  const plats = Object.keys(PLATFORM_PROFILES);
  const html = `
<div id="pm-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9000;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)PublishingManager._closeModal()">
<div style="background:var(--bg1);border:1px solid var(--border);border-radius:12px;width:360px;max-height:85vh;overflow-y:auto;padding:18px">
  <div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:14px">📝 Tạo Content Package</div>

  <div style="font-size:10px;color:var(--t3);margin-bottom:5px">Nền tảng</div>
  <select id="pm-new-plat" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:10px">
    ${plats.map(p=>`<option value="${p}">${PLATFORM_PROFILES[p].label}</option>`).join('')}
  </select>

  <div style="font-size:10px;color:var(--t3);margin-bottom:5px">Tiêu đề</div>
  <input id="pm-new-title" type="text" placeholder="Nhập tiêu đề video..." style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:10px">

  <div style="font-size:10px;color:var(--t3);margin-bottom:5px">Mô tả</div>
  <textarea id="pm-new-desc" rows="3" placeholder="Mô tả nội dung..." style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:10px;resize:vertical"></textarea>

  <div style="font-size:10px;color:var(--t3);margin-bottom:5px">Hashtags (ngăn cách bằng dấu phẩy)</div>
  <input id="pm-new-tags" type="text" placeholder="viral, trending, content" style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:14px">

  <div style="display:flex;gap:8px">
    <button onclick="PublishingManager._doCreate()" style="flex:1;padding:9px;background:var(--accent);border:none;border-radius:8px;color:#000;font-weight:700;font-size:13px;cursor:pointer">Tạo Package</button>
    <button onclick="PublishingManager._closeModal()" style="padding:9px 14px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;color:var(--t2);font-size:12px;cursor:pointer">Hủy</button>
  </div>
</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _doCreate() {
  const plat  = document.getElementById('pm-new-plat')?.value || 'youtube';
  const title = document.getElementById('pm-new-title')?.value?.trim() || '';
  const desc  = document.getElementById('pm-new-desc')?.value?.trim() || '';
  const tags  = (document.getElementById('pm-new-tags')?.value || '').split(',').map(t=>t.trim()).filter(Boolean);
  createPackage({ platform: plat, title, description: desc, hashtags: tags });
  _closeModal();
  _tab('queue');
  renderDashboard();
}

function _openEdit(id) {
  const pkg = getPackage(id);
  if (!pkg) return;
  const prof = PLATFORM_PROFILES[pkg.platform];
  const html = `
<div id="pm-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9000;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)PublishingManager._closeModal()">
<div style="background:var(--bg1);border:1px solid var(--border);border-radius:12px;width:380px;max-height:90vh;overflow-y:auto;padding:18px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
    <div style="width:26px;height:26px;border-radius:6px;background:${prof.colorDim};display:flex;align-items:center;justify-content:center;color:${prof.color};font-weight:900;font-size:12px">${prof.icon}</div>
    <div style="font-size:14px;font-weight:700;color:var(--t1)">Chỉnh sửa — ${prof.label}</div>
  </div>

  <div style="font-size:10px;color:var(--t3);margin-bottom:4px">Tiêu đề ${prof.maxTitleLength?`(tối đa ${prof.maxTitleLength} ký tự)`:''}</div>
  <input id="pm-edit-title" type="text" value="${_esc(pkg.title)}" style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:10px">

  <div style="font-size:10px;color:var(--t3);margin-bottom:4px">Mô tả ${prof.maxDescriptionLength?`(tối đa ${prof.maxDescriptionLength})`:''}
    ${pkg.optimized && pkg.aiOptimized.description ? `<button onclick="document.getElementById('pm-edit-desc').value=${JSON.stringify(pkg.aiOptimized.description)}" style="background:rgba(155,89,182,.2);border:none;border-radius:4px;color:#9b59b6;font-size:9px;padding:1px 6px;cursor:pointer;margin-left:6px">✨ Dùng bản AI</button>` : ''}
  </div>
  <textarea id="pm-edit-desc" rows="4" style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:10px;resize:vertical">${_esc(pkg.description)}</textarea>

  <div style="font-size:10px;color:var(--t3);margin-bottom:4px">Hashtags (dấu phẩy, tối đa ${prof.hashtagLimit})</div>
  <input id="pm-edit-tags" type="text" value="${(pkg.optimized&&pkg.aiOptimized.hashtags||pkg.hashtags).join(', ')}" style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:14px">

  <!-- Tips -->
  <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.2);border-radius:7px;padding:8px;margin-bottom:14px">
    <div style="font-size:9px;font-weight:700;color:var(--accent2);margin-bottom:4px">💡 Tips cho ${prof.label}</div>
    ${prof.tips.map(t=>`<div style="font-size:9px;color:var(--t3);margin-bottom:2px">• ${t}</div>`).join('')}
  </div>

  <div style="display:flex;gap:8px">
    <button onclick="PublishingManager._doEdit('${id}')" style="flex:1;padding:9px;background:var(--accent);border:none;border-radius:8px;color:#000;font-weight:700;font-size:13px;cursor:pointer">Lưu</button>
    <button onclick="PublishingManager._closeModal()" style="padding:9px 14px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;color:var(--t2);font-size:12px;cursor:pointer">Hủy</button>
  </div>
</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _doEdit(id) {
  const title = document.getElementById('pm-edit-title')?.value?.trim() || '';
  const desc  = document.getElementById('pm-edit-desc')?.value?.trim() || '';
  const tags  = (document.getElementById('pm-edit-tags')?.value || '').split(',').map(t=>t.trim()).filter(Boolean);
  updatePackage(id, { title, description: desc, hashtags: tags, optimized: false, aiOptimized: {} });
  _closeModal();
  renderDashboard();
}

function _openSchedule(id) {
  const pkg = getPackage(id);
  if (!pkg) return;
  const prof = PLATFORM_PROFILES[pkg.platform];
  const html = `
<div id="pm-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9000;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)PublishingManager._closeModal()">
<div style="background:var(--bg1);border:1px solid var(--border);border-radius:12px;width:320px;padding:18px">
  <div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:4px">📅 Lên lịch đăng</div>
  <div style="font-size:11px;color:var(--t3);margin-bottom:14px">"${pkg.title.slice(0,40)}" → ${prof.label}</div>

  <div style="font-size:10px;color:var(--t3);margin-bottom:5px">Thời gian đăng</div>
  <input id="pm-sch-dt" type="datetime-local" style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--t1);font-size:12px;padding:7px;margin-bottom:14px">

  <div style="background:rgba(52,152,219,.1);border:1px solid rgba(52,152,219,.25);border-radius:7px;padding:8px;margin-bottom:14px">
    <div style="font-size:9px;color:#3498db">⏰ Khung giờ đăng tốt nhất cho ${prof.label}:</div>
    <div style="font-size:9px;color:var(--t3);margin-top:3px">${prof.tips[prof.tips.length-1]}</div>
  </div>

  <div style="display:flex;gap:8px">
    <button onclick="PublishingManager._doSchedule('${id}')" style="flex:1;padding:9px;background:#3498db;border:none;border-radius:8px;color:#fff;font-weight:700;font-size:13px;cursor:pointer">📅 Lên lịch</button>
    <button onclick="PublishingManager._closeModal()" style="padding:9px 14px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;color:var(--t2);font-size:12px;cursor:pointer">Hủy</button>
  </div>
</div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _doSchedule(id) {
  const dt = document.getElementById('pm-sch-dt')?.value;
  if (!dt) { if (typeof toast === 'function') toast('⚠ Chọn thời gian đăng'); return; }
  scheduleContent(id, new Date(dt).toISOString(), getPackage(id)?.platform);
  _closeModal();
  _tab('schedule');
  renderDashboard();
}

function _closeModal() {
  document.getElementById('pm-modal-overlay')?.remove();
}

/* ══════════════════════════════════════════════════════════
   12. INTERNAL ACTIONS (called from DOM)
   ══════════════════════════════════════════════════════════ */

let _selectedIds = new Set();

function _tab(name) { _activeTab = name; renderDashboard(); }
function _validate(id) {
  const r = validatePackage(id);
  renderDashboard();
  const errs = r.warnings.filter(w=>w.level==='error').length;
  if (typeof toast === 'function') toast(errs ? `⛔ ${errs} lỗi cần sửa` : '✅ Nội dung hợp lệ');
}
function _optimize(id) {
  optimizeForPlatform(id);
  renderDashboard();
  if (typeof toast === 'function') toast('✨ AI đã tối ưu nội dung cho nền tảng');
}
function _submitReview(id) { submitForReview(id); renderDashboard(); if(typeof toast==='function') toast('📨 Đã gửi duyệt'); }
function _approve(id) { approve(id); renderDashboard(); if(typeof toast==='function') toast('✅ Đã approve'); }
function _reject(id) { reject(id); renderDashboard(); if(typeof toast==='function') toast('↩ Đã trả về Draft'); }
function _markPublished(id) { markPublished(id); renderDashboard(); if(typeof toast==='function') toast('🚀 Đã đánh dấu Published'); }
function _cancelSch(id) { cancelSchedule(id); renderDashboard(); }
function _delete(id) {
  if (!confirm('Xóa package này?')) return;
  deletePackage(id); renderDashboard();
  if(typeof toast==='function') toast('🗑 Đã xóa');
}
function _toggleSelect(id) {
  if (_selectedIds.has(id)) _selectedIds.delete(id); else _selectedIds.add(id);
  renderDashboard();
}
function _selectAll()  { _packages.forEach(p=>_selectedIds.add(p.id)); renderDashboard(); }
function _selectNone() { _selectedIds.clear(); renderDashboard(); }
function _bulkValidate() {
  const ids = _selectedIds.size ? [..._selectedIds] : null;
  const results = bulkValidate(ids);
  const errors = results.filter(r=>!r.result.passed).length;
  renderDashboard();
  if(typeof toast==='function') toast(`✓ Kiểm tra ${results.length} packages — ${errors} có lỗi`);
}
function _bulkOptimize() {
  const ids = _selectedIds.size ? [..._selectedIds] : _packages.map(p=>p.id);
  ids.forEach(id=>optimizeForPlatform(id));
  renderDashboard();
  if(typeof toast==='function') toast(`✨ AI đã tối ưu ${ids.length} packages`);
}
function _bulkScheduleSelected() {
  const dt = document.getElementById('bulk-schedule-dt')?.value;
  if (!dt) { if(typeof toast==='function') toast('⚠ Chọn ngày giờ trước'); return; }
  const ids = _selectedIds.size ? [..._selectedIds] : _packages.filter(p=>p.status==='approved').map(p=>p.id);
  if (!ids.length) { if(typeof toast==='function') toast('⚠ Không có package nào đã Approved'); return; }
  bulkSchedule(ids, new Date(dt).toISOString());
  renderDashboard();
}
function _exportPackage() {
  const ids = _selectedIds.size ? [..._selectedIds] : null;
  downloadManifestJSON(ids);
}

/* ── Utility ── */
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _btnSm(bg, color) {
  return `background:${bg};border:1px solid ${color}22;border-radius:5px;color:${color};font-size:9px;font-weight:600;padding:3px 8px;cursor:pointer`;
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.PublishingManager = {
  // CRUD
  createPackage, updatePackage, deletePackage, getPackages, getPackage,
  // Validation
  validatePackage, bulkValidate,
  // Optimization
  optimizeForPlatform, optimizeAll,
  // Workflow
  submitForReview, approve, reject, setStatus, advanceStatus, markPublished,
  // Scheduling
  scheduleContent, cancelSchedule, bulkSchedule, getSchedules,
  // Export
  buildExportManifest, downloadManifestJSON,
  // Quick create
  createFromEditor,
  // Dashboard
  renderDashboard,
  // Platform profiles
  PLATFORM_PROFILES,
  // Internal (DOM)
  _tab, _validate, _optimize, _submitReview, _approve, _reject,
  _markPublished, _cancelSch, _delete, _toggleSelect, _selectAll, _selectNone,
  _bulkValidate, _bulkOptimize, _bulkScheduleSelected, _exportPackage,
  _openCreate, _doCreate, _openEdit, _doEdit, _openSchedule, _doSchedule, _closeModal,
};

console.log('[PublishingManager] Phase 4.1 AI Publishing System loaded');

})();
