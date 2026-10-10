import { JSXElement, onMount } from "solid-js";
import { spread } from "solid-js/web";

import { useWordsInputScroll } from "../../../hooks/useWordsInputScroll";
import { isWordsWrapperVisible } from "../../../states/funbox";
import { getPageView } from "../../../states/page-transition";
import { setTestElements } from "../../../states/test-dom";
import {
  getWordsWrapperHeight,
  getWordsInputStyle,
} from "../../../states/words-layout";
import { focusWords } from "../../../test/test-ui";
import { cn } from "../../../utils/cn";
import { CapsWarning } from "./CapsWarning";
import { Caret } from "./Caret";
import { CompositionDisplay } from "./CompositionDisplay";
import { FinishZenButton } from "./FinishZenButton";
import { FunboxTimers } from "./FunboxTimer";
import { Keymap } from "./Keymap";
import { LiveStatsMini } from "./live-stats/LiveStatsMini";
import { LiveStatsTextBottom } from "./live-stats/LiveStatsTextBottom";
import { LiveStatsTextTop } from "./live-stats/LiveStatsTextTop";
import { TestModesNotice } from "./modes-notice/TestModesNotice";
import { OutOfFocusWarning } from "./OutOfFocusWarning";
import { RestartTestButton } from "./RestartTestButton";
import { Result } from "./result/Result";
import { SaveProgressButton } from "./SaveProgressButton";
import { TestConfig } from "./TestConfig";
import { TestInitFailed } from "./TestInitFailed";
import { TestLoading } from "./TestLoading";
import { TestPageLifecycle } from "./TestPageLifecycle";
import { Words } from "./Words";

export function TestPage(
  props: { ref?: (el: HTMLDivElement) => void } = {},
): JSXElement {
  const refs = {} as Parameters<typeof setTestElements>[0];

  onMount(() => {
    setTestElements(refs);
    useWordsInputScroll(refs.wordsWrapper, refs.wordsInput);
    spread(
      refs.wordsWrapper,
      {
        get class() {
          return cn(
            refs.wordsWrapper.className
              .split(/\s+/)
              .filter((name) => name !== "hidden"),
            !isWordsWrapperVisible() && "hidden",
          );
        },
      },
      false,
      true,
    );
  });

  return (
    <div
      ref={(el) => {
        props.ref?.(el);
      }}
      class={cn(
        "page pageTest full-width content-grid relative col-[full-width] grid h-full grid-rows-[1fr_auto_1fr]",
        getPageView().id === "test" &&
          getPageView().phase === "prepared" &&
          !getPageView().revealed &&
          "hidden",
        getPageView().id === "test" &&
          getPageView().phase === "active" &&
          "active",
      )}
      data-nosnippet
    >
      <div class="full-width">
        <TestConfig />
      </div>
      <TestInitFailed />
      <div
        id="typingTest"
        ref={(el) => (refs.typingTest = el)}
        class="content-grid full-width-padding relative mx-auto w-full"
      >
        <CapsWarning />
        <FunboxTimers />
        <TestModesNotice />
        <LiveStatsTextTop />
        <LiveStatsMini />
        <div
          id="wordsWrapper"
          ref={(el) => (refs.wordsWrapper = el)}
          class={cn(
            "content-grid full-width relative [overflow:visible_clip] [--c-dot--error:var(--error-color)] [--c-dot:var(--text-color)] pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]",
            "[&.tape]:overflow-hidden [&.tape]:[mask-image:linear-gradient(90deg,transparent_1%,black_10%,black_90%,transparent_99%)]",
          )}
          style={{ height: getWordsWrapperHeight() }}
          translate="no"
          onMouseDown={(e) => {
            // Keep focus on the hidden input so tapping words does not blur it
            // (which closes and reopens the keyboard) or move its caret.
            if (window.matchMedia("(pointer: coarse)").matches) {
              e.preventDefault();
            }
          }}
          onClick={() => focusWords()}
        >
          <textarea
            id="wordsInput"
            ref={(el) => (refs.wordsInput = el)}
            class={cn(
              "full-width pointer-events-none absolute -z-1 mx-auto block h-[1em] w-0 cursor-default resize-none overflow-hidden rounded-none border-none p-0 text-[1em] pointer-coarse:[font-size:max(16px,1em)] [caret-color:transparent] opacity-0 [contain:strict] outline-none [text-wrap-mode:nowrap]",
            )}
            style={getWordsInputStyle()}
            autocomplete="off"
            autoCapitalize="off"
            inputMode="text"
            // oxlint-disable-next-line react/no-unknown-property -- Solid types use lowercase enterkeyhint
            enterkeyhint="done"
            // oxlint-disable-next-line react/no-unknown-property -- Solid uses lowercase autocorrect
            autocorrect="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-bwignore
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            {...{ list: "autocompleteOff" }}
            // oxlint-disable-next-line react/no-unknown-property -- Solid uses lowercase spellcheck
            spellcheck={false}
          ></textarea>
          <OutOfFocusWarning />
          <Caret pace ref={(el) => (refs.paceCaret = el)} />
          <Caret ref={(el) => (refs.caret = el)} />
          <Words ref={(el) => (refs.words = el)} />
        </div>
        <CompositionDisplay />
        <Keymap />
        <RestartTestButton />
        <FinishZenButton />
        <SaveProgressButton />
        <LiveStatsTextBottom />
      </div>
      <TestPageLifecycle input={refs.wordsInput} />
      <TestLoading />
      <Result />
    </div>
  );
}
