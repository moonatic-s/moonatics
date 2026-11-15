import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// A plain static single-page app. `base: "./"` makes every asset path relative, so the same build works on
// GitHub Pages under any repository name (https://user.github.io/repo-name/) without extra settings.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 8080, host: true },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
});
