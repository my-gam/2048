import type { SaveStorage, SerializedSave } from './types';

/**
 * 存档字段与版本控制。
 *
 * 版本演进策略：读到的 version 与当前 SAVE_VERSION 不一致时，走 `migrate()`；
 * 无法识别的直接丢弃并让 Game 开新局。目前只有 v1。
 */
export const SAVE_VERSION = 1 as const;
export const DEFAULT_SAVE_KEY = 'game-2048:save';
export const DEFAULT_BEST_KEY = 'game-2048:best';

export function isSerializedSave(x: unknown): x is SerializedSave {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o['version'] === SAVE_VERSION &&
    typeof o['size'] === 'number' &&
    Array.isArray(o['tiles']) &&
    typeof o['score'] === 'number'
  );
}

export function loadSave(storage: SaveStorage | null, key: string): SerializedSave | null {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSerializedSave(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSave(storage: SaveStorage | null, key: string, save: SerializedSave): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(save));
  } catch {
    /* quota / 隐私模式静默忽略；不阻断游戏 */
  }
}

export function clearSave(storage: SaveStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadBest(storage: SaveStorage | null, key: string): number {
  if (!storage) return 0;
  const raw = storage.getItem(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function writeBest(storage: SaveStorage | null, key: string, best: number): void {
  if (!storage) return;
  try {
    storage.setItem(key, String(Math.floor(best)));
  } catch {
    /* ignore */
  }
}

/** 浏览器环境下的默认 Storage（找不到返回 null，让 core 在无 DOM 环境也能跑）。 */
export function tryGetGlobalStorage(): SaveStorage | null {
  if (typeof globalThis === 'undefined') return null;
  const s = (globalThis as { localStorage?: SaveStorage }).localStorage;
  return s ?? null;
}
