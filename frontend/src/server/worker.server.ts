import "@tanstack/solid-start/server-only";
import type {
  ExecutionContext,
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types";
import { runtime, withRuntime, type WorkerEnv } from "@oxytype/backend/runtime";
import { consumeBatch, scheduled } from "@oxytype/backend/jobs";
import { boundedRequest } from "./request-body.server";
import { applyResponsePolicy } from "./response-policy.server";

export type ApplicationWorker = {
  fetch: (
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ) => Promise<Response>;
  queue: (
    batch: MessageBatch,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
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
            response =
              bounded instanceof Response
                ? bounded
                : await handler(bounded, { context: { nonce } });
          } catch (error) {
            console.error("Application request failed", { requestId, error });
            response = new Response("Internal Server Error", { status: 500 });
          }
          console.info(
            JSON.stringify({
              event: "request",
              requestId,
              method: request.method,
              path: new URL(request.url).pathname,
              status: response.status,
              durationMs: Date.now() - started,
            }),
          );
          return applyResponsePolicy(
            response,
            nonce,
            requestId,
            env.MODE === "dev",
          );
        },
        ctx,
      );
    },
    async queue(
      batch: MessageBatch,
      env: WorkerEnv,
      ctx: ExecutionContext,
    ): Promise<void> {
      await withRuntime(env, async () => await consumeBatch(batch), ctx);
    },
    async scheduled(
      controller: ScheduledController,
      env: WorkerEnv,
      ctx: ExecutionContext,
    ): Promise<void> {
      await withRuntime(
        env,
        async () => await scheduled(controller.scheduledTime),
        ctx,
      );
    },
  };
}
