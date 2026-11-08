(function () {
  // 防止重复加载
  if (document.getElementById('shutdown-overlay')) return;

  // 创建样式
  const style = document.createElement('style');
  style.textContent = `
    #shutdown-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px);
      z-index: 999999; display: flex; align-items: center; justify-content: center;
      font-family: 'Roboto', 'Noto Sans SC', system-ui, sans-serif;
      padding: 20px; box-sizing: border-box;
    }
    .shutdown-box {
      background: #FEF7FF; color: #1D1B20;
      border-radius: 28px; padding: 32px;
      max-width: 480px; width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      text-align: center; animation: slideUp 0.5s cubic-bezier(0.2, 0, 0, 1) both;
    }
    @media (prefers-color-scheme: dark) {
      .shutdown-box { background: #211F26; color: #E6E0E9; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .shutdown-icon {
      width: 64px; height: 64px; margin: 0 auto 20px;
      background: #F9DEDC; color: #B3261E;
      display: flex; align-items: center; justify-content: center; border-radius: 50%;
    }
    .shutdown-title { font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #B3261E; }
    .shutdown-desc { font-size: 15px; line-height: 1.6; margin-bottom: 24px; text-align: left; }
    .shutdown-desc p { margin: 0 0 12px 0; }
    .shutdown-link {
      display: inline-flex; align-items: center; justify-content: center;
      width: 100%; height: 50px; background: #6750A4; color: #FFF;
      text-decoration: none; border-radius: 100px; font-weight: 500; font-size: 16px;
      transition: opacity 0.2s, transform 0.2s;
    }
    .shutdown-link:active { transform: scale(0.96); }
    .shutdown-footer { margin-top: 20px; font-size: 12px; opacity: 0.6; }
  `;
  document.head.appendChild(style);

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.id = 'shutdown-overlay';

  // 内容
  overlay.innerHTML = `
    <div class="shutdown-box">
      <div class="shutdown-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <div class="shutdown-title">服务已停止运营</div>
      <div class="shutdown-desc">
        <p>亲爱的用户：</p>
        <p>非常遗憾地通知大家，由于近期接口触发上游风控，我们的 API Key 已被官方判定为异常并全面封禁。</p>
        <p>因无可用密钥，<b>XTZ Cookie 即日起正式停止服务</b>。</p>
        <p>为回馈大家，我已将完整的全栈代码（含 Cloudflare Worker 后端与防作弊前端）开源。你可以自行部署属于你的版本。</p>
      </div>
      <a href="https://github.com/ZFT1145/GetCookie" target="_blank" class="shutdown-link">前往 GitHub 获取源码</a>
      <div class="shutdown-footer">XTZ Cookie 开发者 · 2026.11</div>
    </div>
  `;

  // 注入页面（确保DOM加载完成后插入）
  const inject = () => {
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
  };

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
