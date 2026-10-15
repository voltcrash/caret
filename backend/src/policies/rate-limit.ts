import {
  limits,
  type RateLimitOptions,
} from "@oxytype/contracts/rate-limit/index";
import type { EndpointMetadata } from "@oxytype/contracts/util/api";
import type { ServiceContext } from "../services/context";
import { consume, type CounterResult } from "./rate-counter";
import { getIpKey } from "./ip-key";
import { statement } from "../db/client";
import { isDevEnvironment } from "../utils/misc";
import MonkeyError from "../utils/error";
import statuses from "../constants/monkey-status-codes";

export type RateContext = Pick<
  ServiceContext,
  "actor" | "configuration" | "client"
>;
export type SetPolicyHeader = (name: string, value: string) => void;
export async function enforceLimit(
  id: string,
  options: RateLimitOptions,
  context: RateContext,
  header: SetPolicyHeader,
  useUid = true,
): Promise<void> {
  const max = options.max * (isDevEnvironment() ? 100 : 1);
  const actor =
    useUid && context.actor.uid !== ""
      ? context.actor.uid
      : getIpKey(context.client.ip);
  const duration =
    typeof options.window === "number"
      ? options.window
      : { second: 1000, minute: 60000, hour: 3600000, day: 86400000 }[
          options.window
        ];
  const result = await consume(`rate:${id}:${actor}`, duration);
  header("X-RateLimit-Limit", String(max));
  header("X-RateLimit-Remaining", String(Math.max(0, max - result.points)));
  header("X-RateLimit-Reset", String(Math.ceil(result.expiresAt / 1000)));
  if (result.points > max) {
    header(
      "Retry-After",
      String(Math.max(1, Math.ceil((result.expiresAt - Date.now()) / 1000))),
    );
    if (id === "root") {
      throw new MonkeyError(
        429,
        "Maximum API request (root) limit reached. Please try again later.",
      );
    }
    if (context.actor.type === "ApeKey") {
      throw new MonkeyError(
        statuses.APE_KEY_RATE_LIMIT_EXCEEDED.code,
        statuses.APE_KEY_RATE_LIMIT_EXCEEDED.message,
      );
    }
    throw new MonkeyError(
      429,
      "Request limit reached, please try again later.",
    );
  }
}

/** Named limits retain the legacy shared buckets (e.g. userGet), across transports. */
export async function enforceOperationLimit(
  metadata: EndpointMetadata,
  context: RateContext,
  header: SetPolicyHeader,
): Promise<void> {
  const limit = metadata.rateLimit;
  if (limit === undefined) return;
  const id =
    context.actor.type === "ApeKey"
      ? typeof limit === "object"
        ? limit.apeKey
        : "defaultApeRateLimit"
      : typeof limit === "object"
        ? limit.normal
        : limit;
  const options = limits[id];
  if (options === undefined) {
    throw new MonkeyError(
      500,
      `Unknown rateLimiterId '${id}', how did you manage to do this?`,
    );
  }
  await enforceLimit(id, options, context, header);
}

export async function checkBadAuthentication(
  context: RateContext,
): Promise<void> {
  if (!context.configuration.rateLimiting.badAuthentication.enabled) return;
  const result = await statement(
    "SELECT points,expires_at AS expiresAt FROM rate_counters WHERE key=?",
    `bad-auth:${getIpKey(context.client.ip)}`,
  ).first<CounterResult>();
  if (
    result !== null &&
    result.expiresAt > Date.now() &&
    result.points >= 30 * (isDevEnvironment() ? 100 : 1)
  ) {
    throw new MonkeyError(
      429,
      "Too many bad authentication attempts, please try again later.",
    );
  }
}
export async function recordBadAuthentication(
  context: RateContext,
  status: number,
): Promise<void> {
  const options = context.configuration.rateLimiting.badAuthentication;
  if (!options.enabled || !options.flaggedStatusCodes.includes(status)) return;
  try {
    await consume(
      `bad-auth:${getIpKey(context.client.ip)}`,
      3600000,
      options.penalty,
    );
  } catch {}
}
