import type { Plugin } from "vite-plus";
import type { getOpenApi } from "@oxytype/backend/http/openapi";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Public protocol docs only; the private editor is never emitted as a client asset. */
export function apiDocs(): Plugin {
  // Workspace TS packages require the repository's tsx loader in build tooling.
  const internal = JSON.parse(
    execFileSync("vp", ["exec", "tsx", "scripts/openapi.ts", "--start"], {
      cwd: resolve(import.meta.dirname, "../../backend"),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }),
  ) as ReturnType<typeof getOpenApi>;
  const publicApi = {
    ...internal,
    paths: Object.fromEntries(
      Object.entries(internal.paths).flatMap(([path, methods]) => {
        const selected = Object.fromEntries(
          Object.entries((methods ?? {}) as Record<string, unknown>).filter(
            ([, operation]) =>
              typeof operation === "object" &&
              operation !== null &&
              Reflect.get(operation, "x-public") === "yes",
          ),
        );
        return Object.keys(selected).length === 0 ? [] : [[path, selected]];
      }),
    ),
  };
  const assets = {
    "openapi.json": JSON.stringify(internal),
    "public.json": JSON.stringify(publicApi),
  };
  return {
    name: "oxytype-api-docs",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      for (const [name, source] of Object.entries(assets)) {
        this.emitFile({ type: "asset", fileName: `_api-docs/${name}`, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = request.url?.split("?")[0]?.replace(/^\/_api-docs\//, "");
        const source = assets[name as keyof typeof assets];
        if (!request.url?.startsWith("/_api-docs/") || source === undefined) {
          next();
          return;
        }
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.end(source);
      });
    },
  };
}
