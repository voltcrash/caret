import type { ServiceContext } from "../services/context";
import { runtime, background } from "../runtime/env";
import type { HttpRequest } from "./http";

/** Policies need identity/config/client data without initializing infrastructure. */
export function policyContext(
  req: HttpRequest,
): Pick<ServiceContext, "actor" | "configuration" | "client"> {
  return {
    actor: req.ctx.decodedToken,
    configuration: req.ctx.configuration,
    client: { ip: req.ip, userAgent: req.headers["user-agent"] },
  };
}
export function serviceContext(req: HttpRequest): ServiceContext {
  const scope = runtime();
  return {
    ...policyContext(req),
    runtime: scope,
    requestId: scope.request?.requestId ?? crypto.randomUUID(),
    background,
  };
}
