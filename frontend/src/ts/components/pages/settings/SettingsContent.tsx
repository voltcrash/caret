import { detectPlatform } from "@tanstack/solid-hotkeys";
import {
  untrack,
  createResource,
  JSXElement,
  Show,
  useContext,
} from "solid-js";

import { resetConfig } from "../../../config/lifecycle";
import { getConfig } from "../../../config/store";
import {
  playTimeWarning,
  previewClick,
  previewError,
} from "../../../controllers/sound-controller";
import { isAuthenticated } from "../../../states/core";
import { showModal } from "../../../states/modals";
import {
  getSearchMatchCounts,
  getSettingsSearch,
  isSettingsSearchActive,
  setSettingsSearch,
} from "../../../states/settings-search";
import {
  getAvailableSettingsSections,
  SettingsSection,
  SettingsSectionHostContext,
  settingsSections,
} from "../../../states/settings-sections";
import { showSimpleModal } from "../../../states/simple-modal";
import { cn } from "../../../utils/cn";
import fileStorage from "../../../utils/file-storage";
import { Button } from "../../common/Button";
import { H2 } from "../../common/Headers";
import { Kbd } from "../../common/Kbd";
import { SidebarLayout } from "../../common/SidebarLayout";
import { CommandPaletteHotkey } from "../../hotkeys/CommandPaletteHotkey";
import { AccountTab } from "../account-settings/AccountTab";
import { AuthenticationTab } from "../account-settings/AuthenticationTab";
import { DangerZoneTab } from "../account-settings/DangerZoneTab";
import { AnimationFpsLimit } from "./custom-setting/AnimationFpsLimit";
import { AutoSwitchTheme } from "./custom-setting/AutoSwitchTheme";
import { CommandPaletteShortcut } from "./custom-setting/CommandPaletteShortcut";
import { CustomBackground } from "./custom-setting/CustomBackground";
import { CustomBackgroundFilters } from "./custom-setting/CustomBackgroundFilters";
import { CustomLayoutfluid } from "./custom-setting/CustomLayoutfluid";
import { CustomPolyglot } from "./custom-setting/CustomPolyglot";
import { FontFamily } from "./custom-setting/FontFamily";
import { Funbox } from "./custom-setting/Funbox";
import { ImportExport } from "./custom-setting/ImportExport";
import { KeymapLayout } from "./custom-setting/KeymapLayout";
import { KeymapSize } from "./custom-setting/KeymapSize";
import { Language } from "./custom-setting/Language";
import { Layout } from "./custom-setting/Layout";
import { MaxLineWidth } from "./custom-setting/MaxLineWidth";
import { MinAcc } from "./custom-setting/MinAcc";
import { MinBurst } from "./custom-setting/MinBurst";
import { MinSpeed } from "./custom-setting/MinSpeed";
import { PaceCaret } from "./custom-setting/PaceCaret";
import { Presets } from "./custom-setting/Presets";
import { SoundVolume } from "./custom-setting/SoundVolume";
import { Tags } from "./custom-setting/Tags";
import { Theme } from "./custom-setting/Theme";
import { SearchableAutoSetting } from "./SearchableAutoSetting";
import { SearchableSetting } from "./SearchableSetting";
import { SettingsSectionContext } from "./settings-section-context";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsSearch } from "./SettingsSearch";

/** Settings sections; the selected section comes from SettingsSectionHostContext. */
export function SettingsContent(): JSXElement {
  const sections = useContext(SettingsSectionHostContext);
  const [hasLocalBg] = createResource(
    () => fileStorage.track("LocalBackgroundFile"),
    async () => fileStorage.hasFile("LocalBackgroundFile"),
  );

  return (
    <SidebarLayout
      items={getAvailableSettingsSections()}
      // while filtering, results from every section are shown
      active={isSettingsSearchActive() ? undefined : sections.current()}
      onSelect={(section) => {
        setSettingsSearch("");
        sections.select(section);
      }}
      header={<SettingsSearch />}
      hotkeys
      counts={isSettingsSearchActive() ? getSearchMatchCounts() : undefined}
      footer={
        getConfig.showKeyTips ? (
          <>
            {/* padded like the buttons: inset to line up with the item icons,
                    and space below to match the gap above the tip */}
            <div class="grid gap-2 px-2 pb-2 text-em-xs text-text">
              {/* keyboard shortcuts are hidden on touch, where they can't be used */}
              <div class="pointer-coarse:hidden">
                tip: you can also change all these settings quickly via the
                command palette (
                <span class="whitespace-nowrap">
                  <CommandPaletteHotkey />
                </span>
                )
              </div>
              <div class="pointer-coarse:hidden">
                tip: press{" "}
                <span class="whitespace-nowrap">
                  <Kbd
                    text={`${detectPlatform() === "mac" ? "cmd" : "ctrl"} + 1-9`}
                  />
                </span>{" "}
                to jump to a section
              </div>
              <div class="hidden pointer-coarse:block">
                tip: tap the terminal icon in the nav to search every setting
              </div>
            </div>
          </>
        ) : undefined
      }
    >
      <Show
        when={
          isSettingsSearchActive() &&
          Object.keys(getSearchMatchCounts()).length === 0
        }
      >
        <div class="text-center text-text">
          No settings match &quot;{getSettingsSearch().trim()}&quot;.
        </div>
      </Show>
      <div class="grid gap-16">
        <Section section="behavior">
          <Show when={isAuthenticated()}>
            <SettingsGroup title="saved tests">
              <Tags />
              <Presets />
              <SearchableAutoSetting key="resultSaving" />
            </SettingsGroup>
          </Show>
          <SettingsGroup title="test behavior">
            <SearchableAutoSetting key="difficulty" />
            <SearchableAutoSetting key="quickRestart" />
            <SearchableAutoSetting key="repeatQuotes" />
            <SearchableAutoSetting key="blindMode" />
            <SearchableAutoSetting key="alwaysShowWordsHistory" />
            <SearchableAutoSetting key="singleListCommandLine" />
            <CommandPaletteShortcut />
          </SettingsGroup>
          <SettingsGroup title="speed & accuracy">
            <MinSpeed />
            <MinAcc />
            <MinBurst />
          </SettingsGroup>
          <SettingsGroup title="language">
            <Language />
            <SearchableAutoSetting key="britishEnglish" />
          </SettingsGroup>
          <SettingsGroup title="funbox">
            <Funbox />
            <CustomLayoutfluid />
            <CustomPolyglot />
          </SettingsGroup>
        </Section>
        <Section section="input">
          <SettingsGroup title="editing">
            <SearchableAutoSetting key="freedomMode" />
            <SearchableAutoSetting key="strictSpace" />
            <SearchableAutoSetting key="confidenceMode" />
            <SearchableAutoSetting key="codeUnindentOnBackspace" />
          </SettingsGroup>
          <SettingsGroup title="errors & corrections">
            <SearchableAutoSetting key="stopOnError" />
            <SearchableAutoSetting key="deleteOnError" />
            <SearchableAutoSetting key="quickEnd" />
            <SearchableAutoSetting key="indicateTypos" />
            <SearchableAutoSetting key="hideExtraLetters" />
          </SettingsGroup>
          <SettingsGroup title="keyboard & composition">
            <Layout />
            <SearchableAutoSetting key="oppositeShiftMode" />
            <SearchableAutoSetting key="compositionDisplay" />
            <SearchableAutoSetting key="lazyMode" />
          </SettingsGroup>
        </Section>
        <Section section="sound">
          <SettingsGroup title="sound effects">
            <SoundVolume />
            <SearchableAutoSetting
              key="playSoundOnClick"
              wide
              onOptionClick={(option) => {
                if (option === "off") return;
                void previewClick(option);
              }}
            />
            <SearchableAutoSetting
              key="playSoundOnError"
              wide
              onOptionClick={(option) => {
                if (option === "off") return;
                void previewError(option);
              }}
            />
            <SearchableAutoSetting
              key="playTimeWarning"
              wide
              onOptionClick={(option) => {
                if (option === "off") return;
                void playTimeWarning();
              }}
            />
          </SettingsGroup>
        </Section>
        <Section section="caret">
          <SettingsGroup title="typing caret">
            <SearchableAutoSetting key="smoothCaret" />
            <SearchableAutoSetting key="caretStyle" wide />
          </SettingsGroup>
          <SettingsGroup title="pace caret">
            <PaceCaret />
            <SearchableAutoSetting key="repeatedPace" />
            <SearchableAutoSetting key="paceCaretStyle" wide />
          </SettingsGroup>
        </Section>
        <Section section="appearance">
          <SettingsGroup title="timer">
            <SearchableAutoSetting key="timerStyle" wide />
            <SearchableAutoSetting key="timerColor" />
            <SearchableAutoSetting key="timerOpacity" />
          </SettingsGroup>
          <SettingsGroup title="speed">
            <SearchableAutoSetting key="liveSpeedStyle" />
            <SearchableAutoSetting key="liveAccStyle" />
            <SearchableAutoSetting key="liveBurstStyle" />
            <SearchableAutoSetting key="typingSpeedUnit" />
          </SettingsGroup>
          <SettingsGroup title="stats">
            <SearchableAutoSetting key="alwaysShowDecimalPlaces" />
            <SearchableAutoSetting key="startGraphsAtZero" />
          </SettingsGroup>
          <SettingsGroup title="text">
            <SearchableAutoSetting key="fontSize" />
            <FontFamily />
            <SearchableAutoSetting key="highlightMode" wide />
            <SearchableAutoSetting key="typedEffect" />
          </SettingsGroup>
          <SettingsGroup title="layout">
            <SearchableAutoSetting key="tapeMode" />
            <SearchableAutoSetting key="tapeMargin" />
            <SearchableAutoSetting key="smoothLineScroll" />
            <SearchableAutoSetting key="showAllLines" />
            <MaxLineWidth />
          </SettingsGroup>
          <SettingsGroup title="keymap">
            <SearchableAutoSetting key="keymapMode" />
            <Show when={getConfig.keymapMode !== "off"}>
              <KeymapLayout />
              <SearchableAutoSetting key="keymapStyle" wide />
              <SearchableAutoSetting key="keymapLegendStyle" wide />
              <SearchableAutoSetting key="keymapKeys" wide />
              <KeymapSize />
            </Show>
          </SettingsGroup>
        </Section>
        <Section section="theme">
          <SettingsGroup title="colors">
            <SearchableAutoSetting key="flipTestColors" />
            <SearchableAutoSetting key="colorfulMode" />
          </SettingsGroup>
          <SettingsGroup title="background">
            <CustomBackground />
            <Show when={getConfig.customBackground !== "" || hasLocalBg()}>
              <CustomBackgroundFilters />
            </Show>
          </SettingsGroup>
          <SettingsGroup title="automatic themes">
            <AutoSwitchTheme />
            <SearchableAutoSetting key="randomTheme" wide />
          </SettingsGroup>
          <SettingsGroup title="preset & custom themes">
            <Theme />
          </SettingsGroup>
        </Section>
        <Section section="hideElements">
          <SettingsGroup title="interface visibility">
            <SearchableAutoSetting key="showKeyTips" />
            <SearchableAutoSetting key="showOutOfFocusWarning" />
            <SearchableAutoSetting key="showTestModesNotice" />
            <SearchableAutoSetting key="capsLockWarning" />
            <SearchableAutoSetting key="showAverage" />
          </SettingsGroup>
        </Section>
        <Show when={isAuthenticated()}>
          <Section section="account">
            <SettingsGroup title="account preferences">
              <AccountTab />
            </SettingsGroup>
            <SettingsGroup title="sign-in methods">
              <AuthenticationTab />
            </SettingsGroup>
          </Section>
        </Show>
        <Section section="dangerZone">
          <Show when={isAuthenticated()}>
            <SettingsGroup title="account data">
              <DangerZoneTab />
            </SettingsGroup>
          </Show>
          <SettingsGroup title="privacy">
            <SearchableSetting
              key="cookies"
              title="update cookie preferences"
              description="If you changed your mind about which cookies you consent to, you can change your preferences here."
              fa={{
                icon: "fa-cookie-bite",
              }}
              inputs={
                <Button
                  class="w-full"
                  onClick={() => {
                    showModal("Cookies");
                  }}
                >
                  open
                </Button>
              }
            />
          </SettingsGroup>
          <SettingsGroup title="performance">
            <AnimationFpsLimit />
          </SettingsGroup>
          <SettingsGroup title="settings data">
            <ImportExport />
            <SearchableSetting
              key="resetSettings"
              title="reset settings"
              description={
                <div>
                  Resets settings to the default (but doesn&apos;t touch your
                  tags and presets).
                  <br />
                  <div class="text-error">You can&apos;t undo this!</div>
                </div>
              }
              fa={{
                icon: "fa-undo",
              }}
              inputs={
                <Button
                  class="w-full"
                  danger
                  onClick={() => {
                    showSimpleModal({
                      title: "Are you sure?",
                      buttonText: "reset",
                      execFn: async () => {
                        await resetConfig();
                        await fileStorage.deleteFile("LocalBackgroundFile");
                        return {
                          status: "success",
                          message: "Settings reset",
                        };
                      },
                    });
                  }}
                >
                  reset settings
                </Button>
              }
            />
          </SettingsGroup>
        </Section>
      </div>
    </SidebarLayout>
  );
}

function Section(props: {
  section: SettingsSection;
  children: JSXElement;
}): JSXElement {
  const section = untrack(() => props.section);
  const sections = useContext(SettingsSectionHostContext);
  return (
    <div
      id={`group_${props.section}`}
      class={cn(
        "grid gap-8",
        // only the selected section is shown, unless filtering, where every
        // section with a matching setting is shown
        !isSettingsSearchActive() &&
          sections.current() !== props.section &&
          "hidden",
        isSettingsSearchActive() &&
          "not-has-[[data-setting-key]:not(.hidden)]:hidden",
      )}
    >
      <H2
        text={settingsSections[props.section].text}
        fa={{ icon: settingsSections[props.section].icon }}
        class="pb-0 text-[1.5em]"
      />
      <SettingsSectionContext.Provider value={section}>
        {props.children}
      </SettingsSectionContext.Provider>
    </div>
  );
}
