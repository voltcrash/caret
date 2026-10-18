import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { inventory } from "../scripts/migration-inventory";

describe("Stage 0 operation ownership", () => {
  const operations = inventory() as {
    id: string;
    path: string;
    method: string;
    target: string;
    currentOwner: string;
    startAdapter: string | null;
    browserCallers: string[];
    policy: {
      authenticationOptions?: { isPublic?: boolean; acceptApeKeys?: boolean };
    };
    retirement: string;
  }[];

  it("keeps the checked-in ledger current with merged contracts and browser callers", () => {
    const ledger: unknown = JSON.parse(
      readFileSync(
        resolve(__dirname, "../../docs/tanstack-start/operations.json"),
        "utf8",
      ),
    );
    expect(ledger).toEqual(operations);
    expect(new Set(operations.map((operation) => operation.id)).size).toBe(
      operations.length,
    );
    expect(
      new Set(
        operations.map((operation) => `${operation.method} ${operation.path}`),
      ).size,
    ).toBe(operations.length);
  });

  it("preserves published public and ApeKey HTTP protocols even with web callers", () => {
    for (const operation of operations) {
      const auth = operation.policy.authenticationOptions;
      if (
        auth?.isPublic ||
        auth?.acceptApeKeys ||
        operation.browserCallers.length === 0
      ) {
        expect(operation.target, operation.id).toContain(
          "retained server route",
        );
      }
      expect(operation.retirement, operation.id).not.toBe("");
    }
  });

  it("captures function callers after retiring the browser Ape client", () => {
    for (const id of ["quotes.add", "quotes.report"]) {
      expect(
        operations.find((operation) => operation.id === id)?.browserCallers,
      ).toHaveLength(1);
    }
    expect(
      operations.find((operation) => operation.id === "users.get")
        ?.browserCallers,
    ).toContain("frontend/src/ts/queries/account.ts");
  });

  it("assigns every browser capability to a function and every protocol to an existing Start route", () => {
    const root = resolve(__dirname, "../..");
    for (const operation of operations) {
      expect(
        existsSync(resolve(root, operation.currentOwner)),
        operation.id,
      ).toBe(true);
      if (operation.browserCallers.length > 0) {
        expect(operation.startAdapter, operation.id).not.toBeNull();
        expect(
          existsSync(resolve(root, operation.startAdapter ?? "missing")),
          operation.id,
        ).toBe(true);
        for (const caller of operation.browserCallers) {
          expect(existsSync(resolve(root, caller)), operation.id).toBe(true);
        }
      }
    }
  });
});
