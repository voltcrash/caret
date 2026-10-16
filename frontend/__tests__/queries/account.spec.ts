import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { requireApplication } from "../../src/app/application";
import { getSnapshot, setSnapshot } from "../../src/ts/db";
import { getQueryClient } from "../../src/ts/queries";
import {
  getAccountQueryOptions,
  loadAccountData,
} from "../../src/ts/queries/account";
import { getSnapshot as getReactiveSnapshot } from "../../src/ts/states/snapshot";
import {
  fail,
  mockOperation,
  ok,
  operationCalls,
  resetOperations,
} from "../__harness__/operations";

const actor = (uid: string | null): void =>
  requireApplication().accountData.setActor(uid);

beforeEach(() => {
  resetOperations();
  actor("first");
});
afterEach(() => {
  actor(null);
  getQueryClient().clear();
});

it("shares one account request between snapshot and collection consumers", async () => {
  mockOperation("users.get", () =>
    ok({ name: "first", streak: { length: 2, maxLength: 5 }, xp: 10 }),
  );
  const [a, b] = await Promise.all([
    loadAccountData("first"),
    loadAccountData("first"),
  ]);
  expect(a).toBe(b);
  expect(a).toMatchObject({ name: "first", streak: 2, maxStreak: 5, xp: 10 });
  await loadAccountData("first");
  expect(operationCalls).toHaveBeenCalledExactlyOnceWith("users.get", {
    query: { client: "web" },
  });
});

it("reports unfinished signup with its status and retries on the next load", async () => {
  mockOperation("users.get", () => fail(404, "Not found"));
  await expect(loadAccountData("first")).rejects.toMatchObject({
    name: "SnapshotInitError",
    responseCode: 404,
  });
  mockOperation("users.get", () => ok({ name: "first" }));
  await expect(loadAccountData("first")).resolves.toMatchObject({
    name: "first",
  });
  expect(operationCalls).toHaveBeenCalledTimes(2);
});

it("never restores another actor's late account", async () => {
  let finish!: () => void;
  mockOperation(
    "users.get",
    async () =>
      await new Promise((resolve) => {
        finish = () => resolve(ok({ name: "first" }));
      }),
  );
  const first = expect(loadAccountData("first")).rejects.toMatchObject({
    name: "AbortError",
  });
  await expect.poll(() => operationCalls.mock.calls.length).toBe(1);
  actor("second");
  mockOperation("users.get", () => ok({ name: "second" }));
  await expect(loadAccountData("second")).resolves.toMatchObject({
    name: "second",
  });
  finish();
  await first;
  expect(getSnapshot()?.name).toBe("second");
});

it("updates the canonical entry and its reactive view through explicit writes", async () => {
  mockOperation("users.get", () =>
    ok({ name: "first", banned: false, lbOptOut: false }),
  );
  await loadAccountData("first");
  expect(getReactiveSnapshot()?.name).toBe("first");
  const snapshot = getSnapshot();
  if (snapshot === undefined) throw new Error("missing snapshot");
  setSnapshot({ ...snapshot, name: "renamed", banned: true, lbOptOut: true });
  expect(
    getQueryClient().getQueryData(getAccountQueryOptions().queryKey),
  ).toMatchObject({ name: "renamed", banned: false, lbOptOut: false });
  expect(getReactiveSnapshot()?.name).toBe("renamed");
  setSnapshot(undefined);
  expect(getSnapshot()).toBeUndefined();
  expect(getReactiveSnapshot()).toBeUndefined();
});
