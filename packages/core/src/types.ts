/**
 * game-2048 公共类型定义。
 *
 * 核心思想：
 * - `Tile` 携带跨帧稳定的 `id`，UI 层用它做 diff/animation key。
 * - 纯逻辑运算（AI、测试）用 `Cell[][]`（0 = 空），避免带 ID 的复杂性。
 * - `GameState` 是订阅者可见的完整快照。
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** 棋盘单元格的纯值：0 表示空。 */
export type Cell = number;

/** 棋盘格尺寸（默认 4 路 4×4）。 */
export type BoardSize = 3 | 4 | 5 | 6;

/** 一块可以移动到任意方向；这里用数值索引方便和 grid 交换。 */
export interface Tile {
  /** 整个生命周期内唯一，用于 React/Vue key 与动画 diff。 */
  id: number;
  /** 2 的幂：2, 4, 8, ..., 2048, 4096, ... */
  value: number;
  row: number;
  col: number;
  /** 本帧刚生成（触发 scale-in 动画）。 */
  isNew: boolean;
  /** 本帧由两块合并而来（触发 pop 动画）。 */
  merged: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  size: BoardSize;
  tiles: Tile[];
  score: number;
  bestScore: number;
  status: GameStatus;
  /** 用户达到 2048 后选择「继续游戏」时为 true，此时 status 恒为 playing。 */
  keepPlaying: boolean;
  /** 从当前这局开始起算的有效步数（一次 slide 算一步，撤销不计）。 */
  moveCount: number;
}

/** 一局的可回退快照，用于 undo。 */
export interface Snapshot {
  tiles: Tile[];
  score: number;
  status: GameStatus;
  keepPlaying: boolean;
  moveCount: number;
}

/** 序列化后的存档；`bestScore` 单独存字段方便读回，不落进 undo 历史。 */
export interface SerializedSave {
  version: 1;
  size: BoardSize;
  tiles: Tile[];
  score: number;
  status: GameStatus;
  keepPlaying: boolean;
  moveCount: number;
  nextTileId: number;
}

/** 简易 RNG 契约：返回 [0, 1)。注入是为了单测可复现。 */
export type RandomSource = () => number;

/**
 * 最小可注入的存储抽象（跟 DOM Storage 兼容，但允许在 Node 环境注入 mock）。
 * 允许 null 表示禁用持久化。
 */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
