(function () {
  'use strict';

  const WORKER_URL = "https://cookiew.xtz1.top";
  const SIGN_SECRET = "VHax_Secret_2024";
  const $ = id => document.getElementById(id);
  const snackbar = $('snackbar');
  
  let snackTimer, busy = false, userFp = '', isVipMode = false;
  let currentChannelId = 0;

  function hashStr(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return hash.toString(16);
  }

  function buildUrl(path, extraParams = {}) {
    const t = Date.now().toString();
    const sign = hashStr(t + SIGN_SECRET);
    
    const url = new URL(WORKER_URL + path);
    url.searchParams.set("fp", userFp);
    url.searchParams.set("t", t);
    url.searchParams.set("sign", sign);
    
    Object.keys(extraParams).forEach(k => url.searchParams.set(k, extraParams[k]));
    
    if (navigator.webdriver) url.searchParams.set("bot", "1");
    if ($('honeypotInput').value) url.searchParams.set("honeypot", "1");

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

        $('usedCount').textContent = data.used;
        $('totalUsed').textContent = data.today_total_used;
        $('totalUsers').textContent = data.total_user_count;

        if (data.is_vip) {
          isVipMode = true;
          $('userStatusText').textContent = `Unlimited credit limit`;
        } else {
          $('userStatusText').textContent = `剩余额度 ${data.remaining}`;
        }

        if (data.status === 'banned') {
          $('getBtn').disabled = true; $('btnText').textContent = '已封禁';
          $('userStatusText').textContent = '您的设备已被封禁';
          $('userStatusText').style.color = 'var(--md-error)';
          return;
        }

        if (data.remaining <= 0 && !data.is_vip) {
          $('getBtn').disabled = true; $('btnText').textContent = '额度已用完';
        } else {
          $('getBtn').disabled = false; $('btnText').textContent = '获取';
        }
      } else {
        $('userStatusText').textContent = data.error || '状态异常';
        $('getBtn').disabled = false; $('btnText').textContent = '获取';
      }
    } catch (e) {
      $('getBtn').disabled = false; $('btnText').textContent = '获取';
      $('userStatusText').textContent = '网络超时或跨域，请刷新重试';
    }
  }

  async function vote(action) {
    if (!currentChannelId) return;
    $('voteGroup').style.pointerEvents = 'none';
    try {
      await fetch(buildUrl("/vote", { channel: currentChannelId, action }));
      toast(action === 'up' ? '已推荐该通道' : '已不推荐该通道');
    } catch(e) {}
  }
  window.vote = vote;

  $('profileBtn').addEventListener('click', async () => {
    try {
      const res = await fetch(buildUrl("/info"));
      const data = await res.json();
      if (data.ok) {
        $('profUid').textContent = data.username || '未绑定';
        $('profQuota').textContent = data.is_vip ? '无限' : data.remaining;
        $('profStatus').textContent = data.status === 'banned' ? '封禁' : '正常';
        $('profStatus').style.color = data.status === 'banned' ? 'var(--md-error)' : '#386A20';
        $('profRole').textContent = data.is_vip ? 'VIP' : '普通用户';
        $('profileModal').classList.add('show');
      }
    } catch(e) { toast('获取信息失败'); }
  });
  $('closeProfileBtn').addEventListener('click', () => $('profileModal').classList.remove('show'));

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

  let modalWidgetId = null;
  async function showRiskTurnstile() {
    return new Promise(async (resolve) => {
      try {
        const res = await fetch(buildUrl("/info"));
        const data = await res.json();
        const siteKey = data.turnstile_site_key;
        if (!siteKey) { toast("管理员未配置验证"); resolve(null); return; }

        const modal = $('bindModal');
        const container = $('turnstile-container');
        // 借用 bindModal 的界面但换文案
        modal.querySelector('.modal-title').textContent = "安全验证";
        modal.querySelector('p').textContent = "检测到操作频繁，请完成验证。";
        modal.querySelector('.input-group').style.display = 'none';
        const btn = $('bindBtn');
        btn.textContent = '取消';
        btn.disabled = false;
        
        container.innerHTML = '';
        modal.classList.add('show');

        modalWidgetId = turnstile.render(container, {
          sitekey: siteKey,
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          callback: function(token) {
            modal.classList.remove('show');
            resolve(token);
          },
          'error-callback': function() {
            modal.classList.remove('show');
            resolve(null);
          }
        });

        btn.onclick = () => {
          turnstile.remove(modalWidgetId);
          modal.classList.remove('show');
          resolve(null);
        };
      } catch(e) { resolve(null); }
    });
  }

  async function doFetch(token = '') {
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
      const claimRes = await fetch(buildUrl("/claim", { turnstile_token: token }), { cache: 'no-store' });
      const claimData = await claimRes.json();

      if (!claimData.ok) {
        if (claimData.need_turnstile) {
          stopProgress();
          log('触发风控限制，需要验证', 'err');
          $('spinner').classList.remove('on');
          $('btnText').textContent = '请完成验证';
          
          const newToken = await showRiskTurnstile();
          busy = false;
          if (newToken) { 
            $('btnText').textContent = '获取中…';
            $('getBtn').disabled = true;
            doFetch(newToken); 
          }
          else { $('getBtn').disabled = false; $('btnText').textContent = '获取'; }
          return;
        }
        throw new Error(claimData.error || '获取失败');
      }

      currentChannelId = claimData.channel;
      $('outChannel').textContent = `来源通道 ${claimData.channel}`;
      $('voteGroup').style.display = 'flex';
      $('voteGroup').style.pointerEvents = 'auto';

      $('outUser').textContent = claimData.username;
      $('outPass').textContent = claimData.password;
      log(`账号获取成功！剩余 ${isVipMode ? '∞' : claimData.remaining} 次`, 'ok');

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
      loadInfo();

    } catch (e) {
      stopProgress();
      log(`失败: ${e.message}`, 'err');
      toast(e.message);
    } finally {
      busy = false;
      $('spinner').classList.remove('on');
      if ($('userStatusText').textContent !== '您的设备已被封禁' && $('btnText').textContent !== '额度已用完') {
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
    const list = $('historyList');
    list.innerHTML = '';
    
    if (history.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:var(--md-on-surface-variant);text-align:center;padding:12px;">暂无记录</div>';
      return;
    }
    
    // 使用安全的 DOM 构建方式，防止特殊字符破坏 HTML
    history.forEach((h, i) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const timeDiv = document.createElement('div');
      timeDiv.className = 'history-time';
      timeDiv.textContent = h.time || '';
      
      const userRow = document.createElement('div');
      userRow.className = 'history-data-row';
      userRow.innerHTML = `<span>账号:</span> `;
      userRow.appendChild(document.createTextNode(h.username || ''));

      const passRow = document.createElement('div');
      passRow.className = 'history-data-row';
      passRow.innerHTML = `<span>密码:</span> `;
      passRow.appendChild(document.createTextNode(h.password || ''));

      const cookieBox = document.createElement('div');
      cookieBox.className = 'cookie-block';
      cookieBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="color:var(--md-on-surface-variant); font-size:12px;">Cookie</span>
          <button class="text-button btn-copy-hist">复制</button>
        </div>
      `;
      const cookieContent = document.createElement('div');
      cookieContent.className = 'cookie-content';
      cookieContent.textContent = h.cookies || '无';
      cookieBox.appendChild(cookieContent);

      const actions = document.createElement('div');
      actions.className = 'history-actions';
      const convertBtn = document.createElement('button');
      convertBtn.className = 'hist-btn primary btn-convert-hist';
      convertBtn.textContent = '转为曲奇';
      actions.appendChild(convertBtn);

      item.appendChild(timeDiv);
      item.appendChild(userRow);
      item.appendChild(passRow);
      item.appendChild(cookieBox);
      item.appendChild(actions);
      
      // 绑定事件
      cookieBox.querySelector('.btn-copy-hist').onclick = () => copyText(h.cookies);
      convertBtn.onclick = () => convertHistory(i);

      list.appendChild(item);
    });
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

  $('settingsBtn').addEventListener('click', () => $('settingsModal').classList.add('show'));
  $('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.remove('show'));

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('darkModeToggle').checked = theme === 'dark';
  }
  applyTheme(mq.matches ? 'dark' : 'light');
  
  $('darkModeToggle').addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });

  const COLORS = ['purple', 'blue', 'green', 'orange'];
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      document.documentElement.dataset.color = color;
      localStorage.setItem('md_color', color);
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  if (localStorage.getItem('ignore_votes') === 'true') {
    $('ignoreVotesSetting').checked = true;
  }
  $('ignoreVotesSetting').addEventListener('change', (e) => {
    localStorage.setItem('ignore_votes', e.target.checked);
  });

  (async function init() {
    let savedColor = localStorage.getItem('md_color') || 'purple';
    document.documentElement.dataset.color = savedColor;
    document.querySelectorAll('.color-dot').forEach(d => {
      if (d.dataset.color === savedColor) d.classList.add('active');
    });

    try { userFp = await generateFingerprint(); } catch(e) { userFp = 'FP_FALLBACK_' + Date.now(); }
    await loadInfo(); 
    if ($('btnText').textContent === '加载中') {
      $('getBtn').disabled = false; $('btnText').textContent = '获取';
    }
    $('getBtn').addEventListener('click', () => doFetch());
    renderHistory();
  })();
})();
