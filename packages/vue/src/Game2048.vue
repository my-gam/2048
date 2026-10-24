<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import '@my-games/2048-core/styles.css';
import { useGame } from './useGame';
import type { Direction } from '@my-games/2048-core';

/**
 * Game2048 —— Vue 3 官方组件。
 *
 * 输入模型：
 * - 键盘：window 监听 keydown，但只有 board 元素拥有 DOM 焦点时才处理。
 *   多实例并存时用户点击 / 触摸哪个，哪个成为「活动」实例；`autofocus=true`
 *   （默认）让第一个实例在 mount 时自动 focus，符合单实例场景直觉。
 * - 触摸：board 上的单指 swipe，主导轴决定方向；阈值 24px。
 *
 * 动画：
 * - 新块：scale-in
 * - 合并：pop 弹跳
 * - 滑动：transform transition
 *
 * AI：`enableAI=true` 打开「提示」/「AI 帮走」按钮；未打开时依然可以通过
 * template ref 拿到 `suggestMove` / `aiMove` 方法（`defineExpose`）。
 */

interface Props {
  size?: 3 | 4 | 5 | 6;
  storage?: import('@my-games/2048-core').SaveStorage | null;
  saveKey?: string;
  bestKey?: string;
  freshStart?: boolean;
  autofocus?: boolean;
  enableAI?: boolean;
  aiDepth?: number;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 4,
  storage: undefined,
  saveKey: undefined,
  bestKey: undefined,
  freshStart: false,
  autofocus: true,
  enableAI: false,
  aiDepth: 3,
  title: '2048'
});

const emit = defineEmits<{
  (e: 'move', dir: Direction, gained: number): void;
  (e: 'won'): void;
  (e: 'lost'): void;
}>();

const { state, move, newGame, undo, continuePlaying, suggestMove, aiMove } = useGame({
  size: props.size,
  storage: props.storage,
  saveKey: props.saveKey,
  bestKey: props.bestKey,
  freshStart: props.freshStart,
  aiDepth: props.aiDepth
});

const boardEl = ref<HTMLDivElement | null>(null);
const scoreDelta = ref<{ amount: number; key: number } | null>(null);
const aiHint = ref<Direction | null>(null);
const lastScore = ref(state.value.score);
const lastStatus = ref(state.value.status);
let deltaTimer: number | undefined;

// 手动 watch：Vue 的 watch 需要在 setup 里 import；这里用普通 getter 触发
// 每次订阅推来的新 state 时，state.value 会变，computed 重算 → DOM 更新。
// 分数变化与 status 变化通过在 update 回调里对比 last 值实现（见下方 subscribe 二次挂载）。
// 简化：把状态变化处理放在 useGame 的订阅里；这里只保留必要的 reactive。

// --- 键盘 ---
const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right'
};

function isBoardFocused(): boolean {
  if (typeof document === 'undefined') return false;
  return document.activeElement === boardEl.value;
}

function onKey(ev: KeyboardEvent) {
  const dir = KEY_TO_DIR[ev.key];
  if (!dir) return;
  if (!isBoardFocused()) return;
  ev.preventDefault();
  performMove(dir);
}

function performMove(dir: Direction) {
  const before = state.value.score;
  const ok = move(dir);
  if (ok) {
    emit('move', dir, state.value.score - before);
    if (props.enableAI) aiHint.value = null;
  }
}

// --- 触摸 ---
let touchStartPoint: { x: number; y: number } | null = null;
function onTouchStart(ev: TouchEvent) {
  if (ev.touches.length !== 1) return;
  const t = ev.touches[0];
  if (!t) return;
  touchStartPoint = { x: t.clientX, y: t.clientY };
  // 触摸时把焦点转到本 board，让后续键盘操作也生效
  boardEl.value?.focus({ preventScroll: true });
}
function onTouchEnd(ev: TouchEvent) {
  const start = touchStartPoint;
  touchStartPoint = null;
  if (!start) return;
  const t = ev.changedTouches[0];
  if (!t) return;
  const dx = t.clientX - start.x;
  const dy = t.clientY - start.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (Math.max(adx, ady) < 24) return;
  const dir: Direction = adx > ady ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  performMove(dir);
}

onMounted(() => {
  if (props.autofocus) boardEl.value?.focus({ preventScroll: true });
  window.addEventListener('keydown', onKey, { passive: false });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  if (deltaTimer) window.clearTimeout(deltaTimer);
});

// --- 分数 & 状态 side-effect ---
watch(
  () => state.value.score,
  (now, prev) => {
    const gained = now - (prev ?? lastScore.value);
    if (gained > 0) {
      scoreDelta.value = { amount: gained, key: Date.now() + Math.random() };
      if (deltaTimer) window.clearTimeout(deltaTimer);
      deltaTimer = window.setTimeout(() => (scoreDelta.value = null), 700);
    }
    lastScore.value = now;
  }
);
watch(
  () => state.value.status,
  (s) => {
    if (s === lastStatus.value) return;
    if (s === 'won') emit('won');
    else if (s === 'lost') emit('lost');
    lastStatus.value = s;
  }
);

// --- 渲染辅助 ---
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${state.value.size}, 1fr)`,
  gridTemplateRows: `repeat(${state.value.size}, 1fr)`
}));

const boardVars = computed(() => ({ '--cols': String(state.value.size) }));

function tileVars(row: number, col: number) {
  return { '--row': String(row), '--col': String(col) } as Record<string, string>;
}

function tileClass(t: { value: number; isNew: boolean; merged: boolean }) {
  return {
    'is-new': t.isNew,
    'is-merged': t.merged,
    'is-super': t.value > 2048
  };
}

function tileAttrs(t: { value: number }) {
  return t.value > 2048
    ? { 'data-super': '1' }
    : {};
}

const overlayVisible = computed(() => state.value.status !== 'playing');
const isWon = computed(() => state.value.status === 'won');
const isLost = computed(() => state.value.status === 'lost');
const undoDisabled = computed(() => state.value.historySize === 0);

// --- AI ---
function onAskAI() {
  aiHint.value = suggestMove();
}
function onDoAI() {
  const before = state.value.score;
  const dir = aiMove();
  if (dir) {
    emit('move', dir, state.value.score - before);
    aiHint.value = null;
  }
}

defineExpose({ suggestMove, aiMove, newGame, undo, move, continuePlaying });
</script>

<template>
  <div class="game-2048">
    <header v-if="title" class="game-2048-header">
      <h1 class="game-2048-title">{{ title }}</h1>
      <div class="game-2048-scores">
        <div class="game-2048-score-box">
          <span class="label">Score</span>
          <span class="value">{{ state.score }}</span>
          <span
            v-if="scoreDelta"
            :key="scoreDelta.key"
            class="delta"
            >+{{ scoreDelta.amount }}</span
          >
        </div>
        <div class="game-2048-score-box">
          <span class="label">Best</span>
          <span class="value">{{ state.bestScore }}</span>
        </div>
      </div>
    </header>

    <div class="game-2048-toolbar">
      <p class="game-2048-desc">
        合并相同数字，冲过 <b>2048</b>。方向键 / WASD / 触屏滑动。
      </p>
      <div class="game-2048-actions">
        <button
          v-if="enableAI"
          class="game-2048-button"
          type="button"
          :disabled="isLost"
          @click="onAskAI"
        >
          提示
        </button>
        <button
          v-if="enableAI"
          class="game-2048-button"
          type="button"
          :disabled="isLost"
          @click="onDoAI"
        >
          AI 帮走
        </button>
        <button class="game-2048-button" type="button" :disabled="undoDisabled" @click="undo()">
          撤销
        </button>
        <button class="game-2048-button is-primary" type="button" @click="newGame()">
          新游戏
        </button>
      </div>
    </div>

    <div
      ref="boardEl"
      class="game-2048-board"
      :style="boardVars"
      tabindex="0"
      role="application"
      :aria-label="`2048 游戏板 ${state.status}`"
      @touchstart.passive="onTouchStart"
      @touchend.prevent="onTouchEnd"
    >
      <div class="game-2048-grid" :style="gridStyle">
        <div v-for="i in state.size * state.size" :key="i" class="game-2048-cell" />
      </div>
      <div class="game-2048-tile-layer">
        <div
          v-for="t in state.tiles"
          :key="t.id"
          class="game-2048-tile"
          :class="tileClass(t)"
          :style="tileVars(t.row, t.col)"
          :data-value="t.value"
          v-bind="tileAttrs(t)"
        >
          {{ t.value }}
        </div>
      </div>

      <div
        v-if="enableAI && aiHint"
        class="game-2048-ai-indicator"
        style="position: absolute; top: 8px; left: 8px; z-index: 3"
      >
        推荐：{{ aiHint }}
      </div>

      <div
        class="game-2048-overlay"
        :class="{ 'is-visible': overlayVisible, 'is-won': isWon, 'is-lost': isLost }"
      >
        <h2 v-if="isWon">你赢了！</h2>
        <h2 v-else-if="isLost">游戏结束</h2>
        <div class="row">
          <button v-if="isWon" class="game-2048-button" type="button" @click="continuePlaying()">
            继续游戏
          </button>
          <button
            v-if="isLost && !undoDisabled"
            class="game-2048-button"
            type="button"
            @click="undo()"
          >
            悔一步
          </button>
          <button
            v-if="overlayVisible"
            class="game-2048-button is-primary"
            type="button"
            @click="newGame()"
          >
            再来一局
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
