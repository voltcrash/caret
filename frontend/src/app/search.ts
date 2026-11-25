import type { z } from "zod";
import { toSearchParams } from "./search-codec";
import { safeParse } from "./url-search-params";

export { parseSearch, stringifySearch } from "./search-codec";

type Schema = z.ZodObject<Record<string, z.ZodType>>;
type SearchRecord = Record<string, unknown>;

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
    const parsed = safeParse({ schema, input: toSearchParams(search) });
    return { ...cleared, ...(parsed.success ? parsed.data : {}) } as z.infer<T>;
  };
}
