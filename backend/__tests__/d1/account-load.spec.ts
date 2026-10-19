import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { resultRuntime } from "./result-support";

let test: Awaited<ReturnType<typeof resultRuntime>>;
beforeAll(async () => {
  test = await resultRuntime();
});
afterAll(async () => await test?.dispose());

it("loads a registered account after the inbox-removal migration", async () => {
  expect(
    await test.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='inbox'",
    ).first(),
  ).toBeNull();
  const account = await test.account();
  const response = await test.request(account, "/users?client=web");
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    data: {
      uid: account.uid,
      name: "Result0",
      tags: [],
      resultFilterPresets: [],
    },
  });
});
