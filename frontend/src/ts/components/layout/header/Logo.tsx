import { JSXElement } from "solid-js";

import { CaretMark } from "../../../../components/brand/caret-mark";
import { CaretWordmark } from "../../../../components/brand/caret-wordmark";
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
        aria-label="Caret Home"
        style={{ "box-sizing": "content-box" }}
        onClick={() => {
          if (typing()) restartTestEvent.dispatch();
        }}
      >
        <CaretMark
          class={cn(
            "h-full w-auto shrink-0 fill-current text-main transition-colors sm:hidden",
            {
              "text-text": getFocus(),
            },
          )}
        />
        <div class="hidden h-6 place-content-center text-[2rem] leading-0 sm:grid">
          <div
            class={cn("-mt-[0.11em] text-text transition-colors duration-250", {
              "text-text": getFocus(),
            })}
            data-ui-element="logoText"
          >
            <CaretWordmark
              markClass={cn("transition-colors", {
                "text-text": getFocus(),
              })}
            />
          </div>
        </div>
      </Link>
      <ThemeIndicator
        class={cn(
          "absolute top-full right-0 mt-0.5 hidden transition-[color,opacity] sm:inline-flex",
          getFocus() && "pointer-events-none opacity-0",
        )}
      />
    </div>
  );
}
