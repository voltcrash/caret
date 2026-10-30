import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";
import subsets from "../../../scripts/fonts/output.json";

function points(range: string): Set<number> {
  const result = new Set<number>();
  for (const span of range.split(",")) {
    const [first, last] = span.slice(2).split("-");
    const start = Number.parseInt(first ?? "", 16);
    const end = Number.parseInt(last ?? first ?? "", 16);
    for (let code = start; code <= end; code++) result.add(code);
  }
  return result;
}

it("verifies committed output checksums and complete original Unicode coverage", () => {
  const baseline = JSON.parse(
    readFileSync(
      new URL(
        "../../../docs/font-evidence/baseline-inventory.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    files: Record<
      string,
      {
        unicodeRange: string;
        variationSequences: Record<string, [number, string | null][]>;
      }
    >;
  };
  const after = JSON.parse(
    readFileSync(
      new URL(
        "../../../docs/font-evidence/after-inventory.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    files: Record<
      string,
      { variationSequences: Record<string, [number, string | null][]> }
    >;
  };
  for (const [source, parts] of Object.entries(subsets)) {
    const original = baseline.files[`frontend/static/webfonts/${source}`];
    expect(original, source).toBeDefined();
    const union = new Set<number>();
    for (const part of parts) {
      const body = readFileSync(
        new URL(`../../static/webfonts/${part.file}`, import.meta.url),
      );
      expect(body.length, part.file).toBe(part.bytes);
      expect(createHash("sha256").update(body).digest("hex"), part.file).toBe(
        part.sha256,
      );
      for (const code of points(part.unicodeRange)) {
        expect(union.has(code), `${source} overlapping ${code}`).toBe(false);
        union.add(code);
      }
    }
    expect(union, source).toEqual(points(original?.unicodeRange ?? ""));
    const sequences = (
      value: Record<string, [number, string | null][]> | undefined,
    ): Record<string, number[]> =>
      Object.fromEntries(
        Object.entries(value ?? {}).map(([selector, mappings]) => [
          selector,
          mappings.map(([code]) => code),
        ]),
      );
    expect(sequences(after.files[source]?.variationSequences), source).toEqual(
      sequences(original?.variationSequences),
    );
  }
});
