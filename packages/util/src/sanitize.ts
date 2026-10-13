import { z } from "zod/v3";

function removeProblems(obj: unknown, problems: (number | string)[]): unknown {
  //already removed
  if (obj === undefined) return undefined;

  if (Array.isArray(obj)) {
    if (problems.length === obj.length) return undefined;

    return obj.filter((_, index) => !problems.includes(index));
  } else {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (problems.length === entries.length) return undefined;

    return Object.fromEntries(
      entries.filter(([key]) => !problems.includes(key)),
    );
  }
}

function getNestedValue(obj: unknown, path: string[]): Record<string, unknown> {
  // Zod issue paths address members of cloned objects/arrays; numeric keys also index arrays.
  return path
    .slice(0, -1)
    .reduce(
      (acc, key) => acc[key] as Record<string, unknown>,
      obj as Record<string, unknown>,
    );
}

/**
 * Sanitize object. Remove invalid values based on the schema.
 * @param schema zod schema
 * @param obj object
 * @returns sanitized object
 */
export function sanitize<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  obj: unknown,
): T {
  const maxAttempts = 2;
  let result;
  let current = structuredClone(obj);

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    result = schema.safeParse(current);

    if (result.success) {
      //use the parsed data, not the obj. keys might been removed
      return result.data;
    }
    if (attempt === maxAttempts) {
      //exit loop and throw error
      break;
    }
    const pathsWithProblems = result.error.errors.reduce((acc, { path }) => {
      const parent = path.slice(0, -1).join(".");
      const element = path.at(-1);

      if (element !== undefined) {
        acc.set(parent, [...(acc.get(parent) ?? []), element]);
      }
      return acc;
    }, new Map<string, Array<string | number>>());

    for (const [pathString, problems] of pathsWithProblems.entries()) {
      if (pathString === "") {
        current =
          removeProblems(current, problems) ??
          (Array.isArray(current) ? [] : {});
      } else {
        const path = pathString.split(".");
        const parent = getNestedValue(current, path);
        const key = path.at(-1) as string;

        const cleaned = removeProblems(parent[key], problems);

        if (cleaned === undefined) {
          // oxlint-disable-next-line no-dynamic-delete -- Zod supplies the invalid member's key at runtime.
          delete parent[key];
        } else {
          parent[key] = cleaned;
        }
      }
    }
  }
  const errorsString = result?.error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
  throw new Error(`unable to sanitize: ${errorsString}`);
}
