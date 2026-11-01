// ============================================================
//  4399 通道代理 Worker
//  - 密钥以字符反转形式存放，运行时还原
//  - 前端只传 channel=1|2|3
//  - 接口：GET /run?channel=1|2|3
// ============================================================

// ---- 密钥（字符反转混淆，勿改顺序） ----
const ENC = [
  "33e67616e8b54dde863733cbfd44b87a158f7479_uka",
  "d8a166131753adc3a62dc6205300d6ab159aa2d9_uka",
  "35136ae6977cc73e1e1207b55611a97f2d8b3f75_uka"
];
const KEYS = ENC.map(s => s.split("").reverse().join(""));

// ---- 目标 API ----
const API = "https://api.4399pc.cc";

// ---- CORS 白名单 ----
const ALLOWED_ORIGINS = [
  "https://cookie.xtz1.top",
  "https://cookiew.xtz1.top"
  // 本地调试可加："http://localhost:8788", "http://127.0.0.1:5500"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
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

// ---- Cookies 字段智能提取 ----
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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // 预检
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // 路由
    if (url.pathname !== "/run" && url.pathname !== "/") {
      return json({ ok: false, error: "not found" }, 404, origin);
    }

    // 选择通道：未传或越界则随机
    let channel = parseInt(url.searchParams.get("channel") || "0", 10);
    if (!(channel >= 1 && channel <= KEYS.length)) {
      channel = Math.floor(Math.random() * KEYS.length) + 1;
    }
    const key = KEYS[channel - 1];

    try {
      // ---------- 1. 领取账号 ----------
      const claimUrl = new URL(API + "/claim_by_key");
      claimUrl.searchParams.set("key", key);

      const claimRes = await fetch(claimUrl.toString(), {
        headers: { Accept: "application/json" }
      });
      const claim = await claimRes.json();

      if (!claim || claim.code !== 1) {
        return json({
          ok: false,
          channel,
          stage: "claim",
          error: (claim && claim.msg) || "领取失败"
        }, 200, origin);
      }

      const username = claim.username || "";
      const password = claim.password || "";
      const remaining = claim.remaining ?? null;
      const quotaLimit = claim.quota_limit ?? null;
      const usedCount = claim.used_count ?? null;

      if (!username || !password) {
        return json({
          ok: false,
          channel,
          stage: "claim",
          error: "返回缺少账号或密码"
        }, 200, origin);
      }

      // ---------- 2. 转曲奇 ----------
      const convUrl = new URL(API + "/convert_cookies_by_key");
      convUrl.searchParams.set("key", key);
      convUrl.searchParams.set("username", username);
      convUrl.searchParams.set("password", password);
      convUrl.searchParams.set("use", "pc");

      const convRes = await fetch(convUrl.toString(), {
        headers: { Accept: "application/json" }
      });
      const conv = await convRes.json();

      if (!conv || conv.code !== 1) {
        return json({
          ok: false,
          channel,
          stage: "convert",
          error: (conv && conv.msg) || "转换失败",
          username,
          password,
          remaining,
          quotaLimit,
          usedCount
        }, 200, origin);
      }

      const cookies = pickCookies(conv);

      return json({
        ok: true,
        channel,
        username,
        password,
        cookies,
        remaining,
        quotaLimit,
        usedCount,
        rawConvert: cookies ? undefined : conv
      }, 200, origin);

    } catch (e) {
      return json({
        ok: false,
        channel,
        error: e.message || String(e)
      }, 200, origin);
    }
  }
};
