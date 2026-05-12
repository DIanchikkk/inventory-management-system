import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Только localhost — в консоли один URL, без списка Network (192.168…, 198.18…).
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      // Тот же origin, что и Vite: превью /uploads без лишних кросс-доменных нюансов (API всё равно на 8080).
      "/uploads": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
});
