import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // أي طلب لمسار API خلال التطوير المحلي يُوجَّه تلقائياً إلى الباك إند على ngrok
      "/api": {
        target: "https://scarce-drove-amendable.ngrok-free.dev",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        headers: {
          "ngrok-skip-browser-warning": "69420",
        },
      },
    },
  },
});
