import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// Characterizes the "time typing today/session" counter on the result screen.

const results = vi.hoisted(() => ({
  since: vi.fn(),
}));
vi.mock("../../../src/ts/collections/results", () => ({
  getResultsSinceDayOnce: results.since,
}));

import { mountApplication } from "../../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/test-application";
import * as TodayTracker from "../../../src/features/typing/runtime/today-tracker";
releaseTestApplication();
let dispose: () => void;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 15, 30));
  const root = createTestApplication();
  const release = mountApplication(root.application);
  dispose = () => {
    release();
    root.dispose();
  };
  results.since.mockReset();
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
});

describe("today tracker", () => {
  it("counts this session until today's results are loaded", () => {
    expect(TodayTracker.getString()).toBe("00:00:00 session");
    TodayTracker.addSeconds(29.6);
    TodayTracker.addSeconds(31);
    expect(TodayTracker.getString()).toBe("00:01:01 session");
  });

  it("loads today's active seconds since local midnight", async () => {
    results.since.mockResolvedValue([
      { testDuration: 60, incompleteTestSeconds: 15, afkDuration: 5 },
      { testDuration: 30, incompleteTestSeconds: 0, afkDuration: 0 },
    ]);
    TodayTracker.addSeconds(500);
    await TodayTracker.addAllFromToday();
    expect(results.since).toHaveBeenCalledWith(new Date(2026, 9, 14).getTime());
    expect(TodayTracker.getString()).toBe("00:01:40 today");
    TodayTracker.addSeconds(20);
    expect(TodayTracker.getString()).toBe("00:02:00 today");
  });

  it("starts over on a later day of the month", async () => {
    results.since.mockResolvedValue([
      { testDuration: 60, incompleteTestSeconds: 0, afkDuration: 0 },
    ]);
    await TodayTracker.addAllFromToday();
    vi.setSystemTime(new Date(2026, 9, 15, 0, 1));
    TodayTracker.addSeconds(10);
    expect(TodayTracker.getString()).toBe("00:00:10 today");
  });
});
