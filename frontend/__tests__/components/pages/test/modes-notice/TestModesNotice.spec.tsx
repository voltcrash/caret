import type { ResultMinified } from "@oxytype/schemas/results";

import { cleanup, render, waitFor } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import "../../../../__harness__/mock-static";
import { TestModesNotice } from "../../../../../src/features/typing/components/modes-notice/TestModesNotice";
import {
  setConfigStore,
  setFullConfigStore,
} from "../../../../../src/ts/config/store";
import { getDefaultConfig } from "../../../../../src/ts/constants/default-config";
import { setUserId } from "../../../../../src/ts/states/core";
import { mockOperation, ok } from "../../../../__harness__/operations";

// Imported transitively via the theme controller; jsdom has no IndexedDB.
vi.mock("idb", () => ({ openDB: async () => ({}) }));

describe("TestModesNotice", () => {
  beforeEach(() => {
    setUserId(null);
    setFullConfigStore(getDefaultConfig());
    mockOperation("users.get", () => ok({ name: "notice-user", tags: [] }));
    mockOperation("results.get", () => ok([]));
  });

  afterEach(() => {
    cleanup();
    setUserId(null);
    localStorage.removeItem("activeTags");
  });

  it("follows the show test modes notice setting", () => {
    const { queryByRole } = render(() => <TestModesNotice />);
    expect(queryByRole("button", { name: "english" })).not.toBeNull();

    setConfigStore("showTestModesNotice", false);
    expect(queryByRole("button", { name: "english" })).toBeNull();

    setConfigStore("showTestModesNotice", true);
    expect(queryByRole("button", { name: "english" })).not.toBeNull();
  });

  it("can enable notices while signed in", async () => {
    localStorage.setItem("activeTags", JSON.stringify(["notice_tag"]));
    mockOperation("users.get", () =>
      ok({
        name: "notice-user",
        tags: [{ _id: "notice_tag", name: "practice" }],
      }),
    );
    setUserId("notice-user");
    setConfigStore("showTestModesNotice", false);
    setConfigStore("showPb", true);
    const { queryByRole } = render(() => <TestModesNotice />);
    expect(queryByRole("button", { name: "english" })).toBeNull();

    setConfigStore("showTestModesNotice", true);
    await waitFor(() => {
      expect(queryByRole("button", { name: "english" })).not.toBeNull();
      expect(queryByRole("button", { name: "no pb" })).not.toBeNull();
      expect(queryByRole("button", { name: "practice" })).not.toBeNull();
    });
  });

  it("can show the signed-in average with no results", async () => {
    setUserId("notice-user");
    setConfigStore("showAverage", "both");
    const { queryByRole } = render(() => <TestModesNotice />);
    await waitFor(() => {
      expect(queryByRole("button", { name: "no average" })).not.toBeNull();
    });
  });

  it("updates averages when display options and test settings change", async () => {
    const results: ResultMinified[] = (
      [
        { wpm: 80, acc: 94, language: "english" },
        { wpm: 100, acc: 98, language: "english" },
        { wpm: 140, acc: 100, language: "german" },
      ] satisfies Pick<ResultMinified, "wpm" | "acc" | "language">[]
    ).map((result, index) => ({
      ...result,
      _id: `notice_result_${index}`,
      uid: "notice-user",
      rawWpm: result.wpm,
      consistency: 100,
      charStats: [150, 0, 0, 0],
      mode: "time",
      mode2: "30",
      testDuration: 30,
      timestamp: Date.now() - index,
      keyConsistency: 100,
    }));
    mockOperation("results.get", () => ok(results));
    setUserId("notice-user");
    setConfigStore("showAverage", "speed");
    const { findByRole, queryByRole } = render(() => <TestModesNotice />);

    expect(await findByRole("button", { name: "90 wpm" })).toBeVisible();
    setConfigStore("showAverage", "both");
    expect(
      await findByRole("button", { name: "90 wpm 96% acc" }),
    ).toBeVisible();
    setConfigStore("language", "german");
    expect(
      await findByRole("button", { name: "140 wpm 100% acc" }),
    ).toBeVisible();
    setConfigStore("showTestModesNotice", false);
    expect(queryByRole("button", { name: "140 wpm 100% acc" })).toBeNull();
    setConfigStore("showTestModesNotice", true);
    expect(
      await findByRole("button", { name: "140 wpm 100% acc" }),
    ).toBeVisible();
  });
});
