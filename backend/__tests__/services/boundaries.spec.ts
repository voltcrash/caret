import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  allOperations,
  operationForRoute,
} from "../../src/policies/operations";

describe("service ownership", () => {
  it("keeps policies and services independent of HTTP frameworks", () => {
    const violations: string[] = [];
    for (const dir of ["services", "policies"]) {
      const root = resolve(__dirname, "../../src", dir);
      for (const name of readdirSync(root, {
        recursive: true,
        encoding: "utf8",
      })) {
        if (!name.endsWith(".ts")) continue;
        const source = readFileSync(resolve(root, name), "utf8");
        if (
          /from ["'][^"']*(?:\/api\/|\/middlewares\/|hono|solid-start)|\b(?:MonkeyRequest|HttpRequest)\b/.test(
            source,
          )
        ) {
          violations.push(`${dir}/${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
  it("gives every legacy operation one stable identity", () => {
    const operations = allOperations();
    expect(operations.length).toBeGreaterThan(80);
    expect(new Set(operations.map(({ id }) => id)).size).toBe(
      operations.length,
    );
    for (const operation of operations) {
      expect(operationForRoute(operation.route)?.id).toBe(operation.id);
    }
    expect(operations.some(({ id }) => id === "users.getStats")).toBe(true);
  });
});
