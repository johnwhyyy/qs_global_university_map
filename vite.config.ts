import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/qs_global_university_map/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 3000,
    target: "es2020",
    sourcemap: true
  }
});
