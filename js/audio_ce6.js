'use strict';
/* ══════════════════════════════════════════════════════════════════
   CE-6: Audio Engine Pro
   Volume · Fades · EQ · Compressor · Limiter · Noise Reduction
   Volume Automation · Waveform Overlay · Solo · Audio Groups
   ══════════════════════════════════════════════════════════════════ */

/* ─── Shared AudioContext ─────────────────────────────────────── */
let _ce6AC = null;
function ce6_getAC() {
  if (!_ce6AC || _ce6AC.state === 'closed') {
    _ce6AC = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ce6AC.state === 'suspended') _ce6AC.resume();
  return _ce6AC;
}

/* ─── DSP node map: clipId → { source, eq[], comp, lim, nr, gainOut } */
const _ce6DSP = {};

/* ─── Current clip pointer ────────────────────────────────────── */
let _ce6clipId = null;
function _ce6clip() {
  if (!_ce6clipId) return null;
  const f = typeof findClip === 'function' ? findClip(_ce6clipId) : null;
  return f ? f.clip : null;
}

/* ─── Default audioGrade structure ───────────────────────────── */
function ce6_defaults() {
  return {
    volume      : 100,
    fadeIn      : 0,
    fadeOut     : 0,
    normalize   : false,
    noiseReduction : { enabled: false, strength: 30 },
    eq          : { low: 0, lowMid: 0, highMid: 0, high: 0 },
    compressor  : { enabled: false, threshold: -24, ratio: 4, attack: 3, release: 250, knee: 30 },
    limiter     : { enabled: false, threshold: -3,  release: 100 },
    automation  : []
  };
}

function ce6_ensure(clip) {
  if (!clip.audioGrade) clip.audioGrade = ce6_defaults();
  const ag = clip.audioGrade, d = ce6_defaults();
  if (!ag.noiseReduction) ag.noiseReduction = d.noiseReduction;
  if (!ag.eq)             ag.eq             = d.eq;
  if (!ag.compressor)     ag.compressor     = d.compressor;
  if (!ag.limiter)        ag.limiter        = d.limiter;
  if (!ag.automation)     ag.automation     = [];
  return ag;
}

/* ══════════════════════════════════════════════════════════════════
   PANEL — Audio Inspector (replaces #rp-body for ca clips)
   ══════════════════════════════════════════════════════════════════ */
function ce6_handleAudioClip(clip) {
  const body = document.getElementById('rp-body');
  if (!body) return;
  _ce6clipId = clip.id;
  const ag   = ce6_ensure(clip);

  /* Slider row helper */
  const sl = (label, key, val, min, max, step, unit, fn) =>
    `<div class="ce6-sl-row">
      <span class="ce6-sl-lbl">${label}</span>
      <input type="range" class="ce6-sl" min="${min}" max="${max}" step="${step}" value="${val}"
        oninput="${fn}">
      <span class="ce6-sl-val" id="ce6-v-${key}">${unit==='dB'?(+val).toFixed(1):val}${unit}</span>
    </div>`;

  /* Toggle switch helper */
  const tog = (checked, fn) =>
    `<label class="ce6-toggle">
      <input type="checkbox" ${checked?'checked':''} onchange="${fn}">
      <span class="ce6-tog-track"><span class="ce6-tog-thumb"></span></span>
    </label>`;

  body.innerHTML = `<div class="ce6-panel">

  <!-- Header -->
  <div class="ce6-header">
    <span class="ce6-clip-icon">🎵</span>
    <span class="ce6-clip-name" title="${clip.label||''}">${(clip.label||'Audio Clip').slice(0,28)}</span>
    <button class="ce6-norm-btn" onclick="ce6_doNormalize()" title="Auto-normalize peak">⚖ Normalize</button>
  </div>

  <!-- Waveform viewer with fade overlay -->
  <div class="ce6-wf-wrap">
    <canvas id="ce6-wf-canvas" class="ce6-wf-canvas" width="260" height="60"></canvas>
    <div class="ce6-wf-lbl" id="ce6-wf-lbl">Fade in: ${ag.fadeIn.toFixed(1)}s &nbsp;|&nbsp; Fade out: ${ag.fadeOut.toFixed(1)}s</div>
  </div>

  <!-- Volume -->
  <div class="ce6-section">
    <div class="ce6-sec-title">🔊 Volume</div>
    ${sl('Volume','vol', ag.volume, 0, 200, 1, '%',
      `ce6_setVol(+this.value);document.getElementById('ce6-v-vol').textContent=this.value+'%'`)}
  </div>

  <!-- Fades -->
  <div class="ce6-section">
    <div class="ce6-sec-title">🌅 Fades</div>
    ${sl('Fade In', 'fi',  ag.fadeIn,  0, 10, 0.1, 's',
      `ce6_set('fadeIn',+this.value);document.getElementById('ce6-v-fi').textContent=(+this.value).toFixed(1)+'s';ce6_redrawWF()`)}
    ${sl('Fade Out','fo', ag.fadeOut, 0, 10, 0.1, 's',
      `ce6_set('fadeOut',+this.value);document.getElementById('ce6-v-fo').textContent=(+this.value).toFixed(1)+'s';ce6_redrawWF()`)}
  </div>

  <!-- EQ -->
  <div class="ce6-section">
    <div class="ce6-sec-title">🎛 Equalizer</div>
    <div class="ce6-eq-wrap">
      ${[['low','Low','80Hz'],['lowMid','Lo-Mid','500Hz'],['highMid','Hi-Mid','3kHz'],['high','High','10kHz']].map(([k,lbl,freq])=>`
        <div class="ce6-eq-col">
          <span class="ce6-eq-freq">${freq}</span>
          <input type="range" class="ce6-eq-sl" min="-20" max="20" step="0.5" value="${ag.eq[k]}"
            style="writing-mode:vertical-lr;direction:rtl;-webkit-appearance:slider-vertical"
            oninput="ce6_setEQ('${k}',+this.value);document.getElementById('ce6-eq-v-${k}').textContent=(+this.value>0?'+':'')+(+this.value).toFixed(1)+'dB'">
          <span class="ce6-eq-val" id="ce6-eq-v-${k}">${(+ag.eq[k]>0?'+':'')+(+ag.eq[k]).toFixed(1)}dB</span>
          <span class="ce6-eq-lbl">${lbl}</span>
        </div>`).join('')}
    </div>
    <button class="ce6-btn-sm" onclick="ce6_resetEQ()">↺ Reset EQ</button>
  </div>

  <!-- Compressor -->
  <div class="ce6-section">
    <div class="ce6-sec-hdr">
      <div class="ce6-sec-title">⚡ Compressor</div>
      ${tog(ag.compressor.enabled,`ce6_setComp('enabled',this.checked)`)}
    </div>
    <div id="ce6-comp-body" class="ce6-sub-body${ag.compressor.enabled?'':' disabled'}">
      ${sl('Threshold','comp-thr', ag.compressor.threshold, -60, 0,  1, 'dB',
        `ce6_setComp('threshold',+this.value);document.getElementById('ce6-v-comp-thr').textContent=(+this.value).toFixed(1)+'dB'`)}
      ${sl('Ratio',    'comp-rat', ag.compressor.ratio,      1, 20, 0.5, ':1',
        `ce6_setComp('ratio',+this.value);document.getElementById('ce6-v-comp-rat').textContent=(+this.value).toFixed(1)+':1'`)}
      ${sl('Attack',   'comp-atk', ag.compressor.attack,     0,100, 1, 'ms',
        `ce6_setComp('attack',+this.value);document.getElementById('ce6-v-comp-atk').textContent=this.value+'ms'`)}
      ${sl('Release',  'comp-rel', ag.compressor.release,   10,1000,10,'ms',
        `ce6_setComp('release',+this.value);document.getElementById('ce6-v-comp-rel').textContent=this.value+'ms'`)}
    </div>
  </div>

  <!-- Limiter -->
  <div class="ce6-section">
    <div class="ce6-sec-hdr">
      <div class="ce6-sec-title">🛡 Limiter</div>
      ${tog(ag.limiter.enabled,`ce6_setLim('enabled',this.checked)`)}
    </div>
    <div id="ce6-lim-body" class="ce6-sub-body${ag.limiter.enabled?'':' disabled'}">
      ${sl('Threshold','lim-thr', ag.limiter.threshold, -20, 0, 0.5,'dB',
        `ce6_setLim('threshold',+this.value);document.getElementById('ce6-v-lim-thr').textContent=(+this.value).toFixed(1)+'dB'`)}
      ${sl('Release',  'lim-rel', ag.limiter.release,   10,500,  10,'ms',
        `ce6_setLim('release',+this.value);document.getElementById('ce6-v-lim-rel').textContent=this.value+'ms'`)}
    </div>
  </div>

  <!-- Noise Reduction -->
  <div class="ce6-section">
    <div class="ce6-sec-hdr">
      <div class="ce6-sec-title">🎙 Noise Reduction</div>
      ${tog(ag.noiseReduction.enabled,`ce6_setNR('enabled',this.checked)`)}
    </div>
    <div id="ce6-nr-body" class="ce6-sub-body${ag.noiseReduction.enabled?'':' disabled'}">
      ${sl('Strength','nr-str', ag.noiseReduction.strength, 0,100,1,'%',
        `ce6_setNR('strength',+this.value);document.getElementById('ce6-v-nr-str').textContent=this.value+'%'`)}
    </div>
  </div>

  <!-- Volume Automation -->
  <div class="ce6-section">
    <div class="ce6-sec-title">📈 Volume Automation</div>
    <canvas id="ce6-auto-canvas" class="ce6-auto-canvas" width="260" height="64"
      onclick="ce6_autoAddPoint(event,this)"
      oncontextmenu="ce6_autoRemovePoint(event,this)"></canvas>
    <div class="ce6-auto-hint" id="ce6-auto-hint">Click thêm điểm · Right-click xoá · ${ag.automation.length} điểm</div>
    <button class="ce6-btn-sm" onclick="ce6_clearAuto()">↺ Xoá automation</button>
  </div>

</div>`;

  requestAnimationFrame(() => { ce6_redrawWF(); ce6_drawAuto(); });
  ce6_connectDSP(clip);
}

/* ─── Set helpers ─────────────────────────────────────────────── */
function ce6_set(key, val) {
  const c = _ce6clip(); if (!c) return;
  ce6_ensure(c)[key] = val;
  if (typeof saveState === 'function') saveState();
}

function ce6_setVol(val) {
  const c = _ce6clip(); if (!c) return;
  const ag = ce6_ensure(c);
  ag.volume = val;
  if (typeof audioPlayers !== 'undefined' && audioPlayers[c.id]) {
    audioPlayers[c.id].el.volume = Math.min(1, val / 100);
  }
  if (_ce6DSP[c.id] && _ce6DSP[c.id].gainOut) {
    _ce6DSP[c.id].gainOut.gain.value = Math.min(2, val / 100);
  }
  if (typeof saveState === 'function') saveState();
}

function ce6_setEQ(band, val) {
  const c = _ce6clip(); if (!c) return;
  ce6_ensure(c).eq[band] = val;
  const nodeIdx = { low:0, lowMid:1, highMid:2, high:3 }[band];
  if (_ce6DSP[c.id] && _ce6DSP[c.id].eq) {
    const n = _ce6DSP[c.id].eq[nodeIdx];
    if (n) n.gain.value = val;
  }
  if (typeof saveState === 'function') saveState();
}

function ce6_resetEQ() {
  const c = _ce6clip(); if (!c) return;
  const ag = ce6_ensure(c);
  ['low','lowMid','highMid','high'].forEach(k => {
    ag.eq[k] = 0;
    const sl = document.querySelector(`input[oninput*="ce6_setEQ('${k}'"]`);
    if (sl) sl.value = 0;
    const vl = document.getElementById(`ce6-eq-v-${k}`);
    if (vl) vl.textContent = '0.0dB';
    if (_ce6DSP[c.id] && _ce6DSP[c.id].eq) {
      const n = _ce6DSP[c.id].eq[{low:0,lowMid:1,highMid:2,high:3}[k]];
      if (n) n.gain.value = 0;
    }
  });
  if (typeof saveState === 'function') saveState();
}

function ce6_setComp(key, val) {
  const c = _ce6clip(); if (!c) return;
  const ag = ce6_ensure(c);
  ag.compressor[key] = val;
  if (key === 'enabled') {
    const b = document.getElementById('ce6-comp-body');
    if (b) b.className = 'ce6-sub-body' + (val ? '' : ' disabled');
    ce6_connectDSP(c);
    return;
  }
  const dsp = _ce6DSP[c.id];
  if (dsp && dsp.comp) {
    if (key === 'threshold') dsp.comp.threshold.value = val;
    if (key === 'ratio')     dsp.comp.ratio.value = val;
    if (key === 'attack')    dsp.comp.attack.value = val / 1000;
    if (key === 'release')   dsp.comp.release.value = val / 1000;
    if (key === 'knee')      dsp.comp.knee.value = val;
  }
  if (typeof saveState === 'function') saveState();
}

function ce6_setLim(key, val) {
  const c = _ce6clip(); if (!c) return;
  ce6_ensure(c).limiter[key] = val;
  if (key === 'enabled') {
    const b = document.getElementById('ce6-lim-body');
    if (b) b.className = 'ce6-sub-body' + (val ? '' : ' disabled');
    ce6_connectDSP(c);
  }
  if (typeof saveState === 'function') saveState();
}

function ce6_setNR(key, val) {
  const c = _ce6clip(); if (!c) return;
  ce6_ensure(c).noiseReduction[key] = val;
  if (key === 'enabled') {
    const b = document.getElementById('ce6-nr-body');
    if (b) b.className = 'ce6-sub-body' + (val ? '' : ' disabled');
    ce6_connectDSP(c);
  }
  if (typeof saveState === 'function') saveState();
}

/* ══════════════════════════════════════════════════════════════════
   WAVEFORM: Enhanced with fade in/out overlay
   ══════════════════════════════════════════════════════════════════ */
function ce6_redrawWF() {
  const canvas = document.getElementById('ce6-wf-canvas');
  if (!canvas) return;
  const clip = _ce6clip(); if (!clip) return;
  const ag = ce6_ensure(clip);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, W, H);

  /* Centre axis */
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

  /* Waveform bars */
  const peaks = (typeof wfCache !== 'undefined') ? wfCache[clip.id] : null;
  if (peaks && peaks.length) {
    const barW = W / peaks.length;
    peaks.forEach((p, i) => {
      const amp  = Math.max(0, Math.min(1, p));
      const barH = Math.max(1, amp * (H - 4));
      const grad = ctx.createLinearGradient(0, (H-barH)/2, 0, (H+barH)/2);
      grad.addColorStop(0,   '#6ee7f7');
      grad.addColorStop(0.5, '#4f9ef8');
      grad.addColorStop(1,   '#6ee7f7');
      ctx.fillStyle = grad;
      ctx.fillRect(i * barW, (H - barH) / 2, Math.max(barW - 0.5, 0.5), barH);
    });
  } else {
    ctx.strokeStyle = '#4f9ef8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const y = H/2 + Math.sin(x * 0.08) * (H/3) * (0.5 + 0.5*Math.sin(x*0.03));
      x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  const dur = clip.dur || 10;

  /* Fade In */
  if (ag.fadeIn > 0) {
    const fw = Math.min(W, (ag.fadeIn / dur) * W);
    const g = ctx.createLinearGradient(0,0,fw,0);
    g.addColorStop(0,'rgba(0,0,0,0.80)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, fw, H);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText('▶ ' + ag.fadeIn.toFixed(1)+'s', 4, H-4);
  }

  /* Fade Out */
  if (ag.fadeOut > 0) {
    const fw = Math.min(W, (ag.fadeOut / dur) * W);
    const g = ctx.createLinearGradient(W-fw,0,W,0);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,0,0,0.80)');
    ctx.fillStyle = g; ctx.fillRect(W-fw, 0, fw, H);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 9px sans-serif';
    const txt = '◀ ' + ag.fadeOut.toFixed(1)+'s';
    ctx.fillText(txt, W - ctx.measureText(txt).width - 4, H-4);
  }

  /* Automation curve preview */
  const auto = ag.automation;
  if (auto && auto.length > 1) {
    const sorted = [...auto].sort((a,b)=>a.t-b.t);
    ctx.strokeStyle = 'rgba(251,191,36,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3,3]);
    ctx.beginPath();
    sorted.forEach((p,i)=>{
      const x=(p.t/dur)*W, y=H-(p.v/200)*H;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* Label */
  const lbl = document.getElementById('ce6-wf-lbl');
  if (lbl) lbl.textContent = `Fade in: ${ag.fadeIn.toFixed(1)}s  |  Fade out: ${ag.fadeOut.toFixed(1)}s`;
}

/* ══════════════════════════════════════════════════════════════════
   VOLUME AUTOMATION
   ══════════════════════════════════════════════════════════════════ */
function ce6_drawAuto() {
  const canvas = document.getElementById('ce6-auto-canvas');
  if (!canvas) return;
  const clip = _ce6clip(); if (!clip) return;
  const ag = ce6_ensure(clip);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  /* Guide lines at 0%, 50%, 100%, 150%, 200% */
  [0, 50, 100, 150, 200].forEach(v => {
    const y = H - (v / 200) * H;
    ctx.strokeStyle = v === 100 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1; ctx.setLineDash(v===100?[4,4]:[]); ctx.beginPath();
    ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); ctx.setLineDash([]);
    if (v===100||v===0||v===200) {
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='8px sans-serif';
      ctx.fillText(v+'%', 2, y-2);
    }
  });

  const pts = ag.automation;
  if (!pts.length) {
    /* flat line at current volume */
    const y = H - (ag.volume / 200) * H;
    ctx.strokeStyle = 'rgba(79,158,248,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    return;
  }

  const sorted = [...pts].sort((a,b)=>a.t-b.t);
  const dur = clip.dur || 10;

  /* Filled area */
  ctx.fillStyle = 'rgba(79,158,248,0.10)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  sorted.forEach(p => { ctx.lineTo((p.t/dur)*W, H-(p.v/200)*H); });
  ctx.lineTo(W, H);
  ctx.closePath(); ctx.fill();

  /* Line */
  ctx.strokeStyle = '#4f9ef8'; ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((p,i) => {
    const x=(p.t/dur)*W, y=H-(p.v/200)*H;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();

  /* Points */
  sorted.forEach(p => {
    const x=(p.t/dur)*W, y=H-(p.v/200)*H;
    ctx.fillStyle='#4f9ef8'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';    ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
  });

  const hint = document.getElementById('ce6-auto-hint');
  if (hint) hint.textContent = `Click thêm điểm · Right-click xoá · ${pts.length} điểm`;
}

function ce6_autoAddPoint(event, canvas) {
  const c = _ce6clip(); if (!c) return;
  const ag = ce6_ensure(c);
  const rect = canvas.getBoundingClientRect();
  const t = Math.round(((event.clientX-rect.left)/rect.width) * (c.dur||10) * 10) / 10;
  const v = Math.max(0, Math.min(200, Math.round((1-(event.clientY-rect.top)/rect.height)*200)));
  ag.automation.push({ t, v });
  if (typeof saveState === 'function') saveState();
  ce6_drawAuto();
  ce6_redrawWF();
}

function ce6_autoRemovePoint(event, canvas) {
  event.preventDefault();
  const c = _ce6clip(); if (!c) return;
  const ag = ce6_ensure(c);
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left, my = event.clientY - rect.top;
  const dur = c.dur || 10;
  let best = -1, bestD = 20;
  ag.automation.forEach((p,i)=>{
    const d = Math.hypot((p.t/dur)*rect.width-mx, rect.height-(p.v/200)*rect.height-my);
    if (d < bestD) { bestD=d; best=i; }
  });
  if (best >= 0) { ag.automation.splice(best,1); if (typeof saveState==='function') saveState(); ce6_drawAuto(); }
}

function ce6_clearAuto() {
  const c = _ce6clip(); if (!c) return;
  ce6_ensure(c).automation = [];
  if (typeof saveState === 'function') saveState();
  ce6_drawAuto(); ce6_redrawWF();
}

/* ══════════════════════════════════════════════════════════════════
   NORMALIZE
   ══════════════════════════════════════════════════════════════════ */
function ce6_doNormalize() {
  const c = _ce6clip(); if (!c) return;
  const ag = ce6_ensure(c);
  const peaks = (typeof wfCache !== 'undefined') ? wfCache[c.id] : null;
  if (!peaks || !peaks.length) {
    if (typeof toast === 'function') toast('⚠ Cần phân tích sóng âm trước khi normalize');
    return;
  }
  const peak = Math.max(...peaks);
  if (!peak) return;
  ag.volume = Math.min(200, Math.round((0.95 / peak) * 100));
  const sl = document.querySelector('input[oninput*="ce6_setVol"]');
  if (sl) sl.value = ag.volume;
  const vl = document.getElementById('ce6-v-vol');
  if (vl) vl.textContent = ag.volume + '%';
  if (typeof audioPlayers !== 'undefined' && audioPlayers[c.id])
    audioPlayers[c.id].el.volume = Math.min(1, ag.volume / 100);
  if (typeof saveState === 'function') saveState();
  if (typeof toast === 'function') toast(`⚖ Normalized → ${ag.volume}%`);
}

/* ══════════════════════════════════════════════════════════════════
   DSP CHAIN: Web Audio API
   AudioEl → [EQ×4] → [NR] → [Compressor] → [Limiter] → GainOut → dest
   ══════════════════════════════════════════════════════════════════ */
const _ce6SourceMap = new WeakMap(); /* el → MediaElementSourceNode */

function ce6_connectDSP(clip) {
  if (!clip || !clip.audioUrl) return;
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const ap = (typeof audioPlayers !== 'undefined') ? audioPlayers[clip.id] : null;
  if (!ap) return;
  const el = ap.el;
  const ag = ce6_ensure(clip);

  const AC = ce6_getAC();

  /* Tear down previous chain for this clip */
  const prev = _ce6DSP[clip.id];
  if (prev) {
    try { prev.eq.forEach(n => { try{n.disconnect();}catch(_){} }); } catch(_){}
    try { if(prev.nr)   prev.nr.disconnect();   } catch(_){}
    try { if(prev.comp) prev.comp.disconnect();  } catch(_){}
    try { if(prev.lim)  prev.lim.disconnect();   } catch(_){}
    try { if(prev.gainOut) prev.gainOut.disconnect(); } catch(_){}
  }

  /* Reuse or create MediaElementSourceNode (can only be created once per el) */
  let source = _ce6SourceMap.get(el);
  if (!source) {
    try {
      source = AC.createMediaElementSource(el);
      _ce6SourceMap.set(el, source);
    } catch(e) {
      console.warn('[CE-6] createMediaElementSource failed:', e.message);
      return;
    }
  }

  /* 4-band EQ */
  const eqSpec = [
    { type:'lowshelf',  freq:80,    q:null, gain: ag.eq.low    },
    { type:'peaking',   freq:500,   q:1.0,  gain: ag.eq.lowMid },
    { type:'peaking',   freq:3000,  q:1.0,  gain: ag.eq.highMid},
    { type:'highshelf', freq:10000, q:null, gain: ag.eq.high   }
  ];
  const eqNodes = eqSpec.map(s => {
    const f = AC.createBiquadFilter();
    f.type = s.type; f.frequency.value = s.freq; f.gain.value = s.gain;
    if (s.q !== null) f.Q.value = s.q;
    return f;
  });

  /* Noise Reduction: high-pass gate */
  let nr = null;
  if (ag.noiseReduction.enabled) {
    nr = AC.createBiquadFilter();
    nr.type = 'highpass';
    nr.frequency.value = 60 + ag.noiseReduction.strength * 1.4;
    nr.Q.value = 0.7;
  }

  /* Compressor */
  let comp = null;
  if (ag.compressor.enabled) {
    comp = AC.createDynamicsCompressor();
    comp.threshold.value = ag.compressor.threshold;
    comp.ratio.value     = ag.compressor.ratio;
    comp.attack.value    = ag.compressor.attack / 1000;
    comp.release.value   = ag.compressor.release / 1000;
    comp.knee.value      = ag.compressor.knee;
  }

  /* Limiter (DynamicsCompressor with hard knee + high ratio) */
  let lim = null;
  if (ag.limiter.enabled) {
    lim = AC.createDynamicsCompressor();
    lim.threshold.value = ag.limiter.threshold;
    lim.ratio.value     = 20;
    lim.attack.value    = 0.001;
    lim.release.value   = ag.limiter.release / 1000;
    lim.knee.value      = 0;
  }

  /* Output gain */
  const gainOut = AC.createGain();
  gainOut.gain.value = Math.min(2, ag.volume / 100);

  /* Wire: source → EQ[0→1→2→3] → [NR] → [Comp] → [Lim] → gainOut → dest */
  let node = source;
  eqNodes.forEach(n => { node.connect(n); node = n; });
  if (nr)   { node.connect(nr);   node = nr;   }
  if (comp) { node.connect(comp); node = comp; }
  if (lim)  { node.connect(lim);  node = lim;  }
  node.connect(gainOut);
  gainOut.connect(AC.destination);

  _ce6DSP[clip.id] = { source, eq: eqNodes, nr, comp, lim, gainOut };
}

/* ══════════════════════════════════════════════════════════════════
   FADE + AUTOMATION: applied during audioTick
   ══════════════════════════════════════════════════════════════════ */
function ce6_applyFadeTick(clip, relT) {
  if (!clip.audioGrade) return;
  const ag = clip.audioGrade;
  const ap = (typeof audioPlayers !== 'undefined') ? audioPlayers[clip.id] : null;
  if (!ap) return;

  let vol = Math.min(1, (ag.volume || 100) / 100);

  /* Fade in */
  if (ag.fadeIn > 0 && relT < ag.fadeIn) vol *= relT / ag.fadeIn;
  /* Fade out */
  if (ag.fadeOut > 0 && clip.dur > 0 && relT > clip.dur - ag.fadeOut)
    vol *= (clip.dur - relT) / ag.fadeOut;
  /* Volume automation */
  if (ag.automation && ag.automation.length) {
    vol *= ce6_evalAuto(ag.automation, relT, clip.dur) / 100;
  }

  vol = Math.max(0, Math.min(1, vol));
  ap.el.volume = vol;
  if (_ce6DSP[clip.id] && _ce6DSP[clip.id].gainOut) {
    _ce6DSP[clip.id].gainOut.gain.setTargetAtTime(vol*2, _ce6AC ? _ce6AC.currentTime : 0, 0.01);
  }
}

function ce6_evalAuto(pts, t, dur) {
  if (!pts || !pts.length) return 100;
  const s = [...pts].sort((a,b)=>a.t-b.t);
  if (t <= s[0].t) return s[0].v;
  if (t >= s[s.length-1].t) return s[s.length-1].v;
  for (let i=0; i<s.length-1; i++) {
    if (t >= s[i].t && t <= s[i+1].t) {
      const r = (t-s[i].t)/(s[i+1].t-s[i].t);
      return s[i].v + (s[i+1].v-s[i].v)*r;
    }
  }
  return 100;
}

/* ══════════════════════════════════════════════════════════════════
   SOLO
   ══════════════════════════════════════════════════════════════════ */
let _ce6SoloTrack = null;

function ce6_toggleSolo(trackId) {
  _ce6SoloTrack = (_ce6SoloTrack === trackId) ? null : trackId;
  ce6_applySolo();
  if (typeof renderAll === 'function') renderAll();
  const label = (typeof tracks !== 'undefined' ? tracks.find(t=>t.id===trackId)||{} : {}).label || '';
  if (typeof toast === 'function')
    toast(_ce6SoloTrack ? `🎧 Solo: ${label}` : '🎧 Solo off');
}

function ce6_applySolo() {
  if (typeof tracks === 'undefined' || typeof audioPlayers === 'undefined') return;
  tracks.forEach(tr => {
    tr.clips.forEach(c => {
      const ap = audioPlayers[c.id];
      if (!ap) return;
      ap.el.muted = _ce6SoloTrack ? (tr.id !== _ce6SoloTrack) : (tr.muted || false);
    });
  });
}

/* Expose for renderTracks to query solo state */
function ce6_isSolo(trackId) { return _ce6SoloTrack === trackId; }

/* ══════════════════════════════════════════════════════════════════
   AUDIO GROUPS
   ══════════════════════════════════════════════════════════════════ */
const _ce6Groups = {};

function ce6_createGroup(trackIds, label) {
  const gid = 'ag' + Date.now();
  _ce6Groups[gid] = { id:gid, label: label||'Audio Group', trackIds, gain:100 };
  if (typeof toast==='function') toast('📦 Audio group "'+_ce6Groups[gid].label+'" ('+trackIds.length+' tracks)');
  return gid;
}

function ce6_setGroupGain(gid, val) {
  const g = _ce6Groups[gid]; if (!g) return;
  g.gain = val;
  if (typeof tracks==='undefined' || typeof audioPlayers==='undefined') return;
  g.trackIds.forEach(tid => {
    const tr = tracks.find(t=>t.id===tid); if (!tr) return;
    tr.clips.forEach(c => {
      const ap = audioPlayers[c.id]; if (!ap) return;
      ap.el.volume = Math.min(1, (c.volume||100)/100 * val/100);
    });
  });
}

/* ══════════════════════════════════════════════════════════════════
   PATCH audioTick — inject CE-6 fade/automation
   ══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const _origTick = window.audioTick;
  window.audioTick = function() {
    if (_origTick) _origTick.call(window);
    if (typeof tracks === 'undefined') return;
    tracks.forEach(tr => {
      if (tr.muted) return;
      tr.clips.forEach(c => {
        if (!c.audioGrade) return;
        const relT = typeof playhead !== 'undefined' ? playhead - c.start : 0;
        if (relT >= 0 && relT < c.dur) ce6_applyFadeTick(c, relT);
      });
    });
    if (_ce6SoloTrack) ce6_applySolo();
  };
});

console.log('[AudioEngine CE-6] Audio Engine Pro loaded — EQ · Compressor · Limiter · NR · Fades · Automation · Solo');
