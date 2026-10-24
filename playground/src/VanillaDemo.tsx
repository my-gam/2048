import { useEffect, useRef } from 'react';
import {
  bestMove as aiBestMove,
  Game2048,
  type Direction,
  type GameState
} from '@my-games/2048-core';
// 演示「不用任何框架适配器」时怎么吃 core —— 组件外壳还是 React（playground 是
// React 应用），但棋盘 DOM 完全靠 useRef + 原生 createElement 手工画；
// 这段代码在浏览器 script 标签 + IIFE 版 core 环境下等价，参考 README。
import './vanilla.css';

/**
 * VanillaDemo —— 直接消费 `@my-games/2048-core` 的最小可玩实现。
 *
 * 与 vue/react 两个 tab 的关键差别：
 * - 不 import 任何适配器；只用 core 导出的 `Game2048` 类与 `bestMove` AI。
 * - 棋盘 DOM 由 useEffect 里 `document.createElement` + `appendChild` 手工构建；
 *   订阅回调每次拿到新 GameState 后全量重绘 tile 层。
 * - 复用了 core/src/styles.css 里的 `.game-2048-*` 类，视觉与 vue/react 一致。
 *
 * 与真实「浏览器 script 标签引入 IIFE」等价的最小代码骨架：
 *
 * ```html
 * <link rel="stylesheet" href="https://unpkg.com/@my-games/2048-core/src/styles.css">
 * <script src="https://unpkg.com/@my-games/2048-core/dist/index.iife.js"></script>
 * <div id="board"></div>
 * <script>
 *   const { Game2048, bestMove } = Game2048Core;
 *   const game = new Game2048({ size: 4 });
 *   game.subscribe(s => render(s));
 *   // ...bindKeyboard + bindTouch + render(...) 同本组件 useEffect 里的写法
 * </script>
 * ```
 */
export interface VanillaDemoProps {
  saveKey: string;
  bestKey: string;
  enableAI?: boolean;
  autofocus?: boolean;
  onMove?: (dir: Direction, gained: number) => void;
  onWon?: () => void;
  onLost?: () => void;
}

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right'
};

export function VanillaDemo({
  saveKey,
  bestKey,
  enableAI = false,
  autofocus = false,
  onMove,
  onWon,
  onLost
}: VanillaDemoProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game2048 | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const tileLayerRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const bestRef = useRef<HTMLSpanElement | null>(null);
  const moveCountRef = useRef<HTMLSpanElement | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const aiHintRef = useRef<HTMLSpanElement | null>(null);
  const undoBtnRef = useRef<HTMLButtonElement | null>(null);

  // 首次 mount 完成后触发一次 render；依赖空数组 = 只在 mount 时建引擎与订阅
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // 清空 host，手工搭 DOM
    host.innerHTML = '';

    // ---- Header ----
    const header = document.createElement('header');
    header.className = 'game-2048-header';
    header.innerHTML = `
      <h1 class="game-2048-title">2048 <small class="vanilla-badge">Vanilla · core only</small></h1>
      <div class="game-2048-scores">
        <div class="game-2048-score-box"><span class="label">Score</span><span class="value" data-role="score">0</span></div>
        <div class="game-2048-score-box"><span class="label">Best</span><span class="value" data-role="best">0</span></div>
      </div>`;
    host.appendChild(header);
    scoreRef.current = header.querySelector<HTMLElement>('[data-role="score"]');
    bestRef.current = header.querySelector<HTMLElement>('[data-role="best"]');

    // ---- Toolbar ----
    const toolbar = document.createElement('div');
    toolbar.className = 'game-2048-toolbar';
    toolbar.innerHTML = `
      <p class="game-2048-desc">
        直接消费 <code>@my-games/2048-core</code>，棋盘 DOM 手写、无 Vue/React。
        移动 <span data-role="movecount">0</span> 步 · 状态 <b data-role="status">playing</b>。
      </p>
      <div class="game-2048-actions">
        ${enableAI ? '<button class="game-2048-button" type="button" data-role="ai-hint">提示 <span data-role="ai-hint-out"></span></button>' : ''}
        <button class="game-2048-button" type="button" data-role="undo">撤销</button>
        <button class="game-2048-button is-primary" type="button" data-role="new">新游戏</button>
      </div>`;
    host.appendChild(toolbar);
    moveCountRef.current = toolbar.querySelector<HTMLElement>('[data-role="movecount"]');
    statusRef.current = toolbar.querySelector<HTMLElement>('[data-role="status"]');
    aiHintRef.current = toolbar.querySelector<HTMLElement>('[data-role="ai-hint-out"]');
    undoBtnRef.current = toolbar.querySelector<HTMLButtonElement>('[data-role="undo"]');

    // ---- Board shell（一次搭建，之后只重画 tile layer） ----
    const board = document.createElement('div');
    board.className = 'game-2048-board';
    board.tabIndex = 0;
    board.setAttribute('role', 'application');
    board.setAttribute('aria-label', '2048 游戏板 (Vanilla)');
    board.style.setProperty('--cols', '4');
    const grid = document.createElement('div');
    grid.className = 'game-2048-grid';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    grid.style.gridTemplateRows = 'repeat(4, 1fr)';
    for (let i = 0; i < 16; i++) {
      const cell = document.createElement('div');
      cell.className = 'game-2048-cell';
      grid.appendChild(cell);
    }
    board.appendChild(grid);
    const layer = document.createElement('div');
    layer.className = 'game-2048-tile-layer';
    board.appendChild(layer);
    const overlay = document.createElement('div');
    overlay.className = 'game-2048-overlay';
    overlay.innerHTML = `
      <h2 data-role="overlay-title"></h2>
      <div class="row">
        <button class="game-2048-button" type="button" data-role="overlay-continue" hidden>继续游戏</button>
        <button class="game-2048-button" type="button" data-role="overlay-undo" hidden>悔一步</button>
        <button class="game-2048-button is-primary" type="button" data-role="overlay-new" hidden>再来一局</button>
      </div>`;
    board.appendChild(overlay);
    host.appendChild(board);
    boardRef.current = board;
    tileLayerRef.current = layer;
    overlayRef.current = overlay;

    // ---- 引擎 ----
    const game = new Game2048({ size: 4, saveKey, bestKey });
    gameRef.current = game;

    let lastScore = game.getState().score;
    let lastStatus = game.getState().status;

    const render = (state: GameState) => {
      if (scoreRef.current) scoreRef.current.textContent = String(state.score);
      if (bestRef.current) bestRef.current.textContent = String(state.bestScore);
      if (moveCountRef.current) moveCountRef.current.textContent = String(state.moveCount);
      if (statusRef.current) statusRef.current.textContent = state.status;
      if (undoBtnRef.current) undoBtnRef.current.disabled = state.historySize === 0;

      const layerEl = tileLayerRef.current;
      if (!layerEl) return;
      layerEl.innerHTML = '';
      for (const t of state.tiles) {
        const el = document.createElement('div');
        const cls = ['game-2048-tile'];
        if (t.isNew) cls.push('is-new');
        if (t.merged) cls.push('is-merged');
        if (t.value > 2048) cls.push('is-super');
        el.className = cls.join(' ');
        el.style.setProperty('--row', String(t.row));
        el.style.setProperty('--col', String(t.col));
        el.setAttribute('data-value', String(t.value));
        if (t.value > 2048) el.setAttribute('data-super', '1');
        el.textContent = String(t.value);
        layerEl.appendChild(el);
      }

      // overlay
      const overlayEl = overlayRef.current;
      if (overlayEl) {
        const title = overlayEl.querySelector<HTMLElement>('[data-role="overlay-title"]');
        const btnContinue = overlayEl.querySelector<HTMLButtonElement>('[data-role="overlay-continue"]');
        const btnUndo = overlayEl.querySelector<HTMLButtonElement>('[data-role="overlay-undo"]');
        const btnNew = overlayEl.querySelector<HTMLButtonElement>('[data-role="overlay-new"]');
        const isWon = state.status === 'won';
        const isLost = state.status === 'lost';
        overlayEl.classList.toggle('is-visible', isWon || isLost);
        overlayEl.classList.toggle('is-won', isWon);
        overlayEl.classList.toggle('is-lost', isLost);
        if (title) title.textContent = isWon ? '你赢了！' : isLost ? '游戏结束' : '';
        if (btnContinue) btnContinue.hidden = !isWon;
        if (btnUndo) btnUndo.hidden = !(isLost && state.historySize > 0);
        if (btnNew) btnNew.hidden = !(isWon || isLost);
      }
    };

    const unsub = game.subscribe((s) => {
      render(s);
      const gained = s.score - lastScore;
      if (gained > 0) {
        // 让上层 playground 的 event log 也能收到；这里不区分方向（用户可能点的按钮）
        // dir 参数在键盘/触摸 handler 里透传更精确
      }
      lastScore = s.score;
      if (s.status !== lastStatus) {
        if (s.status === 'won') onWon?.();
        else if (s.status === 'lost') onLost?.();
        lastStatus = s.status;
      }
    });

    // ---- 输入 ----
    const onKey = (ev: KeyboardEvent) => {
      const dir = KEY_TO_DIR[ev.key];
      if (!dir) return;
      if (document.activeElement !== board) return;
      ev.preventDefault();
      doMove(dir);
    };

    const doMove = (dir: Direction) => {
      const before = game.getState().score;
      const ok = game.move(dir);
      if (ok) {
        onMove?.(dir, game.getState().score - before);
        if (aiHintRef.current) aiHintRef.current.textContent = '';
      }
    };

    let touchStart: { x: number; y: number } | null = null;
    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      if (!t) return;
      touchStart = { x: t.clientX, y: t.clientY };
      board.focus({ preventScroll: true });
    };
    const onTouchEnd = (ev: TouchEvent) => {
      const s = touchStart;
      touchStart = null;
      if (!s) return;
      const t = ev.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (Math.max(adx, ady) < 24) return;
      const dir: Direction = adx > ady ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      doMove(dir);
    };

    window.addEventListener('keydown', onKey, { passive: false });
    board.addEventListener('touchstart', onTouchStart, { passive: true });
    board.addEventListener('touchend', onTouchEnd);

    // ---- 按钮 ----
    const bind = <T extends HTMLElement>(sel: string, handler: (el: T) => void) => {
      const el = host.querySelector<T>(sel);
      if (el) el.addEventListener('click', () => handler(el));
    };
    bind<HTMLButtonElement>('[data-role="undo"]', () => game.undo());
    bind<HTMLButtonElement>('[data-role="new"]', () => game.newGame());
    bind<HTMLButtonElement>('[data-role="ai-hint"]', () => {
      const dir = aiBestMove(game.getGridValues(), { depth: 3 });
      if (aiHintRef.current) aiHintRef.current.textContent = dir ? `推荐 ${dir}` : '无合法方向';
    });
    bind<HTMLButtonElement>('[data-role="overlay-continue"]', () => game.continuePlaying());
    bind<HTMLButtonElement>('[data-role="overlay-undo"]', () => game.undo());
    bind<HTMLButtonElement>('[data-role="overlay-new"]', () => game.newGame());

    if (autofocus) board.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('keydown', onKey);
      board.removeEventListener('touchstart', onTouchStart);
      board.removeEventListener('touchend', onTouchEnd);
      unsub();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey, bestKey, enableAI]);

  return <div ref={hostRef} className="game-2048 vanilla-host" />;
}
