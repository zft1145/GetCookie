(function () {
  let ADMIN_KEY = new URLSearchParams(location.search).get('key') || '';
  const $ = id => document.getElementById(id);
  let snackTimer;

  function toast(msg) {
    $('snackbar').textContent = msg;
    $('snackbar').classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => $('snackbar').classList.remove('show'), 2200);
  }

  async function loadData() {
    if (!ADMIN_KEY) return;
    try {
      const res = await fetch(`https://cookiew.xtz1.top/admin/api?key=${ADMIN_KEY}`);
      const data = await res.json();
      
      if (!data.ok) {
        toast(data.error || '鉴权失败');
        $('authCard').style.display = 'block';
        return;
      }

      $('authCard').style.display = 'none';
      ['navBtns','addChannelCard','dataCard','configCard','userCard'].forEach(id => {
        $(id).style.display = 'flex';
        if(id !== 'navBtns') $(id).style.display = 'block';
      });

      $('channelList').innerHTML = data.channels.map(c => `
        <div class="admin-item">
          <div>
            <strong>${c.name}</strong> <span style="font-size:12px;color:${c.votes>=0?'var(--md-success)':'var(--md-error)'}">(票数: ${c.votes||0})</span>
            <br><span style="font-size:12px;color:var(--md-on-surface-variant)">${c.key}</span>
          </div>
          <button class="copy-btn" onclick="toggleChannel(${c.id}, ${!c.active})" style="color:${c.active?'var(--md-success)':'var(--md-error)'}">
            ${c.active ? '开启中' : '已关闭'}
          </button>
        </div>
      `).join('');

      if (data.config) {
        $('cfgSiteKey').value = data.config.turnstile_site_key || '';
        $('cfgSecret').value = data.config.turnstile_secret || '';
        $('cfgCdk').value = data.config.cdk || '';
      }

      const userKeys = Object.keys(data.users);
      if (userKeys.length === 0) {
        $('userList').innerHTML = `<div style="padding:16px;font-size:14px;color:var(--md-on-surface-variant)">暂无记录</div>`;
      } else {
        $('userList').innerHTML = userKeys.map(fp => {
          const u = data.users[fp];
          const vipBadge = u.vip ? `<span style="color:#FFF;background:var(--md-primary);font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">VIP</span>` : '';
          const limit = u.vip ? '动态上限' : 20;
          return `
          <div class="admin-item">
            <div>
              <strong>${u.username || '未绑定'} (${fp}) ${vipBadge}</strong><br>
              <span style="font-size:12px;color:var(--md-on-surface-variant)">今日已用: ${u.count} / ${limit}</span>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="copy-btn" onclick="resetUserQuota('${fp}')" style="color:var(--md-primary)">重置</button>
              <button class="copy-btn" onclick="toggleUser('${fp}', '${u.status === 'active' ? 'banned' : 'active'}')" style="color:${u.status === 'active' ? 'var(--md-error)' : 'var(--md-success)'}">
                ${u.status === 'active' ? '封禁' : '解封'}
              </button>
            </div>
          </div>
          `;
        }).join('');
      }
    } catch (e) { toast('网络请求失败'); }
  }

  window.toggleChannel = async (id, active) => {
    await fetch(`https://cookiew.xtz1.top/admin/api?key=${ADMIN_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_channel', id, active })
    });
    loadData();
  };

  window.toggleUser = async (fingerprint, status) => {
    await fetch(`https://cookiew.xtz1.top/admin/api?key=${ADMIN_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ban_user', fingerprint, status })
    });
    loadData();
  };

  window.resetUserQuota = async (fingerprint) => {
    if(!confirm('确定要重置该用户的今日额度吗？')) return;
    await fetch(`https://cookiew.xtz1.top/admin/api?key=${ADMIN_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_user_quota', fingerprint })
    });
    toast('额度已重置'); loadData();
  };

  $('authBtn').addEventListener('click', () => {
    const key = $('adminKeyInput').value.trim();
    if (key) { ADMIN_KEY = key; loadData(); }
  });

  $('addChannelBtn').addEventListener('click', async () => {
    const name = $('newChannelName').value.trim();
    const key = $('newChannelKey').value.trim();
    if (!name || !key) return toast('请填写完整信息');
    await fetch(`https://cookiew.xtz1.top/admin/api?key=${ADMIN_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_channel', name, key })
    });
    $('newChannelName').value = ''; $('newChannelKey').value = '';
    toast('添加成功'); loadData();
  });

  $('saveConfigBtn').addEventListener('click', async () => {
    const turnstile_site_key = $('cfgSiteKey').value.trim();
    const turnstile_secret = $('cfgSecret').value.trim();
    const cdk = $('cfgCdk').value.trim();
    await fetch(`https://cookiew.xtz1.top/admin/api?key=${ADMIN_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_config', config: { turnstile_site_key, turnstile_secret, cdk } })
    });
    toast('配置已保存');
  });

  if (ADMIN_KEY) loadData();
  else $('authCard').style.display = 'block';

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('iconSun').style.display = theme === 'dark' ? 'none' : '';
    $('iconMoon').style.display = theme === 'dark' ? '' : 'none';
  }
  applyTheme(mq.matches ? 'dark' : 'light');
  $('themeBtn').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
})();
