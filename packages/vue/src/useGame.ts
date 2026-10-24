import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue';
import { bestMove as aiBestMove, Game2048, type Direction, type GameOptions, type GameState } from '@my-games/2048-core';

/**
 * `useGame` —— Vue 侧连接 Game2048 引擎的 composable。
 *
 * 用法：
 * ```ts
 * const { state, move, newGame, undo } = useGame({ size: 4 });
 * ```
 *
 * 生命周期：内部订阅引擎；`onBeforeUnmount` 时自动退订，防止内存泄漏。
 * state 用 `shallowRef` 存 —— 引擎每次都推新对象，深度 reactive 无收益。
 */
export interface UseGameOptions extends GameOptions {
  /** AI 搜索深度；仅 `aiMove` 用到。 */
  aiDepth?: number;
}

export interface UseGameReturn {
  /** 引擎的完整状态快照；用 ShallowRef 声明让 <script setup> 的模板能自动 unwrap。 */
  state: ShallowRef<GameState>;
  raw: Game2048;
  move: (dir: Direction) => boolean;
  newGame: () => void;
  undo: () => boolean;
  continuePlaying: () => void;
  canUndo: () => boolean;
  /** 让 AI 走一步（内部仍走 game.move 触发订阅）。 */
  aiMove: () => Direction | null;
  /** 只查询、不走子。 */
  suggestMove: () => Direction | null;
}

export function useGame(options: UseGameOptions = {}): UseGameReturn {
  const { aiDepth = 3, ...engineOptions } = options;
  const game = new Game2048(engineOptions);
  const state = shallowRef<GameState>(game.getState());
  const unsubscribe = game.subscribe((s) => {
    state.value = s;
  });
  onBeforeUnmount(unsubscribe);

  return {
    state,
    raw: game,
    move: (dir) => game.move(dir),
    newGame: () => game.newGame(),
    undo: () => game.undo(),
    continuePlaying: () => game.continuePlaying(),
    canUndo: () => game.canUndo(),
    suggestMove: () => aiBestMove(game.getGridValues(), { depth: aiDepth }),
    aiMove: () => {
      const dir = aiBestMove(game.getGridValues(), { depth: aiDepth });
      if (dir) game.move(dir);
      return dir;
    }
  };
}
