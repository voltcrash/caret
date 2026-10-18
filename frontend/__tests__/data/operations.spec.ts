import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { requireApplication } from "../../src/app/application";
import { operation, operationData } from "../../src/data/operations";
import {
  fail,
  mockOperation,
  ok,
  operationCalls,
  resetOperations,
} from "../__harness__/operations";

afterEach(() => {
  vi.useRealTimers();
  resetOperations();
  requireApplication().accountData.setActor(null);
});

describe("web operation client", () => {
  it("times out a submission once and leaves retry to the explicit save UI", async () => {
    vi.useFakeTimers();
    mockOperation(
      "results.add",
      async (_data, signal) =>
        await new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const pending = operation("results.add", { body: { result: {} as never } });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({
      ok: false,
      status: 500,
      message: "request took too long to complete",
    });
    expect(operationCalls).toHaveBeenCalledOnce();
  });
  it("sends JSON-equivalent input and resolves legacy failures as values", async () => {
    mockOperation("results.get", () => ok([{ _id: "r" }]));
    const timestamp = new Date(0);
    await operation("results.get", {
      query: {
        offset: 0,
        onOrAfterTimestamp: undefined,
        when: timestamp,
      } as never,
    });
    expect(operationCalls).toHaveBeenCalledWith("results.get", {
      query: { offset: 0, when: "1970-01-01T00:00:00.000Z" },
    });
    mockOperation("users.get", () => fail(479, "Banned"));
    expect(await operation("users.get")).toEqual({
      ok: false,
      status: 479,
      message: "Banned",
    });
    await expect(operationData("users.get")).rejects.toThrow("Banned");
  });

  it("maps transport errors to a status 500 result", async () => {
    mockOperation("psas.get", () => {
      throw new Error("Failed to fetch");
    });
    expect(await operation("psas.get")).toEqual({
      ok: false,
      status: 500,
      message: "Failed to fetch",
    });
  });

  it("rejects a private response that arrives after the actor changes", async () => {
    const account = requireApplication().accountData;
    account.setActor("a");
    let finish!: () => void;
    mockOperation(
      "users.getInbox",
      async () =>
        await new Promise((resolve) => {
          finish = () => resolve(ok({ inbox: [] }));
        }),
    );
    const pending = operation("users.getInbox");
    await expect.poll(() => operationCalls.mock.calls.length).toBe(1);
    account.setActor("b");
    finish();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps application data independent of account changes", async () => {
    const account = requireApplication().accountData;
    account.setActor("a");
    let finish!: () => void;
    mockOperation(
      "psas.get",
      async () =>
        await new Promise((resolve) => {
          finish = () => resolve(ok([]));
        }),
    );
    const pending = operation("psas.get");
    await expect.poll(() => operationCalls.mock.calls.length).toBe(1);
    account.setActor("b");
    finish();
    expect(await pending).toMatchObject({ ok: true, data: [] });
  });
});
