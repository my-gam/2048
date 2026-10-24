export { default as Game2048 } from './Game2048.vue';
export { useGame, type UseGameOptions, type UseGameReturn } from './useGame';
export type { Game2048Instance } from './instance';

// 顺手把 core 的关键类型透出来，宿主项目不需要额外装 core 也能拿到方向等类型。
export type {
  BoardSize,
  Direction,
  GameState,
  GameStatus,
  SaveStorage,
  Tile
} from '@my-games/2048-core';
