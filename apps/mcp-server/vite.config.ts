import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "widget-dist",
    emptyOutDir: true,
    target: "es2018",
    sourcemap: false,
    lib: {
      entry: "widget-src/main.tsx",
      name: "TodoWidget",
      formats: ["iife"],
      fileName: () => "widget.js"
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
