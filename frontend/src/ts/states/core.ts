import { requireApplication, createAppMemo } from "../../app/application";
import { createAppSignal } from "../../app/state";
import { CommandlineSubgroupKey } from "../commandline/types";
import { PageName } from "../pages/page";
import { showModal } from "./modals";
import { Formatting } from "../utils/format";
import { getConfig } from "../config/store";

export const [getActivePage, setActivePage] =
  createAppSignal<PageName>("loading");
export const [getVersion, setVersion] = createAppSignal<{
  text: string;
  isNew: boolean;
}>({
  text: "",
  isNew: false,
});

export const [getThemeIndicator, setThemeIndicator] = createAppSignal<{
  /**
   * human readable display name, this is not the ThemeName.
   * e.g. the display is `serika dark` for the ThemeName `serika_dark`
   */
  text: string;
  isFavorite: boolean;
}>({
  text: "serika dark",
  isFavorite: false,
});

export const [getCommandlineSubgroup, setCommandlineSubgroup] = createAppSignal<
  string | null
>(null);

export const [getGlobalOffsetTop, setGlobalOffsetTop] = createAppSignal(0);
export const [getIsScreenshotting, setIsScreenshotting] =
  createAppSignal(false);

export function getUserId(): string | null {
  return requireApplication().accountData.actor();
}
export function setUserId(actor: string | null): void {
  requireApplication().accountData.setActor(actor);
}
export const isAuthenticated = (): boolean => getUserId() !== null;

export const [getSelectedProfileName, setSelectedProfileName] = createAppSignal<
  string | undefined
>(undefined);

export function showCommandLineForConfig(
  selector: CommandlineSubgroupKey,
): void {
  setCommandlineSubgroup(selector);
  showModal("Commandline");
}

export const [getCustomTextIndicator, setCustomTextIndicator] = createAppSignal<
  { name: string; isLong: boolean } | undefined
>(undefined);

export const getFormatting = createAppMemo(() => {
  return new Formatting({
    alwaysShowDecimalPlaces: getConfig.alwaysShowDecimalPlaces,
    typingSpeedUnit: getConfig.typingSpeedUnit,
  });
});
