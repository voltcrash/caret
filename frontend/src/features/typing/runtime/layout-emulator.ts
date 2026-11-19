import { createAppOwned } from "../../../app/application";
import { appObject } from "../../../app/state";
import { isCapsLockOn } from "@leonabcd123/modern-caps-lock";
import { getCharFromLayout } from "@caret/web-shared/layout-emulator";
import { showErrorNotification } from "../../../ts/states/notifications";
import { waitForInputLayout } from "../../../ts/states/test";

const altGr = appObject(createAppOwned(() => ({ pressed: false })));
export async function getCharFromEvent(
  event: KeyboardEvent,
): Promise<string | null> {
  try {
    const layout = await waitForInputLayout();
    return getCharFromLayout(layout, {
      code: event.code,
      shift: event.shiftKey,
      altGr: altGr.pressed,
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
  if (event.type === "keydown") altGr.pressed = true;
  if (event.type === "keyup") altGr.pressed = false;
}

export function getIsAltGrPressed(): boolean {
  return altGr.pressed;
}

export function resetAltGrState(): void {
  altGr.pressed = false;
}
