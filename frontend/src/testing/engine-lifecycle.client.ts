import {
  loadEngine,
  EngineFailure,
  encodeText,
} from "@oxytype/typing-engine/browser.client";
import type {
  Command,
  LiveMetrics,
} from "@oxytype/typing-engine/browser.client";

export type LifecycleProof = {
  initializationMs: number;
  initial: number;
  memory: number[];
  costs: number[];
  events: number;
  active: number;
  afterReset: number;
  resetStats: LiveMetrics;
  restarts: number[];
  live: LiveMetrics[];
  invalid: number;
  hostQueries: {
    burst: number;
    canDelete: boolean;
    timeLimitSeconds: number | null;
    compositionReady: boolean;
    metadata:
      | { allWordsGenerated: boolean; hasTab: boolean; hasNewline: boolean }
      | undefined;
  };
};
/** Opt-in proof route only. No production typing state or platform clock enters the core implicitly. */
export async function runEngineLifecycle(
  current: () => boolean,
  wordCount = 10000,
): Promise<LifecycleProof> {
  if (![1000, 10000].includes(wordCount)) {
    throw new Error("Invalid lifecycle proof length");
  }
  const started = performance.now();
  const engine = await loadEngine();
  const initializationMs = performance.now() - started;
  const owner = engine.createContent();
  const command = (data: number[], now: number): Command => ({
    op: "insert",
    data,
    now,
    date: 0,
    automatic: null,
    correctShiftUsed: null,
    isCompositionEnding: null,
  });
  const memory = [];
  const costs = [];
  const prepare = (): void =>
    owner.prepare({
      config: {
        mode: "words",
        words: 0,
        minBurst: "fixed",
        minBurstCustomSpeed: 0,
        minWpm: "custom",
        minWpmCustomSpeed: 0,
        minAcc: "custom",
        minAccCustom: 0,
      },
      language: { name: "english", words: [encodeText("a")] },
      random: { kind: "seeded", state: 1 },
    } as Parameters<typeof owner.prepare>[0]);
  let session: ReturnType<typeof owner.createSession> | undefined;
  try {
    prepare();
    session = owner.createSession();
    const initial = engine.memoryBytes();
    const live = [];
    for (let block = 0; block < wordCount / 1000; block++) {
      if (!current()) throw new Error("Proof cancelled");
      const start = performance.now();
      for (let word = 0; word < 1000; word++) {
        const now = (block * 1000 + word) * 20;
        const update = session.command(command([97, 32], now));
        if (update.state.wordIndex !== block * 1000 + word + 1) {
          throw new Error("Lost long-session progression");
        }
        if (word % 50 === 0) session.command({ op: "advance", now, date: 0 });
      }
      costs.push((performance.now() - start) / 2000);
      live.push(session.liveStats((block + 1) * 20000));
      memory.push(engine.memoryBytes());
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const log = session.log();
    const events = log.events.length;
    const active = engine.memoryBytes();
    session.command({ op: "reset", now: wordCount * 20 + 1 });
    const afterReset = engine.memoryBytes();
    const resetStats = session.liveStats(wordCount * 20 + 1);
    if (session.log().events.length !== 0) {
      throw new Error("Reset retained events");
    }
    owner.recycleSession(session);
    session = undefined;
    const restarts = [];
    for (let index = 0; index < 100; index++) {
      prepare();
      session = owner.createSession();
      for (let word = 0; word < 1000; word++) {
        session.command(command([97, 32], word * 20));
      }
      owner.recycleSession(session);
      session = undefined;
      restarts.push(engine.memoryBytes());
      if (index % 10 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (!current()) throw new Error("Proof cancelled");
    }
    prepare();
    session = owner.createSession();
    let invalid = 0;
    for (const value of [
      {
        op: "observe",
        now: 0,
        eventType: "composition",
        eventData: { event: "invalid" },
      },
      { op: "insert", now: 0, data: [65536] },
      { op: "customLimit", now: 0, mode: "word", value: -1 },
    ]) {
      const before = JSON.stringify(session.log());
      try {
        session.command(value as Command);
      } catch (error) {
        if (
          !(error instanceof EngineFailure) ||
          error.code !== "invalidInput"
        ) {
          throw error;
        }
        invalid++;
      }
      if (JSON.stringify(session.log()) !== before) {
        throw new Error("Invalid input mutated log");
      }
    }
    if (session.canDelete()) {
      throw new Error("Inactive deletion preflight accepted");
    }
    session.command(command([97], 100));
    if (!session.canDelete()) {
      throw new Error("Active deletion preflight rejected");
    }
    session.command(command([32], 200));
    const composition = engine.createSession({ mode: "words", words: 1 }, [
      [0xd800, 0xdc00],
    ]);
    let compositionReady: boolean;
    try {
      composition.command({ op: "start", now: 0, date: 0 });
      compositionReady = composition.compositionCompletes([0xd800, 0xdc00]);
    } finally {
      composition.dispose();
    }
    const custom = engine.createSession({ mode: "custom" }, [
      encodeText("\ta\n"),
    ]);
    let metadata;
    try {
      metadata = custom.command({
        op: "customLimit",
        now: 0,
        mode: "time",
        value: 1.5,
      }).metadata;
    } finally {
      custom.dispose();
    }
    const hostQueries = {
      compositionReady,
      metadata,
      burst: session.wordBurst(0, 250),
      canDelete: session.canDelete(),
      timeLimitSeconds: session.liveStats(250).timeLimitSeconds,
    };
    return {
      hostQueries,
      initializationMs,
      initial,
      memory,
      costs,
      events,
      active,
      afterReset,
      resetStats,
      restarts,
      live,
      invalid,
    };
  } finally {
    session?.dispose();
    owner.dispose();
  }
}
