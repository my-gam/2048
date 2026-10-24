import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Vue 包 lib 模式构建：
 * - JS bundle：vite lib + vue 插件；vue / core 走 external 不重复打包
 * - `.d.ts`：vite-plugin-dts 从 .vue / .ts 源码提取类型并 rollup 成单文件，
 *   让下游纯 tsc 环境也能拿到 Game2048 组件的完整类型（不强依赖 vue-tsc）
 *
 * 发布产物：dist/index.js + dist/index.d.ts + dist/style.css
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      outDir: 'dist',
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: ['vue', '@my-games/2048-core']
    },
    sourcemap: true,
    emptyOutDir: true
  }
});
