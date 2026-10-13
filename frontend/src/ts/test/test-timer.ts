import {
  createTestTimer,
  getTimeLimit,
  getTimerFailure,
} from "@oxytype/typing-core/timer";
//most of the code is thanks to
//https://stackoverflow.com/questions/29971898/how-to-create-an-accurate-timer-in-javascript

import { Config } from "../config/store";
import { setConfig } from "../config/setters";
import * as CustomText from "./custom-text";
import * as TestWords from "./test-words";
import {
  showNoticeNotification,
  showErrorNotification,
  removeNotification,
} from "../states/notifications";
import * as Caret from "./caret";
import * as SlowTimer from "../states/slow-timer";
import { timerEvent } from "../events/timer";
import { highlight } from "../events/keymap";
import * as LayoutfluidFunboxTimer from "../test/funbox/layoutfluid-funbox-timer";
import { KeymapLayout, Layout } from "@oxytype/schemas/configs";
import * as SoundController from "../controllers/sound-controller";
import { clearLowFpsMode, setLowFpsMode } from "../anim";
import { createTimerScheduler } from "./timer-scheduler";
import { buildEventLog, getCurrentInput, logTestEvent } from "./events/data";
import { roundTo2 } from "@oxytype/util/numbers";
import {
  getLiveCachedAccuracy,
  getLiveCachedTestDurationMs,
  getLiveCachedTestSeconds,
} from "./events/live-cache";
import { getChars } from "@oxytype/typing-core/events/stats";
import { calculateWpm } from "@oxytype/typing-core/stats-math";
import {
  getActiveWordIndex,
  isTestActive,
  setCurrentLiveStats,
} from "../states/test";

const clock = createTestTimer({
  onDrift: checkIfTimerIsSlow,
  onTick: (tick) => {
    timerStep(tick.now, tick.catchup === true, tick.timer);
    logTestEvent("timer", tick.now, {
      event: "step",
      timer: tick.timer,
      slowTimer: SlowTimer.get() ? true : undefined,
      catchup: tick.catchup,
      drift: tick.drift,
    });
  },
});
const scheduler = createTimerScheduler(clock);
import.meta.hot?.dispose(scheduler.stop);

type TimerStats = {
  dateNow: number;
  now: number;
  expected: number;
  nextDelay: number;
};

let slowTimerCount = 0;
let slowTimerNotifIds: number[] = [];
let timer: NodeJS.Timeout | null = null;
const interval = 1000;
let expected = 0;

let slowTimerFailEnabled = true;
export function disableSlowTimerFail(): void {
  slowTimerFailEnabled = false;
}

let timerDebug = false;
export function enableTimerDebug(): void {
  timerDebug = true;
}

export function clear(logEnd = false, now = performance.now()): void {
  scheduler.stop();
  clearLowFpsMode();
  if (timer !== null) clearTimeout(timer);
  if (logEnd) {
    logTestEvent("timer", now, {
      event: "end",
      timer: getLiveCachedTestSeconds(now),
      date: new Date().getTime(),
    });
  }
}

function layoutfluid(time: number): void {
  if (timerDebug) console.time("layoutfluid");

  if (Config.funbox.includes("layoutfluid") && Config.mode === "time") {
    const layouts = Config.customLayoutfluid;
    const switchTime = Config.time / layouts.length;
    const index = Math.floor(time / switchTime);
    const layout = layouts[index];
    const flooredSwitchTimes = [];

    for (let i = 1; i < layouts.length; i++) {
      flooredSwitchTimes.push(Math.floor(switchTime * i));
    }

    if (flooredSwitchTimes.includes(time + 3)) {
      LayoutfluidFunboxTimer.show();
      LayoutfluidFunboxTimer.updateTime(3, layouts[index + 1] as string);
    } else if (flooredSwitchTimes.includes(time + 2)) {
      LayoutfluidFunboxTimer.updateTime(2, layouts[index + 1] as string);
    } else if (flooredSwitchTimes.includes(time + 1)) {
      LayoutfluidFunboxTimer.updateTime(1, layouts[index + 1] as string);
    }

    if (Config.layout !== layout && layout !== undefined) {
      LayoutfluidFunboxTimer.hide();
      setConfig("layout", layout as Layout, {
        nosave: true,
      });
      setConfig("keymapLayout", layout as KeymapLayout, {
        nosave: true,
      });

      if (Config.keymapMode === "next") {
        setTimeout(() => {
          highlight(
            TestWords.words
              .getCurrent()
              ?.text.charAt(getCurrentInput().length) ?? "",
          );
        }, 1);
      }
    }
  }
  if (timerDebug) console.timeEnd("layoutfluid");
}

function checkIfFailed(
  wpmAndRaw: { wpm: number; raw: number },
  acc: number,
): boolean {
  if (timerDebug) console.time("fail conditions");
  const reason = getTimerFailure(Config, {
    wpm: wpmAndRaw.wpm,
    acc,
    wordIndex: getActiveWordIndex(),
  });
  if (reason !== undefined) {
    if (timer !== null) clearTimeout(timer);
    SlowTimer.clear();
    slowTimerCount = 0;
    timerEvent.dispatch({ key: "fail", value: reason });
    return true;
  }
  if (timerDebug) console.timeEnd("fail conditions");
  return false;
}

function checkIfTimeIsUp(testTime: number): void {
  if (timerDebug) console.time("times up check");

  const maxTime = getTimeLimit(Config, CustomText.getLimit());
  if (maxTime !== undefined && maxTime !== 0 && testTime >= maxTime) {
    //times up
    if (timer !== null) clearTimeout(timer);
    Caret.hide();
    SlowTimer.clear();
    slowTimerCount = 0;
    timerEvent.dispatch({ key: "finish" });
    return;
  }

  if (timerDebug) console.timeEnd("times up check");
}

function playTimeWarning(testTime: number): void {
  if (timerDebug) console.time("play timer warning");

  const maxTime = getTimeLimit(Config, CustomText.getLimit());

  if (
    maxTime !== undefined &&
    testTime === maxTime - parseInt(Config.playTimeWarning, 10)
  ) {
    void SoundController.playTimeWarning();
  }
  if (timerDebug) console.timeEnd("play timer warning");
}

// ---------------------------------------

let timerStats: TimerStats[] = [];

export function getTimerStats(): TimerStats[] {
  return timerStats;
}

function timerStep(now: number, catchingUp: boolean, testTime: number): void {
  if (timerDebug) console.time("timer step -----------------------------");

  if (catchingUp) {
    // cheap per-tick side effects — must run for every missed tick during catch-up
    // so warnings/layout switches still fire on the correct seconds
    if (Config.playTimeWarning !== "off") playTimeWarning(testTime);
    layoutfluid(testTime);
    checkIfTimeIsUp(testTime);
  } else {
    //calc — only the final, real-time tick pays for these
    const eventLog = buildEventLog();

    const chars = getChars(eventLog, true);

    const currentTestDurationMs = getLiveCachedTestDurationMs(now);
    const acc = getLiveCachedAccuracy();
    const wpmAndRaw = {
      wpm: Math.round(
        calculateWpm(chars.correctWord, currentTestDurationMs / 1000),
      ),
      raw: Math.round(
        calculateWpm(
          chars.allCorrect + chars.extra + chars.incorrect,
          currentTestDurationMs / 1000,
        ),
      ),
    };

    setCurrentLiveStats({
      wpm: wpmAndRaw.wpm,
      acc,
      raw: wpmAndRaw.raw,
      seconds: getLiveCachedTestSeconds(now),
    });

    //logic
    if (Config.playTimeWarning !== "off") playTimeWarning(testTime);
    layoutfluid(testTime);
    const failed = checkIfFailed(wpmAndRaw, acc);
    if (!failed) checkIfTimeIsUp(testTime);
  }

  if (timerDebug) console.timeEnd("timer step -----------------------------");
}

function checkIfTimerIsSlow(drift: number): void {
  if (!slowTimerFailEnabled) return;
  if (
    (Config.mode === "time" && Config.time < 130 && Config.time > 0) ||
    (Config.mode === "words" && Config.words < 250 && Config.words > 0)
  ) {
    if (drift > 125) {
      //slow timer
      SlowTimer.set();
      setLowFpsMode();
    }
    if (drift > 250) {
      slowTimerCount++;
    }

    if (drift > 500 || slowTimerCount > 5) {
      //slow timer

      showNoticeNotification(
        'This could be caused by "efficiency mode" on Microsoft Edge.',
      );

      slowTimerNotifIds.push(
        showErrorNotification(
          "Stopping the test due to bad performance. This would cause test calculations to be incorrect. If this happens a lot, please report this.",
        ),
      );

      timerEvent.dispatch({ key: "fail", value: "slow timer" });
    }
  }
}

export async function start(now: number): Promise<void> {
  SlowTimer.clear();
  slowTimerCount = 0;
  for (const id of slowTimerNotifIds) {
    removeNotification(id, "clear");
  }
  slowTimerNotifIds = [];
  void _startNew(now);
  // void _startOld(now);
}

async function _startNew(now: number): Promise<void> {
  scheduler.start(now);
  logTestEvent("timer", now, {
    event: "start",
    timer: 0,
    date: new Date().getTime(),
  });
}

async function _startOld(now: number): Promise<void> {
  timerStats = [];
  expected = now + interval;
  logTestEvent("timer", now, {
    event: "start",
    timer: 0,
    date: new Date().getTime(),
  });
  (function loop(): void {
    const delay = expected - performance.now();
    timerStats.push({
      dateNow: Date.now(),
      now: performance.now(),
      expected: expected,
      nextDelay: delay,
    });
    const drift = roundTo2(Math.abs(interval - delay));
    checkIfTimerIsSlow(drift);
    timer = setTimeout(function () {
      if (!isTestActive()) {
        if (timer !== null) clearTimeout(timer);
        SlowTimer.clear();
        slowTimerCount = 0;
        return;
      }

      const now = performance.now();

      logTestEvent("timer", now, {
        event: "step",
        timer: getLiveCachedTestSeconds(now),
        drift: drift,
        slowTimer: SlowTimer.get() ? true : undefined,
      });

      timerStep(now, false, getLiveCachedTestSeconds(now));

      expected += interval;
      loop();
    }, delay);
  })();
}
