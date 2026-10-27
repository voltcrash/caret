import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import {
  getCachedConfiguration,
  patchConfiguration,
} from "../../src/init/configuration";
import { withRuntime } from "../../src/runtime/env";

describe("isolate configuration cache", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => await test.dispose());

  const read = async (): Promise<boolean> =>
    await withRuntime(
      test.env,
      async () => (await getCachedConfiguration()).maintenance,
    );
  const setMaintenance = async (value: boolean): Promise<void> => {
    await test.db.prepare(
      "UPDATE configuration SET data=jsonb_set(data,'{maintenance}',?::jsonb) WHERE id='main'",
    )
      .bind(String(value))
      .run();
  };

  it("reuses one PostgreSQL read across invocations and refreshes after a patch", async () => {
    expect(await read()).toBe(false);
    await setMaintenance(true);
    expect(await read()).toBe(false);
    await withRuntime(
      test.env,
      async () => await patchConfiguration({ maintenance: true }),
    );
    expect(await read()).toBe(true);
    await withRuntime(
      test.env,
      async () => await patchConfiguration({ maintenance: false }),
    );
  });

  it("gives each invocation its own copy", async () => {
    await withRuntime(test.env, async () => {
      (await getCachedConfiguration()).maintenance = true;
    });
    expect(await read()).toBe(false);
  });

  it("reads PostgreSQL every invocation when the TTL is zero", async () => {
    const env = { ...test.env, CONFIGURATION_CACHE_TTL_MS: "0" };
    const readUncached = async (): Promise<boolean> =>
      await withRuntime(
        env,
        async () => (await getCachedConfiguration()).maintenance,
      );
    expect(await readUncached()).toBe(false);
    await setMaintenance(true);
    expect(await readUncached()).toBe(true);
    await setMaintenance(false);
  });
});
