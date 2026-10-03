import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Un unico file HTML che si apre anche con doppio clic (file://), senza server.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: { chunkSizeWarningLimit: 3000 },
});
