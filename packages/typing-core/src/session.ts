import { getFunboxObject } from "@oxytype/funbox";
import { Config } from "@oxytype/schemas/configs";
import { LanguageObject } from "@oxytype/schemas/languages";
import { buildCompletedEvent, CompletedEventContext } from "./completed-event";
import { createEventRecorder, EventRecorder } from "./events/data";
import { createLiveCache, LiveCache } from "./events/live-cache";
import {
  EventLog,
  EventLogContext,
  EVENT_LOG_VERSION,
  InputEventData,
  TestEventType,
  TestEventData,
} from "./events/types";
import {
  getChars,
  getIncompleteTestSeconds,
  getWordBurst,
} from "./events/stats";
import { InputConfig } from "./input/config";
import {
  canDelete,
  evaluateInsert,
  getPreviousWordInput,
  shouldBlockInsertion,
} from "./input/engine";
import { DeleteInputType } from "./input/input-type";
import {
  checkIfFailedDueToDifficulty,
  checkIfFailedDueToMinBurst,
  checkIfFinished,
} from "./input/fail-or-finish";
import { getCommitCharacterType } from "./input/util";
import { getMode2 } from "./mode";
import { PaceTracker } from "./pace-caret";
import { getReplaySteps, getReplayWords, ReplayStep } from "./replay";
import { calculateWpm } from "./stats-math";
import { hasKoreanCharacters } from "./strings";
import {
  createTestTimer,
  getTimeLimit,
  getTimerFailure,
  TestTimer,
  TimerTick,
} from "./timer";
import {
  GenerateWordsReturn,
  GetNextWordReturn,
  WordsGenerator,
} from "./words-generator";
import { createWeakSpot } from "./weak-spot";

export type SessionConfig = InputConfig &
  CompletedEventContext["config"] &
  Pick<Config, "minWpm" | "minWpmCustomSpeed" | "minAcc" | "minAccCustom">;
export type LiveStats = {
  wpm: number;
  raw: number;
  acc: number;
  seconds: number;
};
export type SessionEvents = {
  word: { index: number; word: string };
  input: InputEventData;
  tick: TimerTick & LiveStats;
  drift: { now: number; drift: number };
  finish: { eventLog: EventLog; reason?: string };
};
export type TestSessionDeps = {
  words?: string[];
  weakSpot?: ReturnType<typeof createWeakSpot>;
  getContext?: () => EventLogContext;
  getActiveWordIndex?: () => number;
  isResultCalculating?: () => boolean;
  liveCache?: LiveCache;
  dateNow?: () => number;
  nospace?: () => boolean;
  customLimit?: () => { mode: "time" | "word" | "section"; value: number };
  allWordsGenerated?: () => boolean;
  generator?: WordsGenerator;
  getCurrentQuote?: () => { id: number } | null;
  /** Flags timer steps that ran while the client was rendering slowly. */
  isSlowTimer?: () => boolean;
};

/** Headless state and events. Clients own scheduling, rendering, storage and transport. */
export class TestSession {
  public readonly recorder: EventRecorder;
  public readonly liveCache: LiveCache;
  public readonly weakSpot: ReturnType<typeof createWeakSpot>;
  public readonly pace = new PaceTracker();
  private readonly getConfig: () => SessionConfig;
  private readonly deps: TestSessionDeps;
  /** Clients schedule `advance`; the session owns start, stop and ticks. */
  public readonly clock: TestTimer;
  private words: string[];
  private wordIndex = 0;
  private active = false;
  private ended = false;
  private finishReason: string | undefined;
  private readonly listeners: {
    [K in keyof SessionEvents]: Set<(event: SessionEvents[K]) => void>;
  } = {
    word: new Set(),
    input: new Set(),
    tick: new Set(),
    drift: new Set(),
    finish: new Set(),
  };

  constructor(
    config: SessionConfig | (() => SessionConfig),
    deps: TestSessionDeps,
  ) {
    this.weakSpot = deps.weakSpot ?? createWeakSpot();
    this.getConfig = typeof config === "function" ? config : () => config;
    this.deps = deps;
    this.words = [...(deps.words ?? [])];
    this.liveCache = deps.liveCache ?? createLiveCache();
    this.recorder = createEventRecorder({
      getActiveWordIndex: () => this.getActiveWordIndex(),
      isResultCalculating: deps.isResultCalculating,
      liveCache: this.liveCache,
    });
    this.clock = createTestTimer({
      onTick: (tick) => this.tick(tick),
      onDrift: (drift, now) => this.emit("drift", { now, drift }),
    });
  }

  on<K extends keyof SessionEvents>(
    type: K,
    listener: (event: SessionEvents[K]) => void,
  ): () => void {
    this.listeners[type].add(listener);
    return () => {
      this.listeners[type].delete(listener);
    };
  }

  private emit<K extends keyof SessionEvents>(
    type: K,
    event: SessionEvents[K],
  ): void {
    for (const listener of this.listeners[type]) listener(event);
  }

  getActiveWordIndex(): number {
    return this.deps.getActiveWordIndex?.() ?? this.wordIndex;
  }
  getWords(): string[] {
    return [...this.words];
  }
  isActive(): boolean {
    return this.active;
  }
  setWords(words: string[]): void {
    this.words = [...words];
    words.forEach((word, index) => this.emit("word", { index, word }));
  }
  appendWord(word: string): void {
    this.words.push(word);
    this.emit("word", { index: this.words.length - 1, word });
  }

  async generate(
    language: LanguageObject,
    generator = this.deps.generator,
  ): Promise<GenerateWordsReturn> {
    if (!generator) throw new Error("Session needs a words generator");
    const generated = await generator.generateWords(language);
    this.setWords(generated.words);
    if (generator.areAllWordsGenerated()) {
      this.words[this.words.length - 1] =
        this.words.at(-1)?.replace(/[ \n]$/, "") ?? "";
    }
    return generated;
  }

  async nextWord(
    index: number,
    bound: number,
    previous?: string,
    previous2?: string,
    generator = this.deps.generator,
  ): Promise<GetNextWordReturn> {
    if (!generator) throw new Error("Session needs a words generator");
    const next = await generator.getNextWord(index, bound, previous, previous2);
    this.appendWord(next.word);
    return next;
  }

  buildEventLog(): EventLog {
    const config = this.getConfig();
    return {
      version: EVENT_LOG_VERSION,
      events: this.recorder.getAllTestEvents(),
      context: this.deps.getContext?.() ?? {
        targetWords: [...this.words],
        mode: config.mode,
        mode2: getMode2(config, this.deps.getCurrentQuote?.() ?? null),
        koreanStatus: this.words.some(hasKoreanCharacters),
        bailedOut: false,
        customTextLimitMode: this.deps.customLimit?.().mode,
        customTextLimitValue: this.deps.customLimit?.().value,
        isFunboxWithNospacePropertyActive: this.isNospace(),
      },
    };
  }

  /** Replay steps for the finished test, read from its event log. */
  getReplay(): { words: string[]; steps: ReplayStep[] } {
    const log = this.buildEventLog();
    const zen = this.getConfig().mode === "zen";
    return {
      words: getReplayWords(log, zen),
      steps: getReplaySteps(log, zen),
    };
  }

  record(type: TestEventType, now: number, data: TestEventData): void {
    this.recorder.logTestEvent(type, now, data);
  }
  start(now: number, logTimer = true): void {
    if (this.active || this.ended) return;
    this.active = true;
    this.clock.start(now);
    this.pace.start(now);
    if (logTimer) {
      this.record("timer", now, {
        event: "start",
        timer: 0,
        date: this.deps.dateNow?.() ?? Date.now(),
      });
    }
  }
  reset(): void {
    this.clock.stop();
    this.active = false;
    this.ended = false;
    this.wordIndex = 0;
    this.finishReason = undefined;
    this.pace.reset();
    this.recorder.resetTestEvents();
  }
  advance(now: number): number | null {
    return this.clock.advance(now);
  }
  /** Ends the test without notifying finish listeners. */
  end(now: number): boolean {
    if (!this.active || this.ended) return false;
    this.active = false;
    this.ended = true;
    this.clock.stop();
    this.record("timer", now, {
      event: "end",
      timer: this.liveCache.getLiveCachedTestSeconds(now),
      date: this.deps.dateNow?.() ?? Date.now(),
    });
    return true;
  }
  finish(now: number, reason?: string): void {
    if (!this.end(now)) return;
    this.finishReason = reason;
    this.emit("finish", { eventLog: this.buildEventLog(), reason });
  }
  /** Why the last test failed, until the next reset. */
  getFinishReason(): string | undefined {
    return this.finishReason;
  }
  /** Ends a test the user restarted and measures it as an incomplete test. */
  abandon(now: number): { acc: number; seconds: number } {
    this.end(now);
    return {
      acc: this.liveCache.getLiveCachedAccuracy(),
      seconds: getIncompleteTestSeconds(this.buildEventLog()),
    };
  }
  complete(
    eventLog: EventLog,
    context: CompletedEventContext,
  ): ReturnType<typeof buildCompletedEvent> {
    const shouldEmit = !this.ended;
    this.active = false;
    this.ended = true;
    this.clock.stop();
    const completed = buildCompletedEvent(eventLog, context);
    if (shouldEmit) this.emit("finish", { eventLog });
    return completed;
  }

  private isNospace(): boolean {
    return (
      this.deps.nospace?.() ??
      this.getConfig().funbox.some((name) =>
        getFunboxObject()[name].properties?.includes("nospace"),
      )
    );
  }

  private tick(tick: TimerTick): void {
    this.record("timer", tick.now, {
      event: "step",
      timer: tick.timer,
      drift: tick.drift,
      slowTimer: this.deps.isSlowTimer?.() === true ? true : undefined,
      catchup: tick.catchup,
    });
    const log = this.buildEventLog();
    const chars = getChars(log, true);
    const seconds = this.liveCache.getLiveCachedTestDurationMs(tick.now) / 1000;
    const stats = {
      wpm: Math.round(calculateWpm(chars.correctWord, seconds)),
      raw: Math.round(
        calculateWpm(chars.allCorrect + chars.extra + chars.incorrect, seconds),
      ),
      acc: this.liveCache.getLiveCachedAccuracy(),
      seconds: tick.timer,
    };
    this.emit("tick", { ...tick, ...stats });
    const config = this.getConfig();
    const failure = tick.catchup
      ? undefined
      : getTimerFailure(config, {
          ...stats,
          wordIndex: this.getActiveWordIndex(),
        });
    const limit = getTimeLimit(config, this.deps.customLimit?.());
    if (failure || (limit !== undefined && limit > 0 && tick.timer >= limit)) {
      this.finish(tick.now, failure);
    }
  }

  async insert(
    data: string,
    now: number,
    options: {
      correctShiftUsed?: boolean | null;
      automatic?: true;
      isCompositionEnding?: true;
    } = {},
  ): Promise<void> {
    if (this.ended) return;
    // Preserve the web's UTF-16 input indices and per-character multi-input events.
    for (let i = 0; i < data.length && !this.ended; i++) {
      await this.insertChar(data[i] as string, now, options);
    }
  }

  private async insertChar(
    data: string,
    now: number,
    options: {
      correctShiftUsed?: boolean | null;
      automatic?: true;
      isCompositionEnding?: true;
    },
  ): Promise<void> {
    const config = this.getConfig();
    const index = this.wordIndex;
    const input = this.recorder.getCurrentInput();
    const target = this.words[index] ?? "";
    const nospace = this.isNospace();
    const hasNewline = this.words.some((word) => word.includes("\n"));
    if (
      shouldBlockInsertion(config, {
        data,
        inputValue: input,
        targetWord: target,
        nospace,
        hasNewline,
      })
    ) {
      return;
    }
    const override =
      data === "…"
        ? "..."
        : config.language.startsWith("dutch") && data === "ĳ"
          ? "ij"
          : undefined;
    if (override !== undefined && target[input.length] !== data) {
      await this.insert(override, now, options);
      return;
    }
    this.start(now);
    const decision = evaluateInsert(config, {
      data,
      inputValue: input,
      targetWord: target,
      nospace,
      ...options,
    });
    const event: InputEventData = {
      inputType: "insertText",
      data: decision.data,
      correct: decision.correct,
      wordIndex: index,
      charIndex: input.length,
      inputValue: decision.inputValue,
      inputStopped: decision.stopped ? true : undefined,
      commitsWord: decision.advance ? true : undefined,
      lastWord: index === this.words.length - 1 ? true : undefined,
      automatic: options.automatic,
      isCompositionEnding: options.isCompositionEnding,
    };
    this.record("input", now, event);
    this.emit("input", event);
    if (decision.advance) {
      this.pace.correct(
        index,
        decision.inputValue === target,
        target,
        config.blindMode,
      );
    }
    this.weakSpot.updateScore(
      decision.data,
      decision.correct,
      this.liveCache.getLiveCachedMsSinceLastInputEvent(),
    );
    if (
      !decision.correct &&
      !decision.stopped &&
      config.deleteOnError !== "off"
    ) {
      this.deleteOnError(now);
    }
    const burst = decision.advance
      ? getWordBurst(this.buildEventLog(), index, now)
      : null;
    const allTyped = index >= this.words.length - 1;
    const custom = this.deps.customLimit?.();
    const allGenerated =
      this.deps.allWordsGenerated?.() ??
      this.deps.generator?.areAllWordsGenerated() ??
      (config.mode !== "time" &&
        config.mode !== "zen" &&
        !(config.mode === "words" && config.words === 0) &&
        !(
          config.mode === "custom" &&
          custom !== undefined &&
          (custom.mode === "time" || custom.value === 0)
        ));
    const commitCharacterType = getCommitCharacterType(
      { data: decision.data, inputValue: input, targetWord: target },
      nospace,
    );
    if (
      checkIfFailedDueToDifficulty(
        {
          data: decision.data,
          testInput: input,
          targetWord: target,
          correct: decision.correct,
          commitCharacterType,
        },
        config,
      )
    ) {
      this.finish(now, "difficulty");
      return;
    }
    if (
      decision.advance &&
      checkIfFailedDueToMinBurst(
        {
          testInputWithData: input + decision.data,
          currentWord: target,
          lastBurst: burst,
        },
        config,
      )
    ) {
      this.finish(now, "min burst");
      return;
    }
    if (
      checkIfFinished(
        {
          goingToNextWord: decision.advance,
          testInputWithData: input + decision.data,
          currentWord: target,
          allWordsTyped: allTyped,
          allWordsGenerated: allGenerated,
        },
        config,
      )
    ) {
      this.finish(now);
      return;
    }
    if (decision.advance) {
      if (allTyped && this.deps.generator && !allGenerated) {
        await this.nextWord(
          this.words.length,
          100,
          target.replace(/[ \n]$/, ""),
          this.words.at(-2)?.replace(/[ \n]$/, ""),
        );
      }
      if (!allTyped || config.mode === "zen" || this.words.length > index + 1) {
        this.wordIndex++;
        this.emit("word", {
          index: this.wordIndex,
          word: this.words[this.wordIndex] ?? "",
        });
      }
    }
    const nextTarget = this.words[this.wordIndex] ?? "";
    if (
      config.language.startsWith("code") &&
      decision.correct &&
      /^\t+/.test(nextTarget) &&
      nextTarget[this.recorder.getCurrentInput().length] === "\t"
    ) {
      await this.insert("\t", now, { automatic: true });
    }
  }

  delete(type: DeleteInputType, now: number): void {
    if (!this.active || this.ended) return;
    const config = this.getConfig();
    const input = this.recorder.getCurrentInput();
    const previousInput = this.recorder.getInputForWord(this.wordIndex - 1);
    if (
      !canDelete(config, {
        inputValue: input,
        wordIndex: this.wordIndex,
        previousWordCorrect: previousInput === this.words[this.wordIndex - 1],
        previousWordAvailable: this.wordIndex > 0,
      })
    ) {
      return;
    }
    const unindent =
      config.language.startsWith("code") &&
      config.codeUnindentOnBackspace &&
      input.length > 0 &&
      /^\t*$/.test(input) &&
      this.words[this.wordIndex]?.startsWith(input);
    if (unindent) this.logDelete("deleteWordBackward", now, input.length, "");
    if (input === "" || unindent) {
      this.wordIndex = Math.max(0, this.wordIndex - 1);
      const restored = getPreviousWordInput(
        previousInput,
        type,
        this.isNospace(),
      );
      this.logDelete(
        unindent ? "deleteContentBackward" : type,
        now,
        restored.length,
        restored,
      );
    } else {
      const next =
        type === "deleteWordBackward"
          ? input.replace(/(?:\S+\s*|\s+)$/, "")
          : input.slice(0, -1);
      this.logDelete(type, now, input.length, next);
    }
  }

  private logDelete(
    type: DeleteInputType,
    now: number,
    charIndex: number,
    inputValue: string,
    automatic?: true,
  ): void {
    const event: InputEventData = {
      inputType: type,
      wordIndex: this.wordIndex,
      charIndex,
      inputValue,
      automatic,
    };
    this.record("input", now, event);
    this.emit("input", event);
  }
  private deleteOnError(now: number): void {
    const config = this.getConfig();
    const input = this.recorder.getCurrentInput();
    const wholeWord = config.deleteOnError.startsWith("word");
    const type = wholeWord ? "deleteWordBackward" : "deleteContentBackward";
    if (input.length > 0) {
      this.logDelete(
        type,
        now,
        input.length,
        wholeWord ? "" : input.slice(0, -1),
        true,
      );
      if (!wholeWord && input.length > 1) {
        this.logDelete(type, now, input.length - 1, input.slice(0, -2), true);
      }
    }
    if (
      config.deleteOnError.includes("hard") &&
      input.length <= 1 &&
      this.wordIndex > 0
    ) {
      this.wordIndex--;
      const restored = getPreviousWordInput(
        this.recorder.getInputForWord(this.wordIndex),
        type,
        this.isNospace(),
      );
      this.logDelete(type, now, restored.length, restored, true);
    }
  }
}

export function createTestSession(
  config: SessionConfig | (() => SessionConfig),
  deps: TestSessionDeps = {},
): TestSession {
  return new TestSession(config, deps);
}
