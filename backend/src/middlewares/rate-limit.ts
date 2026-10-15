import type { RateLimitOptions } from "@oxytype/contracts/rate-limit/index";
import type { ApiContext, ApiMiddleware, HttpRequest } from "../api/http";
import { envValue } from "../runtime/env";
import { clientIp } from "../policies/client-ip";
import {
  enforceLimit,
  enforceOperationLimit,
  checkBadAuthentication,
  recordBadAuthentication,
} from "../policies/rate-limit";
import { policyContext } from "../api/service-adapter";
import { getMetadata } from "./utility";

export const REQUEST_MULTIPLIER = 100;
export { getIpKey } from "../policies/ip-key";
export function getClientIp(c: ApiContext): string {
  return clientIp(
    c.req.raw.headers,
    envValue("MODE") === "dev",
    c.env?.incoming?.socket.remoteAddress,
  );
}
export function createRateLimiter(
  options: RateLimitOptions,
  useUid = true,
  onLimit?: (req: HttpRequest) => never,
  id?: string,
): ApiMiddleware {
  return async (c, next) => {
    const req = c.get("request");
    try {
      await enforceLimit(
        id ?? `http:${req.method}:${req.path}`,
        options,
        policyContext(req),
        (key, value) => c.header(key, value),
        useUid,
      );
    } catch (error) {
      if (
        onLimit !== undefined &&
        error instanceof Error &&
        "status" in error &&
        error.status === 429
      ) {
        onLimit(req);
      }
      throw error;
    }
    await next();
  };
}
export function rateLimitRequest(): ApiMiddleware {
  return async (c, next) => {
    const req = c.get("request");
    await enforceOperationLimit(
      getMetadata(req),
      policyContext(req),
      (key, value) => c.header(key, value),
    );
    await next();
  };
}
export const rootRateLimiter = createRateLimiter(
  { window: "hour", max: 1000 },
  false,
  undefined,
  "root",
);
export const badAuthRateLimiterHandler: ApiMiddleware = async (c, next) => {
  await checkBadAuthentication(policyContext(c.get("request")));
  await next();
};
export async function incrementBadAuth(
  req: HttpRequest | undefined,
  status: number,
): Promise<void> {
  if (req !== undefined) {
    await recordBadAuthentication(policyContext(req), status);
  }
}
