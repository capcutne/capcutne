/**
 * BILLING & SUBSCRIPTION SYSTEM — js/billing.js
 * Phase 5.6 — Free / Pro / Business plans
 * Stripe Checkout + Customer Portal + Usage meters + Workspace manager
 */

'use strict';

const BillingManager = (() => {
  /* ── State ─────────────────────────────────────────────────────────────── */
  let _status  = null;   // from /billing/status
  let _plans   = null;   // from /billing/plans
  let _panel   = null;   // DOM panel element
  let _loaded  = false;

  /* ── CSS ───────────────────────────────────────────────────────────────── */
  const CSS = `
  #billing-btn{cursor:pointer;padding:4px 10px;border-radius:6px;border:1px solid var(--border2,#333);background:var(--bg2,#1a1a2e);color:var(--t1,#fff);font-size:11px;display:flex;align-items:center;gap:5px;transition:.2s}
  #billing-btn:hover{background:var(--accent,#f5c518);color:#000}
  #billing-btn .plan-badge{background:var(--accent,#f5c518);color:#000;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;text-transform:uppercase}
  #billing-panel{position:fixed;top:0;right:0;width:420px;height:100vh;background:var(--bg1,#11111a);border-left:1px solid var(--border1,#222);z-index:99999;display:flex;flex-direction:column;overflow:hidden;box-shadow:-6px 0 30px rgba(0,0,0,.6);transform:translateX(100%);transition:transform .25s ease}
  #billing-panel.open{transform:translateX(0)}
  .bp-head{padding:16px;border-bottom:1px solid var(--border1,#222);display:flex;align-items:center;justify-content:space-between}
  .bp-head h2{margin:0;font-size:15px;color:var(--t1,#fff)}
  .bp-close{background:none;border:none;color:var(--t2,#aaa);cursor:pointer;font-size:18px;padding:4px}
  .bp-tabs{display:flex;border-bottom:1px solid var(--border1,#222)}
  .bp-tab{flex:1;padding:9px;text-align:center;font-size:11px;cursor:pointer;color:var(--t2,#aaa);border-bottom:2px solid transparent;transition:.15s}
  .bp-tab.active{color:var(--accent,#f5c518);border-bottom-color:var(--accent,#f5c518)}
  .bp-body{flex:1;overflow-y:auto;padding:16px}
  .bp-section{margin-bottom:20px}
  .bp-section h3{font-size:12px;color:var(--t2,#aaa);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px}
  /* Usage meters */
  .usage-meter{margin-bottom:12px}
  .usage-meter-header{display:flex;justify-content:space-between;font-size:11px;color:var(--t2,#aaa);margin-bottom:4px}
  .usage-meter-bar{height:5px;background:var(--bg3,#222);border-radius:3px;overflow:hidden}
  .usage-meter-fill{height:100%;border-radius:3px;transition:width .4s}
  .usage-meter-fill.ok{background:var(--accent,#f5c518)}
  .usage-meter-fill.warn{background:#e67e22}
  .usage-meter-fill.over{background:#e74c3c}
  /* Plan cards */
  .plan-cards{display:flex;flex-direction:column;gap:10px}
  .plan-card{border:1px solid var(--border1,#333);border-radius:10px;padding:14px;position:relative;transition:.2s}
  .plan-card.current{border-color:var(--accent,#f5c518);background:rgba(245,197,24,.05)}
  .plan-card.popular::before{content:"POPULAR";position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--accent,#f5c518);color:#000;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px}
  .plan-name{font-size:14px;font-weight:700;color:var(--t1,#fff);margin-bottom:2px}
  .plan-price{font-size:22px;font-weight:700;color:var(--accent,#f5c518)}
  .plan-price span{font-size:11px;color:var(--t2,#aaa);font-weight:400}
  .plan-features{margin:10px 0;font-size:11px;color:var(--t2,#aaa);list-style:none;padding:0}
  .plan-features li{padding:2px 0}
  .plan-features li::before{content:"✓ ";color:var(--accent,#f5c518)}
  .plan-features li.locked::before{content:"✗ ";color:#e74c3c}
  .plan-cta{width:100%;padding:8px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600;margin-top:8px;transition:.2s}
  .plan-cta.upgrade{background:var(--accent,#f5c518);color:#000}
  .plan-cta.upgrade:hover{opacity:.85}
  .plan-cta.current-plan{background:var(--bg3,#333);color:var(--t2,#aaa);cursor:default}
  .plan-cta.downgrade{background:transparent;border:1px solid var(--border2,#444);color:var(--t2,#aaa)}
  /* Workspace */
  .ws-item{border:1px solid var(--border1,#333);border-radius:8px;padding:12px;margin-bottom:8px}
  .ws-name{font-size:13px;font-weight:600;color:var(--t1,#fff)}
  .ws-meta{font-size:10px;color:var(--t2,#aaa);margin-top:2px}
  .ws-members{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
  .ws-member{background:var(--bg3,#222);border-radius:20px;padding:3px 8px;font-size:10px;color:var(--t2,#aaa)}
  .ws-member.owner{color:var(--accent,#f5c518)}
  .bp-input{width:100%;background:var(--bg3,#222);border:1px solid var(--border2,#333);border-radius:6px;color:var(--t1,#fff);font-size:12px;padding:7px;box-sizing:border-box;margin-bottom:8px}
  .bp-btn{padding:7px 14px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;transition:.2s}
  .bp-btn.primary{background:var(--accent,#f5c518);color:#000}
  .bp-btn.primary:hover{opacity:.85}
  .bp-btn.secondary{background:var(--bg3,#333);color:var(--t1,#fff)}
  .bp-btn.danger{background:#c0392b;color:#fff}
  .bp-select{background:var(--bg3,#222);border:1px solid var(--border2,#333);border-radius:6px;color:var(--t1,#fff);font-size:12px;padding:7px;width:100%;box-sizing:border-box;margin-bottom:8px}
  .bp-upgrade-banner{background:linear-gradient(135deg,#1a1a2e,#2d2d4e);border:1px solid var(--accent,#f5c518);border-radius:10px;padding:14px;text-align:center;margin-bottom:16px}
  .bp-upgrade-banner h4{color:var(--accent,#f5c518);margin:0 0 6px;font-size:13px}
  .bp-upgrade-banner p{color:var(--t2,#aaa);font-size:11px;margin:0 0 10px}
  .admin-stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border1,#222);font-size:12px}
  .admin-stat .val{color:var(--accent,#f5c518);font-weight:700}
  .usage-unlimited{color:#27ae60;font-size:11px}
  `;

  function _injectCSS() {
    if (document.getElementById('billing-css')) return;
    const s = document.createElement('style');
    s.id = 'billing-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── API helpers ────────────────────────────────────────────────────────── */
  async function _api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    return r.json();
  }

  /* ── Load billing status ────────────────────────────────────────────────── */
  async function loadStatus(force = false) {
    if (_loaded && !force) return _status;
    try {
      [_status, _plans] = await Promise.all([
        _api('GET', '/billing/status'),
        _api('GET', '/billing/plans'),
      ]);
      _loaded = true;
      _updateBadge();
    } catch (e) {
      console.warn('[BillingManager] load failed:', e.message);
    }
    return _status;
  }

  function _updateBadge() {
    const badge = document.getElementById('billing-plan-badge');
    if (badge && _status) {
      badge.textContent = (_status.planName || 'Free').toUpperCase();
    }
  }

  /* ── Panel construction ─────────────────────────────────────────────────── */
  function _buildPanel() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'billing-panel';
    _panel.innerHTML = `
      <div class="bp-head">
        <h2>💳 Billing & Plans</h2>
        <button class="bp-close" onclick="BillingManager.close()">✕</button>
      </div>
      <div class="bp-tabs">
        <div class="bp-tab active" data-tab="usage" onclick="BillingManager.switchTab('usage')">Usage</div>
        <div class="bp-tab" data-tab="plans" onclick="BillingManager.switchTab('plans')">Plans</div>
        <div class="bp-tab" data-tab="workspace" onclick="BillingManager.switchTab('workspace')">Team</div>
        <div class="bp-tab" data-tab="admin" onclick="BillingManager.switchTab('admin')">Admin</div>
      </div>
      <div class="bp-body" id="bp-body">
        <div style="text-align:center;padding:40px;color:var(--t2,#aaa)">Loading…</div>
      </div>
    `;
    document.body.appendChild(_panel);
  }

  function _renderUsageTab() {
    if (!_status) return '<div style="color:var(--t2,#aaa)">Not logged in</div>';
    const { plan, planName, usage = {}, limits = {}, cancel_at_period_end, current_period_end } = _status;
    const fmt  = (v, l) => l === -1 ? '∞' : `${v}/${l}`;
    const pct  = (v, l) => l === -1 ? 0   : Math.min(100, Math.round(v / l * 100));
    const cls  = (p) => p >= 90 ? 'over' : p >= 70 ? 'warn' : 'ok';
    const meter = (label, key) => {
      const v = +(usage[key] || 0).toFixed(1);
      const l = limits[key] ?? 0;
      const p = pct(v, l);
      if (l === -1) return `<div class="usage-meter"><div class="usage-meter-header"><span>${label}</span><span class="usage-unlimited">Unlimited</span></div></div>`;
      return `
        <div class="usage-meter">
          <div class="usage-meter-header"><span>${label}</span><span>${fmt(v, l)}</span></div>
          <div class="usage-meter-bar"><div class="usage-meter-fill ${cls(p)}" style="width:${p}%"></div></div>
        </div>`;
    };
    let cancelNote = '';
    if (cancel_at_period_end && current_period_end) {
      const dt = new Date(current_period_end * 1000).toLocaleDateString();
      cancelNote = `<div style="background:rgba(231,76,60,.15);border:1px solid #c0392b;border-radius:8px;padding:10px;font-size:11px;color:#e74c3c;margin-bottom:12px">⚠️ Subscription cancels on ${dt}. <a href="#" onclick="BillingManager.reactivate();return false" style="color:var(--accent)">Reactivate</a></div>`;
    }
    return `
      ${cancelNote}
      <div class="bp-section">
        <h3>Current Plan — <span style="color:var(--accent)">${planName}</span></h3>
        ${meter('Projects', 'projects')}
        ${meter('Transcript minutes / mo', 'transcript_minutes')}
        ${meter('Exports / mo', 'exports')}
        ${meter('AI requests / mo', 'ai_requests')}
        ${meter('Storage (MB)', 'storage_mb')}
      </div>
      ${plan === 'free' ? `<div class="bp-upgrade-banner"><h4>🚀 Upgrade to Pro</h4><p>Get Brand Clone, Content Agent, 300 transcript min/mo & more</p><button class="plan-cta upgrade" onclick="BillingManager.checkout('pro')">Upgrade — $19/mo</button></div>` : ''}
      ${plan !== 'free' ? `<div style="margin-top:8px"><button class="bp-btn secondary" onclick="BillingManager.openPortal()">Manage Subscription</button> <button class="bp-btn danger" style="margin-left:6px" onclick="BillingManager.cancel()">Cancel Plan</button></div>` : ''}
    `;
  }

  function _renderPlansTab() {
    if (!_plans || !_status) return '<div style="color:var(--t2,#aaa)">Loading…</div>';
    const current = _status.plan || 'free';
    const planOrder = ['free', 'pro', 'business'];
    const icons = { free: '🆓', pro: '⭐', business: '🏢' };
    const featureLabels = {
      brand_clone:   'Brand Clone',
      batch_factory: 'Batch Shorts Factory',
      content_agent: 'Content Agent',
      workspace:     'Team Workspaces',
      export_1080p:  '1080p Export',
      export_4k:     '4K Export',
    };

    let html = '<div class="plan-cards">';
    for (const pk of planOrder) {
      const plan = (_plans.plans || {})[pk];
      if (!plan) continue;
      const isCurrent = pk === current;
      const popular    = pk === 'pro';
      const price      = plan.price_monthly_usd === 0 ? 'Free' : `$${plan.price_monthly_usd}`;
      const lims = plan.limits || {};
      const fmt  = (v) => v === -1 ? 'Unlimited' : v;
      let cta = '';
      if (isCurrent) {
        cta = `<button class="plan-cta current-plan">Current Plan</button>`;
      } else if (pk === 'free') {
        cta = `<button class="plan-cta downgrade" onclick="BillingManager.openPortal()">Downgrade</button>`;
      } else {
        cta = `<button class="plan-cta upgrade" onclick="BillingManager.checkout('${pk}')">Upgrade to ${plan.name}</button>`;
      }
      const feats = Object.entries(featureLabels).map(([k, lbl]) => {
        const has = (plan.features || {})[k];
        return `<li class="${has ? '' : 'locked'}">${lbl}</li>`;
      }).join('');
      html += `
        <div class="plan-card ${isCurrent ? 'current' : ''} ${popular ? 'popular' : ''}">
          <div class="plan-name">${icons[pk] || ''} ${plan.name}</div>
          <div class="plan-price">${price === 'Free' ? price : price}<span>${price === 'Free' ? '' : '/month'}</span></div>
          <ul class="plan-features">
            <li>${fmt(lims.projects)} Projects</li>
            <li>${fmt(lims.transcript_minutes)} Transcript min/mo</li>
            <li>${fmt(lims.exports)} Exports/mo</li>
            <li>${fmt(lims.ai_requests)} AI requests/mo</li>
            <li>${fmt(lims.storage_mb)} MB Storage</li>
            ${feats}
          </ul>
          ${cta}
        </div>`;
    }
    html += '</div>';
    return html;
  }

  function _renderWorkspaceTab() {
    return `
      <div class="bp-section">
        <h3>Create Workspace</h3>
        <input class="bp-input" id="ws-name-input" placeholder="Workspace name…">
        <button class="bp-btn primary" onclick="BillingManager.createWorkspace()">Create</button>
      </div>
      <div class="bp-section">
        <h3>My Workspaces</h3>
        <div id="ws-list-container"><div style="color:var(--t2,#aaa);font-size:12px">Loading…</div></div>
      </div>
    `;
  }

  async function _loadWorkspaces() {
    const container = document.getElementById('ws-list-container');
    if (!container) return;
    try {
      const data = await _api('GET', '/workspace/list');
      const ws   = data.workspaces || [];
      if (!ws.length) {
        container.innerHTML = '<div style="color:var(--t2,#aaa);font-size:12px">No workspaces yet.</div>';
        return;
      }
      container.innerHTML = ws.map(w => `
        <div class="ws-item">
          <div class="ws-name">📁 ${_esc(w.name)}</div>
          <div class="ws-meta">${w.myRole} · ${(w.members || []).length + 1} member(s)</div>
          <div class="ws-members">
            <span class="ws-member owner">👑 You (${w.myRole})</span>
            ${(w.members || []).map(m => `<span class="ws-member">${_esc(m.email || m.userId)} (${m.role})</span>`).join('')}
          </div>
          ${w.myRole === 'owner' ? `
            <div style="margin-top:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input class="bp-input" id="invite-email-${w.id}" placeholder="Invite by email…" style="flex:1;min-width:120px;margin:0">
              <select class="bp-select" id="invite-role-${w.id}" style="width:90px;margin:0">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button class="bp-btn primary" onclick="BillingManager.inviteMember('${w.id}')">Invite</button>
              <button class="bp-btn danger" onclick="BillingManager.deleteWorkspace('${w.id}')">Delete</button>
            </div>` : ''}
        </div>`).join('');
    } catch (e) {
      if (container) container.innerHTML = `<div style="color:#e74c3c;font-size:12px">${e.message}</div>`;
    }
  }

  async function _renderAdminTab() {
    try {
      const d = await _api('GET', '/billing/admin');
      if (d.error) return `<div style="color:#e74c3c">${d.error}</div>`;
      const stat = (label, val, extra='') =>
        `<div class="admin-stat"><span>${label}</span><span class="val">${val}${extra}</span></div>`;
      return `
        <div class="bp-section">
          <h3>Revenue</h3>
          ${stat('MRR', '$' + (d.mrr || 0).toFixed(2))}
          ${stat('MRR (Pro)', '$' + (d.mrr_breakdown?.pro || 0))}
          ${stat('MRR (Business)', '$' + (d.mrr_breakdown?.business || 0))}
        </div>
        <div class="bp-section">
          <h3>Users</h3>
          ${stat('Total Users', d.total_users || 0)}
          ${stat('Paying Users', d.paying_users || 0)}
          ${stat('Conversion Rate', d.conversion_pct || 0, '%')}
          ${stat('Churn Rate', d.churn_pct || 0, '%')}
        </div>
        <div class="bp-section">
          <h3>Plans</h3>
          ${stat('Free', d.plan_counts?.free || 0)}
          ${stat('Pro', d.plan_counts?.pro || 0)}
          ${stat('Business', d.plan_counts?.business || 0)}
        </div>
        <div class="bp-section">
          <h3>This Month Activity</h3>
          ${stat('Exports', d.this_month?.exports || 0)}
          ${stat('Transcript min', (d.this_month?.transcript_minutes || 0).toFixed(1))}
          ${stat('AI Requests', d.this_month?.ai_requests || 0)}
        </div>
        <div class="bp-section">
          <h3>Infrastructure</h3>
          ${stat('Stripe Configured', d.stripe_configured ? '✅' : '❌ needs STRIPE_SECRET_KEY')}
        </div>
      `;
    } catch (e) {
      return `<div style="color:#e74c3c;font-size:12px">${e.message}</div>`;
    }
  }

  /* ── Tab switching ──────────────────────────────────────────────────────── */
  let _activeTab = 'usage';

  async function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.bp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const body = document.getElementById('bp-body');
    if (!body) return;
    body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t2,#aaa)">Loading…</div>';
    await loadStatus(tab === 'usage');
    if (tab === 'usage') {
      body.innerHTML = _renderUsageTab();
    } else if (tab === 'plans') {
      body.innerHTML = _renderPlansTab();
    } else if (tab === 'workspace') {
      body.innerHTML = _renderWorkspaceTab();
      await _loadWorkspaces();
    } else if (tab === 'admin') {
      body.innerHTML = await _renderAdminTab();
    }
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  async function open() {
    _injectCSS();
    _buildPanel();
    await switchTab(_activeTab);
    setTimeout(() => _panel && _panel.classList.add('open'), 10);
  }

  function close() {
    if (_panel) _panel.classList.remove('open');
  }

  async function checkout(plan) {
    const body = document.getElementById('bp-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2,#aaa)">Redirecting to Stripe…</div>';
    const r = await _api('POST', '/billing/checkout', { plan });
    if (r.url) {
      window.open(r.url, '_blank');
      if (body) body.innerHTML = `<div style="text-align:center;padding:30px;color:#27ae60">✅ Stripe checkout opened in new tab.<br><br><button class="bp-btn primary" onclick="BillingManager.switchTab('plans')">Back to Plans</button></div>`;
    } else {
      if (body) body.innerHTML = `<div style="color:#e74c3c;padding:16px">${r.error || 'Checkout failed. Set STRIPE_SECRET_KEY and plan price IDs.'}</div>`;
    }
  }

  async function openPortal() {
    const r = await _api('POST', '/billing/portal', {});
    if (r.url) {
      window.open(r.url, '_blank');
    } else {
      alert(r.error || 'Portal unavailable. Please configure Stripe.');
    }
  }

  async function cancel() {
    if (!confirm('Cancel subscription at period end?')) return;
    const r = await _api('POST', '/billing/cancel', {});
    if (r.ok) { await switchTab('usage'); }
    else alert(r.error || 'Cancel failed.');
  }

  async function reactivate() {
    const r = await _api('POST', '/billing/reactivate', {});
    if (r.ok) { await switchTab('usage'); }
    else alert(r.error || 'Reactivate failed.');
  }

  async function createWorkspace() {
    const name = (document.getElementById('ws-name-input')?.value || '').trim();
    if (!name) return alert('Enter a workspace name.');
    const r = await _api('POST', '/workspace/create', { name });
    if (r.ok) { await _loadWorkspaces(); document.getElementById('ws-name-input').value = ''; }
    else alert(r.error || 'Failed.');
  }

  async function inviteMember(wsId) {
    const email = (document.getElementById(`invite-email-${wsId}`)?.value || '').trim();
    const role  = document.getElementById(`invite-role-${wsId}`)?.value || 'editor';
    if (!email) return alert('Enter an email address.');
    const r = await _api('POST', '/workspace/invite', { workspaceId: wsId, email, role });
    if (r.ok) { alert(`✅ ${email} invited as ${role}`); await _loadWorkspaces(); }
    else alert(r.error || 'Invite failed.');
  }

  async function deleteWorkspace(wsId) {
    if (!confirm('Delete this workspace? This cannot be undone.')) return;
    const r = await _api('POST', '/workspace/delete', { workspaceId: wsId });
    if (r.ok) await _loadWorkspaces();
    else alert(r.error || 'Delete failed.');
  }

  /* ── Plan gate helper for other modules ─────────────────────────────────── */
  function requireFeature(feature, callback) {
    loadStatus().then(s => {
      const features = s?.features || {};
      if (features[feature]) {
        callback();
      } else {
        open().then(() => switchTab('plans'));
        const planName = feature === 'batch_factory' ? 'Business' : 'Pro';
        setTimeout(() => {
          const body = document.getElementById('bp-body');
          if (body) {
            const banner = document.createElement('div');
            banner.className = 'bp-upgrade-banner';
            banner.innerHTML = `<h4>🔒 ${feature.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} requires ${planName}</h4>
              <p>Upgrade your plan to unlock this feature.</p>
              <button class="plan-cta upgrade" onclick="BillingManager.checkout('${planName.toLowerCase()}')">Upgrade to ${planName}</button>`;
            body.prepend(banner);
          }
        }, 300);
      }
    });
  }

  /* ── Inject billing button into header ───────────────────────────────────── */
  function injectHeaderButton() {
    if (document.getElementById('billing-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'billing-btn';
    btn.title = 'Billing & Plans';
    btn.innerHTML = `💳 <span class="plan-badge" id="billing-plan-badge">FREE</span>`;
    btn.onclick = () => open();
    // Try to find header action area
    const targets = [
      '.top-bar-right',
      '.header-actions',
      '#header-right',
      '.topbar',
    ];
    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (el) { el.prepend(btn); return; }
    }
    // Fallback: fixed position
    btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999';
    document.body.appendChild(btn);
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */
  function init() {
    _injectCSS();
    // Load status silently on startup
    loadStatus().then(() => {
      injectHeaderButton();
      // Handle billing URL params
      const params = new URLSearchParams(window.location.search);
      if (params.get('billing') === 'success') {
        loadStatus(true).then(() => open());
        history.replaceState(null, '', window.location.pathname);
      }
    });
    console.log('[BillingManager] Phase 5.6 loaded — Free/Pro/Business plans');
  }

  return {
    init, open, close, switchTab, checkout, openPortal, cancel, reactivate,
    createWorkspace, inviteMember, deleteWorkspace, requireFeature, loadStatus,
  };
})();

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', BillingManager.init);
} else {
  BillingManager.init();
}
