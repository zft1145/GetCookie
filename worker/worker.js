const API = "https://api.4399pc.cc";
const ALLOWED_ORIGIN = "https://cookie.xtz1.top"; 
const DAILY_LIMIT_NORMAL = 20;
const DAILY_LIMIT_VIP = 45;

function corsHeaders(origin) {
  const allow = origin || "*";
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
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

const obfuscate = (str) => btoa(str.split('').reverse().join(''));
const deobfuscate = (str) => atob(str).split('').reverse().join('');

async function fetchJson(url, ms = 8000) {
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

async function doConvertWithRetry(key, username, password) {
  const delays = [0, 300, 600];
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

async function verifyTurnstile(token, secret) {
  if (!secret) return true; 
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
    const data = await res.json();
    return data.success;
  } catch (e) {
    return false;
  }
}

function getRandomChannel(channels, ignoreVotes) {
  const active = channels.filter(c => c.active);
  if (active.length === 0) return null;
  if (ignoreVotes || active.length === 1) {
    return active[Math.floor(Math.random() * active.length)];
  }
  const weighted = active.map(c => {
    let w = 1 + (c.votes || 0);
    if (w < 0.1) w = 0.1;
    return { c, w };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.w, 0);
  let random = Math.random() * totalWeight;
  for (const item of weighted) {
    if (random < item.w) return item.c;
    random -= item.w;
  }
  return active[0];
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });

    try {
      if (!env || !env['4399kv']) return json({ ok: false, error: "服务器错误：未绑定 KV" }, 500, origin);
      const kv = env['4399kv'];

      if (path === "/admin/api") {
        const clientKey = url.searchParams.get("key");
        let adminKey = await kv.get("admin_key");
        
        if (!adminKey) {
          adminKey = "XJ9k-mP4q-W2nV";
          await kv.put("admin_key", adminKey);
          await kv.put("config", JSON.stringify({ turnstile_site_key: "", turnstile_secret: "", cdk: "VHaxAgentXTZCookieWebsite" }));
          const defaultChannels = [
            { id: 1, name: "通道 1", key: obfuscate("aku_9747f851a78b44dfbc337368edd45b8e61676e33"), active: true, votes: 0 }
          ];
          await kv.put("channels", JSON.stringify(defaultChannels));
        }

        if (clientKey !== adminKey) return json({ ok: false, error: "密钥错误" }, 403, origin);

        if (request.method === "GET") {
          const [channelsStr, usersStr, configStr] = await Promise.all([
            kv.get("channels"),
            kv.get("users"),
            kv.get("config")
          ]);
          let channels = JSON.parse(channelsStr || "[]");
          let users = JSON.parse(usersStr || "{}");
          let config = JSON.parse(configStr || "{}");
          const safeChannels = channels.map(c => ({ ...c, key: deobfuscate(c.key).slice(0, 10) + "..." }));
          return json({ ok: true, channels: safeChannels, users, config }, 200, origin);
        }

        if (request.method === "POST") {
          const body = await request.json();
          if (body.action === "toggle_channel") {
            let channels = JSON.parse(await kv.get("channels") || "[]");
            channels = channels.map(c => c.id === body.id ? { ...c, active: body.active } : c);
            await kv.put("channels", JSON.stringify(channels));
            return json({ ok: true }, 200, origin);
          }
          if (body.action === "add_channel") {
            let channels = JSON.parse(await kv.get("channels") || "[]");
            const newId = channels.length > 0 ? Math.max(...channels.map(c => c.id)) + 1 : 1;
            channels.push({ id: newId, name: body.name, key: obfuscate(body.key), active: true, votes: 0 });
            await kv.put("channels", JSON.stringify(channels));
            return json({ ok: true }, 200, origin);
          }
          if (body.action === "save_config") {
            let config = JSON.parse(await kv.get("config") || "{}");
            config = { ...config, ...body.config };
            await kv.put("config", JSON.stringify(config));
            return json({ ok: true }, 200, origin);
          }
          if (body.action === "ban_user") {
            let users = JSON.parse(await kv.get("users") || "{}");
            if (users[body.fingerprint]) {
              users[body.fingerprint].status = body.status;
              await kv.put("users", JSON.stringify(users));
            }
            return json({ ok: true }, 200, origin);
          }
        }
        return json({ ok: false, error: "Invalid Request" }, 400, origin);
      }

      if (path === "/vote") {
        const channelId = parseInt(url.searchParams.get("channel"), 10);
        const action = url.searchParams.get("action");
        if (!channelId || !action) return json({ ok: false, error: "参数错误" }, 400, origin);
        
        let channels = JSON.parse(await kv.get("channels") || "[]");
        channels = channels.map(c => {
           if (c.id === channelId) {
              if (action === 'up') c.votes = (c.votes || 0) + 1;
              if (action === 'down') c.votes = (c.votes || 0) - 1;
           }
           return c;
        });
        await kv.put("channels", JSON.stringify(channels));
        return json({ ok: true }, 200, origin);
      }

      if (path === "/redeem") {
        const fingerprint = url.searchParams.get("fp");
        const cdkInput = url.searchParams.get("cdk");
        if (!fingerprint || !cdkInput) return json({ ok: false, error: "参数错误" }, 400, origin);

        const [configStr, usersStr] = await Promise.all([
          kv.get("config"),
          kv.get("users")
        ]);
        let config = JSON.parse(configStr || "{}");
        if (cdkInput.trim() !== config.cdk) {
          return json({ ok: false, error: "兑换码无效" }, 400, origin);
        }

        let users = JSON.parse(usersStr || "{}");
        let user = users[fingerprint] || { count: 0, date: getTodayStr(), status: "active", req_times: [] };
        user.vip = true; 
        users[fingerprint] = user;
        await kv.put("users", JSON.stringify(users));
        return json({ ok: true, msg: "兑换成功！已解锁无限额度" }, 200, origin);
      }

      if (path === "/info") {
        const fingerprint = url.searchParams.get("fp");
        if (!fingerprint) return json({ ok: false, error: "缺少设备指纹" }, 400, origin);
        const [usersStr, configStr] = await Promise.all([kv.get("users"), kv.get("config")]);
        let users = JSON.parse(usersStr || "{}");
        let user = users[fingerprint] || { count: 0, date: getTodayStr(), status: "active", vip: false };
        if (user.date !== getTodayStr()) user.count = 0;

        let config = JSON.parse(configStr || "{}");
        const limit = user.vip ? DAILY_LIMIT_VIP : DAILY_LIMIT_NORMAL;
        return json({
          ok: true,
          remaining: Math.max(0, limit - user.count),
          used: user.count,
          totalUsers: Object.keys(users).length,
          status: user.status,
          is_vip: user.vip || false,
          turnstile_site_key: config.turnstile_site_key || ""
        }, 200, origin);
      }

      if (path === "/claim") {
        const fingerprint = url.searchParams.get("fp");
        const ignoreVotes = url.searchParams.get("ignore_votes") === "true";
        if (!fingerprint) return json({ ok: false, error: "缺少设备指纹" }, 400, origin);

        const [usersStr, channelsStr, configStr] = await Promise.all([kv.get("users"), kv.get("channels"), kv.get("config")]);
        let users = JSON.parse(usersStr || "{}");
        let user = users[fingerprint] || { count: 0, date: getTodayStr(), status: "active", req_times: [], vip: false };
        let config = JSON.parse(configStr || "{}");

        if (user.status === "banned") return json({ ok: false, error: "已被封禁" }, 403, origin);
        if (user.date !== getTodayStr()) { user.count = 0; user.date = getTodayStr(); }
        
        const limit = user.vip ? DAILY_LIMIT_VIP : DAILY_LIMIT_NORMAL;
        if (user.count >= limit) return json({ ok: false, error: "网络错误，请稍后再试" }, 429, origin);

        const now = Math.floor(Date.now() / 1000);
        user.req_times = (user.req_times || []).filter(t => now - t < 60);
        const riskLimit = user.vip ? 5 : 3;
        
        if (user.req_times.length >= riskLimit) {
          const token = url.searchParams.get("turnstile_token");
          if (!token) return json({ ok: false, need_turnstile: true, error: "触发频率限制，请完成验证" }, 403, origin);
          const isValid = await verifyTurnstile(token, config.turnstile_secret);
          if (!isValid) return json({ ok: false, need_turnstile: true, error: "验证失败，请重试" }, 403, origin);
          user.req_times = []; 
        }

        let channels = JSON.parse(channelsStr || "[]");
        const channel = getRandomChannel(channels, ignoreVotes);
        if (!channel) return json({ ok: false, error: "无可用通道" }, 503, origin);
        
        const realKey = deobfuscate(channel.key);
        const u = new URL(API + "/claim_by_key");
        u.searchParams.set("key", realKey);
        const claimR = await fetchJson(u.toString());
        
        if (!claimR.data || claimR.data.code !== 1) {
           return json({ ok: false, error: claimR.data?.msg || "领取失败" }, 200, origin);
        }

        user.count += 1;
        user.req_times.push(now);
        users[fingerprint] = user;
        await kv.put("users", JSON.stringify(users));

        return json({
          ok: true, 
          channel: channel.id, 
          channel_key: realKey,
          username: claimR.data.username, 
          password: claimR.data.password,
          remaining: limit - user.count
        }, 200, origin);
      }

      if (path === "/convert") {
        const username = url.searchParams.get("username");
        const password = url.searchParams.get("password");
        const key = url.searchParams.get("key");
        if (!username || !password || !key) return json({ ok: false, error: "缺少参数" }, 400, origin);

        const convR = await doConvertWithRetry(key, username, password);
        if (!convR.data || convR.data.code !== 1) {
           return json({ ok: false, error: "网络错误，请稍后再试" }, 200, origin);
        }

        return json({ ok: true, cookies: pickCookies(convR.data) }, 200, origin);
      }

      return json({ ok: false, error: "not found" }, 404, origin);
    } catch (e) {
      return json({ ok: false, error: "Worker 异常: " + e.message }, 500, origin);
    }
  }
};
