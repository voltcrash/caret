import "@tanstack/solid-start/server-only";
import { handleAuthRequest } from "@oxytype/backend/auth";
import { createServiceContext } from "./context.server";

export async function authHandler(request: Request): Promise<Response> {
  const context = createServiceContext(request, false);
  return await handleAuthRequest(request, context.clientIp);
}
