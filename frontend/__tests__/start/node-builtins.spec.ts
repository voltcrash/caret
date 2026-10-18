import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { build } from "vite-plus";
import { expect, it } from "vite-plus/test";

import { workerNodeBuiltins } from "../../vite-plugins/worker-node-builtins";

it("bundles legacy CJS built-ins as static imports with native identity in workerd", async () => {
  const root = await mkdtemp(join(tmpdir(), "oxytype-worker-builtins-"));
  let mf: Miniflare | undefined;
  try {
    await writeFile(
      join(root, "legacy.cjs"),
      `
      const crypto = require("crypto");
      const util = require("util");
      const fs = require("fs");
      exports.read = () => ({
        hash: crypto.createHash("sha256").update("fixture").digest("hex"),
        same: crypto === require("node:crypto"),
        formatted: util.format("%s %d", "fixture", 7),
        fs: typeof fs.readFile,
      });
    `,
    );
    await writeFile(
      join(root, "entry.js"),
      `
      import legacy from "./legacy.cjs";
      export default { fetch() { return Response.json(legacy.read()); } };
    `,
    );
    const result = await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [workerNodeBuiltins()],
      build: {
        ssr: join(root, "entry.js"),
        write: false,
        minify: false,
        rolldownOptions: {
          output: { entryFileNames: "index.js", format: "es" },
        },
      },
    });
    const output = Array.isArray(result) ? result[0] : result;
    if (output === undefined || !("output" in output)) {
      throw new Error("Missing fixture output");
    }
    const modules = Object.fromEntries(
      output.output.flatMap((chunk) => {
        if (chunk.type !== "chunk") return [];
        expect(chunk.code).not.toMatch(/__require\(/);
        return [
          [chunk.fileName, { type: "esm" as const, contents: chunk.code }],
        ];
      }),
    );
    mf = new Miniflare({
      workers: [
        {
          config: {
            name: "builtin-fixture",
            compatibilityDate: "2026-10-02",
            compatibilityFlags: ["nodejs_compat"],
            manifest: { mainModule: "index.js", modules },
            env: {},
          },
        },
      ],
    });
    const response = await mf.dispatchFetch("http://localhost/");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      hash: createHash("sha256").update("fixture").digest("hex"),
      same: true,
      formatted: "fixture 7",
      fs: "function",
    });
  } finally {
    await mf?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
