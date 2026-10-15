import { createAppSignal } from "../../app/state";
import type { CustomTheme } from "@oxytype/schemas/users";

const [getReader, setReader] = createAppSignal<
  (() => CustomTheme[]) | undefined
>();

/** Collections register after authentication; guest theme controls stay lightweight. */
export function bindCustomThemesReader(reader: () => CustomTheme[]): void {
  setReader(() => reader);
}

export function getCustomThemes(): CustomTheme[] {
  return getReader()?.() ?? [];
}

export function getCustomTheme(id: string): CustomTheme | undefined {
  return getCustomThemes().find((theme) => theme._id === id);
}
