import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vite';

/**
 * core 包也走 vite build --mode lib：
 * - JS：esbuild/rolldown 转译 .ts（不做类型检查）
 * - 类型：vite-plugin-dts 从 .ts 源码提取并 rollup 成 dist/index.d.ts
 * - 类型检查由独立的 `pnpm --filter core typecheck` = `tsc --noEmit` 负责
 *
 * 与 vue/react 保持工具链一致；未来 rolldown-vite 或 tsgo 原生支持升级时只改这一处。
 *
 * Vite 8 的 config loader 在 ESM 上下文里没有 `__dirname`，用 fileURLToPath。
 */
const entryFile = fileURLToPath(new URL('./src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: entryFile,
      formats: ['es'],
      fileName: 'index'
    },
    sourcemap: true,
    emptyOutDir: true,
    target: 'es2020',
    minify: false
  }
});
