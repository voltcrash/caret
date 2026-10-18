import { JSXElement, onCleanup, onMount } from "solid-js";
import { spread } from "solid-js/web";

import { useWordsInputScroll } from "../../../ts/hooks/useWordsInputScroll";
import { isInputElementFocused } from "../../../ts/input/input-element";
import { isWordsWrapperVisible } from "../../../ts/states/funbox";
import { setTestElements } from "../../../ts/states/test-dom";
import {
  getWordsWrapperHeight,
  getWordsInputStyle,
} from "../../../ts/states/words-layout";
import { cn } from "../../../ts/utils/cn";
import { isCoarsePointer } from "../../../ts/utils/pointer";
import { focusWords } from "../runtime/test-ui";
import { CapsWarning } from "./CapsWarning";
import { CompositionDisplay } from "./CompositionDisplay";
import { EndTestButton } from "./EndTestButton";
import { FinishZenButton } from "./FinishZenButton";
import { FunboxTimers } from "./FunboxTimer";
import { Keymap } from "./Keymap";
import { LiveStatsMini } from "./live-stats/LiveStatsMini";
import { LiveStatsTextBottom } from "./live-stats/LiveStatsTextBottom";
import { LiveStatsTextTop } from "./live-stats/LiveStatsTextTop";
import { TestModesNotice } from "./modes-notice/TestModesNotice";
import { OutOfFocusWarning } from "./OutOfFocusWarning";
import { RestartTestButton } from "./RestartTestButton";
import { LazyResult } from "./result/LazyResult";
import { ResultAnnouncement } from "./result/ResultAnnouncement";
import { SaveProgressButton } from "./SaveProgressButton";
import { TestConfig } from "./TestConfig";
import { TestInitFailed } from "./TestInitFailed";
import { TestLoading } from "./TestLoading";
import { TestPageLifecycle } from "./TestPageLifecycle";
import { TypingEvents } from "./TypingEvents";
import { Words } from "./Words";
import { Caret } from "./words/Caret";

export function TestPage(
  props: { ref?: (el: HTMLDivElement) => void; class?: string } = {},
): JSXElement {
  const refs = {} as Parameters<typeof setTestElements>[0];

  onMount(() => {
    onCleanup(setTestElements(refs));
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
        props.class,
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
            if (isCoarsePointer()) {
              e.preventDefault();
            }
          }}
          // a keyboard dismissed with android's back button leaves the input
          // focused, and focus() on a focused input won't bring it back
          onClick={() =>
            focusWords(isCoarsePointer() && isInputElementFocused())
          }
        >
          <textarea
            id="wordsInput"
            aria-label="Typing input"
            ref={(el) => (refs.wordsInput = el)}
            class={cn(
              "full-width pointer-events-none absolute -z-1 mx-auto block h-[1em] w-0 cursor-default resize-none overflow-hidden rounded-none border-none p-0 text-[1em] [caret-color:transparent] opacity-0 [contain:strict] outline-none [text-wrap-mode:nowrap]",
            )}
            style={getWordsInputStyle()}
            autocomplete="off"
            autoCapitalize="off"
            inputMode="text"
            enterkeyhint="done"
            autocorrect="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-bwignore
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            {...{ list: "autocompleteOff" }}
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
        <EndTestButton />
        <LiveStatsTextBottom />
      </div>
      {/* see holdKeyboardForRestart. 16px so ios doesn't zoom on focus */}
      <input
        ref={(el) => (refs.keyboardProxy = el)}
        type="text"
        aria-label="Keyboard restart input"
        class="pointer-events-none fixed top-0 left-0 size-px p-0 text-[16px] opacity-0"
        tabIndex={-1}
        aria-hidden="true"
        autocomplete="off"
        autoCapitalize="off"
        autocorrect="off"
      />
      <TestPageLifecycle input={refs.wordsInput} />
      <TypingEvents />
      <TestLoading />
      <ResultAnnouncement />
      <LazyResult />
    </div>
  );
}
