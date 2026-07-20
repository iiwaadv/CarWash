import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// COE Tablet App — Offline-first supervisor tablet UI.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "CarWash Ops Engine - Supervisor",
        short_name: "COE Supervisor",
        description: "تطبيق المشرف الميداني لمغاسل السيارات - يعمل دون اتصال بالإنترنت",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "landscape",
        icons: [],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /^http:\/\/localhost:4000\/uploads\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "coe-uploads-cache" },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    allowedHosts: true,
  },
});
