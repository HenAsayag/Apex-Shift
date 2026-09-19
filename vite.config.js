import { defineConfig } from "vite";
import { ghostPlugin } from "./server/ghost-service.js";
export default defineConfig({
  plugins: [ghostPlugin()],
  optimizeDeps: { exclude: ["three"] },
  server: { port: 5187, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
