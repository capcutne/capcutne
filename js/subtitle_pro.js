/* ============================================================
   SUBTITLE PRO — js/subtitle_pro.js
   Phase 2.1: Animations · Auto-Style AI · Bulk Restyle ·
              VTT/JSON Export · Emoji Intelligence ·
              Keyword Auto-Detection · New Action Types

   Depends on: SubEngine (subtitles.js), subtitles[], tracks[],
               toast(), playhead, nextSubId
   ============================================================ */

(function () {

/* ══════════════════════════════════════════════════════════
   1. ANIMATION SYSTEM
   ══════════════════════════════════════════════════════════ */

const ANIMATIONS = {
  none:     { name: 'None',    icon: '◻',  css: '',                  label: 'Không' },
  fade:     { name: 'Fade',    icon: '🌫',  css: 'sub-anim-fade',     label: 'Mờ dần' },
  pop:      { name: 'Pop',     icon: '💥',  css: 'sub-anim-pop',      label: 'Nảy lên' },
  bounce:   { name: 'Bounce',  icon: '🏀',  css: 'sub-anim-bounce',   label: 'Rung lắc' },
  slide:    { name: 'Slide',   icon: '➡',  css: 'sub-anim-slide',    label: 'Trượt vào' },
  karaoke:  { name: 'Karaoke', icon: '🎤',  css: 'sub-anim-karaoke',  label: 'Karaoke' },
};

let _activeAnimation = 'fade';

function setAnimation(key) {
  _activeAnimation = ANIMATIONS[key] ? key : 'none';
  _updateAnimBtns();
  _applyAnimToPreviewEl();
  if (typeof toast === 'function') toast('✨ Animation: ' + ANIMATIONS[_activeAnimation].name);
}

function _updateAnimBtns() {
  document.querySelectorAll('.sub-anim-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.anim === _activeAnimation);
  });
}

function _applyAnimToPreviewEl() {
  const ph = document.getElementById('ph-sub');
  if (!ph) return;
  Object.values(ANIMATIONS).forEach(a => { if (a.css) ph.classList.remove(a.css); });
  const anim = ANIMATIONS[_activeAnimation];
  if (anim && anim.css) ph.classList.add(anim.css);
}

function getActiveAnimation() { return _activeAnimation; }

/* ══════════════════════════════════════════════════════════
   2. EMOJI INTELLIGENCE
   ══════════════════════════════════════════════════════════ */

const EMOJI_MAP = [
  { pattern: /\$[\d,]+|\d+\s*(?:đồng|vnđ|usd|dollar)/i,      emoji: '💰' },
  { pattern: /\d+\s*%/,                                         emoji: '📊' },
  { pattern: /fire|🔥|viral|hot|bùng|cháy/i,                   emoji: '🔥' },
  { pattern: /warning|cảnh báo|danger|nguy hiểm/i,             emoji: '⚠️' },
  { pattern: /growth|tăng trưởng|profit|lợi nhuận|earn|kiếm/i, emoji: '📈' },
  { pattern: /love|yêu|heart|trái tim/i,                        emoji: '❤️' },
  { pattern: /win|chiến thắng|victory|thắng/i,                  emoji: '🏆' },
  { pattern: /fast|nhanh|speed|tốc độ/i,                        emoji: '⚡' },
  { pattern: /music|nhạc|song|bài hát/i,                        emoji: '🎵' },
  { pattern: /food|ăn|món|recipe|công thức/i,                   emoji: '🍜' },
  { pattern: /travel|du lịch|trip|chuyến đi/i,                  emoji: '✈️' },
  { pattern: /wow|amazing|tuyệt|incredible|unbelievable/i,      emoji: '😱' },
  { pattern: /funny|hài|laugh|cười/i,                           emoji: '😂' },
  { pattern: /secret|bí mật|hidden|ẩn/i,                        emoji: '🤫' },
  { pattern: /top\s*\d+|number\s*\d+/i,                         emoji: '🎯' },
];

function detectEmoji(text) {
  if (!text) return null;
  for (const { pattern, emoji } of EMOJI_MAP) {
    if (pattern.test(text)) return emoji;
  }
  return null;
}

function autoEmojiAll() {
  const subs = _getSubs();
  let count = 0;
  subs.forEach(s => {
    const e = detectEmoji(s.text);
    if (e && !s.emoji) { s.emoji = e; count++; }
  });
  if (typeof window.SubEngine !== 'undefined') {
    window.SubEngine.upgradeAll();
    window.SubEngine._renderSubListAdvanced();
  }
  if (typeof toast === 'function') toast(`✨ Auto emoji: ${count} subtitles tagged`);
}

/* ══════════════════════════════════════════════════════════
   3. KEYWORD AUTO-DETECTION
   ══════════════════════════════════════════════════════════ */

const KW_PATTERNS = [
  /\$[\d,]+(?:\.\d+)?/g,                      // money: $10,000
  /\d+(?:\.\d+)?\s*%/g,                        // percentages: 50%
  /\b\d{4,}\b/g,                               // big numbers: 10000
  /\b(?:free|now|today|instant|fast|best|top|new|only|limited|exclusive)\b/gi,
  /\b(?:miễn phí|ngay|hôm nay|nhanh|tốt nhất|mới|chỉ|độc quyền)\b/gi,
];

function extractAutoKeywords(text) {
  const found = new Set();
  if (!text) return [];
  KW_PATTERNS.forEach(re => {
    const matches = text.match(re);
    if (matches) matches.forEach(m => found.add(m.toLowerCase().trim()));
  });
  return [...found];
}

function autoDetectKeywords() {
  const subs = _getSubs();
  const kws = new Set();
  subs.forEach(s => extractAutoKeywords(s.text).forEach(k => kws.add(k)));
  if (!kws.size) {
    if (typeof toast === 'function') toast('⚠️ No auto-keywords found');
    return;
  }
  const engine = window.SubEngine;
  if (!engine) return;
  kws.forEach(k => {
    if (!engine.getKeywords().includes(k)) engine.addKeyword(k);
  });
  if (typeof toast === 'function') toast(`🔑 Auto-detected ${kws.size} keywords`);
}

/* ══════════════════════════════════════════════════════════
   4. AUTO STYLING — AI recommends a template
   ══════════════════════════════════════════════════════════ */

async function autoStyle() {
  const subs = _getSubs();
  if (!subs.length) {
    if (typeof toast === 'function') toast('⚠️ No subtitles to analyze');
    return;
  }

  const btn = document.getElementById('sub-auto-style-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyzing…'; }

  const sample = subs.slice(0, 10).map(s => s.text).join(' ');
  try {
    const res = await fetch('/ai/auto-style', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sample })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const tpl    = data.template || 'tiktok';
    const reason = data.reason   || '';

    if (window.SubEngine) {
      const el = document.querySelector(`.sub-tpl-item.tpl-${tpl}`);
      window.SubEngine.applyTemplate(tpl, el || null);
    }
    if (typeof toast === 'function') toast(`🤖 AI chose: ${tpl} — ${reason}`);
    _showAutoStyleResult(tpl, reason);
  } catch (e) {
    if (typeof toast === 'function') toast('❌ Auto-style: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 AI Auto-Style'; }
  }
}

function _showAutoStyleResult(tpl, reason) {
  const el = document.getElementById('sub-auto-style-result');
  if (!el) return;
  el.textContent = `Recommended: ${tpl} — ${reason}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/* ══════════════════════════════════════════════════════════
   5. BULK RESTYLE — apply new template without losing timing
   ══════════════════════════════════════════════════════════ */

function bulkRestyle(templateKey) {
  const subs = _getSubs();
  if (!subs.length) {
    if (typeof toast === 'function') toast('⚠️ No subtitles to restyle');
    return;
  }
  subs.forEach(s => {
    s.style = templateKey || '';
    // preserve timing — only change visual fields
  });
  if (window.SubEngine) {
    const el = document.querySelector(`.sub-tpl-item.tpl-${templateKey}`);
    window.SubEngine.applyTemplate(templateKey, el || null);
  }
  if (typeof toast === 'function') toast(`✅ Restyled ${subs.length} subtitles → ${templateKey}`);
}

function bulkRegenerate() {
  const subs = _getSubs();
  if (!subs.length) {
    if (typeof toast === 'function') toast('⚠️ No subtitles — generate first');
    return;
  }
  // Re-run word timings + keyword detection on all existing subtitles (preserving timing)
  if (window.SubEngine) {
    subs.forEach(s => {
      s.words = null; // force re-compute
      window.SubEngine.upgradeSubtitle(s);
    });
    window.SubEngine._renderSubListAdvanced();
  }
  autoDetectKeywords();
  autoEmojiAll();
  if (typeof toast === 'function') toast(`🔄 Regenerated ${subs.length} subtitles`);
}

/* ══════════════════════════════════════════════════════════
   6. EXPORT: VTT + JSON
   ══════════════════════════════════════════════════════════ */

function _toVttTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}

function exportVTT() {
  const subs = _getSubs();
  if (!subs.length) { if (typeof toast === 'function') toast('⚠️ No subtitles to export'); return; }
  let out = 'WEBVTT\n\n';
  subs.forEach((s, i) => {
    const start = s.start || 0;
    const end   = start + (s.dur || 3);
    out += `${i + 1}\n${_toVttTime(start)} --> ${_toVttTime(end)}\n${s.text || ''}\n\n`;
  });
  _download(out, 'subtitles.vtt', 'text/vtt');
  if (typeof toast === 'function') toast('✅ Exported subtitles.vtt');
}

function exportJSON() {
  const subs = _getSubs();
  if (!subs.length) { if (typeof toast === 'function') toast('⚠️ No subtitles to export'); return; }
  const payload = {
    version: '2.1',
    exportedAt: new Date().toISOString(),
    count: subs.length,
    subtitles: subs.map(s => ({
      id:    s.id,
      start: s.start,
      end:   s.start + (s.dur || 3),
      dur:   s.dur || 3,
      text:  s.text || '',
      style: s.style || '',
      emoji: s.emoji || null,
      words: (s.words || []).map(w => ({ word: w.word, start: w.start, end: w.end, highlight: !!w.highlight }))
    }))
  };
  _download(JSON.stringify(payload, null, 2), 'subtitles.json', 'application/json');
  if (typeof toast === 'function') toast('✅ Exported subtitles.json');
}

function _download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

/* ══════════════════════════════════════════════════════════
   7. CSS INJECTION
   ══════════════════════════════════════════════════════════ */

function _injectStyles() {
  if (document.getElementById('sub-pro-styles')) return;
  const st = document.createElement('style');
  st.id = 'sub-pro-styles';
  st.textContent = `

/* ── Template grid: 7 columns ── */
.sub-tpl-grid { grid-template-columns: repeat(7, 1fr) !important; }

/* ── Minimal template ── */
.sub-tpl-item.tpl-minimal .sub-tpl-preview {
  background: transparent; color: #e0e0e0; font-weight: 300; letter-spacing: .5px; border: none;
}
.pv-sub-minimal {
  background: transparent !important; color: #fff !important; font-weight: 300 !important;
  font-size: 14px !important; letter-spacing: .3px !important; padding: 3px 12px !important;
  text-shadow: 0 1px 4px rgba(0,0,0,.8) !important;
}

/* ── Documentary template ── */
.sub-tpl-item.tpl-documentary .sub-tpl-preview {
  background: rgba(0,0,0,.8); color: #d4c89a; font-weight: 500; border: 1px solid rgba(212,200,154,.3);
}
.pv-sub-documentary {
  background: rgba(0,0,0,.75) !important; color: #d4c89a !important; font-weight: 500 !important;
  font-size: 15px !important; font-style: italic !important; letter-spacing: .4px !important;
  border-left: 3px solid #d4a017 !important; padding: 5px 14px !important; border-radius: 0 4px 4px 0 !important;
}

/* ── Animation picker ── */
.sub-anim-row {
  display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;
}
.sub-anim-btn {
  flex: 1; min-width: 46px; background: var(--bg3); border: 1px solid var(--border2);
  border-radius: 6px; color: var(--t2); font-size: 10px; padding: 5px 4px;
  cursor: pointer; text-align: center; transition: border-color .12s, background .12s;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.sub-anim-btn:hover { background: var(--bg4); color: var(--t1); }
.sub-anim-btn.on { border-color: var(--accent); background: var(--accentdim); color: var(--accent2); }
.sub-anim-icon { font-size: 13px; }
.sub-anim-label { font-size: 9px; }

/* ── Auto-style result ── */
#sub-auto-style-result {
  display: none; font-size: 10px; color: var(--accent2);
  background: var(--accentdim); border-radius: 5px;
  padding: 5px 9px; margin-top: 6px; line-height: 1.5;
}

/* ── Subtitle animations ── */
@keyframes sub-fade-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes sub-pop      { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@keyframes sub-bounce   { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } 60% { transform: translateY(-3px); } }
@keyframes sub-slide-in { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

.sub-anim-fade    { animation: sub-fade-in .35s ease forwards; }
.sub-anim-pop     { animation: sub-pop .4s cubic-bezier(.34,1.56,.64,1) forwards; }
.sub-anim-bounce  { animation: sub-bounce .5s ease; }
.sub-anim-slide   { animation: sub-slide-in .35s ease forwards; }
.sub-anim-karaoke { background: linear-gradient(90deg,rgba(255,220,0,.85) 50%,rgba(0,0,0,.6) 50%) !important;
  background-size: 200% 100% !important; animation: karaoke-slide 3s linear infinite !important; }

/* ── Bulk regen / export row ── */
.sub-bulk-row {
  display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px;
}
.sub-bulk-btn {
  flex: 1; min-width: 70px; background: var(--bg3); border: 1px solid var(--border2);
  border-radius: 6px; color: var(--t2); font-size: 10px; padding: 6px 5px;
  cursor: pointer; text-align: center; transition: background .12s, color .12s;
}
.sub-bulk-btn:hover { background: var(--bg4); color: var(--t1); }
.sub-bulk-btn.primary {
  background: var(--accentdim); border-color: rgba(212,160,23,.4); color: var(--accent2);
}
.sub-bulk-btn.primary:hover { background: rgba(212,160,23,.2); }
.sub-auto-style-btn {
  width: 100%; background: linear-gradient(135deg, #1a1040, #2a1860);
  border: 1px solid rgba(130,80,255,.4); border-radius: 7px;
  color: #c0a0ff; font-size: 11px; font-weight: 600;
  padding: 8px; cursor: pointer; transition: opacity .15s; margin-top: 6px;
}
.sub-auto-style-btn:hover { opacity: .88; }
.sub-auto-style-btn:disabled { opacity: .4; cursor: not-allowed; }
`;
  document.head.appendChild(st);
}

/* ══════════════════════════════════════════════════════════
   8. UI INJECTION — add panels into existing subtitle panel
   ══════════════════════════════════════════════════════════ */

function _injectUI() {
  _injectAnimationSection();
  _injectBulkSection();
  _injectExportExtension();
  _injectAutoStyleBtn();
}

/* -- Animation picker after keyword section -- */
function _injectAnimationSection() {
  if (document.getElementById('sub-anim-section')) return;
  const kwSec = document.getElementById('sub-kw-section');
  if (!kwSec) return;

  const divider = document.createElement('div');
  divider.className = 'ps-div';

  const sec = document.createElement('div');
  sec.className = 'ps';
  sec.id = 'sub-anim-section';
  sec.innerHTML = `
<div class="ps-title">Subtitle Animation</div>
<div class="sub-anim-row" id="sub-anim-row">
  ${Object.entries(ANIMATIONS).map(([key, a]) => `
    <button class="sub-anim-btn${key === _activeAnimation ? ' on' : ''}" data-anim="${key}"
      onclick="window.SubtitlePro.setAnimation('${key}')">
      <span class="sub-anim-icon">${a.icon}</span>
      <span class="sub-anim-label">${a.label}</span>
    </button>`).join('')}
</div>`;

  const parent = kwSec.parentNode;
  const insertAfter = kwSec.nextSibling;
  parent.insertBefore(divider, insertAfter);
  parent.insertBefore(sec, divider.nextSibling);
}

/* -- Bulk restyle / regenerate section -- */
function _injectBulkSection() {
  if (document.getElementById('sub-bulk-section')) return;
  const animSec = document.getElementById('sub-anim-section');
  if (!animSec) return;

  const divider = document.createElement('div');
  divider.className = 'ps-div';

  const sec = document.createElement('div');
  sec.className = 'ps';
  sec.id = 'sub-bulk-section';
  sec.innerHTML = `
<div class="ps-title">Bulk Actions</div>
<div class="sub-bulk-row">
  <button class="sub-bulk-btn primary" onclick="window.SubtitlePro.bulkRegenerate()" title="Re-apply word timings, keywords & emojis to all subtitles">🔄 Regenerate All</button>
  <button class="sub-bulk-btn" onclick="window.SubtitlePro.autoDetectKeywords()" title="Scan text and auto-highlight numbers, money, key phrases">🔑 Auto Keywords</button>
  <button class="sub-bulk-btn" onclick="window.SubtitlePro.autoEmojiAll()" title="Auto-tag every subtitle with a context-aware emoji">😀 Auto Emoji</button>
</div>`;

  const parent = animSec.parentNode;
  const insertAfter = animSec.nextSibling;
  parent.insertBefore(divider, insertAfter);
  parent.insertBefore(sec, divider.nextSibling);
}

/* -- Extra export buttons (VTT, JSON) next to SRT button -- */
function _injectExportExtension() {
  if (document.getElementById('sub-export-extra')) return;
  // Find the exportSRT button row
  const srtBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Export SRT'));
  if (!srtBtn) return;
  const row = srtBtn.parentElement;
  if (!row) return;

  const extra = document.createElement('div');
  extra.id = 'sub-export-extra';
  extra.style.cssText = 'display:flex;gap:6px;margin-top:6px';
  extra.innerHTML = `
  <button class="add-ov-btn" style="flex:1;font-size:11px" onclick="window.SubtitlePro.exportVTT()">📋 Export VTT</button>
  <button class="add-ov-btn" style="flex:1;font-size:11px" onclick="window.SubtitlePro.exportJSON()">{ } Export JSON</button>`;
  row.parentNode.insertBefore(extra, row.nextSibling);
}

/* -- Auto-style button inside template section -- */
function _injectAutoStyleBtn() {
  if (document.getElementById('sub-auto-style-btn')) return;
  const tplGrid = document.querySelector('.sub-tpl-grid');
  if (!tplGrid) return;
  const tplSection = tplGrid.closest('.ps');
  if (!tplSection) return;

  const btn = document.createElement('button');
  btn.id = 'sub-auto-style-btn';
  btn.className = 'sub-auto-style-btn';
  btn.textContent = '🤖 AI Auto-Style';
  btn.onclick = () => window.SubtitlePro.autoStyle();

  const result = document.createElement('div');
  result.id = 'sub-auto-style-result';

  tplSection.appendChild(btn);
  tplSection.appendChild(result);
}

/* ══════════════════════════════════════════════════════════
   9. ANIMATION LOOP — apply anim class when sub changes
   ══════════════════════════════════════════════════════════ */

let _lastSubId = null;
function _animTick() {
  const subs = _getSubs();
  const t = typeof playhead !== 'undefined' ? playhead : 0;
  const cur = subs.find(s => t >= s.start && t < s.start + (s.dur || 3));
  const curId = cur ? cur.id : null;

  if (curId !== _lastSubId) {
    _lastSubId = curId;
    const ph = document.getElementById('ph-sub');
    if (ph) {
      const anim = ANIMATIONS[_activeAnimation];
      if (anim && anim.css) {
        ph.classList.remove(anim.css);
        void ph.offsetWidth; // force reflow to restart animation
        ph.classList.add(anim.css);
      }
    }
  }
}
setInterval(_animTick, 80);

/* ══════════════════════════════════════════════════════════
   10. HELPER
   ══════════════════════════════════════════════════════════ */

function _getSubs() { return typeof subtitles !== 'undefined' ? subtitles : []; }

/* ══════════════════════════════════════════════════════════
   11. INIT
   ══════════════════════════════════════════════════════════ */

function _init() {
  _injectStyles();

  // Wait for SubEngine + DOM to be ready
  const tryInject = () => {
    if (window.SubEngine && document.getElementById('sub-kw-section')) {
      _injectUI();
    } else {
      setTimeout(tryInject, 300);
    }
  };
  tryInject();
}

document.addEventListener('DOMContentLoaded', _init);
setTimeout(_init, 500); // fallback

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.SubtitlePro = {
  setAnimation,
  getActiveAnimation,
  autoStyle,
  autoEmojiAll,
  autoDetectKeywords,
  detectEmoji,
  extractAutoKeywords,
  bulkRestyle,
  bulkRegenerate,
  exportVTT,
  exportJSON,
  ANIMATIONS,
};

console.log('[SubtitlePro] Phase 2.1 loaded — animations, auto-style, bulk actions, VTT/JSON export');

})();
