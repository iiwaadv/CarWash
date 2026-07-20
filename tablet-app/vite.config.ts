import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// تطبيق إيجاز للمشرف الميداني — Offline-first supervisor tablet UI.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "ejaz-logo.png"],
      manifest: {
        name: "نظام إدارة مغاسل إيجاز - المشرف",
        short_name: "إيجاز مشرف",
        description: "تطبيق المشرف الميداني لمغاسل إيجاز - يعمل دون اتصال بالإنترنت",
        theme_color: "#1c1712",
        background_color: "#faf7ef",
        display: "standalone",
        orientation: "landscape",
        icons: [
          { src: "/ejaz-logo.png", sizes: "512x512", type: "image/png" },
        ],
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
