import { canMove } from './board';
import {
  DEFAULT_BEST_KEY,
  DEFAULT_SAVE_KEY,
  clearSave,
  loadBest,
  loadSave,
  tryGetGlobalStorage,
  writeBest,
  writeSave
} from './storage';
import type {
  BoardSize,
  Cell,
  Direction,
  GameState,
  GameStatus,
  RandomSource,
  SaveStorage,
  SerializedSave,
  Snapshot,
  Tile
} from './types';

/**
 * Game2048 —— 2048 状态机与规则实现。
 *
 * 与 UI 完全解耦：
 * - 通过 `subscribe(fn)` 推完整 `GameState` 快照（不推 diff，避免框架选择困难）。
 * - 每次公开操作（move/newGame/undo/continuePlaying）成功后同步推送一次。
 * - `Tile.id` 跨帧稳定，UI 用它做 diff 与动画 key；合并中被吞掉的那块直接消失。
 *
 * 存档：如果注入 storage（默认尝试 globalThis.localStorage），会在每次操作后
 * 写入当前 save；构造时自动加载。想禁用：`storage: null`。
 *
 * 撤销：move 前压栈快照，最多保留 undoLimit 步（默认 20）。
 */

export interface GameOptions {
  /** 棋盘边长，默认 4。 */
  size?: BoardSize;
  /** 随机源（[0, 1)）；单测注入固定序列以获得可复现结果。 */
  rng?: RandomSource;
  /**
   * 存储后端。`undefined` → 尝试取 globalThis.localStorage；
   * `null` → 明确禁用；也可以注入自己实现 SaveStorage 的 mock。
   */
  storage?: SaveStorage | null;
  saveKey?: string;
  bestKey?: string;
  /** 构造时忽略已有存档，直接开新局。 */
  freshStart?: boolean;
  /** 胜利阈值，默认 2048。 */
  target?: number;
  /** 撤销栈深度，默认 20。 */
  undoLimit?: number;
}

const DEFAULT_SIZE: BoardSize = 4;
const DEFAULT_TARGET = 2048;
const DEFAULT_UNDO_LIMIT = 20;

/** 每个方向的「起点角 + 步长」——line(k, i) 从起点开始沿步长走 i 步。 */
interface LineCursors {
  /** 遍历 k（第几条 line）时，取起始 cell。 */
  start: (k: number, size: number) => { r: number; c: number };
  /** 沿 line 每前进一格的增量。 */
  step: { dr: number; dc: number };
}

const CURSORS: Record<Direction, LineCursors> = {
  left: { start: (k) => ({ r: k, c: 0 }), step: { dr: 0, dc: 1 } },
  right: { start: (k, size) => ({ r: k, c: size - 1 }), step: { dr: 0, dc: -1 } },
  up: { start: (k) => ({ r: 0, c: k }), step: { dr: 1, dc: 0 } },
  down: { start: (k, size) => ({ r: size - 1, c: k }), step: { dr: -1, dc: 0 } }
};

function makeGrid(size: BoardSize): (Tile | null)[][] {
  return Array.from({ length: size }, () => Array<Tile | null>(size).fill(null));
}

export class Game2048 {
  private readonly size: BoardSize;
  private readonly target: number;
  private readonly undoLimit: number;
  private readonly rng: RandomSource;
  private readonly storage: SaveStorage | null;
  private readonly saveKey: string;
  private readonly bestKey: string;

  private grid: (Tile | null)[][];
  private score = 0;
  private bestScore = 0;
  private status: GameStatus = 'playing';
  private keepPlaying = false;
  private moveCount = 0;
  private nextTileId = 1;
  private history: Snapshot[] = [];

  private listeners = new Set<(state: GameState) => void>();
  private notifying = false;

  constructor(opts: GameOptions = {}) {
    this.size = opts.size ?? DEFAULT_SIZE;
    this.target = opts.target ?? DEFAULT_TARGET;
    this.undoLimit = opts.undoLimit ?? DEFAULT_UNDO_LIMIT;
    this.rng = opts.rng ?? Math.random;
    this.storage = opts.storage === undefined ? tryGetGlobalStorage() : opts.storage;
    this.saveKey = opts.saveKey ?? DEFAULT_SAVE_KEY;
    this.bestKey = opts.bestKey ?? DEFAULT_BEST_KEY;
    this.bestScore = loadBest(this.storage, this.bestKey);
    this.grid = makeGrid(this.size);

    const saved = opts.freshStart ? null : loadSave(this.storage, this.saveKey);
    if (saved && saved.size === this.size) {
      this.loadFromSave(saved);
      // 载入后若棋盘已无可动，标记 lost，让 UI 直接显示终局面板。
      if (!canMove(this.toValueGrid())) this.status = 'lost';
    } else {
      this.startNewGame();
    }
  }

  // ---------- 公共 API ----------

  /** 订阅状态变化。返回退订函数。注册后立刻收到一次当前快照。 */
  subscribe(fn: (state: GameState) => void): () => void {
    this.listeners.add(fn);
    try {
      fn(this.getState());
    } catch (err) {
      // 与 notify 保持一致：一个 listener 抛错不影响后续订阅者注册。
      // eslint-disable-next-line no-console
      console.error('[game-2048] listener threw on subscribe:', err);
    }
    return () => {
      this.listeners.delete(fn);
    };
  }

  getState(): GameState {
    return {
      size: this.size,
      tiles: this.collectTiles().map((t) => ({ ...t })),
      score: this.score,
      bestScore: this.bestScore,
      status: this.status,
      keepPlaying: this.keepPlaying,
      moveCount: this.moveCount
    };
  }

  /** 拿到当前值网格（AI / 单测用）；不影响游戏内部。 */
  getGridValues(): Cell[][] {
    return this.toValueGrid();
  }

  /** 是否还可以撤销。 */
  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** 沿方向滑动一次。返回 true = 棋盘真的发生了变化；false = 该方向无解。 */
  move(dir: Direction): boolean {
    if (this.status === 'lost') return false;
    if (this.status === 'won' && !this.keepPlaying) return false;

    const snap = this.takeSnapshot();

    // 每一 move 开始时清掉上一帧的动画标记，让 UI 只对「本次」变化响应。
    for (const row of this.grid) for (const t of row) if (t) { t.isNew = false; t.merged = false; }

    const { moved, gained } = this.executeSlide(dir);
    if (!moved) return false;

    this.score += gained;
    this.pushHistory(snap);
    this.moveCount += 1;

    if (!this.keepPlaying && this.hasValueAtLeast(this.target)) {
      this.status = 'won';
    }

    this.spawnRandomTile();

    if (!canMove(this.toValueGrid())) this.status = 'lost';

    this.commit();
    return true;
  }

  /** 达到 2048 后用户点击「继续游戏」。 */
  continuePlaying(): void {
    if (this.status !== 'won') return;
    this.keepPlaying = true;
    this.status = 'playing';
    this.commit();
  }

  /** 开启新局：清空 board + 重置 score；保留 bestScore。 */
  newGame(): void {
    this.startNewGame();
    this.commit();
  }

  /** 撤销一步；返回是否成功（历史为空时 false）。 */
  undo(): boolean {
    const s = this.history.pop();
    if (!s) return false;
    this.restoreSnapshot(s);
    this.commit();
    return true;
  }

  /** 清除当前存档（不影响 bestScore）。 */
  clearSaved(): void {
    clearSave(this.storage, this.saveKey);
  }

  // ---------- 内部 ----------

  private startNewGame(): void {
    this.grid = makeGrid(this.size);
    this.score = 0;
    this.status = 'playing';
    this.keepPlaying = false;
    this.moveCount = 0;
    this.nextTileId = 1;
    this.history = [];
    this.spawnRandomTile();
    this.spawnRandomTile();
  }

  private spawnRandomTile(): void {
    const empties: Array<[number, number]> = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.grid[r]?.[c]) empties.push([r, c]);
      }
    }
    if (empties.length === 0) return;
    const idx = Math.min(empties.length - 1, Math.floor(this.rng() * empties.length));
    const slot = empties[idx];
    if (!slot) return;
    const [r, c] = slot;
    const value = this.rng() < 0.9 ? 2 : 4;
    const tile: Tile = { id: this.nextTileId++, value, row: r, col: c, isNew: true, merged: false };
    const row = this.grid[r];
    if (row) row[c] = tile;
  }

  private executeSlide(dir: Direction): { moved: boolean; gained: number } {
    const cursors = CURSORS[dir];
    let moved = false;
    let gained = 0;

    for (let k = 0; k < this.size; k++) {
      // 按「从起点出发」的顺序读取本 line 上的所有非空 tile。
      const lineTiles: Tile[] = [];
      const slotOfTile = new Map<Tile, number>(); // 记录原本位于 line 的第几格
      for (let i = 0; i < this.size; i++) {
        const { r, c } = this.cellAt(cursors, k, i);
        const t = this.grid[r]?.[c];
        if (t) {
          lineTiles.push(t);
          slotOfTile.set(t, i);
        }
      }

      // compact + 相邻等值合并（每 tile 只能参与一次合并）
      const result: Tile[] = [];
      let idx = 0;
      while (idx < lineTiles.length) {
        const cur = lineTiles[idx];
        const next = lineTiles[idx + 1];
        if (!cur) break;
        if (next && cur.value === next.value) {
          cur.value *= 2;
          cur.merged = true;
          gained += cur.value;
          result.push(cur);
          idx += 2;
          moved = true; // 至少发生了一次合并
        } else {
          result.push(cur);
          idx += 1;
        }
      }

      // 检测「仅滑动、未合并」的情况：任一 tile 落位与原位不同。
      for (let i = 0; i < result.length; i++) {
        const t = result[i];
        if (!t) continue;
        const originalSlot = slotOfTile.get(t);
        if (originalSlot !== i) moved = true;
      }

      // 清空 line 再按新顺序写回；被吞掉的 tile 不出现在 result 中即视为消失。
      for (let i = 0; i < this.size; i++) {
        const { r, c } = this.cellAt(cursors, k, i);
        const row = this.grid[r];
        if (row) row[c] = null;
      }
      for (let i = 0; i < result.length; i++) {
        const t = result[i];
        if (!t) continue;
        const { r, c } = this.cellAt(cursors, k, i);
        const row = this.grid[r];
        if (row) row[c] = t;
        t.row = r;
        t.col = c;
      }
    }
    return { moved, gained };
  }

  private cellAt(cursors: LineCursors, k: number, i: number): { r: number; c: number } {
    const start = cursors.start(k, this.size);
    return { r: start.r + i * cursors.step.dr, c: start.c + i * cursors.step.dc };
  }

  private collectTiles(): Tile[] {
    const out: Tile[] = [];
    for (const row of this.grid) for (const t of row) if (t) out.push(t);
    return out;
  }

  private toValueGrid(): Cell[][] {
    const g: Cell[][] = Array.from({ length: this.size }, () => Array<Cell>(this.size).fill(0));
    for (const t of this.collectTiles()) g[t.row]![t.col] = t.value;
    return g;
  }

  private hasValueAtLeast(v: number): boolean {
    for (const t of this.collectTiles()) if (t.value >= v) return true;
    return false;
  }

  private takeSnapshot(): Snapshot {
    return {
      tiles: this.collectTiles().map((t) => ({ ...t })),
      score: this.score,
      status: this.status,
      keepPlaying: this.keepPlaying,
      moveCount: this.moveCount
    };
  }

  private restoreSnapshot(s: Snapshot): void {
    this.grid = makeGrid(this.size);
    let maxId = 0;
    for (const t of s.tiles) {
      const clone: Tile = { ...t };
      const row = this.grid[clone.row];
      if (row) row[clone.col] = clone;
      if (clone.id > maxId) maxId = clone.id;
    }
    this.nextTileId = maxId + 1;
    this.score = s.score;
    this.status = s.status;
    this.keepPlaying = s.keepPlaying;
    this.moveCount = s.moveCount;
  }

  private pushHistory(s: Snapshot): void {
    this.history.push(s);
    if (this.history.length > this.undoLimit) this.history.shift();
  }

  private loadFromSave(save: SerializedSave): void {
    this.grid = makeGrid(this.size);
    let maxId = 0;
    for (const raw of save.tiles) {
      const t: Tile = {
        id: raw.id,
        value: raw.value,
        row: raw.row,
        col: raw.col,
        isNew: false,
        merged: false
      };
      if (t.row >= 0 && t.row < this.size && t.col >= 0 && t.col < this.size) {
        const row = this.grid[t.row];
        if (row) row[t.col] = t;
      }
      if (t.id > maxId) maxId = t.id;
    }
    this.score = save.score;
    this.status = save.status === 'won' ? 'won' : save.status === 'lost' ? 'lost' : 'playing';
    this.keepPlaying = save.keepPlaying;
    this.moveCount = save.moveCount;
    this.nextTileId = Math.max(maxId + 1, save.nextTileId ?? maxId + 1);
  }

  private commit(): void {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      writeBest(this.storage, this.bestKey, this.bestScore);
    }
    writeSave(this.storage, this.saveKey, {
      version: 1,
      size: this.size,
      tiles: this.collectTiles().map((t) => ({ ...t })),
      score: this.score,
      status: this.status,
      keepPlaying: this.keepPlaying,
      moveCount: this.moveCount,
      nextTileId: this.nextTileId
    });
    this.notify();
  }

  private notify(): void {
    if (this.notifying) return;
    this.notifying = true;
    try {
      const snapshot = this.getState();
      for (const fn of this.listeners) {
        try {
          fn(snapshot);
        } catch (err) {
          // 一个 listener 抛错不影响其他 listener；交给 console.error，让 UI 层自己决定
          // 要不要用 subscribe 上层包一层错误处理。
          // eslint-disable-next-line no-console
          console.error('[game-2048] listener threw:', err);
        }
      }
    } finally {
      this.notifying = false;
    }
  }
}
