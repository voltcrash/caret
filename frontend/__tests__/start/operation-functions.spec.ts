import { contract } from "@oxytype/contracts";
import { isAppRoute, type AppRoute } from "@ts-rest/core";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const dir = resolve(import.meta.dirname, "../../src/functions/operations");
const routes = contract as unknown as Record<string, Record<string, AppRoute>>;

const definitions = readdirSync(dir)
  .filter((name) => !["index.ts", "input.ts"].includes(name))
  .flatMap((name) =>
    [
      ...readFileSync(resolve(dir, name), "utf8").matchAll(
        /export const (\w+) = createServerFn\(\{ method: "(\w+)" \}\)[\s\S]*?callOperation\(\s*context\.services,\s*"([\w.]+)",\s*data,?\s*\)/g,
      ),
    ].map(([, exported, method, id]) => ({ file: name, exported, method, id })),
  );

describe("web operation server functions", () => {
  it("define one narrow function per operation, named for its ID", () => {
    expect(definitions.length).toBeGreaterThan(50);
    for (const { file, exported, id } of definitions) {
      const [group = "", name = ""] = (id ?? "").split(".");
      expect(file).toBe(`${group}.ts`);
      expect(exported).toBe(
        `${group}${name[0]?.toUpperCase()}${name.slice(1)}`,
      );
      const route = routes[group]?.[name];
      expect(route !== undefined && isAppRoute(route), id).toBe(true);
    }
    const ids = definitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("read with GET and write with POST, as their contract routes do", () => {
    for (const { method, id } of definitions) {
      const [group = "", name = ""] = (id ?? "").split(".");
      const route = routes[group]?.[name];
      expect(method, id).toBe(route?.method === "GET" ? "GET" : "POST");
    }
  });

  it("map every function under its own operation ID for the browser client", () => {
    const index = readFileSync(resolve(dir, "index.ts"), "utf8");
    const entries = [...index.matchAll(/"([\w.]+)": (\w+)Fns\.(\w+),/g)].map(
      ([, id, file, exported]) => ({ id, file: `${file}.ts`, exported }),
    );
    expect(
      entries.toSorted((a, b) => String(a.id).localeCompare(String(b.id))),
    ).toEqual(
      definitions
        .map(({ id, file, exported }) => ({ id, file, exported }))
        .toSorted((a, b) => String(a.id).localeCompare(String(b.id))),
    );
  });
});
