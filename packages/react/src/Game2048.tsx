import {
  type CSSProperties,
  type Ref,
  type TouchEvent as ReactTouchEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import '@my-games/game-2048-core/styles.css';
import type { Direction, SaveStorage } from '@my-games/game-2048-core';
import { useGame } from './useGame';

/**
 * Game2048 —— React 18 组件。与 Vue 版行为对齐：
 * - 键盘：window keydown + 严格 focus 判定（多实例并存只活动那个响应）；
 *   方向键 / WASD。
 * - 触摸：单指 swipe 主导轴 ≥24px；touchstart 时把焦点抢过来。
 * - 动画：新块 / 合并 / 位移全走 core 的 styles.css。
 * - AI：`enableAI` prop 控制按钮渲染；通过 ref 一直可以命令式访问。
 */

export interface Game2048Props {
  size?: 3 | 4 | 5 | 6;
  storage?: SaveStorage | null;
  saveKey?: string;
  bestKey?: string;
  freshStart?: boolean;
  autofocus?: boolean;
  enableAI?: boolean;
  aiDepth?: number;
  title?: string;
  onMove?: (dir: Direction, gained: number) => void;
  onWon?: () => void;
  onLost?: () => void;
  className?: string;
}

export interface Game2048Handle {
  suggestMove(): Direction | null;
  aiMove(): Direction | null;
  newGame(): void;
  undo(): boolean;
  move(dir: Direction): boolean;
  continuePlaying(): void;
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

function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}

function Game2048Inner(props: Game2048Props, ref: Ref<Game2048Handle>) {
  const {
    size = 4,
    storage,
    saveKey,
    bestKey,
    freshStart = false,
    autofocus = true,
    enableAI = false,
    aiDepth = 3,
    title = '2048',
    onMove,
    onWon,
    onLost,
    className
  } = props;

  const { state, move, newGame, undo, continuePlaying, suggestMove, aiMove } = useGame({
    size,
    storage,
    saveKey,
    bestKey,
    freshStart,
    aiDepth
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const lastScoreRef = useRef(state.score);
  const lastStatusRef = useRef(state.status);

  const [scoreDelta, setScoreDelta] = useState<{ amount: number; key: number } | null>(null);
  const [aiHint, setAiHint] = useState<Direction | null>(null);
  const deltaTimer = useRef<number | undefined>(undefined);

  // --- 键盘 ---
  const performMove = useCallback(
    (dir: Direction) => {
      const before = lastScoreRef.current;
      const ok = move(dir);
      if (ok) {
        onMove?.(dir, state.score - before);
        if (enableAI) setAiHint(null);
      }
    },
    [move, onMove, state.score, enableAI]
  );

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const dir = KEY_TO_DIR[ev.key];
      if (!dir) return;
      // 只有本实例 board 有 DOM 焦点时才响应
      if (document.activeElement !== boardRef.current) return;
      ev.preventDefault();
      performMove(dir);
    };
    window.addEventListener('keydown', handler, { passive: false });
    return () => window.removeEventListener('keydown', handler);
  }, [performMove]);

  useEffect(() => {
    if (autofocus) boardRef.current?.focus({ preventScroll: true });
  }, [autofocus]);

  // --- 触摸 ---
  const onTouchStart = (ev: ReactTouchEvent<HTMLDivElement>) => {
    if (ev.touches.length !== 1) return;
    const t = ev.touches[0];
    if (!t) return;
    touchStartPoint.current = { x: t.clientX, y: t.clientY };
    boardRef.current?.focus({ preventScroll: true });
  };
  const onTouchEnd = (ev: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartPoint.current;
    touchStartPoint.current = null;
    if (!start) return;
    const t = ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) < 24) return;
    const dir: Direction = adx > ady ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    performMove(dir);
  };

  // --- 分数 delta 与状态副作用 ---
  useEffect(() => {
    const gained = state.score - lastScoreRef.current;
    if (gained > 0) {
      setScoreDelta({ amount: gained, key: Date.now() + Math.random() });
      if (deltaTimer.current) window.clearTimeout(deltaTimer.current);
      deltaTimer.current = window.setTimeout(() => setScoreDelta(null), 700);
    }
    lastScoreRef.current = state.score;
  }, [state.score]);

  useEffect(() => {
    if (state.status === lastStatusRef.current) return;
    if (state.status === 'won') onWon?.();
    else if (state.status === 'lost') onLost?.();
    lastStatusRef.current = state.status;
  }, [state.status, onWon, onLost]);

  useEffect(
    () => () => {
      if (deltaTimer.current) window.clearTimeout(deltaTimer.current);
    },
    []
  );

  // --- 渲染派生 ---
  const gridStyle = useMemo(
    () =>
      cssVars({
        gridTemplateColumns: `repeat(${state.size}, 1fr)`,
        gridTemplateRows: `repeat(${state.size}, 1fr)`
      }),
    [state.size]
  );
  const boardVars = useMemo(() => cssVars({ '--cols': state.size }), [state.size]);
  const undoDisabled = state.historySize === 0;
  const overlayVisible = state.status !== 'playing';
  const isWon = state.status === 'won';
  const isLost = state.status === 'lost';

  useImperativeHandle(
    ref,
    () => ({
      suggestMove,
      aiMove,
      newGame,
      undo,
      move,
      continuePlaying
    }),
    [suggestMove, aiMove, newGame, undo, move, continuePlaying]
  );

  return (
    <div className={['game-2048', className].filter(Boolean).join(' ')}>
      {title ? (
        <header className="game-2048-header">
          <h1 className="game-2048-title">{title}</h1>
          <div className="game-2048-scores">
            <div className="game-2048-score-box">
              <span className="label">Score</span>
              <span className="value">{state.score}</span>
              {scoreDelta ? (
                <span key={scoreDelta.key} className="delta">
                  +{scoreDelta.amount}
                </span>
              ) : null}
            </div>
            <div className="game-2048-score-box">
              <span className="label">Best</span>
              <span className="value">{state.bestScore}</span>
            </div>
          </div>
        </header>
      ) : null}

      <div className="game-2048-toolbar">
        <p className="game-2048-desc">
          合并相同数字，冲过 <b>2048</b>。方向键 / WASD / 触屏滑动。
        </p>
        <div className="game-2048-actions">
          {enableAI ? (
            <button
              className="game-2048-button"
              type="button"
              disabled={isLost}
              onClick={() => setAiHint(suggestMove())}
            >
              提示
            </button>
          ) : null}
          {enableAI ? (
            <button
              className="game-2048-button"
              type="button"
              disabled={isLost}
              onClick={() => {
                const before = state.score;
                const dir = aiMove();
                if (dir) {
                  onMove?.(dir, state.score - before);
                  setAiHint(null);
                }
              }}
            >
              AI 帮走
            </button>
          ) : null}
          <button
            className="game-2048-button"
            type="button"
            disabled={undoDisabled}
            onClick={() => undo()}
          >
            撤销
          </button>
          <button
            className="game-2048-button is-primary"
            type="button"
            onClick={() => newGame()}
          >
            新游戏
          </button>
        </div>
      </div>

      <div
        ref={boardRef}
        className="game-2048-board"
        style={boardVars}
        tabIndex={0}
        role="application"
        aria-label={`2048 游戏板 ${state.status}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="game-2048-grid" style={gridStyle}>
          {Array.from({ length: state.size * state.size }).map((_, i) => (
            <div key={i} className="game-2048-cell" />
          ))}
        </div>
        <div className="game-2048-tile-layer">
          {state.tiles.map((t) => {
            const cls = [
              'game-2048-tile',
              t.isNew ? 'is-new' : '',
              t.merged ? 'is-merged' : '',
              t.value > 2048 ? 'is-super' : ''
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                key={t.id}
                className={cls}
                style={cssVars({ '--row': t.row, '--col': t.col })}
                data-value={t.value}
                {...(t.value > 2048 ? { 'data-super': '1' } : {})}
              >
                {t.value}
              </div>
            );
          })}
        </div>

        {enableAI && aiHint ? (
          <div
            className="game-2048-ai-indicator"
            style={cssVars({ position: 'absolute', top: '8px', left: '8px', zIndex: 3 })}
          >
            推荐：{aiHint}
          </div>
        ) : null}

        <div
          className={[
            'game-2048-overlay',
            overlayVisible ? 'is-visible' : '',
            isWon ? 'is-won' : '',
            isLost ? 'is-lost' : ''
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isWon ? <h2>你赢了！</h2> : null}
          {isLost ? <h2>游戏结束</h2> : null}
          <div className="row">
            {isWon ? (
              <button
                className="game-2048-button"
                type="button"
                onClick={() => continuePlaying()}
              >
                继续游戏
              </button>
            ) : null}
            {isLost && !undoDisabled ? (
              <button
                className="game-2048-button"
                type="button"
                onClick={() => undo()}
              >
                悔一步
              </button>
            ) : null}
            {overlayVisible ? (
              <button
                className="game-2048-button is-primary"
                type="button"
                onClick={() => newGame()}
              >
                再来一局
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Game2048 = forwardRef(Game2048Inner);
Game2048.displayName = 'Game2048';
