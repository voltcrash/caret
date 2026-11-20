import { Link, MetaProvider } from "@solidjs/meta";
import { For, JSXElement, Show } from "solid-js";

import { getCrt, getFunboxStylesheets } from "#shared/states/funbox.ts";

export function FunboxEffects(): JSXElement {
  return (
    <>
      <MetaProvider>
        <For each={getFunboxStylesheets()}>
          {(stylesheet) => (
            <Link
              class="funBoxTheme"
              rel="stylesheet"
              href={`funbox/${stylesheet.name}.css`}
            />
          )}
        </For>
      </MetaProvider>
      {/* Keep global CRT CSS after head styles, matching the original body link. */}
      <link
        id="globalFunBoxTheme"
        rel="stylesheet"
        href={getCrt() !== null ? "funbox/crt.css" : ""}
      />
      <Show when={getCrt()} keyed>
        <div id="scanline"></div>
      </Show>
    </>
  );
}
