import "@tanstack/solid-start/server-only";
import { buildApp } from "@oxytype/backend/legacy-http";
import { runtime } from "@oxytype/backend/runtime";

/**
 * Retained `/api/*` HTTP contracts and web operations not yet moved to server
 * functions. Same in-process service dispatch as the legacy Worker; never a
 * loopback request. Retires as Stage 6 ports callers and external routes.
 */
export async function legacyHttp(request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice("/api".length) || "/";
  return await buildApp().fetch(new Request(url, request), runtime().env);
}
