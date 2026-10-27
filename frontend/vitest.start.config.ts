import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    maxWorkers: 4,
    include: ["__tests__/start/**/*.spec.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
