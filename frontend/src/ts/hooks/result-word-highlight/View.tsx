import { Accessor, For, JSXElement } from "solid-js";

import { getIsScreenshotting } from "../../states/core";
import { cn } from "../../utils/cn";
import { type Line, type HighlightPosition } from "./types";
type HighlightViewProps = {
  lines: Accessor<Line[]>;
  positions: Accessor<HighlightPosition[]>;
  hidden: Accessor<boolean>;
  animate: Accessor<boolean>;
  onHighlightContainer: (index: number, element: HTMLElement) => void;
  onInputWordsContainer: (index: number, element: HTMLElement) => void;
  onInputWord: (index: number, element: HTMLElement) => void;
};
function px(value: number | undefined): string | undefined {
  return value === undefined ? undefined : `${value}px`;
}

export function ResultWordHighlight(props: HighlightViewProps): JSXElement {
  return (
    <For each={props.lines()}>
      {(line, lineIndex) => {
        const position = (): HighlightPosition | undefined =>
          props.positions()[lineIndex()];
        return (
          <div
            ref={(el) => props.onHighlightContainer(lineIndex(), el)}
            class={cn(
              "highlightContainer pointer-events-none absolute overflow-hidden",
              getIsScreenshotting() && "hidden",
            )}
            style={line.container}
          >
            <div
              class={cn(
                "highlight absolute z-1 m-0 h-full overflow-hidden rounded bg-sub p-0",
                props.animate()
                  ? "withAnimation [transition:left_0.25s_ease,right_0.25s_ease,opacity_0.125s_linear]"
                  : "transition-opacity duration-125 ease-linear",
                props.hidden() ? "highlight-hidden opacity-0" : "opacity-100",
              )}
              style={{
                left: px(position()?.highlightLeft),
                right: px(position()?.highlightRight),
              }}
            >
              <div
                ref={(el) => props.onInputWordsContainer(lineIndex(), el)}
                class={cn(
                  "inputWordsContainer relative",
                  props.animate() &&
                    "withAnimation [transition:all_0.25s_ease]",
                )}
                style={{
                  top: px(line.inputWordsContainer.top),
                  left: px(
                    position()?.inputContainerLeft ??
                      line.inputWordsContainer.left,
                  ),
                  width: px(line.inputWordsContainer.width),
                  height: px(line.inputWordsContainer.height),
                }}
              >
                <For each={line.inputWords}>
                  {(inputWord) => (
                    <div
                      ref={(el) => props.onInputWord(inputWord.index, el)}
                      class="inputWord absolute text-[1em] leading-[1em] text-bg [font-variant:no-common-ligatures]"
                      style={{ left: px(inputWord.left) }}
                    >
                      {inputWord.text}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        );
      }}
    </For>
  );
}
