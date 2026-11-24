import type {
  BrowserSession,
  PaceCommand,
  Prepare,
  Text,
} from "@caret/typing-engine/browser.client";

export async function runContextProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const input = JSON.parse(fixture) as {
    pace: { targets: Text[]; frames: { command: PaceCommand }[] };
    normalization: { language: string; data: Text; target: Text }[];
    learning: Prepare;
  };
  const { loadEngine, encodeText } =
    await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const pace = engine.createSession(
    { mode: "words", words: 0 },
    input.pace.targets,
  );
  const content = engine.createContent();
  const isolated = engine.createContent();
  const sessions: BrowserSession[] = [pace];
  try {
    const frames = input.pace.frames.map(({ command }) => pace.pace(command));
    const normalization = input.normalization.map((item) => {
      const session = engine.createSession({ language: item.language }, [
        item.target,
      ]);
      try {
        return session.preflight(item.data).normalized;
      } finally {
        session.dispose();
      }
    });
    content.prepare(input.learning);
    const first = content.createSession();
    sessions.push(first);
    first.command({
      op: "insert",
      data: encodeText("a"),
      now: 0,
      date: 0,
      automatic: null,
      isCompositionEnding: null,
      correctShiftUsed: null,
    });
    first.command({
      op: "insert",
      data: encodeText("x"),
      now: 100,
      date: 100,
      automatic: null,
      isCompositionEnding: null,
      correctShiftUsed: null,
    });
    first.pace({ op: "remember", wpm: 77, repeating: false });
    first.pace({ op: "remember", wpm: 40, repeating: true });
    content.recycleSession(first);
    let stale = false;
    try {
      first.snapshot();
    } catch {
      stale = true;
    }
    content.prepare(input.learning);
    const next = content.createSession();
    sessions.push(next);
    isolated.prepare(input.learning);
    const fresh = isolated.createSession();
    sessions.push(fresh);
    return JSON.stringify({
      frames,
      normalization,
      stale,
      learnedWords: next.snapshot().words,
      freshWords: fresh.snapshot().words,
      remembered: next.pace({ op: "reset", wpm: null }).lastWpm,
      isolated: fresh.pace({ op: "reset", wpm: null }).lastWpm,
      emptyLog: next.log().events.length === 0,
      active: next.snapshot().state.active,
    });
  } finally {
    for (const session of sessions) session.dispose();
    content.dispose();
    isolated.dispose();
  }
}

export async function runRestartsProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const input = JSON.parse(fixture) as {
    words: Prepare;
    quote: Prepare;
    sections: Prepare;
  };
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const owners = Array.from({ length: 3 }, () => engine.createContent());
  const sessions: BrowserSession[] = [];
  const [words, quote, sections] = owners;
  if (words === undefined || quote === undefined || sections === undefined) {
    throw new Error("Missing owner");
  }
  try {
    words.prepare(input.words);
    const first = words.createSession();
    sessions.push(first);
    const before = first.snapshot().words;
    words.recycleSession(first);
    words.prepare(
      { ...input.words, random: { kind: "seeded", state: 99 } },
      true,
    );
    const repeated = words.createSession(true);
    sessions.push(repeated);
    const after = repeated.snapshot().words;
    quote.prepare(input.quote);
    const firstQuote = quote.createSession();
    sessions.push(firstQuote);
    const quoteBefore = firstQuote.snapshot();
    quote.recycleSession(firstQuote);
    quote.prepare({ ...input.quote, quotes: null }, true);
    const repeatQuote = quote.createSession(true);
    sessions.push(repeatQuote);
    const quoteAfter = repeatQuote.snapshot();
    quote.recycleSession(repeatQuote);
    quote.prepare({ ...input.quote, quotes: null });
    const nextQuote = quote.createSession();
    sessions.push(nextQuote);
    sections.prepare(input.sections);
    try {
      sections.createSession();
    } catch {
      /* Expected typed source request. */
    }
    const old = sections.request();
    sections.prepare(input.sections);
    try {
      sections.createSession();
    } catch {
      /* Expected replacement request. */
    }
    const current = sections.request();
    if (old === null || current === null) {
      throw new Error("Missing request");
    }
    let staleRejected = false;
    try {
      sections.supply(old, {
        kind: "poem",
        title: [],
        author: [],
        lines: [[111, 110, 101]],
      });
    } catch {
      staleRejected = true;
    }
    return JSON.stringify({
      before,
      after,
      quoteBefore: {
        words: quoteBefore.words,
        quote: quoteBefore.currentQuote,
      },
      quoteAfter: {
        words: quoteAfter.words,
        quote: quoteAfter.currentQuote,
      },
      nextQuote: nextQuote.snapshot().currentQuote,
      old,
      current,
      staleRejected,
      pending: sections.request(),
    });
  } finally {
    for (const session of sessions) session.dispose();
    for (const owner of owners) owner.dispose();
  }
}

export async function runSourceFailuresProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const { loadEngine, EngineFailure, encodeText } =
    await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const refs = JSON.parse(fixture) as { kind: string }[];
  const output = [];
  const preparation = (kind: string, sections: Prepare["sections"]): Prepare =>
    ({
      config: { mode: "time", time: 0, funbox: [kind] },
      language: { name: "english", words: [encodeText("base")] },
      random: { kind: "seeded", state: 1 },
      sections,
    }) as Prepare;
  for (const ref of refs) {
    const content = engine.createContent();
    try {
      content.prepare(preparation(ref.kind, []));
      try {
        content.createSession();
      } catch (error) {
        if (
          !(error instanceof EngineFailure) ||
          error.code !== "contentRequired"
        ) {
          throw error;
        }
      }
      const request = content.request();
      if (request === null) throw new Error("Missing initial request");
      try {
        content.failSource(request);
      } catch (error) {
        if (
          !(error instanceof EngineFailure) ||
          error.code !== "sourceUnavailable"
        ) {
          throw error;
        }
        output.push({ message: error.message, recovery: error.recovery });
      }
    } finally {
      content.dispose();
    }
  }
  const active = [];
  for (const exhausted of [false, true]) {
    const content = engine.createContent();
    let session: BrowserSession | undefined;
    try {
      const source = {
        kind: "poem" as const,
        title: [],
        author: [],
        lines: [encodeText("one ".repeat(100))],
      };
      content.prepare(preparation("poetry", [source]));
      session = content.createSession();
      const waiting = session.command({
        op: "insert",
        data: encodeText("one ".repeat(exhausted ? 101 : 1)),
        correctShiftUsed: null,
        automatic: null,
        isCompositionEnding: null,
        now: 0,
        date: 0,
      });
      if (waiting.contentRequest === undefined) {
        throw new Error("Missing active request");
      }
      const before = JSON.stringify(session.log());
      let recovery;
      try {
        session.command({
          op: "failContent",
          now: 10,
          request: waiting.contentRequest,
        });
      } catch (error) {
        if (
          !(error instanceof EngineFailure) ||
          error.code !== "sourceUnavailable"
        ) {
          throw error;
        }
        recovery = error.recovery;
      }
      session.command({
        op: "insert",
        now: 20,
        date: 0,
        data: encodeText("discarded"),
        correctShiftUsed: null,
        automatic: null,
        isCompositionEnding: null,
      });
      session.command({ op: "advance", now: 5000, date: 0 });
      const preserved = before === JSON.stringify(session.log());
      const state = session.snapshot().state;
      let stale = false;
      try {
        session.command({
          op: "supplyContent",
          now: 5001,
          date: 0,
          request: waiting.contentRequest,
          source,
        });
      } catch (error) {
        stale = error instanceof EngineFailure && error.code === "staleRequest";
      }
      session.command({ op: "abandon", now: 5010, date: 9000 });
      active.push({
        recovery,
        preserved,
        awaitingRecovery: state.awaitingRecovery,
        failed: state.reason !== undefined,
        stale,
        ended: session.snapshot().state.ended,
      });
    } finally {
      session?.dispose();
      content.dispose();
    }
  }
  return JSON.stringify({ initial: output, active });
}

export async function runRecoveryProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const inputs = JSON.parse(fixture) as { input: Prepare }[];
  const { loadEngine, EngineFailure } =
    await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const results = inputs.map(({ input }) => {
    const content = engine.createContent();
    let session: BrowserSession | undefined;
    try {
      let failure: InstanceType<typeof EngineFailure> | undefined;
      try {
        content.prepare(input);
      } catch (error) {
        if (!(error instanceof EngineFailure)) throw error;
        failure = error;
      }
      if (failure === undefined) {
        throw new Error("Expected typed preparation failure");
      }
      content.prepare({
        ...input,
        config: { ...input.config, mode: "words", words: 2, funbox: [] },
        language: {
          ...input.language,
          name: "english",
          words: [[97], [98]],
        },
        quotes: null,
        polyglot: [],
      });
      session = content.createSession();
      const recovered = session.snapshot().words.length === 2;
      const log = JSON.stringify(session.log());
      let invalidCode: string | undefined;
      try {
        session.command({
          op: "insert",
          data: [-1],
          now: 0,
          date: 0,
          automatic: null,
          isCompositionEnding: null,
          correctShiftUsed: null,
        });
      } catch (error) {
        if (!(error instanceof EngineFailure)) throw error;
        invalidCode = error.code;
      }
      const unchanged = log === JSON.stringify(session.log());
      content.dispose();
      let disposedCode: string | undefined;
      try {
        content.request();
      } catch (error) {
        if (!(error instanceof EngineFailure)) throw error;
        disposedCode = error.code;
      }
      return {
        message: failure.message,
        recovery: failure.recovery,
        code: failure.code,
        recovered,
        invalidCode,
        unchanged,
        disposedCode,
      };
    } finally {
      session?.dispose();
      content.dispose();
    }
  });
  return JSON.stringify(results);
}
