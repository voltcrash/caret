import type { Plugin } from "vite-plus";
import { getClientVersion } from "./client-version";

const buildIdPattern = /^[\w.-]{1,64}$/;

/**
 * One identifier for every file of a build: client bundles, the Worker,
 * `/version.json`, service-worker caches and error reports. Release tooling
 * may supply `OXYTYPE_BUILD_ID`; otherwise the existing timestamp+commit stamp.
 */
export function resolveBuildId(
  isDevelopment: boolean,
  override = process.env["OXYTYPE_BUILD_ID"],
): string {
  const supplied = override?.trim() ?? "";
  const buildId = supplied === "" ? getClientVersion(isDevelopment) : supplied;
  if (!buildIdPattern.test(buildId)) {
    throw new Error("OXYTYPE_BUILD_ID must be 1-64 letters, digits, . _ or -");
  }
  return buildId;
}

/** `/version.json` keeps its public `{ version }` shape for the TUI asset cache. */
export function versionJson(buildId: string): string {
  return JSON.stringify({ version: buildId });
}

export function startVersionFile(buildId: string): Plugin {
  const source = versionJson(buildId);
  return {
    name: "oxytype-version-file",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/version.json") {
          next();
          return;
        }
        response.setHeader("content-type", "application/json");
        response.setHeader("cache-control", "no-store");
        response.end(source);
      });
    },
  };
}
