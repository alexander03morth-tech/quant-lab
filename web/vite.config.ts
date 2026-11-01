import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// På GitHub Pages ligger sajten under /<repo>/. BASE_PATH sätts av GitHub Action.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 5000 },
  test: { environment: "node" },
});
