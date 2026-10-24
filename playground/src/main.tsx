import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 组件包的样式：vite lib build 会把内部 CSS import 抽到 dist/index.css，
// JS 不再引用；消费者（含本 playground）需要显式加载一次。
// vue/react 两个包都各自产一份 dist/index.css（内容相同），只需加载一份。
import '@my-games/2048-vue/style.css';
import { App } from './App';
import './playground.css';

const el = document.getElementById('app');
if (!el) throw new Error('#app not found');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>
);
