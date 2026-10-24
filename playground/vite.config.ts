import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/**
 * Playground 同时启用 Vue 与 React 插件：
 * - .vue 走 plugin-vue
 * - .tsx 走 plugin-react
 * 两包都是 workspace 内源码直连（package.json 的 exports 指向 src），
 * 改一行代码刷新浏览器立刻生效，不需要先 build 三包。
 */
export default defineConfig({
  plugins: [vue(), react()],
  server: {
    port: 5173,
    strictPort: false,
    host: '127.0.0.1'
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true
  }
});
