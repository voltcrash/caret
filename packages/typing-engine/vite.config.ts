import { defineConfig } from "vite-plus";
import { sharedLint } from "../oxlint-config/config";

export default defineConfig({
  lint: {
    extends: [sharedLint],
    ignorePatterns: ["generated", "node_modules"],
  },
});
