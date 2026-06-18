/* ============================================================
   STYLE MEMORY MANAGER — js/memory.js
   Phase 3.0: Personal Editing Memory
   Học phong cách chỉnh sửa của người dùng và tự động gợi ý.

   Storage:
     cc_style_profile  — hồ sơ phong cách chính
     cc_style_snaps    — danh sách style presets
   ============================================================ */

(function () {

const KEY_PROFILE  = 'cc_style_profile';
const KEY_SNAPS    = 'cc_style_snaps';

/* ══════════════════════════════════════════════════════════
   1. SCHEMA & STATE
   ══════════════════════════════════════════════════════════ */

function _defaultProfile() {
  return {
    id: 'user_style',
    profileName: 'My Style',
    subtitleStyle: {
      template:   {},   // { tiktok:5, mrbeast:2, ... }
      animation:  {},   // { fade:3, pop:1, ... }
      topTemplate:  null,
      topAnimation: null,
    },
    exportSettings: {
      quality: {},      // { '1080p':8, '720p':2, ... }
      format:  {},      // { mp4:9, webm:1, ... }
      topQuality: null,
      topFormat:  null,
    },
    favoriteTemplates:    [],
    preferredAspectRatio: null,
    aspectRatioUsage:     {},
    editingPatterns: {
      totalExports:        0,
      totalSaves:          0,
      totalShorts:         0,
      avgProjectDuration:  0,
    },
    confidence: {
      subtitleStyleConfidence: 0,
      exportConfidence:        0,
      templateConfidence:      0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

let _profile   = _loadProfile();
let _snapshots = _loadSnaps();

function _loadProfile() {
  try { const r = localStorage.getItem(KEY_PROFILE); if (r) return JSON.parse(r); } catch(e) {}
  return _defaultProfile();
}
function _loadSnaps() {
  try { const r = localStorage.getItem(KEY_SNAPS); if (r) return JSON.parse(r); } catch(e) {}
  return [];
}

function _persist() {
  _profile.updatedAt = new Date().toISOString();
  _recalcTop();
  _recalcConfidence();
  try { localStorage.setItem(KEY_PROFILE, JSON.stringify(_profile)); } catch(e) {}
}
function _persistSnaps() {
  try { localStorage.setItem(KEY_SNAPS, JSON.stringify(_snapshots)); } catch(e) {}
}

/* ══════════════════════════════════════════════════════════
   2. ANALYTICS HELPERS
   ══════════════════════════════════════════════════════════ */

function _topKey(obj) {
  if (!obj) return null;
  let top = null, max = 0;
  for (const [k, v] of Object.entries(obj)) { if (v > max) { max = v; top = k; } }
  return top;
}

function _recalcTop() {
  const s = _profile.subtitleStyle;
  const e = _profile.exportSettings;
  s.topTemplate  = _topKey(s.template);
  s.topAnimation = _topKey(s.animation);
  e.topQuality   = _topKey(e.quality);
  e.topFormat    = _topKey(e.format);
  _profile.preferredAspectRatio = _topKey(_profile.aspectRatioUsage);
  _profile.favoriteTemplates = Object.entries(s.template)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}

function _recalcConfidence() {
  function score(obj) {
    const vals = Object.values(obj || {});
    const total = vals.reduce((a, b) => a + b, 0);
    if (!total) return 0;
    return Math.round((Math.max(...vals) / total) * 100) / 100;
  }
  const c = _profile.confidence;
  c.subtitleStyleConfidence = score(_profile.subtitleStyle.template);
  c.exportConfidence        = score(_profile.exportSettings.quality);
  c.templateConfidence      = score(_profile.subtitleStyle.animation);
}

function _inc(obj, key) {
  if (!key) return;
  obj[key] = (obj[key] || 0) + 1;
}

/* ══════════════════════════════════════════════════════════
   3. LEARNING API
   ══════════════════════════════════════════════════════════ */

function learnSubtitleTemplate(tpl) {
  if (!tpl) return;
  _inc(_profile.subtitleStyle.template, tpl);
  _persist();
  _renderDashboard();
}

function learnAnimation(anim) {
  if (!anim) return;
  _inc(_profile.subtitleStyle.animation, anim);
  _persist();
}

function learnExport(quality, format) {
  if (quality) _inc(_profile.exportSettings.quality, quality);
  if (format)  _inc(_profile.exportSettings.format, format);
  _profile.editingPatterns.totalExports++;
  _persist();
  _renderDashboard();
}

function learnAspectRatio(ratio) {
  if (!ratio || !/\d+:\d+/.test(ratio)) return;
  _inc(_profile.aspectRatioUsage, ratio);
  _persist();
}

function learnSave() {
  _profile.editingPatterns.totalSaves++;
  _persist();
}

function learnShort() {
  _profile.editingPatterns.totalShorts++;
  _persist();
}

/* ══════════════════════════════════════════════════════════
   4. APPLY MY STYLE
   ══════════════════════════════════════════════════════════ */

function applyMyStyle() {
  const applied = [];

  const topTpl = _profile.subtitleStyle.topTemplate;
  if (topTpl && window.SubEngine) {
    window.SubEngine.applyTemplate(topTpl, null);
    applied.push('Template: ' + topTpl);
  }

  const topAnim = _profile.subtitleStyle.topAnimation;
  if (topAnim && window.SubtitlePro && window.SubtitlePro.setAnimation) {
    window.SubtitlePro.setAnimation(topAnim);
    applied.push('Animation: ' + topAnim);
  }

  const topRatio = _profile.preferredAspectRatio;
  if (topRatio) {
    const btn = [...document.querySelectorAll('.ratio-btn')].find(b => b.textContent.trim() === topRatio);
    if (btn) { btn.click(); applied.push('Tỷ lệ: ' + topRatio); }
  }

  if (typeof toast === 'function') {
    toast(applied.length
      ? '✨ Đã áp dụng phong cách: ' + applied.join(' · ')
      : 'ℹ️ Chưa đủ dữ liệu — Hãy edit thêm để AI học phong cách của bạn');
  }
  return { ok: true, applied };
}

/* ══════════════════════════════════════════════════════════
   5. SNAPSHOTS (STYLE PRESETS)
   ══════════════════════════════════════════════════════════ */

function saveSnapshot(name) {
  const snap = {
    id: 'snap_' + Date.now(),
    name: name || ('Preset ' + (_snapshots.length + 1)),
    createdAt: new Date().toISOString(),
    subtitleTemplate: _profile.subtitleStyle.topTemplate,
    animation:        _profile.subtitleStyle.topAnimation,
    exportQuality:    _profile.exportSettings.topQuality,
    exportFormat:     _profile.exportSettings.topFormat,
    aspectRatio:      _profile.preferredAspectRatio,
  };
  _snapshots.unshift(snap);
  if (_snapshots.length > 10) _snapshots.length = 10;
  _persistSnaps();
  _renderDashboard();
  if (typeof toast === 'function') toast('💾 Đã lưu preset: ' + snap.name);
}

function applySnapshot(id) {
  const snap = _snapshots.find(s => s.id === id);
  if (!snap) return;
  if (snap.subtitleTemplate && window.SubEngine)
    window.SubEngine.applyTemplate(snap.subtitleTemplate, null);
  if (snap.animation && window.SubtitlePro && window.SubtitlePro.setAnimation)
    window.SubtitlePro.setAnimation(snap.animation);
  if (snap.aspectRatio) {
    const btn = [...document.querySelectorAll('.ratio-btn')].find(b => b.textContent.trim() === snap.aspectRatio);
    if (btn) btn.click();
  }
  if (typeof toast === 'function') toast('✅ Đã áp dụng: ' + snap.name);
}

function deleteSnapshot(id) {
  _snapshots = _snapshots.filter(s => s.id !== id);
  _persistSnaps();
  _renderDashboard();
}

function _promptSnapshot() {
  const name = prompt('Đặt tên cho preset này:', 'My Preset ' + (_snapshots.length + 1));
  if (name !== null) saveSnapshot(name.trim() || 'My Preset');
}

function _confirmReset() {
  if (!confirm('Xóa toàn bộ dữ liệu phong cách đã học? Không thể hoàn tác.')) return;
  _profile   = _defaultProfile();
  _snapshots = [];
  _persist();
  _persistSnaps();
  _renderDashboard();
  if (typeof toast === 'function') toast('🗑 Đã xóa dữ liệu phong cách');
}

/* ══════════════════════════════════════════════════════════
   6. SUGGESTION BANNER
   ══════════════════════════════════════════════════════════ */

function showSuggestions() {
  const total = _profile.editingPatterns.totalExports + _profile.editingPatterns.totalSaves;
  if (total < 2) return;
  if (document.getElementById('style-suggestion-banner')) return;

  const topTpl = _profile.subtitleStyle.topTemplate;
  const topQ   = _profile.exportSettings.topQuality;
  const topFmt = _profile.exportSettings.topFormat;

  const items = [];
  if (topTpl) items.push(`Bạn thường dùng template <b>${topTpl}</b>`);
  if (topQ)   items.push(`Bạn thường export <b>${topQ} ${(topFmt || 'mp4').toUpperCase()}</b>`);
  if (!items.length) return;

  const banner = document.createElement('div');
  banner.id = 'style-suggestion-banner';
  banner.innerHTML = `
    <div class="ssb-inner">
      <div class="ssb-icon">🧠</div>
      <div class="ssb-content">
        <div class="ssb-title">AI nhận ra phong cách của bạn</div>
        ${items.map(t => `<div class="ssb-item">${t}</div>`).join('')}
      </div>
      <button class="ssb-apply-all" onclick="StyleMemory.applyMyStyle();document.getElementById('style-suggestion-banner')?.remove()">Áp dụng</button>
      <button class="ssb-close" onclick="document.getElementById('style-suggestion-banner')?.remove()">✕</button>
    </div>`;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 9000);
}

/* ══════════════════════════════════════════════════════════
   7. DASHBOARD UI
   ══════════════════════════════════════════════════════════ */

function _renderDashboard() {
  const panel = document.getElementById('mystyle-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  const p      = _profile;
  const topTpl   = p.subtitleStyle.topTemplate   || '—';
  const topAnim  = p.subtitleStyle.topAnimation  || '—';
  const topQ     = p.exportSettings.topQuality   || '—';
  const topFmt   = p.exportSettings.topFormat    || '—';
  const topRatio = p.preferredAspectRatio        || '—';
  const confSub  = Math.round((p.confidence.subtitleStyleConfidence || 0) * 100);
  const confExp  = Math.round((p.confidence.exportConfidence        || 0) * 100);
  const confAnim = Math.round((p.confidence.templateConfidence      || 0) * 100);
  const totalUsage = p.editingPatterns.totalExports + p.editingPatterns.totalSaves;

  const hasSuggestions = topTpl !== '—' || topQ !== '—' || topRatio !== '—';

  const sugItems = [];
  if (topTpl   !== '—') sugItems.push(`🎨 Template: <b>${topTpl}</b>`);
  if (topQ     !== '—') sugItems.push(`📤 Export: <b>${topQ} ${topFmt.toUpperCase()}</b>`);
  if (topRatio !== '—') sugItems.push(`📐 Tỷ lệ: <b>${topRatio}</b>`);

  const favHtml = p.favoriteTemplates.length
    ? p.favoriteTemplates.map((t, i) => `<span class="ms-fav-tag">${['🥇','🥈','🥉'][i]} ${t}</span>`).join('')
    : `<span class="ms-empty-note">Chưa có dữ liệu</span>`;

  const snapHtml = _snapshots.length
    ? _snapshots.map(s => `
        <div class="ms-snap-item">
          <div class="ms-snap-left">
            <div class="ms-snap-name">${s.name}</div>
            <div class="ms-snap-meta">${s.subtitleTemplate || '—'} · ${s.exportQuality || '—'} · ${s.aspectRatio || '—'}</div>
          </div>
          <div class="ms-snap-btns">
            <button class="ms-snap-apply" onclick="window.StyleMemory.applySnapshot('${s.id}')">Áp dụng</button>
            <button class="ms-snap-del"   onclick="window.StyleMemory.deleteSnapshot('${s.id}')">✕</button>
          </div>
        </div>`).join('')
    : `<div class="ms-empty-note">Chưa có preset — Nhấn "+ Lưu preset" để lưu phong cách hiện tại</div>`;

  panel.innerHTML = `
    <div class="ms-body">

      ${hasSuggestions ? `
      <div class="ms-card ms-sug-card">
        <div class="ms-card-title">⚡ Gợi ý cho bạn</div>
        <div class="ms-sug-list">
          ${sugItems.map(s => `<div class="ms-sug-item">${s}</div>`).join('')}
        </div>
        <button class="ms-primary-btn" onclick="window.StyleMemory.applyMyStyle()">✨ Áp dụng tất cả</button>
      </div>` : `
      <div class="ms-card ms-empty-card">
        <div class="ms-empty-icon">🧠</div>
        <div class="ms-empty-title">AI chưa đủ dữ liệu</div>
        <div class="ms-empty-desc">Hãy tiếp tục edit, áp dụng subtitle, export video và lưu dự án — AI sẽ tự động học phong cách của bạn.</div>
      </div>`}

      <div class="ms-card">
        <div class="ms-card-title">📊 Phong cách của bạn</div>
        <div class="ms-stat-grid">
          <div class="ms-stat-item">
            <div class="ms-stat-val">${topTpl}</div>
            <div class="ms-stat-lbl">Template</div>
          </div>
          <div class="ms-stat-item">
            <div class="ms-stat-val">${topAnim}</div>
            <div class="ms-stat-lbl">Animation</div>
          </div>
          <div class="ms-stat-item">
            <div class="ms-stat-val">${topQ}</div>
            <div class="ms-stat-lbl">Chất lượng</div>
          </div>
          <div class="ms-stat-item">
            <div class="ms-stat-val">${topRatio}</div>
            <div class="ms-stat-lbl">Tỷ lệ video</div>
          </div>
        </div>
        <div class="ms-conf-section">
          <div class="ms-conf-row">
            <span class="ms-conf-label">Subtitle</span>
            <div class="ms-conf-track"><div class="ms-conf-fill" style="width:${confSub}%"></div></div>
            <span class="ms-conf-pct">${confSub}%</span>
          </div>
          <div class="ms-conf-row">
            <span class="ms-conf-label">Export</span>
            <div class="ms-conf-track"><div class="ms-conf-fill" style="width:${confExp}%"></div></div>
            <span class="ms-conf-pct">${confExp}%</span>
          </div>
          <div class="ms-conf-row">
            <span class="ms-conf-label">Animation</span>
            <div class="ms-conf-track"><div class="ms-conf-fill" style="width:${confAnim}%"></div></div>
            <span class="ms-conf-pct">${confAnim}%</span>
          </div>
        </div>
      </div>

      <div class="ms-card">
        <div class="ms-card-title">⭐ Template yêu thích</div>
        <div class="ms-fav-tags">${favHtml}</div>
      </div>

      <div class="ms-card">
        <div class="ms-card-title">📈 Hoạt động</div>
        <div class="ms-activity-row">
          <div class="ms-act-item">
            <div class="ms-act-val">${p.editingPatterns.totalExports}</div>
            <div class="ms-act-lbl">Lần export</div>
          </div>
          <div class="ms-act-item">
            <div class="ms-act-val">${p.editingPatterns.totalSaves}</div>
            <div class="ms-act-lbl">Lần lưu</div>
          </div>
          <div class="ms-act-item">
            <div class="ms-act-val">${p.editingPatterns.totalShorts}</div>
            <div class="ms-act-lbl">Shorts tạo</div>
          </div>
        </div>
      </div>

      <div class="ms-card">
        <div class="ms-card-title-row">
          <div class="ms-card-title">💾 Style Presets</div>
          <button class="ms-snap-new-btn" onclick="window.StyleMemory._promptSnapshot()">+ Lưu preset</button>
        </div>
        <div class="ms-snapshots">${snapHtml}</div>
      </div>

      <div class="ms-reset-row">
        <button class="ms-reset-btn" onclick="window.StyleMemory._confirmReset()">🗑 Xóa dữ liệu đã học</button>
      </div>

    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   8. HOOKS — học từ các module khác
   ══════════════════════════════════════════════════════════ */

function _hookSubEngine() {
  if (!window.SubEngine || !window.SubEngine.applyTemplate) return false;
  if (window.SubEngine.applyTemplate.__memPatched) return true;
  const orig = window.SubEngine.applyTemplate.bind(window.SubEngine);
  window.SubEngine.applyTemplate = function (tpl, el) {
    learnSubtitleTemplate(tpl);
    return orig(tpl, el);
  };
  window.SubEngine.applyTemplate.__memPatched = true;
  return true;
}

function _hookProjectManager() {
  if (!window.ProjectManager || !window.ProjectManager.quickSave) return false;
  if (window.ProjectManager.quickSave.__memPatched) return true;
  const orig = window.ProjectManager.quickSave.bind(window.ProjectManager);
  window.ProjectManager.quickSave = function (...a) {
    learnSave();
    const ratioEl = document.querySelector('.ratio-btn.on');
    if (ratioEl) learnAspectRatio(ratioEl.textContent.trim());
    return orig(...a);
  };
  window.ProjectManager.quickSave.__memPatched = true;
  return true;
}

function _hookSubtitlePro() {
  if (!window.SubtitlePro || !window.SubtitlePro.setAnimation) return false;
  if (window.SubtitlePro.setAnimation.__memPatched) return true;
  const orig = window.SubtitlePro.setAnimation.bind(window.SubtitlePro);
  window.SubtitlePro.setAnimation = function (key) {
    learnAnimation(key);
    return orig(key);
  };
  window.SubtitlePro.setAnimation.__memPatched = true;
  return true;
}

function _installClickHooks() {
  document.addEventListener('click', function (e) {
    // Aspect ratio buttons
    const ratioBtn = e.target.closest('.ratio-btn');
    if (ratioBtn) {
      learnAspectRatio(ratioBtn.textContent.trim());
    }
    // Subtitle template clicks (via capcut.html onclick)
    const tplItem = e.target.closest('.sub-tpl-item');
    if (tplItem) {
      const cls = [...tplItem.classList].find(c => c.startsWith('tpl-'));
      if (cls) learnSubtitleTemplate(cls.replace('tpl-', ''));
    }
    // Export start button
    if (e.target.closest('#exp-start-btn')) {
      setTimeout(() => {
        const q   = document.querySelector('.exp-quality-card.on')?.dataset?.q;
        const fmt = document.querySelector('.exp-fmt-btn.on,[data-fmt].on')?.dataset?.fmt;
        if (q) learnExport(q, fmt || 'mp4');
      }, 80);
    }
    // Shorts / factory
    if (e.target.closest('#gen-shorts-btn,.factory-run-btn,[onclick*="BatchFactory.run"]')) {
      learnShort();
    }
  }, true);
}

/* ══════════════════════════════════════════════════════════
   9. INIT
   ══════════════════════════════════════════════════════════ */

function init() {
  _installClickHooks();

  // Try to hook immediately, retry for deferred modules
  const retryHooks = () => {
    _hookSubEngine();
    _hookProjectManager();
    _hookSubtitlePro();
  };

  retryHooks();
  setTimeout(retryHooks, 1500);
  setTimeout(() => {
    retryHooks();
    showSuggestions();
  }, 3000);
}

/* ══════════════════════════════════════════════════════════
   10. PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.StyleMemory = {
  learnSubtitleTemplate,
  learnAnimation,
  learnExport,
  learnAspectRatio,
  learnSave,
  learnShort,
  applyMyStyle,
  saveSnapshot,
  applySnapshot,
  deleteSnapshot,
  showSuggestions,
  renderDashboard: _renderDashboard,
  getProfile:   () => _profile,
  getSnapshots: () => _snapshots,
  _promptSnapshot,
  _confirmReset,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[StyleMemory] Phase 3.0 Personal Editing Memory loaded');

})();
