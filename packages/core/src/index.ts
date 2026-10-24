/**
 * @my-games/game-2048-core
 *
 * 无框架依赖的 2048 引擎。三个入口：
 * - `Game2048` 类：状态机 + 订阅 + 存档 + 撤销。
 * - `bestMove` / `evaluate` / `simulateUntilEnd`：expectimax AI。
 * - 纯函数原语 `slideGrid` / `canMove` / `emptyCells` ...：给测试与自定义玩法用。
 */

export { Game2048 } from './game';
export type { GameOptions } from './game';

export { bestMove, evaluate, simulateUntilEnd } from './ai';
export type { BestMoveOptions } from './ai';

export {
  canMove,
  cloneGrid,
  createEmptyGrid,
  emptyCells,
  gridsEqual,
  hasValue,
  maxValue,
  slideGrid,
  slideLineLeft
} from './board';

export {
  DEFAULT_BEST_KEY,
  DEFAULT_SAVE_KEY,
  SAVE_VERSION,
  clearSave,
  isSerializedSave,
  loadBest,
  loadSave,
  tryGetGlobalStorage,
  writeBest,
  writeSave
} from './storage';

export type {
  BoardSize,
  Cell,
  Direction,
  GameStatus,
  GameState,
  RandomSource,
  SaveStorage,
  SerializedSave,
  Snapshot,
  Tile
} from './types';
