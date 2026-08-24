import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5217",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Split stable third-party libs into their own chunk so the browser
    // can cache them across app deploys (big win on re-visits) and the
    // main bundle parses faster on first load.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            if (id.includes("react-router")) {
              return "vendor-router";
            }
            if (id.includes("i18next") || id.includes("react-i18next")) {
              return "vendor-i18n";
            }
            if (id.includes("lucide")) {
              return "vendor-icons";
            }
            if (id.includes("signalr")) {
              return "vendor-realtime";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
