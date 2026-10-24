# game-2048

> 2048 数字合成小游戏：跨框架 core + Vue 3 适配器 + React 18 适配器。
>
> 详细玩法、集成方式与构建产物见 README 后半部分（C6 补全）。

## 三包结构

```
game-2048/
├── packages/
│   ├── core/     @my-games/game-2048-core   纯 TS 引擎，无框架依赖
│   ├── vue/      @my-games/game-2048-vue    Vue 3 SFC，Composition API
│   └── react/    @my-games/game-2048-react  React 18 函数组件，Hooks
└── playground/   Vite 演示页，同时挂载 Vue 与 React 版本
```

`core` 是唯一的事实来源，两个适配器只做「订阅状态 + 渲染 + 输入转发」。
