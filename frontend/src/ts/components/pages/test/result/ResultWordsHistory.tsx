import {
  createMemo,
  createEffect,
  createSelector,
  createSignal,
  For,
  JSXElement,
  Show,
} from "solid-js";
import { z } from "zod/v3";

import type {
  WordLetter,
  WordsHistoryItem,
} from "../../../../test/word-markup";

import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import { useRef } from "../../../../hooks/useRef";
import { useResultWordHighlight } from "../../../../hooks/useResultWordHighlight";
import { useSlideAnimation } from "../../../../hooks/useSlideAnimation";
import Format from "../../../../singletons/format";
import { getBackground } from "../../../../states/background";
import { getIsScreenshotting } from "../../../../states/core";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../../../states/notifications";
import { resultState } from "../../../../states/result";
import { showSimpleModal } from "../../../../states/simple-modal";
import { getLastEventLog, getResultVisible } from "../../../../states/test";
import { getTheme } from "../../../../states/theme";
import {
  getInputHistory,
  getMissedWords,
  getWordBurstHistory,
} from "../../../../test/events/stats";
import {
  buildBurstHeatmap,
  getBurstHeatmapWordColor,
} from "../../../../test/result-view-model";
import * as TestWords from "../../../../test/test-words";
import { FaSolidIcon } from "../../../../types/font-awesome";
import { cn, updateClassNames } from "../../../../utils/cn";
import { get as getTypingSpeedUnit } from "../../../../utils/typing-speed-units";
import { Fa } from "../../../common/Fa";

declare module "solid-js" {
  // oxlint-disable-next-line typescript/no-namespace
  namespace JSX {
    // interfaces are required for declaration merging
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface IntrinsicElements {
      // word letters, targeted by themes and funbox css
      letter: HTMLAttributes<HTMLElement>;
    }
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface ExplicitAttributes {
      // word attributes, read by useResultWordHighlight
      input: string;
      burst: string;
    }
  }
}

async function copyToClipboard(
  content: string,
  customMessage?: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    showNoticeNotification(customMessage ?? "Copied to clipboard", {
      durationMs: 2000,
    });
  } catch (e) {
    showErrorNotification("Could not copy to clipboard", { error: e });
  }
}

async function copyWordsList(): Promise<void> {
  const eventLog = getLastEventLog();
  if (eventLog === null) return;
  let words;
  if (getConfig.mode === "zen") {
    words = getInputHistory(eventLog).join("");
  } else {
    words = TestWords.words
      .get()
      .slice(0, getInputHistory(eventLog).length)
      .map((w) => w.textWithCommit)
      .join("");
  }
  await copyToClipboard(words);
}

async function copyMissedWordsList(): Promise<void> {
  const eventLog = getLastEventLog();
  if (eventLog === null) return;
  let words;
  if (getConfig.mode === "zen") {
    words = getInputHistory(eventLog).join("");
  } else {
    words = Object.keys(getMissedWords(eventLog)).join(" ");
  }
  await copyToClipboard(words);
}

function copySlowWordsList(): void {
  const eventLog = getLastEventLog();
  if (eventLog === null) return;

  const burstHistory = getWordBurstHistory(eventLog);
  const validBursts = burstHistory.filter(
    (wpm) => Number.isFinite(wpm) && wpm > 0,
  );
  const avgWpm =
    validBursts.length > 0
      ? Math.round(validBursts.reduce((a, b) => a + b, 0) / validBursts.length)
      : 80;

  showSimpleModal({
    title: "Copy slow words",
    buttonText: "copy",
    buttonAlwaysEnabled: true,
    schema: z.object({
      speedThreshold: z.number().finite().positive(),
    }),
    inputs: {
      speedThreshold: {
        type: "number",
        label: "WPM threshold:",
        placeholder: "80",
        initVal: avgWpm,
      },
    },
    execFn: async ({ speedThreshold }) => {
      let typedWords: string[];
      if (getConfig.mode === "zen") {
        typedWords = getInputHistory(eventLog);
      } else {
        typedWords = TestWords.words
          .get()
          .slice(0, getInputHistory(eventLog).length)
          .map((w) => w.text);
      }

      const slowWords: string[] = [];
      typedWords.forEach((word, index) => {
        const speed = burstHistory[index] ?? Infinity;
        if (speed < speedThreshold) {
          slowWords.push(word);
        }
      });

      if (slowWords.length === 0) {
        return {
          status: "notice",
          message: `No words typed under ${speedThreshold} WPM`,
        };
      }

      await copyToClipboard(
        slowWords.join(" "),
        `Copied ${slowWords.length} slow word${slowWords.length > 1 ? "s" : ""} to clipboard`,
      );
      return {
        status: "success",
        showNotification: false,
      };
    },
  });
}

const titleButtons: {
  id: string;
  label: string;
  icon: FaSolidIcon;
  class?: string;
  onClick: (destroyWordHighlight: () => void) => void;
}[] = [
  {
    id: "copyWordsListButton",
    label: "Copy words list",
    icon: "fa-align-left",
    class: "ml-[0.5em] inline-block",
    onClick: () => void copyWordsList(),
  },
  {
    id: "copyMissedWordsListButton",
    label: "Copy missed words list",
    icon: "fa-times",
    onClick: () => void copyMissedWordsList(),
  },
  {
    id: "copySlowWordsListButton",
    label: "Copy slow words list",
    icon: "fa-tachometer-alt",
    onClick: copySlowWordsList,
  },
  {
    id: "toggleBurstHeatmap",
    label: "Toggle burst heatmap",
    icon: "fa-fire-alt",
    class: "inline-block",
    onClick: (destroyWordHighlight) => {
      setConfig("burstHeatmap", !getConfig.burstHeatmap);
      destroyWordHighlight();
    },
  },
];

function letterClass(letter: WordLetter): string {
  const has = (c: string): boolean => letter.classes.includes(c);
  return cn(
    letter.classes,
    has("correct") && "text-text",
    has("corrected") && "border-b-2 border-dotted border-main text-text",
    has("extraCorrected") && "border-r-2 border-dotted border-main",
    has("incorrect") && "text-error",
    has("incorrect") && has("extra") && "text-error-extra",
  );
}

function formatHoverSpeed(burst: number): string {
  return isNaN(burst) || burst >= 1000
    ? "Infinite"
    : Format.typingSpeed(burst, { showDecimalPlaces: false });
}

export function ResultWordsHistory(): JSXElement {
  const [ref, element] = useRef<HTMLDivElement>();
  createEffect(() => {
    const node = element();
    if (node) {
      node.className = updateClassNames(
        node.className,
        "noErrorBorder",
        getBackground().url !== "",
      );
    }
  });
  const [hoveredWord, setHoveredWord] = createSignal<number>();
  const isHovered = createSelector(hoveredWord);
  const wordHighlight = useResultWordHighlight(element);

  const history = () => resultState.wordsHistory;

  useSlideAnimation({
    element,
    visible: () => history().visible,
    duration: () => history().slideDuration,
  });

  const heatmap = createMemo(() => {
    if (!getConfig.burstHeatmap) return undefined;
    const eventLog = getLastEventLog();
    if (eventLog === null) return undefined;
    const typingSpeedUnit = getTypingSpeedUnit(getConfig.typingSpeedUnit);
    const fromWpm = (wpm: number): number => typingSpeedUnit.fromWpm(wpm);
    return {
      fromWpm,
      ...buildBurstHeatmap(getWordBurstHistory(eventLog), fromWpm, getTheme()),
    };
  });

  const wordHeat = (item: WordsHistoryItem) => {
    const map = heatmap();
    if (map === undefined) return undefined;
    return getBurstHeatmapWordColor(map, item.burst, map.fromWpm);
  };

  return (
    <div
      id="resultWordsHistory"
      class="relative mb-4 hidden text-sub"
      ref={ref}
    >
      <div class="title mb-1 flex flex-wrap items-center gap-y-1 select-none">
        <span>input history</span>
        <For each={titleButtons}>
          {(button) => (
            <button
              type="button"
              id={button.id}
              class={cn(
                "textButton px-[0.25em] py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center",
                button.class,
              )}
              aria-label={button.label}
              data-balloon-pos="up"
              tabIndex={-1}
              onClick={() => button.onClick(wordHighlight.destroy)}
            >
              <Fa icon={button.icon} fixedWidth />
            </button>
          )}
        </For>
        <div
          class={cn(
            "heatmapLegend ml-2 inline-grid w-min grid-cols-[auto_auto_auto] gap-4 text-[0.75rem] text-sub max-md:w-full max-md:gap-x-0",
            heatmap() === undefined && "hidden",
          )}
        >
          <div class="boxes grid grid-cols-[1fr_1fr_1fr_1fr_1fr]">
            <For each={[0, 1, 2, 3, 4]}>
              {(index) => (
                <div
                  class={cn(
                    `box box${index} grid h-4 place-content-center px-2 py-[0.1rem] leading-[0.75rem] whitespace-nowrap text-bg max-md:px-1 max-md:text-[0.625rem]`,
                    index === 0 && "rounded-l",
                    index === 4 && "rounded-r",
                  )}
                  style={{ background: heatmap()?.colors[index] }}
                >
                  <Show when={heatmap()}>
                    {(map) => <div>{map().legend[index]}</div>}
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
      <div
        class={cn(
          "words flex w-full flex-wrap content-start max-md:[overflow-wrap:anywhere]",
          resultState.rightToLeft && "rightToLeftTest [direction:rtl]",
          resultState.joiningScript && "joiningScript",
        )}
      >
        <For each={history().items}>
          {(item, index) => (
            <div
              class={cn(
                "word relative m-[0.18rem_0.6rem_0.15rem_0] min-w-0",
                item.typed && "nocursor",
                item.error && "error",
                wordHeat(item)?.inherit && "heatmapInherit",
                resultState.joiningScript &&
                  "pb-[2px] [overflow-wrap:anywhere]",
              )}
              style={{ color: wordHeat(item)?.color }}
              // oxlint-disable-next-line react/no-unknown-property
              attr:burst={
                item.burst === undefined ? undefined : String(item.burst)
              }
              // oxlint-disable-next-line react/no-unknown-property
              attr:input={item.input}
              onMouseEnter={() => {
                if (!getResultVisible()) return;
                if (item.input === "") return;
                setHoveredWord(index());
              }}
              onMouseLeave={() => setHoveredWord(undefined)}
            >
              <For each={item.letters}>
                {(letter) => (
                  <letter
                    class={cn(
                      letterClass(letter),
                      wordHeat(item)?.inherit && "text-inherit",
                      resultState.joiningScript && "inline",
                    )}
                  >
                    {letter.char}
                  </letter>
                )}
              </For>
              <Show when={isHovered(index()) && !getIsScreenshotting()}>
                <div class="wordInputHighlight withSpeed">
                  <div class="text">
                    {item.input.replace(/\t/g, "_").replace(/\n/g, "_")}
                  </div>
                  <div class="speed">
                    {formatHoverSpeed(parseInt(String(item.burst)))}{" "}
                    {getConfig.typingSpeedUnit}
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
      {wordHighlight.component()}
    </div>
  );
}
