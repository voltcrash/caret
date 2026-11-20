import { peekConfig } from "#shared/config/store.ts";
import { Keycode } from "#shared/constants/keys.ts";
export function getTestEventCode(event: KeyboardEvent): Keycode | "NoCode" {
  if (event.code === "NumpadEnter" && peekConfig().funbox.includes("58008")) {
    return "Space";
  }

  if (event.code.includes("Arrow") && peekConfig().funbox.includes("arrows")) {
    return "NoCode";
  }

  if (
    event.code === "" ||
    event.code === undefined ||
    event.key === "Unidentified"
  ) {
    return "NoCode";
  }

  return event.code as Keycode;
}
