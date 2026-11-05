import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { CompletedEvent } from "@caret/schemas/results";
import { bindTypingActivity } from "../../src/features/typing/scope";
import {
  saveResult,
  retrySavingResult,
  discardPendingResults,
} from "../../src/features/typing/runtime/result-saving";
import { resultOutbox } from "../../src/features/typing/result-outbox.client";
import { requireApplication } from "../../src/app/application";
import { showConfetti } from "../../src/features/typing/runtime/result";
import { __testing } from "../../src/ts/config/testing";
import { getDefaultSnapshot } from "../../src/ts/constants/default-snapshot";
import * as DB from "../../src/ts/db";
import { hashResult } from "../../src/ts/utils/result-hash";
import {
  mockOperation,
  ok,
  fail,
  operationCalls,
  resetOperations,
} from "../__harness__/operations";

vi.mock("../../src/features/typing/runtime/result", () => ({
  showConfetti: vi.fn(),
  showCrown: vi.fn(),
  showErrorCrownIfNeeded: vi.fn(),
  updateSavedResultId: vi.fn(),
  updateDailyLeaderboardRank: vi.fn(),
  updateRetrySaving: vi.fn(),
}));
vi.mock("../../src/ts/utils/result-hash", () => ({
  hashResult: vi.fn(
    async (result: CompletedEvent) => `hash-${result.timestamp}`,
  ),
}));
vi.mock("../../src/ts/collections/results", () => ({
  insertLocalResult: vi.fn(),
}));

const presets = [
  ["time", "15"],
  ["time", "30"],
  ["time", "60"],
  ["time", "120"],
  ["words", "10"],
  ["words", "25"],
  ["words", "50"],
  ["words", "100"],
] as const;

function result(mode: "time" | "words", mode2: string): CompletedEvent {
  return {
    mode,
    mode2,
    wpm: 100,
    acc: 100,
    rawWpm: 100,
    consistency: 80,
    keyConsistency: 80,
    wpmConsistency: 80,
    charStats: [125, 0, 0, 0],
    charTotal: 125,
    chartData: { wpm: [100], burst: [100], err: [0] },
    client: "web",
    uid: "test-user",
    hash: "hash",
    keyDuration: [],
    keySpacing: [],
    keyOverlap: 0,
    lastKeyToEnd: 0,
    startToFirstKey: 0,
    stopOnLetter: false,
    incompleteTests: [],
    bailedOut: false,
    blindMode: false,
    tags: [],
    language: "english",
    difficulty: "normal",
    punctuation: false,
    numbers: false,
    lazyMode: false,
    funbox: [],
    timestamp: 0,
    testDuration: 15,
    incompleteTestSeconds: 0,
    afkDuration: 0,
    restartCount: 0,
  };
}

beforeEach(() => {
  requireApplication().accountData.setActor(`saving-${crypto.randomUUID()}`);
  vi.clearAllMocks();
  resetOperations();
  __testing.replaceConfig({ resultSaving: true });
  DB.setSnapshot(getDefaultSnapshot(), { dispatchEvent: false });
  mockOperation("results.add", () => ok({ insertedId: "saved", isPb: true }));
});

afterEach(async () => {
  await discardPendingResults();
  requireApplication().accountData.setActor(null);
});

it("preserves online PB eligibility when immediately retrying a failed save", async () => {
  mockOperation("results.add", () => fail(503, "Unavailable"));
  await saveResult(result("time", "15"), false);
  mockOperation("results.add", (input) => {
    expect(input).toMatchObject({ body: { result: { mode: "time" } } });
    expect(
      (input["body"] as { result: CompletedEvent }).result.offline,
    ).not.toBe(true);
    return ok({ insertedId: "saved", isPb: true });
  });
  await Promise.all([retrySavingResult(), retrySavingResult()]);
  expect(showConfetti).toHaveBeenCalledOnce();
  expect(operationCalls).toHaveBeenCalledTimes(2);
  expect(resultOutbox().entries()).toEqual([]);
});

it("preserves a result in its captured account queue when switching during hashing", async () => {
  const hash = Promise.withResolvers<string>();
  vi.mocked(hashResult).mockReturnValueOnce(hash.promise);
  const account = requireApplication().accountData;
  const actor = account.actor();
  const saving = saveResult(result("time", "15"), false);
  account.setActor(`other-${crypto.randomUUID()}`);
  hash.resolve("old-account-result");
  await saving;
  expect(operationCalls).not.toHaveBeenCalled();
  expect(resultOutbox().entries()).toEqual([]);
  account.setActor(actor);
  await resultOutbox().load();
  expect(resultOutbox().entries()).toMatchObject([
    { result: { hash: "old-account-result" } },
  ]);
});

it("treats an earlier failed completion as historical after a newer save", async () => {
  mockOperation("results.add", () => fail(503, "Unavailable"));
  await saveResult({ ...result("time", "15"), timestamp: 1 }, false);
  mockOperation("results.add", () => ok({ insertedId: "newer", isPb: false }));
  await saveResult({ ...result("time", "15"), timestamp: 2 }, false);
  mockOperation("results.add", (input) => {
    expect(input).toMatchObject({
      body: { result: { timestamp: 1, offline: true } },
    });
    return ok({ insertedId: "older", isPb: false });
  });
  await retrySavingResult();
  expect(resultOutbox().entries()).toEqual([]);
});

it("retains a fixable 403 across an account scope reload", async () => {
  mockOperation("results.add", () =>
    fail(403, "Please change your name before submitting a result"),
  );
  await saveResult(result("time", "15"), false);
  const account = requireApplication().accountData;
  const actor = account.actor();
  account.setActor(null);
  account.setActor(actor);
  await resultOutbox().load();
  expect(resultOutbox().entries()).toHaveLength(1);
});

it("continues draining after a permanently rejected older result", async () => {
  const queue = resultOutbox();
  await queue.add({
    result: { ...result("time", "15"), timestamp: 1, hash: "bad" },
  });
  await queue.add({
    result: { ...result("time", "15"), timestamp: 2, hash: "good" },
  });
  mockOperation("results.add", (input) => {
    const timestamp = (input["body"] as { result: CompletedEvent }).result
      .timestamp;
    return timestamp === 1
      ? fail(463, "Rejected")
      : ok({ insertedId: "saved", isPb: false });
  });
  await retrySavingResult();
  expect(operationCalls).toHaveBeenCalledTimes(2);
  expect(queue.entries()).toEqual([]);
});

it("does not drain a result while its initial upload is in flight", async () => {
  const response =
    Promise.withResolvers<
      ReturnType<typeof ok<{ insertedId: string; isPb: boolean }>>
    >();
  mockOperation("results.add", async () => response.promise);
  const saving = saveResult(result("time", "15"), false);
  await vi.waitFor(() => expect(operationCalls).toHaveBeenCalledOnce());
  await retrySavingResult();
  expect(operationCalls).toHaveBeenCalledOnce();
  response.resolve(ok({ insertedId: "saved", isPb: false }));
  await saving;
});

it("does not retry an old actor's current result after an account switch", async () => {
  mockOperation("results.add", () => fail(503, "Unavailable"));
  await saveResult(result("time", "15"), false);
  const retry = retrySavingResult();
  requireApplication().accountData.setActor(`other-${crypto.randomUUID()}`);
  await retry;
  expect(operationCalls).toHaveBeenCalledOnce();
});

it("does not apply a save to an account switched during durable acknowledgement", async () => {
  const queue = resultOutbox();
  const remove = queue.remove;
  vi.spyOn(queue, "remove").mockImplementationOnce(async (hash) => {
    requireApplication().accountData.setActor(
      `replacement-${crypto.randomUUID()}`,
    );
    DB.setSnapshot(getDefaultSnapshot(), { dispatchEvent: false });
    await remove(hash);
  });
  mockOperation("results.add", () =>
    ok({ insertedId: "old-actor", isPb: false, xp: 100 }),
  );
  await saveResult(result("time", "15"), false);
  expect(DB.getSnapshot()?.xp ?? 0).toBe(0);
});

describe.each(presets)("PB confetti: %s %s", (mode, mode2) => {
  it("celebrates a confirmed PB with an empty local cache", async () => {
    await saveResult(result(mode, mode2), false);
    expect(showConfetti).toHaveBeenCalledOnce();
    expect(
      DB.getLocalPB(mode, mode2, false, false, "english", "normal", false, []),
    ).toMatchObject({ wpm: 100 });
  });

  it("celebrates beating the previous PB for the same settings", async () => {
    DB.saveLocalResult({
      isPb: true,
      result: { ...result(mode, mode2), _id: "previous", wpm: 90 },
    });
    await saveResult(result(mode, mode2), false);
    expect(showConfetti).toHaveBeenCalledOnce();
  });

  it("does not celebrate a result the server says is not a PB", async () => {
    mockOperation("results.add", () =>
      ok({ insertedId: "saved", isPb: false }),
    );
    await saveResult(result(mode, mode2), false);
    expect(showConfetti).not.toHaveBeenCalled();
  });
});

it("does not celebrate a PB after leaving the typing route", async () => {
  let active = true;
  const unbind = bindTypingActivity(() => active);
  mockOperation("results.add", () => {
    active = false;
    return ok({ insertedId: "saved", isPb: true });
  });
  try {
    await saveResult(result("time", "15"), false);
    expect(showConfetti).not.toHaveBeenCalled();
  } finally {
    unbind();
  }
});

it("keeps late failures historical after a newer completion", async () => {
  const old = Promise.withResolvers<ReturnType<typeof fail>>();
  mockOperation("results.add", async (input) =>
    (input["body"] as { result: CompletedEvent }).result.timestamp === 1
      ? old.promise
      : ok({ insertedId: "new", isPb: false }),
  );
  const saving = saveResult({ ...result("time", "15"), timestamp: 1 }, false);
  await vi.waitFor(() => expect(operationCalls).toHaveBeenCalledOnce());
  await saveResult({ ...result("time", "15"), timestamp: 2 }, false);
  old.resolve(fail(503, "Unavailable"));
  await saving;
  mockOperation("results.add", (input) => {
    expect(input).toMatchObject({
      body: { result: { timestamp: 1, offline: true } },
    });
    return ok({ insertedId: "old", isPb: false });
  });
  await retrySavingResult();
  expect(resultOutbox().entries()).toEqual([]);
});
