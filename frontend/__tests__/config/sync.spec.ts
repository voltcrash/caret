import { beforeEach, expect, it, vi } from "vite-plus/test";
import { requireApplication } from "../../src/app/application";
import { deleteConfig, saveConfig } from "../../src/ts/config/sync";
import { getQueryClient } from "../../src/ts/queries";
import { getRemotePreferencesQueryOptions } from "../../src/ts/queries/preferences";
import {
  mockOperation,
  ok,
  fail,
  operationCalls,
  resetOperations,
} from "../__harness__/operations";

vi.mock("../../src/ts/states/core", () => ({ isAuthenticated: () => true }));

beforeEach(() => {
  requireApplication().accountData.setActor(`sync-${crypto.randomUUID()}`);
  resetOperations();
});

it("serializes conflicting patches and publishes the latest acknowledged value", async () => {
  const first = Promise.withResolvers<ReturnType<typeof ok<null>>>();
  mockOperation("configs.save", async () =>
    operationCalls.mock.calls.length === 1 ? first.promise : ok(null),
  );
  const older = saveConfig({ time: 15 });
  await vi.waitFor(() => expect(operationCalls).toHaveBeenCalledOnce());
  const newer = saveConfig({ time: 30 });
  await Promise.resolve();
  expect(operationCalls).toHaveBeenCalledOnce();
  first.resolve(ok(null));
  await Promise.all([older, newer]);
  expect(operationCalls).toHaveBeenCalledTimes(2);
  expect(
    getQueryClient().getQueryData(getRemotePreferencesQueryOptions().queryKey),
  ).toMatchObject({ time: 30 });
});

it("keeps a failed patch for reconnect retry", async () => {
  mockOperation("configs.save", () => fail(503, "offline"));
  await expect(saveConfig({ time: 60 })).rejects.toThrow("offline");
  mockOperation("configs.save", (input) => {
    expect(input).toEqual({ body: { time: 60 } });
    return ok(null);
  });
  await saveConfig({});
});

it("does not restore an old failed patch across reset", async () => {
  const first = Promise.withResolvers<ReturnType<typeof fail>>();
  mockOperation("configs.save", async () => first.promise);
  mockOperation("configs.delete", () => ok(null));
  const saving = saveConfig({ time: 60 });
  await vi.waitFor(() => expect(operationCalls).toHaveBeenCalledOnce());
  const resetting = deleteConfig();
  first.resolve(fail(503, "offline"));
  await Promise.all([saving, resetting]);
  await saveConfig({});
  expect(operationCalls.mock.calls.map(([id]) => id)).toEqual([
    "configs.save",
    "configs.delete",
  ]);
  expect(
    getQueryClient().getQueryData(getRemotePreferencesQueryOptions().queryKey),
  ).toBeNull();
});
