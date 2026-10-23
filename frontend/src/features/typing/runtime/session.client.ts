import { onCleanup } from "solid-js";
import { createAppOwned } from "../../../app/application";
import { getBrowserEngine } from "../engine.client";
import { projectEngineConfig } from "@oxytype/typing-engine/config";
import {
  decodeText,
  encodeText,
  toEngineEvent,
  toEngineLog,
  toWebEvent,
  toWebLog,
} from "@oxytype/typing-engine/text";
import type {
  WebLog,
  WebEvent,
  TransportEvent,
} from "@oxytype/typing-engine/text";
import type {
  Command,
  Update,
  Query,
  PaceCommand,
  PaceUpdate,
  Snapshot,
  BrowserSession,
  LiveMetrics,
  InsertionLayout,
} from "@oxytype/typing-engine/browser.client";
import { getMutableConfig } from "../../../ts/config/store";

type NativeState = Update["state"];
type Live = LiveMetrics;
type Tick = {
  now: number;
  timer: number;
  drift?: number;
  catchup?: boolean;
} & Pick<Live, "wpm" | "raw" | "acc" | "seconds">;
type SessionEvents = {
  tick: Tick;
  drift: { now: number; drift: number };
  finish: { reason?: string };
};
type Projection = (
  update: Update,
  command: Command,
  events: WebEvent[],
) => void;

/** Host projection/scheduling only: Rust retains every typing decision and score. */
export const getEngineSession = createAppOwned(() => {
  const owner = getBrowserEngine();
  const listeners: {
    [K in keyof SessionEvents]: Set<(event: SessionEvents[K]) => void>;
  } = {
    tick: new Set(),
    drift: new Set(),
    finish: new Set(),
  };
  const projections = new Set<Projection>();
  const inputs = new Map<number, string>();
  let state: NativeState | undefined;
  let metadata: Update["metadata"];
  let configuration = "";
  let lastTick = 0;
  let running = false;
  let finishNotified = false;
  let reason: string | undefined;
  let finishClock: { now: number; date: number } | undefined;
  let pace: PaceUpdate = { position: null, stepEnd: 0, lastWpm: 0 };
  const live = (): BrowserSession => {
    const session = owner.session();
    if (session === undefined) {
      throw new Error("Typing session is not prepared");
    }
    return session;
  };
  const emit = <K extends keyof SessionEvents>(
    kind: K,
    event: SessionEvents[K],
  ): void => {
    for (const listener of listeners[kind]) listener(event);
  };
  const consume = (update: Update, command: Command): Update => {
    const generation = owner.generation();
    state = update.state;
    if (update.metadata !== undefined) metadata = update.metadata;
    const events = update.events.map(toWebEvent);
    if (command.op === "reset") {
      inputs.clear();
      lastTick = 0;
      running = false;
      finishNotified = false;
      reason = undefined;
      finishClock = undefined;
    }
    for (const event of events) {
      if (event.type === "input") {
        inputs.set(event.data.wordIndex, event.data.inputValue);
        if (
          "clearedNextWord" in event.data &&
          event.data.clearedNextWord === true
        ) {
          inputs.delete(event.data.wordIndex + 1);
        }
      }
      if (event.type === "timer" && event.data.event === "step") {
        lastTick = event.data.timer;
      }
    }
    // Present the complete atomic command before finish side effects can replace it.
    for (const project of projections) project(update, command, events);
    if (owner.generation() !== generation) return update;
    if (update.drift !== undefined) {
      emit("drift", { now: command.now, drift: update.drift });
    }
    for (const event of events) {
      if (event.type === "timer" && event.data.event === "step") {
        emit("tick", {
          ...event.data,
          ...live().liveStats(command.now),
          now: command.now,
        });
      }
    }
    if (update.finish !== undefined && !finishNotified) {
      finishNotified = true;
      finishClock =
        command.op === "advance" ||
        command.op === "finish" ||
        command.op === "bailout"
          ? { now: command.now, date: command.date }
          : undefined;
      reason = update.finish.reason ?? undefined;
      running = false;
      emit("finish", { reason });
    }
    if (state.ended) {
      running = false;
      reason = state.reason ?? reason;
    }
    return update;
  };
  const synchronize = (now: number): void => {
    const config = projectEngineConfig(getMutableConfig());
    const serialized = JSON.stringify(config);
    if (serialized !== configuration) {
      const input: Command = { op: "configure", config, now };
      consume(live().command(input), input);
      configuration = serialized;
    }
  };
  const command = (input: Command): Update => {
    if (input.op !== "configure" && input.op !== "reset") {
      synchronize(input.now);
    }
    const update = consume(live().command(input), input);
    if (input.op === "configure") configuration = JSON.stringify(input.config);
    return update;
  };
  const paceCommand = (input: PaceCommand): PaceUpdate => {
    pace = live().pace(input);
    return pace;
  };
  onCleanup(() => {
    running = false;
    projections.clear();
    for (const group of Object.values(listeners)) group.clear();
    inputs.clear();
  });
  return {
    command,
    preflight: (data: string, layout: Partial<InsertionLayout> = {}) => {
      synchronize(performance.now());
      return live().preflight(encodeText(data), layout);
    },
    canDelete: (): boolean => {
      synchronize(performance.now());
      return live().canDelete();
    },
    wordBurst: (index: number, now: number): number =>
      live().wordBurst(index, now),
    /** Called once after owner.createPreparedSession, before input is enabled. */
    attach: (): Snapshot => {
      const snapshot = live().snapshot();
      state = snapshot.state;
      metadata = {
        allWordsGenerated: snapshot.allWordsGenerated,
        hasTab: snapshot.hasTab,
        hasNewline: snapshot.hasNewline,
      };
      inputs.clear();
      lastTick = 0;
      running = false;
      finishNotified = false;
      reason = undefined;
      finishClock = undefined;
      configuration = JSON.stringify(projectEngineConfig(getMutableConfig()));
      paceCommand({ op: "reset", wpm: null });
      command({
        op: "view",
        now: performance.now(),
        earliestVisibleWord: 0,
        deferAutomatic: true,
        deferFinish: true,
        monitorRenderDrift: true,
      });
      return snapshot;
    },
    state: () => state,
    metadata: () => metadata,
    compositionCompletes: (data: string): boolean => {
      synchronize(performance.now());
      return live().compositionCompletes(encodeText(data));
    },
    getCurrentInput: (): string =>
      state === undefined ? "" : decodeText(state.inputValue),
    getInputForWord: (index: number): string => inputs.get(index) ?? "",
    getFinishReason: (): string | undefined => reason,
    buildEventLog: (): WebLog => toWebLog(live().log()),
    analyze: <Q extends Query>(log: WebLog, query: Q) =>
      owner.api().analyze(toEngineLog(log), query),
    observe: (event: TransportEvent, now: number): Update =>
      command({
        op: "observe",
        now,
        eventType: event.type,
        eventData: toEngineEvent(event).data,
      }),
    subscribe: (project: Projection): (() => void) => {
      projections.add(project);
      return () => projections.delete(project);
    },
    on: <K extends keyof SessionEvents>(
      kind: K,
      listener: (event: SessionEvents[K]) => void,
    ): (() => void) => {
      listeners[kind].add(listener);
      return () => listeners[kind].delete(listener);
    },
    reset: (): void => {
      owner.invalidateSession();
      if (owner.session() !== undefined) {
        command({ op: "reset", now: performance.now() });
      }
    },
    start: (now: number): void => {
      command({ op: "start", now, date: Date.now() });
    },
    finish: (now: number, failure?: string): void => {
      command({ op: "finish", now, date: Date.now(), reason: failure ?? null });
    },
    end: (now: number): void => {
      owner.invalidateSession();
      const clock = finishClock ?? { now, date: Date.now() };
      if (finishNotified && !state?.ended) {
        command({ op: "acknowledgeFinish", ...clock });
      } else {
        command({ op: "end", ...clock });
      }
      finishClock = undefined;
    },
    finalize: (now = performance.now()): void => {
      command({ op: "finalize", now });
      inputs.clear();
      for (const event of live().log().events.map(toWebEvent)) {
        if (event.type === "input") {
          inputs.set(event.data.wordIndex, event.data.inputValue);
          if (
            "clearedNextWord" in event.data &&
            event.data.clearedNextWord === true
          ) {
            inputs.delete(event.data.wordIndex + 1);
          }
        }
      }
    },
    liveStats: (now = performance.now()): Live => live().liveStats(now),
    clock: {
      start: (_now: number): void => {
        running = true;
      },
      stop: (): void => {
        running = false;
      },
      isRunning: (): boolean => running,
      advance: (now: number): number | null => {
        if (!running) return null;
        command({ op: "advance", now, date: Date.now() });
        if (!running || state?.ended) return null;
        const start = live().liveStats(now).timerStartMs;
        return start === null
          ? null
          : Math.max(0, start + (lastTick + 1) * 1000 - now);
      },
    },
    pace: {
      reset: (wpm?: number): boolean => {
        if (owner.session() === undefined) return false;
        return paceCommand({ op: "reset", wpm: wpm ?? null }).position !== null;
      },
      start: (now: number): void => {
        paceCommand({ op: "start", now });
      },
      step: () => paceCommand({ op: "step" }).position,
      isEnabled: (): boolean => pace.position !== null,
      getStepEnd: (): number => pace.stepEnd,
      getLastWpm: (): number => pace.lastWpm,
      rememberWpm: (wpm: number, repeating: boolean): void => {
        paceCommand({ op: "remember", wpm, repeating });
      },
    },
  };
});
