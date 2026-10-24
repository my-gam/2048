# 安全策略 · Security Policy

## 报告漏洞 · Reporting a Vulnerability

**请不要在公开 issue 里贴可利用的安全漏洞细节。**

本项目通过 GitHub Security Advisories 私密追踪：

1. 打开 <https://github.com/my-gam/2048/security/advisories/new>
2. 标题一句话说明漏洞类型（如 "Prototype pollution via `deserializeSave`")
3. 描述里给出：受影响版本、复现步骤、可能的影响面、你建议的修复方向（可选）
4. 提交后 maintainers 会在 **72 小时内**回应

如果 GitHub Private Vulnerability Reporting 未开启或你不方便用 GitHub 账号，
可以发信到 npm 主页上 `xyj2156` 用户绑定的邮箱（主题前缀 `[2048-sec]`）。

## 支持版本 · Supported Versions

| Version | 支持 |
| ------- | ---- |
| `0.3.x` | ✅ 当前活跃发布线 |
| `< 0.3` | ⚠️ 不再主动跟进；发现漏洞会评估是否 backport |

## 已知的信任边界 · Trust boundaries

game-2048 是一个纯前端 / 无网络的休闲游戏。当前设计里的信任假设：

- **`storage` 完全由宿主提供**：`localStorage` 里的存档内容会经 `isSerializedSave`
  守卫反序列化；不合法 JSON / 版本不匹配会静默丢弃并开新局。宿主如果注入自定义
  `SaveStorage` 实现，其安全性由宿主负责。
- **`rng` 可注入**：`Game2048` 允许注入伪随机源。生产默认是 `Math.random`；
  不要把本库当成密码学 PRNG。
- **无用户输入解析**：本库不解析外部字符串（除 localStorage 里自己写的存档
  JSON 外）；`size` / `saveKey` 等 prop 假定由开发者传入的可信常量。
- **IIFE / UMD 全局**：浏览器 script 标签引入时挂 `window.Game2048Core`。如果
  宿主环境允许第三方 script 覆盖 `globalThis`，请自行做 SRI hash 或 CSP。
- **无网络请求**：库本身不发任何 HTTP / WebSocket。所有 CDN 引入
  （unpkg / jsdelivr）由宿主 HTML 决定。

## 政策 · Policy

- 修复窗口：严重 / 高危 ≤ 7 天，中 ≤ 14 天，低 ≤ 30 天
- 会发布带 CVE 的 GHSA，并同步 `npm deprecate` 受影响版本
- 感谢贡献者时默认匿名；如需 credit 请在报告里明说

Thanks for helping keep game-2048 and its users safe.
