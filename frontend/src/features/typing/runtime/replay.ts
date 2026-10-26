import { onCleanup } from "solid-js";
import { createTypingOwned } from "../scope";
import { getBrowserEngine } from "../engine.client";
import { decodeText, toEngineLog } from "@caret/typing-engine/text";
import type {
  BrowserReplay,
  Cursor,
  PlaybackSnapshot,
} from "@caret/typing-engine/browser.client";
import type { ReplayWord } from "../replay-view";
import { getWpmHistory } from "../analysis.client";
import * as Sound from "../../../ts/controllers/sound-controller";
import { getMutableConfig } from "../../../ts/config/store";
import { buildEventLog, getTestSession } from "./events/data";
import { resultState, setResultState } from "../../../ts/states/result";

function webWord(word: PlaybackSnapshot["words"][number]): ReplayWord {
  return {
    ...word,
    letters: word.letters.map((letter) => ({
      ...letter,
      char: decodeText(letter.char),
    })),
  };
}
/** Rust owns prompt mutations and seeking; the route owns timers, sound and display. */
const playback = createTypingOwned(() => {
  let replay: BrowserReplay | undefined;
  let times: number[] = [];
  let wpmHistory: number[] = [];
  let cursor: Cursor = { wordIndex: 0, letterIndex: 0 };
  let target: Cursor = { ...cursor };
  let timers: ReturnType<typeof setTimeout>[] = [];
  const stop = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };
  onCleanup(() => {
    stop();
    replay?.dispose();
  });
  const updateStats = (time: number): void => {
    setResultState(
      "replay",
      "stats",
      `${wpmHistory[time - 1] ?? 0}wpm\t${time}s`,
    );
  };
  const pause = (): void => {
    stop();
    target = { ...cursor };
    setResultState("replay", "playback", "paused");
  };
  const seek = (): PlaybackSnapshot | undefined => {
    const snapshot = replay?.seek(target);
    if (snapshot === undefined) return undefined;
    cursor = snapshot.cursor;
    setResultState("replay", "words", snapshot.words.map(webWord));
    if (snapshot.nextTime !== null) {
      updateStats(Math.max(0, Math.floor(snapshot.nextTime / 1000)));
    }
    return snapshot;
  };
  const refresh = (): void => {
    stop();
    replay?.dispose();
    const log = buildEventLog();
    replay = getBrowserEngine()
      .api()
      .createReplay(toEngineLog(log), getMutableConfig().mode === "zen");
    times = getTestSession()
      .getReplay()
      .steps.map((step) => step.time);
    wpmHistory = getWpmHistory(log);
    target = { wordIndex: 0, letterIndex: 0 };
  };
  const sound = (kind: string | null): void => {
    if (kind === null) return;
    if (kind === "error" && getMutableConfig().playSoundOnError !== "off") {
      void Sound.playError();
    } else {
      void Sound.playClick();
    }
  };
  return {
    pause,
    toggleDisplay: (): void => {
      if (!resultState.replay.visible) {
        refresh();
        seek();
        setResultState("replay", { visible: true, slideDuration: 250 });
      } else {
        if (resultState.replay.playback !== "start") pause();
        setResultState("replay", { visible: false, slideDuration: 250 });
      }
    },
    togglePlayback: (): void => {
      if (resultState.replay.playback === "playing") {
        pause();
        return;
      }
      stop();
      const snapshot = seek();
      if (snapshot?.nextTime === undefined || snapshot.nextTime === null) {
        return;
      }
      setResultState("replay", "playback", "playing");
      const lastTime = snapshot.nextTime;
      const end = times.at(-1) ?? lastTime;
      for (
        let second = Math.round(lastTime / 1000);
        second <= Math.round(end / 1000);
        second++
      ) {
        const time = second;
        timers.push(
          setTimeout(() => updateStats(time), time * 1000 - lastTime),
        );
      }
      for (const time of times.slice(snapshot.nextIndex)) {
        timers.push(
          setTimeout(() => {
            const update = replay?.step();
            if (update === undefined) return;
            cursor = update.cursor;
            for (const change of update.words) {
              setResultState(
                "replay",
                "words",
                change.index,
                webWord(change.word),
              );
            }
            sound(update.sound);
          }, time - lastTime),
        );
      }
      timers.push(
        setTimeout(() => {
          target = { wordIndex: 0, letterIndex: 0 };
          setResultState("replay", "playback", "start");
        }, end - lastTime),
      );
    },
    jump: (wordIndex: number, letterIndex: number): void => {
      pause();
      target = { wordIndex, letterIndex };
      seek();
    },
  };
});
export const pauseReplay = (): void => playback().pause();
export const toggleReplayDisplay = (): void => playback().toggleDisplay();
export const togglePlayback = (): void => playback().togglePlayback();
export const jumpToLetter = (wordIndex: number, letterIndex: number): void =>
  playback().jump(wordIndex, letterIndex);
