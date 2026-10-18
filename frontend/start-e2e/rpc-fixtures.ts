import type { Request, Route } from "playwright/test";
import { fromJSON, toCrossJSONAsync } from "seroval";
import type { SerovalJSON } from "seroval";
import { rpcPath } from "../__tests__/start/rpc";

export { rpcPath };

/** The pinned Start client's request envelope; no legacy REST acknowledgement. */
export function rpcInput(request: Request): unknown {
  const payload =
    request.method() === "GET"
      ? (JSON.parse(
          new URL(request.url()).searchParams.get("payload") ?? "null",
        ) as SerovalJSON)
      : (request.postDataJSON() as SerovalJSON);
  const decoded: unknown = fromJSON(payload);
  return (decoded as { data: unknown }).data;
}

export async function fulfillOperation(
  route: Route,
  data: unknown,
  message = "OK",
): Promise<void> {
  await route.fulfill({
    contentType: "application/json",
    headers: { "x-tss-serialized": "true" },
    body: JSON.stringify(
      await toCrossJSONAsync({
        result: { ok: true, status: 200, message, data },
        context: {},
      }),
    ),
  });
}
