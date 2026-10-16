import { resolve } from "node:path";
import type { Plugin } from "vite-plus";

const root = resolve(import.meta.dirname, "..");
const startOperations = resolve(root, "src/functions/operations/index.ts");

/**
 * Builds without a Start server bind the operation client to another
 * transport: the rollback build uses the legacy HTTP contracts (default),
 * tests a controllable fake. Start builds never use this plugin.
 */
export function rollbackOperationTransport(
  target = resolve(root, "src/rollback/operations.ts"),
): Plugin {
  return {
    name: "rollback-operation-transport",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.includes("functions/operations")) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      // Another instance of this plugin may already have substituted it.
      return resolved?.id === startOperations || resolved?.id === target
        ? target
        : null;
    },
  };
}
