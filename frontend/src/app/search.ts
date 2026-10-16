import type { z } from "zod";
import { safeParse } from "zod-urlsearchparams";

type Schema = z.ZodObject<Record<string, z.ZodType>>;
type SearchRecord = Record<string, unknown>;

/**
 * Router search codec. Keeps the existing flat `zod-urlsearchparams` URLs
 * (`?page=2&yesterday=t`) instead of Router's JSON values. First value wins,
 * like `URLSearchParams.get`.
 */
export function parseSearch(search: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    result[key] ??= value;
  }
  return result;
}

function encode(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value ? "t" : "f";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function toParams(search: SearchRecord): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const encoded = encode(value);
    if (encoded !== undefined) params.set(key, encoded);
  }
  return params;
}

export function stringifySearch(search: SearchRecord): string {
  const query = toParams(search).toString();
  return query === "" ? "" : `?${query}`;
}

/**
 * Route `validateSearch` adapter. Invalid search behaves like the old page URL
 * parser: the whole schema is ignored rather than failing the route. Router
 * merges validated search over the raw parent search, so every schema key is
 * set explicitly; unparsable raw values never leak through.
 */
export function urlSearch<T extends Schema>(
  schema: T,
): (search: SearchRecord) => z.infer<T> {
  const cleared = Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, undefined]),
  );
  return (search) => {
    const parsed = safeParse({ schema, input: toParams(search) });
    return { ...cleared, ...(parsed.success ? parsed.data : {}) } as z.infer<T>;
  };
}
