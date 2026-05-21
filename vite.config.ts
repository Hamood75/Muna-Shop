import path from "node:path";
import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// Tauri serves the production bundle from a custom URL; `/assets/...` must be relative or CSS/JS will not load in the packaged app.
const base = "./";

/**
 * Tauri's WKWebView: `crossorigin` on `<link rel="stylesheet">` forces CORS validation; responses on the custom asset scheme often omit ACAO headers, so CSS loads are dropped silently.
 */
function stripIndexHtmlCrossOrigin(): Plugin {
  return {
    name: "strip-index-html-crossorigin",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(/\s+crossorigin(?:="anonymous")?(?=\s|>)/gi, "");
      },
    },
  };
}

export default defineConfig(async () => ({
  base,
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
    stripIndexHtmlCrossOrigin(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
