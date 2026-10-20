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
});
