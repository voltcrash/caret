import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseSync } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

const root = resolve(import.meta.dirname, "../..");
const shared = [resolve(root, "src/ts"), resolve(root, "src/data")];
const features = resolve(root, "src/features");
const baselineFile = resolve(
  import.meta.dirname,
  "shared-feature-imports.json",
);

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

type Node = { type?: string; [key: string]: unknown };

/** A literal module request, unwrapping parentheses; undefined if computed. */
function literal(node: unknown): string | undefined {
  const value = node as Node | null | undefined;
  if (value?.type === "ParenthesizedExpression") {
    return literal(value["expression"]);
  }
  if (value?.type === "Literal" && typeof value["value"] === "string") {
    return value["value"];
  }
  if (
    value?.type === "TemplateLiteral" &&
    (value["expressions"] as unknown[]).length === 0
  ) {
    const [quasi] = value["quasis"] as { value: { cooked: string } }[];
    return quasi?.value.cooked;
  }
  return undefined;
}

/** Module requests anywhere in the AST: imports, re-exports, `import()` and `typeof import()`. */
function specifiers(file: string, source: string): string[] {
  const { program, errors } = parseSync(file, source, {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
  });
  if (errors.length > 0) throw new Error(`Cannot parse ${file}`);
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const value = node as Node;
    if (
      value.type === "ImportDeclaration" ||
      value.type === "ExportNamedDeclaration" ||
      value.type === "ExportAllDeclaration" ||
      value.type === "ImportExpression" ||
      value.type === "TSImportType"
    ) {
      const request = literal(value["source"]);
      if (request !== undefined) found.push(request);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "parent") visit(child);
    }
  };
  visit(program);
  return found;
}

/** Relative and Vite root (`/src/...`) requests, resolved to a path. */
function target(file: string, specifier: string): string | undefined {
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
  if (specifier.startsWith("/src/")) return resolve(root, specifier.slice(1));
  return undefined;
}

/** `importer -> feature module` for every shared module importing a feature. */
function sharedFeatureImports(): string[] {
  const edges = new Set<string>();
  for (const file of shared.flatMap(sources)) {
    for (const specifier of specifiers(file, readFileSync(file, "utf8"))) {
      const path = target(file, specifier);
      if (path === undefined || !path.startsWith(`${features}/`)) continue;
      edges.add(
        `${relative(root, file)} -> ${relative(root, path).replace(/\.tsx?$/, "")}`,
      );
    }
  }
  return [...edges].toSorted();
}

describe("shared code and features", () => {
  // Shared code (src/ts, src/data) should not depend on features. Existing edges are a
  // ratchet: remove entries as they are untangled, never add new ones.
  it("adds no shared-to-feature imports beyond the recorded baseline", () => {
    const baseline = JSON.parse(readFileSync(baselineFile, "utf8")) as string[];
    const actual = sharedFeatureImports();
    expect(
      actual.filter((edge) => !baseline.includes(edge)),
      "new shared-to-feature imports; move the code into the feature or invert the dependency",
    ).toEqual([]);
    expect(
      baseline.filter((edge) => !actual.includes(edge)),
      "removed edges; delete them from shared-feature-imports.json",
    ).toEqual([]);
  });
});
