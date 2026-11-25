import { JSXElement, onCleanup, Show } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { FadeSwitch } from "#shared/components/common/FadeSwitch.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import {
  clearPreview,
  convertCustomColorsToTheme,
} from "#shared/controllers/theme-controller.ts";
import { createEffectOn } from "#shared/hooks/effects.ts";
import { setTheme } from "#shared/states/theme.ts";

import { useCustomThemesLiveQuery } from "../../../../data/collections/custom-themes";
import { SearchableSetting } from "../SearchableSetting";
import { CustomThemeEditor } from "./theme/CustomThemeEditor";
import { PresetThemes } from "./theme/PresetThemes";

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
        <FadeSwitch value={getConfig.customTheme}>
          {(custom) => (
            <Show when={custom()} fallback={<PresetThemes />}>
              <CustomThemeEditor customThemes={customThemes()} />
            </Show>
          )}
        </FadeSwitch>
      }
    />
  );
}
