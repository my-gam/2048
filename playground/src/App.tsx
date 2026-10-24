import { useCallback, useEffect, useRef, useState } from 'react';
import { Game2048 as Game2048React, type Game2048Handle as ReactHandle } from '@my-games/game-2048-react';
import type { Game2048Instance as VueHandle } from '@my-games/game-2048-vue';
import type { Direction } from '@my-games/game-2048-core';
import { VuePanel } from './VuePanel';

/**
 * Playground：Vue 版与 React 版并排展示。
 *
 * AI 面板走「特殊开启」：
 * - URL 加 `?ai=1` 才在两个组件上打开 enableAI prop（默认关），
 *   并额外渲染一个「AI 自动玩」的小控制台。
 * - 不加参数时，AI 只以命令式 API 存在（组件 ref 上的 suggestMove / aiMove），
 *   UI 上看不到按钮 —— 契合需求里「AI 帮走按钮需要特殊开启，或者只提供 API」。
 */

type LogEntry = {
  id: number;
  framework: 'vue' | 'react';
  kind: 'move' | 'won' | 'lost' | 'info';
  text: string;
};

function useAIEnabled(): boolean {
  const [enabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.get('ai') === '1' || p.get('ai') === 'true';
  });
  return enabled;
}

export function App() {
  const aiEnabled = useAIEnabled();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    logIdRef.current += 1;
    const next: LogEntry = { id: logIdRef.current, ...entry };
    setLogs((prev) => [next, ...prev].slice(0, 120));
  }, []);

  const vueRef = useRef<VueHandle | null>(null);
  const reactRef = useRef<ReactHandle | null>(null);
  const [autoplay, setAutoplay] = useState<'vue' | 'react' | null>(null);
  const [tick, setTick] = useState(0);

  // 自动玩：给选中的实例每 220ms 走一步，直到 no-op（游戏结束）
  useEffect(() => {
    if (!autoplay) return;
    const handle = autoplay === 'vue' ? vueRef.current : reactRef.current;
    if (!handle) return;
    const dir = handle.aiMove();
    if (!dir) {
      pushLog({ framework: autoplay, kind: 'info', text: 'AI 停止：无合法方向' });
      setAutoplay(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, autoplay]);

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 220);
    return () => window.clearInterval(id);
  }, [autoplay]);

  const askVueAI = () => {
    const dir = vueRef.current?.suggestMove() ?? null;
    pushLog({ framework: 'vue', kind: 'info', text: `建议：${dir ?? '无合法方向'}` });
  };
  const askReactAI = () => {
    const dir = reactRef.current?.suggestMove() ?? null;
    pushLog({ framework: 'react', kind: 'info', text: `建议：${dir ?? '无合法方向'}` });
  };

  const onVueMove = useCallback(
    (dir: Direction, gained: number) => {
      pushLog({
        framework: 'vue',
        kind: 'move',
        text: `${dir}${gained ? ` +${gained}` : ''}`
      });
    },
    [pushLog]
  );
  const onReactMove = useCallback(
    (dir: Direction, gained: number) => {
      pushLog({
        framework: 'react',
        kind: 'move',
        text: `${dir}${gained ? ` +${gained}` : ''}`
      });
    },
    [pushLog]
  );

  return (
    <div className="pg-shell">
      <header className="pg-header">
        <h1>game-2048 · Playground</h1>
        <p>
          一个 2048 游戏核心，两个官方适配器：<code>@my-games/game-2048-vue</code>（Vue 3 组件）
          与 <code>@my-games/game-2048-react</code>（React 18 组件）。两包共享
          <code> @my-games/game-2048-core</code> 引擎与样式表。
        </p>
        <div className="pg-badges">
          <span className="pg-badge">core · 纯 TS · 无框架依赖</span>
          <span className="pg-badge">Vue 3 Composition API</span>
          <span className="pg-badge">React 18 Hooks</span>
          <span className="pg-badge">expectimax AI</span>
          <span className="pg-badge">localStorage 存档 · 撤销</span>
          <span className="pg-badge">键盘 / 触屏 / 动画</span>
        </div>
      </header>

      {!aiEnabled ? (
        <div className="pg-hint">
          AI 能力默认以 API 形式提供（<code>ref.suggestMove()</code> /
          <code> ref.aiMove()</code>），界面上没有按钮。想看到「提示」/「AI 帮走」按钮，
          在 URL 后加 <code>?ai=1</code> 刷新即可。
        </div>
      ) : (
        <div className="pg-ai-panel">
          <h3>AI 控制面板（?ai=1 已开启）</h3>
          <div className="status">
            当前：{autoplay ? `自动玩 ${autoplay.toUpperCase()} 版` : '手动'}
          </div>
          <div className="pg-actions">
            <button
              className="pg-btn"
              type="button"
              onClick={askVueAI}
            >
              问 Vue 版 AI 建议
            </button>
            <button
              className="pg-btn"
              type="button"
              onClick={askReactAI}
            >
              问 React 版 AI 建议
            </button>
            <button
              className="pg-btn"
              type="button"
              onClick={() => setAutoplay(autoplay === 'vue' ? null : 'vue')}
            >
              {autoplay === 'vue' ? '停止 Vue 自动玩' : '让 AI 自动玩 Vue 版'}
            </button>
            <button
              className="pg-btn"
              type="button"
              onClick={() => setAutoplay(autoplay === 'react' ? null : 'react')}
            >
              {autoplay === 'react' ? '停止 React 自动玩' : '让 AI 自动玩 React 版'}
            </button>
          </div>
        </div>
      )}

      <section className="pg-grid is-2col">
        <div className="pg-panel">
          <div className="pg-panel-head">
            <h2>Vue 3</h2>
            <span className="pg-tag pg-tag-vue">Game2048 from @my-games/game-2048-vue</span>
          </div>
          <p className="pg-panel-desc">
            单文件 <code>Game2048.vue</code> + <code>useGame()</code> composable；
            键盘焦点靠 <code>boardEl.focus()</code>，触摸 swipe 走原生 <code>touchstart/touchend</code>。
          </p>
          <VuePanel
            saveKey="g2048-vue:save"
            bestKey="g2048-vue:best"
            autofocus={false}
            enableAI={aiEnabled}
            onInstance={(v) => (vueRef.current = v)}
            onMove={onVueMove}
            onWon={() => pushLog({ framework: 'vue', kind: 'won', text: '达到 2048' })}
            onLost={() => pushLog({ framework: 'vue', kind: 'lost', text: '无可走方向' })}
          />
        </div>

        <div className="pg-panel">
          <div className="pg-panel-head">
            <h2>React 18</h2>
            <span className="pg-tag pg-tag-react">Game2048 from @my-games/game-2048-react</span>
          </div>
          <p className="pg-panel-desc">
            函数组件 + <code>useGame()</code> hook；<code>forwardRef</code> +
            <code> useImperativeHandle</code> 暴露 suggestMove / aiMove。样式与
            动画完全复用 core 的 <code>styles.css</code>。
          </p>
          <Game2048React
            ref={reactRef}
            saveKey="g2048-react:save"
            bestKey="g2048-react:best"
            autofocus={false}
            enableAI={aiEnabled}
            onMove={onReactMove}
            onWon={() => pushLog({ framework: 'react', kind: 'won', text: '达到 2048' })}
            onLost={() => pushLog({ framework: 'react', kind: 'lost', text: '无可走方向' })}
          />
        </div>
      </section>

      <section>
        <div className="pg-panel-head">
          <h2 style={{ fontSize: 16 }}>事件日志（最新在前）</h2>
          <button className="pg-btn" type="button" onClick={() => setLogs([])}>
            清空
          </button>
        </div>
        <div className="pg-log">
          {logs.length === 0 ? (
            <div className="row empty">还没有事件——点一个棋盘滑动一下试试。想立刻玩：点击棋盘让它拿到焦点，方向键即可生效。</div>
          ) : (
            logs.map((l) => (
              <span key={l.id} className="row">
                [{l.framework}] {l.kind === 'move' ? '走' : l.kind === 'won' ? '胜' : l.kind === 'lost' ? '负' : '信息'}：{l.text}
              </span>
            ))
          )}
        </div>
      </section>

      <footer className="pg-footer">
        <p>
          存档分别落在 <code>localStorage</code> 的 <code>g2048-vue:save</code> /
          <code> g2048-react:save</code> 与对应 best 键；点「新游戏」或调 <code>clearSaved()</code> 清档。
        </p>
        <p>
          键盘：棋盘点击后获取焦点，方向键或 WASD。触屏：单指快速滑动。撤销栈 20 步，AI 搜索深度 3。
        </p>
      </footer>
    </div>
  );
}
