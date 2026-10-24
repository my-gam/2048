# @my-games/2048-react

> 2048 游戏的 React 18 组件适配器（函数组件 + Hooks + forwardRef）。

## 安装

```bash
pnpm add @my-games/2048-react react react-dom
```

## 用法

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
      onWon={() => console.log('won')}
    />
  );
}
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
| `onMove` | `(dir, gained) => void` | — | 一次成功的滑动后触发 |
| `onWon` | `() => void` | — | 首次凑出目标值 |
| `onLost` | `() => void` | — | 无合法方向 |
| `className` | `string` | — | 追加到最外层 `<div className="game-2048">` |

## Ref 命令式方法

```tsx
import { useRef } from 'react';
import { Game2048, type Game2048Handle } from '@my-games/2048-react';

const g = useRef<Game2048Handle>(null);
// g.current?.move('left');
// g.current?.suggestMove();
// g.current?.aiMove();
```

## Hook（想自己画 UI）

```tsx
import { useGame } from '@my-games/2048-react';

function MyBoard() {
  const { state, move, suggestMove } = useGame({ size: 4 });
  return <div>{state.score}</div>;
}
```

---

完整玩法、引擎 API、设计取舍见仓库根 README：
<https://github.com/my-gam/2048#readme>

## License

MIT.
