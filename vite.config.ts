import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // three.js (~250 KB gzip) is lazy-loaded with the hero canvas, so it never blocks first paint.
  build: { chunkSizeWarningLimit: 1000 },
});
