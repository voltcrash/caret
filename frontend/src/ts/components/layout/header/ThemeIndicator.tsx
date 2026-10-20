import { JSXElement } from "solid-js";

import { setConfig } from "../../../config/setters";
import { getMutableConfig } from "../../../config/store";
import {
  getThemeIndicator,
  isAuthenticated,
  setCommandlineSubgroup,
} from "../../../states/core";
import { getCustomThemes } from "../../../states/custom-themes";
import { showModal } from "../../../states/modals";
import { showNoticeNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";

/** Opens the theme picker; shift-click toggles the custom theme instead. */
export function openThemePicker(e: MouseEvent): void {
  if (e.shiftKey) {
    if (getMutableConfig().customTheme) {
      setConfig("customTheme", false);
      return;
    }
    if (isAuthenticated() && getCustomThemes().length < 1) {
      showNoticeNotification("No custom themes!");
      setConfig("customTheme", false);
      return;
    }
    setConfig("customTheme", true);
    return;
  }
  setCommandlineSubgroup(
    getMutableConfig().customTheme ? "customTheme" : "themes",
  );
  showModal("Commandline");
}

export function ThemeIndicator(props: { class?: string }): JSXElement {
  return (
    <Button
      variant="text"
      class={cn(
        "p-0 text-xs leading-none whitespace-nowrap hover:text-main",
        props.class,
      )}
      balloon={{ text: "Shift-click to toggle custom theme", position: "down" }}
      dataset={{ "data-ui-element": "themeIndicator" }}
      onClick={openThemePicker}
    >
      {getThemeIndicator().text}
    </Button>
  );
}
