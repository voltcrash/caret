import MonkeyError from "../utils/error";
import { statement } from "../db/client";
import { envValue } from "../runtime/env";
import { isDevEnvironment } from "../utils/misc";
import {
  limits,
  RateLimiterId,
  RateLimitOptions,
  Window,
} from "@oxytype/contracts/rate-limit/index";
import statuses from "../constants/monkey-status-codes";
import { getMetadata } from "./utility";
import { ApiContext, ApiMiddleware, HttpRequest } from "../api/http";

export const REQUEST_MULTIPLIER = 100;
let limiterSequence = 0;
import { consume, type CounterResult } from "../policies/rate-counter";
import { clientIp } from "../policies/client-ip";

export function getClientIp(c: ApiContext): string {
  return clientIp(
    c.req.raw.headers,
    envValue("MODE") === "dev",
    c.env?.incoming?.socket.remoteAddress,
  );
}

export { getIpKey } from "../policies/ip-key";
import { getIpKey } from "../policies/ip-key";

function getKey(req: HttpRequest): string {
  return getIpKey(req.ip);
}

function customHandler(req: HttpRequest): never {
  if (req.ctx.decodedToken.type === "ApeKey") {
    throw new MonkeyError(
      statuses.APE_KEY_RATE_LIMIT_EXCEEDED.code,
      statuses.APE_KEY_RATE_LIMIT_EXCEEDED.message,
    );
  }
  throw new MonkeyError(429, "Request limit reached, please try again later.");
}

function convertWindowToMs(window: Window): number {
  if (typeof window === "number") return window;
  return { second: 1000, minute: 60000, hour: 3600000, day: 86400000 }[window];
}

export function createRateLimiter(
  options: RateLimitOptions,
  useUid = true,
  onLimit: (req: HttpRequest) => never = customHandler,
): ApiMiddleware {
  const id = `limiter:${limiterSequence++}`;
  return async (c, next) => {
    const req = c.get("request"),
      max = options.max * (isDevEnvironment() ? 100 : 1);
    const actor =
      useUid && req.ctx.decodedToken.uid !== ""
        ? req.ctx.decodedToken.uid
        : getKey(req);
    const result = await consume(
      `${id}:${actor}`,
      convertWindowToMs(options.window),
    );
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - result.points)));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.expiresAt / 1000)));
    if (result.points > max) {
      c.header(
        "Retry-After",
        String(Math.max(1, Math.ceil((result.expiresAt - Date.now()) / 1000))),
      );
      onLimit(req);
    }
    await next();
  };
}

const requestLimiters = Object.fromEntries(
  Object.entries(limits).map(([id, options]) => [
    id,
    createRateLimiter(options),
  ]),
) as Record<RateLimiterId, ApiMiddleware>;

export function rateLimitRequest(): ApiMiddleware {
  return async (c, next) => {
    const req = c.get("request");
    const metadataRateLimit = getMetadata(req).rateLimit;
    if (metadataRateLimit === undefined) {
      await next();
      return;
    }
    const hasApeKeyLimiterId = typeof metadataRateLimit === "object";
    const rateLimiterId =
      req.ctx.decodedToken.type === "ApeKey"
        ? hasApeKeyLimiterId
          ? metadataRateLimit.apeKey
          : "defaultApeRateLimit"
        : hasApeKeyLimiterId
          ? metadataRateLimit.normal
          : metadataRateLimit;
    const limiter = requestLimiters[rateLimiterId];
    if (limiter === undefined) {
      throw new MonkeyError(
        500,
        `Unknown rateLimiterId '${rateLimiterId}', how did you manage to do this?`,
      );
    }
    await limiter(c, next);
  };
}

export const rootRateLimiter = createRateLimiter(
  { window: "hour", max: 1000 },
  false,
  () => {
    throw new MonkeyError(
      429,
      "Maximum API request (root) limit reached. Please try again later.",
    );
  },
);

export const badAuthRateLimiterHandler: ApiMiddleware = async (c, next) => {
  const req = c.get("request");
  if (req.ctx.configuration.rateLimiting.badAuthentication.enabled) {
    const result = await statement(
      "SELECT points,expires_at AS expiresAt FROM rate_counters WHERE key=?",
      `bad-auth:${getKey(req)}`,
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
  await next();
};

export async function incrementBadAuth(
  req: HttpRequest | undefined,
  status: number,
): Promise<void> {
  const options = req?.ctx.configuration.rateLimiting.badAuthentication;
  if (!options?.enabled || !options.flaggedStatusCodes.includes(status)) return;
  try {
    await consume(
      `bad-auth:${getKey(req as HttpRequest)}`,
      3600000,
      options.penalty,
    );
  } catch {}
}
