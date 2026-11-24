import type {
  BrowserSession,
  Cursor,
  Log,
  PolicyQuery,
  Prepare,
  Query,
} from "@caret/typing-engine/browser.client";
import type { WebLog } from "@caret/typing-engine/text";

export async function runPoliciesProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const input = JSON.parse(fixture) as {
    quick: {
      mode: string;
      words: number;
      time: number;
      limit: { mode: string; value: number };
      customIsLong: boolean;
    }[];
    quotes: { mode: string; repeatQuotes: string }[];
    quotePreparation: Prepare;
  };
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const quick = input.quick.map((item) => {
    const session = engine.createSession(item, [[97, 32]]);
    try {
      session.command({
        op: "customLimit",
        now: 0,
        mode: item.limit.mode,
        value: item.limit.value,
      });
      session.command({ op: "start", now: 0, date: 0 });
      return session.restartPolicy({
        quick: true,
        customIsLong: item.customIsLong,
      }).allowed;
    } finally {
      session.dispose();
    }
  });
  const quotes = input.quotes.map((item) => {
    const content = engine.createContent();
    let session: BrowserSession | undefined;
    try {
      if (item.mode === "quote") {
        content.prepare({
          ...input.quotePreparation,
          config: { ...input.quotePreparation.config, ...item },
        });
        session = content.createSession();
      } else {
        session = engine.createSession(item, [[97, 32]]);
      }
      session.command({ op: "start", now: 0, date: 0 });
      return session.restartPolicy().withSameWordset;
    } finally {
      session?.dispose();
      content.dispose();
    }
  });
  return JSON.stringify({ quick, quotes });
}

export async function runSettingPoliciesProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const cases = JSON.parse(fixture) as {
    combinations: { names: string[] }[];
    forced: {
      names: string[];
      key: string;
      value: Extract<PolicyQuery, { op: "forced" }>["value"];
    }[];
  };
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  return JSON.stringify({
    combinations: cases.combinations.map(
      ({ names }) => engine.policy({ op: "compatible", names }).result,
    ),
    forced: cases.forced.map((input) => ({
      forced: engine.policy({ op: "forced", ...input }).result,
      canSet: engine.policy({ op: "canSet", ...input }).result,
    })),
  });
}

export async function runAnalysisProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const inputs = JSON.parse(fixture) as {
    log?: Log;
    webLog?: WebLog;
    queries: Query[];
    playback?: { zen: boolean; targets: Cursor[] }[];
  }[];
  const { loadEngine, analyzeLog, toEngineLog, toWebLog } =
    await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  return JSON.stringify(
    inputs.map(({ log: neutral, webLog, queries, playback }) => {
      const log = webLog === undefined ? neutral : toEngineLog(webLog);
      if (log === undefined) throw new Error("Missing analysis log");
      const analysis = queries.map((query) => analyzeLog(log, query));
      if (playback === undefined) {
        return webLog === undefined
          ? analysis
          : { analysis, roundTrip: toWebLog(log) };
      }
      return {
        analysis,
        ...(webLog === undefined ? {} : { roundTrip: toWebLog(log) }),
        playback: playback.map(({ zen, targets }) => {
          const replay = engine.createReplay(log, zen);
          try {
            const initial = replay.snapshot();
            const words = initial.words;
            const sounds = [];
            let cursor = initial.cursor;
            let next = initial.nextTime;
            while (next !== null) {
              const update = replay.step();
              for (const change of update.words) {
                words[change.index] = change.word;
              }
              sounds.push(update.sound);
              cursor = update.cursor;
              next = update.nextTime;
            }
            const seeks = targets.map((target) => {
              const snapshot = replay.seek(target);
              return {
                words: snapshot.words,
                cursor: snapshot.cursor,
                nextIndex: snapshot.nextIndex,
              };
            });
            replay.dispose();
            replay.dispose();
            let stale = false;
            try {
              replay.step();
            } catch {
              stale = true;
            }
            return { words, sounds, cursor, seeks, stale };
          } finally {
            replay.dispose();
          }
        }),
      };
    }),
  );
}
