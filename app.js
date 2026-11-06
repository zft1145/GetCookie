(function () {
  'use strict';

  const WORKER_URL = "https://cookiew.xtz1.top";
  const SIGN_SECRET = "VHax_Secret_2024";
  const $ = id => document.getElementById(id);
  const snackbar = $('snackbar');
  
  let snackTimer, busy = false, userFp = '', isVipMode = false, currentChannelId = 0;

  function hashStr(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return hash.toString(16);
  }

  function buildUrl(path, params = {}) {
    const url = new URL(WORKER_URL + path);
    url.searchParams.set("fp", userFp);
    url.searchParams.set("t", Date.now().toString());
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    
    if (navigator.webdriver) url.searchParams.set("bot", "1");
    if ($('honeypotInput').value) url.searchParams.set("honeypot", "1");

    const str = url.searchParams.toString() + SIGN_SECRET;
    url.searchParams.set("sign", hashStr(str));
    return url.toString();
  }

  function toast(msg) {
    snackbar.textContent = msg;
    snackbar.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => snackbar.classList.remove('show'), 2500);
  }

  async function generateFingerprint() {
    try {
      let savedFp = localStorage.getItem('user_fp');
      if (savedFp) return savedFp;
      const raw = [navigator.userAgent, screen.width + 'x' + screen.height, navigator.language, new Date().getTimezoneOffset()].join('|');
      let hash = 0;
      for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash = hash & hash; }
      const fp = 'FP_' + Math.abs(hash).toString(16).toUpperCase();
      localStorage.setItem('user_fp', fp);
      return fp;
    } catch(e) { return 'FP_TEMP_' + Math.floor(Math.random() * 100000); }
  }

  function copyText(text) {
    if (!text || text === '—') { toast('暂无内容'); return; }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast('已复制'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('已复制');
    }
  }
  window.copyText = copyText;

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (btn) copyText($(btn.dataset.copy).textContent);
  });

  function log(msg, type) {
    const line = document.createElement('div');
    line.className = 'log-line' + (type ? ' log-' + type : '');
    line.textContent = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${msg}`;
    $('log').appendChild(line);
    $('log').scrollTop = $('log').scrollHeight;
  }

  async function loadInfo() {
    try {
      const res = await fetch(buildUrl("/info"), { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        if (!data.username) {
          $('bindModal').classList.add('show');
          showBindTurnstile();
          return;
        }

        $('totalToday').textContent = data.total_today || 0;
        $('totalUsers').textContent = data.total_users || 0;
        
        if (data.is_vip) {
          isVipMode = true;
          $('userQuota').textContent = '∞';
          $('userStatusText').textContent = `无限额度`;
        } else {
          isVipMode = false;
          $('userQuota').textContent = data.remaining;
          $('userStatusText').textContent = `您今日已获取 ${data.used} 次`;
        }

        if (data.status === 'banned') {
          $('getBtn').disabled = true; $('btnText').textContent = '已封禁';
          $('userStatusText').textContent = '您的设备已被封禁';
          $('userStatusText').style.color = 'var(--md-error)';
          return;
        }

        if (data.remaining <= 0) {
          $('getBtn').disabled = true; $('btnText').textContent = '额度已用完';
        } else {
          $('getBtn').disabled = false; $('btnText').textContent = '获取';
        }
      }
    } catch (e) {
      if ($('btnText').textContent === '加载中') {
        $('getBtn').disabled = false; $('btnText').textContent = '获取';
        $('userStatusText').textContent = '连接失败，请刷新重试';
      }
    }
  }

  $('settingsBtn').addEventListener('click', () => $('settingsModal').classList.add('show'));
  $('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.remove('show'));

  $('themeSetting').checked = document.documentElement.dataset.theme === 'dark';
  $('themeSetting').addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('md_theme', theme);
  });

  window.setColor = (color) => {
    document.documentElement.dataset.color = color;
    localStorage.setItem('md_color', color);
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    $('dot-' + color).classList.add('active');
  };

  window.vote = async (action) => {
    if (!currentChannelId) return;
    $('voteGroup').style.pointerEvents = 'none';
    try {
      await fetch(buildUrl("/vote", { channel: currentChannelId, action }));
      toast(action === 'up' ? '已推荐该通道' : '已不推荐该通道');
    } catch(e) {}
  };

  let bindWidgetId = null;
  async function showBindTurnstile() {
    try {
      const res = await fetch(buildUrl("/info"));
      const data = await res.json();
      const siteKey = data.turnstile_site_key;
      if (!siteKey) return;
      const container = $('turnstile-container');
      container.innerHTML = '';
      bindWidgetId = turnstile.render(container, {
        sitekey: siteKey,
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
      });
    } catch(e) {}
  }

  $('bindBtn').addEventListener('click', async () => {
    const username = $('bindUsername').value.trim();
    if (!username) return toast('请输入用户名');
    const token = turnstile.getResponse(bindWidgetId);
    if (!token) return toast('请完成人机验证');
    
    $('bindBtn').disabled = true;
    $('bindBtn').textContent = '绑定中...';

    try {
      const res = await fetch(buildUrl("/bind", { username, turnstile_token: token }));
      const data = await res.json();
      if (data.ok) {
        toast('绑定成功');
        $('bindModal').classList.remove('show');
        loadInfo();
      } else {
        toast(data.error);
        $('bindBtn').disabled = false;
        $('bindBtn').textContent = '确认绑定';
      }
    } catch(e) {
      toast('网络错误');
      $('bindBtn').disabled = false;
      $('bindBtn').textContent = '确认绑定';
    }
  });

  let progressInterval;
  function startProgress() {
    $('progressWrap').classList.add('show');
    $('progressBar').style.width = '0%';
    let p = 0;
    progressInterval = setInterval(() => {
      if (p < 30) p += 10; else if (p < 60) p += 5; else if (p < 90) p += 1;
      $('progressBar').style.width = p + '%';
    }, 200);
  }
  function stopProgress() {
    clearInterval(progressInterval);
    $('progressBar').style.width = '100%';
    setTimeout(() => { $('progressWrap').classList.remove('show'); }, 300);
  }

  async function doFetch() {
    if (busy) return;
    busy = true;
    $('getBtn').disabled = true;
    $('spinner').classList.add('on');
    $('btnText').textContent = '获取中…';
    $('voteGroup').style.display = 'none';
    
    $('outChannel').textContent = '来源通道 —';
    $('outUser').textContent = '—';
    $('outPass').textContent = '—';
    $('outCookie').textContent = '—';
    
    startProgress();

    try {
      const claimRes = await fetch(buildUrl("/claim"), { cache: 'no-store' });
      const claimData = await claimRes.json();

      if (!claimData.ok) throw new Error(claimData.error || '获取失败');

      currentChannelId = claimData.channel;
      $('outChannel').textContent = `来源通道 ${claimData.channel}`;
      $('voteGroup').style.display = 'flex';
      $('voteGroup').style.pointerEvents = 'auto';

      $('outUser').textContent = claimData.username;
      $('outPass').textContent = claimData.password;
      $('userQuota').textContent = isVipMode ? '∞' : claimData.remaining;
      $('totalToday').textContent = claimData.total_today;
      log(`账号获取成功！`, 'ok');

      $('btnText').textContent = '转换中…';

      const convRes = await fetch(buildUrl("/convert", {
        username: claimData.username,
        password: claimData.password,
        key: claimData.channel_key,
        refund: "true"
      }));
      const convData = await convRes.json();

      if (!convData.ok) throw new Error(convData.error || 'Cookie 转换失败');

      $('outCookie').textContent = convData.cookies;
      stopProgress();
      log(`Cookie 转换成功`, 'ok');
      toast('获取成功');
      
      let history = JSON.parse(localStorage.getItem('cookies_history') || '[]');
      history.unshift({ time: new Date().toLocaleString('zh-CN', { hour12: false }), username: claimData.username, password: claimData.password, cookies: convData.cookies });
      if (history.length > 50) history.pop();
      localStorage.setItem('cookies_history', JSON.stringify(history));
      renderHistory();

    } catch (e) {
      stopProgress();
      log(`失败: ${e.message}`, 'err');
      toast(e.message);
    } finally {
      busy = false;
      $('spinner').classList.remove('on');
      if ($('btnText').textContent !== '已封禁' && $('btnText').textContent !== '额度已用完') {
        $('getBtn').disabled = false;
        $('btnText').textContent = '获取';
      }
    }
  }

  function renderHistory(keyword = '') {
    let history = JSON.parse(localStorage.getItem('cookies_history') || '[]');
    if (keyword) {
      keyword = keyword.toLowerCase();
      history = history.filter(h => 
        (h.username && h.username.toLowerCase().includes(keyword)) || (h.cookies && h.cookies.toLowerCase().includes(keyword))
      );
    }
    if (history.length === 0) {
      $('historyList').innerHTML = '<div style="font-size:12px;color:var(--md-on-surface-variant);text-align:center;padding:12px;">暂无记录</div>';
      return;
    }
    
    $('historyList').innerHTML = history.map((h, i) => `
      <div class="history-item">
        <div class="history-time">${h.time}</div>
        <div class="history-data-row"><span>账号:</span> ${h.username}</div>
        <div class="history-data-row"><span>密码:</span> ${h.password}</div>
        <div class="cookie-block" style="margin-top:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="color:var(--md-on-surface-variant); font-size:12px;">Cookie</span>
            <button class="text-button" onclick="copyText('${h.cookies}')">复制</button>
          </div>
          <div style="font-family:monospace;font-size:12px;color:var(--md-on-surface-variant);word-break:break-all;max-height:80px;overflow-y:auto;background:var(--md-surface-container-lowest);padding:12px;border-radius:12px;">${h.cookies || '无'}</div>
        </div>
        <div class="history-actions">
          <button class="hist-btn primary" onclick="convertHistory(${i})">转为曲奇</button>
        </div>
      </div>
    `).join('');
  }

  window.convertHistory = async (index) => {
    let history = JSON.parse(localStorage.getItem('cookies_history') || '[]');
    const h = history[index];
    if(!h) return;
    toast('正在转换...');
    
    try {
      const res = await fetch(buildUrl("/convert", { username: h.username, password: h.password, key: 'default' }));
      const data = await res.json();
      if (data.ok && data.cookies) {
        $('outUser').textContent = h.username;
        $('outPass').textContent = h.password;
        $('outCookie').textContent = data.cookies;
        history[index].cookies = data.cookies;
        localStorage.setItem('cookies_history', JSON.stringify(history));
        renderHistory($('historySearch').value);
        toast('转换成功');
      } else {
        toast(data.error || '转换失败');
      }
    } catch(e) { toast('网络异常'); }
  };

  $('historySearch').addEventListener('input', (e) => renderHistory(e.target.value));

  (async function init() {
    const savedTheme = localStorage.getItem('md_theme');
    if (savedTheme) {
      document.documentElement.dataset.theme = savedTheme;
    } else {
      document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    $('themeSetting').checked = document.documentElement.dataset.theme === 'dark';

    const savedColor = localStorage.getItem('md_color') || 'purple';
    setColor(savedColor);

    try { userFp = await generateFingerprint(); } catch(e) { userFp = 'FP_FALLBACK_' + Date.now(); }
    await loadInfo(); 
    if ($('btnText').textContent === '加载中') {
      $('getBtn').disabled = false; $('btnText').textContent = '获取';
    }
    $('getBtn').addEventListener('click', () => doFetch());
    renderHistory();
  })();
})()
