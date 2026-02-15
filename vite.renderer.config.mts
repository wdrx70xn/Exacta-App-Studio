import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ReactCompilerConfig = {};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Prevent Node.js modules from being resolved in renderer
      child_process: false,
      fs: false,
      os: false,
      crypto: false,
      stream: false,
      util: false,
      events: false,
      buffer: false,
      process: false,
    },
  },
  // Explicitly mark Node.js built-in modules as external for the renderer process
  build: {
    rollupOptions: {
      external: [
        "child_process",
        "fs",
        "path",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "process",
        "electron",
        "electron-log",
        // Prevent main process code from being bundled in renderer
        /^@\/ipc\/security\/.*/,
        /^@\/ipc\/runtime\/providers\/.*/,
        /^@\/pro\/main\/.*/,
      ],
    },
  },
  optimizeDeps: {
    exclude: [
      // Exclude main process modules from optimization
      "@/ipc/security/execution_kernel",
      "@/ipc/runtime/RuntimeProviderRegistry",
    ],
  },
});
