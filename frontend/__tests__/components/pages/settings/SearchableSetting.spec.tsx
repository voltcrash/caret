import { cleanup, fireEvent } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { SearchableAutoSetting } from "../../../../src/ts/components/pages/settings/SearchableAutoSetting";
import { SearchableSetting } from "../../../../src/ts/components/pages/settings/SearchableSetting";
import { SettingsSectionContext } from "../../../../src/ts/components/pages/settings/settings-section-context";
import {
  highlightSetting,
  setHighlightedSetting,
} from "../../../../src/ts/states/settings-highlight";
import { setSettingsSearch } from "../../../../src/ts/states/settings-search";
import { createSectionHost } from "../../../__harness__/settings-section-host";

const host = createSectionHost();

afterEach(() => {
  cleanup();
  setHighlightedSetting(null);
  host.setSection("behavior");
  setSettingsSearch("");
  vi.useRealTimers();
});

it("selects its section when deep linked", () => {
  vi.useFakeTimers();
  host.render(() => (
    <SettingsSectionContext.Provider value="theme">
      <SearchableSetting
        key="deepLinked"
        title="deep linked"
        description="test"
        fa={{ icon: "fa-cog" }}
      />
    </SettingsSectionContext.Provider>
  ));

  highlightSetting("deepLinked");

  expect(host.section()).toBe("theme");
});

it("highlights corrected names, aliases and plain description matches", () => {
  const { container } = host.render(() => (
    <SearchableSetting
      key="smoothCaret"
      title="smooth caret"
      description="Animates the typing cursor."
      fa={{ icon: "fa-cog" }}
    />
  ));
  setSettingsSearch("smoth cursor");
  expect(container.querySelector("h3")?.textContent).toBe("smooth caret");
  expect(
    [...container.querySelectorAll("h3 mark")].map((mark) => mark.textContent),
  ).toEqual(["smooth", "caret"]);
  setSettingsSearch("animates");
  expect(container.querySelector("mark")?.textContent).toBe("Animates");
  setSettingsSearch("");
  expect(container.querySelector("mark")).toBeNull();
});

it("filters without remounting edited inputs or rich descriptions", () => {
  const onClick = vi.fn();
  const { container, getByLabelText, getByText } = host.render(() => (
    <SearchableSetting
      key="fontSize"
      title="font size"
      description={<button onClick={onClick}>documentation</button>}
      fa={{ icon: "fa-font" }}
      inputs={<input aria-label="draft" />}
    />
  ));
  const input = getByLabelText<HTMLInputElement>("draft");
  const button = getByText("documentation");
  fireEvent.input(input, { target: { value: "draft value" } });
  setSettingsSearch("documentation");
  expect(
    container.querySelector("[data-setting-key]")?.className,
  ).not.toContain("hidden");
  setSettingsSearch("no match");
  expect(container.querySelector("[data-setting-key]")?.className).toContain(
    "hidden",
  );
  setSettingsSearch("");
  expect(getByLabelText("draft")).toBe(input);
  expect(input.value).toBe("draft value");
  expect(getByText("documentation")).toBe(button);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it("highlights matching option labels without changing their accessible names", () => {
  const { getByRole } = host.render(() => (
    <SearchableAutoSetting key="caretStyle" />
  ));
  setSettingsSearch("underlien");
  const button = getByRole("button", { name: "underline" });
  expect(button.querySelector("mark")?.textContent).toBe("underline");
  setSettingsSearch("");
  expect(button.querySelector("mark")).toBeNull();
});
