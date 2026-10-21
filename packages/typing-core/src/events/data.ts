import {
  CompositionTestEvent,
  CompositionTestEventData,
  InputEvent,
  InputEventData,
  KeydownEvent,
  KeydownEventData,
  KeyupEvent,
  KeyupEventData,
  TestEvent,
  TestEventData,
  TestEventNoMs,
  TestEventType,
  TimerEvent,
  TimerEventData,
} from "./types";
import { getInputFromDom, keysToTrack } from "./helpers";
import { Keycode } from "../keys";
import { isSafeNumber, mean, roundTo2 } from "@oxytype/util/numbers";
import { createLiveCache } from "./live-cache";

export type EventRecorderDeps = {
  getActiveWordIndex: () => number;
  isResultCalculating?: () => boolean;
  liveCache: ReturnType<typeof createLiveCache>;
};
export type EventRecorder = {
  logTestEvent: (type: TestEventType, now: number, data: TestEventData) => void;
  getCurrentInput: () => string;
  getInputForWord: (index: number) => string;
  cleanupData: () => void;
  getAllTestEvents: () => TestEventNoMs[];
  logEventsDataToTheConsoleTable: () => void;
  resetTestEvents: () => void;
  forceReleaseAllKeys: () => void;
  __testing: { resetPressedKeys: () => void };
};
export function createEventRecorder(deps: EventRecorderDeps): EventRecorder {
  let keydownEvents: KeydownEvent[] = [];
  let keyupEvents: KeyupEvent[] = [];
  let timerEvents: TimerEvent[] = [];
  let inputEvents: InputEvent[] = [];
  const latestInputByWord = new Map<number, InputEvent>();
  let compositionEvents: CompositionTestEvent[] = [];

  let cachedAllEvents: TestEventNoMs[] | undefined;

  const sortTieRank = (type: TestEventType): number =>
    type === "keyup" ? 0 : type === "keydown" ? 1 : type === "timer" ? 3 : 2;

  let noCodeIndex = 0;
  let pressedKeys: Map<
    Keycode | "NoCode" | `NoCode${number}`,
    {
      timestamp: number;
    }
  > = new Map();

  function logTestEvent(
    type: TestEventType,
    now: number,
    eventData: TestEventData,
  ): void {
    invalidateCache();

    now = roundTo2(now);

    if (!isSafeNumber(now)) {
      throw new Error(`Invalid timestamp: ${now}`);
    }

    //strip undefined values from eventData
    eventData = Object.fromEntries(
      Object.entries(eventData).filter(([_, v]) => v !== undefined),
    ) as TestEventData;

    if (type === "keydown") {
      const data = eventData as KeydownEventData;
      const code = data.code as Keycode | "NoCode";

      if (!keysToTrack.has(code)) {
        return;
      }

      if (pressedKeys.has(code)) {
        pressedKeys.delete(code);
        keyupEvents.push({
          type: "keyup",
          ms: now,
          testMs: 0,
          data: { ...data, code },
        });
      }

      if (deps.isResultCalculating?.()) {
        return;
      }

      let key: Keycode | "NoCode" | `NoCode${number}` = code;
      if (key === "NoCode") {
        key = `NoCode${noCodeIndex}`;
        noCodeIndex++;
      }

      pressedKeys.set(key, {
        timestamp: now,
      });

      keydownEvents.push({
        type,
        ms: now,
        testMs: 0,
        data: { ...data, code: key },
      });
    } else if (type === "keyup") {
      const data = eventData as KeyupEventData;
      const code = data.code;

      let key: Keycode | "NoCode" | `NoCode${number}` = code;

      if (/^NoCode\d+$/.test(code)) {
        // already indexed (e.g. from forceReleaseAllKeys)
      } else {
        if (!keysToTrack.has(code as Keycode | "NoCode")) {
          return;
        }

        if (code === "NoCode") {
          key = `NoCode${noCodeIndex - 1}`;
          if (!pressedKeys.has(key)) {
            return;
          }
          noCodeIndex--;
        }
      }

      if (!pressedKeys.has(key)) {
        //not pressed - ignore
        return;
      }

      pressedKeys.delete(key);

      keyupEvents.push({
        type,
        ms: now,
        testMs: 0,
        data: { ...data, code: key },
      });
    } else if (type === "timer") {
      const event: TimerEvent = {
        type,
        ms: now,
        testMs: 0,
        data: eventData as TimerEventData,
      };
      timerEvents.push(event);
      deps.liveCache.recordEventForCache(event);
    } else if (type === "input") {
      const event: InputEvent = {
        type,
        ms: now,
        testMs: 0,
        data: eventData as InputEventData,
      };
      inputEvents.push(event);
      indexInput(event);
      deps.liveCache.recordEventForCache(event);
    } else if (type === "composition") {
      compositionEvents.push({
        type,
        ms: now,
        testMs: 0,
        data: eventData as CompositionTestEventData,
      });
    } else {
      throw new Error(`Unsupported event type: ${type}`);
    }
  }

  function invalidateCache(): void {
    cachedAllEvents = undefined;
  }

  function indexInput(event: InputEvent): void {
    const previous = latestInputByWord.get(event.data.wordIndex);
    // Match the stable chronological order used by getAllTestEvents, even
    // when an older timestamp is recorded after a newer event.
    if (previous === undefined || previous.ms <= event.ms) {
      latestInputByWord.set(event.data.wordIndex, event);
    }
  }

  function getCurrentInput(): string {
    const last = inputEvents[inputEvents.length - 1];

    if (last !== undefined) {
      const lastWordIndex = last.data.wordIndex;
      //just advanced to a new word - no input event for it yet
      if (lastWordIndex + 1 === deps.getActiveWordIndex()) return "";
      //last event is for the active word - return its snapshot
      if (
        lastWordIndex === deps.getActiveWordIndex() &&
        last.data.inputValue !== undefined
      ) {
        return last.data.inputValue;
      }
    }

    return getInputForWord(deps.getActiveWordIndex());
  }

  function getInputForWord(wordIndex: number): string {
    const latest = latestInputByWord.get(wordIndex);
    return latest === undefined ? "" : getInputFromDom([latest]);
  }

  function cleanupData(): void {
    const timerStart = timerEvents.find((e) => e.data.event === "start");
    const timerEnd = timerEvents.find((e) => e.data.event === "end");

    if (timerStart !== undefined) {
      // keep only the last pre-start keydown; drop all pre-start keyups
      let lastPreStartKeydown: KeydownEvent | undefined;
      for (const e of keydownEvents) {
        if (e.ms < timerStart.ms) lastPreStartKeydown = e;
        else break;
      }
      keydownEvents = keydownEvents.filter(
        (e) => e.ms >= timerStart.ms || e === lastPreStartKeydown,
      );
      keyupEvents = keyupEvents.filter((e) => e.ms >= timerStart.ms);
    }

    if (timerEnd !== undefined) {
      inputEvents = inputEvents.filter((e) => e.ms <= timerEnd.ms);
      latestInputByWord.clear();
      for (const event of inputEvents) indexInput(event);
      const postEndKeydownCodes = new Set(
        keydownEvents.filter((e) => e.ms > timerEnd.ms).map((e) => e.data.code),
      );
      keydownEvents = keydownEvents.filter((e) => e.ms <= timerEnd.ms);
      keyupEvents = keyupEvents.filter(
        (e) => e.ms <= timerEnd.ms || !postEndKeydownCodes.has(e.data.code),
      );
      recomputeLiveCache();
    }

    invalidateCache();
  }

  function recomputeLiveCache(): void {
    deps.liveCache.resetLiveCache();
    for (const e of inputEvents) deps.liveCache.recordEventForCache(e);
    for (const e of timerEvents) deps.liveCache.recordEventForCache(e);
  }

  function getAllTestEvents(): TestEventNoMs[] {
    if (cachedAllEvents !== undefined) return cachedAllEvents;

    const total =
      keydownEvents.length +
      keyupEvents.length +
      timerEvents.length +
      inputEvents.length +
      compositionEvents.length;

    if (total === 0) {
      cachedAllEvents = [];
      return cachedAllEvents;
    }

    const firstEventMs = Math.min(
      ...[
        keydownEvents[0]?.ms,
        keyupEvents[0]?.ms,
        timerEvents[0]?.ms,
        inputEvents[0]?.ms,
        compositionEvents[0]?.ms,
      ].filter((ms): ms is number => ms !== undefined),
    );

    const startEventMs =
      timerEvents.find((e) => e.data.event === "start")?.ms ?? firstEventMs;

    if (!isSafeNumber(startEventMs)) {
      throw new Error(`Invalid startEventMs: ${startEventMs}`);
    }

    const merged = new Array<TestEvent>(total);
    let p = 0;
    for (const e of keydownEvents) merged[p++] = e;
    for (const e of keyupEvents) merged[p++] = e;
    for (const e of timerEvents) merged[p++] = e;
    for (const e of inputEvents) merged[p++] = e;
    for (const e of compositionEvents) merged[p++] = e;

    cachedAllEvents = merged
      .sort((a, b) => a.ms - b.ms || sortTieRank(a.type) - sortTieRank(b.type))
      .map(
        (event) =>
          ({
            type: event.type,
            testMs: roundTo2(event.ms - startEventMs),
            data: event.data,
          }) as TestEventNoMs,
      );

    return cachedAllEvents;
  }

  function logEventsDataToTheConsoleTable(): void {
    console.table(
      getAllTestEvents().map((event) => {
        const d = event.data;
        let e: Record<string, unknown> = {
          ...event,
          ...event.data,
        };
        delete e["data"];
        e = {
          ...e,
          ...d,
        };
        return e;
      }),
    );
  }

  function resetTestEvents(): void {
    keydownEvents = [];
    keyupEvents = [];
    timerEvents = [];
    inputEvents = [];
    latestInputByWord.clear();
    compositionEvents = [];
    invalidateCache();
    pressedKeys = new Map();
    noCodeIndex = 0;
    deps.liveCache.resetLiveCache();
  }

  function forceReleaseAllKeys(): void {
    const keydownMsByCode = new Map<string, number>();
    for (const e of keydownEvents) keydownMsByCode.set(e.data.code, e.ms);

    const durations: number[] = [];
    for (const e of keyupEvents) {
      const downMs = keydownMsByCode.get(e.data.code);
      if (downMs === undefined) continue;
      const d = e.ms - downMs;
      if (d > 0) durations.push(d);
      keydownMsByCode.delete(e.data.code);
    }

    // empty → test ended with all keys still held; will be "too short" anyway, magic number is fine
    const avg = durations.length === 0 ? 80 : roundTo2(mean(durations));

    for (const [key, { timestamp }] of pressedKeys.entries()) {
      logTestEvent("keyup", timestamp + avg, {
        code: key, //entries is not picking up the type
        estimated: true,
      });
    }
  }

  const __testing = {
    resetPressedKeys(): void {
      pressedKeys = new Map();
      noCodeIndex = 0;
    },
  };

  return {
    logTestEvent,
    getCurrentInput,
    getInputForWord,
    cleanupData,
    getAllTestEvents,
    logEventsDataToTheConsoleTable,
    resetTestEvents,
    forceReleaseAllKeys,
    __testing,
  };
}
