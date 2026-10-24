import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vite-plus/test";
import { getAllFunboxes } from "@oxytype/funbox";
import { getDefaultConfig } from "../src/config/default-config";

const root = resolve(import.meta.dirname, "../../..");
it("retains every original reference byte after removing the old engine", () => {
  const manifest = JSON.parse(
    readFileSync(
      resolve(root, "docs/rust-engine/reference-manifest.json"),
      "utf8",
    ),
  ) as { sha256: Record<string, string> };
  for (const [original, hash] of Object.entries(manifest.sha256)) {
    const path = original.replace(
      "packages/typing-core/__fixtures__/",
      "packages/typing-fixtures/reference/",
    );
    expect(
      createHash("sha256")
        .update(readFileSync(resolve(root, path)))
        .digest("hex"),
      original,
    ).toBe(hash);
  }
});

it("keeps native funbox metadata equal to the independent host/backend catalog", () => {
  const native: unknown = JSON.parse(
    readFileSync(
      resolve(root, "crates/typing-engine/data/funboxes.json"),
      "utf8",
    ),
  );
  expect(native).toEqual(
    getAllFunboxes().map(
      ({
        name,
        properties = [],
        frontendFunctions = [],
        frontendForcedConfig = {},
        canGetPb,
        difficultyLevel,
        cssModifications = [],
      }) => ({
        name,
        properties,
        frontendFunctions,
        frontendForcedConfig,
        canGetPb,
        difficultyLevel,
        cssModifications,
      }),
    ),
  );
});

it("projects every native default into the unchanged website preferences", () => {
  const defaults = JSON.parse(
    readFileSync(
      resolve(root, "packages/typing-engine/generated/defaults.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const website: Record<string, unknown> = getDefaultConfig();
  for (const [key, value] of Object.entries(defaults)) {
    expect(value, key).toEqual(website[key]);
  }
});
