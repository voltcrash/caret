import { batch, createEffect, createSignal, onCleanup } from "solid-js";
import type { ContentRequest } from "@caret/typing-engine/browser.client";
import { EngineFailure } from "@caret/typing-engine/failure";
import { decodeText } from "@caret/typing-engine/text";
import { getBrowserEngine } from "../engine.client";
import { captureTypingRoute } from "../scope";
import { getEngineSession } from "./session.client";
import { getContentHost } from "./content.client";
import * as TestUI from "./test-ui";
import * as TestWords from "./test-words";
import * as TestLogic from "./test-logic";
import * as Composition from "../../../ts/states/composition";
import * as SlowTimer from "../../../ts/states/slow-timer";
import { getMutableConfig } from "../../../ts/config/store";
import {
  getActiveWordIndex,
  setActiveWordIndex,
  setWordsHaveTab,
  setWordsHaveNewline,
  isTestActive,
  isTestRestarting,
} from "../../../ts/states/test";
import { setInputElementValue } from "../../../ts/input/input-element";
import {
  setAwaitingNextWord,
  incrementIncorrectShiftsInARow,
  resetIncorrectShiftsInARow,
  getIncorrectShiftsInARow,
} from "../../../ts/input/state";
import { showLoaderBar, hideLoaderBar } from "../../../ts/states/loader-bar";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../../ts/states/notifications";
import { flash } from "../../../ts/events/keymap";
import { getActiveFunboxesWithFunction } from "./funbox/list";
import * as Funbox from "./funbox/funbox";
import { setLowFpsMode } from "../../../ts/anim";
import { applyEngineRecovery } from "./recovery.client";

/** Subscriptions and imperative rendering belong to the mounted typing component. */
export function useEngineInputProjection(): void {
  const session = getEngineSession();
  const owner = getBrowserEngine();
  let automatic: ReturnType<typeof setTimeout> | undefined;
  let activeSource: string | undefined;
  const [request, setRequest] = createSignal<ContentRequest>();
  createEffect(() => {
    const source = request();
    if (source === undefined || isTestRestarting()) return;
    const key = JSON.stringify(source);
    if (activeSource === key) return;
    activeSource = key;
    const lease = owner.captureSession();
    const route = captureTypingRoute();
    if (source.kind === "wikipedia") showLoaderBar();
    void getContentHost()
      .supplyActive(source)
      .catch((error: unknown) => {
        if (!lease.isCurrent() || !route.isCurrent()) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (error instanceof EngineFailure && error.code === "staleRequest") {
          return;
        }
        if (error instanceof EngineFailure) {
          applyEngineRecovery(error, () => {
            void TestLogic.restart();
          });
        } else {
          showErrorNotification(
            "Error while getting section. Please try again later",
            { error },
          );
        }
      })
      .finally(() => {
        if (activeSource !== key || !route.isCurrent()) return;
        activeSource = undefined;
        hideLoaderBar();
      });
  });
  onCleanup(
    session.subscribe((update, command, events) =>
      batch(() => {
        if (command.op === "reset") {
          clearTimeout(automatic);
          automatic = undefined;
          activeSource = undefined;
          setRequest(undefined);
          setAwaitingNextWord(false);
          return;
        }
        setAwaitingNextWord(update.awaitingContent);
        if (update.awaitingContent) {
          showLoaderBar();
        } else if (
          activeSource === undefined &&
          update.contentRequest === undefined
        ) {
          hideLoaderBar();
        }
        setRequest(update.contentRequest);
        if (update.metadata !== undefined) {
          setWordsHaveTab(update.metadata.hasTab);
          setWordsHaveNewline(update.metadata.hasNewline);
        }
        if (update.slowTimer) {
          SlowTimer.set();
          setLowFpsMode();
        }
        if (
          events.some(
            (event) => event.type === "timer" && event.data.event === "start",
          ) &&
          !isTestActive()
        ) {
          TestLogic.startTest(command.now);
        }
        if (
          command.op === "insert" ||
          command.op === "delete" ||
          command.op === "flushAutomatic" ||
          command.op === "supplyContent"
        ) {
          const previous = getActiveWordIndex();
          for (const change of new Map(
            update.words.map((word) => [word.index, word]),
          ).values()) {
            const fresh = change.index >= TestWords.words.length;
            const word = TestWords.words.set(
              change.index,
              decodeText(change.word),
              change.sectionIndex,
            );
            if (fresh) {
              if (word.display === "") {
                TestUI.appendEmptyWordElement(change.index);
              } else {
                TestUI.addWord(
                  word.display,
                  change.index,
                  change.index <= update.state.wordIndex + 1,
                );
              }
            }
          }
          // Zen has no generated targets. Project the native cursor into an
          // empty display word; backward navigation may have removed that node.
          if (
            getMutableConfig().mode === "zen" &&
            TestUI.getWordElement(update.state.wordIndex) === null
          ) {
            TestUI.appendEmptyWordElement(update.state.wordIndex);
          }
          const inputs = events.filter((event) => event.type === "input");
          let lastBurst: number | null = null;
          for (const event of inputs) {
            const data = event.data;
            if (
              data.inputType === "insertText" ||
              data.inputType === "insertCompositionText"
            ) {
              setActiveWordIndex(data.wordIndex);
              if (getMutableConfig().keymapMode === "react") {
                flash(data.data, data.correct);
              }
              if (
                command.op === "insert" &&
                command.correctShiftUsed === false
              ) {
                incrementIncorrectShiftsInARow();
                if (getIncorrectShiftsInARow() >= 5) {
                  showNoticeNotification("Opposite shift mode is on.", {
                    important: true,
                    customTitle: "Reminder",
                  });
                }
              } else {
                resetIncorrectShiftsInARow();
              }
            }
          }
          const touched = new Set(inputs.map((event) => event.data.wordIndex));
          for (const event of inputs) {
            if (
              "clearedNextWord" in event.data &&
              event.data.clearedNextWord === true
            ) {
              touched.add(event.data.wordIndex + 1);
            }
          }
          for (const index of touched) {
            void TestUI.updateWordLetters({
              wordIndex: index,
              input: session.getInputForWord(index),
              compositionData: Composition.getData(),
            });
          }
          const inserted = inputs
            .filter(
              (event) =>
                event.data.inputType === "insertText" ||
                event.data.inputType === "insertCompositionText",
            )
            .at(-1);
          const last = inputs.at(-1);
          if (
            (command.op !== "insert" ||
              command.layout?.finalInBatch !== false) &&
            inserted !== undefined &&
            (inserted.data.inputType === "insertText" ||
              inserted.data.inputType === "insertCompositionText")
          ) {
            setActiveWordIndex(last?.data.wordIndex ?? inserted.data.wordIndex);
            TestUI.afterTestTextInput(
              inserted.data.correct,
              update.visualInputOverride === undefined
                ? undefined
                : decodeText(update.visualInputOverride),
              inserted.data.commitsWord === true,
            );
          }
          // Preserve the old render queue order: typed letters, commit styling,
          // then the new active word. In blind mode styling must run last.
          for (const event of inputs) {
            const data = event.data;
            if ("commitsWord" in data && data.commitsWord === true) {
              setActiveWordIndex(data.wordIndex);
              TestUI.beforeTestWordChange(
                "forward",
                getMutableConfig().mode === "zen" ||
                  session.getInputForWord(data.wordIndex) ===
                    TestWords.words.get(data.wordIndex)?.textWithCommit,
              );
              for (const funbox of getActiveFunboxesWithFunction(
                "handleSpace",
              )) {
                funbox.functions.handleSpace();
              }
              if (getMutableConfig().liveBurstStyle !== "off") {
                lastBurst = session.wordBurst(data.wordIndex, command.now);
              }
            }
          }
          if (update.state.wordIndex < previous) {
            setActiveWordIndex(previous);
            TestUI.beforeTestWordChange("back", null);
          }
          setActiveWordIndex(update.state.wordIndex);
          setInputElementValue(
            decodeText(update.inputDisplayValue ?? update.state.inputValue),
          );
          if (update.state.wordIndex !== previous) {
            Funbox.toggleScript(TestWords.words.getCurrent()?.text ?? "");
            void TestUI.afterTestWordChange(
              update.state.wordIndex > previous ? "forward" : "back",
              lastBurst,
            );
          }
          if (command.op === "delete" && inputs.length !== 0) {
            TestUI.afterTestDelete();
          }
        }
        if (update.automaticPending && automatic === undefined) {
          const lease = owner.captureSession();
          automatic = setTimeout(() => {
            automatic = undefined;
            if (!lease.isCurrent()) return;
            session.command({
              op: "flushAutomatic",
              now: performance.now(),
              generation: update.generation,
            });
          }, 0);
        }
      }),
    ),
  );
  onCleanup(() => {
    clearTimeout(automatic);
  });
}
