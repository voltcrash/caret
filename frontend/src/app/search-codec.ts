type SearchRecord = Record<string, unknown>;

/**
 * Router search codec. Keeps the existing flat search URLs
 * (`?page=2&yesterday=t`) instead of Router's JSON values. First value wins,
 * like `URLSearchParams.get`.
 */
export function parseSearch(search: string): Record<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(search)) {
    if (!result.has(key)) result.set(key, value);
  }
  return Object.fromEntries(result);
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

export function toSearchParams(search: SearchRecord): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const encoded = encode(value);
    if (encoded !== undefined) params.set(key, encoded);
  }
  return params;
}

export function stringifySearch(search: SearchRecord): string {
  const query = toSearchParams(search).toString();
  return query === "" ? "" : `?${query}`;
}
