import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import commands from "../../src/ts/commandline/lists/background-filter";
import * as UpdateConfig from "../../src/ts/config/setters";
import { peekConfig } from "../../src/ts/config/store";

vi.mock("../../src/ts/config/setters", { spy: true });

describe("background-filter commandline", () => {
  const setConfigSpy = vi.spyOn(UpdateConfig, "setConfig");

  beforeEach(() => {
    UpdateConfig.setConfig("customBackgroundFilter", [0, 1, 1, 1], {
      nosave: true,
    });
    setConfigSpy.mockClear();
  });

  it("ignores non-finite input and clones the filter tuple before updating", () => {
    const subgroup = commands[0]?.subgroup;
    if (!subgroup) throw new Error("Missing subgroup");
    const blur = subgroup.list.find((c) => c.id === "setCustomBackgroundBlur");
    const opacity = subgroup.list.find(
      (c) => c.id === "setCustomBackgroundOpacity",
    );
    if (!blur?.exec || !opacity?.exec) throw new Error("Missing commands");

    const originalTuple = peekConfig().customBackgroundFilter;

    blur.exec({ input: "not-a-number" });
    blur.exec({ input: "Infinity" });
    expect(setConfigSpy).not.toHaveBeenCalled();
    expect(peekConfig().customBackgroundFilter).toEqual([0, 1, 1, 1]);

    opacity.exec({ input: "0.5" });
    expect(originalTuple).toEqual([0, 1, 1, 1]);
    expect(setConfigSpy).toHaveBeenCalledWith(
      "customBackgroundFilter",
      [0, 1, 1, 0.5],
    );
    expect(setConfigSpy.mock.calls[0]?.[1]).not.toBe(originalTuple);
    expect(peekConfig().customBackgroundFilter).toEqual([0, 1, 1, 0.5]);
  });
});
