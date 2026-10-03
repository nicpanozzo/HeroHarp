import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// Un unico file HTML che si apre anche con doppio clic (file://), senza server.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: { chunkSizeWarningLimit: 3000, assetsInlineLimit: 100_000_000 },
  test: { include: ["tests/**/*.test.ts"] },
});
