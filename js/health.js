/* ============================================================
   SYSTEM HEALTH MONITOR — js/health.js
   Phase 5.1: Production readiness dashboard.

   Tracks:
   - Memory usage (JS heap via performance.memory)
   - localStorage usage by module
   - Asset / project / transcript / export counts
   - Recent error log
   - Auto-refresh every 12s while panel is open
   ============================================================ */

(function () {

const KEY_PREFIX = 'cc_';
let _refreshTimer = null;

/* ════════════════════════════════════════════════════════════
   1. METRICS COLLECTION
   ════════════════════════════════════════════════════════════ */

function getStorageBreakdown() {
  const map = {};
  let total = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      const val  = localStorage.getItem(k) || '';
      const size = val.length;
      total += size;
      if (k.startsWith(KEY_PREFIX)) {
        const module = k.replace(KEY_PREFIX, '');
        map[module]  = size;
      }
    }
  } catch(e) {}
  return { total, byModule: map };
}

function getMemory() {
  const perf = window.performance;
  if (perf && perf.memory) {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory;
    return {
      usedMB:  +(usedJSHeapSize  / 1048576).toFixed(1),
      totalMB: +(totalJSHeapSize / 1048576).toFixed(1),
      limitMB: +(jsHeapSizeLimit / 1048576).toFixed(1),
      pct:     Math.round(usedJSHeapSize / jsHeapSizeLimit * 100),
      available: true,
    };
  }
  return { available: false, usedMB: 0, totalMB: 0, limitMB: 0, pct: 0 };
}

function getModuleStatus() {
  const modules = [
    { name:'SubEngine',      key:'window.SubEngine',       label:'Subtitle Engine' },
    { name:'SubtitlePro',    key:'window.SubtitlePro',     label:'Subtitle Pro' },
    { name:'BatchFactory',   key:'window.BatchFactory',    label:'Batch Factory' },
    { name:'ShortsGen',      key:'window.ShortsGen',       label:'Shorts Generator' },
    { name:'ProjectManager', key:'window.ProjectManager',  label:'Project Manager' },
    { name:'MediaManager',   key:'window.MediaManager',    label:'Media Manager' },
    { name:'ExportEngine',   key:'window.ExportEngine',    label:'Export Engine' },
    { name:'ViralEngine',    key:'window.ViralEngine',     label:'Viral Intelligence' },
    { name:'TranscriptEngine',key:'window.TranscriptEngine',label:'Transcript Engine' },
    { name:'StyleMemory',    key:'window.StyleMemory',     label:'Style Memory' },
    { name:'BrandClone',     key:'window.BrandClone',      label:'Brand Clone' },
    { name:'AnalyticsManager',key:'window.AnalyticsManager',label:'Analytics' },
    { name:'ContentAgent',   key:'window.ContentAgent',    label:'Content Agent' },
  ];
  return modules.map(m => ({
    ...m,
    loaded: !!window[m.name],
  }));
}

function getDataCounts() {
  const counts = {};

  /* Projects */
  try {
    const projects = JSON.parse(localStorage.getItem('cc_projects') || '[]');
    counts.projects = projects.length;
  } catch(e) { counts.projects = 0; }

  /* Assets */
  try {
    const assets = JSON.parse(localStorage.getItem('cc_assets') || '[]');
    counts.assets = assets.length;
  } catch(e) { counts.assets = 0; }

  /* Transcripts */
  try {
    const tx = JSON.parse(localStorage.getItem('cc_transcripts') || '{}');
    counts.transcripts = Object.keys(tx).length;
  } catch(e) { counts.transcripts = 0; }

  /* Analytics records */
  try {
    const ar = JSON.parse(localStorage.getItem('cc_analytics_records') || '[]');
    counts.analyticsRecords = ar.length;
  } catch(e) { counts.analyticsRecords = 0; }

  /* Agent tasks */
  try {
    const tasks = JSON.parse(localStorage.getItem('cc_agent_tasks') || '[]');
    counts.agentTasks = tasks.filter(t => t.status === 'pending').length;
  } catch(e) { counts.agentTasks = 0; }

  /* Brand profiles */
  try {
    const bp = JSON.parse(localStorage.getItem('cc_brand_profiles') || '[]');
    counts.brandProfiles = bp.length;
  } catch(e) { counts.brandProfiles = 0; }

  /* Timeline clips (from global tracks if available) */
  try {
    counts.timelineClips = typeof tracks !== 'undefined'
      ? tracks.reduce((s, t) => s + t.clips.length, 0)
      : 0;
  } catch(e) { counts.timelineClips = 0; }

  return counts;
}

function getHealth() {
  const storage = getStorageBreakdown();
  const memory  = getMemory();
  const modules = getModuleStatus();
  const data    = getDataCounts();
  const logStats = window.CCLogger ? CCLogger.getStats() : null;
  const quota    = window.CCLogger ? CCLogger.checkQuota() : null;

  /* Health score: start 100, deduct for issues */
  let score = 100;
  const issues = [];
  const warnings = [];

  if (quota && !quota.ok) {
    score -= 20;
    issues.push(`localStorage ${quota.pct}% full — risk of data loss`);
  }
  if (quota && quota.pct > 60) {
    score -= 10;
    warnings.push(`localStorage ${quota.pct}% used — monitor closely`);
  }
  if (memory.available && memory.pct > 80) {
    score -= 15;
    issues.push(`JS heap ${memory.pct}% full (${memory.usedMB} MB)`);
  }
  if (logStats && logStats.counts.ERROR > 0) {
    score -= Math.min(25, logStats.counts.ERROR * 5);
    issues.push(`${logStats.counts.ERROR} JS error(s) logged this session`);
  }
  if (logStats && logStats.counts.WARN > 5) {
    score -= 5;
    warnings.push(`${logStats.counts.WARN} warnings logged`);
  }

  const loadedCount = modules.filter(m => m.loaded).length;
  if (loadedCount < modules.length) {
    const missing = modules.filter(m => !m.loaded).map(m => m.label);
    score -= missing.length * 3;
    warnings.push(`${missing.length} module(s) not loaded: ${missing.join(', ')}`);
  }

  score = Math.max(0, score);

  return {
    score, issues, warnings,
    storage, memory, modules, data, logStats, quota,
    timestamp: new Date().toISOString(),
  };
}

/* ════════════════════════════════════════════════════════════
   2. DASHBOARD UI
   ════════════════════════════════════════════════════════════ */

const SCORE_COLOR = s => s >= 80 ? '#27ae60' : s >= 50 ? '#D4A017' : '#c0392b';
const KB = n => n > 1048576 ? (n/1048576).toFixed(1)+' MB' : (n/1024).toFixed(0)+' KB';

function _bar(pct, color) {
  return `<div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;flex:1">
    <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s"></div>
  </div>`;
}

function _scoreRing(score) {
  const r = 28; const c = 2*Math.PI*r;
  const filled = (score/100)*c; const color = SCORE_COLOR(score);
  return `<svg width="70" height="70" style="transform:rotate(-90deg)">
    <circle cx="35" cy="35" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="5"/>
    <circle cx="35" cy="35" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-dasharray="${filled} ${c}" stroke-linecap="round"/>
    <text x="35" y="36" text-anchor="middle" dominant-baseline="middle" fill="${color}"
      font-size="16" font-weight="800" transform="rotate(90,35,35)">${score}</text>
  </svg>`;
}

function renderDashboard() {
  const panel = document.getElementById('health-panel');
  if (!panel) return;

  const h = getHealth();

  panel.innerHTML = `
<div style="display:flex;flex-direction:column;height:100%;overflow:hidden;font-size:13px">

  <!-- header -->
  <div style="padding:12px 14px 0;flex-shrink:0">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--t1)">🏥 System Health</div>
        <div style="font-size:10px;color:var(--t3);margin-top:1px">Cập nhật ${_relTime(h.timestamp)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        ${_scoreRing(h.score)}
        <div style="font-size:9px;color:${SCORE_COLOR(h.score)};font-weight:700;margin-top:-4px">${h.score >= 80 ? 'HEALTHY' : h.score >= 50 ? 'DEGRADED' : 'CRITICAL'}</div>
      </div>
    </div>
  </div>

  <!-- body -->
  <div style="flex:1;overflow-y:auto;padding:12px 12px 20px">

    <!-- Issues & Warnings -->
    ${h.issues.length ? `
    <div style="background:rgba(192,57,43,.12);border:1px solid rgba(192,57,43,.4);border-radius:7px;padding:9px 11px;margin-bottom:9px">
      <div style="font-size:10px;font-weight:700;color:#e74c3c;margin-bottom:5px">🔴 Issues (${h.issues.length})</div>
      ${h.issues.map(i=>`<div style="font-size:11px;color:var(--t2);margin-bottom:3px">• ${_esc(i)}</div>`).join('')}
    </div>` : ''}
    ${h.warnings.length ? `
    <div style="background:rgba(212,160,23,.1);border:1px solid rgba(212,160,23,.3);border-radius:7px;padding:9px 11px;margin-bottom:9px">
      <div style="font-size:10px;font-weight:700;color:#D4A017;margin-bottom:5px">⚠ Warnings (${h.warnings.length})</div>
      ${h.warnings.map(w=>`<div style="font-size:11px;color:var(--t2);margin-bottom:3px">• ${_esc(w)}</div>`).join('')}
    </div>` : ''}
    ${!h.issues.length && !h.warnings.length ? `
    <div style="background:rgba(39,174,96,.1);border:1px solid rgba(39,174,96,.3);border-radius:7px;padding:9px 11px;margin-bottom:9px">
      <div style="font-size:11px;color:#27ae60">✅ Hệ thống hoạt động bình thường — không phát hiện vấn đề</div>
    </div>` : ''}

    <!-- Memory -->
    <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">💾 Bộ nhớ</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:10px">
      ${h.memory.available ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:11px;color:var(--t3);width:70px">JS Heap</span>
        ${_bar(h.memory.pct, SCORE_COLOR(100-h.memory.pct))}
        <span style="font-size:10px;color:var(--t2);white-space:nowrap">${h.memory.usedMB}/${h.memory.limitMB} MB</span>
      </div>` : `<div style="font-size:11px;color:var(--t3)">JS Heap: không khả dụng trên trình duyệt này</div>`}
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--t3);width:70px">Storage</span>
        ${_bar(h.quota ? h.quota.pct : 0, SCORE_COLOR(100 - (h.quota ? h.quota.pct : 0)))}
        <span style="font-size:10px;color:var(--t2);white-space:nowrap">${h.quota ? KB(h.quota.used) : '–'} / ~5 MB</span>
      </div>
    </div>

    <!-- Data counts -->
    <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">📦 Dữ liệu</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
      ${_chip('📁', h.data.projects,        'Projects')}
      ${_chip('🎬', h.data.timelineClips,   'Timeline clips')}
      ${_chip('🖼',  h.data.assets,          'Media assets')}
      ${_chip('📝', h.data.transcripts,     'Transcripts')}
      ${_chip('📊', h.data.analyticsRecords,'Analytics')}
      ${_chip('✅', h.data.agentTasks,      'Pending tasks')}
    </div>

    <!-- localStorage breakdown -->
    <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">🗄 Storage Breakdown</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:10px">
      ${Object.entries(h.storage.byModule).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
        <span style="font-size:10px;color:var(--t3);width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(k)}</span>
        ${_bar(Math.round(v/Math.max(...Object.values(h.storage.byModule))*100), 'var(--accent)')}
        <span style="font-size:9px;color:var(--t2);white-space:nowrap;width:42px;text-align:right">${KB(v)}</span>
      </div>`).join('')}
      <div style="margin-top:5px;font-size:10px;color:var(--t3);text-align:right">Total: ${KB(h.storage.total)}</div>
    </div>

    <!-- Module status -->
    <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">🔌 Modules (${h.modules.filter(m=>m.loaded).length}/${h.modules.length})</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:10px">
      ${h.modules.map(m=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0">
        <span style="font-size:11px;color:var(--t2)">${_esc(m.label)}</span>
        <span style="font-size:10px;font-weight:600;color:${m.loaded ? '#27ae60' : '#c0392b'}">${m.loaded ? '● OK' : '○ NOT LOADED'}</span>
      </div>`).join('')}
    </div>

    <!-- Log stats -->
    ${h.logStats ? `
    <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">📋 Logs (${h.logStats.total}/${h.logStats.capacity})</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:10px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">
        ${_chip('🐛', h.logStats.counts.DEBUG, 'DEBUG')}
        ${_chip('ℹ',  h.logStats.counts.INFO,  'INFO')}
        ${_chip('⚠',  h.logStats.counts.WARN,  'WARN')}
        ${_chip('🔴', h.logStats.counts.ERROR,  'ERROR')}
      </div>
      ${_bar(h.logStats.pct, h.logStats.pct > 80 ? '#D4A017' : 'var(--accent)')}
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <span style="font-size:10px;color:var(--t3)">${h.logStats.pct}% buffer used</span>
        <button onclick="HealthMonitor._clearLogs()" style="background:none;border:1px solid var(--border2);border-radius:4px;color:var(--t3);font-size:9px;padding:2px 7px;cursor:pointer">Xoá logs</button>
      </div>
    </div>

    <!-- Recent errors -->
    ${h.logStats.counts.ERROR > 0 ? `
    <div style="font-size:10px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">🔴 Recent Errors</div>
    <div style="background:var(--bg2);border:1px solid rgba(192,57,43,.3);border-radius:7px;padding:8px 10px;margin-bottom:10px">
      ${(window.CCLogger ? CCLogger.getLog({level:'ERROR', limit:5}) : []).map(e=>`
      <div style="margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:6px">
        <div style="font-size:10px;color:#e74c3c;font-weight:600">[${_esc(e.module)}] ${_esc(e.message)}</div>
        <div style="font-size:9px;color:var(--t3);margin-top:1px">${e.ts.replace('T',' ').slice(0,19)}</div>
      </div>`).join('')}
    </div>` : ''}` : ''}

    <!-- Actions -->
    <div style="display:flex;gap:7px;margin-top:4px">
      <button onclick="HealthMonitor._refresh()" style="flex:1;padding:7px;background:var(--accent);border:none;border-radius:6px;color:#000;font-size:11px;font-weight:700;cursor:pointer">↻ Làm mới</button>
      <button onclick="HealthMonitor._clearStorage()" style="padding:7px 10px;background:rgba(192,57,43,.15);border:1px solid #c0392b;border-radius:6px;color:#e74c3c;font-size:11px;cursor:pointer">🗑 Xoá cache</button>
    </div>

  </div>
</div>`;
}

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _chip(icon, val, label) {
  return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px;text-align:center">
    <div style="font-size:14px">${icon}</div>
    <div style="font-size:13px;font-weight:700;color:var(--t1)">${val !== undefined ? val : '–'}</div>
    <div style="font-size:9px;color:var(--t3)">${label}</div>
  </div>`;
}

function _relTime(iso) {
  if (!iso) return '–';
  const diff = Math.round((Date.now() - new Date(iso)) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return diff + 's ago';
  if (diff < 3600) return Math.round(diff/60) + 'm ago';
  return Math.round(diff/3600) + 'h ago';
}

/* ── Internal actions ── */
function _refresh() {
  renderDashboard();
  if (typeof toast === 'function') toast('🏥 Health data refreshed');
}

function _clearLogs() {
  if (window.CCLogger) CCLogger.clear();
  renderDashboard();
  if (typeof toast === 'function') toast('🗑 Logs cleared');
}

function _clearStorage() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('cc_') && k !== 'cc_projects' && k !== 'cc_autosave');
  if (!keys.length) { if (typeof toast === 'function') toast('Không có cache để xoá'); return; }
  const confirm_msg = `Xoá ${keys.length} cache keys? (projects và autosave được giữ lại)`;
  if (!window.confirm(confirm_msg)) return;
  keys.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
  renderDashboard();
  if (typeof toast === 'function') toast(`🗑 Đã xoá ${keys.length} cache keys`);
}

/* ── Auto-refresh while panel is open ── */
function startAutoRefresh() {
  stopAutoRefresh();
  _refreshTimer = setInterval(() => {
    const panel = document.getElementById('health-panel');
    if (!panel || panel.classList.contains('hidden')) { stopAutoRefresh(); return; }
    renderDashboard();
  }, 12000);
}

function stopAutoRefresh() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}

/* ── PUBLIC API ── */
window.HealthMonitor = {
  getHealth, renderDashboard,
  startAutoRefresh, stopAutoRefresh,
  _refresh, _clearLogs, _clearStorage,
};

console.log('[HealthMonitor] Phase 5.1 System Health Monitor loaded');

})();
