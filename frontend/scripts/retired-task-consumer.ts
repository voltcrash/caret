import { z } from "zod";

const consumerSchema = z.object({
  consumer_id: z.string().min(1),
  type: z.string(),
  script: z.string().nullish(),
  script_name: z.string().nullish(),
  service: z.string().nullish(),
  environment: z.string().nullish(),
});

const queuesSchema = z.array(
  z.object({
    queue_id: z.string().min(1),
    queue_name: z.string(),
    consumers: z.array(consumerSchema),
  }),
);

/** Detach the removed task processor; retain the queue, DLQ and messages. */
export async function retireTaskConsumer(
  target: {
    accountId: string;
    queueName: string;
    workerName: string;
    apiToken: string;
  },
  request: typeof fetch = fetch,
): Promise<number> {
  if (!target.apiToken.trim()) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is required to retire task consumers",
    );
  }
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(target.accountId)}/queues`;

  async function call(path: string, method: string): Promise<unknown> {
    const response = await request(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${target.apiToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `Task consumer ${method} failed (HTTP ${response.status}); deployment stopped`,
      );
    }
    const body = z
      .object({ success: z.literal(true), result: z.unknown() })
      .parse(await response.json());
    return body.result;
  }

  // Wrangler uses this name filter too; still require an exact identity match.
  const queues = queuesSchema.parse(
    await call(`?name=${encodeURIComponent(target.queueName)}`, "GET"),
  );
  const queue = queues.find((item) => item.queue_name === target.queueName);
  if (queue === undefined) return 0;
  let removed = 0;
  for (const consumer of queue.consumers) {
    if (consumer.type !== "worker") continue;
    const name = consumer.script ?? consumer.script_name ?? consumer.service;
    if (name === undefined || name === null) {
      throw new Error("Task queue consumer has no Worker identity");
    }
    if (
      name !== target.workerName ||
      (consumer.environment ?? "production") !== "production"
    ) {
      continue;
    }
    await call(
      `/${encodeURIComponent(queue.queue_id)}/consumers/${encodeURIComponent(consumer.consumer_id)}`,
      "DELETE",
    );
    removed++;
  }
  return removed;
}
