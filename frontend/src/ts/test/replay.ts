import * as Sound from "../controllers/sound-controller";
import * as Arrays from "../utils/arrays";
import { Config } from "../config/store";
import * as TestWords from "./test-words";
import {
  buildEventLog,
  getAllTestEvents,
  getInputForWord,
} from "./events/data";
import {
  getInputHistory,
  getWpmHistory,
} from "@oxytype/typing-core/events/stats";
import { batch } from "solid-js";
import { produce } from "solid-js/store";
import { resultState, setResultState } from "../states/result";
import type { ReplayLetter, ReplayWord } from "../states/result";

type ReplayAction =
  | "correctLetter"
  | "incorrectLetter"
  | "backWord"
  | "submitCorrectWord"
  | "submitErrorWord"
  | "setLetterIndex";

type Replay = {
  action: ReplayAction;
  value?: string | number;
  time: number;
};

let wordsList: string[] = [];
let replayData: Replay[] = [];
let wpmHistory: number[] = [];
let wordPos = 0;
let curPos = 0;
let targetWordPos = 0;
let targetCurPos = 0;
let timeoutList: NodeJS.Timeout[] = [];
let stopwatchList: NodeJS.Timeout[] = [];

function getWordsList(): string[] {
  if (Config.mode === "zen") return getInputHistory(buildEventLog());
  return TestWords.words
    .get()
    .slice()
    .map((word) => word.textWithCommit);
}

function deriveReplayActions(): Replay[] {
  const events = getAllTestEvents();
  const actions: Replay[] = [];
  let prevWordIndex: number | undefined;

  for (const event of events) {
    if (event.type !== "input") continue;
    const wi = event.data.wordIndex;

    if (prevWordIndex !== undefined && wi !== prevWordIndex) {
      if (wi > prevWordIndex) {
        const typed = getInputForWord(prevWordIndex);
        const target =
          Config.mode === "zen"
            ? typed
            : TestWords.words.get(prevWordIndex)?.textWithCommit;
        const correct = typed === target;
        actions.push({
          action: correct ? "submitCorrectWord" : "submitErrorWord",
          time: event.testMs,
        });
      } else {
        actions.push({ action: "backWord", time: event.testMs });
      }
    }

    if (
      event.data.inputType === "insertText" ||
      event.data.inputType === "insertCompositionText"
    ) {
      if (event.data.inputStopped) {
        prevWordIndex = wi;
        continue;
      }
      actions.push({
        action: event.data.correct ? "correctLetter" : "incorrectLetter",
        value: event.data.data,
        time: event.testMs,
      });
    } else if (
      event.data.inputType === "deleteContentBackward" ||
      event.data.inputType === "deleteWordBackward"
    ) {
      if (prevWordIndex !== undefined && wi < prevWordIndex) {
        // word transition already emitted backWord above
      } else {
        const newCharIndex =
          event.data.inputValue !== undefined
            ? event.data.inputValue.length
            : event.data.charIndex;
        actions.push({
          action: "setLetterIndex",
          value: newCharIndex,
          time: event.testMs,
        });
      }
    }

    prevWordIndex = wi;
  }

  return actions;
}

function initializeReplayPrompt(): void {
  let wordCount = 0;
  replayData.forEach((item) => {
    if (item.action === "backWord") {
      wordCount--;
    } else if (
      item.action === "submitCorrectWord" ||
      item.action === "submitErrorWord"
    ) {
      wordCount++;
    }
  });
  const words: ReplayWord[] = [];
  wordsList.forEach((word, i) => {
    if (i > wordCount) return;
    const letters: ReplayLetter[] = [];
    for (const letter of word) {
      letters.push({
        char: letter,
        correct: false,
        incorrect: false,
        extra: false,
      });
    }
    words.push({ letters, error: false });
  });
  setResultState("replay", "words", words);
}

export function pauseReplay(): void {
  timeoutList.forEach((item) => {
    clearTimeout(item);
  });
  timeoutList = [];
  stopwatchList.forEach((item) => {
    clearTimeout(item);
  });
  stopwatchList = [];
  targetCurPos = curPos;
  targetWordPos = wordPos;

  setResultState("replay", "playback", "paused");
}

function playSound(error = false): void {
  if (error) {
    if (Config.playSoundOnError !== "off") {
      void Sound.playError();
    } else {
      void Sound.playClick();
    }
  } else {
    void Sound.playClick();
  }
}

function isUntouchedLetter(letter: ReplayLetter | undefined): boolean {
  return (
    letter !== undefined &&
    !letter.correct &&
    !letter.incorrect &&
    !letter.extra
  );
}

function handleDisplayLogic(item: Replay, nosound = false): void {
  if (resultState.replay.words[wordPos] === undefined) return;

  setResultState(
    "replay",
    "words",
    produce((words) => {
      let activeWord = words[wordPos] as ReplayWord;

      if (item.action === "correctLetter") {
        if (!nosound) playSound();
        const letter = activeWord.letters[curPos];
        if (letter !== undefined) letter.correct = true;
        curPos++;
      } else if (item.action === "incorrectLetter") {
        if (!nosound) playSound(true);
        if (curPos >= activeWord.letters.length) {
          activeWord.letters.push({
            char: item.value?.toString() ?? "",
            correct: false,
            incorrect: false,
            extra: true,
          });
        }
        const letter = activeWord.letters[curPos];
        if (letter !== undefined) letter.incorrect = true;
        curPos++;
      } else if (
        item.action === "setLetterIndex" &&
        typeof item.value === "number"
      ) {
        if (!nosound) playSound();
        curPos = item.value;
        activeWord.letters = [
          ...activeWord.letters.slice(0, curPos),
          ...activeWord.letters
            .slice(curPos)
            .filter((letter) => !letter.extra)
            .map((letter) => ({
              ...letter,
              correct: false,
              incorrect: false,
            })),
        ];
      } else if (item.action === "submitCorrectWord") {
        if (!nosound) playSound();
        wordPos++;
        curPos = 0;
      } else if (item.action === "submitErrorWord") {
        if (!nosound) playSound(true);
        activeWord.error = true;
        wordPos++;
        curPos = 0;
      } else if (item.action === "backWord") {
        if (!nosound) playSound();
        wordPos--;

        const fallback = words[wordPos];
        if (fallback === undefined) return;
        activeWord = fallback;

        curPos = activeWord.letters.length;
        while (isUntouchedLetter(activeWord.letters[curPos - 1])) curPos--;
        activeWord.error = false;
      }
    }),
  );
}

function loadOldReplay(): number {
  let startingIndex = 0;
  curPos = 0;
  wordPos = 0;
  batch(() => {
    replayData.forEach((item, i) => {
      if (
        wordPos < targetWordPos ||
        (wordPos === targetWordPos && curPos < targetCurPos)
      ) {
        handleDisplayLogic(item, true);
        startingIndex = i + 1;
      }
    });
  });

  const datatime = replayData[startingIndex]?.time;

  if (datatime === undefined) {
    throw new Error("Failed to load old replay: datatime is undefined");
  }

  const time = Math.max(0, Math.floor(datatime / 1000));
  updateStatsString(time);

  return startingIndex;
}

export function toggleReplayDisplay(): void {
  if (!resultState.replay.visible) {
    refreshReplayFromEvents();
    initializeReplayPrompt();
    loadOldReplay();
    setResultState("replay", { visible: true, slideDuration: 250 });
  } else {
    if (resultState.replay.playback !== "start") {
      pauseReplay();
    }
    setResultState("replay", { visible: false, slideDuration: 250 });
  }
}

function refreshReplayFromEvents(): void {
  wordsList = getWordsList();
  replayData = deriveReplayActions();
  wpmHistory = getWpmHistory(buildEventLog());
  targetCurPos = 0;
  targetWordPos = 0;
}

function updateStatsString(time: number): void {
  const wpm = wpmHistory[time - 1] ?? 0;
  setResultState("replay", "stats", `${wpm}wpm\t${time}s`);
}

function playReplay(): void {
  curPos = 0;
  wordPos = 0;

  setResultState("replay", "playback", "playing");
  initializeReplayPrompt();
  const startingIndex = loadOldReplay();
  const lastTime = replayData[startingIndex]?.time;

  if (lastTime === undefined) {
    throw new Error("Failed to play replay: lastTime is undefined");
  }

  let swTime = Math.round(lastTime / 1000);
  const swEndTime = Math.round(
    (Arrays.lastElementFromArray(replayData) as Replay).time / 1000,
  );
  while (swTime <= swEndTime) {
    const time = swTime;
    stopwatchList.push(
      setTimeout(
        () => {
          updateStatsString(time);
        },
        time * 1000 - lastTime,
      ),
    );
    swTime++;
  }
  replayData.forEach((item, i) => {
    if (i < startingIndex) return;
    timeoutList.push(
      setTimeout(() => {
        handleDisplayLogic(item);
      }, item.time - lastTime),
    );
  });
  timeoutList.push(
    setTimeout(
      () => {
        targetCurPos = 0;
        targetWordPos = 0;
        setResultState("replay", "playback", "start");
      },
      (Arrays.lastElementFromArray(replayData) as Replay).time - lastTime,
    ),
  );
}

export function togglePlayback(): void {
  if (resultState.replay.playback === "playing") {
    pauseReplay();
  } else {
    playReplay();
  }
}

// replay words letter clicked
export function jumpToLetter(wordIndex: number, letterIndex: number): void {
  pauseReplay();
  targetWordPos = wordIndex;
  targetCurPos = letterIndex;

  initializeReplayPrompt();
  loadOldReplay();
}
