/* ============================================================
   BRAND CLONE MANAGER — js/brand.js
   Phase 3.1: Brand Clone System
   Học phong cách thương hiệu từ video cũ và áp dụng.

   Storage:
     cc_brand_profiles — mảng brand profiles
     cc_brand_active   — id của brand đang chọn
   ============================================================ */

(function () {

const KEY_PROFILES = 'cc_brand_profiles';
const KEY_ACTIVE   = 'cc_brand_active';

/* ══════════════════════════════════════════════════════════
   1. SCHEMA & STATE
   ══════════════════════════════════════════════════════════ */

function _defaultProfile(name) {
  return {
    id: 'brand_' + Date.now(),
    brandName: name || 'My Brand',
    videosAnalyzed: 0,
    subtitlePatterns: {
      dominantColor:  null,
      dominantFont:   null,
      usesHighlight:  false,
      highlightWords: [],
      templateUsage:  {},
      topTemplate:    null,
    },
    editingPatterns: {
      avgCutInterval: null,
      cutStyle:       null,
      paceRating:     null,
      usesZoom:       false,
      avgClipDur:     null,
    },
    hookPatterns: {
      examples:         [],
      commonStructures: [],
      dominantType:     null,
    },
    titlePatterns: {
      examples:         [],
      commonStructures: [],
      avgLength:        null,
    },
    ctaPatterns: {
      examples:     [],
      placement:    null,
      dominantType: null,
    },
    shortPatterns: {
      avgDuration: null,
      hookStyle:   null,
      paceRating:  null,
    },
    brandScore: {
      consistency:         0,
      subtitleConsistency: 0,
      hookConsistency:     0,
      editingConsistency:  0,
    },
    confidence:    0,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
    rawAssetCount: 0,
  };
}

let _profiles = _loadProfiles();
let _activeId = _loadActiveId();

function _loadProfiles() {
  try { const r = localStorage.getItem(KEY_PROFILES); if (r) return JSON.parse(r); } catch(e) {}
  return [];
}
function _loadActiveId() {
  try { return localStorage.getItem(KEY_ACTIVE) || null; } catch(e) { return null; }
}
function _persist() {
  try { localStorage.setItem(KEY_PROFILES, JSON.stringify(_profiles)); } catch(e) {}
}
function _persistActive() {
  try {
    if (_activeId) localStorage.setItem(KEY_ACTIVE, _activeId);
    else           localStorage.removeItem(KEY_ACTIVE);
  } catch(e) {}
}
function _getActive() {
  if (_activeId) {
    const found = _profiles.find(p => p.id === _activeId);
    if (found) return found;
  }
  return _profiles[0] || null;
}

/* ══════════════════════════════════════════════════════════
   2. BRAND CRUD
   ══════════════════════════════════════════════════════════ */

function createBrand(name) {
  const p = _defaultProfile(name);
  _profiles.unshift(p);
  if (_profiles.length > 5) _profiles.length = 5;
  _activeId = p.id;
  _persist();
  _persistActive();
  _renderDashboard();
  return p;
}

function deleteBrand(id) {
  _profiles = _profiles.filter(p => p.id !== id);
  if (_activeId === id) _activeId = _profiles[0]?.id || null;
  _persist();
  _persistActive();
  _renderDashboard();
}

function setActiveBrand(id) {
  if (_profiles.find(p => p.id === id)) {
    _activeId = id;
    _persistActive();
    _renderDashboard();
  }
}

/* ══════════════════════════════════════════════════════════
   3. TRAINING PIPELINE
   ══════════════════════════════════════════════════════════ */

let _training = false;

async function trainBrand(assets) {
  const brand = _getActive();
  if (!brand)           { _toast('⚠️ Chưa có Brand Profile — Tạo mới trước'); return; }
  if (_training)        { _toast('⏳ Đang training...'); return; }
  if (!assets?.length)  { _toast('⚠️ Không có dữ liệu để train'); return; }

  _training = true;
  _setTrainingUI(true);

  try {
    const res  = await fetch('/brand/train', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        brand_id:   brand.id,
        brand_name: brand.brandName,
        assets,
      }),
    });
    const data = await res.json();
    if (data.error) { _toast('❌ ' + data.error); return; }

    _mergeTrainingResult(brand, data, assets.length);
    _persist();
    _renderDashboard();
    _toast(`✅ Đã học từ ${assets.length} video · Độ tin cậy: ${Math.round(brand.confidence * 100)}%`);
  } catch(e) {
    _toast('❌ Lỗi training: ' + e.message);
  } finally {
    _training = false;
    _setTrainingUI(false);
  }
}

function _mergeTrainingResult(brand, data, assetCount) {
  brand.videosAnalyzed  = (brand.videosAnalyzed  || 0) + assetCount;
  brand.rawAssetCount   = (brand.rawAssetCount   || 0) + assetCount;
  brand.updatedAt       = new Date().toISOString();

  if (data.subtitlePatterns) Object.assign(brand.subtitlePatterns, data.subtitlePatterns);
  if (data.editingPatterns)  Object.assign(brand.editingPatterns,  data.editingPatterns);

  function _mergeListField(dest, src, field, max) {
    if (!src?.[field]) return;
    dest[field] = [...new Set([...(dest[field]||[]), ...(src[field]||[])])].slice(0, max);
  }

  if (data.hookPatterns) {
    const h = brand.hookPatterns, d = data.hookPatterns;
    if (d.dominantType)  h.dominantType = d.dominantType;
    _mergeListField(h, d, 'commonStructures', 5);
    _mergeListField(h, d, 'examples', 6);
  }
  if (data.titlePatterns) {
    const t = brand.titlePatterns, d = data.titlePatterns;
    if (d.avgLength)     t.avgLength = d.avgLength;
    _mergeListField(t, d, 'commonStructures', 5);
    _mergeListField(t, d, 'examples', 6);
  }
  if (data.ctaPatterns) {
    const c = brand.ctaPatterns, d = data.ctaPatterns;
    if (d.placement)    c.placement    = d.placement;
    if (d.dominantType) c.dominantType = d.dominantType;
    _mergeListField(c, d, 'examples', 5);
  }
  if (data.shortPatterns) Object.assign(brand.shortPatterns, data.shortPatterns);
  if (data.brandScore)    Object.assign(brand.brandScore,    data.brandScore);
  if (typeof data.confidence === 'number') brand.confidence = data.confidence;
}

function _setTrainingUI(on) {
  const btn  = document.getElementById('bc-train-btn');
  const btn2 = document.getElementById('bc-train-proj-btn');
  const prog = document.getElementById('bc-train-progress');
  if (btn)  { btn.textContent = on ? '⏳ Đang học...' : '🧠 Học từ video hiện tại'; btn.disabled = on; }
  if (btn2) { btn2.disabled = on; }
  if (prog) prog.style.display = on ? 'block' : 'none';
}

/* ── Train từ editor hiện tại ──────────────────────── */
function trainFromCurrentEditor() {
  const edState  = _getEditorState();
  const subCount = edState.subtitles?.length || 0;
  const clipCount = edState.tracks?.flatMap(t => t.clips||[]).length || 0;
  if (!subCount && !clipCount) { _toast('⚠️ Editor chưa có nội dung để học'); return; }

  const asset = {
    type:       'editor_state',
    transcript: (edState.subtitles||[]).map(s => s.text).join(' '),
    subtitles:  edState.subtitles || [],
    timeline:   { clips: (edState.tracks||[]).flatMap(t => t.clips||[]) },
  };
  trainBrand([asset]);
}

/* ── Train từ tất cả projects đã lưu ──────────────── */
function trainFromProjects() {
  let pList = [];
  try { pList = JSON.parse(localStorage.getItem('cc_projects') || '[]'); } catch(e) {}
  if (!pList.length) { _toast('⚠️ Chưa có project đã lưu'); return; }

  const assets = [];
  for (const meta of pList.slice(0, 20)) {
    try {
      const raw = localStorage.getItem('cc_proj_' + meta.id);
      if (!raw) continue;
      const proj  = JSON.parse(raw);
      const state = proj.editorState || proj;
      const subs  = state.subtitles || [];
      const clips = (state.tracks || []).flatMap(t => t.clips || []);
      if (!subs.length && !clips.length) continue;
      assets.push({
        type:       'project',
        name:       meta.name || meta.id,
        transcript: subs.map(s => s.text).join(' '),
        subtitles:  subs,
        timeline:   { clips },
      });
    } catch(e) {}
  }
  if (!assets.length) { _toast('⚠️ Không đọc được dữ liệu project'); return; }
  _toast(`📂 Đang học từ ${assets.length} project...`);
  trainBrand(assets);
}

/* ══════════════════════════════════════════════════════════
   4. APPLY BRAND STYLE
   ══════════════════════════════════════════════════════════ */

function applyBrandStyle() {
  const brand = _getActive();
  if (!brand || brand.videosAnalyzed < 1) {
    _toast('ℹ️ Chưa có dữ liệu Brand — Hãy train trước');
    return { ok: false, error: 'No brand data' };
  }
  const applied = [];

  const topTpl = brand.subtitlePatterns?.topTemplate;
  if (topTpl && window.SubEngine?.applyTemplate) {
    window.SubEngine.applyTemplate(topTpl, null);
    applied.push('Template: ' + topTpl);
  }

  const topAnim = brand.editingPatterns?.cutStyle;
  if (applied.length === 0 && brand.subtitlePatterns?.dominantColor) {
    applied.push('Màu subtitle: ' + brand.subtitlePatterns.dominantColor);
  }

  _toast(applied.length
    ? '🎨 Đã áp dụng Brand Style: ' + applied.join(' · ')
    : 'ℹ️ Brand Style đã áp dụng — Upload video và generate subtitle để thấy kết quả');
  return { ok: true, applied };
}

/* ══════════════════════════════════════════════════════════
   5. COMPARE TO BRAND
   ══════════════════════════════════════════════════════════ */

let _lastCompareResult = null;

async function compareToBrand() {
  const brand = _getActive();
  if (!brand || brand.videosAnalyzed < 1) { _toast('ℹ️ Chưa train Brand Profile'); return; }

  const editorState = _getEditorState();
  const btn = document.getElementById('bc-compare-btn');
  if (btn) { btn.textContent = '⏳ Đang so sánh...'; btn.disabled = true; }

  try {
    const res  = await fetch('/brand/compare', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brand_profile: brand, editor_state: editorState }),
    });
    const data = await res.json();
    if (data.error) { _toast('❌ ' + data.error); return; }
    _lastCompareResult = data;
    _renderCompareResult(data);
    _toast(`📊 Độ tương đồng Brand: ${data.similarity}%`);
  } catch(e) {
    _toast('❌ Lỗi so sánh: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '📊 So sánh với Brand'; btn.disabled = false; }
  }
}

function _renderCompareResult(data) {
  const el = document.getElementById('bc-compare-result');
  if (!el) return;
  const sim   = data.similarity || 0;
  const color = sim >= 75 ? '#4cd86e' : sim >= 50 ? 'var(--accent2)' : '#e05555';
  const bg    = sim >= 75 ? 'rgba(76,216,110,.1)' : sim >= 50 ? 'rgba(212,160,23,.1)' : 'rgba(224,85,85,.1)';
  const diffs = (data.differences || []).map(d => `<li class="bc-diff-item">${d}</li>`).join('');
  el.innerHTML = `
    <div class="bc-sim-card" style="background:${bg};border-radius:8px;padding:10px;text-align:center">
      <div class="bc-sim-val" style="color:${color};font-size:28px;font-weight:800">${sim}%</div>
      <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Độ tương đồng Brand</div>
    </div>
    ${diffs ? `<ul class="bc-diff-list">${diffs}</ul>` : '<div class="bc-diff-none">✅ Video rất gần với Brand Profile!</div>'}
  `;
  el.style.display = 'block';
}

/* ══════════════════════════════════════════════════════════
   6. GENERATE BRAND CTA
   ══════════════════════════════════════════════════════════ */

async function generateBrandCTA() {
  const brand = _getActive();
  if (!brand || brand.videosAnalyzed < 1) { _toast('ℹ️ Chưa train Brand Profile'); return; }

  const editorState = _getEditorState();
  const transcript  = (editorState.subtitles||[]).map(s => s.text).join(' ').slice(0, 500);
  const btn = document.getElementById('bc-cta-btn');
  if (btn) { btn.textContent = '⏳ Đang tạo CTA...'; btn.disabled = true; }

  try {
    const res  = await fetch('/brand/compare', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode: 'generate_cta', brand_profile: brand, editor_state: editorState, transcript }),
    });
    const data = await res.json();
    const el   = document.getElementById('bc-cta-result');
    if (el && data.cta) {
      el.innerHTML = `<div class="bc-cta-output">💬 ${data.cta}</div>`;
      el.style.display = 'block';
    }
    if (data.hook) {
      const hookEl = document.getElementById('bc-hook-result');
      if (hookEl) { hookEl.innerHTML = `<div class="bc-cta-output">🎣 ${data.hook}</div>`; hookEl.style.display = 'block'; }
    }
  } catch(e) {
    _toast('❌ ' + e.message);
  } finally {
    if (btn) { btn.textContent = '💬 Tạo CTA theo Brand'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════
   7. GENERATE BRAND SHORT
   ══════════════════════════════════════════════════════════ */

async function generateBrandShort() {
  const brand = _getActive();
  if (!brand || brand.videosAnalyzed < 1) { _toast('ℹ️ Chưa train Brand Profile'); return; }

  const editorState = _getEditorState();
  if (!editorState.subtitles?.length && !editorState.tracks?.length) {
    _toast('⚠️ Chưa có video/subtitle trong editor');
    return;
  }

  _toast('🎬 Đang tạo Short theo Brand Style...');

  if (window.ShortsGen) {
    window.ShortsGen.generate({
      brandStyle: {
        hookType:    brand.hookPatterns?.dominantType,
        paceRating:  brand.editingPatterns?.paceRating,
        hookExample: brand.hookPatterns?.examples?.[0],
      },
    });
  } else {
    _toast('ℹ️ AI Shorts Generator chưa sẵn sàng — Hãy mở tab Shorts');
  }
}

/* ══════════════════════════════════════════════════════════
   8. EXPORT / IMPORT
   ══════════════════════════════════════════════════════════ */

function exportBrandJSON() {
  const brand = _getActive();
  if (!brand) { _toast('⚠️ Chưa có Brand Profile'); return; }
  const payload = { brandProfile: brand };
  const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = (brand.brandName || 'brand').replace(/[^a-z0-9]/gi, '_') + '_profile.json';
  a.click();
  URL.revokeObjectURL(url);
  _toast('📦 Đã export Brand Profile: ' + brand.brandName);
}

function importBrandJSON() {
  const inp    = document.createElement('input');
  inp.type     = 'file';
  inp.accept   = '.json,application/json';
  inp.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj  = JSON.parse(text);
      const bp   = obj.brandProfile || obj;
      if (!bp.brandName) { _toast('❌ File không hợp lệ'); return; }
      bp.id = 'brand_' + Date.now();
      _profiles.unshift(bp);
      if (_profiles.length > 5) _profiles.length = 5;
      _activeId = bp.id;
      _persist();
      _persistActive();
      _renderDashboard();
      _toast('✅ Đã import: ' + bp.brandName);
    } catch(e) {
      _toast('❌ Lỗi đọc file: ' + e.message);
    }
  };
  inp.click();
}

/* ══════════════════════════════════════════════════════════
   9. RECOMMENDATIONS BANNER
   ══════════════════════════════════════════════════════════ */

function showBrandRecommendations() {
  const brand = _getActive();
  if (!brand || brand.videosAnalyzed < 1) return;
  if (document.getElementById('brand-rec-banner')) return;

  const items = [];
  if (brand.hookPatterns?.dominantType)    items.push(`Bạn thường mở đầu bằng <b>${brand.hookPatterns.dominantType}</b>`);
  if (brand.subtitlePatterns?.topTemplate) items.push(`Bạn thường dùng subtitle <b>${brand.subtitlePatterns.topTemplate}</b>`);
  if (brand.ctaPatterns?.placement)        items.push(`Bạn thường đặt CTA ở <b>${brand.ctaPatterns.placement}</b> video`);
  if (!items.length) return;

  const banner = document.createElement('div');
  banner.id    = 'brand-rec-banner';
  banner.className = 'brand-rec-banner';
  banner.innerHTML = `
    <div class="brb-inner">
      <div class="brb-icon">🧬</div>
      <div class="brb-content">
        <div class="brb-title">Brand Style — ${brand.brandName}</div>
        ${items.map(t => `<div class="brb-item">${t}</div>`).join('')}
      </div>
      <button class="brb-apply" onclick="BrandClone.applyBrandStyle();document.getElementById('brand-rec-banner')?.remove()">Áp dụng</button>
      <button class="brb-close" onclick="document.getElementById('brand-rec-banner')?.remove()">✕</button>
    </div>`;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 10000);
}

/* ══════════════════════════════════════════════════════════
   10. HELPER
   ══════════════════════════════════════════════════════════ */

function _getEditorState() {
  try {
    return {
      subtitles: typeof subtitles !== 'undefined' ? subtitles.slice(0, 30) : [],
      tracks:    typeof tracks    !== 'undefined' ? tracks : [],
    };
  } catch(e) { return { subtitles: [], tracks: [] }; }
}

function _toast(msg) {
  if (typeof toast === 'function') toast(msg);
  else console.log('[BrandClone]', msg);
}

/* ══════════════════════════════════════════════════════════
   11. DASHBOARD UI
   ══════════════════════════════════════════════════════════ */

function _renderDashboard() {
  const panel = document.getElementById('brand-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  const brand   = _getActive();
  const hasData = brand && brand.videosAnalyzed > 0;

  /* Profile selector (only if multiple brands) */
  const profSel = _profiles.length > 1
    ? `<select class="bc-profile-sel" onchange="BrandClone.setActiveBrand(this.value)">
        ${_profiles.map(p =>
          `<option value="${p.id}" ${p.id===(_activeId||_profiles[0]?.id) ? 'selected' : ''}>${p.brandName}</option>`
        ).join('')}
       </select>`
    : '';

  /* Brand score rows */
  const scoreRows = hasData
    ? [['Tổng thể',  brand.brandScore.consistency],
       ['Subtitle',  brand.brandScore.subtitleConsistency],
       ['Hook',      brand.brandScore.hookConsistency],
       ['Chỉnh sửa', brand.brandScore.editingConsistency]]
      .map(([lbl, val]) => `
        <div class="bc-score-row">
          <span class="bc-score-lbl">${lbl}</span>
          <div class="ms-conf-track"><div class="ms-conf-fill" style="width:${val||0}%"></div></div>
          <span class="ms-conf-pct">${val||0}%</span>
        </div>`).join('')
    : '';

  /* Hooks */
  const hookHtml = hasData && brand.hookPatterns?.examples?.length
    ? brand.hookPatterns.examples.slice(0,3).map(ex => `<div class="bc-pattern-item">"${ex}"</div>`).join('')
      + (brand.hookPatterns.dominantType ? `<div class="bc-badge">Kiểu: ${brand.hookPatterns.dominantType}</div>` : '')
    : '<div class="ms-empty-note">Chưa có dữ liệu hook</div>';

  /* CTA */
  const ctaHtml = hasData && brand.ctaPatterns?.examples?.length
    ? brand.ctaPatterns.examples.slice(0,2).map(ex => `<div class="bc-pattern-item">"${ex}"</div>`).join('')
      + (brand.ctaPatterns.placement ? `<div class="bc-badge">Vị trí: ${brand.ctaPatterns.placement} video</div>` : '')
    : '<div class="ms-empty-note">Chưa có dữ liệu CTA</div>';

  panel.innerHTML = `
    <div class="ms-body">

      <!-- Brand header card -->
      <div class="ms-card">
        <div class="ms-card-title-row">
          <div class="ms-card-title">🧬 Brand Profile</div>
          <button class="ms-snap-new-btn" onclick="BrandClone._promptCreateBrand()">+ Tạo mới</button>
        </div>
        ${profSel}
        ${brand ? `
          <div class="bc-brand-name">${brand.brandName}</div>
          <div class="bc-brand-meta">Tạo: ${brand.createdAt.slice(0,10)} · Cập nhật: ${brand.updatedAt.slice(0,10)}</div>
          ${_profiles.length > 1 ? `<button class="ms-snap-del" style="align-self:flex-start;margin-top:2px" onclick="BrandClone._confirmDeleteBrand('${brand.id}')">Xóa brand này</button>` : ''}
        ` : `<div class="ms-empty-note">Chưa có Brand — Nhấn "+ Tạo mới" để bắt đầu</div>`}
      </div>

      ${brand ? `
      <!-- Training card -->
      <div class="ms-card">
        <div class="ms-card-title">🎓 Huấn luyện AI</div>
        <div id="bc-train-progress" class="bc-train-progress" style="display:none">
          <div class="bc-train-bar"><div class="bc-train-fill"></div></div>
          <div class="bc-train-msg">Đang phân tích video...</div>
        </div>
        <button class="ms-primary-btn" id="bc-train-btn" onclick="BrandClone.trainFromCurrentEditor()">🧠 Học từ video hiện tại</button>
        <button class="ms-primary-btn bc-secondary-btn" id="bc-train-proj-btn" onclick="BrandClone.trainFromProjects()" style="margin-top:5px">📂 Học từ tất cả projects</button>
      </div>

      <!-- Brand score -->
      ${hasData ? `
      <div class="ms-card">
        <div class="ms-card-title">🏆 Brand Score</div>
        <div class="bc-score-rows">${scoreRows}</div>
        <div class="bc-stats-row">
          <div class="bc-stat">
            <div class="bc-stat-val">${brand.videosAnalyzed}</div>
            <div class="bc-stat-lbl">Video đã học</div>
          </div>
          <div class="bc-stat">
            <div class="bc-stat-val">${Math.round((brand.confidence||0)*100)}%</div>
            <div class="bc-stat-lbl">Độ tin cậy</div>
          </div>
          <div class="bc-stat">
            <div class="bc-stat-val">${brand.brandScore.consistency||0}%</div>
            <div class="bc-stat-lbl">Nhất quán</div>
          </div>
        </div>
      </div>` : ''}

      <!-- Hook patterns -->
      <div class="ms-card">
        <div class="ms-card-title">🎣 Hook phổ biến</div>
        ${hookHtml}
      </div>

      <!-- Subtitle patterns -->
      <div class="ms-card">
        <div class="ms-card-title">💬 Subtitle phổ biến</div>
        ${hasData ? `
          <div class="bc-badge-row">
            ${brand.subtitlePatterns.topTemplate    ? `<div class="bc-badge">Template: ${brand.subtitlePatterns.topTemplate}</div>`       : ''}
            ${brand.subtitlePatterns.dominantColor  ? `<div class="bc-badge">Màu: ${brand.subtitlePatterns.dominantColor}</div>`           : ''}
            ${brand.subtitlePatterns.usesHighlight  ? `<div class="bc-badge bc-badge-green">✅ Dùng highlight</div>`                       : ''}
            ${!brand.subtitlePatterns.topTemplate && !brand.subtitlePatterns.dominantColor ? `<div class="ms-empty-note">Chưa có dữ liệu</div>` : ''}
          </div>` : '<div class="ms-empty-note">Chưa có dữ liệu</div>'}
      </div>

      <!-- CTA patterns -->
      <div class="ms-card">
        <div class="ms-card-title">📢 CTA phổ biến</div>
        ${ctaHtml}
      </div>

      <!-- Apply brand style -->
      <div class="ms-card" style="background:rgba(212,160,23,.06);border-color:rgba(212,160,23,.3)">
        <div class="ms-card-title">⚡ Áp dụng Brand Style</div>
        <button class="ms-primary-btn" onclick="BrandClone.applyBrandStyle()">✨ Áp dụng Brand Style</button>
      </div>

      <!-- Compare -->
      <div class="ms-card">
        <div class="ms-card-title">📊 So sánh Brand</div>
        <button class="ms-primary-btn bc-secondary-btn" id="bc-compare-btn" onclick="BrandClone.compareToBrand()">📊 So sánh video hiện tại</button>
        <div id="bc-compare-result" style="display:none;margin-top:8px"></div>
      </div>

      <!-- Generate CTA -->
      <div class="ms-card">
        <div class="ms-card-title">💬 Tạo CTA theo Brand</div>
        <button class="ms-primary-btn bc-secondary-btn" id="bc-cta-btn" onclick="BrandClone.generateBrandCTA()">💬 Tạo CTA theo Brand</button>
        <div id="bc-cta-result"  style="display:none;margin-top:6px"></div>
        <div id="bc-hook-result" style="display:none;margin-top:4px"></div>
      </div>

      <!-- Generate short -->
      <div class="ms-card">
        <div class="ms-card-title">🎬 Tạo Short theo Brand</div>
        <button class="ms-primary-btn bc-secondary-btn" onclick="BrandClone.generateBrandShort()">🎬 Tạo Short theo Brand</button>
      </div>

      <!-- Export/Import -->
      <div class="ms-card">
        <div class="ms-card-title">📦 Backup Brand Profile</div>
        <div style="display:flex;gap:6px">
          <button class="ms-snap-new-btn" onclick="BrandClone.exportBrandJSON()" style="flex:1">⬇ Export JSON</button>
          <button class="ms-snap-new-btn" onclick="BrandClone.importBrandJSON()" style="flex:1">⬆ Import JSON</button>
        </div>
      </div>

      ` : ''}

    </div>
  `;
}

function _promptCreateBrand() {
  const name = prompt('Đặt tên Brand của bạn:', 'My Brand');
  if (name === null) return;
  createBrand(name.trim() || 'My Brand');
  _toast('✅ Đã tạo Brand Profile: ' + (name.trim() || 'My Brand'));
}

function _confirmDeleteBrand(id) {
  if (!confirm('Xóa Brand Profile này? Không thể hoàn tác.')) return;
  deleteBrand(id);
  _toast('🗑 Đã xóa Brand Profile');
}

/* ══════════════════════════════════════════════════════════
   12. INIT
   ══════════════════════════════════════════════════════════ */

function init() {
  setTimeout(() => {
    const brand = _getActive();
    if (brand && brand.videosAnalyzed >= 1) showBrandRecommendations();
  }, 5000);
}

/* ══════════════════════════════════════════════════════════
   13. PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.BrandClone = {
  createBrand,
  deleteBrand,
  setActiveBrand,
  trainBrand,
  trainFromCurrentEditor,
  trainFromProjects,
  applyBrandStyle,
  compareToBrand,
  generateBrandCTA,
  generateBrandShort,
  exportBrandJSON,
  importBrandJSON,
  showBrandRecommendations,
  renderDashboard:       _renderDashboard,
  getActive:             _getActive,
  getProfiles:           () => _profiles,
  getLastCompareResult:  () => _lastCompareResult,
  _promptCreateBrand,
  _confirmDeleteBrand,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[BrandClone] Phase 3.1 Brand Clone System loaded');

})();
