import { createEffect, For, JSXElement } from "solid-js";

import { cn } from "../../../utils/cn";
import { visualizeWhitespace } from "./event-log";
import { scrollRowIntoView } from "./scroll-row";

export function WordsPanel(props: {
  targetWords: string[];
  /** what was left in each word at the end of the test */
  finalInputs: string[];
  /** word the playhead is in, -1 before the first input */
  currentWordIndex: number;
}): JSXElement {
  let wordsScrollEl: HTMLDivElement | undefined;

  createEffect(() => {
    scrollRowIntoView(wordsScrollEl, props.currentWordIndex);
  });

  return (
    <div class="bg-bg-secondary flex min-h-0 w-0 flex-1 flex-col gap-2 rounded-lg p-3">
      <div class="text-xs tracking-wider text-sub uppercase">Words</div>
      <div
        ref={(el) => (wordsScrollEl = el)}
        class="min-h-0 flex-1 overflow-auto rounded bg-bg"
      >
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-bg">
            <tr class="text-sub">
              <th class="w-10 p-2 text-right">#</th>
              <th class="p-2 text-left">target</th>
              <th class="p-2 text-left">input</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.targetWords}>
              {(word, i) => (
                <tr
                  data-row={i()}
                  class={cn(
                    "border-t border-bg",
                    i() === props.currentWordIndex && "bg-main/20",
                  )}
                >
                  <td class="p-2 text-right font-mono text-sub">{i()}</td>
                  <td class="p-2 font-mono">{visualizeWhitespace(word)}</td>
                  <td class="p-2 font-mono">
                    {visualizeWhitespace(props.finalInputs[i()] ?? "")}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}
