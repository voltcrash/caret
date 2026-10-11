import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const id = "virtual:devtools";
const resolvedId = `\0${id}`;

export function devtoolsEntry(options: { enabled: boolean }): Plugin {
  return {
    name: "oxytype-devtools-entry",
    resolveId(source) {
      if (source === id) return resolvedId;
      return;
    },
    load(source) {
      if (source !== resolvedId) return;
      if (!options.enabled) return "export {};";
      const tracker = fileURLToPath(
        new URL("../src/ts/dev/signal-tracker.ts", import.meta.url),
      );
      return `import ${JSON.stringify(tracker)}; import "solid-devtools";`;
    },
  };
}
