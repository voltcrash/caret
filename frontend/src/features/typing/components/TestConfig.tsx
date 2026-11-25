import { ComponentProps, For, JSXElement, onCleanup, Show } from "solid-js";

import type { FaObject } from "#shared/types/font-awesome.d.ts";

import { Button } from "#shared/components/common/Button.tsx";
import { FadeShow } from "#shared/components/common/FadeShow.tsx";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig, setQuoteLengthAll } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";
import { createEffectOn } from "#shared/hooks/effects.ts";
import { useRef } from "#shared/hooks/useRef.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import { showModal } from "#shared/states/modals.ts";
import { getResultVisible, getFocus } from "#shared/states/test.ts";
import { restartTest } from "#shared/typing-host.ts";
import { areUnsortedArraysEqual } from "#shared/utils/arrays.ts";
import { cn, updateClassNames } from "#shared/utils/cn.ts";
import { applyReducedMotion } from "#shared/utils/misc.ts";

import { variables, buttonClass, cardClass } from "../config-layout";

const durationMs = 250;

function setHidden(element: HTMLElement | undefined, hidden: boolean): void {
  if (element) {
    element.className = updateClassNames(element.className, "hidden", hidden);
  }
}

function outerWidth(element: HTMLElement | undefined): number {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().width +
    parseFloat(style.marginLeft) +
    parseFloat(style.marginRight)
  );
}

export function TestConfig(): JSXElement {
  return (
    <>
      <div
        class={cn(
          variables,
          "group relative mb-8 hidden w-max grid-cols-[1fr_auto_1fr] justify-center place-self-center [font-size:var(--font-size)] md:grid",
          // tablets: these targets are too small for fingers, use the button below
          "pointer-coarse:hidden!",
          "mx-auto transition-opacity duration-125",
          getFocus() || getResultVisible()
            ? "pointer-events-none opacity-0"
            : "",
        )}
        data-ui-element="testConfig"
      >
        <PuncAndNum />
        <Mode />
        <Mode2 />
      </div>
      <Button
        class={cn(
          "mx-auto flex min-h-11 max-w-full place-self-center px-4 py-2 text-sub md:hidden pointer-coarse:flex!",
          getFocus() || getResultVisible()
            ? "pointer-events-none opacity-0"
            : "",
        )}
        variant="button"
        onClick={() => {
          showModal("MobileTestConfig");
        }}
        fa={{
          icon: "fa-cog",
          class: "shrink-0",
        }}
      >
        <span class="sr-only">test settings: </span>
        <span class="min-w-0 truncate">{getMobileSummary()}</span>
      </Button>
    </>
  );
}

const quoteLengthLabels: Partial<Record<number, string>> = {
  [-3]: "favorite",
  [-2]: "search",
  0: "short",
  1: "medium",
  2: "long",
  3: "thicc",
};

function getQuoteLengthSummary(): string {
  const lengths = getConfig.quoteLength;
  if (areUnsortedArraysEqual(lengths, [0, 1, 2, 3])) return "all";
  return lengths
    .map((length) => quoteLengthLabels[length])
    .filter((label) => label !== undefined)
    .join(", ");
}

function getMode2Summary(): string {
  switch (getConfig.mode) {
    case "time":
      return `time ${getConfig.time}`;
    case "words":
      return `words ${getConfig.words}`;
    case "quote":
      return `quote ${getQuoteLengthSummary()}`;
    default:
      return getConfig.mode;
  }
}

function getMobileSummary(): string {
  const parts = [getMode2Summary()];
  const extrasDisabled = getConfig.mode === "quote" || getConfig.mode === "zen";
  if (!extrasDisabled) {
    if (getConfig.punctuation) parts.push("punctuation");
    if (getConfig.numbers) parts.push("numbers");
  }
  return parts.join(" · ");
}

function TCButton(props: {
  class?: string;
  fa?: FaObject;
  text?: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): JSXElement {
  return (
    <Button
      variant="text"
      class={cn(buttonClass, props.class)}
      fa={props.fa ? { ...props.fa, fixedWidth: true } : undefined}
      text={props.text}
      aria-label={props.label}
      active={props.active}
      onClick={props.onClick}
      disabled={getFocus() || getResultVisible() || props.disabled}
    />
  );
}

function PuncAndNum(): JSXElement {
  const buttons = ["punctuation", "numbers"] as const;

  return (
    <div
      class={cn(
        "mr-(--card-gap) w-max place-self-end transition-opacity duration-250 motion-reduce:duration-0",
        getConfig.mode === "zen" ? "opacity-0" : "opacity-100",
      )}
    >
      <FadeShow when={getConfig.mode !== "zen"} duration={durationMs}>
        <div class={cardClass}>
          <For each={buttons}>
            {(configKey) => (
              <TCButton
                fa={configMetadata[configKey].fa}
                text={configMetadata[configKey].displayString ?? configKey}
                active={getConfig[configKey]}
                disabled={
                  getConfig.mode === "zen" || getConfig.mode === "quote"
                }
                onClick={() => {
                  setConfig(configKey, !getConfig[configKey]);
                  restartTest();
                }}
              />
            )}
          </For>
        </div>
      </FadeShow>
    </div>
  );
}

function Mode(): JSXElement {
  const modeOptions = ["time", "words", "quote", "zen", "custom"] as const;

  return (
    <div class={cn("z-2", cardClass)}>
      <For each={modeOptions}>
        {(modeOption) => (
          <TCButton
            fa={
              configMetadata.mode.optionsMetadata?.[modeOption]?.fa ??
              configMetadata.mode.fa
            }
            text={
              configMetadata.mode.optionsMetadata?.[modeOption]
                ?.displayString ?? modeOption
            }
            active={getConfig.mode === modeOption}
            onClick={() => {
              setConfig("mode", modeOption);
              restartTest();
            }}
          />
        )}
      </For>
    </div>
  );
}

function Mode2(): JSXElement {
  const [wrapperRef, wrapperElement] = useRef();
  const [timeRef, timeElement] = useRef();
  const [wordsRef, wordsElement] = useRef();
  const [quoteRef, quoteElement] = useRef();
  const [customRef, customElement] = useRef();

  const sClass =
    "z-2 col-start-1 row-start-1 grid w-max place-self-start grid-flow-col ml-(--card-gap)";

  type Mode2Key = "time" | "words" | "quote" | "custom";
  const getElements = ():
    | Partial<Record<Mode2Key, HTMLElement>>
    | undefined => {
    const time = timeElement();
    const words = wordsElement();
    const quote = quoteElement();
    const custom = customElement();
    if (!time || !words || !quote || !custom) return undefined;
    return { time, words, quote, custom };
  };

  let activeAnimations: Animation[] = [];
  const cancelActive = (): void => {
    for (const anim of activeAnimations) anim.cancel();
    activeAnimations = [];
  };
  onCleanup(cancelActive);

  createEffectOn(
    () => getConfig.mode,
    (mode, previousMode) => {
      const wrapperEl = wrapperElement();
      const el = getElements();
      if (!wrapperEl || !el) return;

      cancelActive();

      const prev = el[previousMode as Mode2Key];
      const next = el[mode as Mode2Key];

      if (previousMode === undefined) {
        for (const e of Object.values(el)) {
          setHidden(e, true);
        }
        setHidden(next, false);
        return;
      }

      for (const e of Object.values(el)) {
        if (e !== prev && e !== next) {
          setHidden(e, true);
        }
      }

      setHidden(prev, false);
      const previousWidth = outerWidth(prev);

      setHidden(next, false);
      const newWidth = outerWidth(next);

      const duration = applyReducedMotion(durationMs);

      if (duration <= 0) {
        wrapperEl.style.width = "";
        if (prev) {
          prev.style.opacity = "";
          setHidden(prev, true);
        }
        if (next) {
          next.style.opacity = "";
        }
        return;
      }

      if (previousWidth !== newWidth) {
        const widthAnim = wrapperEl.animate(
          { width: [`${previousWidth}px`, `${newWidth}px`] },
          { duration, easing: "ease-out" },
        );
        activeAnimations.push(widthAnim);
        void widthAnim.finished.then(
          () => {
            wrapperEl.style.width = "";
          },
          () => {
            wrapperEl.style.width = "";
          },
        );
      }

      if (prev) {
        prev.style.opacity = "0";
        const prevAnim = prev.animate(
          { opacity: ["1", "0"] },
          { duration, easing: "ease-out" },
        );
        activeAnimations.push(prevAnim);
        void prevAnim.finished.then(
          () => {
            setHidden(prev, true);
            prev.style.opacity = "";
          },
          () => undefined,
        );
      }

      if (next) {
        next.style.opacity = "1";
        const nextAnim = next.animate(
          { opacity: ["0", "1"] },
          { duration, easing: "ease-out" },
        );
        activeAnimations.push(nextAnim);
      }
    },
  );

  return (
    <div class="relative grid w-max" ref={wrapperRef}>
      <div
        class={cn(
          "grid transition-opacity duration-250 motion-reduce:duration-0",
          getConfig.mode === "zen" ? "opacity-0" : "opacity-100",
        )}
      >
        <Mode2Time class={cn(cardClass, sClass)} ref={timeRef} />
        <Mode2Words class={cn(cardClass, sClass)} ref={wordsRef} />
        <Mode2Quote class={cn(cardClass, sClass)} ref={quoteRef} />
        <Mode2Custom class={cn(cardClass, sClass)} ref={customRef} />
      </div>
      <TCButton
        label="Share test settings"
        class={
          "pointer-events-none absolute right-0 self-center px-(--horizontal-padding) opacity-0 transition-[margin-right,background-color,opacity] duration-125 group-hover:pointer-events-auto group-hover:mr-[calc((1.25em+(var(--horizontal-padding)*2))*-1)] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:mr-[calc((1.25em+(var(--horizontal-padding)*2))*-1)] hover:mr-[calc((1.25em+(var(--horizontal-padding)*2))*-1)] hover:opacity-100"
        }
        fa={{ icon: "fa-share" }}
        onClick={() => showModal("ShareTestSettings")}
      />
    </div>
  );
}

function Mode2Time(props: ComponentProps<"div">): JSXElement {
  const times = [15, 30, 60, 120] as const;

  return (
    <div {...props}>
      <For each={times}>
        {(time) => (
          <TCButton
            text={`${time}`}
            active={getConfig.time === time}
            onClick={() => {
              setConfig("time", time);
              restartTest();
            }}
          />
        )}
      </For>
      <TCButton
        label="Custom test duration"
        active={!times.includes(getConfig.time as (typeof times)[number])}
        fa={{
          icon: "fa-tools",
        }}
        onClick={() => {
          showModal("TestDuration");
        }}
      />
    </div>
  );
}

function Mode2Words(props: ComponentProps<"div">): JSXElement {
  const wordCounts = [10, 25, 50, 100] as const;

  return (
    <div {...props}>
      <For each={wordCounts}>
        {(count) => (
          <TCButton
            text={`${count}`}
            active={getConfig.words === count}
            onClick={() => {
              setConfig("words", count);
              restartTest();
            }}
          />
        )}
      </For>
      <TCButton
        label="Custom word count"
        active={
          !wordCounts.includes(getConfig.words as (typeof wordCounts)[number])
        }
        fa={{
          icon: "fa-tools",
        }}
        onClick={() => {
          showModal("CustomWordAmount");
        }}
      />
    </div>
  );
}

function Mode2Quote(props: ComponentProps<"div">): JSXElement {
  const quoteLengths = [
    { text: "short", length: 0 },
    { text: "medium", length: 1 },
    { text: "long", length: 2 },
    { text: "thicc", length: 3 },
  ] as const;

  return (
    <div {...props}>
      <TCButton
        text="all"
        active={areUnsortedArraysEqual(getConfig.quoteLength, [0, 1, 2, 3])}
        onClick={() => {
          setQuoteLengthAll();
          restartTest();
        }}
      />
      <For each={quoteLengths}>
        {({ text, length }) => (
          <TCButton
            text={text}
            active={areUnsortedArraysEqual(getConfig.quoteLength, [length])}
            onClick={() => {
              setConfig("quoteLength", [length]);
              restartTest();
            }}
          />
        )}
      </For>
      <Show when={isAuthenticated()}>
        <TCButton
          label="Favorite quotes"
          fa={{
            icon: "fa-heart",
          }}
          active={areUnsortedArraysEqual(getConfig.quoteLength, [-3])}
          onClick={() => {
            setConfig("quoteLength", [-3]);
            restartTest();
          }}
        />
      </Show>
      <TCButton
        label="Search quotes"
        fa={{
          icon: "fa-search",
        }}
        active={areUnsortedArraysEqual(getConfig.quoteLength, [-2])}
        onClick={() => {
          showModal("QuoteSearch");
        }}
      />
    </div>
  );
}

function Mode2Custom(props: ComponentProps<"div">): JSXElement {
  return (
    <div {...props}>
      <TCButton
        text="change"
        onClick={() => {
          showModal("CustomText");
        }}
      />
    </div>
  );
}
