import { getEventsPerWord, getInputFromDom } from "../helpers";
import { EventLog } from "../types";

export function getInputHistory(eventLog: EventLog): string[] {
  const eventsPerWordIndex = getEventsPerWord(eventLog.events);
  const history: string[] = [];

  for (const [wordIndex, events] of eventsPerWordIndex) {
    const lastEvent = events[events.length - 1];
    if (lastEvent === undefined) {
      history.push("");
      continue;
    }

    // THANKS FIREFOX FOR THIS MESS
    // A word is abandoned if the regression destination event — which
    // lives in the previous word's bucket — carries clearedNextWord.
    // Happens when Ctrl+Backspace eats the sentinel + non-word residue as
    // one run; the residue stays as this word's last inputValue but its
    // real final state is "".
    const previousWord = eventsPerWordIndex.get(wordIndex - 1) ?? [];
    const abandoned = previousWord.some(
      (e) =>
        e.testMs > lastEvent.testMs &&
        "clearedNextWord" in e.data &&
        e.data.clearedNextWord === true,
    );

    history.push(abandoned ? "" : getInputFromDom(events));
  }

  return history;
}
export function getMissedWords(eventLog: EventLog): Record<string, number> {
  const missedWords: Record<string, number> = Object.create(null) as Record<
    string,
    number
  >;

  for (const event of eventLog.events) {
    if (
      event.type === "input" &&
      event.data.inputType === "insertText" &&
      !event.data.correct
    ) {
      const word = eventLog.context.targetWords[event.data.wordIndex];
      if (word === undefined) continue;
      // targetWords store the trailing separator (commit char); strip exactly
      // that one separator (space/newline) to key by the bare word — not
      // trimEnd(), which would also eat a meaningful trailing tab (code mode)
      const bareWord = word.replace(/[ \n]$/, "");
      missedWords[bareWord] = (missedWords[bareWord] ?? 0) + 1;
    }
  }

  return missedWords;
}
export function getCorrectedWordsHistory(eventLog: EventLog): string[] {
  const ev = getEventsPerWord(eventLog.events);
  const correctedWords: string[] = [];

  for (const [, events] of ev.entries()) {
    const correctedChars: string[] = [];
    const currentChars: string[] = [];
    let cursorPos = 0;

    for (const event of events) {
      if (event.type !== "input") continue;
      if (
        event.data.inputType === "insertText" ||
        event.data.inputType === "insertCompositionText"
      ) {
        if (event.data.inputStopped) {
          continue;
        }
        currentChars[cursorPos] = event.data.data;
        cursorPos++;
      } else if (event.data.inputType === "deleteContentBackward") {
        if (cursorPos > 0) {
          cursorPos--;
          correctedChars[cursorPos] = currentChars[cursorPos] ?? "";
        }
      } else if (event.data.inputType === "deleteWordBackward") {
        while (cursorPos > 0) {
          cursorPos--;
          correctedChars[cursorPos] = currentChars[cursorPos] ?? "";
        }
      }
    }

    const result: string[] = [];
    for (let i = 0; i < currentChars.length; i++) {
      result.push(correctedChars[i] ?? currentChars[i] ?? "");
    }
    correctedWords.push(result.join(""));
  }

  return correctedWords;
}
