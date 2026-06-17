/* ============================================================
   AI COPILOT PANEL — js/ai.js
   Collapsible right sidebar. Sends prompts to /ai/editor-command,
   receives an actions[] array, previews them, then calls
   executeActions() from actions.js to apply to the timeline.
   ============================================================ */

(function () {
  /* ── CSS ──────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
/* Copilot toggle button (on topbar) */
#ai-copilot-toggle {
  display:flex;align-items:center;gap:5px;
  background:linear-gradient(135deg,#1a1040,#2a1860);
  border:1px solid rgba(130,80,255,.4);
  border-radius:7px;color:#b080ff;
  padding:0 12px;height:34px;font-size:12px;
  cursor:pointer;white-space:nowrap;flex-shrink:0;
  transition:background .15s,border-color .15s;
}
#ai-copilot-toggle:hover{background:linear-gradient(135deg,#22145a,#341e80);border-color:rgba(150,100,255,.7);color:#c8a0ff}
#ai-copilot-toggle.on{background:linear-gradient(135deg,#2e1870,#4020a0);border-color:rgba(160,110,255,.8);color:#d0b0ff}
#ai-copilot-toggle svg{width:14px;height:14px;fill:currentColor;stroke:none}

/* Copilot sidebar panel */
#ai-copilot-panel {
  width:0;overflow:hidden;
  background:var(--bg1);border-left:1px solid var(--border);
  display:flex;flex-direction:column;flex-shrink:0;
  transition:width .22s cubic-bezier(.4,0,.2,1);
}
#ai-copilot-panel.open { width:300px; }

.acp-header {
  height:40px;display:flex;align-items:center;padding:0 14px;
  border-bottom:1px solid var(--border);flex-shrink:0;gap:8px;
}
.acp-header-icon { font-size:15px; }
.acp-header-title {
  font-size:11px;font-weight:700;letter-spacing:.6px;
  text-transform:uppercase;color:#9060d0;flex:1;
}
.acp-close {
  background:none;border:none;color:var(--t3);cursor:pointer;
  width:22px;height:22px;display:flex;align-items:center;justify-content:center;
  border-radius:5px;font-size:14px;
}
.acp-close:hover{background:var(--bg3);color:var(--t1)}

.acp-body {
  flex:1;overflow-y:auto;display:flex;flex-direction:column;padding:12px;gap:10px;
  min-height:0;
}
.acp-body::-webkit-scrollbar{width:4px}
.acp-body::-webkit-scrollbar-thumb{background:var(--bg5);border-radius:2px}

.acp-examples {
  display:flex;flex-direction:column;gap:5px;
}
.acp-ex-title {
  font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;
}
.acp-ex-chip {
  background:var(--bg3);border:1px solid var(--border2);border-radius:6px;
  padding:6px 10px;font-size:11px;color:var(--t2);cursor:pointer;
  transition:background .1s,color .1s;text-align:left;
}
.acp-ex-chip:hover{background:var(--bg4);color:var(--t1)}

.acp-input-wrap {
  display:flex;flex-direction:column;gap:7px;
}
.acp-textarea {
  background:var(--bg2);border:1px solid var(--border2);
  border-radius:8px;color:var(--t1);font-size:12px;
  padding:9px 11px;resize:none;height:80px;outline:none;
  font-family:inherit;line-height:1.5;
  transition:border-color .15s;
}
.acp-textarea:focus{border-color:rgba(130,80,255,.6)}
.acp-textarea::placeholder{color:var(--t3)}

.acp-send-btn {
  background:linear-gradient(135deg,#4020a0,#6030d0);
  border:none;border-radius:8px;color:#fff;
  padding:9px 14px;font-size:12px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;
  transition:opacity .15s;
}
.acp-send-btn:hover{opacity:.88}
.acp-send-btn:disabled{opacity:.4;cursor:not-allowed}

.acp-status {
  font-size:11px;color:var(--t3);text-align:center;
  padding:6px 0;display:none;
}
.acp-status.show{display:block}

/* Action preview list */
.acp-actions-wrap {
  display:flex;flex-direction:column;gap:6px;
}
.acp-actions-title {
  font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;
}
.acp-action-item {
  background:var(--bg2);border:1px solid var(--border);
  border-radius:7px;padding:8px 10px;
  display:flex;flex-direction:column;gap:3px;
}
.acp-action-type {
  font-size:11px;font-weight:700;color:#9060d0;letter-spacing:.3px;
}
.acp-action-desc {
  font-size:11px;color:var(--t2);line-height:1.4;
}
.acp-apply-btn {
  background:var(--accent);border:none;border-radius:7px;color:#000;
  padding:8px;font-size:12px;font-weight:700;cursor:pointer;
  transition:background .1s;margin-top:2px;
}
.acp-apply-btn:hover{background:var(--accent2)}

.acp-divider {
  height:1px;background:var(--border);flex-shrink:0;
}
`;
  document.head.appendChild(style);

  /* ── Toggle button in topbar ─────────────────────────── */
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'ai-copilot-toggle';
  toggleBtn.innerHTML = `<svg viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/></svg> AI Copilot`;
  const topbar = document.getElementById('topbar');
  if (topbar) {
    const sep = document.createElement('div');
    sep.className = 'tb-divider';
    const exportBtn = topbar.querySelector('.tb-export');
    if (exportBtn) {
      topbar.insertBefore(sep, exportBtn);
      topbar.insertBefore(toggleBtn, exportBtn);
    } else {
      topbar.appendChild(sep);
      topbar.appendChild(toggleBtn);
    }
  }

  /* ── Sidebar panel HTML ──────────────────────────────── */
  const panel = document.getElementById('ai-copilot-panel');
  if (!panel) return;

  panel.innerHTML = `
<div class="acp-header">
  <span class="acp-header-icon">✦</span>
  <span class="acp-header-title">AI Copilot</span>
  <button class="acp-close" id="acp-close-btn" title="Đóng">✕</button>
</div>
<div class="acp-body">
  <div class="acp-examples">
    <div class="acp-ex-title">Thử ngay</div>
    <button class="acp-ex-chip" data-prompt="Remove silence from audio">🔇 Remove silence</button>
    <button class="acp-ex-chip" data-prompt="Create a 30 second short">✂️ Create 30s short</button>
    <button class="acp-ex-chip" data-prompt="Generate subtitles for all video clips">💬 Generate subtitles</button>
    <button class="acp-ex-chip" data-prompt="Split the video clip at the current playhead position">✂ Split at playhead</button>
    <button class="acp-ex-chip" data-prompt="Apply sunset style to selected clip">🎨 Apply sunset style</button>
    <button class="acp-ex-chip" data-prompt="Delete the selected clip">🗑 Delete selected clip</button>
  </div>
  <div class="acp-divider"></div>
  <div class="acp-input-wrap">
    <textarea class="acp-textarea" id="acp-input"
      placeholder="Describe what you want to do…&#10;e.g. "Remove silence and add subtitles""></textarea>
    <button class="acp-send-btn" id="acp-send-btn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Ask AI
    </button>
  </div>
  <div class="acp-status" id="acp-status">⏳ Thinking…</div>
  <div class="acp-actions-wrap" id="acp-actions-wrap" style="display:none">
    <div class="acp-actions-title">Proposed Actions</div>
    <div id="acp-actions-list"></div>
    <button class="acp-apply-btn" id="acp-apply-btn">⚡ Apply All Actions</button>
  </div>
</div>
`;

  /* ── Wiring ──────────────────────────────────────────── */
  let _pendingActions = [];

  function openPanel() {
    panel.classList.add('open');
    toggleBtn.classList.add('on');
  }
  function closePanel() {
    panel.classList.remove('open');
    toggleBtn.classList.remove('on');
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  document.getElementById('acp-close-btn').addEventListener('click', closePanel);

  /* Quick-chips fill the textarea */
  panel.querySelectorAll('.acp-ex-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('acp-input').value = chip.dataset.prompt;
      document.getElementById('acp-input').focus();
    });
  });

  /* Send button */
  document.getElementById('acp-send-btn').addEventListener('click', sendPrompt);
  document.getElementById('acp-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendPrompt(); }
  });

  /* Apply button */
  document.getElementById('acp-apply-btn').addEventListener('click', applyActions);

  async function sendPrompt() {
    const input = document.getElementById('acp-input');
    const prompt = (input.value || '').trim();
    if (!prompt) return;

    const sendBtn = document.getElementById('acp-send-btn');
    const statusEl = document.getElementById('acp-status');
    const actionsWrap = document.getElementById('acp-actions-wrap');

    sendBtn.disabled = true;
    statusEl.className = 'acp-status show';
    statusEl.textContent = '⏳ Thinking…';
    actionsWrap.style.display = 'none';
    _pendingActions = [];

    const state = typeof editorState !== 'undefined' ? _serializeState() : {};

    try {
      const resp = await fetch('/ai/editor-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, editorState: state })
      });
      const data = await resp.json();

      if (data.error) {
        statusEl.textContent = '❌ ' + data.error;
      } else {
        _pendingActions = data.actions || [];
        statusEl.className = 'acp-status';
        _renderActionPreview(_pendingActions);
      }
    } catch (e) {
      statusEl.className = 'acp-status show';
      statusEl.textContent = '❌ Cannot reach AI server. Check server logs.';
    }
    sendBtn.disabled = false;
  }

  function _serializeState() {
    try {
      if (typeof editorState === 'undefined') return {};
      return {
        project: editorState.project,
        tracks: (editorState.tracks || []).map(tr => ({
          id: tr.id, type: tr.type, label: tr.label,
          clips: tr.clips.map(c => ({
            id: c.id, start: c.start, dur: c.dur, label: c.label, cls: c.cls
          }))
        })),
        clips: (editorState.clips || []).map(c => ({
          id: c.id, start: c.start, dur: c.dur, label: c.label,
          cls: c.cls, trackId: c.trackId, trackType: c.trackType
        })),
        subtitles: (editorState.subtitles || []).slice(0, 20),
        playhead: typeof playhead !== 'undefined' ? playhead : 0
      };
    } catch (e) { return {}; }
  }

  const ACTION_LABELS = {
    cut_clip:       'Cut Clip',
    delete_clip:    'Delete Clip',
    split_clip:     'Split Clip',
    add_subtitle:   'Add Subtitle',
    remove_silence: 'Remove Silence',
    create_short:   'Create Short',
    apply_style:    'Apply Style'
  };

  function _actionDesc(action) {
    const p = action.params || {};
    switch (action.type) {
      case 'cut_clip':
        return `Clip ${p.clipId || 'selected'}: start=${p.newStart ?? '—'} end=${p.newEnd ?? '—'}`;
      case 'delete_clip':
        return `Remove clip${p.clipId ? ' ' + p.clipId : 's (selected)'}`;
      case 'split_clip':
        return `Split${p.clipId ? ' clip ' + p.clipId : ''} at ${p.time !== undefined ? p.time + 's' : 'playhead'}`;
      case 'add_subtitle':
        return `"${(p.text || '').substring(0, 40)}" @ ${p.start ?? 0}s for ${p.dur ?? 3}s`;
      case 'remove_silence':
        return `Remove silence segments (threshold ${p.threshold ?? 0.1})`;
      case 'create_short':
        return `Trim to ${p.duration ?? 30}s short`;
      case 'apply_style':
        return `Style "${p.style || 'none'}" → ${p.clipId ? 'clip ' + p.clipId : 'selected clips'}`;
      default:
        return JSON.stringify(p);
    }
  }

  function _renderActionPreview(actions) {
    const wrap = document.getElementById('acp-actions-wrap');
    const list = document.getElementById('acp-actions-list');
    if (!actions.length) {
      list.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:4px 0">No actions proposed.</div>';
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      document.getElementById('acp-apply-btn').style.display = 'none';
      return;
    }
    list.innerHTML = actions.map((a, i) => `
      <div class="acp-action-item">
        <div class="acp-action-type">${i + 1}. ${ACTION_LABELS[a.type] || a.type}</div>
        <div class="acp-action-desc">${_actionDesc(a)}</div>
      </div>`).join('');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    document.getElementById('acp-apply-btn').style.display = 'block';
  }

  function applyActions() {
    if (!_pendingActions.length) return;
    if (typeof executeActions !== 'function') {
      alert('Action engine not loaded — check js/actions.js');
      return;
    }
    const results = executeActions(_pendingActions);
    const ok = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    if (typeof toast === 'function') {
      toast(`✅ Applied ${ok} action${ok !== 1 ? 's' : ''}${fail ? ' · ' + fail + ' failed' : ''}`);
    }
    _pendingActions = [];
    document.getElementById('acp-actions-wrap').style.display = 'none';
    document.getElementById('acp-input').value = '';
  }

  /* Expose for external use */
  window.openAICopilot = openPanel;
})();
