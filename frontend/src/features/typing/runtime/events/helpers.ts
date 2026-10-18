import { getMutableConfig } from "../../../../ts/config/store";
import { Keycode } from "../../../../ts/constants/keys";
export function getTestEventCode(event: KeyboardEvent): Keycode | "NoCode" {
  if (
    event.code === "NumpadEnter" &&
    getMutableConfig().funbox.includes("58008")
  ) {
    return "Space";
  }

  if (
    event.code.includes("Arrow") &&
    getMutableConfig().funbox.includes("arrows")
  ) {
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
