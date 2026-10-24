import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bestMove as aiBestMove,
  Game2048,
  type Direction,
  type GameOptions,
  type GameState
} from '@my-games/game-2048-core';

/**
 * `useGame` —— React Hook 版引擎桥接。
 *
 * - 引擎实例在 `useMemo` 里按 `size`/`saveKey` 等关键 prop 缓存，避免每次 render
 *   重新构造；这些 prop 变化 = 重开一局，视为预期语义。
 * - `useState` 订阅引擎快照；`useEffect` 里挂 unsubscribe 防泄漏。
 * - 用 `useRef` 保留最新 game 实例给 imperative handler（move / undo）用，
 *   防止闭包过期。
 */
export interface UseGameOptions extends GameOptions {
  aiDepth?: number;
}

export interface UseGameReturn {
  state: GameState;
  game: Game2048;
  move: (dir: Direction) => boolean;
  newGame: () => void;
  undo: () => boolean;
  continuePlaying: () => void;
  suggestMove: () => Direction | null;
  aiMove: () => Direction | null;
}

export function useGame(options: UseGameOptions = {}): UseGameReturn {
  const { aiDepth = 3, size, storage, saveKey, bestKey, freshStart, target, undoLimit, rng } = options;

  // useMemo 依赖里不放 rng / storage（函数/对象引用不稳定；重开一次即可）
  const game = useMemo(
    () => new Game2048({ size, storage, saveKey, bestKey, freshStart, target, undoLimit, rng }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, saveKey, bestKey, target, undoLimit]
  );

  const gameRef = useRef(game);
  gameRef.current = game;

  const [state, setState] = useState<GameState>(() => game.getState());

  useEffect(() => {
    // 引擎替换时重新订阅；先把 state 拉齐到最新，防止首帧错位
    setState(game.getState());
    const unsub = game.subscribe((s) => setState(s));
    return unsub;
  }, [game]);

  return {
    state,
    game,
    move: (dir) => gameRef.current.move(dir),
    newGame: () => gameRef.current.newGame(),
    undo: () => gameRef.current.undo(),
    continuePlaying: () => gameRef.current.continuePlaying(),
    suggestMove: () => aiBestMove(gameRef.current.getGridValues(), { depth: aiDepth }),
    aiMove: () => {
      const dir = aiBestMove(gameRef.current.getGridValues(), { depth: aiDepth });
      if (dir) gameRef.current.move(dir);
      return dir;
    }
  };
}
