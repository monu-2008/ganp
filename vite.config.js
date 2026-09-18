import { defineConfig } from "vite";

// Vite configuration for GANPATI: VIGHNA.
// - root is the project directory (where index.html lives)
// - assets in /public are copied verbatim to /dist on build
// - all relative asset paths resolve from /public at runtime
export default defineConfig({
  root: ".",
  base: "./",          // relative paths so the build works on any static host (incl. Vercel sub-paths)
  publicDir: "public",
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
