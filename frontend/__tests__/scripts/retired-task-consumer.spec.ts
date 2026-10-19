import { describe, expect, it, vi } from "vite-plus/test";
import { retireTaskConsumer } from "../../scripts/retired-task-consumer";

const target = {
  accountId: "account-fixture",
  queueName: "oxytype-production-tasks",
  workerName: "oxytype",
  apiToken: "token-fixture",
};
const base = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/queues`;
const worker = {
  consumer_id: "retired-consumer",
  type: "worker",
  script: "oxytype",
};

function result(value: unknown): Response {
  return Response.json({ success: true, result: value });
}

function queues(consumers: unknown[]): Response {
  return result([
    {
      queue_id: "retired-queue",
      queue_name: target.queueName,
      consumers,
    },
  ]);
}

describe("retired task consumer", () => {
  it.each([
    { script: "oxytype" },
    { script_name: "oxytype" },
    { script: null, script_name: "oxytype", environment: null },
    { service: "oxytype", environment: "production" },
  ])("detaches the old Worker consumer (%j)", async (identity) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        queues([
          { consumer_id: worker.consumer_id, type: "worker", ...identity },
        ]),
      )
      .mockResolvedValueOnce(result(null));

    await expect(retireTaskConsumer(target, request)).resolves.toBe(1);
    expect(
      request.mock.calls.map(([url, init]) => [url, init?.method]),
    ).toEqual([
      [`${base}?name=${target.queueName}`, "GET"],
      [`${base}/retired-queue/consumers/retired-consumer`, "DELETE"],
    ]);
    for (const [, init] of request.mock.calls) {
      expect(init?.headers).toEqual({ Authorization: "Bearer token-fixture" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("is repeatable after removal without deleting queues or messages", async () => {
    let consumers = [worker];
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_, init) => {
        if (init?.method === "DELETE") {
          consumers = [];
          return result(null);
        }
        return queues(consumers);
      });
    await expect(retireTaskConsumer(target, request)).resolves.toBe(1);
    await expect(retireTaskConsumer(target, request)).resolves.toBe(0);
    expect(request.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET",
      "DELETE",
      "GET",
    ]);
  });

  it.each(
    [
      [],
      [
        {
          queue_id: "dlq",
          queue_name: "oxytype-production-dlq",
          consumers: [worker],
        },
      ],
      [
        {
          queue_id: "staging",
          queue_name: "oxytype-staging-tasks",
          consumers: [worker],
        },
      ],
    ].map((response) => ({ response })),
  )("skips missing or unrelated queues (%j)", async ({ response }) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(result(response));
    await expect(retireTaskConsumer(target, request)).resolves.toBe(0);
    expect(request).toHaveBeenCalledOnce();
  });

  it.each([
    { ...worker, script: "another-worker" },
    { ...worker, environment: "preview" },
    { consumer_id: "pull", type: "http_pull" },
  ])("preserves unrelated consumers (%j)", async (consumer) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(queues([consumer]));
    await expect(retireTaskConsumer(target, request)).resolves.toBe(0);
    expect(request).toHaveBeenCalledOnce();
  });

  it.each([401, 403, 404, 429, 500])(
    "stops on lookup HTTP %s",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("failed", { status }));
      await expect(retireTaskConsumer(target, request)).rejects.toThrow(
        `GET failed (HTTP ${status})`,
      );
      expect(request).toHaveBeenCalledOnce();
    },
  );

  it("stops when consumer removal is denied", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(queues([worker]))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));
    await expect(retireTaskConsumer(target, request)).rejects.toThrow(
      "DELETE failed (HTTP 403)",
    );
  });

  it.each([
    { success: false, result: [] },
    { success: true },
    { success: true, result: [{ queue_name: target.queueName }] },
  ])("rejects incomplete or failed API responses (%j)", async (response) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(response));
    await expect(retireTaskConsumer(target, request)).rejects.toThrow();
    expect(request).toHaveBeenCalledOnce();
  });

  it("stops when consumer identity is missing", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(queues([{ consumer_id: "unknown", type: "worker" }]));
    await expect(retireTaskConsumer(target, request)).rejects.toThrow(
      "no Worker identity",
    );
    expect(request).toHaveBeenCalledOnce();
  });

  it("propagates network failures", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    await expect(retireTaskConsumer(target, request)).rejects.toThrow(
      "offline",
    );
  });

  it("requires credentials before contacting Cloudflare", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      retireTaskConsumer({ ...target, apiToken: " " }, request),
    ).rejects.toThrow("CLOUDFLARE_API_TOKEN is required");
    expect(request).not.toHaveBeenCalled();
  });
});
