import type { Cell, Direction } from './types';

/**
 * 纯函数棋盘工具：只用 `Cell[][]`（0 = 空），不涉及 tile id。
 *
 * 设计原则：所有会「改变棋盘」的函数都返回新数组，不原地修改。
 * Game2048 与 AI 都建立在这套底层原语上。
 */

export function createEmptyGrid(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(0));
}

export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.slice());
}

/** 生成所有空位坐标（row-major 顺序）。 */
export function emptyCells(grid: Cell[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 0) out.push([r, c]);
    }
  }
  return out;
}

/**
 * 把一行「向左压缩 + 相邻等值合并」。
 * 每个 tile 只允许在一次 slide 中参与一次合并，符合 2048 官方规则。
 * 返回：新 line（长度不变）+ 本行得分增量。
 */
export function slideLineLeft(line: readonly Cell[]): { line: Cell[]; gained: number } {
  const source = line.filter((v) => v !== 0);
  const result: Cell[] = [];
  let gained = 0;
  let i = 0;
  while (i < source.length) {
    const a = source[i] as Cell;
    const b = source[i + 1];
    if (b !== undefined && a === b) {
      const merged = a * 2;
      result.push(merged);
      gained += merged;
      i += 2;
    } else {
      result.push(a);
      i += 1;
    }
  }
  while (result.length < line.length) result.push(0);
  return { line: result, gained };
}

function reverseLine(line: readonly Cell[]): Cell[] {
  return line.slice().reverse();
}

/** 沿方向向量把整个棋盘压缩一次；返回新 grid 与得分。 */
export function slideGrid(grid: Cell[][], dir: Direction): { grid: Cell[][]; gained: number } {
  const size = grid.length;
  const out = createEmptyGrid(size);
  let gained = 0;
  // 将「读取顺序」抽象成：取每条「line」——按 dir 头部开始往尾部读——
  // 交给 slideLineLeft 处理，再写回对应位置。
  for (let k = 0; k < size; k++) {
    const line: Cell[] = [];
    for (let i = 0; i < size; i++) {
      line.push(readCell(grid, dir, k, i));
    }
    const reversed = dir === 'right' || dir === 'down';
    const input = reversed ? reverseLine(line) : line;
    const { line: processed, gained: g } = slideLineLeft(input);
    gained += g;
    const output = reversed ? reverseLine(processed) : processed;
    for (let i = 0; i < size; i++) {
      writeCell(out, dir, k, i, output[i] as Cell);
    }
  }
  return { grid: out, gained };
}

/**
 * 将 (k=线序号, i=线内序号) 映射到具体 cell 坐标：
 * - left : row=k, col=i   （每行从左侧读）
 * - right: row=k, col=i   （读时按 i 反向由 slideGrid 处理）
 * - up   : row=i, col=k   （每列从上读）
 * - down : row=i, col=k
 * 注意：这里 readCell 只按「物理方向」取格子；反向压缩由 slideGrid 外面 reverseLine 承担。
 */
function readCell(grid: Cell[][], dir: Direction, k: number, i: number): Cell {
  switch (dir) {
    case 'left':
      return grid[k]?.[i] ?? 0;
    case 'right':
      return grid[k]?.[i] ?? 0;
    case 'up':
      return grid[i]?.[k] ?? 0;
    case 'down':
      return grid[i]?.[k] ?? 0;
  }
}

function writeCell(grid: Cell[][], dir: Direction, k: number, i: number, v: Cell): void {
  switch (dir) {
    case 'left':
    case 'right':
      {
        const row = grid[k];
        if (row) row[i] = v;
      }
      break;
    case 'up':
    case 'down':
      {
        const row = grid[i];
        if (row) row[k] = v;
      }
      break;
  }
}

export function gridsEqual(a: Cell[][], b: Cell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    const ra = a[r];
    const rb = b[r];
    if (!ra || !rb) return false;
    for (let c = 0; c < ra.length; c++) {
      if (ra[c] !== rb[c]) return false;
    }
  }
  return true;
}

/** 该方向是否有可移动的空间（含合并）。用于判定是否 game over。 */
export function canMove(grid: Cell[][]): boolean {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  for (const d of dirs) {
    const { grid: next } = slideGrid(grid, d);
    if (!gridsEqual(grid, next)) return true;
  }
  return false;
}

/** 是否达到目标值（默认 2048）。 */
export function hasValue(grid: Cell[][], target: number): boolean {
  for (const row of grid) for (const v of row) if (v === target) return true;
  return false;
}

/** 把值网格内的最大值取出来（调试用）。 */
export function maxValue(grid: Cell[][]): number {
  let m = 0;
  for (const row of grid) for (const v of row) if (v > m) m = v;
  return m;
}
