# 🍪 XTZ Cookie - 4399 账号提取与 Cookies 转换系统

> 一个基于 Cloudflare 全家桶（Workers + KV + Pages）构建的全栈 Web 工具。包含设备指纹识别、动态额度分配、Cloudflare Turnstile 人机验证与完整的管理后台。

## 📢 项目背景与声明
本项目最初为内部自用工具，后因上游 API 接口被封禁而停止运营。现将其全量开源，**仅供技术学习与交流（如 Cloudflare 边缘计算、防爬虫机制、Vanilla JS 开发等）**。
请勿将本项目用于任何商业或非法用途，因滥用代码导致的任何风控、封号或法律风险，由使用者自行承担。

---

## ⚠️ 极其重要的部署前置说明

本仓库默认处于**“停运状态”**。前端 HTML 页面中引入了一个名为 `停运.js` 的文件，它会强制弹出一个停运公告，**阻止任何人使用该页面**。

👉 **如果你想要部署并使用本项目，你必须执行以下操作：**
1. 在 `index.html` 和 `admin.html` 的 `<head>` 标签中，**删除或注释掉** `<script src="停运.js"></script>` 这行代码。
2. 直接**删除** `停运.js` 文件。
3. 完成上述两步后，再进行后续的部署流程。

---

## ✨ 核心特性

- **🛡️ 多维防御系统**：
  - 前端动态请求签名（防抓包伪造）
  - 蜜罐陷阱（Honeypot 隐藏字段防爬虫）
  - 无头浏览器环境检测（`navigator.webdriver`）
  - Cloudflare Turnstile 人机验证（首次绑定 & 高频请求触发）
- **📊 动态额度与风控管理**：
  - 普通用户每日 20 次基础额度。
  - VIP 动态额度机制：根据单日消耗次数自动解锁上限（最高 100 次）。
  - 怀疑值风控：高频请求自动累计怀疑值，达阈值强制人机验证。
  - 历史记录本地持久化（自动保存账号、密码及完整的 Cookies）。
- **⚙️ 完整的管理后台**：
  - 通道多密钥轮询与权重投票机制。
  - 用户状态管理（封禁/解封、重置额度、设为 VIP）。
  - 全局配置（Turnstile 密钥设置、CDK 兑换码配置）。
- **🎨 Material 3 Expressive UI**：
  - 现代且灵动的交互动画。
  - 支持深色模式及多套主题配色（紫、蓝、绿、橙）平滑切换。

## 🛠️ 技术栈

- **前端**：原生 HTML5, CSS3, Vanilla JavaScript (包含 Material 3 设计规范)
- **后端/Serverless**：Cloudflare Workers
- **数据库/缓存**：Cloudflare KV
- **验证码**：Cloudflare Turnstile API

## 🚀 部署指南 (如何复活它)

**前置条件**：确保你已经删除了 `停运.js` 及相关引用！并且你拥有有效且未被封禁的 `4399pc.cc` API Key。

### 1. 配置 Cloudflare KV
1. 登录 Cloudflare 控制台，进入 `Workers & Pages` -> `KV`。
2. 创建一个新的命名空间，名称随意（例如 `4399kv`），记录下它的 **Namespace ID**。

### 2. 部署 Worker 后端
1. 新建一个 Worker，将仓库中的 `worker/worker.js` 代码粘贴进去。
2. 在 Worker 的 **设置** -> **变量** 中，绑定 KV 命名空间：
   - 变量名称：`4399kv`
   - 命名空间：选择你刚才创建的 KV。
3. 在变量中添加环境变量（可选，用于自定义密钥）：
   - 修改代码中的 `ALLOWED_ORIGIN` 和 `SIGN_SECRET` 等配置。
4. 部署并记录下 Worker 的域名（如 `https://your-worker.workers.dev`）。

### 3. 配置 Turnstile (可选但强烈建议)
1. 在 Cloudflare 控制台左侧找到 `Turnstile` 并添加站点。
2. 获取 **Site Key** 和 **Secret Key**。

### 4. 部署前端 (Cloudflare Pages)
1. 在 Cloudflare Pages 中新建项目，选择连接到你的 GitHub 仓库。
2. 确保根目录包含修改后的 `index.html`, `app.js`, `admin.html`, `admin.js`。
3. 部署前，请务必修改 `app.js` 和 `admin.js` 中的：
   ```javascript
   const WORKER_URL = "https://你的Worker域名";
   const SIGN_SECRET = "与Worker保持一致"; // 如修改过
