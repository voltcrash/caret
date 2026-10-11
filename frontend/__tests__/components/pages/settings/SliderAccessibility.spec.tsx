import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { Slider } from "../../../../src/ts/components/common/Slider";
import { CustomBackgroundFilters } from "../../../../src/ts/components/pages/settings/custom-setting/CustomBackgroundFilters";
import { KeymapSize } from "../../../../src/ts/components/pages/settings/custom-setting/KeymapSize";
import { SoundVolume } from "../../../../src/ts/components/pages/settings/custom-setting/SoundVolume";
import { setFullConfigStore } from "../../../../src/ts/config/store";
import { getDefaultConfig } from "../../../../src/ts/constants/default-config";

vi.mock("idb", () => ({ openDB: async () => ({}) }));
beforeEach(() => setFullConfigStore(getDefaultConfig()));
afterEach(cleanup);

it("names all six settings sliders", () => {
  const view = render(() => (
    <>
      <KeymapSize />
      <SoundVolume />
      <CustomBackgroundFilters />
    </>
  ));
  expect(view.getAllByRole("slider")).toHaveLength(6);
  for (const name of [
    "Keymap size",
    "Sound volume",
    "Background blur",
    "Background brightness",
    "Background saturation",
    "Background opacity",
  ]) {
    expect(view.getByRole("slider", { name })).toBeInTheDocument();
  }
});

it.each([
  ["blur", "Background blur"],
  ["brightness", "Background brightness"],
  ["saturate", "Background saturation"],
  ["opacity", "Background opacity"],
])("connects the visible %s label to its control", (text, name) => {
  const view = render(() => <CustomBackgroundFilters />);
  expect(view.getByLabelText(text)).toBe(view.getByRole("slider", { name }));
});

it("updates the accessible name with reactive props", () => {
  const [label, setLabel] = createSignal("Initial label");
  const props = {
    min: 0,
    max: 1,
    value: 0.5,
    get label() {
      return label();
    },
  };
  const view = render(() => <Slider {...props} />);
  expect(
    view.getByRole("slider", { name: "Initial label" }),
  ).toBeInTheDocument();
  setLabel("Updated label");
  expect(
    view.getByRole("slider", { name: "Updated label" }),
  ).toBeInTheDocument();
});
