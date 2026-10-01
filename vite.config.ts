import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
