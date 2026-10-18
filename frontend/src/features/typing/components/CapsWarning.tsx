import { Show } from "solid-js";

import { Fa } from "../../../ts/components/common/Fa";
import { getConfig } from "../../../ts/config/store";
import { isCapsLockOn } from "../../../ts/states/modifiers";

export function CapsWarning() {
  return (
    <Show when={getConfig.capsLockWarning && isCapsLockOn()}>
      <div class="pointer-events-none absolute -top-10 left-1/2 z-999 flex w-max max-w-full -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-(--roundness) bg-main p-4 px-8 text-center text-base text-bg">
        <Fa icon="fa-lock" />
        Caps Lock
      </div>
    </Show>
  );
}
