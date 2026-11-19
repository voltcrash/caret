import { envValue } from "../runtime/env";
import ApiError from "./error";
/** External bot/git bridge must honor Idempotency-Key for retry-safe effects. */
export async function integration<T>(
  path: string,
  data: unknown,
  key: string,
): Promise<T> {
  const base = envValue("INTEGRATION_URL"),
    secret = envValue("INTEGRATION_SECRET");
  if (base === undefined || secret === undefined) {
    throw new ApiError(503, "External integration is not configured");
  }
  const url = new URL(path, `${base.replace(/\/$/, "")}/`);
  if (url.protocol !== "https:") {
    throw new ApiError(503, "External integration requires HTTPS");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
      "idempotency-key": key,
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new ApiError(503, `External integration failed (${response.status})`);
  }
  return (await response.json()) as T;
}
