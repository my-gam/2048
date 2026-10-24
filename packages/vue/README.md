# @my-games/2048-vue

> 2048 游戏的 Vue 3 组件适配器（Composition API + SFC）。

## 安装

```bash
pnpm add @my-games/2048-vue vue
```

## 用法

```vue
<script setup lang="ts">
import { Game2048 } from '@my-games/2048-vue';

function onMove(dir, gained) {
  console.log(dir, gained);
}
</script>

<template>
  <Game2048
    :size="4"
    save-key="my-app:2048:save"
    best-key="my-app:2048:best"
    :enable-ai="false"
    @move="onMove"
  />
</template>
```

组件样式已经内嵌（`import '@my-games/2048-core/styles.css'`），不用额外引 CSS。

## Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `size` | `3 \| 4 \| 5 \| 6` | `4` | 棋盘边长 |
| `storage` | `SaveStorage \| null` | `localStorage` | 传 `null` 关闭持久化（SSR） |
| `saveKey` | `string` | `game-2048:save` | 存档键，多实例分开 |
| `bestKey` | `string` | `game-2048:best` | 最高分独立键 |
| `freshStart` | `boolean` | `false` | 忽略已有存档开新局 |
| `autofocus` | `boolean` | `true` | mount 后自动 focus 让键盘立刻可用 |
| `enableAI` | `boolean` | `false` | 是否渲染 AI 按钮（API 一直可用） |
| `aiDepth` | `number` | `3` | expectimax 搜索深度 |
| `title` | `string` | `'2048'` | 传空串隐藏 header |

## 事件

`move(dir, gained)` / `won()` / `lost()`

## Ref 命令式方法

`<script setup>` 里 `const g = ref<Game2048Instance>();` 后：

- `g.value?.move(dir)`
- `g.value?.newGame()` / `undo()` / `continuePlaying()`
- `g.value?.suggestMove(): Direction | null` — 只查询建议
- `g.value?.aiMove(): Direction | null` — 让 AI 走一步

## Composable（想自己画 UI）

```ts
import { useGame } from '@my-games/2048-vue';

const { state, move, suggestMove } = useGame({ size: 4 });
```

`state` 是 `ShallowRef<GameState>`，模板里 auto-unwrap 直接用。

---

完整玩法、引擎 API、设计取舍见仓库根 README：
<https://github.com/my-gam/2048#readme>

## License

MIT.
