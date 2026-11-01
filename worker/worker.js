// ============================================================
//  4399 通道代理 Worker（自动重试 + 深层 JSON 解析）
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

function pickCookies(obj) {
  if (!obj) return "";

  // 1. 尝试找常规 cookie 字段
  const names = ["cookies", "cookie", "cookie_str", "cookieStr", "cookies_str"];
  for (const n of names) {
    const v = obj[n];
    if (typeof v === "string" && v.trim()) return v;
  }

  // 2. 针对 4399 的 data.sauth_json 结构，直接输出单行带大括号的 JSON
  if (obj.data) {
    let dataObj = obj.data;
    if (typeof dataObj === "string") {
      try { dataObj = JSON.parse(dataObj); } catch (e) { return obj.data; }
    }
    
    if (dataObj && typeof dataObj === "object" && dataObj.sauth_json) {
      try {
        // 解析出内层对象
        const sauthObj = JSON.parse(dataObj.sauth_json);
        // 直接 Stringify，不加 null, 2，这样就是紧凑的单行 JSON，带 {}
        return JSON.stringify(sauthObj);
      } catch (e) {
        return dataObj.sauth_json;
      }
    }
  }

  // 3. 兜底：直接把整个对象转成单行 JSON
  return JSON.stringify(obj);
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

// 带重试的转换：最多 3 次，间隔 0 / 1.2s / 2.5s
async function doConvertWithRetry(key, username, password, useParam = "pc") {
  const delays = [0, 1200, 2500];
  let last = null;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));

    const r = await doConvertOnce(key, username, password, useParam);
    const d = r.data;

    if (d && d.code === 1) {
      return { ...r, attempts: i + 1 };
    }

    last = { ...r, attempts: i + 1 };

    // 已扣费，不再重试
    if (d && d.charged === true) return last;

    // 非临时错误不重试
    const msg = (d && d.msg) || "";
    if (/额度|quota|invalid|unauthor|forbidden|not\s*found/i.test(msg)) {
      return last;
    }
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

    // ---------- /claim ----------
    if (path === "/claim") {
      const channel = chooseChannel(url);
      const key = KEYS[channel - 1];
      try {
        const { data, elapsed } = await doClaim(key);
        if (!data || data.code !== 1) {
          return json({ ok: false, stage: "claim", channel, error: (data && data.msg) || "领取失败", elapsed }, 200, origin);
        }
        return json({
          ok: true, stage: "claim", channel,
          username: data.username, password: data.password,
          remaining: data.remaining ?? null, quotaLimit: data.quota_limit ?? null,
          usedCount: data.used_count ?? null, elapsed
        }, 200, origin);
      } catch (e) {
        return json({ ok: false, stage: "claim", channel, error: e.message }, 200, origin);
      }
    }

    // ---------- /convert ----------
    if (path === "/convert") {
      const channel = chooseChannel(url);
      const key = KEYS[channel - 1];
      const username = url.searchParams.get("username") || "";
      const password = url.searchParams.get("password") || "";
      const useParam = url.searchParams.get("use"); // null | "pc" | "none"

      if (!username || !password) {
        return json({ ok: false, stage: "convert", channel, error: "缺少 username 或 password" }, 400, origin);
      }

      const use = useParam === null ? "pc" : (useParam === "none" ? null : useParam);

      try {
        const { data, elapsed, attempts } = await doConvertWithRetry(key, username, password, use);
        if (!data || data.code !== 1) {
          return json({
            ok: false, stage: "convert", channel,
            error: (data && data.msg) || "转换失败",
            username, password, elapsed, attempts,
            httpCode: data && data.http_code, charged: data && data.charged,
            upstream: data && data.data
          }, 200, origin);
        }
        const cookies = pickCookies(data);
        return json({
          ok: true, stage: "convert", channel,
          username, password, cookies, elapsed, attempts
        }, 200, origin);
      } catch (e) {
        return json({ ok: false, stage: "convert", channel, error: e.message }, 200, origin);
      }
    }

    // ---------- /run 兼容 ----------
    if (path === "/run" || path === "/" || path === "") {
      const channel = chooseChannel(url);
      const key = KEYS[channel - 1];
      try {
        const claimR = await doClaim(key);
        const claim = claimR.data;
        if (!claim || claim.code !== 1) {
          return json({ ok: false, channel, stage: "claim", error: (claim && claim.msg) || "领取失败", elapsedClaim: claimR.elapsed }, 200, origin);
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
            remaining: claim.remaining ?? null, quotaLimit: claim.quota_limit ?? null,
            elapsedClaim: claimR.elapsed, elapsedConvert: convR.elapsed,
            attempts: convR.attempts, httpCode: conv && conv.http_code,
            upstream: conv && conv.data
          }, 200, origin);
        }
        const cookies = pickCookies(conv);
        return json({
          ok: true, channel, username, password, cookies,
          remaining: claim.remaining ?? null, quotaLimit: claim.quota_limit ?? null,
          elapsedClaim: claimR.elapsed, elapsedConvert: convR.elapsed, attempts: convR.attempts
        }, 200, origin);
      } catch (e) {
        return json({ ok: false, channel, error: e.message }, 200, origin);
      }
    }

    return json({ ok: false, error: "not found" }, 404, origin);
  }
};
