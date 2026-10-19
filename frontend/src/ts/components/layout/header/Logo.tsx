import { JSXElement } from "solid-js";

import { useTypingRoute } from "../../../../components/typing-route-host";
import { restartTestEvent } from "../../../events/test";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Link } from "../../common/Link";

export function Logo(): JSXElement {
  const typing = useTypingRoute();
  return (
    <Link
      href="/"
      class="-m-2 flex h-6 w-max gap-2 rounded-[0.8rem] p-2"
      aria-label="Oxytype Home"
      style={{
        "box-sizing": "content-box",
        "font-family": "Lexend Deca ,sans-serif",
      }}
      data-ui-element="logo"
      onClick={() => {
        if (typing()) restartTestEvent.dispatch();
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        aria-hidden="true"
        class={cn(
          "h-full fill-none stroke-current stroke-[6] text-main transition-colors",
          {
            "text-text": getFocus(),
          },
        )}
      >
        <circle cx="24" cy="24" r="16"></circle>
        <path
          d="M24 5v13"

          class="[stroke-linecap:round]"
        ></path>
      </svg>
      <div class="hidden h-6 place-content-center text-[2rem] leading-0 sm:grid">
        <h1
          class={cn("-mt-[0.11em] text-text transition-colors duration-250", {
            "text-text": getFocus(),
          })}
          data-ui-element="logoText"
        >
          oxytype
        </h1>
      </div>
    </Link>
  );
}
