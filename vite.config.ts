import path from "node:path";
import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// Tauri serves the production bundle from a custom URL; `/assets/...` must be relative or CSS/JS will not load in the packaged app.
const base = "./";

/** Inline shell so WKWebKit still renders readable UI if Tailwind/CSS injection fails. */
function injectShellFallbackStyles(): Plugin {
  const shellCss =
    `html,body{min-height:100%;margin:0}body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45;color:#0f172a;background:#eef2ff}`;
  return {
    name: "muna-shell-fallback-styles",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const tag = `    <style id="muna-shell">${shellCss}</style>\n`;
        return html.replace("</head>", `${tag}</head>`);
      },
    },
  };
}

/**
 * Defer injecting the big Tailwind string until DOM is parsed (some WKWebView builds miss very-early document.head inserts).
 */
function munaDeferCssInjection(
  cssCode: string,
  opts: {
    styleId?: string | (() => string);
    useStrictCSP?: boolean;
    attributes?: Record<string, string>;
  },
): string {
  let attributesInjection = "";
  if (opts.attributes) {
    for (const [k, v] of Object.entries(opts.attributes)) {
      attributesInjection += `elementStyle.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(String(v))});`;
    }
  }
  const sid = typeof opts.styleId === "function" ? opts.styleId() : opts.styleId;
  const styleIdSnippet =
    typeof sid === "string" && sid.length > 0
      ? `elementStyle.id=${JSON.stringify(sid)};`
      : "";
  const nonceSnippet = opts.useStrictCSP
    ? `elementStyle.nonce=document.head.querySelector("meta[property=csp-nonce]")?.content||"";`
    : "";

  return (
    `try{` +
      `function __munaTailwindCss(){try{if(typeof document==="undefined")return;` +
      `var elementStyle=document.createElement("style");` +
      `${styleIdSnippet}${nonceSnippet}${attributesInjection}` +
      `elementStyle.appendChild(document.createTextNode(${cssCode}));` +
      `(document.head||document.documentElement).appendChild(elementStyle);` +
      `}catch(_e){console.error('vite-plugin-css-injected-by-js',_e);}` +
      `}` +
      `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",__munaTailwindCss,{once:true});` +
      `else queueMicrotask(__munaTailwindCss);` +
      `}catch(__e){console.error('vite-plugin-css-injected-by-js',__e);}`
  );
}

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
    injectShellFallbackStyles(),
    cssInjectedByJsPlugin({
      injectCode: munaDeferCssInjection,
      styleId: "muna-tailwind",
    }),
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
