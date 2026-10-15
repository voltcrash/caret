import type { ApiMiddleware } from "../api/http";
import { verifyConfiguration } from "../policies/configuration";
import { getMetadata } from "./utility";
export function verifyRequiredConfiguration(): ApiMiddleware {
  return async (c, next): Promise<void> => {
    const req = c.get("request");
    const metadata = getMetadata(req);
    if (metadata.requireConfiguration !== undefined) {
      verifyConfiguration(req.ctx.configuration, metadata);
    }
    await next();
  };
}
