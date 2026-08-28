import { defineConfig } from "vite";

// 仅用于 dev:vite 热更新。经典 <script src> 不会被 Vite 打包/复制，
// `vite build` 产出的 dist 缺少全部 js（白屏），切勿部署 dist；
// 线上部署 = 仓库根目录直传 Pages（npx wrangler pages deploy .）
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.js"],
  },
});
