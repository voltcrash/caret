import { CustomTheme } from "@caret/schemas/users";
import { For, JSXElement, Show } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { ThemesList } from "#shared/constants/themes.ts";
import { convertThemeToCustomColors } from "#shared/controllers/theme-controller.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import { getTheme, setTheme } from "#shared/states/theme.ts";

import { addCustomTheme } from "../../../../../data/collections/custom-themes";
import { ColorPicker } from "./ColorPicker";
import { CustomThemeButton } from "./CustomThemeButton";
import { openShareCustomThemeModal } from "./theme-modals";

export function CustomThemeEditor(props: {
  customThemes: CustomTheme[];
}): JSXElement {
  return (
    <div class="grid gap-4">
      <Show when={isAuthenticated()}>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <For each={props.customThemes}>
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
              if (props.customThemes.length >= 20) {
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
}
