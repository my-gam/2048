import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Vue 包的库模式构建：产出一个 ESM bundle + 一份 d.ts（d.ts 由外部工具或源码
 * 类型直接提供；本包以「源码 workspace 消费」为主，dist 只是给发布准备的兜底）。
 *
 * 关键：`external` 保留 vue 与 core 让宿主解决，避免把 Vue 打进组件包里。
 */
export default defineConfig({
  plugins: [vue()],
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
