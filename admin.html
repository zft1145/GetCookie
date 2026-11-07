<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>后台管理 · XTZ Cookie</title>
<style>
:root {
  --md-primary: #6750A4; --md-on-primary: #FFFFFF;
  --md-surface: #FEF7FF; --md-surface-container-lowest: #FFFFFF;
  --md-surface-container-low: #F7F2FA; --md-surface-container: #F3EDF7; 
  --md-surface-container-high: #ECE6F0; --md-surface-container-highest: #E6E0E9;
  --md-on-surface: #1D1B20; --md-on-surface-variant: #49454F;
  --md-outline-variant: #CAC4D0; --md-error: #B3261E; --md-success: #386A20;
}
html[data-theme="dark"] {
  --md-primary: #D0BCFF; --md-on-primary: #381E72;
  --md-surface: #141218; --md-surface-container-lowest: #0F0D13;
  --md-surface-container-low: #1D1B20; --md-surface-container: #211F26; 
  --md-surface-container-high: #2B2930; --md-surface-container-highest: #36343B;
  --md-on-surface: #E6E0E9; --md-on-surface-variant: #CAC4D0;
  --md-outline-variant: #49454F; --md-error: #F2B8B5; --md-success: #B6F09C;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { margin: 0; font-family: 'Roboto', 'Noto Sans SC', sans-serif; background: var(--md-surface); color: var(--md-on-surface); transition: background 0.3s; }
.app-bar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; height: 64px; padding: 0 16px; background: var(--md-surface-container); }
.app-bar h1 { margin: 0; font-size: 22px; font-weight: 700; flex: 1; background: linear-gradient(135deg, var(--md-primary), #8E7CC3); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.icon-button { width: 48px; height: 48px; border-radius: 50%; border: none; background: transparent; color: var(--md-on-surface-variant); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s, transform 0.2s; }
.icon-button:active { transform: scale(0.85); background: var(--md-surface-container-highest); }
.content { max-width: 640px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }

@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.card { background: var(--md-surface-container-low); border-radius: 28px; padding: 24px; animation: fadeUp 0.5s cubic-bezier(0.2, 0, 0, 1) both; }
.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.2s; }
.card:nth-child(4) { animation-delay: 0.3s; }
.card-title { margin: 0 0 16px 0; font-size: 16px; font-weight: 500; }
.input-group { margin-bottom: 16px; }
.input-group input { width: 100%; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--md-outline-variant); background: var(--md-surface-container); color: var(--md-on-surface); font-family: inherit; font-size: 14px; transition: border-color 0.2s; }
.input-group input:focus { outline: none; border-color: var(--md-primary); }
.btn-row { display: flex; gap: 12px; margin-bottom: 16px; }
.btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 14px; border-radius: 100px; border: none; background: var(--md-primary); color: var(--md-on-primary); font-weight: 500; font-size: 15px; cursor: pointer; text-decoration: none; transition: transform 0.2s, background 0.3s; }
.btn:active { transform: scale(0.94); }
.btn-outline { background: transparent; color: var(--md-primary); border: 1px solid var(--md-outline-variant); }
.admin-list { border: 1px solid var(--md-outline-variant); border-radius: 20px; overflow: hidden; background: var(--md-surface-container); }
.admin-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--md-outline-variant); background: var(--md-surface-container-lowest); transition: background 0.3s; }
.admin-item:last-child { border-bottom: none; }
.copy-btn { border: none; background: transparent; color: var(--md-primary); cursor: pointer; font-weight: 500; font-size: 14px; padding: 8px 16px; border-radius: 100px; transition: background 0.2s, transform 0.1s; }
.copy-btn:active { transform: scale(0.85); background: var(--md-surface-container-highest); }
.snackbar { position: fixed; bottom: 24px; left: 50%; transform: translate(-50%, 100px); background: var(--md-surface-container-highest); color: var(--md-on-surface); padding: 14px 24px; border-radius: 12px; font-size: 14px; opacity: 0; transition: all 0.3s; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.snackbar.show { transform: translate(-50%, 0); opacity: 1; }
</style>
</head>
<body>

<header class="app-bar">
  <h1>后台管理 · XTZ Cookie</h1>
  <button class="icon-button" id="themeBtn">
    <svg id="iconSun" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    <svg id="iconMoon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="display:none"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </button>
</header>

<main class="content">
  <section class="card" id="authCard" style="display:none">
    <h2 class="card-title">管理员鉴权</h2>
    <div class="input-group">
      <input type="password" id="adminKeyInput" placeholder="请输入管理员密钥">
    </div>
    <button class="btn" id="authBtn">验证进入</button>
  </section>

  <div class="btn-row" id="navBtns" style="display:none">
    <a href="https://4399pc.cc/account" target="_blank" class="btn btn-outline">曲奇 API 界面</a>
    <a href="https://cookie.xtz1.top" target="_blank" class="btn btn-outline">主站页面</a>
  </div>

  <section class="card" id="addChannelCard" style="display:none">
    <h2 class="card-title">增加新通道</h2>
    <div class="input-group"><input type="text" id="newChannelName" placeholder="通道名称"></div>
    <div class="input-group"><input type="text" id="newChannelKey" placeholder="API 密钥 (aku_...)"></div>
    <button class="btn" id="addChannelBtn">保存通道</button>
  </section>

  <section class="card" id="dataCard" style="display:none">
    <h2 class="card-title">通道状态与投票</h2>
    <div class="admin-list" id="channelList">加载中…</div>
  </section>

  <section class="card" id="configCard" style="display:none">
    <h2 class="card-title">系统设置</h2>
    <div class="input-group"><input type="text" id="cfgSiteKey" placeholder="Turnstile Site Key"></div>
    <div class="input-group"><input type="text" id="cfgSecret" placeholder="Turnstile Secret Key"></div>
    <div class="input-group"><input type="text" id="cfgCdk" placeholder="兑换码 CDK"></div>
    <button class="btn btn-outline" id="saveConfigBtn">保存配置</button>
  </section>

  <section class="card" id="userCard" style="display:none">
    <h2 class="card-title">已使用用户</h2>
    <div class="admin-list" id="userList">加载中…</div>
  </section>
</main>

<div class="snackbar" id="snackbar"></div>
<script src="admin.js"></script>
</body>
</html>
