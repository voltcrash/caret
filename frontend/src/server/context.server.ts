import "@tanstack/solid-start/server-only";
import { runtime } from "@oxytype/backend/runtime";
import { clientIp } from "@oxytype/backend/client-ip";

export type ServiceContext = {
  runtime: ReturnType<typeof runtime>;
  request: Request;
  requestId: string;
  clientIp: string;
  background: (task: Promise<unknown>) => void;
};

export function createServiceContext(request: Request): ServiceContext {
  const scope = runtime();
  return {
    runtime: scope,
    request,
    requestId: scope.request?.requestId ?? crypto.randomUUID(),
    clientIp: clientIp(request.headers, scope.env.MODE === "dev"),
    background: (task: Promise<unknown>): void => {
      scope.execution?.waitUntil(
        task.catch((error: unknown) =>
          console.error("Background task failed", error),
        ),
      );
    },
  };
}
