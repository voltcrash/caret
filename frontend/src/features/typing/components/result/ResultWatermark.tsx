import { JSXElement, Show } from "solid-js";

import { UserFlags } from "#shared/components/common/UserFlags.tsx";
import { getIsScreenshotting } from "#shared/states/core.ts";

import { getScreenshotWatermark } from "../../state/result";

export function ResultWatermark(): JSXElement {
  return (
    <Show when={getIsScreenshotting() && getScreenshotWatermark()}>
      {(watermark) => (
        <div class="ssWatermark col-[1/-1] flex flex-wrap justify-end gap-x-[1em] text-[1.25rem] text-sub">
          <Show when={watermark().user}>
            {(user) => (
              <>
                <span>
                  {user().name}
                  <UserFlags {...user().flags} iconsOnly class="ml-[0.33em]" />
                </span>
                <span class="pipe">|</span>
              </>
            )}
          </Show>
          <span>{watermark().date}</span>
          <span class="pipe">|</span>
          <span>caret</span>
        </div>
      )}
    </Show>
  );
}
