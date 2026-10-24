import { useEffect, useRef } from 'react';
import { createApp, h } from 'vue';
import { Game2048 as Game2048Vue, type Game2048Instance } from '@my-games/game-2048-vue';
import type { Direction } from '@my-games/game-2048-core';

/**
 * 在 React playground 里挂一个 Vue 组件。Vite 同时启 plugin-vue 与 plugin-react，
 * .vue 单文件被 plugin-vue 编译，再由 createApp(...).mount(el) 手动挂进
 * 由 React 分配的一个容器 div 里。两框架互不干涉。
 *
 * 生命周期：任一 prop 变化就 unmount + 重新 mount（playground 里代价可忽略）。
 * 事件回调用 ref 承载，让 mount 只依赖真实引擎参数、避免每次回调刷新都重建 app。
 */
export interface VuePanelProps {
  saveKey?: string;
  bestKey?: string;
  autofocus?: boolean;
  enableAI?: boolean;
  size?: 3 | 4 | 5 | 6;
  freshStart?: boolean;
  onMove?: (dir: Direction, gained: number) => void;
  onWon?: () => void;
  onLost?: () => void;
  onInstance?: (instance: Game2048Instance | null) => void;
}

export function VuePanel(props: VuePanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(props);
  cbRef.current = props;

  const { saveKey, bestKey, autofocus, enableAI, size, freshStart } = props;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const app = createApp({
      setup() {
        return () =>
          h(Game2048Vue, {
            saveKey,
            bestKey,
            size,
            freshStart,
            autofocus: autofocus ?? false,
            enableAI: enableAI ?? false,
            ref: (vm: unknown) => cbRef.current.onInstance?.((vm as Game2048Instance) ?? null),
            onMove: (dir: Direction, gained: number) => cbRef.current.onMove?.(dir, gained),
            onWon: () => cbRef.current.onWon?.(),
            onLost: () => cbRef.current.onLost?.()
          });
      }
    });
    app.mount(el);
    return () => app.unmount();
  }, [saveKey, bestKey, size, freshStart, autofocus, enableAI]);

  return <div ref={hostRef} />;
}
