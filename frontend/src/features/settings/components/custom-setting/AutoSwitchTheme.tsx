import { ThemeName } from "@caret/schemas/configs";
import { JSXElement, Show } from "solid-js";

import { Button } from "../../../../ts/components/common/Button";
import Select from "../../../../ts/components/ui/Select";
import { configMetadata } from "../../../../ts/config/metadata";
import { setConfig } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
import { ThemesList } from "../../../../ts/constants/themes";
import { cn } from "../../../../ts/utils/cn";
import { SearchableSetting } from "../SearchableSetting";

export function AutoSwitchTheme(): JSXElement {
  return (
    <SearchableSetting
      key="autoSwitchTheme"
      resetKeys={["themeLight", "themeDark", "autoSwitchTheme"]}
      title={
        configMetadata.autoSwitchTheme.displayString ?? "auto switch theme"
      }
      fa={configMetadata.autoSwitchTheme.fa}
      description={configMetadata.autoSwitchTheme.description}
      inputs={
        <div
          class={cn(
            "grid grid-cols-[repeat(auto-fit,minmax(min(100%,4.5rem),1fr))] gap-2",
          )}
        >
          <Button
            active={!getConfig.autoSwitchTheme}
            onClick={() => {
              if (!getConfig.autoSwitchTheme) return;
              setConfig("autoSwitchTheme", false);
            }}
            text="off"
          />
          <Button
            active={getConfig.autoSwitchTheme}
            onClick={() => {
              if (getConfig.autoSwitchTheme) return;
              setConfig("autoSwitchTheme", true);
            }}
            text="on"
          />
        </div>
      }
      fullWidthInputs={
        <Show when={getConfig.autoSwitchTheme}>
          <div class="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div class="grid grid-cols-[7rem_1fr] items-center gap-2">
              <div>light</div>
              <Select
                label="Light theme"
                options={ThemesList.map((theme) => ({
                  text: theme.name.replace(/_/g, " "),
                  value: theme.name,
                }))}
                selected={getConfig.themeLight}
                onChange={(value) =>
                  setConfig("themeLight", value as ThemeName)
                }
              />
            </div>
            <div class="grid grid-cols-[7rem_1fr] items-center gap-2">
              <div>dark</div>
              <Select
                label="Dark theme"
                options={ThemesList.map((theme) => ({
                  text: theme.name.replace(/_/g, " "),
                  value: theme.name,
                }))}
                selected={getConfig.themeDark}
                onChange={(value) => setConfig("themeDark", value as ThemeName)}
              />
            </div>
          </div>
        </Show>
      }
    />
  );
}
