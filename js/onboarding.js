/* ============================================================
   js/onboarding.js — Phase 5.5  Onboarding Flow
   4-step wizard: Upload → Transcript → Shorts → Export
   ============================================================ */
(function () {
  'use strict';

  const ONBOARD_KEY = 'cc_onboarding_done';

  // ── CSS ─────────────────────────────────────────────────────
  const css = `
#onboard-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9200;display:flex;align-items:center;justify-content:center}
#onboard-modal{background:#1a1a1a;border:1px solid #333;border-radius:14px;width:480px;max-width:95vw;padding:36px 32px;color:#eee;font-family:system-ui,sans-serif;text-align:center}
.ob-icon{font-size:48px;margin-bottom:12px}
.ob-step-num{font-size:11px;color:#D4A017;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
#onboard-modal h2{font-size:22px;margin:0 0 10px;color:#fff}
#onboard-modal p{color:#999;font-size:14px;line-height:1.6;margin:0 0 24px}
.ob-progress{display:flex;gap:6px;justify-content:center;margin-bottom:28px}
.ob-dot{width:32px;height:4px;border-radius:2px;background:#333}
.ob-dot.done{background:#D4A017}
.ob-dot.active{background:#D4A017;box-shadow:0 0 6px #D4A017}
.ob-btn-primary{padding:12px 32px;background:#D4A017;border:none;border-radius:8px;color:#000;font-weight:700;font-size:15px;cursor:pointer;margin-right:8px}
.ob-btn-primary:hover{background:#c49010}
.ob-btn-skip{padding:12px 20px;background:transparent;border:1px solid #333;border-radius:8px;color:#666;font-size:14px;cursor:pointer}
.ob-btn-skip:hover{color:#ccc;border-color:#555}
.ob-tip{background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:10px 14px;font-size:12px;color:#888;text-align:left;margin-top:16px}
.ob-tip b{color:#D4A017}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Steps ────────────────────────────────────────────────────
  const STEPS = [
    {
      icon: '🎬',
      label: 'Bước 1 / 4',
      title: 'Upload video của bạn',
      desc: 'Kéo thả hoặc nhấn Browse để tải video lên. Hỗ trợ MP4, MOV, AVI, WebM.',
      tip: '<b>Mẹo:</b> Upload video dài 3–10 phút để AI có đủ nội dung tạo shorts.',
      action: 'Mở Media Panel',
      actionFn: () => { document.getElementById('feedback-overlay')?.remove(); document.querySelector('[onclick*="media"]')?.click(); }
    },
    {
      icon: '🎤',
      title: 'Tạo Transcript',
      label: 'Bước 2 / 4',
      desc: 'Nhấn "Transcribe" để AI chuyển giọng nói thành văn bản. Đây là nền tảng cho mọi tính năng AI.',
      tip: '<b>Mẹo:</b> Transcript giúp AI hiểu nội dung video để tạo phụ đề, shorts và tiêu đề tự động.',
      action: 'Mở Transcript',
      actionFn: () => { window.setTool_byName?.('transcript'); }
    },
    {
      icon: '✂️',
      title: 'Tạo Short đầu tiên',
      label: 'Bước 3 / 4',
      desc: 'AI sẽ tự động tìm đoạn hay nhất trong video và tạo short 15–60 giây cho bạn.',
      tip: '<b>Mẹo:</b> Shorts có tỉ lệ 9:16 tối ưu cho TikTok, Reels và YouTube Shorts.',
      action: 'Mở AI Shorts',
      actionFn: () => { window.setTool_byName?.('shorts'); }
    },
    {
      icon: '📤',
      title: 'Export & Chia sẻ',
      label: 'Bước 4 / 4',
      desc: 'Export video với chất lượng cao. Chọn định dạng MP4 1080p cho mọi nền tảng.',
      tip: '<b>Mẹo:</b> Dùng "Batch Export" để xuất nhiều shorts cùng lúc, tiết kiệm thời gian.',
      action: 'Mở Export',
      actionFn: () => { window.setTool_byName?.('export'); }
    }
  ];

  let _currentStep = 0;

  // ── Render ───────────────────────────────────────────────────
  function renderStep(i) {
    const step = STEPS[i];
    const dots = STEPS.map((_, idx) => `<div class="ob-dot ${idx < i ? 'done' : idx === i ? 'active' : ''}"></div>`).join('');
    return `
      <div class="ob-icon">${step.icon}</div>
      <div class="ob-step-num">${step.label}</div>
      <h2>${step.title}</h2>
      <p>${step.desc}</p>
      <div class="ob-progress">${dots}</div>
      <button class="ob-btn-primary" onclick="OnboardingFlow._action(${i})">${step.action}</button>
      <button class="ob-btn-skip" onclick="OnboardingFlow._next()">
        ${i < STEPS.length - 1 ? 'Bỏ qua →' : 'Hoàn thành'}
      </button>
      <div class="ob-tip">${step.tip}</div>`;
  }

  // ── OnboardingFlow ────────────────────────────────────────────
  const OnboardingFlow = {
    start(force = false) {
      if (!force && localStorage.getItem(ONBOARD_KEY)) return;
      _currentStep = 0;
      this._show();
    },
    _show() {
      document.getElementById('onboard-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'onboard-overlay';
      const modal = document.createElement('div');
      modal.id = 'onboard-modal';
      modal.innerHTML = renderStep(_currentStep);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    },
    _action(stepIdx) {
      STEPS[stepIdx].actionFn?.();
      this._next();
    },
    _next() {
      _currentStep++;
      if (_currentStep >= STEPS.length) {
        this._complete();
      } else {
        const modal = document.getElementById('onboard-modal');
        if (modal) modal.innerHTML = renderStep(_currentStep);
      }
    },
    _complete() {
      document.getElementById('onboard-overlay')?.remove();
      localStorage.setItem(ONBOARD_KEY, '1');
      window.HealthScore?.setFlag('onboardingComplete', true);
      window.BetaAnalytics?.track('onboarding_complete');
      window.JourneyTracker?.complete('register');
      // Toast
      const toast = document.createElement('div');
      toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#D4A017;color:#000;padding:12px 24px;border-radius:8px;font-weight:700;z-index:9999;font-size:14px`;
      toast.textContent = '🎉 Chào mừng bạn đến CapCut Clone Beta!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
    reset() {
      localStorage.removeItem(ONBOARD_KEY);
      _currentStep = 0;
    }
  };
  window.OnboardingFlow = OnboardingFlow;

  // ── Replay button in userbar ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Add "Tour" button to userbar after it's created
    const observer = new MutationObserver(() => {
      const bar = document.getElementById('beta-userbar');
      if (bar && !bar.querySelector('.ob-tour-btn')) {
        const btn = document.createElement('button');
        btn.className = 'ob-tour-btn';
        btn.textContent = '📖 Tour';
        btn.title = 'Xem lại hướng dẫn';
        btn.onclick = () => OnboardingFlow.start(true);
        bar.insertBefore(btn, bar.lastElementChild);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log('[OnboardingFlow] Phase 5.5 loaded — 4-step onboarding wizard');
})();
