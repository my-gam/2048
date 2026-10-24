# game-2048

一个 2048 数字合成小游戏。核心引擎不依赖任何框架，Vue 3 与 React 18 各有一份官方适配器；
两端共享同一份样式表与动画语义，行为完全一致。

- **包结构**：`packages/core` + `packages/vue` + `packages/react`，pnpm workspace 管理，
  `playground/` 是同时挂两种框架的演示页。
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

打开后页面里同时出现两个 2048 棋盘（Vue / React），各自持有独立的存档键
`g2048-vue:save` 与 `g2048-react:save`，互不覆盖。想调试 AI：
```
http://127.0.0.1:5173/?ai=1
```

其他常用命令：

```bash
pnpm build      # 三包各自产 dist（core/vue/react）
pnpm test       # 跑 core 单元测试
pnpm typecheck  # 三包 + playground 全量类型检查
```

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

组件样式已经通过 `import '@my-games/2048-core/styles.css'` 内嵌到 SFC，
不用额外引 CSS。想完全脱离组件用引擎自己画 UI：

```ts
import { Game2048 } from '@my-games/2048-core';
const g = new Game2048({ size: 4 });
const unsub = g.subscribe((state) => render(state));
g.move('left');
```

### React 18

```bash
pnpm add @my-games/2048-react react react-dom
```

```tsx
import { Game2048 } from '@my-games/2048-react';

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
│   ├── core/          @my-games/2048-core   纯 TS 引擎
│   │   ├── src/{types,board,game,ai,storage,index}.ts
│   │   ├── src/styles.css                       单份视觉，Vue/React 共享
│   │   └── test/{board,game,ai}.test.ts         44 单测
│   ├── vue/           @my-games/2048-vue   Vue 3 SFC + composable
│   │   └── src/{Game2048.vue,useGame.ts,index.ts,instance.ts}
│   └── react/         @my-games/2048-react React 18 组件 + hook
│       └── src/{Game2048.tsx,useGame.ts,index.ts}
├── playground/        Vite 演示页（双框架并排）
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

## 构建产物

| 位置 | 内容 |
| --- | --- |
| `packages/core/dist/` | tsc 直出 ESM + d.ts + sourcemap |
| `packages/vue/dist/` | vite lib 模式 ESM bundle + style.css + sourcemap |
| `packages/react/dist/` | tsc 直出 ESM + d.ts + sourcemap |
| `playground/dist/` | vite build 静态资源（部署 QW Pages 可直接指到这里） |

`dist/` 已在 `.gitignore` 里；`pnpm build` 会重新生成。

## 设计取舍

- **样式单点**：CSS 只放一份在 `core/src/styles.css`，两包都 `import '@my-games/2048-core/styles.css'`。
  好处是视觉一致；代价是 core 不再「纯逻辑」，接受这个耦合。
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
