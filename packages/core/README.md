# @my-games/2048-core

> 2048 游戏的引擎核心，纯 TypeScript，无框架依赖。

本包是 `game-2048` monorepo 的引擎层，`@my-games/2048-vue` 与 `@my-games/2048-react`
两个组件适配器都基于本包。**如果你要用的是 Vue 或 React，直接装对应的适配器包更省事。**

## 安装

```bash
pnpm add @my-games/2048-core
```

## 快速开始

```ts
import { Game2048 } from '@my-games/2048-core';

const game = new Game2048({ size: 4 });
const unsub = game.subscribe((state) => {
  // state = { size, tiles, score, bestScore, status, keepPlaying, moveCount, historySize }
  console.log(state.score, state.tiles.length);
});

game.move('left');
game.undo();
unsub();
```

## API 概览

- `Game2048` 类：`subscribe / getState / getGridValues / move / newGame / undo / continuePlaying / canUndo / clearSaved`
- AI：`bestMove(grid, { depth })` / `evaluate(grid, weights)` / `simulateUntilEnd(start, opts)`
- 纯函数原语：`slideGrid` / `slideLineLeft` / `canMove` / `emptyCells` / `gridsEqual` / `hasValue` / `maxValue`
- 存储：`loadSave` / `writeSave` / `loadBest` / `writeBest` / `tryGetGlobalStorage`
- 样式：`@my-games/2048-core/styles.css`（组件层用；纯逻辑场景不需要）

完整玩法、Props / Events / ref API、设计取舍见仓库根 README：
<https://github.com/my-gam/2048#readme>

## License

MIT.
