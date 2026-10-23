import { onCleanup } from "solid-js";
import { createTypingOwned } from "../scope";
import type { SessionEvents } from "./session.client";
import { getMutableConfig } from "../../../ts/config/store";
import { setConfig } from "../../../ts/config/setters";
import * as TestWords from "./test-words";
import {
  showNoticeNotification,
  showErrorNotification,
  removeNotification,
} from "../../../ts/states/notifications";
import * as Caret from "./caret";
import * as SlowTimer from "../../../ts/states/slow-timer";
import { highlight } from "../../../ts/events/keymap";
import * as LayoutfluidFunboxTimer from "./funbox/layoutfluid-funbox-timer";
import { KeymapLayout, Layout } from "@oxytype/schemas/configs";
import * as SoundController from "../../../ts/controllers/sound-controller";
import { clearLowFpsMode } from "../../../ts/anim";
import { createTimerScheduler } from "./timer-scheduler";
import { getCurrentInput, getTestSession } from "./events/data";
import { setCurrentLiveStats } from "../../../ts/states/test";
function createTiming(): {
  disableSlowTimerFail: typeof disableSlowTimerFail;
  enableTimerDebug: typeof enableTimerDebug;
  clear: typeof clear;
  start: typeof start;
} {
  const scheduler = createTimerScheduler(getTestSession().clock);
  let slowTimerNotifIds: number[] = [];
  function disableSlowTimerFail(): void {
    getTestSession().setRenderDriftMonitoring(false);
  }
  let timerDebug = false;
  function enableTimerDebug(): void {
    timerDebug = true;
  }
  function clear(): void {
    scheduler.stop();
    clearLowFpsMode();
  }
  function layoutfluid(time: number): void {
    if (timerDebug) console.time("layoutfluid");

    if (
      getMutableConfig().funbox.includes("layoutfluid") &&
      getMutableConfig().mode === "time"
    ) {
      const layouts = getMutableConfig().customLayoutfluid;
      const switchTime = getMutableConfig().time / layouts.length;
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

      if (getMutableConfig().layout !== layout && layout !== undefined) {
        LayoutfluidFunboxTimer.hide();
        setConfig("layout", layout as Layout, {
          nosave: true,
        });
        setConfig("keymapLayout", layout as KeymapLayout, {
          nosave: true,
        });

        if (getMutableConfig().keymapMode === "next") {
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
  function playTimeWarning(testTime: number): void {
    if (timerDebug) console.time("play timer warning");

    const maxTime = getTestSession().liveStats().timeLimitSeconds;

    if (
      maxTime !== null &&
      testTime === maxTime - parseInt(getMutableConfig().playTimeWarning, 10)
    ) {
      void SoundController.playTimeWarning();
    }
    if (timerDebug) console.timeEnd("play timer warning");
  }
  function timerStep(tick: SessionEvents["tick"]): void {
    if (timerDebug) console.time("timer step -----------------------------");

    // catch-up ticks only run the cheap per-second side effects
    if (tick.catchup !== true) {
      setCurrentLiveStats({
        wpm: tick.wpm,
        acc: tick.acc,
        raw: tick.raw,
        seconds: tick.seconds,
      });
    }
    if (getMutableConfig().playTimeWarning !== "off") {
      playTimeWarning(tick.timer);
    }
    layoutfluid(tick.timer);

    if (timerDebug) console.timeEnd("timer step -----------------------------");
  }
  function onFinish(reason: string | undefined): void {
    SlowTimer.clear();
    if (reason === "slow timer") {
      showNoticeNotification(
        'This could be caused by "efficiency mode" on Microsoft Edge.',
      );
      slowTimerNotifIds.push(
        showErrorNotification(
          "Stopping the test due to bad performance. This would cause test calculations to be incorrect. If this happens a lot, please report this.",
        ),
      );
    }
    if (reason === undefined) Caret.hide();
  }
  const unsubscribe = [
    getTestSession().on("tick", timerStep),
    getTestSession().on("finish", ({ reason }) => onFinish(reason)),
  ];
  onCleanup(() => {
    scheduler.stop();
    for (const off of unsubscribe) off();
  });
  function start(now: number): void {
    SlowTimer.clear();
    for (const id of slowTimerNotifIds) {
      removeNotification(id, "clear");
    }
    slowTimerNotifIds = [];
    scheduler.start(now);
  }
  return { disableSlowTimerFail, enableTimerDebug, clear, start };
}
const timing = createTypingOwned(createTiming);
export function disableSlowTimerFail(): void {
  timing().disableSlowTimerFail();
}
export function enableTimerDebug(): void {
  timing().enableTimerDebug();
}
export function clear(): void {
  timing().clear();
}
export function start(now: number): void {
  timing().start(now);
}
