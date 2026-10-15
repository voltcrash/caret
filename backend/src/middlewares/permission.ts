import type { ApiMiddleware } from "../api/http";
import { verifyPermissions as verify } from "../policies/permission";
import { getMetadata } from "./utility";
export function verifyPermissions(): ApiMiddleware {
  return async (c, next): Promise<void> => {
    const req = c.get("request");
    await verify(req.ctx.decodedToken, getMetadata(req));
    await next();
  };
}
