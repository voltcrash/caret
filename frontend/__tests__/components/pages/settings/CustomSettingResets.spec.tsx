import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { JSXElement } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { getfpsLimit, setfpsLimit } from "../../../../src/ts/anim";
import { AnimationFpsLimit } from "../../../../src/ts/components/pages/settings/custom-setting/AnimationFpsLimit";
import { MinAcc } from "../../../../src/ts/components/pages/settings/custom-setting/MinAcc";
import { MinBurst } from "../../../../src/ts/components/pages/settings/custom-setting/MinBurst";
import { MinSpeed } from "../../../../src/ts/components/pages/settings/custom-setting/MinSpeed";
import { PaceCaret } from "../../../../src/ts/components/pages/settings/custom-setting/PaceCaret";
import { SearchableAutoSetting } from "../../../../src/ts/components/pages/settings/SearchableAutoSetting";
import * as Persistence from "../../../../src/ts/config/persistence";
import { getConfig, setFullConfigStore } from "../../../../src/ts/config/store";
import { __testing } from "../../../../src/ts/config/testing";
import { getDefaultConfig } from "../../../../src/ts/constants/default-config";

const { saveToLocalStorage: save } = await vi.importActual<typeof Persistence>(
  "../../../../src/ts/config/persistence",
);

beforeEach(() => {
  __testing.replaceConfig({});
  setFullConfigStore(getDefaultConfig());
  vi.spyOn(Persistence, "saveToLocalStorage").mockImplementation((key) =>
    save(key, false, true),
  );
  setfpsLimit(1000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  [MinSpeed, "minWpmCustomSpeed", "minWpm", 250],
  [MinAcc, "minAccCustom", "minAcc", 99],
  [MinBurst, "minBurstCustomSpeed", "minBurst", 250],
  [PaceCaret, "paceCaretCustomSpeed", "paceCaret", 250],
] as const)(
  "restores %s's custom value and mode even when the mode was already off",
  async (Component: () => JSXElement, valueKey, modeKey, value) => {
    const defaults = getDefaultConfig();
    const config = { ...defaults, [valueKey]: value };
    __testing.replaceConfig(config);
    setFullConfigStore(config);
    const view = render(() => <Component />);

    fireEvent.click(view.getByRole("button", { name: "Reset to default" }));

    await waitFor(() => {
      expect(getConfig[valueKey]).toBe(defaults[valueKey]);
      expect(getConfig[modeKey]).toBe(defaults[modeKey]);
      expect(view.getByRole("spinbutton")).toHaveValue(defaults[valueKey]);
      expect(
        view.queryByRole("button", { name: "Reset to default" }),
      ).toBeNull();
    });
    expect(Persistence.configLS.get()[modeKey]).toBe(defaults[modeKey]);
  },
);

it("resets a touched numeric field without restoring its old value on blur", async () => {
  const view = render(() => <SearchableAutoSetting key="fontSize" />);
  const input = view.getByRole("spinbutton");
  fireEvent.input(input, { target: { value: "3" } });
  fireEvent.blur(input);
  await waitFor(() => expect(getConfig.fontSize).toBe(3));

  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => expect(input).toHaveValue(getDefaultConfig().fontSize));
  fireEvent.blur(input);
  await waitFor(() =>
    expect(getConfig.fontSize).toBe(getDefaultConfig().fontSize),
  );
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
});

it("resets an edited custom speed without re-enabling its mode on blur", async () => {
  const view = render(() => <MinSpeed />);
  const input = view.getByRole("spinbutton");
  fireEvent.input(input, { target: { value: "250" } });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(getConfig.minWpmCustomSpeed).toBe(250);
    expect(getConfig.minWpm).toBe("custom");
  });
  fireEvent.click(view.getByRole("button", { name: "off" }));

  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => {
    expect(input).toHaveValue(100);
    expect(getConfig.minWpm).toBe("off");
  });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(getConfig.minWpmCustomSpeed).toBe(100);
    expect(getConfig.minWpm).toBe("off");
  });
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
});

it("resets the FPS limit to native and clears the edited field", async () => {
  const view = render(() => <AnimationFpsLimit />);
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  const input = view.getByRole("spinbutton");
  fireEvent.input(input, { target: { value: "60" } });
  fireEvent.blur(input);
  await waitFor(() => expect(getfpsLimit()).toBe(60));

  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => {
    expect(getfpsLimit()).toBe(1000);
    expect(input).toHaveValue(null);
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });
  fireEvent.blur(input);
  expect(getfpsLimit()).toBe(1000);
  expect(localStorage.getItem("fpsLimit")).toBe("1000");
});

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../../../src/ts/config/persistence", { spy: true });
