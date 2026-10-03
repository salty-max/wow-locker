import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import path from "node:path";

// package.json is the single source of truth for the app version.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig(() => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new deploy's SW waits and UpdatePrompt offers the reload — an installed
      // PWA can't be hard-refreshed, so "prompt" is what keeps it from going stale.
      registerType: "prompt",
      includeAssets: ["icon.svg", "favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "WoWLocker — WoW Classic characters",
        short_name: "WoWLocker",
        description: "Your WoW Classic characters — gear, talents, levels and Hardcore status — with push alerts.",
        lang: "en",
        theme_color: "#0b0d12",
        background_color: "#0b0d12",
        display: "standalone",
        start_url: "/",
        categories: ["games"],
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ["push-sw.js"],
        // Take control of open pages as soon as a SW activates. Without it the
        // first session after install stays uncontrolled: no offline cache, and
        // no controllerchange for the update banner to react to.
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ico}"],
        // Latin font subsets only; the others load on demand via unicode-range.
        globIgnores: ["**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2"],
        runtimeCaching: [
          {
            // Network first, so the feed is always fresh online; the cached copy
            // only answers when offline (or the network stalls), so the feed
            // and posts you've opened stay readable on a plane.
            urlPattern: ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 14 * 86400 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === "render.worldofwarcraft.com",
            handler: "CacheFirst",
            options: {
              cacheName: "renders",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 86400 },
            },
          },
        ],
      },
      devOptions: { enabled: true, type: "module", suppressWarnings: true },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    host: true,
    allowedHosts: [".trycloudflare.com"],
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://localhost:3001" },
  },
  build: { outDir: "dist" },
}));
