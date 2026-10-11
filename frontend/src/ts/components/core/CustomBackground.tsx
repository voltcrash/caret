import { createSignal, JSXElement, Show } from "solid-js";

import {
  getBackground,
  getBackgroundSize,
  getBackgroundStyle,
} from "../../states/background";
import { cn } from "../../utils/cn";

function BackgroundImage(props: { url: string }): JSXElement {
  const [failed, setFailed] = createSignal(false);
  return (
    <img
      src={props.url}
      alt=""
      class={cn(failed() && "hidden")}
      style={{
        ...getBackgroundStyle(),
        "object-fit": getBackgroundSize() || undefined,
      }}
      onError={() => {
        setFailed(true);
        window.dispatchEvent(new Event("customBackgroundFailed"));
      }}
    />
  );
}

export function CustomBackground(): JSXElement {
  return (
    <div class="customBackground fixed top-0 left-0 -z-999 flex h-lvh w-screen items-center justify-center bg-center bg-no-repeat">
      <Show when={getBackground().url !== "" && getBackground()} keyed>
        {(background) => <BackgroundImage url={background.url} />}
      </Show>
    </div>
  );
}
