import { peekConfig } from "#shared/config/store.ts";
import { Keycode } from "#shared/constants/keys.ts";
import { getModifierState } from "../state/modifiers";
import * as KeyConverter from "#shared/utils/key-converter.ts";

export function isUsingOppositeShift(keycode: Keycode): boolean {
  const { leftShift, rightShift } = getModifierState();
  if (!leftShift && !rightShift) {
    return true;
  }

  if (peekConfig().oppositeShiftMode === "off") {
    return true;
  }

  const { leftSide, rightSide } = KeyConverter.keycodeToKeyboardSide(keycode);

  if (!leftSide && !rightSide) {
    return true;
  }

  if ((leftShift && rightSide) || (rightShift && leftSide)) {
    return true;
  }

  return false;
}
