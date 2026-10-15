import type {
  ExecutionContext,
  MessageBatch,
  ScheduledController,
} from "@cloudflare/workers-types";
import { withRuntime, type WorkerEnv } from "@oxytype/backend/runtime";
import { consumeBatch, scheduled } from "@oxytype/backend/jobs";
import server from "./server";

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return await withRuntime(env, async () => await server.fetch(request), ctx);
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
