import { getMutableConfig } from "../../../ts/config/store";
import { Keycode } from "../../../ts/constants/keys";
import { getModifierState } from "../../../ts/states/modifiers";
import * as KeyConverter from "../../../ts/utils/key-converter";

export function isUsingOppositeShift(keycode: Keycode): boolean {
  const { leftShift, rightShift } = getModifierState();
  if (!leftShift && !rightShift) {
    return true;
  }

  if (getMutableConfig().oppositeShiftMode === "off") {
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
