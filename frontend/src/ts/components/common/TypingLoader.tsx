import { JSXElement } from "solid-js";

import { cn } from "../../utils/cn";

// theme.css keyframes assume one monospace column per letter of this word.
export const LOADER_WORD = "caret";

/**
 * Loading feedback styled as the typing test: untyped letters turn to text
 * colour behind the caret. Loops until `typed` (0 to word length) is given.
 */
export function TypingLoader(props: {
  typed?: number;
  class?: string;
}): JSXElement {
  const looping = (): boolean => props.typed === undefined;
  return (
    <div
      class={cn(
        "relative text-[2rem] leading-none whitespace-pre text-sub [font-family:'Roboto_Mono',monospace]",
        props.class,
      )}
      aria-hidden="true"
    >
      {LOADER_WORD}
      <span
        class={cn(
          "absolute inset-y-0 left-0 w-0 overflow-hidden text-text",
          looping() && "animate-typing-loader-typed",
        )}
        style={looping() ? undefined : { width: `${props.typed}ch` }}
      >
        {LOADER_WORD}
      </span>
      <span
        class={cn(
          "absolute -top-[0.1em] left-0 -ml-[0.05em] h-[1.2em] w-[0.1em] rounded-[0.05em] bg-caret",
          // Reduced motion keeps only a blink; preloader opts out of its reset.
          looping()
            ? "preloader animate-typing-loader-caret motion-reduce:animate-[caretFlashSmooth_1s_ease-in-out_infinite]"
            : "transition-transform duration-75",
        )}
        style={
          looping() ? undefined : { transform: `translateX(${props.typed}ch)` }
        }
      ></span>
    </div>
  );
}
