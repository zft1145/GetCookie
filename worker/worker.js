const API = "https://api.4399pc.cc";
const ALLOWED_ORIGIN = "https://cookie.xtz1.top"; 
const SIGN_SECRET = "VHax_Secret_2024";

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

function verifySignature(url, sign) {
  if (!sign) return false;
  const t = parseInt(url.searchParams.get("t") || "0", 10);
  if (Date.now() - t > 300000) return false;
  const raw = t.toString() + SIGN_SECRET;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16) === sign;
}

function calcDynamicLimit(isVip, count) {
  if (!isVip) return 20;
  if (count >= 30) return 100;
  if (count >= 15) return 81;
  if (count >= 10) return 62;
  if (count >= 5) return 47;
  if (count >= 3) return 36;
  return 25;
}

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
  } catch (e) { return false; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });

    try {
      if (!env || !env['4399kv']) return json({ ok: false, error: "服务器错误" }, 500, origin);
      const kv = env['4399kv'];

      if (path === "/admin/api") {
        const clientKey = url.searchParams.get("key");
        let adminKey = await kv.get("admin_key");
        
        if (!adminKey) {
          adminKey = "XJ9k-mP4q-W2nV";
          await kv.put("admin_key", adminKey);
          await kv.put("config", JSON.stringify({ turnstile_site_key: "", turnstile_secret: "", cdk: "VHaxAgentXTZCookieWebsite" }));
          await kv.put("channels", JSON.stringify([{ id: 1, name: "通道 1", key: obfuscate("aku_9747f851a78b44dfbc337368edd45b8e61676e33"), active: true, votes: 0 }]));
        }

        if (clientKey !== adminKey) return json({ ok: false, error: "密钥错误" }, 403, origin);

        if (request.method === "GET") {
          const [channelsStr, usersStr, configStr] = await Promise.all([kv.get("channels"), kv.get("users"), kv.get("config")]);
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
          if (body.action === "delete_channel") {
            let channels = JSON.parse(await kv.get("channels") || "[]");
            channels = channels.filter(c => c.id !== body.id);
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
          if (body.action === "reset_user_quota") {
            let users = JSON.parse(await kv.get("users") || "{}");
            if (users[body.fingerprint]) {
              users[body.fingerprint].count = 0;
              users[body.fingerprint].suspicion = 0;
              await kv.put("users", JSON.stringify(users));
            }
            return json({ ok: true }, 200, origin);
          }
          if (body.action === "set_vip") {
            let users = JSON.parse(await kv.get("users") || "{}");
            if (users[body.fingerprint]) {
              users[body.fingerprint].vip = body.vip;
              await kv.put("users", JSON.stringify(users));
            }
            return json({ ok: true }, 200, origin);
          }
        }
        return json({ ok: false, error: "Invalid Request" }, 400, origin);
      }

      if (url.searchParams.get("bot") === "1" || url.searchParams.get("honeypot") === "1") {
        return json({ ok: true, status: "ok", cookies: "fake_data_silent_ban", remaining: 0, used: 0 }, 200, origin);
      }

      const sign = url.searchParams.get("sign");
      if (!verifySignature(url, sign)) return json({ ok: false, error: "网络异常(签名校验失败)" }, 403, origin);

      const fingerprint = url.searchParams.get("fp");
      if (!fingerprint) return json({ ok: false, error: "缺少参数" }, 400, origin);

      const [usersStr, channelsStr, configStr] = await Promise.all([kv.get("users"), kv.get("channels"), kv.get("config")]);
      let users = JSON.parse(usersStr || "{}");
      let user = users[fingerprint] || { count: 0, date: getTodayStr(), status: "active", vip: false, username: "" };
      let config = JSON.parse(configStr || "{}");

      if (user.date !== getTodayStr()) { user.count = 0; user.date = getTodayStr(); }
      const limit = calcDynamicLimit(user.vip, user.count);

      let todayTotalUsed = 0;
      let totalUserCount = 0;
      for (const k in users) {
        if (users[k].username) totalUserCount++;
        if (users[k].date === getTodayStr()) {
          todayTotalUsed += users[k].count || 0;
        }
      }

      if (path === "/info") {
        return json({
          ok: true,
          uid: fingerprint,
          username: user.username || "",
          remaining: Math.max(0, limit - user.count),
          used: user.count,
          limit: limit,
          status: user.status,
          is_vip: user.vip || false,
          turnstile_site_key: config.turnstile_site_key || "",
          today_total_used: todayTotalUsed,
          total_user_count: totalUserCount
        }, 200, origin);
      }

      if (path === "/vote") {
        const channelId = parseInt(url.searchParams.get("channel"), 10);
        const action = url.searchParams.get("action");
        if (!channelId || !action) return json({ ok: false, error: "参数错误" }, 400, origin);
        let channels = JSON.parse(channelsStr || "[]");
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

      if (path === "/bind") {
        const token = url.searchParams.get("turnstile_token");
        const username = url.searchParams.get("username");
        if (!token || !username) return json({ ok: false, error: "参数不全" }, 400, origin);
        const isValid = await verifyTurnstile(token, config.turnstile_secret);
        if (!isValid) return json({ ok: false, error: "验证失败" }, 403, origin);
        user.username = username;
        users[fingerprint] = user;
        await kv.put("users", JSON.stringify(users));
        return json({ ok: true, msg: "绑定成功" }, 200, origin);
      }

      if (user.status === "banned") return json({ ok: false, error: "已被封禁" }, 403, origin);
      if (user.count >= limit) return json({ ok: false, error: "额度已用完" }, 429, origin);

      if (path === "/claim" || path === "/convert") {
        const now = Math.floor(Date.now() / 1000);
        if (!user.last_time || now - user.last_time > 60) user.suspicion = 0;
        user.suspicion = (user.suspicion || 0) + 0.5;
        user.last_time = now;
        
        const riskLimit = user.vip ? 5 : 3;
        if (user.suspicion >= riskLimit) {
          const token = url.searchParams.get("turnstile_token");
          if (!token) return json({ ok: false, need_turnstile: true, error: "触发风控，请完成验证" }, 403, origin);
          const isValid = await verifyTurnstile(token, config.turnstile_secret);
          if (!isValid) return json({ ok: false, need_turnstile: true, error: "验证失败，请重试" }, 403, origin);
          user.suspicion = 0; 
        }
      }

      if (path === "/claim") {
        let channels = JSON.parse(channelsStr || "[]");
        const activeChannels = channels.filter(c => c.active);
        if (activeChannels.length === 0) return json({ ok: false, error: "无可用通道" }, 503, origin);
        
        const channel = activeChannels[Math.floor(Math.random() * activeChannels.length)];
        const realKey = deobfuscate(channel.key);
        
        const u = new URL(API + "/claim_by_key");
        u.searchParams.set("key", realKey);
        const claimR = await fetchJson(u.toString());
        
        if (!claimR.data || claimR.data.code !== 1) return json({ ok: false, error: "领取失败" }, 200, origin);

        user.count += 1;
        users[fingerprint] = user;
        await kv.put("users", JSON.stringify(users));

        return json({ 
            ok: true, 
            channel: channel.id, 
            channel_name: channel.name, // 新增返回名称
            channel_key: realKey, 
            username: claimR.data.username, 
            password: claimR.data.password, 
            remaining: limit - user.count 
        }, 200, origin);
      }

      if (path === "/convert") {
        const username = url.searchParams.get("username");
        const password = url.searchParams.get("password");
        let key = url.searchParams.get("key");
        const refund = url.searchParams.get("refund") === "true";

        if (!key || key === "default") {
          let active = JSON.parse(channelsStr || "[]").filter(c => c.active);
          if (active.length > 0) key = deobfuscate(active[0].key);
        }

        const convR = await doConvertWithRetry(key, username, password);
        if (!convR.data || convR.data.code !== 1) {
           if (refund) {
             user.count = Math.max(0, user.count - 0.5);
             users[fingerprint] = user;
             await kv.put("users", JSON.stringify(users));
           }
           return json({ ok: false, error: "转换失败，请稍后重试" }, 200, origin);
        }
        return json({ ok: true, cookies: pickCookies(convR.data) }, 200, origin);
      }

      return json({ ok: false, error: "not found" }, 404, origin);
    } catch (e) {
      return json({ ok: false, error: "系统异常" }, 500, origin);
    }
  }
};
