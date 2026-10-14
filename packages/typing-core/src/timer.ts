import { Config } from "@oxytype/schemas/configs";
import { CustomTextLimitMode } from "@oxytype/schemas/util";
import { roundTo2 } from "@oxytype/util/numbers";

export type TimerTick = {
  now: number;
  timer: number;
  drift?: number;
  catchup?: true;
};
export type TestTimer = {
  start: (now: number) => void;
  stop: () => void;
  advance: (now: number) => number | null;
  isRunning: () => boolean;
};

/** Clients schedule advance; the core anchors ticks to the start and catches up stalls. */
export function createTestTimer(deps: {
  onTick: (tick: TimerTick) => void;
  onDrift?: (drift: number) => void;
}): TestTimer {
  let startMs = 0;
  let emittedTicks = 0;
  let stopped = true;
  return {
    start(now) {
      startMs = now;
      emittedTicks = 0;
      stopped = false;
    },
    stop() {
      stopped = true;
    },
    isRunning: () => !stopped,
    advance(now) {
      if (stopped) return null;
      const expected = startMs + (emittedTicks + 1) * 1000;
      const drift = roundTo2(now - expected);
      if (drift < 0) return expected - now;
      deps.onDrift?.(drift);
      const ticksDue = Math.floor((now - startMs) / 1000);
      // onTick may synchronously stop the clock when the test ends.
      // oxlint-disable-next-line eslint/no-unmodified-loop-condition -- onTick can synchronously stop the clock through its closure.
      while (!stopped && emittedTicks + 1 < ticksDue) {
        emittedTicks++;
        deps.onTick({ now, timer: emittedTicks, catchup: true });
      }
      if (!stopped) {
        emittedTicks++;
        deps.onTick({ now, timer: emittedTicks, drift });
      }
      return stopped
        ? null
        : Math.max(0, startMs + (emittedTicks + 1) * 1000 - now);
    },
  };
}

export function getTimeLimit(
  config: Pick<Config, "mode" | "time">,
  custom?: { mode: CustomTextLimitMode; value: number },
): number | undefined {
  if (config.mode === "time") return config.time;
  if (config.mode === "custom" && custom?.mode === "time") return custom.value;
  return undefined;
}

export function getTimerFailure(
  config: Pick<
    Config,
    "minWpm" | "minWpmCustomSpeed" | "minAcc" | "minAccCustom"
  >,
  stats: { wpm: number; acc: number; wordIndex: number },
): "min speed" | "min accuracy" | undefined {
  if (
    config.minWpm === "custom" &&
    stats.wpm < config.minWpmCustomSpeed &&
    stats.wordIndex > 3
  ) {
    return "min speed";
  }
  if (config.minAcc === "custom" && stats.acc < config.minAccCustom) {
    return "min accuracy";
  }
  return undefined;
}
