// ============================================================
//  4399 通道代理 Worker (KV动态管理版)
//  绑定 KV 变量名: 4399kv
// ============================================================

const API = "https://api.4399pc.cc";
const ALLOWED_ORIGIN = "https://cookie.xtz1.top"; // 强制限制的域名
const DAILY_LIMIT = 20; // 每个用户每天可获取次数

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

// 获取今天日期字符串
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

// 简易混淆加解密 (非明文存储 API Key)
const obfuscate = (str) => btoa(str.split('').reverse().join(''));
const deobfuscate = (str) => atob(str).split('').reverse().join('');

async function fetchJson(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text.slice(0, 300) }; }
    return { data, status: res.status };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`请求超时`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function pickCookies(obj) {
  if (!obj) return "";
  if (obj.data) {
    let dataObj = obj.data;
    if (typeof dataObj === "string") {
      try { dataObj = JSON.parse(dataObj); } catch (e) { return obj.data; }
    }
    if (dataObj && typeof dataObj === "object" && dataObj.sauth_json) {
      try { return JSON.stringify(JSON.parse(dataObj.sauth_json)); } catch (e) { return dataObj.sauth_json; }
    }
  }
  return JSON.stringify(obj);
}

async function doClaim(key) {
  const u = new URL(API + "/claim_by_key");
  u.searchParams.set("key", key);
  return fetchJson(u.toString());
}

async function doConvertWithRetry(key, username, password) {
  const delays = [0, 1000, 2000];
  let last;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
    const u = new URL(API + "/convert_cookies_by_key");
    u.searchParams.set("key", key);
    u.searchParams.set("username", username);
    u.searchParams.set("password", password);
    u.searchParams.set("use", "pc");
    const r = await fetchJson(u.toString());
    last = r;
    if (r.data && r.data.code === 1) return r;
    if (r.data && r.data.charged === true) return r;
  }
  return last;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // 强制校验域名
    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden Origin", { status: 403, headers: corsHeaders(origin) });
    }

    const kv = env['4399kv'];

    // ==========================================
    // 后台 API 接口 (/admin/api)
    // ==========================================
    if (path === "/admin/api") {
      const clientKey = url.searchParams.get("key");
      if (!clientKey) return json({ ok: false, msg: "缺少鉴权参数" }, 401, origin);
      
      // 从 KV 获取管理员密钥
      let adminKey = await kv.get("admin_key");
      if (!adminKey) {
        // 初始化
        adminKey = "XJ9k-mP4q-W2nV";
        await kv.put("admin_key", adminKey);
        // 顺便初始化 3 个通道
        const defaultChannels = [
          { id: 1, name: "通道 1", key: obfuscate("aku_9747f851a78b44dfbc337368edd45b8e61676e33"), active: true },
          { id: 2, name: "通道 2", key: obfuscate("aku_9d2aa951ba6d0035026cd26a3cda357131661a8d"), active: true },
          { id: 3, name: "通道 3", key: obfuscate("aku_57f3b8d2f79a11655b7021e1e37cc7796ea63153"), active: true }
        ];
        await kv.put("channels", JSON.stringify(defaultChannels));
      }

      if (clientKey !== adminKey) return json({ ok: false, msg: "密钥错误" }, 403, origin);

      // GET 获取数据
      if (request.method === "GET") {
        let channels = JSON.parse(await kv.get("channels") || "[]");
        let users = JSON.parse(await kv.get("users") || "{}");
        // 隐藏真实 Key，只传掩码
        const safeChannels = channels.map(c => ({ ...c, key: deobfuscate(c.key).slice(0, 10) + "..." }));
        return json({ ok: true, channels: safeChannels, users }, 200, origin);
      }
      // POST 修改数据
      if (request.method === "POST") {
        const body = await request.json();
        if (body.action === "toggle_channel") {
          let channels = JSON.parse(await kv.get("channels") || "[]");
          channels = channels.map(c => c.id === body.id ? { ...c, active: body.active } : c);
          await kv.put("channels", JSON.stringify(channels));
          return json({ ok: true });
        }
        if (body.action === "ban_user") {
          let users = JSON.parse(await kv.get("users") || "{}");
          if (users[body.fingerprint]) {
            users[body.fingerprint].status = body.status;
            await kv.put("users", JSON.stringify(users));
          }
          return json({ ok: true });
        }
      }
      return json({ ok: false, msg: "Invalid Request" }, 400, origin);
    }

    // ==========================================
    // 普通用户接口 (/run)
    // ==========================================
    if (path === "/run" || path === "/") {
      const fingerprint = url.searchParams.get("fp");
      if (!fingerprint) return json({ ok: false, error: "缺少设备指纹" }, 400, origin);

      // 1. 校验用户状态与额度
      const today = getTodayStr();
      let users = JSON.parse(await kv.get("users") || "{}");
      let user = users[fingerprint] || { count: 0, date: today, status: "active" };

      if (user.status === "banned") {
        return json({ ok: false, error: "您的设备已被封禁，无法获取" }, 403, origin);
      }
      if (user.date !== today) {
        user.count = 0;
        user.date = today;
      }
      if (user.count >= DAILY_LIMIT) {
        return json({ ok: false, error: "今日额度已用完，请明天再来" }, 429, origin);
      }

      // 2. 选出启用的通道
      let channels = JSON.parse(await kv.get("channels") || "[]");
      const activeChannels = channels.filter(c => c.active);
      if (activeChannels.length === 0) {
        return json({ ok: false, error: "当前没有可用通道，请联系管理员" }, 503, origin);
      }
      
      const channel = activeChannels[Math.floor(Math.random() * activeChannels.length)];
      const realKey = deobfuscate(channel.key);

      // 3. 开始获取与转换
      try {
        const claimR = await doClaim(realKey);
        const claim = claimR.data;
        if (!claim || claim.code !== 1) {
           return json({ ok: false, channel: channel.id, error: (claim && claim.msg) || "领取失败" }, 200, origin);
        }

        const username = claim.username;
        const password = claim.password;

        const convR = await doConvertWithRetry(realKey, username, password);
        const conv = convR.data;
        if (!conv || conv.code !== 1) {
           return json({ ok: false, channel: channel.id, error: (conv && conv.msg) || "转换失败", username, password }, 200, origin);
        }

        const cookies = pickCookies(conv);

        // 4. 成功才扣次数并更新 KV
        user.count += 1;
        users[fingerprint] = user;
        await kv.put("users", JSON.stringify(users));

        return json({
          ok: true, channel: channel.id, username, password, cookies,
          remaining: DAILY_LIMIT - user.count
        }, 200, origin);

      } catch (e) {
        return json({ ok: false, channel: channel.id, error: e.message }, 200, origin);
      }
    }

    return json({ ok: false, error: "not found" }, 404, origin);
  }
};
