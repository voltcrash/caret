import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CompletedEvent } from "@oxytype/schemas/results";
import { saveResult } from "../../src/features/typing/runtime/result-saving";
import { showConfetti } from "../../src/features/typing/runtime/result";
import { __testing } from "../../src/ts/config/testing";
import { getDefaultSnapshot } from "../../src/ts/constants/default-snapshot";
import * as DB from "../../src/ts/db";
import { mockOperation, ok, resetOperations } from "../__harness__/operations";

vi.mock("../../src/features/typing/runtime/result", () => ({
  showConfetti: vi.fn(),
  showCrown: vi.fn(),
  showErrorCrownIfNeeded: vi.fn(),
  updateSavedResultId: vi.fn(),
  updateDailyLeaderboardRank: vi.fn(),
  updateRetrySaving: vi.fn(),
}));
vi.mock("../../src/ts/utils/result-hash", () => ({
  hashResult: async () => "hash",
}));
vi.mock("../../src/ts/collections/results", () => ({
  insertLocalResult: vi.fn(),
}));

const presets = [
  ["time", "15"],
  ["time", "30"],
  ["time", "60"],
  ["time", "120"],
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
  vi.clearAllMocks();
  resetOperations();
  __testing.replaceConfig({ resultSaving: true });
  DB.setSnapshot(getDefaultSnapshot(), { dispatchEvent: false });
  mockOperation("results.add", () => ok({ insertedId: "saved", isPb: true }));
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
