import { onCleanup, onMount } from "solid-js";
import { createAppSignal } from "../../app/state";
import {
  isCapsLockOn as checkCapsLockOn,
  onCapsLockChange,
} from "@leonabcd123/modern-caps-lock";
import { createAppSignalWithSetters } from "../hooks/createSignalWithSetters";

type ModifierState = {
  shift: boolean;
  alt: boolean;
  leftShift: boolean;
  rightShift: boolean;
};

export const [getModifierState, { updateModifierState }] =
  createAppSignalWithSetters<ModifierState>({
    shift: false,
    alt: false,
    leftShift: false,
    rightShift: false,
  })({
    updateModifierState: (set, val: Partial<ModifierState>) =>
      set((prev) => {
        const leftShift = val.leftShift ?? prev.leftShift;
        const rightShift = val.rightShift ?? prev.rightShift;
        return {
          ...prev,
          ...val,
          leftShift,
          rightShift,
          shift: val.shift ?? (leftShift || rightShift),
        };
      }),
  });

export function resetModifierState(): void {
  updateModifierState({
    shift: false,
    alt: false,
    leftShift: false,
    rightShift: false,
  });
}

const [isCapsLockOn, setCapsLockOn] = createAppSignal<boolean>(false);
export { isCapsLockOn };

// The caps-lock library has no unsubscribe API. Reuse one bridge across HMR.
type CapsLockBridge = { update?: (state: boolean) => void };
const hotData = import.meta.hot?.data as
  | { capsLockBridge?: CapsLockBridge }
  | undefined;
const retainedBridge = hotData?.capsLockBridge;
const capsLockBridge: CapsLockBridge = retainedBridge ?? {};
let bridgeInstalled = retainedBridge !== undefined;
export function useCapsLockEvents(): void {
  onMount(() => {
    setCapsLockOn(checkCapsLockOn());
    capsLockBridge.update = setCapsLockOn;
    if (!bridgeInstalled) {
      bridgeInstalled = true;
      onCapsLockChange((state) => capsLockBridge.update?.(state));
    }
    onCleanup(() => {
      capsLockBridge.update = undefined;
    });
  });
}
import.meta.hot?.dispose(() => {
  capsLockBridge.update = undefined;
  if (hotData !== undefined) hotData.capsLockBridge = capsLockBridge;
});

export function handleModifierState(
  e: KeyboardEvent,
  updateValue: boolean,
): void {
  if (e.code === "ShiftLeft") updateModifierState({ leftShift: updateValue });
  if (e.code === "ShiftRight") updateModifierState({ rightShift: updateValue });
  if (e.code === "AltRight" || e.code === "AltLeft") {
    updateModifierState({ alt: updateValue });
  }
}
