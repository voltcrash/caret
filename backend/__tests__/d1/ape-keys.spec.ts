import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { patchConfiguration } from "../../src/init/configuration";
import { hashApeKey } from "../../src/utils/ape-key-hash";
import * as Keys from "../../src/dal/ape-keys";
import Worker from "../__testData__/http-worker";
import type { ExecutionContext } from "@cloudflare/workers-types";

describe("Worker ApeKey authentication with D1", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  const context = { waitUntil: () => undefined } as unknown as ExecutionContext;
  const keyId = "sha-key";
  const secret = "test-key";

  beforeAll(async () => {
    test = await createTestRuntime();
    await seedUser(test.env, "key-owner");
    await withRuntime(test.env, async () => {
      await patchConfiguration({ apeKeys: { acceptKeys: true } });
      await Keys.addApeKey({
        _id: keyId,
        uid: "key-owner",
        name: "SHA-256 key",
        enabled: true,
        hash: hashApeKey(secret),
        createdOn: 0,
        modifiedOn: 0,
        lastUsedOn: -1,
        useCount: 0,
      });
    });
  });
  afterAll(async () => await test?.dispose());

  async function request(key: string): Promise<Response> {
    const encoded = Buffer.from(`${keyId}.${key}`).toString("base64url");
    return await Worker.fetch(
      new Request("http://localhost:5005/api/users/stats", {
        headers: { authorization: `ApeKey ${encoded}` },
      }),
      test.env,
      context,
    );
  }

  it("authenticates an existing SHA-256 key and tracks use without rewriting its hash", async () => {
    expect((await request(secret)).status).toBe(200);
    await withRuntime(test.env, async () => {
      const key = await Keys.getApeKey(keyId);
      expect(key?.hash).toBe(hashApeKey(secret));
      expect(key?.useCount).toBe(1);
      expect(key?.lastUsedOn).toBeGreaterThan(0);
      expect(key?.modifiedOn).toBe(0);
    });
  });

  it("rejects an incorrect key without incrementing its use count", async () => {
    const before = await withRuntime(test.env, async () =>
      Keys.getApeKey(keyId),
    );
    const response = await request("incorrect");
    expect(response.status).toBe(470);
    expect(await response.json()).toMatchObject({ message: "Invalid ApeKey" });
    await withRuntime(test.env, async () => {
      expect((await Keys.getApeKey(keyId))?.useCount).toBe(before?.useCount);
    });
  });
});
