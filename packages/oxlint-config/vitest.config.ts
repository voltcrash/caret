import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      include: ["plugins/**/*.js"],
    },
  },
});
