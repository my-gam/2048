import { canMove, cloneGrid, emptyCells, gridsEqual, slideGrid } from './board';
import type { Cell, Direction } from './types';

/**
 * 2048 AI 求解器（expectimax + 蛇形权值评估）。
 *
 * 结构：
 * - Player 节点：4 个方向里挑 best（跳过非法方向）。
 * - Chance 节点：对每个空位分别按 0.9 / 0.1 概率注入 2 / 4，取期望值。
 * - 叶子：静态评估函数（蛇形权值 + 空位数奖励）。
 *
 * 4×4 棋盘 depth=3 单步耗时 <10ms，能稳定打出 5 位数分数；depth=4 更聪明但
 * 单次可能上百 ms，UI 层若要防卡帧可放到 Worker 里跑。
 */

const DIRS: Direction[] = ['up', 'left', 'down', 'right'];

/**
 * 4×4 蛇形权重（top-left 为蛇头 = 最大）：
 * ```
 * path (0,0)=15 (0,1)=14 (0,2)=13 (0,3)=12
 *      (1,0)= 8 (1,1)= 9 (1,2)=10 (1,3)=11
 *      (2,0)= 7 (2,1)= 6 (2,2)= 5 (2,3)= 4
 *      (3,0)= 0 (3,1)= 1 (3,2)= 2 (3,3)= 3
 * ```
 * 权重 = 2^path，越接近蛇头权越大。AI 由此把最大 tile 锁在左上角，
 * 形成「left/up 收拢、right/down 保持单调」的稳定策略。
 */
const SNAKE_WEIGHTS_4: number[][] = [
  [32768, 16384, 8192, 4096],
  [256, 512, 1024, 2048],
  [128, 64, 32, 16],
  [1, 2, 4, 8]
];

const NEW_TILE_PROBS: ReadonlyArray<readonly [number, number]> = [
  [2, 0.9],
  [4, 0.1]
] as const;

/** 通用蛇形权重（3/4/5/6 尺寸；沿 S 形折返，蛇头在 (0, 0)）。 */
function buildWeights(size: number): number[][] {
  if (size === 4) return SNAKE_WEIGHTS_4;
  const cells = size * size;
  const out: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(0));
  // path index：从蛇头 (0,0) 起 = cells-1（最大权重），蛇尾 = 0（最小）。
  let path = cells - 1;
  for (let r = 0; r < size; r++) {
    const leftToRight = r % 2 === 0;
    for (let i = 0; i < size; i++) {
      const c = leftToRight ? i : size - 1 - i;
      out[r]![c] = path;
      path--;
    }
  }
  // 除以格子数避免过大；evaluate 里再乘 1000 恢复量级。
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) out[r]![c] = (out[r]![c] ?? 0) / cells;
  return out;
}

/** 静态评估：值越靠近「蛇头」越大越好；空位多给额外奖励。 */
export function evaluate(grid: Cell[][], weights: number[][]): number {
  let s = 0;
  let empty = 0;
  let max = 0;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    const w = weights[r];
    if (!row || !w) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c] ?? 0;
      if (v === 0) {
        empty++;
      } else {
        // 用 log2 抑制数值膨胀，让权重矩阵主导排序；避免一个大数完全压过形状好坏。
        s += Math.log2(v) * (w[c] ?? 0);
        if (v > max) max = v;
      }
    }
  }
  // 空位奖励：越多越活泛，权重相对 log2 结果稍高，鼓励「先别把棋盘塞满」。
  return s * 1000 + empty * 200 + Math.log2(max || 1);
}

/** 单步的期望值搜索（player 视角）。 */
function expectimax(grid: Cell[][], depth: number, myTurn: boolean, weights: number[][]): number {
  if (!canMove(grid)) return -Infinity;
  if (depth === 0) return evaluate(grid, weights);

  if (myTurn) {
    let best = -Infinity;
    for (const dir of DIRS) {
      const { grid: next } = slideGrid(grid, dir);
      if (gridsEqual(grid, next)) continue;
      const v = expectimax(next, depth - 1, false, weights);
      if (v > best) best = v;
    }
    // 无合法方向由前置 canMove 拦截；这里防御性兜底
    return best === -Infinity ? evaluate(grid, weights) : best;
  }

  const empties = emptyCells(grid);
  if (empties.length === 0) return evaluate(grid, weights);

  let sum = 0;
  const perCell = 1 / empties.length;
  for (const [r, c] of empties) {
    for (const [v, p] of NEW_TILE_PROBS) {
      const g2 = cloneGrid(grid);
      g2[r]![c] = v;
      sum += perCell * p * expectimax(g2, depth - 1, true, weights);
    }
  }
  return sum;
}

export interface BestMoveOptions {
  /** 搜索深度（ply），默认 3。 */
  depth?: number;
}

/** 返回当前局面下最优方向；无解时 null。 */
export function bestMove(grid: Cell[][], opts: BestMoveOptions = {}): Direction | null {
  const depth = opts.depth ?? 3;
  if (!canMove(grid)) return null;
  const weights = buildWeights(grid.length);
  let best: Direction | null = null;
  let bestScore = -Infinity;
  for (const dir of DIRS) {
    const { grid: next } = slideGrid(grid, dir);
    if (gridsEqual(grid, next)) continue;
    const v = expectimax(next, depth - 1, false, weights);
    if (v > bestScore) {
      bestScore = v;
      best = dir;
    }
  }
  return best;
}

/**
 * 让 AI 自动跑完整局，返回结束时的评估值。用于单测/基准。
 *
 * 起点若为完全空盘（如 `createEmptyGrid`），会先按真实开局规则补两枚 2/4，
 * 否则空盘 canMove=false 会立刻退出。
 */
export function simulateUntilEnd(
  startGrid: Cell[][],
  opts: { maxSteps?: number; spawn?: (empties: Array<[number, number]>) => { r: number; c: number; v: Cell } | null; depth?: number } = {}
): { grid: Cell[][]; steps: number } {
  const grid = cloneGrid(startGrid);
  const depth = opts.depth ?? 3;
  const defaultSpawn = (empties: Array<[number, number]>): { r: number; c: number; v: Cell } | null => {
    if (empties.length === 0) return null;
    const idx = Math.floor(Math.random() * empties.length);
    const cell = empties[idx];
    if (!cell) return null;
    const [r, c] = cell;
    return { r, c, v: Math.random() < 0.9 ? 2 : 4 };
  };
  const spawnFn = opts.spawn ?? defaultSpawn;

  const placeInitial = () => {
    const empties = emptyCells(grid);
    const pick = spawnFn(empties);
    if (pick) grid[pick.r]![pick.c] = pick.v;
  };
  if (emptyCells(grid).length === grid.length * grid.length) {
    placeInitial();
    placeInitial();
  }

  let steps = 0;
  const cap = opts.maxSteps ?? 5000;
  while (steps < cap) {
    const dir = bestMove(grid, { depth });
    if (!dir) break;
    const { grid: after } = slideGrid(grid, dir);
    const empties = emptyCells(after);
    if (empties.length > 0) {
      const pick = spawnFn(empties);
      if (pick) after[pick.r]![pick.c] = pick.v;
    }
    grid.splice(0, grid.length, ...after);
    steps++;
    if (!canMove(grid)) break;
  }
  return { grid, steps };
}
