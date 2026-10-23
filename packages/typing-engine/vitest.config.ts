import { prepareTypingEngine } from "../../scripts/prepare-engine";
import { defineConfig } from "vite-plus";

prepareTypingEngine();

export default defineConfig({ test: { environment: "node" } });
