import {
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import type { FaObject } from "#shared/types/font-awesome.d.ts";

import { holdKeyboardForRestart } from "#features/typing/input/input-element.ts";
import { Button } from "#shared/components/common/Button.tsx";
import { Fa } from "#shared/components/common/Fa.tsx";
import { getConfig } from "#shared/config/store.ts";
import { getIsScreenshotting } from "#shared/states/core.ts";
import { showModal } from "#shared/states/modals.ts";
import { showNoticeNotification } from "#shared/states/notifications.ts";
import {
  getResultVisible,
  isResultCalculating,
  isTestRestarting,
} from "#shared/states/test.ts";
import { cn } from "#shared/utils/cn.ts";
import { isCoarsePointer } from "#shared/utils/pointer.ts";

import * as PractiseWords from "../../runtime/content/practise-words";
import { toggleReplayDisplay } from "../../runtime/replay";
import { toggleResultWords } from "../../runtime/result/screen";
import * as TestLogic from "../../runtime/test/logic";
import * as TestScreenshot from "../../runtime/test/screenshot";
import { isTypingRouteActive } from "../../scope";
import { resultState } from "../../state/result";
import { EngineMemoryNotice } from "./EngineMemoryNotice";

export function ResultButtons(): JSXElement {
  // shift held: screenshot button downloads instead of copying
  const [shiftHeld, setShiftHeld] = createSignal(false);

  const onShift = (event: KeyboardEvent): void => {
    if (!(getResultVisible() && isTypingRouteActive())) return;
    if (event.key !== "Shift") return;
    setShiftHeld(event.type === "keydown");
  };

  onMount(() => {
    document.addEventListener("keydown", onShift);
    document.addEventListener("keyup", onShift);
  });
  onCleanup(() => {
    document.removeEventListener("keydown", onShift);
    document.removeEventListener("keyup", onShift);
  });

  const canDrill = createMemo(
    () =>
      PractiseWords.practiceResult()?.context ===
        `${getConfig.language}:${getConfig.layout}` &&
      PractiseWords.weakestWords().length > 0,
  );
  const buttons: {
    id: string;
    label: string;
    // visible text under the icon on phones (no hover balloons on touch)
    shortLabel: string;
    icon: () => FaObject;
    class?: string;
    visible?: () => boolean;
    // hidden in glarses mode
    noStressHidden?: boolean;
    balloonBreak?: boolean;
    onClick: (event: MouseEvent) => void;
  }[] = [
    {
      id: "nextTestButton",
      label: "Next test",
      shortLabel: "next test",
      // phones: primary action, main-colored and tall
      get class() {
        return cn(
          canDrill() ? "max-md:col-span-3" : "max-md:col-span-full",
          "max-md:flex-row max-md:gap-2 max-md:px-[1em]! max-md:py-[0.75em]! max-md:bg-main max-md:text-[1.125rem] max-md:text-bg max-md:hover:bg-main max-md:hover:text-bg",
        );
      },
      icon: () => ({ icon: "fa-chevron-right" }),
      onClick: () => {
        holdKeyboardForRestart();
        void TestLogic.restart();
      },
    },
    {
      id: "practiceWeakWordsButton",
      label: "Practice weak words",
      shortLabel: "practice weak words",
      class: "max-md:col-span-3",
      visible: canDrill,
      icon: () => ({ icon: "fa-bullseye" }),
      onClick: () => {
        if (
          isResultCalculating() ||
          isTestRestarting() ||
          !PractiseWords.initFromHistory()
        ) {
          return;
        }
        holdKeyboardForRestart();
        void TestLogic.restart({ practiseMissed: true });
      },
    },
    {
      id: "restartTestButtonWithSameWordset",
      label: "Repeat test",
      shortLabel: "repeat",
      icon: () => ({ icon: "fa-sync-alt" }),
      onClick: () => {
        if (getConfig.mode === "zen") {
          showNoticeNotification("Repeat test disabled in zen mode");
          return;
        }
        holdKeyboardForRestart();
        void TestLogic.restart({
          withSameWordset: true,
        });
      },
    },
    {
      id: "practiseWordsButton",
      label: "Practice words",
      shortLabel: "practice",
      icon: () => ({ icon: "fa-exclamation-triangle" }),
      onClick: () => {
        if (getConfig.mode === "zen") {
          showNoticeNotification("Practice words is unsupported in zen mode");
          return;
        }
        showModal("PractiseWords");
      },
    },
    {
      id: "showWordHistoryButton",
      label: "Toggle words history",
      shortLabel: "words",
      icon: () => ({ icon: "fa-align-left" }),
      noStressHidden: true,
      onClick: () => toggleResultWords(),
    },
    {
      id: "watchReplayButton",
      label: "Watch replay",
      shortLabel: "replay",
      icon: () => ({ icon: "fa-backward" }),
      noStressHidden: true,
      onClick: () => toggleReplayDisplay(),
    },
    {
      id: "saveScreenshotButton",
      label: isCoarsePointer()
        ? "Share screenshot"
        : "Copy screenshot to clipboard\n(shift click to download)",
      shortLabel: "screenshot",
      icon: () =>
        shiftHeld()
          ? { icon: "fa-download" }
          : { icon: "fa-image", variant: "regular" },
      noStressHidden: true,
      balloonBreak: true,
      onClick: (event) => {
        if (event.shiftKey) {
          void TestScreenshot.download();
        } else if (isCoarsePointer()) {
          void TestScreenshot.share();
        } else {
          void TestScreenshot.copyToClipboard();
        }
        setShiftHeld(false);
      },
    },
  ];

  return (
    <>
      <EngineMemoryNotice />
      <Show when={PractiseWords.practiceResult()?.improved}>
        {(improved) => (
          <p class="col-[1/3] text-center text-sub">
            {improved().length
              ? `Improved: ${improved().join(", ")}`
              : "No words improved this drill."}
          </p>
        )}
      </Show>
      <Show when={resultState.retrySaving}>
        <button
          type="button"
          id="retrySavingResultButton"
          class="danger mx-auto mt-0 mb-4 flex"
          onClick={() => void TestLogic.retrySavingResult()}
        >
          <Fa icon="fa-redo" />
          Retry saving result
        </button>
      </Show>
      <div
        class={cn(
          // Phones share the first row between Next test and the available drill.
          "buttons col-[1/3] grid grid-flow-col justify-center gap-4 max-md:grid-flow-row max-md:grid-cols-6 max-md:gap-2",
          getIsScreenshotting() && "hidden",
        )}
      >
        <For each={buttons.filter((button) => button.visible?.() ?? true)}>
          {(button) => (
            <Button
              variant="text"
              id={button.id}
              disabled={
                button.id === "nextTestButton" &&
                (isResultCalculating() || isTestRestarting())
              }
              aria-label={button.label}
              fa={{ ...button.icon(), fixedWidth: true }}
              class={cn(
                "max-md:col-span-2 max-md:nth-last-of-type-[-n+2]:col-span-3 max-md:min-h-11 max-md:min-w-11 max-md:flex-col max-md:gap-1 max-md:px-[0.25em]! max-md:py-[0.5em]! max-md:text-[0.75rem]",
                button.class,
                button.noStressHidden && resultState.noStress && "hidden",
              )}
              balloon={{
                text: button.label,
                position: "down",
                break: button.balloonBreak,
              }}
              onClick={(event) => button.onClick(event)}
            >
              <span
                class={cn(
                  button.id !== "practiceWeakWordsButton" &&
                    "hidden max-md:block",
                )}
              >
                {button.shortLabel}
              </span>
            </Button>
          )}
        </For>
      </div>
    </>
  );
}
