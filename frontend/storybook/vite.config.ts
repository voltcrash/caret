import { defineConfig } from "vite-plus";

export default defineConfig({
  // Stories run in a browser without Node's process global.
  define: { "process.env": {} },
});
