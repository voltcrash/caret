import { JSXElement } from "solid-js";

import { CaretMark } from "../../../../components/brand/caret-mark";
import { useTypingRoute } from "../../../../components/typing-route-host";
import { restartTestEvent } from "../../../events/test";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Link } from "../../common/Link";
import { ThemeIndicator } from "./ThemeIndicator";

export function Logo(): JSXElement {
  const typing = useTypingRoute();
  return (
    <div
      class="relative flex h-6 w-max"
      style={{ "font-family": "Lexend Deca ,sans-serif" }}
      data-ui-element="logo"
    >
      <Link
        href="/"
        class="-m-2 flex h-6 items-center gap-2 rounded-[0.8rem] p-2"
        aria-label="Oxytype Home"
        style={{ "box-sizing": "content-box" }}
        onClick={() => {
          if (typing()) restartTestEvent.dispatch();
        }}
      >
        <CaretMark
          class={cn(
            "h-full w-auto shrink-0 fill-current text-main transition-colors",
            {
              "text-text": getFocus(),
            },
          )}
        />
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
      <ThemeIndicator
        class={cn(
          "absolute top-full right-0 mt-1 hidden transition-[color,opacity] sm:inline-flex",
          getFocus() && "pointer-events-none opacity-0",
        )}
      />
    </div>
  );
}
