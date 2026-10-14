import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { resultRuntime } from "./result-support";
import { withRuntime } from "../../src/runtime/env";
import * as Users from "../../src/dal/user";

describe("result submission validation with D1", () => {
  let test: Awaited<ReturnType<typeof resultRuntime>>;
  beforeAll(async () => {
    test = await resultRuntime();
  });
  afterAll(async () => await test?.dispose());

  it("rejects a malformed submission before progression", async () => {
    const account = await test.account();
    const response = await test.request(account, "/results", "POST", {
      result: { mode: "unknown" },
    });
    expect(response.status, await response.clone().text()).toBe(422);
    expect(
      (
        await withRuntime(
          test.env,
          async () => await Users.getUser(account.uid, "test"),
        )
      ).completedTests,
    ).toBeUndefined();
  });
});
