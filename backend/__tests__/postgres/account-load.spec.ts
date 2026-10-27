import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { resultRuntime } from "./result-support";

let test: Awaited<ReturnType<typeof resultRuntime>>;
beforeAll(async () => {
  test = await resultRuntime();
});
afterAll(async () => await test?.dispose());

it("loads a registered account after the inbox-removal migration", async () => {
  expect(
    await test.db
      .prepare(
        "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename='inbox'",
      )
      .first(),
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
