import { contract } from "@oxytype/contracts";
import type { EndpointMetadata } from "@oxytype/contracts/util/api";
import { isAppRoute, type AppRouter } from "@ts-rest/core";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";

const root = resolve(__dirname, "../..");

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}

/** Resolve the surviving transport adapter to its sole business implementation. */
function serviceOwner(routeFile: string, key: string): string {
  const route = readFileSync(resolve(root, routeFile), "utf8");
  const handler = new RegExp(
    `\\n  ${key}: \\{[\\s\\S]*?callService\\(\\w+\\.(\\w+)\\)`,
  ).exec(route)?.[1];
  const controller =
    /from ["'](\.\.\/\.\.\/services\/operations\/[^"']+)["']/.exec(route)?.[1];
  if (handler === undefined || controller === undefined) {
    throw new Error(`Missing service adapter ${routeFile}:${key}`);
  }
  let file = resolve(root, dirname(routeFile), `${controller}.ts`);
  for (let depth = 0; depth < 4; depth++) {
    const source = readFileSync(file, "utf8");
    if (new RegExp(`export (?:async )?function ${handler}\\b`).test(source)) {
      return `${relative(root, file)}#${handler}`;
    }
    const reexport = [
      ...source.matchAll(/export \{([^}]+)\} from ["']([^"']+)["']/g),
    ].find((match) =>
      match[1]?.split(",").some((name) => name.trim() === handler),
    )?.[2];
    if (reexport === undefined) break;
    file = resolve(dirname(file), `${reexport}.ts`);
  }
  throw new Error(`Missing business service for ${routeFile}:${key}`);
}

/** Source evidence, not proof that a public endpoint has no external users. */
export function inventory(): object[] {
  const callers = new Map<string, string[]>();
  for (const path of sources(resolve(root, "frontend/src"))) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /\bApe\s*\.\s*(\w+)\s*\.\s*(\w+)\s*\(/g,
    )) {
      const id = `${match[1]}.${match[2]}`;
      const files = callers.get(id) ?? [];
      files.push(relative(root, path));
      callers.set(id, files);
    }
  }
  // The OAuth signup probe uses fetch rather than Ape.
  callers.set("users.get", [
    ...(callers.get("users.get") ?? []),
    "frontend/src/ts/auth-client.ts",
  ]);
  const operations: object[] = [];
  function visit(router: AppRouter, prefix = ""): void {
    for (const [key, route] of Object.entries(router)) {
      const id = `${prefix}${key}`;
      if (!isAppRoute(route)) {
        visit(route, `${id}.`);
        continue;
      }
      const policy = (route.metadata ?? {}) as EndpointMetadata;
      const auth = policy.authenticationOptions;
      const externalContract =
        auth?.isPublic === true || auth?.acceptApeKeys === true;
      const browserCallers = [...new Set(callers.get(id) ?? [])].sort();
      const group = id.split(".")[0];
      const retain = externalContract || browserCallers.length === 0;
      operations.push({
        id,
        method: route.method,
        path: `/api${route.path}`,
        currentOwner: `backend/src/api/routes/${group === "apeKeys" ? "ape-keys" : group}.ts`,
        serviceOwner: serviceOwner(
          `backend/src/api/routes/${group === "apeKeys" ? "ape-keys" : group}.ts`,
          key,
        ),
        startAdapter:
          (
            {
              "public.getTypingStats": "frontend/src/functions/public.ts",
              "users.getStats": "frontend/src/functions/account.ts (pilot)",
              "users.create": "frontend/src/functions/signup.ts",
            } as Record<string, string>
          )[id] ?? null,
        policy,
        validation: {
          params: "pathParams" in route,
          query: "query" in route,
          body: "body" in route,
          statuses: Object.keys(route.responses).map(Number),
          gate: "backend D1 HTTP/policy suites; feature browser tests; direct-call parity at Stage 3/6",
        },
        browserCallers,
        target: retain
          ? "retained server route over backend service"
          : "web server function over backend service",
        webTarget: browserCallers.length > 0 ? "server function" : null,
        consumerEvidence: externalContract
          ? "Published public OpenAPI (backend/scripts/openapi.ts); actual deployment consumers unknown; preserve HTTP contract"
          : browserCallers.length > 0
            ? "Repository browser caller; old tabs require temporary HTTP adapter"
            : "No Ape browser call found; operational/external usage uncertain; conservatively retain HTTP",
        retirement: retain
          ? "Remove Hono adapter only after equivalent Start route policy/contract tests; endpoint remains"
          : "Remove HTTP endpoint after all browser callers migrate and old-tab window closes",
      });
    }
  }
  visit(contract);
  return operations.sort((a, b) =>
    String(Reflect.get(a, "id")).localeCompare(String(Reflect.get(b, "id"))),
  );
}

if (require.main === module) {
  const output = `${JSON.stringify(inventory(), null, 2)}\n`;
  const path = resolve(root, "docs/tanstack-start/operations.json");
  if (process.argv.includes("--check")) {
    if (
      !isDeepStrictEqual(
        JSON.parse(readFileSync(path, "utf8")),
        JSON.parse(output),
      )
    ) {
      throw new Error("Operation ledger stale: run migration-inventory.ts");
    }
  } else {
    writeFileSync(path, output);
  }
}
