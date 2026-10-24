import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { SearchableSetting } from "../../../../src/ts/components/pages/settings/SearchableSetting";
import * as Persistence from "../../../../src/ts/config/persistence";
import * as Setters from "../../../../src/ts/config/setters";
import { getConfig, setFullConfigStore } from "../../../../src/ts/config/store";
import { __testing } from "../../../../src/ts/config/testing";
import { getDefaultConfig } from "../../../../src/ts/constants/default-config";

const { saveToLocalStorage: save } = await vi.importActual<typeof Persistence>(
  "../../../../src/ts/config/persistence",
);

beforeEach(() => {
  __testing.replaceConfig({});
  setFullConfigStore(getDefaultConfig());
  localStorage.clear();
  // Keep real local persistence; avoid scheduling remote account sync.
  vi.spyOn(Persistence, "saveToLocalStorage").mockImplementation((key) =>
    save(key, false, true),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("appears after a change, resets and persists only that setting", async () => {
  const view = render(() => (
    <SearchableSetting
      key="freedomMode"
      title="freedom mode"
      description="test"
      fa={{ icon: "fa-cog" }}
    />
  ));
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();

  Setters.setConfig("difficulty", "expert");
  Setters.setConfig("freedomMode", true);
  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));

  await waitFor(() => {
    expect(getConfig.freedomMode).toBe(false);
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });
  expect(getConfig.difficulty).toBe("expert");
  expect(Persistence.configLS.get()).toMatchObject({
    freedomMode: false,
    difficulty: "expert",
  });
});

it("compares array contents and restores their defaults", async () => {
  const defaults = getDefaultConfig();
  const view = render(() => (
    <SearchableSetting
      key="customPolyglot"
      title="custom languages"
      description="test"
      fa={{ icon: "fa-cog" }}
    />
  ));
  // Store arrays are separate instances from the canonical defaults.
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();

  Setters.setConfig("customPolyglot", ["english", "french"]);
  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));

  await waitFor(() => {
    expect(getConfig.customPolyglot).toEqual(defaults.customPolyglot);
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });
  expect(Persistence.configLS.get().customPolyglot).toEqual(
    defaults.customPolyglot,
  );
});

it("does not offer reset for action rows", () => {
  const view = render(() => (
    <SearchableSetting
      key="importSettings"
      title="import settings"
      description="test"
      fa={{ icon: "fa-cog" }}
    />
  ));
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
});

it("keeps reset available when a config restriction blocks it", async () => {
  Setters.setConfig("freedomMode", true);
  vi.spyOn(Setters, "setConfig").mockReturnValue(false);
  const view = render(() => (
    <SearchableSetting
      key="freedomMode"
      title="freedom mode"
      description="test"
      fa={{ icon: "fa-cog" }}
    />
  ));
  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));

  await waitFor(() => {
    expect(getConfig.freedomMode).toBe(true);
    expect(
      view.getByRole("button", { name: "Reset to default" }),
    ).toBeEnabled();
  });
});

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../../../src/ts/config/persistence", { spy: true });
vi.mock("../../../../src/ts/config/setters", { spy: true });
