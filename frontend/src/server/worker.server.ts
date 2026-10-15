import "@tanstack/solid-start/server-only";
import type {
  ExecutionContext,
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types";
import { withRuntime, type WorkerEnv } from "@oxytype/backend/runtime";
import { consumeBatch, scheduled } from "@oxytype/backend/jobs";
import { boundedRequest } from "./request-body.server";

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
  handler: (request: Request) => Response | Promise<Response>,
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
          const bounded = await boundedRequest(request);
          return bounded instanceof Response ? bounded : await handler(bounded);
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
