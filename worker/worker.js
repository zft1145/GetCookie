// ============================================================
//  4399 通道代理 Worker（分步版）
//  /claim   只领取账号
//  /convert 只转换 Cookies
//  /run     一步到位（兼容）
//  密钥字符反转混淆，前端只传 channel=1|2|3
// ============================================================

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

// 带超时的 JSON 请求，返回数据 + 耗时
async function fetchJson(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal
    });
    const tFetch = Date.now() - t0;
    const text = await res.text();
    const tAll = Date.now() - t0;
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text.slice(0, 300) }; }
    return { data, tFetch, tAll, status: res.status };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`请求超时 ${ms}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function pickCookies(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  const names = ["cookies", "cookie", "cookie_str", "cookieStr", "cookies_str"];
  for (const n of names) {
    const v = obj[n];
    if (typeof v === "string" && v.trim()) return v;
  }
  for (const n of names) {
    const v = obj[n];
    if (v && typeof v === "object") {
      return Object.keys(v).map(k => `${k}=${v[k]}`).join("; ");
    }
  }
  for (const k of Object.keys(obj)) {
    if (/cookie/i.test(k) && typeof obj[k] === "string") return obj[k];
  }
  return "";
}

function chooseChannel(url) {
  let channel = parseInt(url.searchParams.get("channel") || "0", 10);
  if (!(channel >= 1 && channel <= KEYS.length)) {
    channel = Math.floor(Math.random() * KEYS.length) + 1;
  }
  return channel;
}

async function doClaim(key) {
  const u = new URL(API + "/claim_by_key");
  u.searchParams.set("key", key);
  return fetchJson(u.toString(), 15000);
}

async function doConvert(key, username, password, usePc) {
  const u = new URL(API + "/convert_cookies_by_key");
  u.searchParams.set("key", key);
  u.searchParams.set("username", username);
  u.searchParams.set("password", password);
  if (usePc) u.searchParams.set("use", "pc");
  return fetchJson(u.toString(), 20000);
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
        const { data, tAll } = await doClaim(key);
        if (!data || data.code !== 1) {
          return json({
            ok: false, stage: "claim", channel,
            error: (data && data.msg) || "领取失败",
            elapsed: tAll, raw: data
          }, 200, origin);
        }
        return json({
          ok: true, stage: "claim", channel,
          username: data.username,
          password: data.password,
          remaining: data.remaining ?? null,
          quotaLimit: data.quota_limit ?? null,
          usedCount: data.used_count ?? null,
          elapsed: tAll
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

      const usePc = useParam === null ? true : useParam !== "none";

      try {
        const { data, tAll } = await doConvert(key, username, password, usePc);
        if (!data || data.code !== 1) {
          return json({
            ok: false, stage: "convert", channel,
            error: (data && data.msg) || "转换失败",
            username, password,
            elapsed: tAll, raw: data
          }, 200, origin);
        }
        const cookies = pickCookies(data);
        return json({
          ok: true, stage: "convert", channel,
          username, password, cookies,
          elapsed: tAll,
          rawConvert: cookies ? undefined : data
        }, 200, origin);
      } catch (e) {
        return json({ ok: false, stage: "convert", channel, error: e.message }, 200, origin);
      }
    }

    // ---------- /run 兼容一步到位 ----------
    if (path === "/run" || path === "/" || path === "") {
      const channel = chooseChannel(url);
      const key = KEYS[channel - 1];
      try {
        const claimR = await doClaim(key);
        const claim = claimR.data;
        if (!claim || claim.code !== 1) {
          return json({
            ok: false, channel, stage: "claim",
            error: (claim && claim.msg) || "领取失败",
            elapsedClaim: claimR.tAll
          }, 200, origin);
        }
        const username = claim.username || "";
        const password = claim.password || "";
        const remaining = claim.remaining ?? null;
        const quotaLimit = claim.quota_limit ?? null;
        const usedCount = claim.used_count ?? null;

        if (!username || !password) {
          return json({ ok: false, channel, stage: "claim", error: "返回缺少账号或密码" }, 200, origin);
        }

        const convR = await doConvert(key, username, password, true);
        const conv = convR.data;
        if (!conv || conv.code !== 1) {
          return json({
            ok: false, channel, stage: "convert",
            error: (conv && conv.msg) || "转换失败",
            username, password, remaining, quotaLimit, usedCount,
            elapsedClaim: claimR.tAll, elapsedConvert: convR.tAll
          }, 200, origin);
        }
        const cookies = pickCookies(conv);
        return json({
          ok: true, channel,
          username, password, cookies,
          remaining, quotaLimit, usedCount,
          elapsedClaim: claimR.tAll, elapsedConvert: convR.tAll,
          rawConvert: cookies ? undefined : conv
        }, 200, origin);
      } catch (e) {
        return json({ ok: false, channel, error: e.message }, 200, origin);
      }
    }

    return json({ ok: false, error: "not found" }, 404, origin);
  }
};
