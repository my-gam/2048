import { describe, expect, it } from 'vitest';
import { Game2048 } from '../src/game';
import type { Cell, Direction, RandomSource, SaveStorage, Tile } from '../src/types';

/** 简易内存 Storage，供存档 round-trip 测试。 */
function memStorage(): SaveStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map)
  };
}

/** 固定种子序列 + 循环，让 spawn 可预测。 */
function scriptedRng(seq: number[]): RandomSource & { calls: number } {
  let i = 0;
  const fn = (() => {
    const v = seq[i % seq.length] ?? 0;
    i++;
    (fn as { calls: number }).calls = i;
    return v;
  }) as RandomSource & { calls: number };
  fn.calls = 0;
  return fn;
}

function toGrid(tiles: Tile[], size = 4): Cell[][] {
  const g: Cell[][] = Array.from({ length: size }, () => Array<Cell>(size).fill(0));
  for (const t of tiles) g[t.row]![t.col] = t.value;
  return g;
}

function findTile(tiles: Tile[], value: number): Tile | undefined {
  return tiles.find((t) => t.value === value);
}

describe('Game2048 初始状态', () => {
  it('newGame 生成两块、都标 isNew、值为 2 或 4', () => {
    const rng = scriptedRng([0.0, 0.0, 0.0, 0.0, 0.0]);
    const game = new Game2048({ storage: null, rng });
    const s = game.getState();
    expect(s.tiles.length).toBe(2);
    expect(s.tiles.every((t) => t.isNew)).toBe(true);
    expect(s.tiles.every((t) => t.value === 2 || t.value === 4)).toBe(true);
    expect(s.score).toBe(0);
    expect(s.status).toBe('playing');
    expect(s.moveCount).toBe(0);
  });

  it('rng 决定生成值：0.0 → 2, 0.95 → 4', () => {
    const gameA = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.0, 0.0, 0.0]) });
    expect(gameA.getState().tiles.every((t) => t.value === 2)).toBe(true);
    const gameB = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.95, 0.0, 0.95]) });
    expect(gameB.getState().tiles.every((t) => t.value === 4)).toBe(true);
  });
});

describe('Game2048 移动', () => {
  /**
   * 手工搭一个已知局面，绕过 newGame 的 spawn：用 newGame 后立刻注入存档。
   * 存档加载路径已经在下面单独测过，这里借用它构造测试起点。
   */
  function withBoard(tiles: Tile[]): Game2048 {
    const storage = memStorage();
    const save = {
      version: 1 as const,
      size: 4 as const,
      tiles,
      score: 0,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 0,
      nextTileId: Math.max(0, ...tiles.map((t) => t.id)) + 1
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    const rng = scriptedRng([0.0, 0.0]); // 下一次 spawn 落到 (0,0)、值 2
    return new Game2048({ storage, rng });
  }

  function tile(id: number, value: number, row: number, col: number): Tile {
    return { id, value, row, col, isNew: false, merged: false };
  }

  it('left 把两块 [2,0,2,0] 合成 [4,0,0,0]', () => {
    const game = withBoard([tile(1, 2, 0, 0), tile(2, 2, 0, 2)]);
    const ok = game.move('left');
    expect(ok).toBe(true);
    const s = game.getState();
    // 合并后 4 在 (0,0)，然后 spawn 在第一个可用位（rng=0.0 → 索引 0）
    expect(findTile(s.tiles, 4)).toBeDefined();
    expect(s.score).toBe(4);
    const survivor = findTile(s.tiles, 4)!;
    expect(survivor.merged).toBe(true);
    expect(survivor.row).toBe(0);
    expect(survivor.col).toBe(0);
  });

  it('非法方向：move 返回 false 且不改变状态', () => {
    // 两块都在 col 0，向左无解；right/up/down 都可能合法，只测 left 一步。
    const game = withBoard([tile(1, 2, 0, 0), tile(2, 4, 3, 0)]);
    const before = JSON.stringify(game.getState());
    const ok = game.move('left');
    expect(ok).toBe(false);
    expect(JSON.stringify(game.getState())).toBe(before);
  });

  it('tile.id 跨帧稳定：未合并的 tile 保留原 id', () => {
    // 用不同 value 让 findTile 无歧义：8 与 16；新 spawn 是 2，不会撞车。
    const game = withBoard([tile(1, 8, 3, 3), tile(2, 16, 0, 3)]);
    game.move('left');
    const s = game.getState();
    const t8 = findTile(s.tiles, 8);
    const t16 = findTile(s.tiles, 16);
    expect(t8?.id).toBe(1);
    expect(t16?.id).toBe(2);
    expect(t8?.col).toBe(0);
    expect(t16?.col).toBe(0);
  });

  it('每次 move 前重置 isNew/merged 标记（上一帧的动画标记不残留）', () => {
    const game = withBoard([tile(1, 2, 0, 0), tile(2, 2, 0, 2)]);
    game.move('left'); // 产生 merged=true 的 4 + isNew=true 的 spawn
    const after1 = game.getState();
    expect(findTile(after1.tiles, 4)?.merged).toBe(true);
    expect(after1.tiles.some((t) => t.isNew)).toBe(true);
    // 再动一步，之前 merged / isNew 的标记都应清掉
    game.move('down');
    const after2 = game.getState();
    const survivor = findTile(after2.tiles, 4);
    // 4 可能又参与了新合并（如果这次也 merged），或者只是被搬动；关键是它不再是刚 spawn
    expect(survivor?.isNew ?? false).toBe(false);
  });
});

describe('Game2048 胜负', () => {
  function tile(id: number, value: number, row: number, col: number): Tile {
    return { id, value, row, col, isNew: false, merged: false };
  }

  it('出现 2048 时 status = won；继续 move 被阻止直到 continuePlaying', () => {
    const storage = memStorage();
    const save = {
      version: 1 as const,
      size: 4 as const,
      tiles: [tile(1, 1024, 0, 0), tile(2, 1024, 0, 1)],
      score: 0,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 0,
      nextTileId: 3
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    const rng = scriptedRng([0.0, 0.0]);
    const game = new Game2048({ storage, rng });
    expect(game.move('left')).toBe(true);
    expect(game.getState().status).toBe('won');
    // won 状态下 move 被拒
    expect(game.move('down')).toBe(false);
    game.continuePlaying();
    expect(game.getState().status).toBe('playing');
    expect(game.getState().keepPlaying).toBe(true);
    // 继续可以玩
    expect(game.move('down')).toBe(true);
    // 后续即便再次出现 >= 2048 也不会重新触发 won
    expect(game.getState().status).not.toBe('won');
  });

  it('满盘且无合并可能时构造即判定 lost', () => {
    // checkerboard 布局：任何相邻两格值都不同（(r+c)%2 决定 2 或 4），
    // 棋盘满 → canMove=false → 构造函数载入后立即把 status 从 playing 改为 lost。
    const storage = memStorage();
    const tiles: Tile[] = [];
    let id = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        tiles.push(tile(id++, (r + c) % 2 === 0 ? 2 : 4, r, c));
      }
    }
    const save = {
      version: 1 as const,
      size: 4 as const,
      tiles,
      score: 200,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 20,
      nextTileId: id
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    const game = new Game2048({ storage, rng: scriptedRng([0.0, 0.0]) });
    expect(game.getState().status).toBe('lost');
    // 之后任何 move 也应直接 false，不改变状态
    const before = JSON.stringify(game.getState());
    for (const d of ['up', 'down', 'left', 'right'] as Direction[]) {
      expect(game.move(d)).toBe(false);
    }
    expect(JSON.stringify(game.getState())).toBe(before);
  });
});

describe('Game2048 撤销', () => {
  function tile(id: number, value: number, row: number, col: number): Tile {
    return { id, value, row, col, isNew: false, merged: false };
  }
  function fromTiles(tiles: Tile[], score = 0): Game2048 {
    const storage = memStorage();
    const save = {
      version: 1 as const,
      size: 4 as const,
      tiles,
      score,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 0,
      nextTileId: Math.max(0, ...tiles.map((t) => t.id)) + 1
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    return new Game2048({ storage, rng: scriptedRng([0.0, 0.0]) });
  }

  it('move 之后 undo 恢复原棋盘与得分', () => {
    const game = fromTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 2)]);
    const before = game.getState();
    game.move('left');
    const mid = game.getState();
    expect(mid.score).toBe(4);
    const ok = game.undo();
    expect(ok).toBe(true);
    const after = game.getState();
    expect(after.score).toBe(before.score);
    expect(after.tiles.length).toBe(before.tiles.length);
    expect(toGrid(after.tiles).flat().filter(Boolean)).toEqual(toGrid(before.tiles).flat().filter(Boolean));
  });

  it('undoLimit 之外的历史不再可撤销', () => {
    const game = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.0]), undoLimit: 2 });
    // 走 5 步（每步都合法）
    let moved = 0;
    const dirs: Direction[] = ['left', 'up', 'right', 'down'];
    for (let i = 0; i < 5; i++) {
      const d = dirs[i % 4] as Direction;
      if (game.move(d)) moved++;
    }
    expect(moved).toBeGreaterThan(0);
    let undoCount = 0;
    while (game.undo()) undoCount++;
    expect(undoCount).toBeLessThanOrEqual(2);
  });

  it('newGame 清空历史', () => {
    const game = fromTiles([tile(1, 2, 0, 0), tile(2, 2, 0, 2)]);
    game.move('left');
    game.newGame();
    expect(game.undo()).toBe(false);
    expect(game.getState().score).toBe(0);
  });
});

describe('Game2048 订阅', () => {
  it('subscribe 会立刻收到快照，之后每次操作各推一次', () => {
    const game = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.0]) });
    const seen: number[] = [];
    const unsub = game.subscribe((s) => seen.push(s.moveCount));
    expect(seen).toEqual([0]); // 初次推送
    game.move('left');
    // move 若合法 → 又推一次；棋盘只两块 2 时可能非法。用 newGame 保证后续合法。
    game.newGame();
    expect(seen.length).toBeGreaterThanOrEqual(2);
    unsub();
    const before = seen.length;
    game.newGame();
    expect(seen.length).toBe(before); // 退订后不再推
  });

  it('getState 返回深拷贝：外部改 tiles 数组不影响内部', () => {
    const game = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.0]) });
    const s = game.getState();
    s.tiles[0]!.value = 999999;
    s.tiles.push({ id: -1, value: 0, row: 0, col: 0, isNew: false, merged: false });
    const s2 = game.getState();
    expect(s2.tiles.every((t) => t.value !== 999999)).toBe(true);
    expect(s2.tiles.some((t) => t.id === -1)).toBe(false);
  });
});

describe('Game2048 存档 round-trip', () => {
  function tile(id: number, value: number, row: number, col: number): Tile {
    return { id, value, row, col, isNew: false, merged: false };
  }
  it('同一 storage 上二次构造会读回原局面', () => {
    const storage = memStorage();
    const save = {
      version: 1 as const,
      size: 4 as const,
      tiles: [tile(1, 16, 0, 0), tile(2, 32, 1, 2)],
      score: 4096,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 42,
      nextTileId: 3
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    const game = new Game2048({ storage, rng: scriptedRng([0.0, 0.0]) });
    const s = game.getState();
    expect(s.score).toBe(4096);
    expect(s.moveCount).toBe(42);
    expect(s.tiles.length).toBe(2);
    const t16 = findTile(s.tiles, 16);
    expect(t16?.row).toBe(0);
    expect(t16?.col).toBe(0);
    expect(t16?.isNew).toBe(false); // 载入后清掉动画标记
  });

  it('bestScore 单独持久化，newGame 不重置它', () => {
    const storage = memStorage();
    const g1 = new Game2048({ storage, rng: scriptedRng([0.0, 0.0]) });
    // 让 g1 拿到一个分数：通过 move 或直接绕过——简化：手工写 best 键。
    storage.setItem('game-2048:best', '99999');
    // 重新构造会读回 best
    const g2 = new Game2048({ storage, rng: scriptedRng([0.0, 0.0]) });
    expect(g2.getState().bestScore).toBe(99999);
    g2.newGame();
    expect(g2.getState().bestScore).toBe(99999);
  });

  it('损坏的存档 JSON 会被安全忽略并开新局', () => {
    const storage = memStorage();
    storage.setItem('game-2048:save', '{ broken json');
    const game = new Game2048({ storage, rng: scriptedRng([0.0, 0.0]) });
    expect(game.getState().tiles.length).toBe(2);
    expect(game.getState().score).toBe(0);
  });

  it('size 不匹配的存档会被丢弃并开新局', () => {
    const storage = memStorage();
    const save = {
      version: 1 as const,
      size: 5 as const,
      tiles: [] as Tile[],
      score: 999,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 0,
      nextTileId: 1
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    const game = new Game2048({ storage, size: 4, rng: scriptedRng([0.0, 0.0]) });
    expect(game.getState().score).toBe(0);
  });

  it('freshStart 忽略已有存档', () => {
    const storage = memStorage();
    const save = {
      version: 1 as const,
      size: 4 as const,
      tiles: [tile(1, 16, 0, 0), tile(2, 32, 1, 2)],
      score: 4096,
      status: 'playing' as const,
      keepPlaying: false,
      moveCount: 42,
      nextTileId: 3
    };
    storage.setItem('game-2048:save', JSON.stringify(save));
    const game = new Game2048({ storage, freshStart: true, rng: scriptedRng([0.0, 0.0]) });
    expect(game.getState().score).toBe(0);
  });
});

describe('Game2048 边界', () => {
  it('storage: null 完全禁用持久化', () => {
    const game = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.0]) });
    // 不会抛错
    expect(game.getState().tiles.length).toBe(2);
    game.move('left');
    game.newGame();
  });

  it('subscribe 期间某个 listener 抛错，其他 listener 仍收到通知', () => {
    const game = new Game2048({ storage: null, rng: scriptedRng([0.0, 0.0]) });
    const errs: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      errs.push(args);
    };
    let count = 0;
    game.subscribe(() => {
      throw new Error('boom');
    });
    game.subscribe(() => {
      count++;
    });
    game.newGame();
    console.error = origError;
    expect(count).toBeGreaterThan(1); // 首个 subscribe 时会同步推一次，newGame 再推一次
    expect(errs.length).toBeGreaterThan(0);
  });
});
