import { JSXElement, Show } from "solid-js";

import { Fa } from "../../../ts/components/common/Fa";
import { isResultLoading } from "../../../ts/states/test";

export function TestLoading(): JSXElement {
  // delayed fade so fast result calculations never flash the spinner
  return (
    <Show when={isResultLoading()}>
      <div class="col-[content] animate-[fadeIn_0.125s_ease_0.5s_forwards] text-center opacity-0">
        <Fa icon="fa-circle-notch" spin class="text-[2rem] text-main" />
      </div>
    </Show>
  );
}
