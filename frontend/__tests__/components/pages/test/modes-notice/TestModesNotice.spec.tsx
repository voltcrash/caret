import { cleanup, render } from "@solidjs/testing-library";
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

// Imported transitively via the theme controller; jsdom has no IndexedDB.
vi.mock("idb", () => ({ openDB: async () => ({}) }));

describe("TestModesNotice", () => {
  beforeEach(() => {
    setFullConfigStore(getDefaultConfig());
  });

  afterEach(() => {
    cleanup();
  });

  it("follows the show test modes notice setting", () => {
    const { queryByRole } = render(() => <TestModesNotice />);
    expect(queryByRole("button", { name: "english" })).not.toBeNull();

    setConfigStore("showTestModesNotice", false);
    expect(queryByRole("button", { name: "english" })).toBeNull();

    setConfigStore("showTestModesNotice", true);
    expect(queryByRole("button", { name: "english" })).not.toBeNull();
  });
});
