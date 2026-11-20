import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseSync } from "vite-plus";

/** The frontend package root. */
export const root = resolve(import.meta.dirname, "../..");

export function sources(directory: string): string[] {
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
export function specifiers(file: string, source: string): string[] {
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

/** Package-local, relative and Vite root (`/src/...`) requests, resolved to a path. */
export function target(file: string, specifier: string): string | undefined {
  if (specifier.startsWith("#")) {
    return fileURLToPath(import.meta.resolve(specifier));
  }
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
  if (specifier.startsWith("/src/")) return resolve(root, specifier.slice(1));
  return undefined;
}
