import type { Direction } from '@my-games/game-2048-core';

/**
 * 组件 `ref` 上暴露的方法（`defineExpose` 的对应类型）。
 * 供父组件用 `const g = ref<Game2048Instance>()` 精确声明类型。
 */
export interface Game2048Instance {
  suggestMove(): Direction | null;
  aiMove(): Direction | null;
  newGame(): void;
  undo(): boolean;
  move(dir: Direction): boolean;
  continuePlaying(): void;
}
