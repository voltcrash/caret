import { envValue } from "../runtime/env";
import type { Hono } from "hono";
import type { ApiEnv } from "../api/http";
import { getClientIp } from "../middlewares/rate-limit";
import { handleAuthRequest } from "./handler";

/** Legacy transport only; authentication policy is shared with Start. */
export function addAuthRoutes(app: Hono<ApiEnv>): void {
  app.all("/auth/*", async (c) => {
    const url = new URL(
      envValue("BETTER_AUTH_URL") ?? "http://localhost:5005/auth",
    );
    url.pathname =
      url.pathname.replace(/\/$/, "") + c.req.path.slice("/auth".length);
    url.search = new URL(c.req.url).search;
    return await handleAuthRequest(new Request(url, c.req.raw), getClientIp(c));
  });
}
