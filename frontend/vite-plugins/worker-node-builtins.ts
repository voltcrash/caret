import { isBuiltin } from "node:module";
import type { Plugin } from "vite-plus";

const prefix = "\0oxytype:worker-node-require:";

/** Static ESM facades for CJS built-ins; workerd has no runtime require. */
export function workerNodeBuiltins(): Plugin {
  return {
    name: "oxytype:worker-node-builtins",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name === "ssr",
    resolveId: {
      order: "pre",
      handler(source, _importer, options) {
        if (options.kind !== "require-call" || !isBuiltin(source)) return;
        return `${prefix}${source.replace(/^node:/, "")}`;
      },
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      const name = id.slice(prefix.length);
      // Preserve Node's CJS built-in module identity, including default exports.
      return `import builtin from ${JSON.stringify(`node:${name}`)}; module.exports = builtin;`;
    },
  };
}
