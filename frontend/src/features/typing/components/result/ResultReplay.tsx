import type { ReplayLetter } from "@oxytype/typing-core/replay";

import { For, JSXElement } from "solid-js";

import { Fa } from "../../../../ts/components/common/Fa";
import { useRef } from "../../../../ts/hooks/useRef";
import { useSlideAnimation } from "../../../../ts/hooks/useSlideAnimation";
import { getIsScreenshotting } from "../../../../ts/states/core";
import { resultState } from "../../../../ts/states/result";
import { cn } from "../../../../ts/utils/cn";
import { jumpToLetter, togglePlayback } from "../../runtime/replay";

const playbackLabels = {
  start: "Start replay",
  playing: "Pause replay",
  paused: "Resume replay",
} as const;

function letterClass(letter: ReplayLetter): string {
  return cn(
    letter.correct && "correct text-text",
    letter.incorrect && "incorrect text-error",
    letter.extra && "extra",
    letter.incorrect && letter.extra && "text-error-extra",
    resultState.joiningScript && "inline",
  );
}

export function ResultReplay(): JSXElement {
  const [ref, element] = useRef<HTMLDivElement>();

  const replay = () => resultState.replay;

  useSlideAnimation({
    element,
    visible: () => replay().visible,
    duration: () => replay().slideDuration,
  });

  return (
    // left out of screenshots; own wrapper since slideDown/Up manage #resultReplay classes
    <div class={cn("contents", getIsScreenshotting() && "hidden")}>
      <div id="resultReplay" class="mb-4 hidden text-sub" ref={ref}>
        <div class="title mb-1 flex flex-wrap items-center gap-y-1 select-none">
          watch replay
          <button
            type="button"
            id="playpauseReplayButton"
            class="textButton ml-[0.5em] inline-block px-[0.25em] py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center"
            aria-label={playbackLabels[replay().playback]}
            data-balloon-pos="up"
            tabIndex={-1}
            onClick={() => togglePlayback()}
          >
            <Fa
              icon={replay().playback === "playing" ? "fa-pause" : "fa-play"}
            />
          </button>
          <p id="replayStats" class="m-0 ml-[0.5em] inline-block text-main">
            {replay().stats}
          </p>
        </div>
        <div id="replayWordsWrapper">
          <div
            id="replayWords"
            class={cn(
              "words flex w-full cursor-pointer flex-wrap content-start select-none max-md:[overflow-wrap:anywhere]",
              resultState.rightToLeft && "rightToLeftTest [direction:rtl]",
              resultState.joiningScript && "joiningScript",
            )}
          >
            <For each={replay().words}>
              {(word, wordIndex) => (
                <div
                  class={cn(
                    "word relative m-[0.18rem_0.6rem_0.15rem_0] min-w-0",
                    word.error && "error",
                    resultState.joiningScript &&
                      "pb-[2px] [overflow-wrap:anywhere]",
                  )}
                >
                  <For each={word.letters}>
                    {(letter, letterIndex) => (
                      <letter
                        class={letterClass(letter)}
                        onClick={() => jumpToLetter(wordIndex(), letterIndex())}
                      >
                        {letter.char}
                      </letter>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
