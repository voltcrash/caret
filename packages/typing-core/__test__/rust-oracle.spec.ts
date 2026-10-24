import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDefaultConfig } from "../src/config/default-config";
import { getAllFunboxes } from "@oxytype/funbox";
import { expect, it } from "vite-plus/test";
import { readCommandFixture, runOracle } from "../scripts/rust-oracle";

const root = resolve(import.meta.dirname, "../../typing-fixtures");
const cases = readdirSync(resolve(root, "commands")).filter((name) =>
  name.endsWith(".json"),
);
for (const name of cases) {
  it(`frozen intermediate command oracle: ${name}`, async () => {
    const fixture = readCommandFixture(resolve(root, "commands", name));
    const expected: unknown = JSON.parse(
      readFileSync(resolve(root, "oracle", name), "utf8"),
    );
    expect(await runOracle(fixture)).toEqual(expected);
  });
}

it("the harness rejects an introduced progression mismatch", async () => {
  const fixture = readCommandFixture(
    resolve(root, "commands/finite-edit.json"),
  );
  const actual = await runOracle(fixture);
  const wrong = structuredClone(actual) as {
    frames: { state: { wordIndex: number } }[];
  };
  const first = wrong.frames[0];
  if (first === undefined) throw new Error("Missing frame");
  first.state.wordIndex++;
  expect(() => expect(actual).toEqual(wrong)).toThrow();
});

it("original and neutral reference fixtures retain the frozen bytes", () => {
  const manifest = JSON.parse(
    readFileSync(
      resolve(root, "../../docs/rust-engine/reference-manifest.json"),
      "utf8",
    ),
  ) as { sha256: Record<string, string> };
  for (const [path, sha256] of Object.entries(manifest.sha256)) {
    const relative = path.replace("packages/typing-core/__fixtures__/", "");
    for (const source of [
      resolve(root, "reference", relative),
      resolve(root, "../../", path),
    ]) {
      expect(
        createHash("sha256").update(readFileSync(source)).digest("hex"),
        source,
      ).toBe(sha256);
    }
  }
});

it("Rust funbox metadata stays mechanically equal to the website contract", () => {
  const actual = JSON.parse(
    readFileSync(
      resolve(root, "../../crates/typing-engine/data/funboxes.json"),
      "utf8",
    ),
  ) as unknown;
  const expected = getAllFunboxes().map(
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
  );
  expect(actual).toEqual(expected);
});

it("Rust engine defaults stay mechanically equal to supported website preferences", () => {
  const defaults = JSON.parse(
    readFileSync(
      resolve(root, "../typing-engine/generated/defaults.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const website: Record<string, unknown> = getDefaultConfig();
  for (const [key, value] of Object.entries(defaults)) {
    expect(value, key).toEqual(website[key]);
  }
});
