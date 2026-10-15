import type { ApiMiddleware } from "../api/http";
import { authenticate } from "../policies/authentication";
import { getMetadata } from "./utility";
export type { Actor as DecodedToken } from "../services/context";

export function authenticateTsRestRequest(): ApiMiddleware {
  return async (c, next): Promise<void> => {
    const req = c.get("request");
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, value);
    }
    req.ctx.decodedToken = await authenticate({
      headers,
      configuration: req.ctx.configuration,
      options: getMetadata(req).authenticationOptions,
      endpoint: req.path,
    });
    await next();
  };
}
