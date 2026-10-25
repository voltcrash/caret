import {
  limits,
  type RateLimitOptions,
} from "@oxytype/contracts/rate-limit/index";
import type { EndpointMetadata } from "@oxytype/contracts/util/api";
import { GUEST, type ServiceContext } from "../services/context";
import {
  AUTH_LIMIT,
  AUTH_SIGN_IN_LIMIT,
  consume,
  tierFor,
} from "./rate-counter";
import { getIpKey } from "./ip-key";
import { getFrontendUrl, isDevEnvironment } from "../utils/misc";
import MonkeyError from "../utils/error";

/** Development raises every limit so local use and tests rarely hit them. */
export const REQUEST_MULTIPLIER = 100;
export type RateContext = Pick<
  ServiceContext,
  "actor" | "configuration" | "client"
>;
export type SetPolicyHeader = (name: string, value: string) => void;
export async function enforceLimit(
  id: string,
  options: RateLimitOptions,
  context: Pick<RateContext, "actor" | "client">,
  header: SetPolicyHeader,
  useUid = true,
): Promise<void> {
  const development = isDevEnvironment();
  header(
    "X-RateLimit-Limit",
    String(options.max * (development ? REQUEST_MULTIPLIER : 1)),
  );
  // The development multiplier made limits unreachable; skip the binding.
  if (development) return;
  const actor =
    useUid && context.actor.uid !== ""
      ? context.actor.uid
      : getIpKey(context.client.ip);
  if (await consume(`${id}:${actor}`, options)) return;
  header("Retry-After", String(tierFor(options).period));
  if (id === "root") {
    throw new MonkeyError(
      429,
      "Maximum API request (root) limit reached. Please try again later.",
    );
  }
  throw new MonkeyError(429, "Request limit reached, please try again later.");
}

/** Named limits retain the legacy shared buckets (e.g. userGet), across transports. */
export async function enforceOperationLimit(
  metadata: EndpointMetadata,
  context: RateContext,
  header: SetPolicyHeader,
): Promise<void> {
  const limit = metadata.rateLimit;
  if (limit === undefined) return;
  const id = limit;
  const options = limits[id];
  if (options === undefined) {
    throw new MonkeyError(
      500,
      `Unknown rateLimiterId '${id}', how did you manage to do this?`,
    );
  }
  await enforceLimit(id, options, context, header);
}

/** Replaces Better Auth's database-backed limiter for `/auth/*` routes. */
export async function enforceAuthLimit(
  path: string,
  ip: string,
): Promise<void> {
  // Auth clients read only the status; limit headers are not forwarded.
  const header: SetPolicyHeader = () => undefined;
  const context = { actor: GUEST, client: { ip } };
  await enforceLimit("auth", AUTH_LIMIT, context, header, false);
  if (/^\/auth\/(sign-in|sign-up|change-password|change-email)/.test(path)) {
    await enforceLimit(
      "auth.sign-in",
      AUTH_SIGN_IN_LIMIT,
      context,
      header,
      false,
    );
  }
}

/**
 * Bad-authentication points live in this location's Cache API: per-location
 * and approximate, like Workers rate limiting, with no D1 traffic. The Cache
 * API is unavailable on workers.dev hostnames, where this policy is inert.
 */
const BAD_AUTH_WINDOW_MS = 3600000;
const BAD_AUTH_THRESHOLD = 30;
type BadAuthentication = { points: number; expiresAt: number };

async function badAuthCache(): Promise<Cache | undefined> {
  return typeof caches === "undefined"
    ? undefined
    : await caches.open("bad-authentication");
}

function badAuthKey(ip: string): string {
  return `${new URL(getFrontendUrl()).origin}/__bad-authentication/${encodeURIComponent(getIpKey(ip))}`;
}

async function readBadAuthentication(
  cache: Cache,
  ip: string,
): Promise<BadAuthentication | undefined> {
  const entry = (await (await cache.match(badAuthKey(ip)))?.json()) as
    | BadAuthentication
    | undefined;
  return entry !== undefined && entry.expiresAt > Date.now()
    ? entry
    : undefined;
}

/** Current points for a client; independent of configuration so it can run in parallel. */
export async function badAuthenticationPoints(ip: string): Promise<number> {
  try {
    const cache = await badAuthCache();
    return cache === undefined
      ? 0
      : ((await readBadAuthentication(cache, ip))?.points ?? 0);
  } catch {
    return 0;
  }
}

export function assertGoodAuthentication(
  configuration: RateContext["configuration"],
  points: number,
): void {
  if (!configuration.rateLimiting.badAuthentication.enabled) return;
  if (points >= BAD_AUTH_THRESHOLD * (isDevEnvironment() ? 100 : 1)) {
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
    const cache = await badAuthCache();
    if (cache === undefined) return;
    const current = await readBadAuthentication(cache, context.client.ip);
    const entry: BadAuthentication = current ?? {
      points: 0,
      expiresAt: Date.now() + BAD_AUTH_WINDOW_MS,
    };
    entry.points += options.penalty;
    const maxAge = Math.max(
      1,
      Math.ceil((entry.expiresAt - Date.now()) / 1000),
    );
    await cache.put(
      badAuthKey(context.client.ip),
      Response.json(entry, {
        headers: { "Cache-Control": `max-age=${maxAge}` },
      }),
    );
  } catch {}
}
