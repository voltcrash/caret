import { JSXElement } from "solid-js";

import { useTypingRoute } from "../../../../components/typing-route-host";
import { restartTestEvent } from "../../../events/test";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Link } from "../../common/Link";
import { openThemePicker, ThemeIndicator } from "./ThemeIndicator";

export function Logo(): JSXElement {
  const typing = useTypingRoute();
  return (
    <div
      class="flex h-6 w-max gap-2"
      style={{ "font-family": "Lexend Deca ,sans-serif" }}
      data-ui-element="logo"
    >
      {/* only the icon goes home; the wordmark opens the theme picker */}
      <Link
        href="/"
        class="-m-2 h-6 rounded-[0.8rem] p-2"
        aria-label="Oxytype Home"
        style={{ "box-sizing": "content-box" }}
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
          <path d="M24 5v13" class="[stroke-linecap:round]"></path>
        </svg>
      </Link>
      <div class="relative hidden h-6 place-content-center text-[2rem] leading-0 sm:grid">
        <h1
          class={cn("-mt-[0.11em] text-text transition-colors duration-250", {
            "text-text": getFocus(),
          })}
          data-ui-element="logoText"
        >
          <button
            type="button"
            class="-my-[0.5em] block cursor-pointer rounded-[0.4rem] border-none bg-transparent p-0 font-[inherit] leading-none text-inherit"
            aria-label="oxytype - change theme"
            onClick={openThemePicker}
          >
            oxytype
          </button>
        </h1>
        <ThemeIndicator
          class={cn(
            "absolute top-full right-0 mt-1 transition-[color,opacity]",
            getFocus() && "pointer-events-none opacity-0",
          )}
        />
      </div>
    </div>
  );
}
