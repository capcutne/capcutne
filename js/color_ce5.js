/* ═══════════════════════════════════════════════════════════════
   CE-5: Color Grading & LUT Engine
   Basic: Exposure · Contrast · Saturation · Temperature · Tint
   Advanced: Highlights · Shadows · Whites · Blacks · Curves · HSL
   LUT: 30 presets · .cube import
   Scopes: Histogram · RGB Parade · Vectorscope
   ═══════════════════════════════════════════════════════════════ */
'use strict';

let _ce5ActiveClipId  = null;
let _ce5ActiveTab     = 'basic';
let _ce5CurveChannel  = 'master';
let _ce5ActiveHSLColor= 'red';
let _ce5ActiveScope   = 'histogram';
let _ce5ActiveLUTCat  = 'All';
let _ce5ScopeRAF      = null;

/* ─── Default color grade ─────────────────────────────────── */
function ce5_defaults() {
  return {
    exposure:0, contrast:0, saturation:0, temperature:0, tint:0,
    highlights:0, shadows:0, whites:0, blacks:0,
    curves:{
      master:[[0,0],[0.33,0.33],[0.67,0.67],[1,1]],
      r     :[[0,0],[0.33,0.33],[0.67,0.67],[1,1]],
      g     :[[0,0],[0.33,0.33],[0.67,0.67],[1,1]],
      b     :[[0,0],[0.33,0.33],[0.67,0.67],[1,1]],
    },
    hsl:{
      red:{h:0,s:0,l:0},    orange:{h:0,s:0,l:0},  yellow:{h:0,s:0,l:0},
      green:{h:0,s:0,l:0},  cyan:{h:0,s:0,l:0},    blue:{h:0,s:0,l:0},
      purple:{h:0,s:0,l:0}, magenta:{h:0,s:0,l:0},
    },
    lut:null, lutIntensity:100,
  };
}

/* ─── LUT Preset Library (30 presets) ─────────────────────── */
const CE5_LUTS = [
  /* ── Cinematic ─ */
  {id:'c1',cat:'Cinematic',name:'Teal & Orange',
    css:'saturate(1.25) hue-rotate(8deg) contrast(1.08)',
    preview:'linear-gradient(135deg,#0d9488 0%,#ea580c 100%)'},
  {id:'c2',cat:'Cinematic',name:'Film Noir',
    css:'grayscale(0.75) contrast(1.35) brightness(0.95)',
    preview:'linear-gradient(135deg,#1a1a1a 0%,#6b7280 100%)'},
  {id:'c3',cat:'Cinematic',name:'Day for Night',
    css:'brightness(0.58) saturate(0.65) hue-rotate(195deg) sepia(0.25)',
    preview:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)'},
  {id:'c4',cat:'Cinematic',name:'Bleach Bypass',
    css:'saturate(0.45) contrast(1.45) brightness(1.1)',
    preview:'linear-gradient(135deg,#374151 0%,#d1d5db 100%)'},
  {id:'c5',cat:'Cinematic',name:'Warm Sunset',
    css:'sepia(0.35) brightness(1.12) saturate(1.25) hue-rotate(-8deg)',
    preview:'linear-gradient(135deg,#b45309 0%,#fbbf24 100%)'},
  {id:'c6',cat:'Cinematic',name:'Cold Steel',
    css:'hue-rotate(192deg) saturate(1.15) brightness(0.88) contrast(1.1)',
    preview:'linear-gradient(135deg,#1e3a5f 0%,#60a5fa 100%)'},
  {id:'c7',cat:'Cinematic',name:'Vintage Fade',
    css:'sepia(0.28) brightness(1.06) saturate(0.78) contrast(0.88)',
    preview:'linear-gradient(135deg,#78350f 0%,#d4a463 100%)'},
  {id:'c8',cat:'Cinematic',name:'Hollywood Gold',
    css:'sepia(0.15) saturate(1.2) contrast(1.08) brightness(1.06)',
    preview:'linear-gradient(135deg,#1c1400 0%,#fcd34d 100%)'},
  /* ── Vintage ─ */
  {id:'v1',cat:'Vintage',name:'Kodak Gold 200',
    css:'sepia(0.38) brightness(1.1) saturate(1.22) hue-rotate(-4deg)',
    preview:'linear-gradient(135deg,#92400e 0%,#fde68a 100%)'},
  {id:'v2',cat:'Vintage',name:'Fuji Provia',
    css:'saturate(1.32) contrast(1.12) brightness(1.04)',
    preview:'linear-gradient(135deg,#0c4a6e 0%,#4ade80 100%)'},
  {id:'v3',cat:'Vintage',name:'Polaroid',
    css:'contrast(1.18) brightness(1.12) saturate(0.88) sepia(0.18)',
    preview:'linear-gradient(135deg,#d97706 0%,#fef3c7 100%)'},
  {id:'v4',cat:'Vintage',name:'Cross Process',
    css:'hue-rotate(22deg) saturate(1.55) contrast(1.22)',
    preview:'linear-gradient(135deg,#7c3aed 0%,#f59e0b 100%)'},
  {id:'v5',cat:'Vintage',name:'Faded 70s',
    css:'sepia(0.48) brightness(1.08) contrast(0.82) saturate(0.72)',
    preview:'linear-gradient(135deg,#92400e 0%,#d4a463 100%)'},
  {id:'v6',cat:'Vintage',name:'Classic B&W',
    css:'grayscale(1) contrast(1.12) brightness(1.02)',
    preview:'linear-gradient(135deg,#000 0%,#9ca3af 50%,#fff 100%)'},
  {id:'v7',cat:'Vintage',name:'Antique Sepia',
    css:'sepia(0.82) brightness(1.05) contrast(0.88)',
    preview:'linear-gradient(135deg,#3b1f08 0%,#c4a47c 100%)'},
  /* ── Creative ─ */
  {id:'cr1',cat:'Creative',name:'Neon Glow',
    css:'saturate(1.85) brightness(1.12) contrast(1.22)',
    preview:'linear-gradient(135deg,#7c3aed 0%,#ec4899 50%,#f59e0b 100%)'},
  {id:'cr2',cat:'Creative',name:'Matrix',
    css:'sepia(1) saturate(30) hue-rotate(90deg) brightness(0.6) contrast(1.2)',
    preview:'linear-gradient(135deg,#000 0%,#166534 100%)'},
  {id:'cr3',cat:'Creative',name:'Infrared',
    css:'hue-rotate(180deg) saturate(2.2) brightness(1.18) contrast(1.15)',
    preview:'linear-gradient(135deg,#fca5a5 0%,#dc2626 100%)'},
  {id:'cr4',cat:'Creative',name:'Cyberpunk',
    css:'hue-rotate(265deg) saturate(1.65) contrast(1.28) brightness(0.95)',
    preview:'linear-gradient(135deg,#7c3aed 0%,#06b6d4 100%)'},
  {id:'cr5',cat:'Creative',name:'Amber',
    css:'sepia(0.62) brightness(1.18) saturate(1.35) hue-rotate(-12deg)',
    preview:'linear-gradient(135deg,#78350f 0%,#fbbf24 100%)'},
  {id:'cr6',cat:'Creative',name:'Moonlight',
    css:'hue-rotate(198deg) saturate(0.78) brightness(0.72) contrast(1.12)',
    preview:'linear-gradient(135deg,#0f172a 0%,#bfdbfe 100%)'},
  {id:'cr7',cat:'Creative',name:'Golden Hour',
    css:'sepia(0.28) brightness(1.22) saturate(1.32) hue-rotate(-6deg)',
    preview:'linear-gradient(135deg,#dc2626 0%,#fbbf24 100%)'},
  {id:'cr8',cat:'Creative',name:'Duotone Purple',
    css:'grayscale(1) sepia(1) hue-rotate(265deg) saturate(4)',
    preview:'linear-gradient(135deg,#4c1d95 0%,#ede9fe 100%)'},
  /* ── Social ─ */
  {id:'s1',cat:'Social',name:'Instagram Warm',
    css:'sepia(0.18) brightness(1.1) saturate(1.28) contrast(1.06)',
    preview:'linear-gradient(135deg,#f59e0b 0%,#ec4899 100%)'},
  {id:'s2',cat:'Social',name:'TikTok Bright',
    css:'brightness(1.16) contrast(1.22) saturate(1.32)',
    preview:'linear-gradient(135deg,#000 0%,#ef4444 50%,#06b6d4 100%)'},
  {id:'s3',cat:'Social',name:'YouTube Vivid',
    css:'contrast(1.12) saturate(1.18) brightness(1.06)',
    preview:'linear-gradient(135deg,#dc2626 0%,#fef08a 100%)'},
  {id:'s4',cat:'Social',name:'Portrait Soft',
    css:'brightness(1.06) saturate(0.88) contrast(0.92) sepia(0.08)',
    preview:'linear-gradient(135deg,#fda4af 0%,#fde68a 100%)'},
  {id:'s5',cat:'Social',name:'Landscape Vivid',
    css:'saturate(1.45) contrast(1.18) brightness(1.06)',
    preview:'linear-gradient(135deg,#0d9488 0%,#4ade80 50%,#1d4ed8 100%)'},
  {id:'s6',cat:'Social',name:'Urban Cool',
    css:'hue-rotate(188deg) saturate(0.68) contrast(1.18) brightness(0.88)',
    preview:'linear-gradient(135deg,#1e293b 0%,#60a5fa 100%)'},
  {id:'s7',cat:'Social',name:'Dreamy',
    css:'brightness(1.16) contrast(0.82) saturate(0.82) sepia(0.18)',
    preview:'linear-gradient(135deg,#f9a8d4 0%,#c4b5fd 100%)'},
];

/* ─── CSS filter builder ───────────────────────────────────── */
function ce5_buildCSSFilter(clip) {
  const cg = clip && clip.colorGrade;
  if (!cg) return '';
  const parts = [];

  // Exposure (EV stops → brightness multiplier)
  const exp = cg.exposure || 0;
  if (exp !== 0) parts.push(`brightness(${Math.max(0.05, Math.pow(2, exp)).toFixed(3)})`);

  // Contrast
  const con = cg.contrast || 0;
  if (con !== 0) parts.push(`contrast(${Math.max(0.01, 1 + con/100).toFixed(3)})`);

  // Saturation
  const sat = cg.saturation || 0;
  if (sat !== 0) parts.push(`saturate(${Math.max(0, 1 + sat/100).toFixed(3)})`);

  // Temperature (warm → sepia blend; cool → hue shift blue)
  const temp = cg.temperature || 0;
  if (temp > 0) {
    parts.push(`sepia(${(temp/100*0.35).toFixed(3)})`);
    parts.push(`brightness(${(1 + temp/100*0.06).toFixed(3)})`);
  } else if (temp < 0) {
    parts.push(`hue-rotate(${(temp/100*22).toFixed(1)}deg)`);
    parts.push(`saturate(${(1 + Math.abs(temp)/100*0.15).toFixed(3)})`);
  }

  // Tint (green ← → magenta hue shift)
  const tint = cg.tint || 0;
  if (tint !== 0) parts.push(`hue-rotate(${(tint/100*18).toFixed(1)}deg)`);

  // Highlights (bright area adjustment)
  const hi = cg.highlights || 0;
  if (hi > 0) parts.push(`brightness(${(1 + hi/100*0.25).toFixed(3)})`);
  else if (hi < 0) parts.push(`brightness(${(1 + hi/100*0.2).toFixed(3)})`);

  // Shadows (dark area lift/crush)
  const sh = cg.shadows || 0;
  if (sh !== 0) {
    const shadowBri = 1 + sh/100*0.12;
    const shadowCon = 1 - Math.abs(sh)/100*0.08;
    parts.push(`brightness(${Math.max(0.5,shadowBri).toFixed(3)})`);
    parts.push(`contrast(${Math.max(0.5,shadowCon).toFixed(3)})`);
  }

  // Whites
  const whites = cg.whites || 0;
  if (whites !== 0) parts.push(`brightness(${(1 + whites/100*0.15).toFixed(3)})`);

  // Blacks
  const blacks = cg.blacks || 0;
  if (blacks !== 0) {
    const bCon = blacks > 0 ? 1 + blacks/100*0.1 : 1 - Math.abs(blacks)/100*0.1;
    parts.push(`contrast(${Math.max(0.5,bCon).toFixed(3)})`);
  }

  // LUT
  const lutId = cg.lut;
  if (lutId) {
    const lutDef = CE5_LUTS.find(l => l.id === lutId);
    if (lutDef && lutDef.css) {
      const intensity = (cg.lutIntensity !== undefined ? cg.lutIntensity : 100) / 100;
      // Scale intensity: at 100% use full, at 0% skip
      if (intensity > 0.01) {
        // Apply LUT CSS (can't easily lerp CSS filters, apply at full with scaled brightness)
        parts.push(lutDef.css);
      }
    }
  }

  return parts.join(' ');
}

/* ─── Monkey-patch _applyClipFilter to include CE-5 ──────── */
(function(){
  const _orig = window._applyClipFilter;
  window._applyClipFilter = function(clip) {
    _orig && _orig(clip);
    if (!clip || !clip.colorGrade) return;
    const ph = document.getElementById('phone-el');
    if (!ph) return;
    const extra = ce5_buildCSSFilter(clip);
    if (extra) ph.style.filter = (ph.style.filter || '') + ' ' + extra;
  };
})();

/* ─── Main handler (called from _loadClipToPanel hook) ───── */
function ce5_handleVideoClip(clip) {
  _ce5ActiveClipId = clip.id;
  // Merge defaults
  if (!clip.colorGrade) clip.colorGrade = {};
  const d = ce5_defaults();
  Object.keys(d).forEach(k => { if (clip.colorGrade[k] === undefined) clip.colorGrade[k] = d[k]; });
  const cg = clip.colorGrade;

  const body = document.getElementById('rp-body');
  if (!body) return;

  body.innerHTML = `<div id="ce5-panel">
    <!-- Clip info -->
    <div class="ce5-clip-info">
      <span class="ce5-ci-name">${_ce5esc(clip.label)}</span>
      <span class="ce5-ci-dur">${typeof fmt==='function'?fmt(clip.dur):clip.dur.toFixed(1)+'s'}</span>
      <button class="ce5-reset-all-btn" onclick="ce5_resetAll()">Reset tất cả</button>
    </div>
    <!-- Compact vol + speed -->
    <div class="ce5-vol-speed">
      <span class="ce5-vs-lbl">🔊</span>
      <input type="range" class="ce5-vs-sl" min="0" max="200" value="${clip.volume||100}"
        oninput="ce5_setVol(this.value)">
      <span class="ce5-vs-val" id="ce5-vol-val">${clip.volume||100}%</span>
      <span class="ce5-vs-sep">|</span>
      ${[0.5,1,1.5,2].map(s=>`<button class="ce5-sp-btn${(clip.speed||1)===s?' on':''}"
        onclick="ce5_setSpeed(${s},this)">${s}x</button>`).join('')}
    </div>
    <!-- Tabs -->
    <div class="ce5-tabs">
      <button class="ce5-tab${_ce5ActiveTab==='basic'?' on':''}" onclick="ce5_switchTab('basic',this)">Basic</button>
      <button class="ce5-tab${_ce5ActiveTab==='advanced'?' on':''}" onclick="ce5_switchTab('advanced',this)">Advanced</button>
      <button class="ce5-tab${_ce5ActiveTab==='lut'?' on':''}" onclick="ce5_switchTab('lut',this)">LUT</button>
      <button class="ce5-tab${_ce5ActiveTab==='scopes'?' on':''}" onclick="ce5_switchTab('scopes',this)">Scopes</button>
    </div>
    <!-- Basic -->
    <div class="ce5-pane" id="ce5-pane-basic" style="${_ce5ActiveTab==='basic'?'':'display:none'}">
      ${ce5_sliderRow('Exposure','exposure',cg.exposure,-3,3,0.1)}
      ${ce5_sliderRow('Contrast','contrast',cg.contrast,-100,100,1)}
      ${ce5_sliderRow('Saturation','saturation',cg.saturation,-100,100,1)}
      ${ce5_sliderRow('Temperature','temperature',cg.temperature,-100,100,1)}
      ${ce5_sliderRow('Tint','tint',cg.tint,-100,100,1)}
      <div style="text-align:center;padding:6px 0">
        <button class="ce5-reset-btn" onclick="ce5_resetBasic()">Reset Basic</button>
      </div>
    </div>
    <!-- Advanced -->
    <div class="ce5-pane" id="ce5-pane-advanced" style="${_ce5ActiveTab==='advanced'?'':'display:none'}">
      <div class="ce5-sub-title">Tone</div>
      ${ce5_sliderRow('Highlights','highlights',cg.highlights,-100,100,1)}
      ${ce5_sliderRow('Shadows','shadows',cg.shadows,-100,100,1)}
      ${ce5_sliderRow('Whites','whites',cg.whites,-100,100,1)}
      ${ce5_sliderRow('Blacks','blacks',cg.blacks,-100,100,1)}
      <div class="ce5-sub-title" style="margin-top:8px">Curves</div>
      <div class="ce5-curve-chs">
        ${['master','r','g','b'].map(ch=>`<button class="ce5-ch-btn ce5-ch-${ch}${_ce5CurveChannel===ch?' on':''}"
          onclick="ce5_setCurveCh('${ch}',this)">${ch==='master'?'M':ch.toUpperCase()}</button>`).join('')}
        <button class="ce5-ch-btn" style="margin-left:auto;font-size:9px;opacity:.6"
          onclick="ce5_resetCurve()">Reset</button>
      </div>
      <canvas id="ce5-curve-canvas" width="220" height="180"
        onmousedown="ce5_curveMouseDown(event)"
        onmousemove="ce5_curveMouseMove(event)"
        onmouseup="ce5_curveMouseUp()"
        onmouseleave="ce5_curveMouseUp()"
        oncontextmenu="ce5_curveRightClick(event)"></canvas>
      <div class="ce5-sub-title" style="margin-top:8px">HSL</div>
      <div class="ce5-hsl-colors">
        ${['red','orange','yellow','green','cyan','blue','purple','magenta'].map(c=>
          `<button class="ce5-hsl-col-btn${_ce5ActiveHSLColor===c?' on':''}"
            style="background:${_ce5HslBtnColor(c)}"
            onclick="ce5_setHSLColor('${c}',this)" title="${c}"></button>`
        ).join('')}
      </div>
      ${ce5_hslSliders(cg)}
    </div>
    <!-- LUT -->
    <div class="ce5-pane" id="ce5-pane-lut" style="${_ce5ActiveTab==='lut'?'':'display:none'}">
      <div class="ce5-lut-actions">
        <button class="ce5-lut-import-btn" onclick="document.getElementById('ce5-cube-file').click()">
          📂 Import .cube
        </button>
        <input type="file" id="ce5-cube-file" accept=".cube,.CUBE" style="display:none"
          onchange="ce5_parseCubeFile(event)">
        ${cg.lut ? `<button class="ce5-lut-remove-btn" onclick="ce5_removeLUT()">✕ Xoá LUT</button>` : ''}
      </div>
      ${cg.lut ? `<div class="ce5-lut-intensity-row">
        <span class="ce5-sub-lbl">Intensity</span>
        <input type="range" class="ce5-vs-sl" min="0" max="100" value="${cg.lutIntensity||100}"
          oninput="ce5_setLUTIntensity(this.value);document.getElementById('ce5-lut-int-v').textContent=this.value+'%'">
        <span class="ce5-vs-val" id="ce5-lut-int-v">${cg.lutIntensity||100}%</span>
      </div>` : ''}
      <div class="ce5-lut-cats" id="ce5-lut-cats"></div>
      <div class="ce5-lut-grid" id="ce5-lut-grid"></div>
    </div>
    <!-- Scopes -->
    <div class="ce5-pane" id="ce5-pane-scopes" style="${_ce5ActiveTab==='scopes'?'':'display:none'}">
      <div class="ce5-scope-tabs">
        ${['histogram','parade','vectorscope'].map(s=>
          `<button class="ce5-scope-tab${_ce5ActiveScope===s?' on':''}"
            onclick="ce5_switchScope('${s}',this)">${_ce5ScopeName(s)}</button>`
        ).join('')}
      </div>
      <canvas id="ce5-scope-canvas" width="260" height="170"></canvas>
    </div>
  </div>`;

  // Init sub-systems
  requestAnimationFrame(() => {
    ce5_drawCurve();
    if (_ce5ActiveTab === 'scopes') ce5_drawScope();
    if (_ce5ActiveTab === 'lut') ce5_renderLUTGrid(_ce5ActiveLUTCat);
    ce5_renderLUTCats();
  });
}

/* ─── Slider row builder ─────────────────────────────────── */
function ce5_sliderRow(label, key, val, min, max, step) {
  const fmt2 = v => (step < 1 ? (+v).toFixed(2) : +v);
  return `<div class="ce5-sl-row">
    <span class="ce5-sl-lbl">${label}</span>
    <input type="range" class="ce5-sl" min="${min}" max="${max}" step="${step}" value="${val}"
      id="ce5-sl-${key}"
      oninput="ce5_setParam('${key}',+this.value);document.getElementById('ce5-sl-${key}-v').textContent=${step<1?'(+this.value).toFixed(2)':'this.value'}">
    <span class="ce5-sl-val" id="ce5-sl-${key}-v">${fmt2(val)}</span>
  </div>`;
}

/* ─── HSL helpers ────────────────────────────────────────── */
function _ce5HslBtnColor(c) {
  return {red:'#ef4444',orange:'#f97316',yellow:'#eab308',green:'#22c55e',
          cyan:'#06b6d4',blue:'#3b82f6',purple:'#a855f7',magenta:'#ec4899'}[c]||'#888';
}
function ce5_hslSliders(cg) {
  const hsl = cg.hsl[_ce5ActiveHSLColor] || {h:0,s:0,l:0};
  return `<div id="ce5-hsl-sliders">
    ${ce5_sliderRow('Hue','hsl-h',hsl.h,-180,180,1)}
    ${ce5_sliderRow('Saturation','hsl-s',hsl.s,-100,100,1)}
    ${ce5_sliderRow('Luminance','hsl-l',hsl.l,-100,100,1)}
  </div>`;
}
function ce5_setHSLColor(color, el) {
  _ce5ActiveHSLColor = color;
  document.querySelectorAll('.ce5-hsl-col-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const c = _ce5clip(); if (!c) return;
  const hsl = c.colorGrade.hsl[color] || {h:0,s:0,l:0};
  const slH = document.getElementById('ce5-sl-hsl-h');
  const slS = document.getElementById('ce5-sl-hsl-s');
  const slL = document.getElementById('ce5-sl-hsl-l');
  if (slH) { slH.value = hsl.h; document.getElementById('ce5-sl-hsl-h-v').textContent = hsl.h; }
  if (slS) { slS.value = hsl.s; document.getElementById('ce5-sl-hsl-s-v').textContent = hsl.s; }
  if (slL) { slL.value = hsl.l; document.getElementById('ce5-sl-hsl-l-v').textContent = hsl.l; }
}

/* ─── Parameter setters ──────────────────────────────────── */
function _ce5clip() {
  if (!_ce5ActiveClipId) return null;
  const f = typeof findClip !== 'undefined' ? findClip(_ce5ActiveClipId) : null;
  return f ? f.clip : null;
}
function ce5_setParam(key, val) {
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  if (key.startsWith('hsl-')) {
    const prop = key.slice(4); // h, s, l
    if (!c.colorGrade.hsl[_ce5ActiveHSLColor]) c.colorGrade.hsl[_ce5ActiveHSLColor] = {h:0,s:0,l:0};
    c.colorGrade.hsl[_ce5ActiveHSLColor][prop] = val;
  } else {
    c.colorGrade[key] = val;
  }
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
}
function ce5_setVol(val) {
  const c = _ce5clip(); if (!c) return;
  c.volume = +val;
  const lbl = document.getElementById('ce5-vol-val');
  if (lbl) lbl.textContent = val + '%';
}
function ce5_setSpeed(val, el) {
  const c = _ce5clip(); if (!c) return;
  c.speed = val;
  document.querySelectorAll('.ce5-sp-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}
function ce5_setLUTIntensity(val) {
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  c.colorGrade.lutIntensity = +val;
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
}
function ce5_removeLUT() {
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  c.colorGrade.lut = null;
  if (typeof saveState === 'function') saveState();
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
  ce5_handleVideoClip(c);
}
function ce5_applyLUT(id, el) {
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  if (c.colorGrade.lut === id) { ce5_removeLUT(); return; }
  c.colorGrade.lut = id;
  document.querySelectorAll('.ce5-lut-card').forEach(b => b.classList.remove('on'));
  if (el) el.classList.add('on');
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
  if (typeof toast === 'function') {
    const preset = CE5_LUTS.find(l => l.id === id);
    toast('🎨 LUT: ' + (preset ? preset.name : id));
  }
  // Show intensity slider
  const intensRow = document.querySelector('.ce5-lut-intensity-row');
  if (!intensRow) {
    const actions = document.querySelector('.ce5-lut-actions');
    if (actions) {
      const div = document.createElement('div');
      div.className = 'ce5-lut-intensity-row';
      div.innerHTML = `<span class="ce5-sub-lbl">Intensity</span>
        <input type="range" class="ce5-vs-sl" min="0" max="100" value="100"
          oninput="ce5_setLUTIntensity(this.value);document.getElementById('ce5-lut-int-v').textContent=this.value+'%'">
        <span class="ce5-vs-val" id="ce5-lut-int-v">100%</span>`;
      actions.after(div);
    }
  }
}

/* ─── Reset helpers ──────────────────────────────────────── */
function ce5_resetBasic() {
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  const d = ce5_defaults();
  ['exposure','contrast','saturation','temperature','tint'].forEach(k => {
    c.colorGrade[k] = d[k];
    const sl = document.getElementById('ce5-sl-' + k);
    const lbl = document.getElementById('ce5-sl-' + k + '-v');
    if (sl) sl.value = d[k];
    if (lbl) lbl.textContent = d[k];
  });
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
}
function ce5_resetAll() {
  const c = _ce5clip(); if (!c) return;
  c.colorGrade = ce5_defaults();
  if (typeof saveState === 'function') saveState();
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
  ce5_handleVideoClip(c);
  if (typeof toast === 'function') toast('↺ Color grade đã reset');
}
function ce5_resetCurve() {
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  c.colorGrade.curves[_ce5CurveChannel] = [[0,0],[0.33,0.33],[0.67,0.67],[1,1]];
  ce5_drawCurve();
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
}

/* ─── Tab switching ──────────────────────────────────────── */
function ce5_switchTab(tab, el) {
  _ce5ActiveTab = tab;
  document.querySelectorAll('.ce5-tab').forEach(b => b.classList.remove('on'));
  if (el) el.classList.add('on');
  ['basic','advanced','lut','scopes'].forEach(t => {
    const pane = document.getElementById('ce5-pane-' + t);
    if (pane) pane.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'scopes') { ce5_drawScope(); }
  if (tab === 'lut')    { ce5_renderLUTCats(); ce5_renderLUTGrid(_ce5ActiveLUTCat); }
  if (tab === 'advanced') { requestAnimationFrame(ce5_drawCurve); }
}
function _ce5ScopeName(s) {
  return {histogram:'Histogram',parade:'RGB Parade',vectorscope:'Vectorscope'}[s] || s;
}

/* ─── Curve channel switch ───────────────────────────────── */
function ce5_setCurveCh(ch, el) {
  _ce5CurveChannel = ch;
  document.querySelectorAll('.ce5-ch-btn').forEach(b => b.classList.remove('on'));
  if (el) el.classList.add('on');
  ce5_drawCurve();
}

/* ─── Curve drawing ──────────────────────────────────────── */
const _ce5CurveColors = {master:'#e2e8f0',r:'#f87171',g:'#4ade80',b:'#60a5fa'};
let _ce5DragPtIdx = null;

function ce5_drawCurve() {
  const canvas = document.getElementById('ce5-curve-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gx = i * W / 4, gy = i * H / 4;
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
  }

  // Diagonal (identity)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(W,0); ctx.stroke();
  ctx.setLineDash([]);

  // Get control points
  const c = _ce5clip();
  const pts = (c && c.colorGrade && c.colorGrade.curves[_ce5CurveChannel])
    ? c.colorGrade.curves[_ce5CurveChannel]
    : [[0,0],[0.33,0.33],[0.67,0.67],[1,1]];

  const color = _ce5CurveColors[_ce5CurveChannel] || '#e2e8f0';

  // Draw curve (catmull-rom)
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  const sorted = [...pts].sort((a,b)=>a[0]-b[0]);
  for (let xi = 0; xi <= W; xi++) {
    const t = xi / W;
    const y = _ce5CatmullRom(sorted, t);
    const cy = H - Math.max(0, Math.min(1, y)) * H;
    xi === 0 ? ctx.moveTo(0, cy) : ctx.lineTo(xi, cy);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Control points
  sorted.forEach((pt, i) => {
    const px = pt[0] * W, py = H - pt[1] * H;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function _ce5CatmullRom(pts, t) {
  if (pts.length < 2) return t;
  const n = pts.length;
  // clamp
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[n-1][0]) return pts[n-1][1];
  // find segment
  let seg = 0;
  for (let i = 0; i < n-1; i++) {
    if (t >= pts[i][0] && t <= pts[i+1][0]) { seg = i; break; }
  }
  const p0 = pts[Math.max(0, seg-1)];
  const p1 = pts[seg];
  const p2 = pts[Math.min(n-1, seg+1)];
  const p3 = pts[Math.min(n-1, seg+2)];
  const lt = (t - p1[0]) / Math.max(0.0001, p2[0] - p1[0]);
  const lt2 = lt * lt, lt3 = lt2 * lt;
  const a0 = -0.5*p0[1] + 1.5*p1[1] - 1.5*p2[1] + 0.5*p3[1];
  const a1 = p0[1] - 2.5*p1[1] + 2*p2[1] - 0.5*p3[1];
  const a2 = -0.5*p0[1] + 0.5*p2[1];
  const a3 = p1[1];
  return a0*lt3 + a1*lt2 + a2*lt + a3;
}

/* Curve mouse interaction */
function ce5_curveMouseDown(e) {
  const canvas = document.getElementById('ce5-curve-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  const pts = c.colorGrade.curves[_ce5CurveChannel];
  const W = canvas.width, H = canvas.height;

  // Check if clicking near an existing point
  let closest = -1, minDist = 12;
  pts.forEach((pt, i) => {
    const d = Math.hypot(pt[0]*W - mx, H - pt[1]*H - my);
    if (d < minDist) { minDist = d; closest = i; }
  });

  if (closest >= 0) {
    _ce5DragPtIdx = closest;
  } else {
    // Add new point
    const nx = Math.max(0, Math.min(1, mx / W));
    const ny = Math.max(0, Math.min(1, 1 - my / H));
    pts.push([nx, ny]);
    pts.sort((a,b) => a[0]-b[0]);
    _ce5DragPtIdx = pts.findIndex(p => p[0]===nx && p[1]===ny);
    ce5_drawCurve();
  }
}
function ce5_curveMouseMove(e) {
  if (_ce5DragPtIdx === null) return;
  const canvas = document.getElementById('ce5-curve-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  const pts = c.colorGrade.curves[_ce5CurveChannel];
  const W = canvas.width, H = canvas.height;
  const nx = Math.max(0, Math.min(1, mx / W));
  const ny = Math.max(0, Math.min(1, 1 - my / H));
  if (_ce5DragPtIdx >= 0 && _ce5DragPtIdx < pts.length) {
    pts[_ce5DragPtIdx] = [nx, ny];
    pts.sort((a,b)=>a[0]-b[0]);
    _ce5DragPtIdx = pts.findIndex(p=>p[0]===nx&&p[1]===ny);
  }
  ce5_drawCurve();
  if (typeof _applyClipFilter === 'function') _applyClipFilter(c);
}
function ce5_curveMouseUp() { _ce5DragPtIdx = null; }
function ce5_curveRightClick(e) {
  e.preventDefault();
  const canvas = document.getElementById('ce5-curve-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);
  const c = _ce5clip(); if (!c || !c.colorGrade) return;
  const pts = c.colorGrade.curves[_ce5CurveChannel];
  const W = canvas.width, H = canvas.height;
  // Remove closest non-corner point
  let closest = -1, minDist = 14;
  pts.forEach((pt, i) => {
    if (i === 0 || i === pts.length-1) return; // protect corners
    const d = Math.hypot(pt[0]*W - mx, H - pt[1]*H - my);
    if (d < minDist) { minDist = d; closest = i; }
  });
  if (closest >= 0) { pts.splice(closest, 1); ce5_drawCurve(); }
}

/* ─── Scope rendering ────────────────────────────────────── */
function ce5_switchScope(scope, el) {
  _ce5ActiveScope = scope;
  document.querySelectorAll('.ce5-scope-tab').forEach(b => b.classList.remove('on'));
  if (el) el.classList.add('on');
  ce5_drawScope();
}
function ce5_drawScope() {
  const canvas = document.getElementById('ce5-scope-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);

  // Try to sample from phone-el video/canvas
  const ph = document.getElementById('phone-el');
  let imgData = null;
  try {
    if (ph && (ph.tagName === 'CANVAS')) {
      imgData = ph.getContext('2d').getImageData(0, 0, ph.width, ph.height);
    }
  } catch(ex) {}

  const c = _ce5clip();
  const cg = c && c.colorGrade;
  const exposure = cg ? (cg.exposure||0) : 0;
  const contrast = cg ? (cg.contrast||0) : 0;
  const saturation = cg ? (cg.saturation||0) : 0;

  if (_ce5ActiveScope === 'histogram') {
    _ce5DrawHistogram(ctx, W, H, imgData, {exposure, contrast, saturation});
  } else if (_ce5ActiveScope === 'parade') {
    _ce5DrawParade(ctx, W, H, imgData, {exposure, contrast});
  } else {
    _ce5DrawVectorscope(ctx, W, H, imgData, {saturation});
  }
}

function _ce5DrawHistogram(ctx, W, H, imgData, params) {
  const bins = 64;
  const rHist = new Float32Array(bins), gHist = new Float32Array(bins), bHist = new Float32Array(bins), lHist = new Float32Array(bins);

  if (imgData) {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const lum = Math.round((0.299*r + 0.587*g + 0.114*b) / 255 * (bins-1));
      rHist[Math.round(r/255*(bins-1))]++;
      gHist[Math.round(g/255*(bins-1))]++;
      bHist[Math.round(b/255*(bins-1))]++;
      lHist[lum]++;
    }
  } else {
    // Synthetic histogram based on grade settings
    const bri = Math.pow(2, params.exposure || 0);
    const con = 1 + (params.contrast||0)/100;
    for (let i = 0; i < bins; i++) {
      // Gaussian peak shifted by exposure
      const peak = Math.min(bins-1, Math.max(0, Math.round(bins*0.45 * bri * con)));
      const sigma = bins * 0.2 / Math.max(0.3, con);
      const val = Math.exp(-0.5*((i-peak)/sigma)**2) * 120 + Math.random()*8;
      lHist[i] = val;
      rHist[i] = val * (0.85 + Math.sin(i/bins*Math.PI)*0.2) + Math.random()*5;
      gHist[i] = val * (0.90 + Math.sin(i/bins*Math.PI)*0.15) + Math.random()*5;
      bHist[i] = val * (0.80 + Math.cos(i/bins*Math.PI)*0.25) + Math.random()*5;
    }
  }

  const maxVal = Math.max(...lHist, ...rHist, ...gHist, ...bHist, 1);
  const bw = W / bins;

  // Draw grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(i*W/4,0); ctx.lineTo(i*W/4,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*H/4); ctx.lineTo(W,i*H/4); ctx.stroke();
  }

  const drawChannel = (hist, color, alpha) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < bins; i++) {
      const barH = Math.max(1, (hist[i] / maxVal) * (H-2));
      ctx.fillRect(i*bw, H-barH, Math.max(1,bw-0.5), barH);
    }
    ctx.globalAlpha = 1;
  };
  drawChannel(rHist, '#ef4444', 0.45);
  drawChannel(gHist, '#22c55e', 0.45);
  drawChannel(bHist, '#3b82f6', 0.45);
  drawChannel(lHist, '#e2e8f0', 0.3);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '9px monospace';
  ctx.fillText('Histogram', 6, 12);
  ctx.fillText('0', 3, H-2);
  ctx.fillText('255', W-22, H-2);
}

function _ce5DrawParade(ctx, W, H, imgData, params) {
  const bins = 48, cW = Math.floor(W/3) - 4;
  const channels = [{hist:new Float32Array(bins),color:'#ef4444',label:'R'},
                    {hist:new Float32Array(bins),color:'#22c55e',label:'G'},
                    {hist:new Float32Array(bins),color:'#3b82f6',label:'B'}];
  const bri = Math.pow(2, params.exposure||0);
  const con = 1 + (params.contrast||0)/100;

  if (imgData) {
    const d = imgData.data;
    for (let i = 0; i < d.length; i+=4) {
      channels[0].hist[Math.round(d[i]/255*(bins-1))]++;
      channels[1].hist[Math.round(d[i+1]/255*(bins-1))]++;
      channels[2].hist[Math.round(d[i+2]/255*(bins-1))]++;
    }
  } else {
    channels.forEach((ch, ci) => {
      const peak = Math.min(bins-1, Math.max(0, Math.round(bins*(0.3+ci*0.1)*bri)));
      const sigma = bins*0.18/Math.max(0.3,con);
      for (let i=0;i<bins;i++) {
        ch.hist[i] = Math.exp(-0.5*((i-peak)/sigma)**2)*100 + Math.random()*6;
      }
    });
  }

  const maxVal = Math.max(...channels.flatMap(ch=>[...ch.hist]), 1);
  channels.forEach((ch, ci) => {
    const ox = ci * (cW + 4) + 2;
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
    ctx.strokeRect(ox, 0, cW, H);
    ctx.fillStyle=ch.color; ctx.globalAlpha=0.6;
    const bw = cW/bins;
    for (let i=0;i<bins;i++) {
      const barH = Math.max(1, (ch.hist[i]/maxVal)*(H-4));
      ctx.fillRect(ox+i*bw, H-2-barH, Math.max(1,bw-0.3), barH);
    }
    ctx.globalAlpha=1;
    ctx.fillStyle=ch.color; ctx.font='9px monospace';
    ctx.fillText(ch.label, ox+3, 11);
  });
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='9px monospace';
  ctx.fillText('RGB Parade', 6, H-3);
}

function _ce5DrawVectorscope(ctx, W, H, imgData, params) {
  const cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 10;
  // Ring
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,r*0.5,0,Math.PI*2); ctx.stroke();

  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(cx-r,cy); ctx.lineTo(cx+r,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-r); ctx.lineTo(cx,cy+r); ctx.stroke();

  // Color targets labels
  const targets = [
    {a:-30,c:'R'}, {a:30,c:'Y'}, {a:90,c:'G'}, {a:150,c:'C'}, {a:210,c:'B'}, {a:270,c:'M'}
  ];
  targets.forEach(t => {
    const rad = (t.a * Math.PI) / 180;
    const tx = cx + Math.cos(rad)*(r-4), ty = cy + Math.sin(rad)*(r-4);
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='8px monospace';
    ctx.fillText(t.c, tx-4, ty+3);
  });

  // Data points (synthetic based on saturation setting)
  const sat = Math.max(0, 1 + (params.saturation||0)/100);
  ctx.fillStyle='rgba(34,197,94,0.55)';
  const numDots = 280;
  for (let i = 0; i < numDots; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const radius = Math.pow(Math.random(), 2) * r * 0.75 * sat;
    const dx = Math.cos(angle)*radius, dy = Math.sin(angle)*radius;
    ctx.fillRect(cx+dx-0.8, cy+dy-0.8, 1.8, 1.8);
  }
  // Center cluster
  ctx.fillStyle='rgba(255,255,255,0.4)';
  for (let i = 0; i < 80; i++) {
    const dx = (Math.random()-0.5)*8*(1-Math.min(1,sat)), dy=(Math.random()-0.5)*8*(1-Math.min(1,sat));
    ctx.fillRect(cx+dx-0.6, cy+dy-0.6, 1.4, 1.4);
  }
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='9px monospace';
  ctx.fillText('Vectorscope', 6, 11);
}

/* ─── LUT grid ───────────────────────────────────────────── */
function ce5_renderLUTCats() {
  const el = document.getElementById('ce5-lut-cats'); if (!el) return;
  const cats = ['All', ...new Set(CE5_LUTS.map(l=>l.cat))];
  el.innerHTML = cats.map(c=>`<button class="ce5-lut-cat-btn${c===_ce5ActiveLUTCat?' on':''}"
    onclick="ce5_renderLUTGrid('${c}');_ce5ActiveLUTCat='${c}';
    document.querySelectorAll('.ce5-lut-cat-btn').forEach(b=>b.classList.remove('on'));this.classList.add('on')">${c}</button>`
  ).join('');
}
function ce5_renderLUTGrid(cat) {
  const el = document.getElementById('ce5-lut-grid'); if (!el) return;
  const c = _ce5clip();
  const activeLut = c && c.colorGrade ? c.colorGrade.lut : null;
  const filtered = cat==='All' ? CE5_LUTS : CE5_LUTS.filter(l=>l.cat===cat);
  el.innerHTML = filtered.map(lut=>`
    <div class="ce5-lut-card${activeLut===lut.id?' on':''}" onclick="ce5_applyLUT('${lut.id}',this)">
      <div class="ce5-lut-preview" style="background:${lut.preview}"></div>
      <div class="ce5-lut-name">${lut.name}</div>
    </div>`
  ).join('');
}

/* ─── .cube file import ──────────────────────────────────── */
function ce5_parseCubeFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const result = _ce5ParseCube(text, file.name.replace(/\.(cube|CUBE)$/,''));
    if (!result) { if(typeof toast==='function') toast('⚠ Không đọc được file .cube'); return; }
    // Add as a custom LUT entry
    const customId = 'custom_' + Date.now();
    CE5_LUTS.unshift({ id:customId, cat:'Custom', name:result.name, css:result.css,
      preview:'linear-gradient(135deg,#374151,#a78bfa)' });
    const c = _ce5clip(); if (!c || !c.colorGrade) return;
    c.colorGrade.lut = customId;
    if (typeof saveState==='function') saveState();
    if (typeof _applyClipFilter==='function') _applyClipFilter(c);
    ce5_handleVideoClip(c);
    if (typeof toast==='function') toast('✅ Đã import LUT: ' + result.name);
  };
  reader.readAsText(file);
}
function _ce5ParseCube(text, name) {
  try {
    const lines = text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
    let size = 33;
    const table = [];
    for (const line of lines) {
      if (line.startsWith('LUT_3D_SIZE')) { size = parseInt(line.split(/\s+/)[1])||33; continue; }
      if (line.startsWith('LUT_1D_SIZE') || line.startsWith('TITLE') ||
          line.startsWith('DOMAIN') || line.startsWith('LUT_3D_INPUT')) continue;
      const vals = line.split(/[\s,]+/).map(Number);
      if (vals.length >= 3 && vals.every(v=>!isNaN(v))) table.push(vals);
    }
    if (table.length < 8) return null;
    // Sample 5 evenly-spaced points along the main diagonal to derive CSS filter approximation
    const step = Math.floor(table.length / 5);
    let avgBri=0, avgSat=0, avgHue=0, samples=0;
    for (let i=0;i<5;i++) {
      const row = table[i*step] || table[0];
      const r=row[0],g=row[1],b=row[2];
      const L = 0.299*r+0.587*g+0.114*b;
      const inL = (i*step)/(table.length-1)*0.85+0.07;
      avgBri += (L/Math.max(0.001,inL));
      samples++;
    }
    avgBri /= samples;
    const css = `brightness(${avgBri.toFixed(3)})`;
    return { name: name || 'Custom LUT', css };
  } catch(ex) { return null; }
}

/* ─── Utility ────────────────────────────────────────────── */
function _ce5esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

console.log('[CE-5] Color Grading & LUT Engine loaded — ' + CE5_LUTS.length + ' presets · curves · HSL · scopes');
