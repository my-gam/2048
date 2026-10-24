# game-2048

一个 2048 数字合成小游戏。核心引擎不依赖任何框架，产出 **ESM / CJS / UMD / IIFE 四种格式**；
Vue 3 与 React 18/19 各有一份官方适配器，两端共享同一份样式表与动画语义，行为完全一致。

- **技术栈**：TypeScript 7（Go-native tsgo）· Vite 8（Rolldown bundler）·
  Vue 3.5 · React 19（peerDep 兼容 18.2+）· Vitest 5
- **包结构**：`packages/core` + `packages/vue` + `packages/react`，pnpm workspace 管理，
  `playground/` 是三 tab 演示页（Vanilla / Vue / React）。
- **纯 TS**：全项目 `strict: true` + `noUncheckedIndexedAccess`；core 单元测试 44 条，
  覆盖滑动、合并、撤销、存档、AI、边界与错误隔离。
- **零框架耦合的引擎**：`Game2048` 类暴露 `subscribe(fn)` 推快照，UI 层拿什么框架
  都能桥接。Tile 有跨帧稳定的 `id`，动画 diff 直接可用。
- **AI 求解**：expectimax + 蛇形权重，depth=3 单步 <10ms。默认只提供 API（
  `suggestMove()` / `aiMove()`），playground 里通过 `?ai=1` 打开面板。
- **移动端 H5**：viewport 已禁双指缩放；单指 swipe 走原生 touch 事件；
  CSS 全部 `clamp()` 自适应。

## 本地跑起来

```bash
cd E:/web/my-games/game-2048
pnpm install
pnpm dev        # 起 Vite，默认 http://127.0.0.1:5173
```

打开后是三个 tab 的 playground：
- **Vanilla** — 直接消费 `@my-games/2048-core`，无框架、手工画 DOM（默认打开）
- **Vue 3** — `@my-games/2048-vue` 组件
- **React 18/19** — `@my-games/2048-react` 组件

三个 tab 各自持独立存档键 `g2048-<tab>:save`，切来切去不打断对局。
可分享链接：
- `?demo=vanilla|vue|react` 直接进某个 tab
- `?ai=1` 打开 AI 面板 + 每 tab 里的「提示」/「AI 帮走」按钮

其他常用命令：

```bash
pnpm build       # 三包 vite lib build → dist（core 四格式；vue/react ESM+CSS+DTS）
pnpm test        # 跑 core 单元测试（44 条）
pnpm typecheck   # 三包 + playground 全量类型检查（纯 tsc，不依赖 vue-tsc）
node tools/pages.mjs   # 本地跑一遍 GitHub Pages 构建 + 零断链自检
```

## 在线 demo

**<https://my-gam.github.io/2048/>** — 由 `.github/workflows/pages.yml` 从 `main` 分支
自动构建并 deploy；每次 `pnpm playground/**`、`packages/**`、`tools/pages.mjs`
或 lockfile 变化都触发重建。

## 玩法

- 键盘：方向键 ↑↓←→ 或 WASD。棋盘必须**先拿到焦点**（点一下棋盘），
  多实例并存时只有活动的那个响应键盘，另一个不受影响。
- 触屏：单指快速滑动（≥24px 触发），主导轴决定方向。
- 目标：合并相同数字，凑出 2048 及以上。第一次达到 2048 弹胜利提示，
  可继续游戏；无合法方向时判负。
- 工具栏：撤销（栈深 20）/ 新游戏。开启 AI 时多「提示」与「AI 帮走」按钮。

## 集成到你的项目

### Vue 3

```bash
pnpm add @my-games/2048-vue vue
```

```vue
<script setup lang="ts">
import { Game2048 } from '@my-games/2048-vue';
import '@my-games/2048-vue/style.css';

function onMove(dir: string, gained: number) {
  console.log(dir, gained);
}
function onWon() { console.log('won'); }
function onLost() { console.log('lost'); }
</script>

<template>
  <Game2048
    :size="4"
    save-key="my-app:2048:save"
    best-key="my-app:2048:best"
    :enable-ai="false"
    @move="onMove"
    @won="onWon"
    @lost="onLost"
  />
</template>
```

**样式必须显式引入**：Vite 8 lib 模式把组件内 CSS 抽到 `dist/index.css`，
JS bundle 里不再有 `import 'foo.css'`。消费者在自己的入口加一次
`import '@my-games/2048-vue/style.css'`（或从 core 引 `import '@my-games/2048-core/styles.css'`，
两者内容一致）。

### 浏览器直接引入（IIFE / UMD，无需 bundler）

core 除了 ESM/CJS，还产出 `dist/index.iife.js` 与 `dist/index.umd.js`，
全局变量名 **`Game2048Core`**——`<script src>` 直接引就能玩：

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="https://unpkg.com/@my-games/2048-core@0.3.0/src/styles.css" />
  </head>
  <body>
    <div id="app" class="game-2048">
      <div class="game-2048-board" style="--cols: 4" tabindex="0">
        <div class="game-2048-grid"></div>
        <div class="game-2048-tile-layer"></div>
      </div>
    </div>
    <script src="https://unpkg.com/@my-games/2048-core@0.3.0/dist/index.iife.js"></script>
    <script>
      const { Game2048, bestMove } = Game2048Core;
      const game = new Game2048({ size: 4 });
      game.subscribe((state) => {
        const layer = document.querySelector('.game-2048-tile-layer');
        layer.innerHTML = '';
        for (const t of state.tiles) {
          const el = document.createElement('div');
          el.className = 'game-2048-tile' + (t.isNew ? ' is-new' : '') + (t.merged ? ' is-merged' : '');
          el.style.setProperty('--row', t.row);
          el.style.setProperty('--col', t.col);
          el.setAttribute('data-value', t.value);
          el.textContent = t.value;
          layer.appendChild(el);
        }
      });
      // 键盘 / 触摸按你自己的方式绑定；参考 playground 的 Vanilla tab
      addEventListener('keydown', (ev) => {
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        const dir = map[ev.key];
        if (dir) game.move(dir);
      });
    </script>
  </body>
</html>
```

`bestMove(game.getGridValues(), { depth: 3 })` 可用来做 AI 提示；`simulateUntilEnd`
能整个交给 AI 自动跑，用来做基准或彩蛋。

**UMD vs IIFE 差别**：UMD 优先检测 `module.exports` 与 AMD `define.amd`，
都不在才回落到全局；IIFE 直接一个 `var Game2048Core = ...`。浏览器 script 标签
引哪个都行，只是 RequireJS 项目用 UMD 更规范。

### Node.js（CJS / ESM 双入口）

```ts
// ESM
import { Game2048, bestMove } from '@my-games/2048-core';
```
```js
// CJS
const { Game2048, bestMove } = require('@my-games/2048-core');
```

```ts
import { Game2048 } from '@my-games/2048-core';
const g = new Game2048({ size: 4 });
const unsub = g.subscribe((state) => render(state));
g.move('left');
```

### React 18 / 19

```bash
pnpm add @my-games/2048-react react react-dom
```

```tsx
import { Game2048 } from '@my-games/2048-react';
import '@my-games/2048-react/style.css';

export function Demo() {
  return (
    <Game2048
      size={4}
      saveKey="my-app:2048:save"
      bestKey="my-app:2048:best"
      enableAI={false}
      onMove={(dir, gained) => console.log(dir, gained)}
      onWon={() => alert('won')}
    />
  );
}
```

组件也 `forwardRef`，父级可用命令式 API：

```tsx
const ref = useRef<Game2048Handle>(null);
ref.current?.suggestMove(); // 'left' | null
ref.current?.aiMove();      // 让 AI 走一步
```

## Props / 事件 / 暴露 API（两端对齐）

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `size` | `3 \| 4 \| 5 \| 6` | `4` | 棋盘边长 |
| `storage` | `SaveStorage \| null` | `localStorage` | 传 `null` 关闭持久化；SSR 环境也传 `null` |
| `saveKey` | `string` | `game-2048:save` | 存档键（多实例务必分开） |
| `bestKey` | `string` | `game-2048:best` | 最高分独立键；`newGame` 不重置它 |
| `freshStart` | `boolean` | `false` | 构造时忽略已有存档开新局 |
| `autofocus` | `boolean` | `true` | mount 后自动 focus 棋盘；多实例并存时把非主要那台关掉 |
| `enableAI` | `boolean` | `false` | 是否渲染 AI 按钮（API 一直可用） |
| `aiDepth` | `number` | `3` | expectimax 搜索深度 |
| `title` | `string` | `'2048'` | 传空串隐藏 header |

事件（Vue `@` 语法 / React `onXxx`）：

- `move(dir, gained)`：一次成功的滑动之后触发，`gained` 是本次合并得分。
- `won()`：第一次凑出 `size` 对应的目标值（默认 2048）。
- `lost()`：无合法方向。

`ref` 命令式方法（两端一致）：

- `move(dir)` / `newGame()` / `undo()` / `continuePlaying()`
- `suggestMove(): Direction | null` — 只查询建议，不走子
- `aiMove(): Direction | null` — 让 AI 走一步（内部触发引擎 move，会推订阅）

## 引擎核心 API（`@my-games/2048-core`）

- `new Game2048(options?)` — 完整可注入：`size` / `rng` / `storage` / `saveKey` / `bestKey` /
  `target` / `undoLimit` / `freshStart`
- `game.subscribe(fn): () => void` — 注册即收到一次快照，返回退订函数
- `game.getState()` — 拉一份 `GameState` 深拷贝
- `game.getGridValues()` — 拿 `Cell[][]` 值网格（AI / 单测用）
- `game.move(dir) / newGame() / undo() / continuePlaying() / canUndo() / clearSaved()`
- 纯函数：`slideGrid` / `canMove` / `emptyCells` / `gridsEqual` / `hasValue` / `maxValue`
- AI：`bestMove(grid, { depth })` / `evaluate(grid, weights)` / `simulateUntilEnd(start, opts)`
- 存储：`loadSave` / `writeSave` / `loadBest` / `writeBest` / `tryGetGlobalStorage`

存档字段版本化（当前 `version: 1`）。损坏 JSON 与 size 不匹配自动回落到新局。

## 动画与视觉

- 新块：`@keyframes spawn`（scale 0.3→1 + opacity）
- 合并：`@keyframes pop`（scale 1→1.18→1）
- 滑动：`transition: transform 120ms ease-in-out`
- 分数增量：`+N` 浮标 700ms 上飘
- prefers-reduced-motion 下自动降级：所有 transition/animation 关闭，位置仍正确

Tile 位置靠 CSS 变量 `--row` / `--col` + `calc()` 完成，无需 JS 测像素。
棋盘尺寸由 `min(90vw, 520px)` 决定，`--gap` 与 `--radius` 用 `clamp()` 缩放。

## 目录结构

```
game-2048/
├── packages/
│   ├── core/          @my-games/2048-core   纯 TS 引擎（vite lib · ESM+CJS+UMD+IIFE）
│   │   ├── src/{types,board,game,ai,storage,index}.ts
│   │   ├── src/styles.css                       单份视觉，Vue/React 共享
│   │   ├── vite.config.ts
│   │   └── test/{board,game,ai}.test.ts         44 单测
│   ├── vue/           @my-games/2048-vue   Vue 3 SFC + composable
│   │   ├── src/{Game2048.vue,useGame.ts,index.ts,instance.ts}
│   │   ├── vite.config.ts                       plugin-vue + vite-plugin-dts
│   │   └── env.d.ts                             *.vue / *.css ambient 声明
│   └── react/         @my-games/2048-react React 18/19 组件 + hook
│       ├── src/{Game2048.tsx,useGame.ts,index.ts}
│       └── vite.config.ts                       plugin-react + vite-plugin-dts
├── playground/        Vite 演示页（Vanilla / Vue / React 三 tab）
│   └── src/{main.tsx,App.tsx,VuePanel.tsx,VanillaDemo.tsx,...}
├── tools/
│   └── pages.mjs      GitHub Pages 构建脚本（内存覆盖 base + 零断链自检）
├── .github/workflows/
│   ├── publish.yml    推 v* tag → 门禁 → Trusted Publishing 发三包到 npm
│   └── pages.yml      main push → 构建 → deploy 到 my-gam.github.io/2048/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

## 构建产物

三包统一走 `vite build --mode lib`：

| 位置 | 内容 |
| --- | --- |
| `packages/core/dist/` | `index.js`（ESM）· `index.cjs`（CJS）· `index.umd.js` · `index.iife.js` · `index.d.ts` · 各自 sourcemap |
| `packages/vue/dist/` | `index.js`（ESM 单文件）+ `index.d.ts` + `index.css` + sourcemap |
| `packages/react/dist/` | 同上 |
| `playground/dist/` | `pnpm --filter playground build` 静态资源（base=`/`，本地预览用） |
| `pages-dist/` | `node tools/pages.mjs` 输出（base=`/2048/`，GitHub Pages 用） |

- **CSS 需要显式引入**：Vite 8 lib 模式把组件内 `import 'x.css'` 抽到
  `dist/index.css`，JS bundle 里不再引用 CSS。消费者在自己的入口加一次
  `import '@my-games/2048-vue/style.css'` 或 `import '@my-games/2048-react/style.css'`；
  直接引 `@my-games/2048-core/styles.css` 也一样（内容一致）。
- **类型来源**：`.d.ts` 由 `vite-plugin-dts` 从 `.ts` / `.vue` 源码提取并 rollup；
  Vue 包额外依赖 `@vue/language-core` 让 SFC 类型可解。
- **IIFE 全局名 `Game2048Core`**：`window.Game2048Core` 上挂 23 个导出（`Game2048`
  类 + `bestMove` + 存储工具 + 纯函数原语），完全等同 ESM 版。
- `dist/` 与 `pages-dist/` 都在 `.gitignore` 里；`pnpm build` / `node tools/pages.mjs`
  重新生成。

## 发布流程

**npm 三包**：推 `v*` tag 触发 `.github/workflows/publish.yml`：
门禁（`pnpm build` → `pnpm typecheck` → `pnpm test` → tag/version 一致性校验 →
`pnpm pack --dry-run` 预览）→ `pnpm -r publish --access public --provenance`
（npm Trusted Publishing / OIDC，零 secret、免 OTP）。
在 npmjs.com 上需要为 `@my-games` org 配置 Trusted Publisher 指向 `my-gam/2048` +
该 workflow 路径 + environment `npm`；GitHub 仓库 Settings → Environments 也要建同名
环境。首次可信发布得先手动种一个 `0.0.0-stage`（Trusted Publishing 无法发第一版）。

**GitHub Pages**：`main` 分支 push 里 `playground/**` / `packages/**` /
`tools/pages.mjs` / `pnpm-lock.yaml` 变化触发 `.github/workflows/pages.yml`，
跑 `pnpm build` 建 dist → `node tools/pages.mjs` 用 vite 的 build API 在内存里
覆盖 `base=/2048/` 输出 `pages-dist/` → 内置零断链自检（所有绝对路径必须以
`/2048/` 开头且文件真实存在）→ `actions/upload-pages-artifact` +
`actions/deploy-pages`。最终 URL **<https://my-gam.github.io/2048/>**。

## 设计取舍

- **样式单点**：CSS 源只放一份在 `core/src/styles.css`，两包 `import` 后被 vite
  各自抽到自己的 `dist/index.css`（内容一致但字节相同）。好处是视觉一致；
  代价是 vue/react 包里各存了一份样式，且消费者要显式引 CSS。
- **Vue 包不跑 vue-tsc**：TS 7 的 JS API 变化让 vue-tsc 3.3.13 直接崩，上游
  issue #6156 说要等 TS 7.1 插件 API。改用「纯 `tsc --noEmit` 只查 `.ts` 源 +
  `vite-plugin-dts` 从 `.vue` 提取 `.d.ts`」的组合，代价是模板内绑定表达式不再
  做类型检查（`t.isNew` 之类的字段错在构建期发现不了，运行时才炸）。
  未来 vue-tsc 4.x 出来时把 `typecheck` 脚本切回 `vue-tsc` 即可。
- **dts 依赖 `@typescript/typescript6`**：vite-plugin-dts / unplugin-dts 内部调
  老版 TypeScript JS API，TS 7 已经把 API 表面挪到 Go 侧不再暴露同份 JS；
  官方兜底是在 devDeps 装 `@typescript/typescript6`，dts 生成层用 6.0.2 的
  编译器 JS API，其余项目代码走 TS 7 的 `tsc` 命令行。
- **键盘焦点模型**：window keydown 但严格判 `document.activeElement === boardEl`。
  多实例并存时不会出现两个棋盘同时响应同一按键的错乱。
- **AI 默认隐藏**：`suggestMove` / `aiMove` 一直在 API 上，UI 层默认不给按钮。
  playground 通过 `?ai=1` 显式解锁，避免正常玩家误触。
- **撤销栈有上限**：默认 20 步，避免长时间玩下去内存线性增长。要改传 `undoLimit`。
- **存档版本化**：`version: 1`，字段演进时读旧存档会走 `isSerializedSave` 类型守卫失败，
  自动回落开新局；不会崩，也不会误吃新字段。

## 已知边界

- 尺寸 3 / 5 / 6 时 AI 的 `buildWeights` 走「蛇形归一化」近似，比 4×4 的
  `SNAKE_WEIGHTS_4` 稍弱；主要给扩展玩法用。
- expectimax 在 6×6 depth≥4 时会明显卡顿；UI 若开启大棋盘自动玩，
  建议把 `aiDepth` 压到 2 或放进 Web Worker。
- 存档字段里没有 undo 历史栈；刷新页面后「撤销」不可用（合理：跨会话撤销意义有限）。

## 许可

MIT。字体 / 图标未使用外部素材，视觉全部走 CSS 与系统字体。
