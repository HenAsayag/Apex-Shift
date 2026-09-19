import { defineConfig } from "vite";
import { ghostPlugin } from "./server/ghost-service.js";
export default defineConfig({
  base: process.env.VITE_STATIC_PAGES === "true" ? "/Apex-Shift/" : "/",
  plugins: [ghostPlugin()],
  optimizeDeps: { exclude: ["three"] },
  server: { port: 5187, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
