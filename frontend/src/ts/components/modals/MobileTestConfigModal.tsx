import type { QuoteLength, QuoteLengthConfig } from "@oxytype/schemas/configs";
import type { Mode } from "@oxytype/schemas/shared";

import { For, JSXElement, ParentProps, Show } from "solid-js";

import { setConfig, setQuoteLengthAll } from "../../config/setters";
import { getConfig } from "../../config/store";
import { restartTestEvent } from "../../events/test";
import { isAuthenticated } from "../../states/core";
import { hideModal, showModal } from "../../states/modals";
import { areUnsortedArraysEqual } from "../../utils/arrays";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";

const modes: Mode[] = ["time", "words", "quote", "zen", "custom"];
const times = [15, 30, 60, 120];
const wordCounts = [10, 25, 50, 100];

const quoteLengths: {
  value: string;
  label: string;
  loginRequired?: boolean;
}[] = [
  { value: "all", label: "all" },
  { value: "0", label: "short" },
  { value: "1", label: "medium" },
  { value: "2", label: "long" },
  { value: "3", label: "thicc" },
  { value: "-3", label: "favorite", loginRequired: true },
  { value: "-2", label: "search" },
] as const;

function MCButton(props: {
  text: string;
  class?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (e: MouseEvent) => void;
}): JSXElement {
  return (
    <Button
      variant="button"
      class={cn("min-h-11", props.class)}
      text={props.text}
      active={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
    />
  );
}

// flex-wrap with basis 30%: 3 per row, a short last row stretches to fill
const optionClass = "grow basis-[30%]";

function Section(props: ParentProps<{ label: string }>): JSXElement {
  return (
    <div class="grid gap-2">
      <div class="text-sm text-sub">{props.label}</div>
      {props.children}
    </div>
  );
}

const mode2Labels: Partial<Record<Mode, string>> = {
  time: "duration",
  words: "word count",
  quote: "quote length",
  custom: "custom text",
};

const isPunctuationDisabled = () =>
  getConfig.mode === "quote" || getConfig.mode === "zen";

export function MobileTestConfigModal(): JSXElement {
  const handleModeClick = (mode: Mode) => {
    if (mode === getConfig.mode) return;
    setConfig("mode", mode);
    restartTestEvent.dispatch();
  };

  const handleTimeClick = (time: number | "custom") => {
    if (time === "custom") {
      showModal("TestDuration");
    } else {
      setConfig("time", time);
      restartTestEvent.dispatch();
    }
  };

  const handleWordsClick = (words: number | "custom") => {
    if (words === "custom") {
      showModal("CustomWordAmount");
    } else {
      setConfig("words", words);
      restartTestEvent.dispatch();
    }
  };

  const handleQuoteLengthClick = (value: string, e: MouseEvent) => {
    if (value === "all") {
      if (setQuoteLengthAll()) {
        restartTestEvent.dispatch();
      }
    } else if (value === "-2") {
      showModal("QuoteSearch");
    } else {
      const len = parseInt(value, 10) as QuoteLength;
      let arr: QuoteLengthConfig;

      if (e.shiftKey) {
        arr = [...getConfig.quoteLength, len];
      } else {
        arr = [len];
      }

      if (setConfig("quoteLength", arr)) {
        restartTestEvent.dispatch();
      }
    }
  };

  const isQuoteLengthActive = (value: string) => {
    if (value === "all") {
      return areUnsortedArraysEqual(getConfig.quoteLength, [0, 1, 2, 3]);
    }
    if (value === "-2") {
      return areUnsortedArraysEqual(getConfig.quoteLength, [-2]);
    }
    if (value === "-3") {
      return areUnsortedArraysEqual(getConfig.quoteLength, [-3]);
    }
    return getConfig.quoteLength.includes(parseInt(value, 10) as QuoteLength);
  };

  return (
    <AnimatedModal
      id="MobileTestConfig"
      title="test settings"
      modalClass="grid gap-4"
    >
      <Section label="mode">
        <div class="flex flex-wrap gap-2">
          <For each={modes}>
            {(mode) => (
              <MCButton
                class={optionClass}
                text={mode}
                active={getConfig.mode === mode}
                onClick={() => handleModeClick(mode)}
              />
            )}
          </For>
        </div>
      </Section>

      <Show when={getConfig.mode !== "zen"}>
        <Section label={mode2Labels[getConfig.mode] ?? ""}>
          <div class="flex flex-wrap gap-2">
            <Show when={getConfig.mode === "time"}>
              <For each={times}>
                {(time) => (
                  <MCButton
                    class={optionClass}
                    text={String(time)}
                    active={getConfig.time === time}
                    onClick={() => handleTimeClick(time)}
                  />
                )}
              </For>
              <MCButton
                class={optionClass}
                text="custom"
                onClick={() => handleTimeClick("custom")}
              />
            </Show>

            <Show when={getConfig.mode === "words"}>
              <For each={wordCounts}>
                {(words) => (
                  <MCButton
                    class={optionClass}
                    text={String(words)}
                    active={getConfig.words === words}
                    onClick={() => handleWordsClick(words)}
                  />
                )}
              </For>
              <MCButton
                class={optionClass}
                text="custom"
                onClick={() => handleWordsClick("custom")}
              />
            </Show>

            <Show when={getConfig.mode === "quote"}>
              <For each={quoteLengths}>
                {(ql) => (
                  <Show when={!("loginRequired" in ql) || isAuthenticated()}>
                    <MCButton
                      class={optionClass}
                      text={ql.label}
                      active={isQuoteLengthActive(ql.value)}
                      onClick={(e) => handleQuoteLengthClick(ql.value, e)}
                    />
                  </Show>
                )}
              </For>
            </Show>

            <Show when={getConfig.mode === "custom"}>
              <MCButton
                class={optionClass}
                text="change"
                onClick={() => showModal("CustomText")}
              />
            </Show>
          </div>
        </Section>
      </Show>

      <Section label="extras">
        <div class="grid grid-cols-2 gap-2">
          <MCButton
            text="punctuation"
            active={getConfig.punctuation && !isPunctuationDisabled()}
            disabled={isPunctuationDisabled()}
            onClick={() => {
              setConfig("punctuation", !getConfig.punctuation);
              restartTestEvent.dispatch();
            }}
          />
          <MCButton
            text="numbers"
            active={getConfig.numbers && !isPunctuationDisabled()}
            disabled={isPunctuationDisabled()}
            onClick={() => {
              setConfig("numbers", !getConfig.numbers);
              restartTestEvent.dispatch();
            }}
          />
        </div>
      </Section>

      <div class="grid gap-2">
        <MCButton text="share" onClick={() => showModal("ShareTestSettings")} />
        <MCButton
          text="done"
          active
          onClick={() => hideModal("MobileTestConfig")}
        />
      </div>
    </AnimatedModal>
  );
}
