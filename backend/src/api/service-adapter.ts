import type { ServiceContext, OperationInput } from "../services/context";
import type { MonkeyRequest } from "./types";
import { runtime, background } from "../runtime/env";
import type { HttpRequest } from "./http";

export function serviceContext(
  req: HttpRequest,
  context = req.ctx,
): ServiceContext {
  return {
    actor: context.decodedToken,
    runtime: runtime(),
    requestId: runtime().request?.requestId ?? crypto.randomUUID(),
    background,
    configuration: context.configuration,
    client: { ip: req.ip, userAgent: req.headers["user-agent"] },
  };
}

/** Rollback transport only. Business services never receive legacy requests. */
export function adaptService<Q, B, P, R>(
  service: (
    context: ServiceContext,
    input: OperationInput<Q, B, P>,
  ) => Promise<R>,
): (req: MonkeyRequest<Q, B, P>) => Promise<R> {
  return async (req) =>
    await service(serviceContext(req.raw, req.ctx), {
      query: req.query,
      body: req.body,
      params: req.params,
    });
}
