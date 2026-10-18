import { describe, expect, it } from "vite-plus/test";
import { createBuilder, type Plugin } from "vite-plus";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

/** Appends a forbidden import to `importer` in one Vite environment only. */
function inject(environment: string, importer: string, target: string): Plugin {
  return {
    name: "inject-forbidden-import",
    enforce: "pre",
    transform(code, id) {
      if (this.environment.name !== environment) return;
      if (!id.endsWith(importer)) return;
      return `${code}\nimport ${JSON.stringify(resolve(root, target))};\n`;
    },
  };
}

async function buildWith(plugin: Plugin): Promise<unknown> {
  const outDir = await mkdtemp(join(tmpdir(), "oxytype-protection-"));
  try {
    const builder = await createBuilder({
      root,
      configFile: resolve(root, "vite.config.ts"),
      logLevel: "silent",
      plugins: [plugin],
      build: { outDir },
    });
    await builder.buildApp();
    return undefined;
  } catch (error) {
    return error;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

describe("Start import protection", () => {
  it("rejects a legacy browser store reached from server code", async () => {
    const error = await buildWith(
      inject("ssr", "src/server/public.server.ts", "src/ts/states/core.ts"),
    );
    expect(String(error)).toContain("Import denied in server environment");
  });

  it("rejects a .server module reached from browser code", async () => {
    const error = await buildWith(
      inject("client", "src/app/document.tsx", "src/server/nonce.server.ts"),
    );
    expect(String(error)).toContain("Import denied in client environment");
  });

  it("accepts the unmodified application", async () => {
    expect(await buildWith({ name: "noop" })).toBeUndefined();
  });
});
