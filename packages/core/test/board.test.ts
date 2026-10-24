import { describe, expect, it } from 'vitest';
import {
  canMove,
  createEmptyGrid,
  emptyCells,
  gridsEqual,
  hasValue,
  slideGrid,
  slideLineLeft
} from '../src/board';
import type { Cell } from '../src/types';

function g(...rows: number[][]): Cell[][] {
  return rows.map((r) => r.slice()) as Cell[][];
}

describe('slideLineLeft', () => {
  it('滑动紧凑化：非零值向左靠拢', () => {
    expect(slideLineLeft([0, 2, 0, 4]).line).toEqual([2, 4, 0, 0]);
  });

  it('相邻等值合并一次：[2,2,0,0] → [4,0,0,0]', () => {
    const { line, gained } = slideLineLeft([2, 2, 0, 0]);
    expect(line).toEqual([4, 0, 0, 0]);
    expect(gained).toBe(4);
  });

  it('四块成对：[2,2,2,2] → [4,4,0,0]（每块只允许合并一次）', () => {
    const { line, gained } = slideLineLeft([2, 2, 2, 2]);
    expect(line).toEqual([4, 4, 0, 0]);
    expect(gained).toBe(8);
  });

  it('非相邻等值不合并：[2,4,2,0] 保持顺序', () => {
    const { line, gained } = slideLineLeft([2, 4, 2, 0]);
    expect(line).toEqual([2, 4, 2, 0]);
    expect(gained).toBe(0);
  });

  it('首个 0 让合并对错位：[2,0,2,4] → [4,4,0,0]', () => {
    const { line, gained } = slideLineLeft([2, 0, 2, 4]);
    // 压缩后 [2,2,4]，(2,2) 合并成 4 得 4，独立 4 不再叠加。
    expect(line).toEqual([4, 4, 0, 0]);
    expect(gained).toBe(4);
  });

  it('三连不重复吃：[2,2,4,0] → [4,4,0,0]，不继续合并成 [8]', () => {
    const { line, gained } = slideLineLeft([2, 2, 4, 0]);
    // 第一对 2,2 合并成 4；后面 4 独立；不叠加为 8。
    expect(line).toEqual([4, 4, 0, 0]);
    expect(gained).toBe(4);
  });
});

describe('slideGrid', () => {
  const start = g(
    [2, 0, 2, 4],
    [0, 4, 0, 0],
    [8, 8, 8, 8],
    [2, 2, 4, 4]
  );

  it('left：每行独立向左压缩合并', () => {
    const { grid } = slideGrid(start, 'left');
    expect(grid).toEqual(g(
      [4, 4, 0, 0],
      [4, 0, 0, 0],
      [16, 16, 0, 0],
      [4, 8, 0, 0]
    ));
  });

  it('right：镜像方向', () => {
    const { grid } = slideGrid(start, 'right');
    expect(grid).toEqual(g(
      [0, 0, 4, 4],
      [0, 0, 0, 4],
      [0, 0, 16, 16],
      [0, 0, 4, 8]
    ));
  });

  it('up：列内独立向上', () => {
    const { grid } = slideGrid(start, 'up');
    // 列 0: 2,0,8,2 → 2,8,2 无相邻合并 → [2,8,2,0]
    // 列 1: 0,4,8,2 → 4,8,2 → [4,8,2,0]
    // 列 2: 2,0,8,4 → 2,8,4 → [2,8,4,0]
    // 列 3: 4,0,8,4 → 4,8,4 → [4,8,4,0]
    expect(grid).toEqual(g(
      [2, 4, 2, 4],
      [8, 8, 8, 8],
      [2, 2, 4, 4],
      [0, 0, 0, 0]
    ));
  });

  it('down：列内独立向下（每列非零值靠底、无相邻同值不合并）', () => {
    const { grid } = slideGrid(start, 'down');
    // col 0: [2,0,8,2] → [0,2,8,2];  col 1: [0,4,8,2] → [0,4,8,2]
    // col 2: [2,0,8,4] → [0,2,8,4];  col 3: [4,0,8,4] → [0,4,8,4]
    // 注意：col 3 里 (0,3)=4 与 (3,3)=4 中间被 8 隔开，不合并。
    expect(grid).toEqual(g(
      [0, 0, 0, 0],
      [2, 4, 2, 4],
      [8, 8, 8, 8],
      [2, 2, 4, 4]
    ));
  });

  it('得分正确累加：left 各行合并得分 = 4 + 0 + 32 + 12 = 48', () => {
    const { gained } = slideGrid(start, 'left');
    // 第一行 [2,0,2,4] → [4,4,0,0]：一对 2+2 得 4。
    // 第二行 [0,4,0,0] → [4,0,0,0]：无合并，得 0。
    // 第三行 [8,8,8,8] → [16,16,0,0]：两对 8+8 各得 16，共 32。
    // 第四行 [2,2,4,4] → [4,8,0,0]：一对 2+2 得 4，一对 4+4 得 8，共 12。
    expect(gained).toBe(48);
  });
});

describe('辅助函数', () => {
  it('createEmptyGrid 生成 size×size 全 0', () => {
    const grid = createEmptyGrid(4);
    expect(grid.length).toBe(4);
    expect(grid.every((r) => r.length === 4 && r.every((v) => v === 0))).toBe(true);
  });

  it('emptyCells 返回行优先坐标', () => {
    const cells = emptyCells(g([0, 2, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 8]));
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[1]).toEqual([0, 2]);
    // 只查前几个断言，避免脆断
  });

  it('gridsEqual 严格相等', () => {
    expect(gridsEqual(g([2, 0], [0, 4]), g([2, 0], [0, 4]))).toBe(true);
    expect(gridsEqual(g([2, 0], [0, 4]), g([2, 0], [0, 0]))).toBe(false);
  });

  it('canMove 满棋盘有可合并对时 true', () => {
    expect(canMove(g([2, 2], [4, 8]))).toBe(true);
  });

  it('canMove 满棋盘无合并可能时 false', () => {
    expect(canMove(g([2, 4], [8, 16]))).toBe(false);
  });

  it('hasValue 检测目标值出现', () => {
    expect(hasValue(g([1024, 1024], [0, 0]), 2048)).toBe(false); // 还没合并
    expect(hasValue(g([2048, 4], [0, 0]), 2048)).toBe(true);
  });
});
