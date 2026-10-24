import { resolve } from "node:path";
import type { Plugin } from "vite-plus";

const startOperations = resolve(
  import.meta.dirname,
  "../src/functions/operations/index.ts",
);

/**
 * Unit tests and Storybook run without a Start server: bind the browser
 * operation client to a stand-in `webOperations` map instead of server
 * functions. Start builds never use this plugin.
 */
export function operationTransport(target: string): Plugin {
  return {
    name: "operation-transport",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.includes("functions/operations")) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      // Another instance of this plugin may already have substituted it.
      const id = resolved?.id.split("?")[0];
      return id === startOperations || id === target ? target : null;
    },
  };
}
