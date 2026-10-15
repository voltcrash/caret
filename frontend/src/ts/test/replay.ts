import * as Sound from "../controllers/sound-controller";
import * as Arrays from "../utils/arrays";
import { getMutableConfig } from "../config/store";
import { buildEventLog, getTestSession } from "./events/data";
import { getWpmHistory } from "@oxytype/typing-core/events/stats";
import {
  applyReplayStep,
  createReplayPrompt,
  ReplayCursor,
  ReplayStep,
  seekReplay,
} from "@oxytype/typing-core/replay";
import { produce } from "solid-js/store";
import { resultState, setResultState } from "../states/result";

// The session derives the replay; this module plays it on the result screen.
let words: string[] = [];
let steps: ReplayStep[] = [];
let wpmHistory: number[] = [];
let cursor: ReplayCursor = { wordIndex: 0, letterIndex: 0 };
let target: ReplayCursor = { wordIndex: 0, letterIndex: 0 };
let timeoutList: NodeJS.Timeout[] = [];
let stopwatchList: NodeJS.Timeout[] = [];

function initializeReplayPrompt(): void {
  setResultState("replay", "words", createReplayPrompt(words, steps));
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
  target = { ...cursor };

  setResultState("replay", "playback", "paused");
}

function playSound(sound: "click" | "error" | undefined): void {
  if (sound === undefined) return;
  if (sound === "error" && getMutableConfig().playSoundOnError !== "off") {
    void Sound.playError();
  } else {
    void Sound.playClick();
  }
}

function handleDisplayLogic(step: ReplayStep): void {
  const applied: { sound?: "click" | "error" } = {};
  setResultState(
    "replay",
    "words",
    produce((replayWords) => {
      applied.sound = applyReplayStep(replayWords, cursor, step);
    }),
  );
  playSound(applied.sound);
}

function loadOldReplay(): number {
  let startingIndex = 0;
  setResultState(
    "replay",
    "words",
    produce((replayWords) => {
      const seek = seekReplay(replayWords, steps, target);
      cursor = seek.cursor;
      startingIndex = seek.nextIndex;
    }),
  );

  const datatime = steps[startingIndex]?.time;

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
  ({ words, steps } = getTestSession().getReplay());
  wpmHistory = getWpmHistory(buildEventLog());
  target = { wordIndex: 0, letterIndex: 0 };
}

function updateStatsString(time: number): void {
  const wpm = wpmHistory[time - 1] ?? 0;
  setResultState("replay", "stats", `${wpm}wpm\t${time}s`);
}

function playReplay(): void {
  setResultState("replay", "playback", "playing");
  initializeReplayPrompt();
  const startingIndex = loadOldReplay();
  const lastTime = steps[startingIndex]?.time;

  if (lastTime === undefined) {
    throw new Error("Failed to play replay: lastTime is undefined");
  }

  let swTime = Math.round(lastTime / 1000);
  const swEndTime = Math.round(
    (Arrays.lastElementFromArray(steps) as ReplayStep).time / 1000,
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
  steps.forEach((item, i) => {
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
        target = { wordIndex: 0, letterIndex: 0 };
        setResultState("replay", "playback", "start");
      },
      (Arrays.lastElementFromArray(steps) as ReplayStep).time - lastTime,
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
  target = { wordIndex, letterIndex };

  initializeReplayPrompt();
  loadOldReplay();
}
