import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../src/ts/collections/results", () => ({
  insertLocalResult: vi.fn(),
}));

import { getDefaultSnapshot } from "../src/ts/constants/default-snapshot";
import * as DB from "../src/ts/db";
import { getSnapshot as observedSnapshot } from "../src/ts/states/snapshot";

function result(
  wpm: number,
  overrides: Record<string, unknown> = {},
): NonNullable<DB.SaveLocalResultData["result"]> {
  return {
    mode: "time",
    mode2: "15",
    punctuation: false,
    numbers: false,
    language: "english",
    difficulty: "normal",
    lazyMode: false,
    wpm,
    acc: 95,
    rawWpm: wpm + 5,
    consistency: 80,
    testDuration: 15,
    incompleteTestSeconds: 0,
    afkDuration: 0,
    restartCount: 0,
    timestamp: 0,
    ...overrides,
  } as NonNullable<DB.SaveLocalResultData["result"]>;
}

const pb = (lazyMode = false): ReturnType<typeof DB.getLocalPB> =>
  DB.getLocalPB("time", "15", false, false, "english", "normal", lazyMode, []);

describe("local personal bests", () => {
  it("publishes favorite acknowledgements through the account query without losing progression", () => {
    DB.setSnapshot(
      { ...getDefaultSnapshot(), xp: 42 },
      { dispatchEvent: false },
    );
    DB.updateLocalQuoteFavorite("english", "7", true);
    expect(observedSnapshot()?.favoriteQuotes?.english).toEqual(["7"]);
    DB.updateLocalQuoteFavorite("english", "7", true);
    DB.updateLocalQuoteFavorite("english", "8", true);
    DB.updateLocalQuoteFavorite("english", "7", false);
    expect(observedSnapshot()?.favoriteQuotes?.english).toEqual(["8"]);
    expect(DB.getSnapshot()?.xp).toBe(42);
  });
  it("creates, updates and separates personal bests by settings", () => {
    const snapshot = getDefaultSnapshot();
    snapshot.personalBests = { words: {} } as typeof snapshot.personalBests;
    DB.setSnapshot(snapshot, { dispatchEvent: false });

    DB.saveLocalResult({ isPb: true, result: result(70) });
    expect(pb()).toMatchObject({ wpm: 70, raw: 75 });

    DB.saveLocalResult({ isPb: true, result: result(90) });
    DB.saveLocalResult({ isPb: true, result: result(60, { lazyMode: true }) });
    expect(pb()).toMatchObject({ wpm: 90 });
    expect(pb(true)).toMatchObject({ wpm: 60, lazyMode: true });
    expect(DB.getSnapshot()?.personalBests?.time["15"]).toHaveLength(2);

    DB.saveLocalResult({ isPb: false, result: result(120) });
    expect(pb()).toMatchObject({ wpm: 90 });
  });
});
