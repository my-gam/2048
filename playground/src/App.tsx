import { useCallback, useEffect, useRef, useState } from 'react';
import { Game2048 as Game2048React, type Game2048Handle as ReactHandle } from '@my-games/2048-react';
import type { Game2048Instance as VueHandle } from '@my-games/2048-vue';
import type { Direction } from '@my-games/2048-core';
import { VuePanel } from './VuePanel';
import { VanillaDemo } from './VanillaDemo';

/**
 * Playground —— 三个 tab：
 *  - Vanilla：直接消费 `@my-games/2048-core`，无 Vue/React，手工画 DOM
 *  - Vue 3：`@my-games/2048-vue` 组件
 *  - React 18/19：`@my-games/2048-react` 组件
 *
 * URL 查询：
 *  - `?demo=vanilla|vue|react`  默认 vanilla
 *  - `?ai=1`                    打开 enableAI prop（每个 tab 里各出「提示」/「AI 帮走」按钮）
 *
 * 三个 tab 各自独立的 localStorage key（`g2048-<tab>:save` / `best`），
 * 切来切去不打断进行中的对局，也不互相覆盖最高分。
 */

type Demo = 'vanilla' | 'vue' | 'react';
type LogEntry = {
  id: number;
  framework: Demo;
  kind: 'move' | 'won' | 'lost' | 'info';
  text: string;
};

function useInitialQuery() {
  const [state] = useState(() => {
    if (typeof window === 'undefined') return { demo: 'vanilla' as Demo, ai: false };
    const p = new URLSearchParams(window.location.search);
    const raw = p.get('demo');
    const demo: Demo = raw === 'vue' || raw === 'react' || raw === 'vanilla' ? raw : 'vanilla';
    const ai = p.get('ai') === '1' || p.get('ai') === 'true';
    return { demo, ai };
  });
  return state;
}

export function App() {
  const boot = useInitialQuery();
  const [demo, setDemo] = useState<Demo>(boot.demo);
  const aiEnabled = boot.ai;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const vueRef = useRef<VueHandle | null>(null);
  const reactRef = useRef<ReactHandle | null>(null);

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    logIdRef.current += 1;
    const next: LogEntry = { id: logIdRef.current, ...entry };
    setLogs((prev) => [next, ...prev].slice(0, 120));
  }, []);

  // tab 切换同步 URL（replaceState，不刷新；分享链接方便）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('demo', demo);
    if (aiEnabled) url.searchParams.set('ai', '1');
    window.history.replaceState({}, '', url.toString());
  }, [demo, aiEnabled]);

  const onMove = useCallback(
    (framework: Demo) => (dir: Direction, gained: number) =>
      pushLog({ framework, kind: 'move', text: `${dir}${gained ? ` +${gained}` : ''}` }),
    [pushLog]
  );
  const onWon = useCallback(
    (framework: Demo) => () => pushLog({ framework, kind: 'won', text: '达到 2048' }),
    [pushLog]
  );
  const onLost = useCallback(
    (framework: Demo) => () => pushLog({ framework, kind: 'lost', text: '无可走方向' }),
    [pushLog]
  );

  return (
    <div className="pg-shell">
      <header className="pg-header">
        <h1>game-2048 · Playground</h1>
        <p>
          一个 2048 引擎，三种消费方式：<b>Vanilla</b>（直接吃 core，手工画 DOM）、
          <b>Vue 3</b>（<code>@my-games/2048-vue</code>）、
          <b>React 18/19</b>（<code>@my-games/2048-react</code>）。三包共享同一份
          <code> @my-games/2048-core</code> 引擎与样式表。
        </p>
        <div className="pg-badges">
          <span className="pg-badge">TypeScript 7 · tsgo</span>
          <span className="pg-badge">Vite 8 · Rolldown</span>
          <span className="pg-badge">ESM · CJS · UMD · IIFE</span>
          <span className="pg-badge">expectimax AI</span>
          <span className="pg-badge">localStorage 存档 · 撤销 20 步</span>
        </div>
      </header>

      <nav className="pg-tabs" role="tablist" aria-label="Demo tabs">
        {(
          [
            ['vanilla', 'Vanilla · 直接引入 core'],
            ['vue', 'Vue 3 组件'],
            ['react', 'React 18/19 组件']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={demo === key}
            className={`pg-tab${demo === key ? ' is-active' : ''}`}
            onClick={() => setDemo(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {!aiEnabled ? (
        <div className="pg-hint">
          AI 以 API 形式提供（<code>bestMove(grid)</code> / 组件 ref 上的
          <code> suggestMove()</code> / <code>aiMove()</code>），界面默认无按钮。
          想看「提示」/「AI 帮走」：URL 加 <code>?ai=1</code> 刷新。
        </div>
      ) : (
        <div className="pg-ai-panel">
          <h3>AI 控制面板（?ai=1 已开启）</h3>
          <div className="status">
            当前 tab：<b>{demo}</b>。三种消费方式共用同一个 core <code>bestMove</code>，
            逻辑等价。棋盘工具栏里的「提示」/「AI 帮走」按钮直接触发它。
          </div>
        </div>
      )}

      <section className="pg-panel" role="tabpanel">
        {demo === 'vanilla' && (
          <>
            <div className="pg-panel-head">
              <h2>Vanilla</h2>
              <span className="pg-tag pg-tag-vanilla">
                @my-games/2048-core · 无框架 · 手工 DOM
              </span>
            </div>
            <p className="pg-panel-desc">
              这段代码在浏览器 <code>&lt;script src="...index.iife.js"&gt;</code> +
              <code> const {'{'} Game2048, bestMove {'}'} = Game2048Core</code> 下等价可跑。
              棋盘 DOM、键盘/触摸绑定、覆盖层全部手写，展示 core API 的独立可用性。
            </p>
            <VanillaDemo
              saveKey="g2048-vanilla:save"
              bestKey="g2048-vanilla:best"
              enableAI={aiEnabled}
              autofocus
              onMove={onMove('vanilla')}
              onWon={onWon('vanilla')}
              onLost={onLost('vanilla')}
            />
          </>
        )}
        {demo === 'vue' && (
          <>
            <div className="pg-panel-head">
              <h2>Vue 3</h2>
              <span className="pg-tag pg-tag-vue">Game2048 from @my-games/2048-vue</span>
            </div>
            <p className="pg-panel-desc">
              单文件 <code>Game2048.vue</code> + <code>useGame()</code> composable；
              键盘走 focus + window keydown；触摸 swipe 走原生 <code>touchstart/touchend</code>。
            </p>
            <VuePanel
              saveKey="g2048-vue:save"
              bestKey="g2048-vue:best"
              autofocus
              enableAI={aiEnabled}
              onInstance={(v) => (vueRef.current = v)}
              onMove={onMove('vue')}
              onWon={onWon('vue')}
              onLost={onLost('vue')}
            />
          </>
        )}
        {demo === 'react' && (
          <>
            <div className="pg-panel-head">
              <h2>React 18/19</h2>
              <span className="pg-tag pg-tag-react">Game2048 from @my-games/2048-react</span>
            </div>
            <p className="pg-panel-desc">
              函数组件 + <code>useGame()</code> hook；<code>forwardRef</code> +
              <code> useImperativeHandle</code> 暴露 suggestMove / aiMove。样式与动画
              完全复用 core 的 <code>styles.css</code>。
            </p>
            <Game2048React
              ref={reactRef}
              saveKey="g2048-react:save"
              bestKey="g2048-react:best"
              autofocus
              enableAI={aiEnabled}
              onMove={onMove('react')}
              onWon={onWon('react')}
              onLost={onLost('react')}
            />
          </>
        )}
      </section>

      <section>
        <div className="pg-panel-head">
          <h2 style={{ fontSize: 16 }}>事件日志（最新在前 · 跨 tab 共享）</h2>
          <button className="pg-btn" type="button" onClick={() => setLogs([])}>
            清空
          </button>
        </div>
        <div className="pg-log">
          {logs.length === 0 ? (
            <div className="row empty">
              还没有事件。当前 tab 点一下棋盘让它拿到焦点，方向键即可生效；触屏直接滑动。
            </div>
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
          存档分别落在 <code>g2048-vanilla:save</code> / <code>g2048-vue:save</code> /
          <code> g2048-react:save</code> 与对应 best 键，切换 tab 不打断对局。
        </p>
        <p>
          Vanilla tab 是「无框架浏览器 script 引入」的等价示例：把
          <code> import {'{'} Game2048 {'}'} from '@my-games/2048-core'</code> 换成
          <code> &lt;script src="https://unpkg.com/@my-games/2048-core/dist/index.iife.js"&gt;</code> +
          <code> const {'{'} Game2048 {'}'} = Game2048Core</code>，其余代码原样可用。
        </p>
      </footer>
    </div>
  );
}
