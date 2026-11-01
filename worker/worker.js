// ============================================================
//  4399 通道代理 Worker（单行 JSON + 随机通道 + 自动重试）
// ============================================================

// 密钥（字符反转混淆）
const ENC = [
  "33e67616e8b54dde863733cbfd44b87a158f7479_uka",
  "d8a166131753adc3a62dc6205300d6ab159aa2d9_uka",
  "35136ae6977cc73e1e1207b55611a97f2d8b3f75_uka"
];
const KEYS = ENC.map(s => s.split("").reverse().join(""));

const API = "https://api.4399pc.cc";

const ALLOWED_ORIGINS = [
  "https://cookie.xtz1.top",
  "https://cookiew.xtz1.top"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

async function fetchJson(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text.slice(0, 300) }; }
    return { data, status: res.status, elapsed: Date.now() - t0 };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`请求超时 ${ms}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ★ 输出单行、带 {} 的 JSON 字符串
function pickCookies(obj) {
  if (!obj) return "";

  const names = ["cookies", "cookie", "cookie_str", "cookieStr", "cookies_str"];
  for (const n of names) {
    const v = obj[n];
    if (typeof v === "string" && v.trim()) return v;
  }

  if (obj.data) {
    let dataObj = obj.data;
    if (typeof dataObj === "string") {
      try { dataObj = JSON.parse(dataObj); } catch (e) { return obj.data; }
    }
    if (dataObj && typeof dataObj === "object" && dataObj.sauth_json) {
      try {
        const sauthObj = JSON.parse(dataObj.sauth_json);
        return JSON.stringify(sauthObj); // 单行 JSON
      } catch (e) {
        return dataObj.sauth_json;
      }
    }
  }
  return JSON.stringify(obj);
}

// 随机选择通道
function chooseChannel() {
  return Math.floor(Math.random() * KEYS.length) + 1;
}

async function doClaim(key) {
  const u = new URL(API + "/claim_by_key");
  u.searchParams.set("key", key);
  return fetchJson(u.toString(), 15000);
}

async function doConvertOnce(key, username, password, useParam) {
  const u = new URL(API + "/convert_cookies_by_key");
  u.searchParams.set("key", key);
  u.searchParams.set("username", username);
  u.searchParams.set("password", password);
  if (useParam !== null) u.searchParams.set("use", useParam);
  return fetchJson(u.toString(), 20000);
}

async function doConvertWithRetry(key, username, password, useParam = "pc") {
  const delays = [0, 1200, 2500];
  let last = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
    const r = await doConvertOnce(key, username, password, useParam);
    const d = r.data;
    if (d && d.code === 1) return { ...r, attempts: i + 1 };
    last = { ...r, attempts: i + 1 };
    if (d && d.charged === true) return last;
    const msg = (d && d.msg) || "";
    if (/额度|quota|invalid|unauthor|forbidden|not\s*found/i.test(msg)) return last;
  }
  return last;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const path = url.pathname;

    if (path === "/run" || path === "/" || path === "") {
      const channel = chooseChannel();
      const key = KEYS[channel - 1];
      try {
        const claimR = await doClaim(key);
        const claim = claimR.data;
        if (!claim || claim.code !== 1) {
          return json({ ok: false, channel, stage: "claim", error: (claim && claim.msg) || "领取失败" }, 200, origin);
        }
        const username = claim.username || "";
        const password = claim.password || "";
        if (!username || !password) {
          return json({ ok: false, channel, stage: "claim", error: "返回缺少账号或密码" }, 200, origin);
        }

        const convR = await doConvertWithRetry(key, username, password, "pc");
        const conv = convR.data;
        if (!conv || conv.code !== 1) {
          return json({
            ok: false, channel, stage: "convert",
            error: (conv && conv.msg) || "转换失败",
            username, password,
            remaining: claim.remaining ?? null
          }, 200, origin);
        }
        
        const cookies = pickCookies(conv);
        return json({
          ok: true, channel, username, password, cookies,
          remaining: claim.remaining ?? null
        }, 200, origin);
      } catch (e) {
        return json({ ok: false, channel, error: e.message }, 200, origin);
      }
    }

    return json({ ok: false, error: "not found" }, 404, origin);
  }
};
