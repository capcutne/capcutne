/* ============================================================
   ADVANCED SUBTITLE ENGINE — js/subtitles.js
   Adds: word-level timing, auto line-break, keyword highlights,
   emoji badges, 5 professional templates (TikTok, MrBeast,
   Podcast, Netflix, Gaming).

   Extended subtitle schema:
   {
     id, text, start, dur,
     end,       ← start + dur
     highlight, ← true if any word is highlighted
     emoji,     ← e.g. "🔥"  or null
     style,     ← template key or ""
     words: [{ word, start, end, highlight }]
   }

   All additions are layered ON TOP of the existing system.
   The original _renderSubList / _applySubToPreview are
   overridden via the global scope so every existing caller
   automatically gets the advanced version.
   ============================================================ */

(function () {

/* ── Template definitions ──────────────────────────────── */
const TEMPLATES = {
  tiktok: {
    name: 'TikTok',       icon: '📱', css: 'pv-sub-tiktok',
    wordByWord: true, fontSize: 20, position: 'center',
    maxChars: 35, highlightActive: true
  },
  mrbeast: {
    name: 'MrBeast',      icon: '👑', css: 'pv-sub-mrbeast',
    wordByWord: true, fontSize: 22, position: 'center',
    maxChars: 28, allCaps: true, highlightActive: true
  },
  podcast: {
    name: 'Podcast',      icon: '🎙', css: 'pv-sub-podcast',
    wordByWord: false, fontSize: 13, position: 'bottom', maxChars: 60
  },
  netflix: {
    name: 'Netflix',      icon: '🎬', css: 'pv-sub-netflix',
    wordByWord: false, fontSize: 16, position: 'bottom', maxChars: 42
  },
  gaming: {
    name: 'Gaming',       icon: '🎮', css: 'pv-sub-gaming',
    wordByWord: true, fontSize: 18, position: 'top',
    maxChars: 40, highlightActive: true
  },
  minimal: {
    name: 'Minimal',      icon: '✏️', css: 'pv-sub-minimal',
    wordByWord: false, fontSize: 14, position: 'bottom', maxChars: 50
  },
  documentary: {
    name: 'Documentary',  icon: '🎞', css: 'pv-sub-documentary',
    wordByWord: false, fontSize: 15, position: 'bottom', maxChars: 42
  }
};

let activeTemplate = null;  // key into TEMPLATES or null
let globalKeywords = [];     // words always highlighted

/* ── Helpers ────────────────────────────────────────────── */
function _getSubs () { return (typeof subtitles !== 'undefined') ? subtitles : []; }
function _getHead () { return typeof playhead !== 'undefined' ? playhead : 0; }
function _fmtT (t)   { return (typeof fmtTime === 'function') ? fmtTime(t) : (typeof fmt === 'function' ? fmt(t) : t.toFixed(1)+'s'); }

/* ── Word-level timing ──────────────────────────────────── */
function addWordTimings (sub) {
  // Prefer real Whisper word timestamps from TranscriptEngine when available
  if (typeof TranscriptEngine !== 'undefined' &&
      typeof TranscriptEngine.getSegments === 'function') {
    const segs   = TranscriptEngine.getSegments();
    const subEnd = sub.start + (sub.dur || 3);
    const realWords = [];
    for (const seg of segs) {
      if ((seg.end || seg.start + 5) < sub.start - 0.05 || seg.start > subEnd + 0.05) continue;
      if (seg.words && seg.words.length) {
        for (const w of seg.words) {
          if (w.start >= sub.start - 0.15 && w.end <= subEnd + 0.15) {
            realWords.push({ word: w.word, start: w.start, end: w.end,
              highlight: _wordIsKw(w.word) });
          }
        }
      }
    }
    if (realWords.length) { sub.words = realWords; return sub; }
  }
  // Fallback: even distribution across subtitle duration
  const words = (sub.text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) { sub.words = []; return sub; }
  const dur = sub.dur || Math.max(0.5, (sub.end || 0) - (sub.start || 0)) || 3;
  const tpw = dur / words.length;
  sub.words = words.map((word, i) => ({
    word,
    start: sub.start + i * tpw,
    end:   sub.start + (i + 1) * tpw,
    highlight: _wordIsKw(word)
  }));
  return sub;
}

function _wordIsKw (word) {
  return globalKeywords.some(k => word.toLowerCase().includes(k));
}

/* ── Auto line break ─────────────────────────────────────── */
function autoLineBreak (text, maxChars) {
  const max = maxChars || (activeTemplate && TEMPLATES[activeTemplate] ? TEMPLATES[activeTemplate].maxChars : 42) || 42;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const cand = line ? line + ' ' + w : w;
    if (cand.length > max && line) { lines.push(line); line = w; }
    else line = cand;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/* ── Upgrade a subtitle with new fields ─────────────────── */
function upgradeSubtitle (sub) {
  sub.end = sub.end !== undefined ? sub.end : sub.start + (sub.dur || 3);
  if (sub.highlight  === undefined) sub.highlight  = false;
  if (sub.emoji      === undefined) sub.emoji      = null;
  if (sub.style      === undefined) sub.style      = activeTemplate || '';
  if (!sub.words || !sub.words.length) addWordTimings(sub);
  else sub.words.forEach(w => { w.highlight = _wordIsKw(w.word); });
  return sub;
}

function upgradeAll () {
  _getSubs().forEach(upgradeSubtitle);
}

/* ── Keyword management ──────────────────────────────────── */
function addKeyword (kw) {
  const k = kw.trim().toLowerCase();
  if (k && !globalKeywords.includes(k)) {
    globalKeywords.push(k);
    upgradeAll();
    _renderSubListAdvanced();
    _applySubToPreviewAdvanced();
  }
}
function removeKeyword (kw) {
  globalKeywords = globalKeywords.filter(k => k !== kw.toLowerCase());
  upgradeAll();
  _renderSubListAdvanced();
  _applySubToPreviewAdvanced();
}

/* ── Emoji insertion ─────────────────────────────────────── */
function insertEmoji (sub, emoji) {
  if (!sub) return;
  sub.emoji = emoji || null;
  _renderSubListAdvanced();
  _applySubToPreviewAdvanced();
}

/* ── Template application ────────────────────────────────── */
function applyTemplate (name, el) {
  document.querySelectorAll('.sub-tpl-item').forEach(i => i.classList.remove('on'));

  if (activeTemplate === name) {
    activeTemplate = null;
    _resetPreviewStyle();
    upgradeAll();
    _renderSubListAdvanced();
    _applySubToPreviewAdvanced();
    if (typeof toast === 'function') toast('Template reset');
    return;
  }

  activeTemplate = name;
  const tpl = TEMPLATES[name];
  if (!tpl) return;
  if (el) el.classList.add('on');

  // font size
  if (typeof setSubFontSize === 'function') setSubFontSize(tpl.fontSize);
  const fsSlider = document.querySelector('input[oninput*="setSubFontSize"]');
  if (fsSlider) {
    fsSlider.value = tpl.fontSize;
    const fsVal = document.getElementById('sub-fs-v');
    if (fsVal) fsVal.textContent = tpl.fontSize + 'px';
  }

  // position
  const posBtn = document.querySelector(`.align-btn[onclick*="${tpl.position}"]`);
  if (posBtn) posBtn.click();

  // preview CSS
  const ph = document.getElementById('ph-sub');
  if (ph) {
    ph.className = 'pv-sub ' + tpl.css;
    ph.style.fontSize = tpl.fontSize + 'px';
  }

  // mark all existing subtitles with this template
  _getSubs().forEach(s => { s.style = name; });

  upgradeAll();
  _renderSubListAdvanced();
  _applySubToPreviewAdvanced();
  _initKwSection();

  if (typeof toast === 'function') toast('✅ Template: ' + tpl.name);
}

function _resetPreviewStyle () {
  const ph = document.getElementById('ph-sub');
  if (ph) { ph.className = 'pv-sub'; }
}

/* ── Advanced preview renderer ───────────────────────────── */
function _applySubToPreviewAdvanced () {
  const ph = document.getElementById('ph-sub');
  if (!ph) return;
  const t = _getHead();
  const cur = _getSubs().find(s => t >= s.start && t < s.start + (s.dur || 3));

  if (!cur) {
    ph.innerHTML = '';
    ph.style.display = 'none';
    _hideEmojiOverlay();
    return;
  }

  ph.style.display = 'block';

  const tpl = activeTemplate ? TEMPLATES[activeTemplate] : null;
  ph.className = 'pv-sub' + (tpl ? ' ' + tpl.css : '');
  ph.style.fontSize = (tpl ? tpl.fontSize : (typeof subFontSize !== 'undefined' ? subFontSize : 16)) + 'px';

  // Ensure word timings are up-to-date
  if (!cur.words || !cur.words.length) addWordTimings(cur);

  // Karaoke animation forces word-by-word mode so active-word highlight fires
  const karaokeActive = typeof window.SubtitlePro !== 'undefined' &&
    typeof window.SubtitlePro.getActiveAnimation === 'function' &&
    window.SubtitlePro.getActiveAnimation() === 'karaoke';
  const useWBW = !!(tpl?.wordByWord) || karaokeActive;
  let displayText = tpl?.allCaps ? (cur.text || '').toUpperCase() : (cur.text || '');
  displayText = autoLineBreak(displayText, tpl?.maxChars);

  if (useWBW && cur.words?.length) {
    // word-by-word render
    const parts = [];
    cur.words.forEach((w, i) => {
      if (i > 0) parts.push(' ');
      const isActive  = t >= w.start && t < w.end;
      const isKw      = w.highlight;
      const cls = ['sub-word', isActive ? 'wbw-active' : '', isKw ? 'kw' : ''].filter(Boolean).join(' ');
      const txt = tpl?.allCaps ? w.word.toUpperCase() : w.word;
      parts.push(`<span class="${cls}">${_esc(txt)}</span>`);
    });
    ph.innerHTML = parts.join('');
  } else {
    // Plain render with optional keyword spans
    const lineHtml = displayText.split('\n').map(line => {
      const wordHtml = line.split(' ').map(w => {
        if (!w) return '';
        const isKw = _wordIsKw(w);
        return `<span class="sub-word${isKw ? ' kw' : ''}">${_esc(w)}</span>`;
      }).join(' ');
      return wordHtml;
    }).join('<br>');
    ph.innerHTML = lineHtml;
  }

  _showEmojiOverlay(cur.emoji);
}

function _esc (s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── Emoji overlay on preview ────────────────────────────── */
function _showEmojiOverlay (emoji) {
  let el = document.getElementById('ph-sub-emoji');
  if (!el) {
    el = document.createElement('span');
    el.id = 'ph-sub-emoji';
    el.style.cssText = 'position:absolute;right:-10px;top:-10px;font-size:18px;pointer-events:none;z-index:10;filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))';
    const ph = document.getElementById('ph-sub');
    if (ph) { ph.style.position = 'relative'; ph.appendChild(el); }
  }
  el.textContent = emoji || '';
  el.style.display = emoji ? 'inline' : 'none';
}
function _hideEmojiOverlay () { _showEmojiOverlay(null); }

/* ── Advanced subtitle list renderer ─────────────────────── */
function _renderSubListAdvanced () {
  const list = document.getElementById('sub-list');
  if (!list) return;
  const subs = _getSubs();
  if (!subs.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--t3);text-align:center;padding:8px 0">Chưa có phụ đề.</div>';
    return;
  }

  list.innerHTML = subs.map(s => {
    const tplName = s.style && TEMPLATES[s.style] ? TEMPLATES[s.style].name : null;
    const wc      = s.words ? s.words.length : (s.text || '').split(/\s+/).filter(Boolean).length;
    const hasKw   = !!(s.words && s.words.some(w => w.highlight));
    const emojis  = ['🔥','⚡','💯','🎯','💬','😂','🙌','👀','✨','❌'];

    return `<div class="sub-item adv-sub-item" data-sub="${s.id}">
  <div class="sub-time" onclick="seekTo(${s.start})">${_fmtT(s.start)} — ${_fmtT(s.start + (s.dur||3))}</div>
  <div class="sub-text-row">
    <div class="sub-text-edit" contenteditable="true"
      onblur="window.SubEngine._onTextBlur('${s.id}',this.textContent)"
      onfocus="seekTo(${s.start})">${_esc(s.text||'')}</div>
    <button class="sub-del" onclick="deleteSubtitle('${s.id}')" title="Xóa">✕</button>
  </div>
  <div class="sub-badges">
    ${tplName ? `<span class="sub-badge tpl">${TEMPLATES[s.style].icon} ${tplName}</span>` : ''}
    ${hasKw   ? `<span class="sub-badge kw-badge">🔑 kw</span>` : ''}
    <span class="sub-badge">${wc}w</span>
    ${s.emoji ? `<span class="sub-badge">${s.emoji}</span>` : ''}
  </div>
  <div class="sub-emoji-row">
    ${emojis.map(e => `<span class="sub-emoji-btn${s.emoji===e?' on':''}" 
      onclick="window.SubEngine.insertEmoji(window.SubEngine._byId('${s.id}'),'${e}')" title="${e}">${e}</span>`).join('')}
    <span class="sub-emoji-btn" style="font-size:10px;color:var(--t3)"
      onclick="window.SubEngine.insertEmoji(window.SubEngine._byId('${s.id}'),null)">✕</span>
  </div>
</div>`;
  }).join('');
}

/* ── Keyword section init ────────────────────────────────── */
function _initKwSection () {
  const sec = document.getElementById('sub-kw-section');
  if (!sec) return;
  sec.innerHTML = `
<div class="ps-title">Keyword Highlights</div>
<div class="sub-kw-row">
  <input class="sub-kw-input" id="sub-kw-input" placeholder="Type a word then Enter…"
    onkeydown="if(event.key==='Enter'&&this.value.trim()){window.SubEngine.addKeyword(this.value);this.value='';window.SubEngine._renderKwTags()}">
  <button class="sub-kw-add-btn"
    onclick="var i=document.getElementById('sub-kw-input');if(i&&i.value.trim()){window.SubEngine.addKeyword(i.value);i.value='';window.SubEngine._renderKwTags()}">+</button>
</div>
<div id="sub-kw-tags"></div>`;
  _renderKwTags();
}

function _renderKwTags () {
  const el = document.getElementById('sub-kw-tags');
  if (!el) return;
  if (!globalKeywords.length) {
    el.innerHTML = '<div style="font-size:10px;color:var(--t3);padding:3px 0">No keywords yet.</div>';
    return;
  }
  el.innerHTML = globalKeywords.map(kw => `
    <span class="sub-kw-tag" onclick="window.SubEngine.removeKeyword('${kw}')">
      ${_esc(kw)} <span>✕</span>
    </span>`).join('');
}

/* ── Override existing global functions ───────────────────── */
// These work because function declarations in non-module scripts
// are writable properties on window (the global scope object).
window._renderSubList       = _renderSubListAdvanced;
window._applySubToPreview   = _applySubToPreviewAdvanced;

/* Wrap addSubtitleAtPlayhead to auto-upgrade new subs */
const _origAddSub = window.addSubtitleAtPlayhead;
window.addSubtitleAtPlayhead = function () {
  if (typeof _origAddSub === 'function') _origAddSub();
  const subs = _getSubs();
  if (subs.length) upgradeSubtitle(subs[subs.length - 1]);
  _renderSubListAdvanced();
};

/* Wrap generateSubtitles to auto-upgrade */
const _origGenSub = window.generateSubtitles;
window.generateSubtitles = function () {
  if (typeof _origGenSub === 'function') _origGenSub();
  upgradeAll();
  _renderSubListAdvanced();
};

/* Word-by-word highlight ticker during playback */
setInterval(_applySubToPreviewAdvanced, 80);

/* ── Public API ──────────────────────────────────────────── */
window.SubEngine = {
  applyTemplate,
  addWordTimings,
  autoLineBreak,
  addKeyword,
  removeKeyword,
  insertEmoji,
  upgradeSubtitle,
  upgradeAll,
  getActiveTemplate: () => activeTemplate,
  getKeywords: () => [...globalKeywords],

  /* used by inline onclick handlers */
  _byId: id => _getSubs().find(s => s.id === id) || null,
  _renderKwTags,
  _renderSubListAdvanced,
  _onTextBlur: function (id, text) {
    const s = _getSubs().find(x => x.id === id);
    if (!s) return;
    s.text = text.trim();
    s.words = null;
    addWordTimings(s);
    upgradeSubtitle(s);
    _applySubToPreviewAdvanced();
  }
};

/* Initialize keyword section if subtitle panel is already open */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    _renderSubListAdvanced();
    _initKwSection();
  }, 300);
});

console.log('[SubEngine] Advanced Subtitle Engine v1.1 loaded');

})();
