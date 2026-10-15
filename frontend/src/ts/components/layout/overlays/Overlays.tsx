import { JSXElement, Show } from "solid-js";
import { envConfig } from "virtual:env-config";

import { showModal } from "../../../states/modals";
import { isDevEnvironment } from "../../../utils/env";
import { Button } from "../../common/Button";
import { ScrollToTop } from "../footer/ScrollToTop";
import { Banners } from "./Banners";
import { FpsCounter } from "./FpsCounter";
import { LoaderBar } from "./LoaderBar";
import { MediaQueryDebugger } from "./MediaQueryDebugger";
import { Notifications } from "./Notifications";

export function Overlays(props: { scrollToTop: boolean }): JSXElement {
  return (
    <>
      <Show when={props.scrollToTop}>
        <ScrollToTop />
      </Show>
      <Banners />
      <Notifications />
      <MediaQueryDebugger />
      <LoaderBar />
      <FpsCounter />
      <Show when={isDevEnvironment()}>
        <DevButtons />
      </Show>
    </>
  );
}

function DevButtons(): JSXElement {
  return (
    <div
      role="region"
      aria-label="Development tools"
      class="fixed top-30 left-0 z-10000 flex w-max flex-col gap-2 text-xs"
    >
      <Button
        href={`${envConfig.backendUrl}/configure/`}
        balloon={{
          text: "Configure server",
          position: "right",
        }}
        fa={{
          icon: "fa-server",
        }}
        class="rounded-tl-none rounded-bl-none p-2"
      />
      <Button
        balloon={{
          text: "Dev options",
          position: "right",
        }}
        onClick={() => showModal("DevOptions")}
        fa={{
          icon: "fa-flask",
        }}
        class="rounded-tl-none rounded-bl-none p-2"
      />
    </div>
  );
}
