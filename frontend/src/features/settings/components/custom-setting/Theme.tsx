import { For, JSXElement, onCleanup, Show } from "solid-js";

import { AnimeMatch } from "#shared/components/common/anime/AnimeMatch.tsx";
import { AnimeSwitch } from "#shared/components/common/anime/index.ts";
import { Button } from "#shared/components/common/Button.tsx";
import { Separator } from "#shared/components/common/Separator.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { ThemesList, ThemeWithName } from "#shared/constants/themes.ts";
import {
  clearPreview,
  convertCustomColorsToTheme,
  convertThemeToCustomColors,
} from "#shared/controllers/theme-controller.ts";
import { createEffectOn } from "#shared/hooks/effects.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import { getTheme, setTheme } from "#shared/states/theme.ts";
import { hexToHSL } from "#shared/utils/colors.ts";

import {
  addCustomTheme,
  useCustomThemesLiveQuery,
} from "../../../../data/collections/custom-themes";
import { SearchableSetting } from "../SearchableSetting";
import { ColorPicker } from "./theme/ColorPicker";
import { CustomThemeButton } from "./theme/CustomThemeButton";
import { openShareCustomThemeModal } from "./theme/theme-modals";
import { ThemeButton } from "./theme/ThemeButton";

// darkest background first
const sortedThemes: ThemeWithName[] = [...ThemesList].sort((a, b) => {
  const b1 = hexToHSL(a.bg);
  const b2 = hexToHSL(b.bg);
  return b1.lgt - b2.lgt;
});

export function Theme(): JSXElement {
  const customThemes = useCustomThemesLiveQuery();

  const resetTheme = async (): Promise<void> => {
    await clearPreview(false);
    // Resetting inactive custom colors also applies them. Reapply the preset
    // through the normal setter even when its name was already the default.
    setConfig("theme", getConfig.theme);
  };

  // hovering a preset previews it; leaving the presets (or the page) restores
  // the current theme. cleared on the whole list rather than per button so
  // moving between buttons doesn't flash the current theme in between
  onCleanup(() => void clearPreview());

  const Presets = () => (
    <div class="grid gap-4" onMouseLeave={() => void clearPreview()}>
      <Show when={getConfig.favThemes.length > 0}>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <For
            each={sortedThemes.filter((t) =>
              getConfig.favThemes.includes(t.name),
            )}
          >
            {(theme) => <ThemeButton theme={theme} />}
          </For>
        </div>
      </Show>
      <Show when={getConfig.favThemes.length > 0}>
        <Separator />
      </Show>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <For
          each={sortedThemes.filter(
            (t) => !getConfig.favThemes.includes(t.name),
          )}
        >
          {(theme) => <ThemeButton theme={theme} />}
        </For>
      </div>
    </div>
  );

  const Customs = () => (
    <div class="grid gap-4">
      <Show when={isAuthenticated()}>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <For each={customThemes()}>
            {(theme) => <CustomThemeButton theme={theme} />}
          </For>
        </div>
      </Show>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ColorPicker color="bg" />
        <ColorPicker color="main" />
        <ColorPicker color="sub" />
        <ColorPicker color="text" />
        <ColorPicker color="caret" />
        <ColorPicker color="subAlt" />
        <ColorPicker color="error" />
        <ColorPicker color="errorExtra" />
        <div class="col-span-1 text-sub md:col-span-2">
          when colorful mode is enabled:
        </div>
        <ColorPicker color="colorfulError" />
        <ColorPicker color="colorfulErrorExtra" />
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          text="load from preset"
          onClick={() => {
            const presetTheme = ThemesList.find(
              (t) => t.name === getConfig.theme,
            );
            if (presetTheme) {
              setTheme({ ...presetTheme, name: "custom" });
            } else {
              showErrorNotification(
                "Current preset theme not found. How is this possible?",
              );
            }
          }}
        />
        <Button text="share" onClick={openShareCustomThemeModal} />
        <Show when={isAuthenticated()}>
          <Button
            text="save as new"
            onClick={() => {
              if (customThemes().length >= 20) {
                showNoticeNotification("Custom themes limit reached");
                return;
              }

              void addCustomTheme({
                name: "custom",
                colors: convertThemeToCustomColors(getTheme()),
              })
                .then(() => {
                  showSuccessNotification("Custom theme saved");
                })
                .catch((e: unknown) => {
                  showErrorNotification(
                    e instanceof Error
                      ? e.message
                      : "Failed to save custom theme",
                  );
                });
            }}
          />
        </Show>
        <Show when={!isAuthenticated()}>
          <Button
            text="save"
            onClick={() => {
              setConfig(
                "customThemeColors",
                convertThemeToCustomColors(getTheme()),
              );
              showSuccessNotification("Custom theme colors saved");
            }}
          />
        </Show>
      </div>
    </div>
  );

  createEffectOn(
    () => getConfig.customTheme,
    (custom) => {
      if (custom) {
        const colorsObj = convertCustomColorsToTheme(
          getConfig.customThemeColors,
        );
        setTheme({ ...colorsObj, name: "custom" });
      }
    },
  );

  return (
    <SearchableSetting
      key="theme"
      resetKeys={["customThemeColors", "customTheme", "theme"]}
      onReset={resetTheme}
      title={configMetadata.theme.displayString ?? "theme"}
      fa={configMetadata.theme.fa}
      description={configMetadata.theme.description}
      inputs={
        <div class="grid w-full grid-cols-2 gap-2">
          <Button
            onClick={() => setConfig("customTheme", false)}
            active={!getConfig.customTheme}
            text="preset"
          />
          <Button
            onClick={() => setConfig("customTheme", true)}
            active={getConfig.customTheme}
            text="custom"
          />
        </div>
      }
      fullWidthInputs={
        // <AnimeConditional
        //   exitBeforeEnter
        //   if={!getConfig.customTheme}
        //   then={<Presets />}
        //   else={<Customs />}
        // />
        // <AnimePresence exitBeforeEnter>

        //   </AnimePresence>
        <AnimeSwitch
          exitBeforeEnter
          animeProps={{
            initial: {
              opacity: 0,
              duration: 125,
            },
            animate: {
              opacity: 1,
              duration: 125,
            },
            exit: {
              opacity: 0,
              duration: 125,
            },
          }}
        >
          <AnimeMatch when={!getConfig.customTheme}>
            <Presets />
          </AnimeMatch>
          <AnimeMatch when={getConfig.customTheme}>
            <Customs />
          </AnimeMatch>
        </AnimeSwitch>
      }
    />
  );
}
