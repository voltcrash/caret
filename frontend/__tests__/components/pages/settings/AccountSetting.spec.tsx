import { cleanup, fireEvent } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { AuthenticationTab } from "../../../../src/ts/components/pages/account-settings/AuthenticationTab";
import { Section } from "../../../../src/ts/components/pages/account-settings/utils";
import { SettingsSectionContext } from "../../../../src/ts/components/pages/settings/settings-section-context";
import { setUserId } from "../../../../src/ts/states/core";
import { highlightSetting } from "../../../../src/ts/states/settings-highlight";
import {
  getSearchMatchCounts,
  setSettingsSearch,
} from "../../../../src/ts/states/settings-search";
import { createSectionHost } from "../../../__harness__/settings-section-host";

const host = createSectionHost();

vi.mock(
  "../../../../src/ts/components/modals/account-settings/ReauthConfirmModals",
  () => ({
    showRevokeAllTokensModal: vi.fn(),
  }),
);
vi.mock(
  "../../../../src/ts/components/modals/account-settings/RemoveAuthMethodModal",
  () => ({
    showRemoveAuthMethodModal: vi.fn(),
  }),
);

beforeEach(() => setUserId("settings-user"));
afterEach(() => {
  cleanup();
  setUserId(null);
  host.setSection("behavior");
  setSettingsSearch("");
  vi.useRealTimers();
});

it("searches account descriptions and counts matches in the main sidebar", () => {
  const { container } = host.render(() => (
    <SettingsSectionContext.Provider value="account">
      <Section
        key="streakHourOffset"
        title="hour offset"
        fa={{ icon: "fa-clock" }}
        description={<>Choose when your streak resets.</>}
      />
      <Section
        key="accountName"
        title="account name"
        fa={{ icon: "fa-user" }}
        description="Change your display name."
      />
    </SettingsSectionContext.Provider>
  ));
  setSettingsSearch("streak");
  expect(
    container.querySelector('[data-setting-key="streakHourOffset"]'),
  ).not.toHaveClass("hidden");
  expect(
    container.querySelector('[data-setting-key="accountName"]'),
  ).toHaveClass("hidden");
  expect(getSearchMatchCounts()).toEqual({ account: 1 });
});

it("searches authentication controls under account and deep links back to account", () => {
  vi.useFakeTimers();
  const { container } = host.render(() => (
    <SettingsSectionContext.Provider value="account">
      <AuthenticationTab />
    </SettingsSectionContext.Provider>
  ));
  setSettingsSearch("authentication");
  expect(getSearchMatchCounts()).toEqual({ account: 2 });
  expect(
    container.querySelector('[data-setting-key="authenticationGoogle"]'),
  ).not.toHaveClass("hidden");
  expect(
    container.querySelector('[data-setting-key="authenticationGitHub"]'),
  ).not.toHaveClass("hidden");
  expect(
    container.querySelector('[data-setting-key="revokeAllTokens"]'),
  ).toHaveClass("hidden");
  setSettingsSearch("");
  highlightSetting("authenticationGoogle");
  expect(host.section()).toBe("account");
  host.setSection("behavior");
  highlightSetting("revokeAllTokens");
  expect(host.section()).toBe("account");
});

it("keeps account inputs inside their searchable row without remounting them", () => {
  const onClick = vi.fn();
  const { container, getByRole, getByLabelText } = host.render(() => (
    <Section
      key="accountName"
      title="account name"
      fa={{ icon: "fa-user" }}
      description="Change your account name."
      button={{ text: "update name", onClick }}
    >
      <input aria-label="account name draft" />
    </Section>
  ));
  const input = getByLabelText<HTMLInputElement>("account name draft");
  fireEvent.input(input, { target: { value: "draft" } });
  setSettingsSearch("no matching setting");
  expect(input.closest("[data-setting-key]")).toHaveClass("hidden");
  setSettingsSearch("");
  expect(getByLabelText("account name draft")).toBe(input);
  expect(input.value).toBe("draft");
  expect(
    container.querySelector("[data-setting-key] [data-setting-key]"),
  ).toBeNull();
  fireEvent.click(getByRole("button", { name: "update name" }));
  expect(onClick).toHaveBeenCalledOnce();
});

it("selects account sections through individual setting deep links", () => {
  vi.useFakeTimers();
  host.render(() => (
    <SettingsSectionContext.Provider value="account">
      <Section
        key="accountName"
        title="account name"
        fa={{ icon: "fa-user" }}
        description="Change your account name."
      />
    </SettingsSectionContext.Provider>
  ));
  highlightSetting("accountName");
  expect(host.section()).toBe("account");
});

it("preserves reactive restrictions on account actions", () => {
  const [disabled, setDisabled] = createSignal(false);
  const onClick = vi.fn();
  const { getByRole, queryByRole, getByText } = host.render(() => (
    <Section
      key="streakHourOffset"
      title="streak hour offset"
      fa={{ icon: "fa-clock" }}
      description="Change the reset hour."
      button={{ text: "update hour offset", onClick }}
      disabled={disabled()}
      disabledDescription="Already set."
    />
  ));
  fireEvent.click(getByRole("button", { name: "update hour offset" }));
  expect(onClick).toHaveBeenCalledOnce();
  setDisabled(true);
  expect(queryByRole("button", { name: "update hour offset" })).toBeNull();
  expect(getByText("Already set.")).toBeInTheDocument();
});
