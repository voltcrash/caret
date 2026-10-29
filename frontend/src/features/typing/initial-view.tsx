import { For, Show, type JSXElement } from "solid-js";

import type { FaSolidIcon } from "../../ts/types/font-awesome";
import type { InitialTypingSnapshot } from "./initial-snapshot";

import { Button } from "../../ts/components/common/Button";
import { Fa } from "../../ts/components/common/Fa";
import { cn } from "../../ts/utils/cn";
import { variables, buttonClass, cardClass } from "./config-layout";

const modes: { value: string; icon: FaSolidIcon }[] = [
  { value: "time", icon: "fa-clock" },
  { value: "words", icon: "fa-font" },
  { value: "quote", icon: "fa-quote-left" },
  { value: "zen", icon: "fa-mountain" },
  { value: "custom", icon: "fa-wrench" },
];

/** Actual initial content; the engine later reproduces this seeded wordset. */
export function InitialTypingView(props: {
  snapshot: InitialTypingSnapshot;
}): JSXElement {
  const config = () => props.snapshot.settings;
  const control = (
    text: string | undefined,
    icon?: FaSolidIcon,
    active = false,
  ) => (
    <Button
      variant="text"
      text={text}
      fa={icon === undefined ? undefined : { icon, fixedWidth: true }}
      class={cn(buttonClass, "pointer-events-none")}
      active={active}
      tabIndex={-1}
      dataset={{ "aria-disabled": "true" }}
    />
  );
  const countOptions = () =>
    config().mode === "time" ? [15, 30, 60, 120] : [10, 25, 50, 100];
  const count = () =>
    config().mode === "time" ? config().time : config().words;
  return (
    <div
      class="page pageTest full-width content-grid relative col-[full-width] grid h-full grid-rows-[1fr_auto_1fr]"
      data-initial-typing
    >
      <div class="full-width">
        <div
          class={cn(
            variables,
            "group relative mb-8 hidden w-max grid-cols-[1fr_auto_1fr] justify-center place-self-center [font-size:var(--font-size)] md:grid pointer-coarse:hidden! mx-auto",
          )}
          data-ui-element="initialTestConfig"
        >
          <div class="mr-(--card-gap) w-max place-self-end">
            <Show when={config().mode !== "zen"}>
              <div class={cardClass}>
                {control("punctuation", "fa-at", config().punctuation)}
                {control("numbers", "fa-hashtag", config().numbers)}
              </div>
            </Show>
          </div>
          <div class={cn("z-2", cardClass)}>
            <For each={modes}>
              {(mode) =>
                control(mode.value, mode.icon, config().mode === mode.value)
              }
            </For>
          </div>
          <div class="relative grid w-max">
            <Show when={config().mode !== "zen"}>
              <div
                class={cn(
                  cardClass,
                  "z-2 col-start-1 row-start-1 grid w-max place-self-start grid-flow-col ml-(--card-gap)",
                )}
              >
                <Show
                  when={config().mode === "time" || config().mode === "words"}
                >
                  <For each={countOptions()}>
                    {(value) =>
                      control(`${value}`, undefined, count() === value)
                    }
                  </For>
                  {control(
                    undefined,
                    "fa-tools",
                    !countOptions().includes(count()),
                  )}
                </Show>
                <Show when={config().mode === "quote"}>
                  <For
                    each={[
                      { text: "all", length: -1 },
                      { text: "short", length: 0 },
                      { text: "medium", length: 1 },
                      { text: "long", length: 2 },
                      { text: "thicc", length: 3 },
                    ]}
                  >
                    {(label) =>
                      control(
                        label.text,
                        undefined,
                        label.length === -1
                          ? config().quoteLength.length === 4
                          : config().quoteLength.length === 1 &&
                              config().quoteLength[0] === label.length,
                      )
                    }
                  </For>
                  {control(undefined, "fa-search")}
                </Show>
                <Show when={config().mode === "custom"}>
                  {control("change")}
                </Show>
              </div>
            </Show>
          </div>
        </div>
        <Button
          class="pointer-events-none mx-auto flex min-h-11 max-w-full place-self-center px-4 py-2 text-sub md:hidden pointer-coarse:flex!"
          variant="button"
          fa={{ icon: "fa-cog", class: "shrink-0" }}
          tabIndex={-1}
          dataset={{ "aria-disabled": "true" }}
        >
          <span class="sr-only">test settings: </span>
          <span>
            {config().mode}{" "}
            <Show when={config().mode === "time" || config().mode === "words"}>
              {count()}
            </Show>
          </span>
        </Button>
      </div>
      <div
        class="content-grid relative mx-auto w-full"
        style={{
          "font-size": `calc(var(--startup-font-size, ${config().fontSize}rem) * var(--words-font-scale, 1))`,
        }}
      >
        <Show when={config().showTestModesNotice}>
          <div class="flex flex-wrap justify-center gap-x-4 gap-y-2 text-base text-sub select-none sm:gap-y-0">
            <span class="inline-flex items-center gap-2 py-2 pointer-coarse:min-h-11">
              <Fa icon="fa-globe-americas" />
              {config().language.replaceAll("_", " ")}
            </span>
          </div>
        </Show>
        <div
          class="full-width relative overflow-hidden"
          style={{ height: "calc(4.5em + 6px)" }}
          translate="no"
        >
          <div
            data-initial-words
            class="full-width flex h-fit w-full flex-wrap content-start pb-[0.5em] text-sub select-none"
          >
            <For each={props.snapshot.words}>
              {(word) => (
                <div class="word">
                  <For each={Array.from(word)}>
                    {(letter) => (
                      <span class="inline-block border-b-[0.05em] border-b-transparent">
                        {letter}
                      </span>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
          <div class="pointer-events-none absolute top-[0.25em] left-[0.3em] h-[1em] w-[0.1em] rounded bg-caret"></div>
        </div>
        <Button
          variant="text"
          class={cn(
            "pointer-events-none col-[content] mx-auto mt-4 flex px-[2em] py-[1em] text-[1rem] pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            config().quickRestart !== "off" && "hidden",
            "pointer-coarse:max-[778px]:block!",
          )}
          fa={{ icon: "fa-redo-alt", fixedWidth: true }}
          tabIndex={-1}
          dataset={{ "aria-disabled": "true" }}
        />
      </div>
      <div></div>
    </div>
  );
}
