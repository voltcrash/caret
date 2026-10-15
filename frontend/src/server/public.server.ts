import "@tanstack/solid-start/server-only";
import type { TypingStats } from "@oxytype/schemas/public";
import { readTypingStats as read } from "@oxytype/backend/services/public";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/solid-start/server";
import { consume } from "@oxytype/backend/rate-counter";
import { getIpKey } from "@oxytype/backend/ip-key";
import type { ServiceContext } from "./context.server";

export async function readTypingStats(
  context: ServiceContext,
): Promise<TypingStats> {
  const multiplier = context.runtime.env.MODE === "dev" ? 100 : 1;
  for (const [operation, max, duration] of [
    ["root", 1000, 3_600_000],
    ["publicStatsGet", 60, 60_000],
  ] as const) {
    const result = await consume(
      `start:${operation}:${getIpKey(context.clientIp)}`,
      duration,
    );
    setResponseHeader("X-RateLimit-Limit", String(max * multiplier));
    setResponseHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, max * multiplier - result.points)),
    );
    setResponseHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(result.expiresAt / 1000)),
    );
    if (result.points > max * multiplier) {
      setResponseStatus(429);
      setResponseHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((result.expiresAt - Date.now()) / 1000))),
      );
      throw new Error("Request limit reached");
    }
  }
  return await read();
}
