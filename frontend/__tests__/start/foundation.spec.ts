import { describe, expect, it } from "vite-plus/test";
import { dehydrate } from "@tanstack/solid-query";
import { Generator, getConfig } from "@tanstack/router-generator";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQueryClient } from "../../src/app/query-client";

describe("Start ownership boundaries", () => {
  it("isolates requests and only dehydrates explicitly safe public data", () => {
    const a = createQueryClient();
    const b = createQueryClient();
    a.setQueryDefaults(["public"], { meta: { ssrSafe: true } });
    a.setQueryData(["public"], { testsCompleted: 7 });
    a.setQueryData(["session"], { token: "must-never-serialize" });
    expect(b.getQueryCache().getAll()).toHaveLength(0);
    const payload = dehydrate(a);
    expect(payload.queries).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("must-never-serialize");
    a.clear();
    b.clear();
  });

  it("generates the intended pathless, index, parameter and literal-dot IDs", async () => {
    const root = await mkdtemp(join(tmpdir(), "oxytype-routes-"));
    try {
      await mkdir(join(root, "routes"));
      const routes = [
        "__root",
        "_app",
        "_app.index",
        "_app.profile.index",
        "_app.profile.$uidOrName",
        "_app._authenticated",
        "_app._authenticated.account",
        "oauth-callback[.]html",
        "privacy-policy[.]html",
        "404[.]html",
      ];
      await Promise.all(
        routes.map(
          async (name) =>
            await writeFile(
              join(root, "routes", `${name}.tsx`),
              name === "__root"
                ? 'import { createRootRoute } from "@tanstack/solid-router"; export const Route = createRootRoute({});'
                : 'import { createFileRoute } from "@tanstack/solid-router"; export const Route = createFileRoute("/")({});',
            ),
        ),
      );
      const config = getConfig(
        {
          target: "solid",
          routesDirectory: "./routes",
          generatedRouteTree: "./tree.ts",
          disableLogging: true,
        },
        root,
      );
      await new Generator({ config, root }).run();
      const tree = await readFile(join(root, "tree.ts"), "utf8");
      for (const path of [
        "'/_app/'",
        "'/_app/profile/'",
        "'/_app/profile/$uidOrName'",
        "'/_app/_authenticated/account'",
        "'/oauth-callback.html'",
        "'/privacy-policy.html'",
        "'/404.html'",
      ]) {
        expect(tree).toContain(path);
      }
      expect(tree).toContain("fullPath: '/account'");
      expect(tree).toContain("fullPath: '/profile/$uidOrName'");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
