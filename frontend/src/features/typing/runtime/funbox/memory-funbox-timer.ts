import { onCleanup } from "solid-js";
import { createTypingOwned } from "../../scope";
import { appObject } from "../../../../app/state";
import { setWordsWrapperVisible } from "../../../../ts/states/funbox";
import {
  setMemoryTimerText,
  setMemoryTimerVisibility,
} from "../../../../ts/states/funbox-timers";

const timerState = createTypingOwned(() => {
  const value = { timer: null as number | null, interval: null as ReturnType<typeof setInterval> | null };
  onCleanup(() => { if (value.interval !== null) clearInterval(value.interval); });
  return value;
});
const state = appObject(timerState);

function show(): void {
  setMemoryTimerVisibility("shown");
}

function hide(): void {
  setMemoryTimerVisibility("hidden");
}

export function reset(): void {
  if (state.interval !== null) {
    clearInterval(state.interval);
    state.interval = null;
  }
  state.timer = null;
  hide();
}

export function start(time: number): void {
  reset();
  state.timer = time;
  update(state.timer);
  show();
  state.interval = setInterval(() => {
    if (state.timer === null) return;
    state.timer -= 1;
    state.timer === 0 ? hide() : update(state.timer);
    if (state.timer <= 0) {
      reset();
      setWordsWrapperVisible(false);
    }
  }, 1000);
}

function update(sec: number): void {
  setMemoryTimerText(`Timer left to memorise all words: ${sec}s`);
}
