import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import * as Quotes from "../../src/dal/new-quotes";
import { statement } from "../../src/db/client";

describe("quote approval delivery", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => {
    await test?.dispose();
  });
  it("reuses quote approval idempotency keys and retains failed submissions", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("failure", { status: 503 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    try {
      await withRuntime(
        {
          ...test.env,
          INTEGRATION_URL: "https://bridge.example/",
          INTEGRATION_SECRET: "test-secret",
        },
        async () => {
          await statement(
            "INSERT INTO quote_submissions(id,language,submitted_by,timestamp,data) VALUES('approval','english','submitter',0,?)",
            JSON.stringify({
              text: "Quote",
              source: "Source",
              language: "english",
            }),
          ).run();
          await expect(
            Quotes.approve("approval", undefined, undefined, "Moderator"),
          ).rejects.toThrow(/503/);
          expect(
            await statement(
              "SELECT count(*) AS count FROM quote_submissions WHERE id='approval'",
            ).first("count"),
          ).toBe(1);
          await Quotes.approve("approval", undefined, undefined, "Moderator");
          expect(fetch).toHaveBeenCalledTimes(2);
          for (const call of fetch.mock.calls) {
            expect(call[0]).toEqual(
              new URL("https://bridge.example/quotes/approve"),
            );
            expect(call[1]?.headers).toMatchObject({
              "idempotency-key": "quote:approval",
            });
          }
          expect(
            await statement(
              "SELECT count(*) AS count FROM quote_submissions",
            ).first("count"),
          ).toBe(0);
        },
      );
    } finally {
      fetch.mockRestore();
    }
  });
});
