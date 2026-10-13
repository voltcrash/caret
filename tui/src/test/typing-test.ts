import type { KeyEvent } from "@opentui/core";
import type { Config } from "@oxytype/schemas/configs";
import type {
  CustomTextSettings,
  IncompleteTest,
} from "@oxytype/schemas/results";
import {
  getAccuracy,
  getIncompleteTestSeconds,
  getRawHistory,
  getWordBurst,
} from "@oxytype/typing-core/events/stats";
import type { EventLog } from "@oxytype/typing-core/events/types";
import { canQuickRestart } from "@oxytype/typing-core/quick-restart";
import { getMode2 } from "@oxytype/typing-core/mode";
import {
  advancePace,
  correctPace,
  createPaceState,
  type PaceState,
} from "@oxytype/typing-core/pace-caret";
import type { QuoteWithTextSplit } from "@oxytype/typing-core/quotes";
import { buildPracticeWords } from "@oxytype/typing-core/practise-words";
import { createWeakSpot } from "@oxytype/typing-core/weak-spot";
import { sharedConfigMetadata } from "@oxytype/typing-core/config/metadata";
import { getInvalidResultReason } from "@oxytype/typing-core/result-validity";
import {
  createTestSession,
  type LiveStats,
  type TestSession,
} from "@oxytype/typing-core/session";
import type { WordsGenerator } from "@oxytype/typing-core/words-generator";
import type { Accessor } from "solid-js";
import {
  batch,
  createContext,
  createEffect,
  untrack,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import { unwrap } from "solid-js/store";

import { createTextLibrary, type TextLibrary } from "../storage/texts";
import { CustomTextSettingsSchema } from "@oxytype/schemas/results";
import {
  getChallenge,
  challengeSetup,
  verifyChallenge,
  type Challenge,
} from "@oxytype/challenges";
import type { ChallengeName } from "@oxytype/schemas/challenges";
import type { ConfigStore } from "../config/store";
import type { TestSources } from "./sources";
import type { UploadIdentity } from "../auth/identity";
import type { LayoutObject } from "@oxytype/schemas/layouts";
import { emulateTerminalChar } from "./layout-emulator";
import { terminalFunboxes } from "./funboxes";
import { createGenerator } from "./generator";
import { inputAction, keyData } from "./input";

type TestStatus = "loading" | "ready" | "running" | "finished" | "error";
export type LocalResult = ReturnType<TestSession["complete"]>;
export type FinishedTest = {
  result: LocalResult;
  eventLog: EventLog;
  rawHistory: number[];
  invalid?: string;
  failure?: string;
  challengeMessage?: string;
  owner?: UploadIdentity;
};
export type TypingTestOptions = {
  store: ConfigStore;
  sources: TestSources;
  texts?: TextLibrary;
  customText?: CustomTextSettings;
  /** Deterministic words, e.g. for a recorded input fixture. */
  words?: string[];
  now?: () => number;
  dateNow?: () => number;
  /** Test harnesses drive advance themselves. */
  schedule?: boolean;
  getPaceSpeed?: (config: Config, mode2: string) => number;
  getTags?: () => readonly string[];
  getIdentity?: () => UploadIdentity | undefined;
};
export type TypingTest = {
  sources: TestSources;
  loadChallenge: (name: ChallengeName) => Promise<void>;
  challenge: Accessor<Challenge | undefined>;
  practice: Accessor<boolean>;
  practiceWords: (
    missed: "off" | "words" | "biwords",
    slow: boolean,
  ) => Promise<void>;
  clearChallenge: () => void;
  texts: TextLibrary;
  setCustomText: (settings: CustomTextSettings) => Promise<void>;
  selectQuote: (language: Config["language"], id: number) => Promise<void>;
  status: Accessor<TestStatus>;
  notice: Accessor<string | undefined>;
  words: Accessor<readonly string[]>;
  activeIndex: Accessor<number>;
  inputFor: (index: number) => string;
  sectionIndex: Accessor<number | undefined>;
  revision: Accessor<number>;
  config: Accessor<Config>;
  stats: Accessor<LiveStats & { burst: number }>;
  result: Accessor<FinishedTest | undefined>;
  customText: CustomTextSettings;
  ready: Promise<void>;
  handleKey: (event: KeyEvent, now?: number) => Promise<void>;
  insert: (text: string, now: number) => Promise<void>;
  advance: (now: number) => void;
  finish: (now?: number) => void;
  canInterrupt: () => boolean;
  restart: (repeat?: boolean, quick?: boolean) => Promise<void>;
  cancel: () => void;
  session: () => TestSession;
  pace: Accessor<
    { wordIndex: number; letterIndex: number; wpm: number } | undefined
  >;
};

export function createTypingTest(options: TypingTestOptions): TypingTest {
  const { store, sources } = options;
  const texts = options.texts ?? createTextLibrary();
  const customText = structuredClone(options.customText ?? texts.current());
  let baseCustomText = structuredClone(customText);
  const weakSpot = createWeakSpot();
  const [practice, setPractice] = createSignal(false);
  const now = options.now ?? (() => performance.now());
  const dateNow = options.dateNow ?? (() => Date.now());
  const [status, setStatus] = createSignal<TestStatus>("loading");
  const [challenge, setChallenge] = createSignal<Challenge>();
  let challengeConfig: Partial<Config> = {};
  const [notice, setNotice] = createSignal<string>();
  const [words, setWords] = createSignal<readonly string[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [revision, setRevision] = createSignal(0);
  const [config, setConfig] = createSignal<Config>(snapshotConfig());
  const emptyStats = (): LiveStats & { burst: number } => ({
    wpm: 0,
    raw: 0,
    acc: 100,
    seconds: 0,
    burst: 0,
  });
  const [stats, setStats] = createSignal(emptyStats());
  const [result, setResult] = createSignal<FinishedTest>();
  const [pace, setPace] = createSignal<{
    wordIndex: number;
    letterIndex: number;
    wpm: number;
  }>();
  let paceState: PaceState | null = null;
  let paceSteps = 0;
  let inputLayout: LayoutObject | undefined;
  let currentQuote: QuoteWithTextSplit | null = null;
  let generator: WordsGenerator | undefined;
  let sectionIndexes: number[] = [];
  let session: TestSession;
  let timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let disposed = false;
  let repeated = false;
  let bailedOut = false;
  let abandoning = false;
  let restartCount = 0;
  let activeTags: string[] = [];
  let selectedQuoteId = 1;
  let incompleteTests: IncompleteTest[] = [];
  let pending = Promise.resolve();
  let owner: UploadIdentity | undefined;

  function snapshotConfig(): Config {
    // Results include only effects this terminal actually implements.
    const snapshot = {
      ...structuredClone(unwrap(store.config)),
      ...challengeConfig,
    };
    snapshot.funbox = snapshot.funbox.filter((name) =>
      terminalFunboxes.has(name),
    );
    return snapshot;
  }
  function stopTimer(): void {
    clearInterval(timer);
    timer = undefined;
  }
  function refresh(): void {
    if (config().mode === "zen") {
      session.setWords(
        Array.from({ length: session.getActiveWordIndex() + 1 }, (_, index) =>
          session.recorder.getInputForWord(index),
        ),
      );
    }
    batch(() => {
      setWords(session.getWords());
      setActiveIndex(session.getActiveWordIndex());
      setRevision((it) => it + 1);
    });
  }
  function makeSession(): void {
    session = createTestSession(config, {
      dateNow,
      weakSpot,
      generator: config().mode === "zen" ? undefined : generator,
      allWordsGenerated: () =>
        options.words !== undefined
          ? config().mode !== "time" && config().mode !== "zen"
          : (generator?.areAllWordsGenerated() ?? false),
      customLimit: () => customText.limit,
      getCurrentQuote: () => currentQuote,
    });
    session.on("input", (input) => {
      if (input.inputType === "insertText" && input.commitsWord) {
        const word = session.getWords()[input.wordIndex] ?? "";
        correctPace(
          paceState,
          input.wordIndex,
          input.inputValue === word,
          word,
          config().blindMode,
        );
      }
    });
    session.on("tick", (tick) =>
      setStats((previous) => ({ ...previous, ...tick })),
    );
    session.on("finish", ({ reason }) => {
      stopTimer();
      setPace(undefined);
      if (abandoning) return;
      session.recorder.cleanupData();
      const eventLog = session.buildEventLog();
      eventLog.context.bailedOut = bailedOut;
      const completed = session.complete(eventLog, {
        client: "tui",
        offline: owner?.online !== true,
        config: config(),
        currentQuote,
        customText: {
          ...customText,
          textLen: customText.text.join(" ").length,
        },
        tags: activeTags,
        bailedOut,
        restartCount,
        incompleteTests,
        incompleteSeconds: incompleteTests.reduce(
          (sum, test) => sum + test.seconds,
          0,
        ),
        timestamp: dateNow(),
      });
      const loadedChallenge = challenge();
      const challengeFailures =
        loadedChallenge === undefined
          ? []
          : verifyChallenge(completed, config(), loadedChallenge);
      if (
        loadedChallenge !== undefined &&
        challengeFailures.length === 0 &&
        !repeated
      ) {
        completed.challenge = loadedChallenge.name;
      }
      const challengeMessage =
        loadedChallenge === undefined
          ? undefined
          : `${loadedChallenge.display}: ${challengeFailures.length === 0 ? "passed" : challengeFailures.join(", ")}`;
      const invalid = practice()
        ? "practice mode"
        : getInvalidResultReason({
            result: completed,
            eventLog,
            bailedOut,
            failed: reason !== undefined,
            repeated,
            lbOptOut: false,
            customLimit: customText.limit,
          });
      batch(() => {
        refresh();
        setResult({
          result: completed,
          challengeMessage,
          eventLog,
          rawHistory: getRawHistory(eventLog),
          invalid,
          failure: reason,
          owner,
        });
        setStatus("finished");
      });
      restartCount = 0;
      incompleteTests = [];
    });
  }
  async function load(repeat = false): Promise<void> {
    const version = ++generation;
    stopTimer();
    const previousWords = session?.getWords();
    const previousConfig = config();
    setStatus("loading");
    activeTags = [...(options.getTags?.() ?? [])];
    setNotice(undefined);
    setStats(emptyStats());
    setPace(undefined);
    bailedOut = false;
    repeated = repeat && previousWords !== undefined;
    owner = undefined;
    try {
      if (!repeated) {
        const snapshot = snapshotConfig();
        inputLayout = undefined;
        if (snapshot.layout !== "default") {
          try {
            inputLayout = await sources.getLayout(snapshot.layout);
          } catch {
            snapshot.layout = "default";
            setNotice(
              "Layout unavailable offline; emulation disabled for this test",
            );
          }
        }
        const loaded = await sources.loadLanguage(
          snapshot.language,
          snapshot.mode === "quote" ? snapshot.quoteLength : undefined,
        );
        if (version !== generation || disposed) return;
        snapshot.language = loaded.language.name;
        setConfig(snapshot);
        if (loaded.missing !== undefined) {
          setNotice(
            `${loaded.missing}${loaded.missingQuotes === true ? " quotes" : ""} is not available offline; using english`,
          );
        }
        const missing = store.config.funbox.filter(
          (name) => !terminalFunboxes.has(name),
        );
        if (missing.length > 0) {
          setNotice(`Browser-only funboxes skipped: ${missing.join(", ")}`);
        }
        currentQuote = null;
        sectionIndexes = [];
        const baseGenerator = createGenerator({
          store,
          isPractice: practice,
          getWeakSpotWord: (wordset) => session.weakSpot.getWord(wordset),
          notify: (message) => setNotice(message),
          getSelectedQuoteId: () => selectedQuoteId,
          getConfig: config,
          sources,
          customText,
          getWordsLength: () => session?.getWords().length ?? 0,
          isRepeated: () => repeated,
          getCurrentQuote: () => currentQuote,
          setCurrentQuote: (quote) => {
            currentQuote = quote;
          },
        });
        generator = {
          ...baseGenerator,
          getNextWord: async (...args) => {
            const next = await baseGenerator.getNextWord(...args);
            sectionIndexes[args[0]] = next.sectionIndex;
            return next;
          },
        };
        makeSession();
        if (options.words !== undefined) {
          session.setWords(options.words);
        } else if (snapshot.mode === "zen") {
          session.setWords([""]);
        } else {
          const generated = await session.generate(loaded.language, generator);
          if (version !== generation || disposed) return;
          sectionIndexes = generated.sectionIndexes;
        }
      } else {
        setConfig(previousConfig);
        makeSession();
        session.setWords(previousWords ?? []);
      }
      if (version !== generation || disposed) return;
      refresh();
      paceState =
        config().mode === "zen"
          ? null
          : createPaceState(
              options.getPaceSpeed?.(
                config(),
                getMode2(config(), currentQuote),
              ) ??
                (config().paceCaret === "custom"
                  ? config().paceCaretCustomSpeed
                  : 0),
            );
      paceSteps = 0;
      setStatus("ready");
    } catch (error) {
      if (version !== generation || disposed) return;
      setNotice(
        error instanceof Error ? error.message : "Could not load the test",
      );
      setStatus("error");
    }
  }
  function startTimer(): void {
    if (!session.isActive()) return;
    setStatus("running");
    if (timer === undefined && options.schedule !== false) {
      timer = setInterval(() => {
        advance(now());
      }, 50);
    }
  }
  function advance(timestamp: number): void {
    session?.advance(timestamp);
    const start = session?.liveCache.getLiveCachedTimerStartMs();
    if (
      !session?.isActive() ||
      paceState === null ||
      start === null ||
      start === undefined
    ) {
      return;
    }
    const steps = Math.floor((timestamp - start) / (paceState.spc * 1000));
    while (paceSteps < steps) {
      if (
        !advancePace(
          paceState,
          (index) => session.getWords()[index],
          config().blindMode,
        )
      ) {
        paceState = null;
        setPace(undefined);
        return;
      }
      paceSteps++;
    }
    setPace({
      wordIndex: paceState.currentWordIndex,
      letterIndex: paceState.currentLetterIndex,
      wpm: paceState.wpm,
    });
  }
  async function insert(text: string, timestamp: number): Promise<void> {
    if (status() !== "ready" && status() !== "running") return;
    const version = generation;
    const wordIndex = session.getActiveWordIndex();
    if (!session.isActive()) owner = options.getIdentity?.();
    await session.insert(text, timestamp);
    if (version !== generation || disposed) return;
    if (
      session.isActive() &&
      generator !== undefined &&
      config().mode !== "zen" &&
      options.words === undefined
    ) {
      while (
        session.getWords().length - session.getActiveWordIndex() < 25 &&
        !generator.areAllWordsGenerated()
      ) {
        const generatedWords = session.getWords();
        await session.nextWord(
          generatedWords.length,
          100,
          generatedWords.at(-1)?.replace(/[ \n]$/, ""),
          generatedWords.at(-2)?.replace(/[ \n]$/, ""),
          generator,
        );
        if (version !== generation || disposed) return;
      }
      if (generator.areAllWordsGenerated()) {
        const generatedWords = session.getWords();
        const last = generatedWords.length - 1;
        generatedWords[last] =
          generatedWords[last]?.replace(/[ \n]$/, "") ?? "";
        session.setWords(generatedWords);
      }
    }
    refresh();
    const burst =
      session.getActiveWordIndex() > wordIndex
        ? getWordBurst(session.buildEventLog(), wordIndex, timestamp)
        : undefined;
    setStats((previous) => ({
      ...previous,
      acc: session.liveCache.getLiveCachedAccuracy(),
      burst:
        burst !== undefined && Number.isFinite(burst) ? burst : previous.burst,
    }));
    if (status() !== "finished") startTimer();
  }
  function canInterrupt(): boolean {
    if (session?.isActive() && config().funbox.includes("no_quit")) {
      setNotice("No quit funbox is active. Please finish the test.");
      return false;
    }
    return true;
  }
  async function restart(repeat = false, quick = false): Promise<void> {
    if (session?.isActive()) {
      if (!canInterrupt()) return;
      if (
        quick &&
        !canQuickRestart(
          config().mode,
          config().words,
          config().time,
          customText,
          customText.text.join(" ").length >= 10000,
        )
      ) {
        setNotice(
          "Quick restart disabled in long tests; use shift + restart key",
        );
        return;
      }
      repeat ||=
        repeated ||
        (config().mode === "quote" && store.config.repeatQuotes === "typing");
      abandoning = true;
      session.finish(now());
      abandoning = false;
      const log = session.buildEventLog();
      if (store.config.resultSaving) {
        incompleteTests.push({
          acc: getAccuracy(log).percentage,
          seconds: getIncompleteTestSeconds(log),
        });
      }
      restartCount++;
    }
    await load(repeat);
  }
  function finish(timestamp = now()): void {
    if (!session?.isActive()) return;
    if (!canInterrupt()) return;
    bailedOut = config().mode !== "zen";
    session.finish(timestamp);
  }
  function cancel(): void {
    if (!canInterrupt()) return;
    stopTimer();
    paceState = null;
    setPace(undefined);
    generation++;
    session?.reset();
    if (!disposed && session !== undefined) {
      setStats(emptyStats());
      refresh();
      if (status() === "running") setStatus("ready");
    }
  }
  onCleanup(() => {
    disposed = true;
    stopTimer();
    generation++;
  });
  function clearSpecial(): void {
    if (!canInterrupt()) return;
    const active = challenge() !== undefined || practice();
    setChallenge(undefined);
    setPractice(false);
    challengeConfig = {};
    if (active) Object.assign(customText, structuredClone(baseCustomText));
  }
  const ready = load();
  const restartKeys = (
    Object.keys(sharedConfigMetadata) as (keyof Config)[]
  ).filter((key) => sharedConfigMetadata[key].changeRequiresRestart);
  const signature = (): string =>
    JSON.stringify(restartKeys.map((key) => store.config[key]));
  let previousSignature = untrack(signature);
  let previousRemote = untrack(store.remoteRevision);
  createEffect(() => {
    const next = signature();
    const remote = store.remoteRevision();
    const fromServer = remote !== previousRemote;
    previousRemote = remote;
    if (next === previousSignature) return;
    previousSignature = next;
    if (fromServer && untrack(status) === "running") return;
    untrack(() => {
      clearSpecial();
      void restart();
    });
  });
  return {
    canInterrupt,
    sources,
    challenge,
    clearChallenge: clearSpecial,
    practice,
    practiceWords: async (missed, slow) => {
      if (!canInterrupt()) throw new Error("Finish the no quit test first");
      const finished = result();
      if (finished === undefined) throw new Error("Finish a test first");
      let message = "No practice words available";
      const selected = buildPracticeWords(
        finished.eventLog,
        finished.eventLog.context.targetWords.map((word) =>
          word.replace(/[ \n]$/, ""),
        ),
        missed,
        slow,
        (practiceNotice) => {
          message = practiceNotice;
        },
      );
      if (selected === null) throw new Error(message);
      clearSpecial();
      setPractice(true);
      challengeConfig = { mode: "custom", funbox: [] };
      Object.assign(customText, {
        text: selected.text,
        mode: "repeat",
        limit: { mode: "section", value: selected.sectionLimit },
        pipeDelimiter: false,
      });
      await restart();
      setNotice("Practice mode · results are not saved");
    },
    loadChallenge: async (name) => {
      if (!canInterrupt()) throw new Error("Finish the no quit test first");
      if (name === "wingdings") {
        throw new Error(
          "Ten Words of Pain needs Wingdings; open this challenge in the browser",
        );
      }
      const loaded = getChallenge(name);
      const setup = challengeSetup(loaded);
      if (
        setup.config.funbox?.some((funbox) => !terminalFunboxes.has(funbox)) ===
        true
      ) {
        throw new Error("This challenge requires a browser-only funbox");
      }
      if (setup.script !== undefined) {
        const text = (await sources.getScript(setup.script))
          .trim()
          .replace(/[\r\n\t ]+/g, " ")
          .split(" ");
        Object.assign(customText, {
          text,
          mode: "repeat",
          limit: { mode: "word", value: text.length },
          pipeDelimiter: false,
        });
      } else if (setup.customText !== undefined) {
        Object.assign(customText, structuredClone(setup.customText));
      }
      setPractice(false);
      challengeConfig = setup.config;
      setChallenge(loaded);
      await restart();
      setNotice(
        `Challenge: ${loaded.display}${loaded.settings.message === undefined ? "" : ` · ${loaded.settings.message}`}`,
      );
    },
    texts,
    setCustomText: async (settings) => {
      if (!canInterrupt()) throw new Error("Finish the no quit test first");
      clearSpecial();
      const next = CustomTextSettingsSchema.parse(settings);
      Object.assign(customText, structuredClone(next));
      baseCustomText = structuredClone(next);
      texts.setCurrent(next);
      await texts.flush();
      store.set("mode", "custom");
      await restart();
    },
    selectQuote: async (language, id) => {
      if (!canInterrupt()) throw new Error("Finish the no quit test first");
      clearSpecial();
      selectedQuoteId = id;
      store.set("language", language);
      store.set("quoteLength", [-2]);
      store.set("mode", "quote");
      await restart();
    },
    status,
    notice,
    words,
    activeIndex,
    revision,
    config,
    stats,
    result,
    customText,
    ready,
    inputFor: (index) => {
      revision();
      return session?.recorder.getInputForWord(index) ?? "";
    },
    sectionIndex: () => {
      revision();
      return sectionIndexes[activeIndex()];
    },
    insert,
    advance,
    pace,
    finish,
    restart,
    cancel,
    session: () => session,
    handleKey: async (event, timestamp = now()) => {
      const action = inputAction(event, config(), words());
      if (action === undefined) return Promise.resolve();
      event.preventDefault();
      const version = generation;
      pending = pending
        .then(async () => {
          if (disposed || version !== generation) return undefined;
          if (action.type === "restart") {
            await restart(false, !event.shift);
            return undefined;
          }
          if (action.type === "repeat") {
            await restart(true);
            return undefined;
          }
          if (action.type === "finish") {
            finish(timestamp);
            return undefined;
          }
          if (status() !== "ready" && status() !== "running") return undefined;
          if (event.eventType === "release") {
            if (event.source === "kitty") {
              session.record("keyup", timestamp, keyData(event));
            }
            return undefined;
          }
          session.record("keydown", timestamp, keyData(event));
          if (action.type === "insert") {
            const text =
              inputLayout === undefined ||
              config().funbox.includes("arrows") ||
              action.text.length !== 1 ||
              action.text === "\n" ||
              action.text === "\t"
                ? action.text
                : emulateTerminalChar(event, action.text, inputLayout);
            if (text !== null) await insert(text, timestamp);
          } else {
            session.delete(action.inputType, timestamp);
            refresh();
          }
          if (action.type === "delete") {
            setStats((previous) => ({
              ...previous,
              acc: session.liveCache.getLiveCachedAccuracy(),
            }));
          }
          return undefined;
        })
        .catch((error: unknown) => {
          stopTimer();
          setNotice(error instanceof Error ? error.message : "Input failed");
          setStatus("error");
        });
      return pending;
    },
  };
}

export const TypingTestContext = createContext<TypingTest>();
export function useTypingTest(): TypingTest {
  const test = useContext(TypingTestContext);
  if (test === undefined) {
    throw new Error("useTypingTest outside TypingTestContext");
  }
  return test;
}
