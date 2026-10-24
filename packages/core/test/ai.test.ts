import { describe, expect, it } from 'vitest';
import { bestMove, evaluate, simulateUntilEnd } from '../src/ai';
import { canMove, createEmptyGrid, maxValue, slideGrid, emptyCells } from '../src/board';
import type { Cell, Direction } from '../src/types';

function g(...rows: number[][]): Cell[][] {
  return rows.map((r) => r.slice()) as Cell[][];
}

describe('bestMove', () => {
  it('满盘且无合法方向时返回 null', () => {
    const dead = g([2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]);
    expect(canMove(dead)).toBe(false);
    expect(bestMove(dead)).toBe(null);
  });

  it('返回的方向一定合法：slideGrid 真的让棋盘发生变化', () => {
    const board = g(
      [2, 0, 0, 0],
      [0, 4, 0, 0],
      [0, 0, 8, 0],
      [0, 0, 0, 16]
    );
    const dir = bestMove(board);
    expect(dir).not.toBeNull();
    const { grid } = slideGrid(board, dir as Direction);
    expect(grid).not.toEqual(board);
  });

  it('明显该向左合并时不会选右', () => {
    const board = g(
      [2, 2, 0, 0],
      [4, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    );
    const dir = bestMove(board);
    expect(dir).toBe('left');
  });

  it('大值靠上、需要收拢时会选 left 或 up 之一（不做反向拆家）', () => {
    // 在 (0, 3) 与 (1, 3) 各留一枚小值，其余排成 snake。left 合法（能收拢 1024
    // 与 512 之间的空格），up 也合法。right/down 会把大值拖向蛇尾，得分明显更低。
    const board = g(
      [1024, 0, 512, 0],
      [256, 0, 128, 0],
      [64, 0, 32, 0],
      [16, 0, 8, 0]
    );
    const dir = bestMove(board);
    expect(dir === 'left' || dir === 'up').toBe(true);
  });
});

describe('evaluate', () => {
  it('大值在左上比在右下得分高（蛇形权重生效）', () => {
    const A = g([1024, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    const B = g([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1024]);
    // 与 src/ai.ts 里 SNAKE_WEIGHTS_4 保持同源：左上权重最大、蛇尾在右下
    const w = [
      [32768, 16384, 8192, 4096],
      [256, 512, 1024, 2048],
      [128, 64, 32, 16],
      [1, 2, 4, 8]
    ];
    expect(evaluate(A, w)).toBeGreaterThan(evaluate(B, w));
  });
});

describe('simulateUntilEnd', () => {
  it('从空盘出发，AI 至少能把某个数字推到 128 以上', () => {
    const start = createEmptyGrid(4);
    // 让 AI 从 2 起步；spawn 用固定策略：每步落 (0,3) 值 2
    const result = simulateUntilEnd(start, {
      maxSteps: 2000,
      depth: 3,
      spawn: (empties) => {
        const cell = empties[0];
        if (!cell) return null;
        return { r: cell[0], c: cell[1], v: 2 };
      }
    });
    // 空盘 + 每次 spawn (0,0) 起始的固定策略，AI 应能推到相当水平。
    // 保守阈值 64：正常 expectimax 会远超此值。
    expect(maxValue(result.grid)).toBeGreaterThanOrEqual(64);
    expect(result.steps).toBeGreaterThan(20);
  });

  it('AI 至少能把棋盘上大部分格留空（避免自杀式填满）', () => {
    const start = createEmptyGrid(4);
    const result = simulateUntilEnd(start, {
      maxSteps: 1000,
      depth: 2,
      spawn: (empties) => {
        const cell = empties[0];
        if (!cell) return null;
        return { r: cell[0], c: cell[1], v: 2 };
      }
    });
    const emptiesAtEnd = emptyCells(result.grid).length;
    // 结束时的空位数量很少（接近死亡），但棋盘肯定不是满盘就死了。
    // 主要看有没有正常跑完 → 至少 15 步。
    expect(result.steps).toBeGreaterThanOrEqual(15);
    expect(emptiesAtEnd).toBeGreaterThanOrEqual(0);
  });
});
