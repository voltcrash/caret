import "@tanstack/solid-start/server-only";
import type {
  ExecutionContext,
  ScheduledController,
} from "@cloudflare/workers-types";
import { runtime, withRuntime, type WorkerEnv } from "@oxytype/backend/runtime";
import { scheduled } from "@oxytype/backend/jobs";
import { boundedRequest } from "./request-body.server";
import {
  EDGE_CACHE_HIT,
  edgeCacheKey,
  storeEdgeCache,
} from "./edge-cache.server";
import { applyResponsePolicy } from "./response-policy.server";
import {
  placementOf,
  requestLog,
  requestMetrics,
  serverBuildId,
} from "./observability.server";

async function observeScheduled(
  env: WorkerEnv,
  run: () => Promise<void>,
): Promise<void> {
  const started = Date.now();
  let completed = false;
  try {
    await run();
    completed = true;
  } finally {
    console.info(
      JSON.stringify({
        event: "scheduled",
        build: serverBuildId,
        release: env.VERSION,
        outcome: completed ? "ok" : "error",
        durationMs: Date.now() - started,
      }),
    );
  }
}

export type ApplicationWorker = {
  fetch: (
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ) => Promise<Response>;
  scheduled: (
    controller: ScheduledController,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
};

export function createApplicationWorker(
  handler: (
    request: Request,
    options: { context: { nonce: string } },
  ) => Response | Promise<Response>,
): ApplicationWorker {
  return {
    async fetch(
      request: Request,
      env: WorkerEnv,
      ctx: ExecutionContext,
    ): Promise<Response> {
      return await withRuntime(
        env,
        async () => {
          const nonce = crypto.randomUUID().replaceAll("-", "");
          const requestId = crypto.randomUUID();
          runtime().request = { nonce, requestId };
          const started = Date.now();
          let response: Response;
          try {
            const bounded = await boundedRequest(request);
            if (bounded instanceof Response) {
              response = bounded;
            } else {
              response = await handler(bounded, { context: { nonce } });
              const cacheKey = edgeCacheKey(bounded);
              if (cacheKey !== undefined) {
                storeEdgeCache(cacheKey, response, ctx);
              }
            }
            if (
              bounded instanceof Response &&
              new URL(request.url).pathname.startsWith("/api/") &&
              !new URL(request.url).pathname.startsWith("/api/auth/")
            ) {
              response = Response.json(
                { message: await bounded.text(), data: null },
                { status: bounded.status },
              );
            }
          } catch (error) {
            console.error("Application request failed", {
              requestId,
              build: serverBuildId,
              release: env.VERSION,
              error,
            });
            response = new Response("Internal Server Error", { status: 500 });
          }
          const log = requestLog({
            request,
            requestId,
            status: response.status,
            durationMs: Date.now() - started,
            release: env.VERSION,
            staleClient: response.headers.has("X-Oxytype-Stale-Client"),
            placementMode: env.PLACEMENT_MODE,
          });
          console.info(JSON.stringify(log));
          try {
            env.METRICS?.writeDataPoint(
              requestMetrics(
                log,
                runtime().metrics,
                response.headers.has(EDGE_CACHE_HIT),
              ),
            );
          } catch (error) {
            console.error("Request metrics failed", error);
          }
          const final = applyResponsePolicy(
            response,
            nonce,
            requestId,
            env.MODE === "dev",
          );
          if (env.PLACEMENT_MODE === "smart") {
            const placement = placementOf(request.headers);
            if (placement !== undefined) {
              final.headers.set("X-Oxytype-Placement", placement);
            }
          }
          return final;
        },
        ctx,
      );
    },
    async scheduled(
      controller: ScheduledController,
      env: WorkerEnv,
      ctx: ExecutionContext,
    ): Promise<void> {
      await withRuntime(
        env,
        async () =>
          await observeScheduled(
            env,
            async () => await scheduled(controller.cron),
          ),
        ctx,
      );
    },
  };
}
