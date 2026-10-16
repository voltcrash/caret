import { isCapsLockOn } from "@leonabcd123/modern-caps-lock";
import { getCharFromLayout } from "@oxytype/typing-core/layout-emulator";
import { showErrorNotification } from "../../../ts/states/notifications";
import { waitForInputLayout } from "../../../ts/states/test";

let isAltGrPressed = false;
export async function getCharFromEvent(
  event: KeyboardEvent,
): Promise<string | null> {
  try {
    const layout = await waitForInputLayout();
    return getCharFromLayout(layout, {
      code: event.code,
      shift: event.shiftKey,
      altGr: isAltGrPressed,
      capsLock: isCapsLockOn(),
      key: event.key,
    });
  } catch (e) {
    showErrorNotification("Failed to emulate event", { error: e });
    return null;
  }
}

export function updateAltGrState(event: KeyboardEvent): void {
  const shouldHandleLeftAlt =
    event.code === "AltLeft" && navigator.userAgent.includes("Mac");
  if (event.code !== "AltRight" && !shouldHandleLeftAlt) return;
  if (event.type === "keydown") isAltGrPressed = true;
  if (event.type === "keyup") isAltGrPressed = false;
}

export function getIsAltGrPressed(): boolean {
  return isAltGrPressed;
}

export function resetAltGrState(): void {
  isAltGrPressed = false;
}
