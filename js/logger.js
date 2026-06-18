/* ============================================================
   SYSTEM LOGGER — js/logger.js
   Phase 5.1: Structured logging with localStorage ring buffer.

   Schema: { timestamp, module, level, message, data? }
   Levels:  DEBUG | INFO | WARN | ERROR

   Storage key: cc_logs (ring buffer, max MAX_ENTRIES)
   ============================================================ */

(function () {

const KEY        = 'cc_logs';
const MAX_ENTRIES = 300;
const LEVELS      = { DEBUG:0, INFO:1, WARN:2, ERROR:3 };

/* ── In-memory buffer (sync with localStorage) ── */
let _buf = [];
try { _buf = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { _buf = []; }

/* ── Core write ── */
function _write(level, module, message, data) {
  const entry = {
    ts:      new Date().toISOString(),
    level,
    module:  String(module || 'app').substring(0, 32),
    message: String(message || '').substring(0, 512),
  };
  if (data !== undefined) {
    try { entry.data = JSON.parse(JSON.stringify(data)); } catch(e) {}
  }

  _buf.push(entry);

  /* Trim to ring buffer size */
  if (_buf.length > MAX_ENTRIES) _buf = _buf.slice(-MAX_ENTRIES);

  /* Persist (best-effort — don't throw if quota exceeded) */
  try { localStorage.setItem(KEY, JSON.stringify(_buf)); } catch(e) {}

  /* Mirror critical messages to console */
  if (level === 'ERROR') {
    console.error(`[${module}] ${message}`, data !== undefined ? data : '');
  } else if (level === 'WARN') {
    console.warn(`[${module}] ${message}`, data !== undefined ? data : '');
  }

  /* Dispatch custom event so Health Monitor can update live */
  try {
    window.dispatchEvent(new CustomEvent('cc:log', { detail: entry }));
  } catch(e) {}
}

/* ── Public logging API ── */
function debug(module, message, data) { _write('DEBUG', module, message, data); }
function info (module, message, data) { _write('INFO',  module, message, data); }
function warn (module, message, data) { _write('WARN',  module, message, data); }
function error(module, message, data) { _write('ERROR', module, message, data); }

/* ── Query API ── */
function getLog(opts) {
  opts = opts || {};
  let entries = _buf.slice();

  if (opts.level) {
    const minLevel = LEVELS[opts.level] || 0;
    entries = entries.filter(e => (LEVELS[e.level] || 0) >= minLevel);
  }
  if (opts.module) {
    entries = entries.filter(e => e.module === opts.module);
  }
  if (opts.limit) {
    entries = entries.slice(-opts.limit);
  }
  return entries;
}

function getStats() {
  const counts = { DEBUG:0, INFO:0, WARN:0, ERROR:0 };
  _buf.forEach(e => { if (counts[e.level] !== undefined) counts[e.level]++; });
  return {
    total:    _buf.length,
    capacity: MAX_ENTRIES,
    pct:      Math.round(_buf.length / MAX_ENTRIES * 100),
    counts,
  };
}

function clear() {
  _buf = [];
  try { localStorage.removeItem(KEY); } catch(e) {}
}

/* ── Global JS error catcher ── */
window.addEventListener('error', function(ev) {
  error('window', ev.message || 'JS Error', {
    source: ev.filename, line: ev.lineno, col: ev.colno,
  });
});
window.addEventListener('unhandledrejection', function(ev) {
  error('window', 'Unhandled promise rejection', {
    reason: String(ev.reason || '').substring(0, 200),
  });
});

/* ── LocalStorage quota watchdog ── */
function _checkQuota() {
  let used = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      used += (localStorage.getItem(k) || '').length;
    }
    const pct = Math.round(used / 5_000_000 * 100); /* ~5 MB typical quota */
    if (pct > 85) {
      warn('Storage', `localStorage ${pct}% full (${(used/1024).toFixed(0)} KB) — consider clearing old data`);
      return { ok: false, pct, used };
    }
    return { ok: true, pct, used };
  } catch(e) {
    return { ok: false, pct: 100, used: 0 };
  }
}

window.CCLogger = {
  debug, info, warn, error,
  getLog, getStats, clear,
  checkQuota: _checkQuota,
  LEVELS,
};

console.log('[CCLogger] Phase 5.1 System Logger loaded');

})();
