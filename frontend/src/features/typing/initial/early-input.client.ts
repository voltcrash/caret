import type { ContentRequest } from "@caret/typing-engine/browser.client";
import { EngineFailure } from "@caret/typing-engine/failure";
import { encodeText } from "@caret/typing-engine/text";
import type {
  EarlyTypingBridge,
  EarlyTypingWindow,
} from "#app/early-typing-bootstrap.ts";
import { peekConfig } from "#shared/config/store.ts";
import { getBrowserEngine } from "#shared/engine/owner.client.ts";
import { getActiveWordIndex } from "#features/typing/state/active-word.ts";
import { setReplayingEarlyTyping } from "#features/typing/state/early-replay.ts";
import {
  insertionLayout,
  observeInputView,
} from "../input/handlers/before-insert-text";
import { getContentHost } from "../runtime/content/host.client";
import { getEngineSession } from "../runtime/session.client";
import * as TestUI from "../runtime/test/ui";
import * as TestWords from "../runtime/test/words";

function takeEarlyTyping(): EarlyTypingBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as EarlyTypingWindow;
  const bridge = win.__caretEarlyTyping;
  if (bridge === undefined) return undefined;
  delete win.__caretEarlyTyping;
  bridge.dispose();
  return bridge;
}

export function disposeEarlyTyping(): void {
  takeEarlyTyping();
}

function isConfigCompatible(): boolean {
  const c = peekConfig();
  return (
    (c.mode === "time" || c.mode === "words") &&
    c.funbox.length === 0 &&
    c.layout === "default" &&
    c.stopOnError === "off" &&
    c.confidenceMode === "off" &&
    !c.freedomMode &&
    !c.blindMode &&
    !c.hideExtraLetters &&
    !c.strictSpace &&
    !c.britishEnglish &&
    !c.lazyMode &&
    c.indicateTypos === "off" &&
    c.highlightMode === "letter" &&
    c.typedEffect === "keep" &&
    c.oppositeShiftMode === "off" &&
    c.tapeMode === "off"
  );
}

function wordsMatchPrefix(earlyWords: readonly string[]): boolean {
  if (earlyWords.length === 0 || TestWords.words.length < earlyWords.length) {
    return false;
  }
  for (let i = 0; i < earlyWords.length; i++) {
    if (TestWords.words.get(i)?.text !== earlyWords[i]) {
      return false;
    }
  }
  return true;
}

async function supplyIfAwaiting(
  request: ContentRequest,
  isCurrent: () => boolean,
): Promise<boolean> {
  try {
    await getContentHost().supplyActive(request);
    return true;
  } catch (error) {
    if (
      !isCurrent() ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof EngineFailure && error.code === "staleRequest")
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Replays keystrokes captured against the SSR preview into the prepared Wasm
 * session with original timestamps, advancing elapsed whole-second ticks so
 * per-second WPM history stays accurate without triggering slow-timer drift.
 */
export async function replayEarlyTyping(): Promise<{
  replayed: boolean;
  tapped: boolean;
}> {
  const bridge = takeEarlyTyping();
  if (bridge === undefined) return { replayed: false, tapped: false };
  const { events, words, tapped } = bridge;
  const session = getEngineSession();
  if (
    events.length === 0 ||
    !session.isPrepared() ||
    !isConfigCompatible() ||
    !wordsMatchPrefix(words)
  ) {
    return { replayed: false, tapped };
  }

  const lease = getBrowserEngine().captureSession();
  setReplayingEarlyTyping(true);
  let replayedAny = false;
  let startNow: number | undefined;
  let startDate: number | undefined;
  let nextTick = 1;

  const advanceTicksUpTo = (limitNow: number): void => {
    if (startNow === undefined || startDate === undefined) return;
    while (
      lease.isCurrent() &&
      session.isActive() &&
      startNow + nextTick * 1000 <= limitNow
    ) {
      const tickNow = startNow + nextTick * 1000;
      const tickDate = startDate + nextTick * 1000;
      nextTick++;
      session.command({ op: "advance", now: tickNow, date: tickDate });
    }
  };

  try {
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (event === undefined || !lease.isCurrent() || session.state()?.ended) {
        break;
      }
      advanceTicksUpTo(event.now);
      if (!lease.isCurrent() || session.state()?.ended) break;

      if (event.op === "insert") {
        if (startNow === undefined && event.data !== " ") {
          startNow = event.now;
          startDate = event.date;
        }
        observeInputView(event.now);
        const update = session.command({
          op: "insert",
          now: event.now,
          date: event.date,
          data: encodeText(event.data),
          correctShiftUsed: null,
          automatic: null,
          isCompositionEnding: null,
          layout: {
            ...insertionLayout(event.data),
            finalInBatch: index === events.length - 1,
          },
        });
        replayedAny = true;
        if (
          update.awaitingContent &&
          update.contentRequest !== undefined &&
          !(await supplyIfAwaiting(update.contentRequest, lease.isCurrent))
        ) {
          break;
        }
      } else {
        observeInputView(event.now);
        const current = session.getCurrentInput();
        const observedInput =
          event.kind === "deleteContentBackward" && current.length > 0
            ? encodeText(Array.from(current).slice(0, -1).join(""))
            : null;
        session.command({
          op: "delete",
          now: event.now,
          date: event.date,
          kind: event.kind,
          observedInput,
          sentinelRemoved: false,
        });
        replayedAny = true;
      }
    }

    if (replayedAny) {
      advanceTicksUpTo(performance.now());
      if (lease.isCurrent() && session.isActive()) {
        TestUI.syncReplayedWords(
          getActiveWordIndex(),
          (i) => session.getInputForWord(i),
          (i) =>
            session.getInputForWord(i) !==
            TestWords.words.get(i)?.textWithCommit,
        );
      }
    }
  } finally {
    setReplayingEarlyTyping(false);
  }

  return { replayed: replayedAny, tapped };
}
