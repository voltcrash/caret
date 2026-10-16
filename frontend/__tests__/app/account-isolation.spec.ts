import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const requests = vi.hoisted(() => ({
  user: vi.fn(),
  config: vi.fn(),
  save: vi.fn(async () => undefined),
}));

vi.mock("../../src/ts/config/sync", () => ({ saveConfig: requests.save }));
vi.mock("../../src/ts/states/server-configuration", () => ({
  sync: async () => undefined,
}));

import { preferencesReadiness } from "../../src/app/readiness";
import { updateFromServer } from "../../src/ts/config/remote";
import { getMutableConfig } from "../../src/ts/config/store";
import { saveToLocalStorage } from "../../src/ts/config/persistence";
import { getDefaultConfig } from "../../src/ts/constants/default-config";
import { getDefaultSnapshot } from "../../src/ts/constants/default-snapshot";
import * as DB from "../../src/ts/db";
import { setUserId } from "../../src/ts/states/core";
import { getSnapshot } from "../../src/ts/states/snapshot";
import { getTags } from "../../src/ts/collections/tags";
import { mockHttpFixture, mockOperation } from "../__harness__/operations";

mockOperation("users.get", async () => {
  const response = (await requests.user()) as {
    status: number;
    body: { data?: unknown; message?: string };
  };
  return response.status === 200
    ? { ok: true, status: 200, message: "", data: response.body.data }
    : {
        ok: false,
        status: response.status,
        message: response.body.message ?? "",
      };
});

beforeEach(async () => {
  setUserId(null);
  vi.clearAllMocks();
  Object.assign(getMutableConfig(), getDefaultConfig());
  await preferencesReadiness().start(async () => undefined);
});
afterEach(() => {
  setUserId(null);
  vi.useRealTimers();
});

it("clears raw and reactive snapshots and ignores a late account initialization", async () => {
  setUserId("a");
  let finish!: (value: unknown) => void;
  requests.user.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const old = expect(DB.initSnapshot()).rejects.toMatchObject({
    name: "AbortError",
  });
  setUserId("b");
  expect(DB.getSnapshot()).toBeUndefined();
  expect(getSnapshot()).toBeUndefined();
  DB.setSnapshot({ ...getDefaultSnapshot(), name: "B" });
  finish({ status: 200, body: { data: { name: "A", tags: [] } } });
  await old;
  expect(DB.getSnapshot()?.name).toBe("B");
  expect(getSnapshot()?.name).toBe("B");
});

it("never applies another actor's delayed preferences or queued config write", async () => {
  vi.useFakeTimers();
  setUserId("a");
  let finish!: (value: unknown) => void;
  requests.config.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const old = expect(updateFromServer()).rejects.toMatchObject({
    name: "AbortError",
  });
  saveToLocalStorage("numbers");
  setUserId("b");
  finish({
    status: 200,
    body: { data: { ...getDefaultConfig(), theme: "nord" } },
  });
  await old;
  await vi.advanceTimersByTimeAsync(2000);
  expect(getMutableConfig().theme).toBe(getDefaultConfig().theme);
  expect(requests.save).not.toHaveBeenCalled();
});

it("replaces real collection readers and refuses a previous actor's late response", async () => {
  setUserId("a");
  let finish!: (value: unknown) => void;
  requests.user.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  expect(getTags()).toEqual([]);
  await vi.waitFor(() => expect(requests.user).toHaveBeenCalledOnce());
  setUserId("b");
  requests.user.mockResolvedValue({
    status: 200,
    body: { data: { tags: [{ _id: "b", name: "B" }] } },
  });
  await vi.waitFor(() =>
    expect(getTags().map((tag) => tag._id)).toEqual(["b"]),
  );
  finish({ status: 200, body: { data: { tags: [{ _id: "a", name: "A" }] } } });
  await Promise.resolve();
  await Promise.resolve();
  expect(getTags().map((tag) => tag._id)).toEqual(["b"]);
});

mockHttpFixture("configs.get", async (input) => await requests.config(input));
