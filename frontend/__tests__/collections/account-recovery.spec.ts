import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { requireApplication } from "../../src/app/application";
import {
  waitForPresetsReady,
  getPresets,
} from "../../src/ts/collections/presets";
import { waitForTagsReady, getTags } from "../../src/ts/collections/tags";
import { setUserId } from "../../src/ts/states/core";
import {
  fail,
  mockOperation,
  ok,
  operationCalls,
  resetOperations,
} from "../__harness__/operations";

beforeEach(() => {
  resetOperations();
  setUserId("recover");
});
afterEach(() => {
  setUserId(null);
  requireApplication().queryClient.clear();
});

it("retries failed tags against the recovered account instead of replaying the old error", async () => {
  mockOperation("users.get", () => fail(500, "Server unavailable"));
  await expect(waitForTagsReady()).rejects.toThrow("Server unavailable");

  mockOperation("users.get", () =>
    ok({ tags: [{ _id: "tag", name: "practice" }] }),
  );
  await waitForTagsReady();
  expect(getTags().map((tag) => tag.name)).toEqual(["practice"]);
  expect(operationCalls).toHaveBeenCalledTimes(2);
});

it("retries failed presets and accepts an empty recovered collection", async () => {
  mockOperation("presets.get", () => fail(500, "Server unavailable"));
  await expect(waitForPresetsReady()).rejects.toThrow("Server unavailable");

  mockOperation("presets.get", () => ok([]));
  await waitForPresetsReady();
  expect(getPresets()).toEqual([]);
  expect(operationCalls).toHaveBeenCalledTimes(2);
});
