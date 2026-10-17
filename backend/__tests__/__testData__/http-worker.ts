import type { ExecutionContext } from "@cloudflare/workers-types";

import { handleAuthRequest } from "../../src/auth/handler";
import {
  healthResponse,
  runHttpAuxiliary,
  runHttpOperation,
  type HttpInvocation,
} from "../../src/http/handler";
import { clientIp } from "../../src/policies/client-ip";
import { allOperations, type OperationId } from "../../src/policies/operations";
import { runtime, withRuntime, type WorkerEnv } from "../../src/runtime/env";

type Route = {
  id: OperationId;
  method: string;
  pattern: RegExp;
  keys: string[];
};

// Start declares one file route per contract path; static segments win over
// parameters, so match the most specific path first.
const routes: Route[] = allOperations()
  .map(({ id, route }) => {
    const keys: string[] = [];
    const source = route.path
      .replace(/\/$/, "")
      .replace(/:(\w+)/g, (_match, key: string) => {
        keys.push(key);
        return "([^/]+)";
      });
    return {
      id,
      method: route.method,
      pattern: new RegExp(`^${source}$`),
      keys,
    };
  })
  .sort((a, b) => a.keys.length - b.keys.length);

function invocation(request: Request): HttpInvocation {
  const scope = runtime();
  return {
    runtime: scope,
    requestId: scope.request?.requestId ?? crypto.randomUUID(),
    background: (task) => {
      scope.execution?.waitUntil(
        task.catch((error: unknown) =>
          console.error("Background task failed", error),
        ),
      );
    },
    headers: request.headers,
    clientIp: clientIp(request.headers, scope.env.MODE === "dev"),
  };
}

function missing(path: string, method: string): Response {
  return Response.json(
    { message: `Unknown request URL (${method}: ${path})`, data: null },
    { status: 404 },
  );
}

/**
 * Test stand-in for Start's `/api` server routes: the same backend auth,
 * operation and auxiliary handlers, without TanStack routing or Start's
 * request middleware (covered by the frontend workerd suites).
 */
export async function dispatchApi(request: Request): Promise<Response> {
  const path =
    new URL(request.url).pathname
      .replace(/^\/api(?=\/|$)/, "")
      .replace(/\/$/, "") || "/";
  const call = invocation(request);
  if (path === "/auth" || path.startsWith("/auth/")) {
    return await handleAuthRequest(request, call.clientIp);
  }
  if (path === "/" && request.method === "GET") {
    return await runHttpAuxiliary(call, request, async () => healthResponse());
  }
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (match === null || route.method !== request.method) continue;
    const params = Object.fromEntries(
      route.keys.map((key, index) => [key, match[index + 1] ?? ""]),
    );
    return await runHttpOperation(call, request, route.id, params);
  }
  return await runHttpAuxiliary(call, request, async () =>
    missing(path, request.method),
  );
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return await withRuntime(env, async () => await dispatchApi(request), ctx);
  },
};
