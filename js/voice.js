/* ============================================================
   VOICE EDITING COPILOT — js/voice.js
   Phase 5.3: Voice → STT → AI Copilot → Action Engine → Editor

   Architecture:
     Web Speech API (STT)
       ↓
     VoiceCopilot (this file)
       ↓
     /ai/editor-command  (existing endpoint)
       ↓
     executeActions()    (existing Action Engine)
       ↓
     Timeline / Editor

   Public API:
     VoiceCopilot.startListening()
     VoiceCopilot.stopListening()
     VoiceCopilot.pushToTalk()      — hold-to-talk
     VoiceCopilot.setHotword(bool)  — "Hey Editor" activation
     VoiceCopilot.getHistory()      → [{command,action,timestamp}]
     VoiceCopilot.openPanel()
     VoiceCopilot.closePanel()
   ============================================================ */

(function () {

/* ══════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════ */

const HOTWORDS      = ['hey editor', 'hey ai', 'này editor', 'này ai'];
const LS_HISTORY    = 'cc_voice_history';
const MAX_HISTORY   = 50;

/* Destructive action types that require confirmation */
const DESTRUCTIVE = new Set([
  'delete_clip', 'remove_silence', 'export_batch',
  'generate_batch', 'generate_content_factory', 'export_factory',
  'prepare_publish_package',
]);

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */

let _recognition   = null;
let _listening     = false;
let _hotwordMode   = false;
let _hotwordActive = false;  // true after hotword detected, waiting for command
let _pttActive     = false;
let _history       = _loadHistory();
let _pendingConfirm = null;  // { actions, transcript } waiting for yes/no

/* ══════════════════════════════════════════════════════════
   SPEECH RECOGNITION SETUP
   ══════════════════════════════════════════════════════════ */

function _createRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return null;

  const r = new SpeechRec();
  r.continuous       = true;
  r.interimResults   = true;
  r.maxAlternatives  = 1;
  r.lang             = _detectLang();

  r.onstart   = _onRecStart;
  r.onend     = _onRecEnd;
  r.onresult  = _onRecResult;
  r.onerror   = _onRecError;
  return r;
}

function _detectLang() {
  const nav = (navigator.language || navigator.userLanguage || 'vi').toLowerCase();
  if (nav.startsWith('vi')) return 'vi-VN';
  if (nav.startsWith('en')) return 'en-US';
  return nav;
}

/* ══════════════════════════════════════════════════════════
   RECOGNITION EVENTS
   ══════════════════════════════════════════════════════════ */

let _interimEl = null;

function _onRecStart() {
  _listening = true;
  _updateMicBtn(true);
  _setFeedback('🎤 Đang nghe...', 'listening');
}

function _onRecEnd() {
  _listening = false;
  _updateMicBtn(false);
  if (_pttActive) return;
  // In continuous mode: restart unless stopped intentionally
  if (_hotwordMode && !_hotwordActive) {
    try { _recognition && _recognition.start(); } catch {}
  } else if (!_hotwordMode) {
    _setFeedback('🎤 Xong — nhấn mic để nghe lại', 'idle');
  }
}

function _onRecError(e) {
  if (e.error === 'not-allowed') {
    _setFeedback('❌ Không có quyền micro. Cho phép mic trong trình duyệt.', 'error');
    _toast('❌ Voice: cần quyền micro');
  } else if (e.error === 'no-speech') {
    _setFeedback('🎤 Không nghe thấy gì...', 'idle');
  } else if (e.error !== 'aborted') {
    _setFeedback('⚠️ Lỗi nhận diện: ' + e.error, 'error');
  }
  _listening = false;
  _updateMicBtn(false);
}

function _onRecResult(event) {
  let interim = '';
  let finalText = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result.isFinal) {
      finalText += result[0].transcript;
    } else {
      interim += result[0].transcript;
    }
  }

  if (interim) {
    _setFeedback('🎤 ' + interim, 'listening');
  }

  if (!finalText.trim()) return;

  const text = finalText.trim();

  // ── Hotword detection ──────────────────────────────────
  if (_hotwordMode) {
    const lower = text.toLowerCase();
    const hw = HOTWORDS.find(h => lower.includes(h));
    if (hw && !_hotwordActive) {
      _hotwordActive = true;
      const after = lower.slice(lower.indexOf(hw) + hw.length).trim();
      _setFeedback('✅ Đã nghe "' + hw + '" — nói lệnh của bạn...', 'ready');
      if (after.length > 2) {
        _hotwordActive = false;
        _processCommand(after, text);
      }
      return;
    }
    if (_hotwordActive && text.length > 2) {
      _hotwordActive = false;
      _processCommand(text, text);
      return;
    }
    return;
  }

  // ── Confirmation response ──────────────────────────────
  if (_pendingConfirm) {
    const lower = text.toLowerCase();
    if (/\b(có|yes|ok|đồng ý|confirm|chắc|sure)\b/.test(lower)) {
      _applyConfirmed();
    } else if (/\b(không|no|hủy|cancel|thôi|bỏ)\b/.test(lower)) {
      _cancelConfirm();
    }
    return;
  }

  // ── Normal command ─────────────────────────────────────
  _processCommand(text, text);
}

/* ══════════════════════════════════════════════════════════
   COMMAND PROCESSING
   ══════════════════════════════════════════════════════════ */

async function _processCommand(prompt, rawTranscript) {
  _setFeedback(`🎤 Đã hiểu: "${rawTranscript}"`, 'recognized');
  _showPanel();

  const logEl = document.getElementById('vc-log');
  const entry = _addLog(logEl, rawTranscript, '⏳ Đang gửi tới AI...', 'processing');

  // Build editor state (same as ai.js)
  const state = _serializeState();

  let actions = [];
  try {
    const resp = await fetch('/ai/editor-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, editorState: state }),
    });
    const data = await resp.json();

    if (data.error) {
      _updateLog(entry, '❌ AI: ' + data.error, 'error');
      _setFeedback('❌ ' + data.error, 'error');
      return;
    }

    actions = data.actions || [];
    if (!actions.length) {
      const msg = data.message || 'Không có hành động nào.';
      _updateLog(entry, '⚠️ ' + msg, 'warn');
      _setFeedback('⚠️ ' + msg, 'idle');
      _saveHistory(rawTranscript, 'no_action', '');
      return;
    }
  } catch (e) {
    _updateLog(entry, '❌ Không kết nối được AI server', 'error');
    _setFeedback('❌ Không kết nối AI', 'error');
    return;
  }

  // ── Destructive confirmation gate ──────────────────────
  const destructive = actions.filter(a => DESTRUCTIVE.has(a.type));
  if (destructive.length) {
    _pendingConfirm = { actions, transcript: rawTranscript, entry };
    const names = destructive.map(a => a.type.replace(/_/g, ' ')).join(', ');
    const count = actions.length;
    const msg = `Bạn có chắc muốn thực hiện ${count} hành động (bao gồm: ${names})?`;
    _updateLog(entry, '⚠️ ' + msg, 'warn');
    _setFeedback('⚠️ ' + msg + ' Nói "Có" hoặc "Không".', 'confirm');
    _renderConfirmUI(msg, actions, entry);
    return;
  }

  _executeAndLog(actions, rawTranscript, entry);
}

function _executeAndLog(actions, rawTranscript, entry) {
  if (typeof executeActions !== 'function') {
    _updateLog(entry, '❌ Action Engine chưa load', 'error');
    return;
  }

  const results = executeActions(actions);
  const ok   = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;

  const summary = `✅ ${ok} hành động${fail ? ' · ❌ ' + fail + ' thất bại' : ''}`;
  _updateLog(entry, summary + '\n' + actions.map((a, i) =>
    `  ${i+1}. ${a.type}${a.params && a.params.clipId ? ' → ' + a.params.clipId : ''}`
  ).join('\n'), ok > 0 ? 'ok' : 'error');

  _setFeedback(ok > 0 ? `✅ ${ok} hành động hoàn tất` : '❌ Thất bại', ok > 0 ? 'done' : 'error');
  _saveHistory(rawTranscript, actions.map(a => a.type).join(','), summary);
  _toast(ok > 0 ? `🎤 Voice: ${ok} hành động xong` : '🎤 Voice: thất bại');
}

function _applyConfirmed() {
  if (!_pendingConfirm) return;
  const { actions, transcript, entry } = _pendingConfirm;
  _pendingConfirm = null;
  _removePendingConfirmUI();
  _setFeedback('🎤 Đang thực hiện...', 'processing');
  _executeAndLog(actions, transcript, entry);
}

function _cancelConfirm() {
  if (!_pendingConfirm) return;
  const { entry } = _pendingConfirm;
  _pendingConfirm = null;
  _removePendingConfirmUI();
  _updateLog(entry, '🚫 Đã hủy bởi người dùng', 'warn');
  _setFeedback('🚫 Đã hủy', 'idle');
  _toast('🎤 Voice: đã hủy');
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

function startListening() {
  if (_listening) return;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    _toast('❌ Trình duyệt không hỗ trợ nhận diện giọng nói');
    _setFeedback('❌ Trình duyệt không hỗ trợ Voice. Dùng Chrome/Edge.', 'error');
    return;
  }
  try {
    _recognition = _createRecognition();
    _recognition.start();
  } catch (e) {
    _setFeedback('❌ ' + e.message, 'error');
  }
}

function stopListening() {
  if (_recognition) {
    try { _recognition.stop(); } catch {}
  }
  _listening = false;
  _hotwordActive = false;
  _pttActive = false;
  _updateMicBtn(false);
  _setFeedback('🎤 Đã dừng', 'idle');
}

function pushToTalk() {
  if (_pttActive) {
    _pttActive = false;
    stopListening();
    return;
  }
  _pttActive = true;
  startListening();
}

function setHotword(enabled) {
  _hotwordMode = !!enabled;
  const btn = document.getElementById('vc-hotword-btn');
  if (btn) btn.classList.toggle('on', _hotwordMode);

  if (_hotwordMode) {
    startListening();
    _setFeedback('🎤 Chế độ hotword bật — nói "Hey Editor"', 'idle');
    _toast('🎤 Hotword: "Hey Editor" / "Hey AI"');
  } else {
    stopListening();
    _setFeedback('', 'idle');
  }
}

function getHistory() { return [..._history]; }
function openPanel()  { document.getElementById('vc-panel')?.classList.add('open'); }
function closePanel() { document.getElementById('vc-panel')?.classList.remove('open'); }

/* ══════════════════════════════════════════════════════════
   HISTORY
   ══════════════════════════════════════════════════════════ */

function _loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); } catch { return []; }
}

function _saveHistory(command, action, result) {
  _history.unshift({ command, action, result, timestamp: new Date().toISOString() });
  if (_history.length > MAX_HISTORY) _history.length = MAX_HISTORY;
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(_history)); } catch {}
}

/* ══════════════════════════════════════════════════════════
   SERIALIZE EDITOR STATE (mirrors ai.js)
   ══════════════════════════════════════════════════════════ */

function _serializeState() {
  try {
    if (typeof editorState === 'undefined') return {};
    const transcriptSegs = (
      typeof TranscriptEngine !== 'undefined' && typeof TranscriptEngine.getSegments === 'function'
        ? TranscriptEngine.getSegments()
        : []
    ).slice(0, 60);
    return {
      project:   editorState.project,
      tracks: (editorState.tracks || []).map(tr => ({
        id: tr.id, type: tr.type, label: tr.label,
        clips: (tr.clips || []).map(c => ({
          id: c.id, start: c.start, dur: c.dur, label: c.label, cls: c.cls
        }))
      })),
      subtitles: (editorState.subtitles || []).slice(0, 20),
      playhead:  typeof playhead !== 'undefined' ? playhead : 0,
      transcriptSegments: transcriptSegs,
    };
  } catch { return {}; }
}

/* ══════════════════════════════════════════════════════════
   UI — TOPBAR MIC BUTTON
   ══════════════════════════════════════════════════════════ */

function _buildTopbarBtn() {
  if (document.getElementById('vc-mic-btn')) return;
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const sep = document.createElement('div');
  sep.className = 'tb-divider';

  const btn = document.createElement('button');
  btn.id = 'vc-mic-btn';
  btn.title = 'Voice Copilot — điều khiển editor bằng giọng nói';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg> Voice`;
  btn.addEventListener('click', () => {
    const panelEl = document.getElementById('vc-panel');
    const isOpen = panelEl?.classList.contains('open');
    isOpen ? closePanel() : openPanel();
  });

  const exportBtn = topbar.querySelector('.tb-export');
  if (exportBtn) {
    topbar.insertBefore(sep, exportBtn);
    topbar.insertBefore(btn, exportBtn);
  } else {
    topbar.appendChild(sep);
    topbar.appendChild(btn);
  }
}

function _updateMicBtn(active) {
  const btn = document.getElementById('vc-mic-btn');
  if (!btn) return;
  btn.classList.toggle('vc-active', active);
  btn.querySelector('svg').style.stroke = active ? '#e57373' : 'currentColor';
}

/* ══════════════════════════════════════════════════════════
   UI — VOICE PANEL (right sidebar)
   ══════════════════════════════════════════════════════════ */

function _buildPanel() {
  if (document.getElementById('vc-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'vc-panel';
  panel.innerHTML = `
<div class="vc-header">
  <div class="vc-header-left">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--vc-accent)" stroke-width="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    </svg>
    <span>Voice Copilot</span>
  </div>
  <button class="vc-close" onclick="VoiceCopilot.closePanel()">✕</button>
</div>

<div class="vc-controls">
  <div class="vc-btn-row">
    <button class="vc-btn vc-btn-primary" id="vc-listen-btn" onclick="window._vcToggleListen()">
      🎤 Bắt đầu nghe
    </button>
    <button class="vc-btn" id="vc-ptt-btn" title="Giữ để nói — thả để gửi"
      onmousedown="VoiceCopilot.pushToTalk()" onmouseup="VoiceCopilot.pushToTalk()"
      ontouchstart="VoiceCopilot.pushToTalk()" ontouchend="VoiceCopilot.pushToTalk()">
      ⌨ Giữ nói
    </button>
  </div>
  <div class="vc-btn-row">
    <button class="vc-btn" id="vc-hotword-btn" onclick="VoiceCopilot.setHotword(!window._vcHotword())" title="Bật/tắt hotword Hey Editor">
      💬 Hotword: Tắt
    </button>
    <select class="vc-lang-sel" id="vc-lang-sel" title="Ngôn ngữ nhận diện">
      <option value="vi-VN">🇻🇳 Tiếng Việt</option>
      <option value="en-US">🇺🇸 English</option>
    </select>
  </div>

  <div class="vc-feedback" id="vc-feedback">
    <span class="vc-feedback-dot" id="vc-feedback-dot"></span>
    <span id="vc-feedback-text">Nhấn "Bắt đầu nghe" hoặc giữ "Giữ nói"</span>
  </div>
</div>

<div class="vc-section-title">Ví dụ lệnh</div>
<div class="vc-chips" id="vc-chips">
  <button class="vc-chip" onclick="window._vcRunChip(this)">Cắt đoạn này</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Tạo subtitle</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Tạo 5 shorts</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Xuất 1080p</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Highlight từ khóa</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Xóa clip đang chọn</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Đổi subtitle sang MrBeast</button>
  <button class="vc-chip" onclick="window._vcRunChip(this)">Tách clip tại playhead</button>
</div>

<div class="vc-divider"></div>
<div class="vc-section-title" style="display:flex;justify-content:space-between;align-items:center">
  <span>Lịch sử lệnh</span>
  <button class="vc-clear-btn" onclick="window._vcClearHistory()">Xóa</button>
</div>
<div class="vc-log" id="vc-log">
  <div class="vc-log-empty">Chưa có lệnh nào.</div>
</div>
`;

  // Insert before ai-copilot-panel (so both panels can be open independently)
  const acpPanel = document.getElementById('ai-copilot-panel');
  if (acpPanel) {
    acpPanel.parentNode.insertBefore(panel, acpPanel);
  } else {
    document.body.appendChild(panel);
  }
}

/* ══════════════════════════════════════════════════════════
   UI — FEEDBACK OVERLAY
   ══════════════════════════════════════════════════════════ */

function _setFeedback(text, state) {
  const textEl = document.getElementById('vc-feedback-text');
  const dotEl  = document.getElementById('vc-feedback-dot');
  const wrap   = document.getElementById('vc-feedback');
  if (!textEl || !dotEl || !wrap) return;

  textEl.textContent = text;
  wrap.className     = 'vc-feedback vc-fb-' + (state || 'idle');
  dotEl.className    = 'vc-feedback-dot vc-dot-' + (state || 'idle');
}

/* ══════════════════════════════════════════════════════════
   UI — LOG ENTRIES
   ══════════════════════════════════════════════════════════ */

function _addLog(container, command, result, state) {
  if (!container) return null;
  const empty = container.querySelector('.vc-log-empty');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = 'vc-log-entry';
  el.innerHTML = `
    <div class="vc-log-cmd">"${_esc(command)}"</div>
    <div class="vc-log-result vc-result-${state}">${_esc(result)}</div>
    <div class="vc-log-time">${new Date().toLocaleTimeString('vi-VN')}</div>
  `;
  container.insertBefore(el, container.firstChild);
  return el;
}

function _updateLog(entry, result, state) {
  if (!entry) return;
  const resultEl = entry.querySelector('.vc-log-result');
  if (resultEl) {
    resultEl.className = 'vc-log-result vc-result-' + state;
    resultEl.textContent = result;
  }
}

function _renderConfirmUI(msg, actions, entry) {
  const existing = document.getElementById('vc-confirm-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'vc-confirm-bar';
  bar.className = 'vc-confirm-bar';
  bar.innerHTML = `
    <div class="vc-confirm-msg">⚠️ ${_esc(msg)}</div>
    <div class="vc-confirm-btns">
      <button class="vc-btn vc-btn-danger" onclick="VoiceCopilot._applyConfirmed()">✅ Có, thực hiện</button>
      <button class="vc-btn" onclick="VoiceCopilot._cancelConfirm()">🚫 Hủy</button>
    </div>
  `;
  const logEl = document.getElementById('vc-log');
  if (logEl) logEl.parentNode.insertBefore(bar, logEl);
}

function _removePendingConfirmUI() {
  document.getElementById('vc-confirm-bar')?.remove();
}

/* ══════════════════════════════════════════════════════════
   CSS INJECTION
   ══════════════════════════════════════════════════════════ */

function _injectStyles() {
  if (document.getElementById('vc-styles')) return;
  const st = document.createElement('style');
  st.id = 'vc-styles';
  st.textContent = `
:root { --vc-accent: #e57373; --vc-accent2: #ef9a9a; }

/* ── Topbar mic button ── */
#vc-mic-btn {
  display:flex;align-items:center;gap:5px;
  background:rgba(229,115,115,.12);
  border:1px solid rgba(229,115,115,.35);
  border-radius:7px;color:#e57373;
  padding:0 12px;height:34px;font-size:12px;
  cursor:pointer;white-space:nowrap;flex-shrink:0;
  transition:background .15s,border-color .15s;
}
#vc-mic-btn:hover { background:rgba(229,115,115,.22); border-color:rgba(229,115,115,.6); }
#vc-mic-btn.vc-active {
  background:rgba(229,115,115,.28);
  border-color:rgba(229,115,115,.8);
  animation:vc-pulse .9s ease-in-out infinite;
}
@keyframes vc-pulse {
  0%,100% { box-shadow:0 0 0 0 rgba(229,115,115,.4); }
  50%      { box-shadow:0 0 0 5px rgba(229,115,115,.0); }
}

/* ── Panel ── */
#vc-panel {
  position:fixed;right:-340px;top:0;width:320px;height:100vh;
  background:var(--bg1);border-left:1px solid var(--border);
  display:flex;flex-direction:column;z-index:850;
  transition:right .22s cubic-bezier(.4,0,.2,1);
  box-shadow:-4px 0 24px rgba(0,0,0,.35);overflow:hidden;
}
#vc-panel.open { right:0; }

.vc-header {
  height:42px;display:flex;align-items:center;justify-content:space-between;
  padding:0 12px;border-bottom:1px solid var(--border);flex-shrink:0;gap:8px;
}
.vc-header-left {
  display:flex;align-items:center;gap:7px;
  font-size:11px;font-weight:700;letter-spacing:.5px;
  text-transform:uppercase;color:var(--vc-accent);
}
.vc-close {
  background:none;border:none;color:var(--t3);cursor:pointer;
  width:22px;height:22px;border-radius:5px;font-size:13px;
  display:flex;align-items:center;justify-content:center;
}
.vc-close:hover { background:var(--bg3);color:var(--t1); }

/* ── Controls ── */
.vc-controls {
  padding:10px 12px 8px;display:flex;flex-direction:column;gap:7px;
  border-bottom:1px solid var(--border);flex-shrink:0;
}
.vc-btn-row { display:flex;gap:7px; }
.vc-btn {
  flex:1;background:var(--bg3);border:1px solid var(--border2);
  border-radius:7px;color:var(--t2);font-size:11px;font-weight:600;
  padding:8px 10px;cursor:pointer;text-align:center;
  transition:background .12s,color .12s,border-color .12s;
}
.vc-btn:hover { background:var(--bg4);color:var(--t1); }
.vc-btn.on  { border-color:rgba(229,115,115,.6);background:rgba(229,115,115,.12);color:var(--vc-accent); }
.vc-btn-primary {
  background:rgba(229,115,115,.15);border-color:rgba(229,115,115,.4);color:var(--vc-accent);
}
.vc-btn-primary:hover { background:rgba(229,115,115,.25); }
.vc-btn-primary.listening {
  background:rgba(229,115,115,.3);border-color:rgba(229,115,115,.8);
  animation:vc-pulse .9s ease-in-out infinite;
}
.vc-btn-danger {
  background:rgba(229,115,115,.2);border-color:rgba(229,115,115,.5);color:#ef9a9a;
}
.vc-btn-danger:hover { background:rgba(229,115,115,.35); }

.vc-lang-sel {
  flex:1;background:var(--bg2);border:1px solid var(--border2);
  border-radius:7px;color:var(--t1);font-size:11px;padding:7px 8px;
  outline:none;cursor:pointer;
}

/* ── Feedback bar ── */
.vc-feedback {
  display:flex;align-items:flex-start;gap:7px;
  background:var(--bg2);border:1px solid var(--border2);
  border-radius:8px;padding:8px 10px;font-size:11px;color:var(--t2);
  min-height:36px;line-height:1.5;
  transition:border-color .2s,background .2s;
}
.vc-feedback-dot {
  width:8px;height:8px;border-radius:50%;background:var(--t3);
  flex-shrink:0;margin-top:3px;transition:background .2s;
}
.vc-fb-listening  { border-color:rgba(229,115,115,.5);background:rgba(229,115,115,.07); }
.vc-fb-listening .vc-feedback-dot { background:#e57373;animation:vc-blink .8s infinite; }
.vc-fb-recognized { border-color:rgba(212,160,23,.5);background:rgba(212,160,23,.07); }
.vc-fb-recognized .vc-feedback-dot { background:var(--accent); }
.vc-fb-processing { border-color:rgba(130,80,255,.5);background:rgba(130,80,255,.07); }
.vc-fb-processing .vc-feedback-dot { background:#9060d0;animation:vc-blink .6s infinite; }
.vc-fb-ok,.vc-fb-done { border-color:rgba(76,175,80,.5);background:rgba(76,175,80,.07); }
.vc-fb-ok .vc-feedback-dot,.vc-fb-done .vc-feedback-dot { background:#4caf50; }
.vc-fb-confirm { border-color:rgba(229,115,115,.6);background:rgba(229,115,115,.1); }
.vc-fb-confirm .vc-feedback-dot { background:#e57373;animation:vc-blink .5s infinite; }
.vc-fb-error { border-color:rgba(229,115,115,.4); }
.vc-fb-error .vc-feedback-dot { background:#e57373; }
@keyframes vc-blink { 0%,100%{opacity:1} 50%{opacity:.2} }

/* ── Example chips ── */
.vc-section-title {
  font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;
  padding:8px 12px 4px;flex-shrink:0;
}
.vc-chips {
  display:flex;flex-wrap:wrap;gap:5px;padding:0 12px 8px;flex-shrink:0;
}
.vc-chip {
  background:var(--bg2);border:1px solid var(--border2);
  border-radius:6px;color:var(--t2);font-size:10px;
  padding:4px 9px;cursor:pointer;transition:background .1s,color .1s;
}
.vc-chip:hover { background:var(--bg3);color:var(--t1); }

.vc-divider { height:1px;background:var(--border);flex-shrink:0; }

/* ── Confirm bar ── */
.vc-confirm-bar {
  background:rgba(229,115,115,.1);border:1px solid rgba(229,115,115,.4);
  border-radius:8px;margin:0 12px 6px;padding:10px;
  display:flex;flex-direction:column;gap:8px;flex-shrink:0;
}
.vc-confirm-msg { font-size:11px;color:var(--vc-accent2);line-height:1.5; }
.vc-confirm-btns { display:flex;gap:7px; }

/* ── Log ── */
.vc-clear-btn {
  background:none;border:none;color:var(--t3);font-size:10px;
  cursor:pointer;padding:2px 6px;border-radius:4px;
}
.vc-clear-btn:hover { background:var(--bg3);color:var(--t1); }
.vc-log {
  flex:1;overflow-y:auto;padding:4px 12px 12px;
  display:flex;flex-direction:column;gap:6px;min-height:0;
}
.vc-log::-webkit-scrollbar{width:4px}
.vc-log::-webkit-scrollbar-thumb{background:var(--bg5);border-radius:2px}
.vc-log-empty { font-size:11px;color:var(--t3);text-align:center;padding:16px 0; }
.vc-log-entry {
  background:var(--bg2);border:1px solid var(--border);
  border-radius:7px;padding:8px 10px;
  display:flex;flex-direction:column;gap:3px;
}
.vc-log-cmd { font-size:11px;color:var(--t1);font-style:italic; }
.vc-log-result {
  font-size:10px;color:var(--t3);white-space:pre-wrap;line-height:1.5;
}
.vc-result-ok,.vc-result-done { color:#4caf50; }
.vc-result-error { color:#e57373; }
.vc-result-warn  { color:var(--accent); }
.vc-log-time { font-size:9px;color:var(--t3); }
`;
  document.head.appendChild(st);
}

/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */

function _esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _toast(msg) {
  if (typeof toast === 'function') toast(msg);
}

function _showPanel() {
  openPanel();
}

/* ══════════════════════════════════════════════════════════
   GLOBAL HELPERS (called from inline HTML)
   ══════════════════════════════════════════════════════════ */

window._vcToggleListen = function () {
  const btn = document.getElementById('vc-listen-btn');
  if (_listening) {
    stopListening();
    if (btn) { btn.textContent = '🎤 Bắt đầu nghe'; btn.classList.remove('listening'); }
  } else {
    startListening();
    if (btn) { btn.textContent = '⏹ Dừng nghe'; btn.classList.add('listening'); }
  }
};

window._vcHotword = function () { return _hotwordMode; };

window._vcRunChip = function (el) {
  const cmd = el.textContent.trim();
  openPanel();
  _processCommand(cmd, cmd);
};

window._vcClearHistory = function () {
  _history = [];
  try { localStorage.removeItem(LS_HISTORY); } catch {}
  const logEl = document.getElementById('vc-log');
  if (logEl) logEl.innerHTML = '<div class="vc-log-empty">Chưa có lệnh nào.</div>';
};

/* Keep listen button in sync */
setInterval(() => {
  const btn = document.getElementById('vc-listen-btn');
  const hw  = document.getElementById('vc-hotword-btn');
  if (btn) {
    btn.textContent = _listening ? '⏹ Dừng nghe' : '🎤 Bắt đầu nghe';
    btn.classList.toggle('listening', _listening);
  }
  if (hw) {
    hw.textContent  = _hotwordMode ? '💬 Hotword: Bật' : '💬 Hotword: Tắt';
    hw.classList.toggle('on', _hotwordMode);
  }
}, 500);

/* Language picker */
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'vc-lang-sel') {
    if (_recognition) {
      _recognition.lang = e.target.value;
      if (_listening) { stopListening(); startListening(); }
    }
  }
});

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

function _init() {
  _injectStyles();
  _buildTopbarBtn();
  _buildPanel();
}

document.addEventListener('DOMContentLoaded', _init);
setTimeout(_init, 400);

/* ══════════════════════════════════════════════════════════
   PUBLIC NAMESPACE
   ══════════════════════════════════════════════════════════ */

window.VoiceCopilot = {
  startListening,
  stopListening,
  pushToTalk,
  setHotword,
  getHistory,
  openPanel,
  closePanel,
  _applyConfirmed,
  _cancelConfirm,
};

console.log('[VoiceCopilot] Phase 5.3 loaded — Voice → AI → Action Engine');

})();
