import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发模式:前端 5173,代理 /api 与 /socket.io(含 WebSocket)到后端 3000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", changeOrigin: true },
      "/socket.io": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
