# 贡献指南 · Contributing

Thanks for your interest in improving game-2048! 感谢你对 game-2048 的关注。

**Quick links · 快捷入口**

- 在线 playground · <https://my-gam.github.io/2048/>
- npm · [@my-games/2048-core](https://www.npmjs.com/package/@my-games/2048-core) · [vue](https://www.npmjs.com/package/@my-games/2048-vue) · [react](https://www.npmjs.com/package/@my-games/2048-react)
- Bug 反馈 · <https://github.com/my-gam/2048/issues/new?labels=bug>
- 安全漏洞 · 见 [SECURITY.md](./SECURITY.md)

---

## 项目结构 · Layout

这是一个 pnpm workspace，包含三个可发布包 + 一个 playground：

```
game-2048/
├── packages/
│   ├── core/     @my-games/2048-core   纯 TS 引擎（ESM/CJS/UMD/IIFE 四格式）
│   ├── vue/      @my-games/2048-vue    Vue 3 SFC + composable
│   └── react/    @my-games/2048-react  React 18/19 组件 + hook
├── playground/   Vite SPA，三 tab：Vanilla / Vue / React
├── tools/        CI 侧脚本（pages.mjs 等）
└── .github/      Actions workflow + issue/PR 模板
```

`core` 是唯一的事实来源；`vue` 与 `react` 只是订阅引擎状态 + 桥接输入输出。想让
新玩法上到两端，先改 `core`，再让两个适配器的 `typecheck`/`build` 都过。

## 本地跑起来 · Dev environment

**前置**：Node 20.19+（Vite 8 的最低要求），pnpm 12+。

```bash
git clone https://github.com/my-gam/2048.git
cd 2048
pnpm install
pnpm dev            # 先 build 三包，再起 playground 的 vite dev server
```

只想快起点 playground（前提：`packages/*/dist` 已存在）：

```bash
pnpm dev:play
```

## 门禁 · Gates before submitting

**任何 PR 都必须本地跑通这三条**：

```bash
pnpm -r build       # 三包 vite lib 全过 + playground build
pnpm -r typecheck   # core / vue / react / playground 各自 tsc --noEmit
pnpm -r test        # core vitest（44+ 条）
```

顺序 `build → typecheck → test`：CI 是全新 checkout，vue/react 的类型解析
依赖 `@my-games/2048-core` 的 `dist/index.d.ts`；没 build 就没 dist，typecheck
会挂在 `Cannot find module '@my-games/2048-core'`。GitHub Actions 的
`publish.yml` 与 `pages.yml` 都按这个顺序，本地反过来跑容易假绿。

## 提交风格 · Commits

**每个 commit 都必须 GPG-signed**。仓库本地 `.git/config` 已配好签名 key
（`user.signingkey` + `commit.gpgsign=true`），fork 后需要：

```bash
git config --local user.signingkey <你的 16 位十六进制 key id>
git config --local commit.gpgsign true
```

Commit message 走 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
<type>(<scope>): <summary>

<body 写清决策依据与被排除场景的理由>
```

`type` 用 `feat` / `fix` / `chore` / `refactor` / `docs` / `perf` / `test`。
`scope` 通常是包名（`core` / `vue` / `react` / `playground` / `ci` / `release`）。

例：

```
feat(core): 支持 5×5 与 6×6 棋盘（AI 蛇形权重归一化）

...
```

## 代码风格 · Conventions

- **TypeScript strict**：`strict: true` + `noUncheckedIndexedAccess` +
  `noImplicitOverride` + `verbatimModuleSyntax`。写代码时优先用 `import type`。
- **纯函数优先**：`packages/core/src/board.ts` 与 `ai.ts` 全是不改输入
  的纯函数；`game.ts` 里的可变状态封闭在 `Game2048` 类里。
- **样式单点**：所有 `.game-2048-*` 类与 CSS 变量都放在
  `packages/core/src/styles.css`；适配器只 `import '@my-games/2048-core/styles.css'`，
  不在包里另写视觉规则。
- **键盘焦点**：window keydown 必须严格判 `document.activeElement === boardEl`；
  多实例并存时只有活动那个响应。
- **AI 面板 opt-in**：`enableAI` prop 默认 false；playground 通过 URL 查询串
  `?ai=1` 显式打开。任何新增的「AI 按钮」都走这条开关。

## 版本与发布 · Versioning & release

三包版本号 **lockstep**（core/vue/react 保持一致）。发布由维护者操作：

1. `packages/*/package.json` 三处 `version` 同步抬升（semver：
   - patch：仅 bug / 元数据修订
   - minor：新格式、新 prop、行为增强
   - major：破坏 API 兼容）
2. `pnpm install` 刷新 workspace lockfile
3. 本地跑三 gate 全绿
4. 一笔 `chore(release): v<X.Y.Z> …` 签名提交
5. `git tag -s v<X.Y.Z> -m 'release: …'`
6. `git push origin main v<X.Y.Z>`

推送 tag 触发 `.github/workflows/publish.yml`，CI 里：
- 门禁重跑
- tag 后缀与三包 version 强一致校验
- `pnpm pack --dry-run` 预览 tarball
- `pnpm -r publish --access public --provenance` → 通过 npm Trusted Publishing
  (OIDC) 无 secret 上传

**main 分支的 push**（含本文档改动）会触发 `.github/workflows/pages.yml`，
自动重建 playground 并 deploy 到 <https://my-gam.github.io/2048/>。
`playground/**` `packages/**` `tools/pages.mjs` `pnpm-lock.yaml` `package.json`
之外路径不触发。

## 提 PR · Submitting

- 从 `main` 拉分支 `feat/<short-name>` / `fix/<issue-number>-<short>`
- 用 [PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md) 里的问题清单
- PR 里说明「为什么这样改」+ 你跑过的门禁输出或截图
- Maintainer 会 review；merge 采用 squash（`delete_branch_on_merge=true`）

## 报告问题 · Issues

优先用 issue template（bug / feature）。贴：
- 复现步骤（可运行的最简 sandbox / StackBlitz 更好）
- 期望 vs 实际
- 环境（浏览器 / Node / pnpm / OS）

## 许可 · License

By contributing you agree your contributions are licensed under the project's
MIT license. 贡献即视为同意以 MIT 许可发布。
