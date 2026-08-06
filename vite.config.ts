import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/MuseumBelow/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: [
        "favicon.svg",
        "pwa-192x192.svg",
        "pwa-512x512.svg",
        "maskable-512x512.svg",
      ],
      manifest: {
        id: base,
        name: "沉没纪元",
        short_name: "沉没纪元",
        description: "在异星深海打捞文明证据，并通过博物馆展览重建一个世界的毁灭史。",
        lang: "zh-CN",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "landscape-primary",
        background_color: "#04161f",
        theme_color: "#061d27",
        categories: ["games", "entertainment", "education"],
        icons: [
          {
            src: "pwa-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "pwa-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "maskable-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
});
