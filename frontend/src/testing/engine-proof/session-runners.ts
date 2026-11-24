import type {
  BrowserSession,
  Command,
  Config,
  ContentRequest,
  Prepare,
  Source,
  Text,
  Update,
} from "@caret/typing-engine/browser.client";

import type { ProofRunnerContext } from "./types";

export async function runFixtureProof(
  ctx: ProofRunnerContext,
): Promise<string | undefined> {
  try {
    const input = JSON.parse(ctx.fixture) as {
      name: string;
      config: Partial<Config>;
      words: Text[];
      commands: Command[];
    };
    const started = performance.now();
    const { loadEngine, benchmarkBoundary, encodeText } =
      await import("@caret/typing-engine/browser.client");
    const engine = await loadEngine();
    if (ctx.isDisposed()) return undefined;
    const initializationMs = performance.now() - started;
    const typingSession = ctx.replaceTypingSession(() =>
      engine.createSession({ mode: "words", words: 2 }, [
        encodeText("one "),
        encodeText("two"),
      ]),
    );
    ctx.handles.add(typingSession);
    ctx.resetSlice();
    const session = engine.createSession(input.config, input.words);
    const isolated = engine.createSession(input.config, input.words);
    ctx.handles.add(session);
    ctx.handles.add(isolated);
    const untouched = JSON.stringify(isolated.log());
    const frames = input.commands.map((command) => ({
      state: session.command(command).state,
      log: session.log(),
    }));
    if (untouched !== JSON.stringify(isolated.log())) {
      throw new Error("Session isolation failed");
    }
    session.dispose();
    session.dispose();
    let staleRejected = false;
    try {
      session.log();
    } catch {
      staleRejected = true;
    }
    if (!staleRejected) throw new Error("Stale session accepted");
    isolated.dispose();
    ctx.handles.delete(session);
    ctx.handles.delete(isolated);
    const recreated = engine.createSession(input.config, input.words);
    recreated.dispose();
    ctx.setBenchmark(
      JSON.stringify({
        initializationMs,
        ...benchmarkBoundary(),
        memoryBytes: engine.memoryBytes(),
      }),
    );
    return JSON.stringify({ name: input.name, frames });
  } catch (error) {
    for (const handle of ctx.handles) handle.dispose();
    ctx.handles.clear();
    throw error;
  }
}

export async function runLoadingProof(
  isDisposed: () => boolean,
  loaders: Set<{ dispose: () => void }>,
): Promise<string | undefined> {
  const { createEngineLoader, loadEngine, encodeText } =
    await import("@caret/typing-engine/browser.client");
  const loader = createEngineLoader();
  const sessions: BrowserSession[] = [];
  loaders.add(loader);
  try {
    let recovered = false;
    try {
      await loader.load();
    } catch {
      recovered = true;
    }
    const first = loader.load();
    const shared = first === loader.load();
    await Promise.all(
      [first, ...Array.from({ length: 4 }, async () => loadEngine())].map(
        async (ready) => {
          const engine = await ready;
          if (isDisposed()) return;
          const session = engine.createSession({ mode: "words", words: 0 }, [
            encodeText("one "),
          ]);
          sessions.push(session);
          session.command({
            op: "insert",
            data: encodeText("o"),
            now: 0,
            date: 0,
            automatic: null,
            isCompositionEnding: null,
            correctShiftUsed: null,
          });
        },
      ),
    );
    const intact =
      sessions.length === 5 &&
      sessions.every(
        (session) =>
          JSON.stringify(session.snapshot().state.inputValue) === "[111]",
      );
    loader.dispose();
    let rejected = false;
    try {
      await loader.load();
    } catch {
      rejected = true;
    }
    if (isDisposed()) return undefined;
    return JSON.stringify({ recovered, shared, intact, rejected });
  } finally {
    for (const session of sessions) session.dispose();
    loader.dispose();
    loaders.delete(loader);
  }
}

export async function runInitializationProof(
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const started = performance.now();
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const session = engine.createSession({ mode: "words", words: 1 }, [[97]]);
  try {
    const update = session.command({
      op: "insert",
      data: [97],
      now: 0,
      date: 0,
      automatic: null,
      correctShiftUsed: null,
      isCompositionEnding: null,
    });
    if (!update.state.ended) {
      throw new Error("Initialization did not produce a usable engine");
    }
    return JSON.stringify({
      initializationMs: performance.now() - started,
      memory: engine.memoryBytes(),
    });
  } finally {
    session.dispose();
  }
}

export async function runLifecycleProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const { runEngineLifecycle } = await import("../engine-lifecycle.client");
  const options =
    fixture === "" ? {} : (JSON.parse(fixture) as { words?: number });
  const output = await runEngineLifecycle(() => !isDisposed(), options.words);
  if (isDisposed()) return undefined;
  return JSON.stringify(output);
}

export async function runPreparedProof(
  fixture: string,
  isDisposed: () => boolean,
  handles: Set<BrowserSession>,
): Promise<string | undefined> {
  const input = JSON.parse(fixture) as {
    prepare: Prepare;
    initialReplies: Source[];
    steps: (
      | { command: Command }
      | { source: Source; now: number; date: number }
    )[];
  };
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const content = engine.createContent();
  let session: BrowserSession | undefined;
  try {
    content.prepare(input.prepare);
    const requests: ContentRequest[] = [];
    for (let reply = 0; reply <= input.initialReplies.length; reply++) {
      try {
        session = content.createSession();
        break;
      } catch (error) {
        const request = content.request();
        const source = input.initialReplies[reply];
        if (request === null || source === undefined) throw error;
        requests.push(request);
        content.supply(request, source);
      }
    }
    if (session === undefined) {
      throw new Error("Prepared session unavailable");
    }
    handles.add(session);
    const updates: Update[] = [];
    for (const step of input.steps) {
      if ("command" in step) {
        updates.push(session.command(step.command));
      } else {
        const request = updates.at(-1)?.contentRequest;
        if (request === undefined) {
          throw new Error("Missing active content request");
        }
        updates.push(
          session.command({
            op: "supplyContent",
            request,
            source: step.source,
            now: step.now,
            date: step.date,
          }),
        );
      }
    }
    return JSON.stringify({
      requests,
      updates,
      snapshot: session.snapshot(),
      log: session.log(),
    });
  } finally {
    if (session !== undefined) {
      session.dispose();
      handles.delete(session);
    }
    content.dispose();
  }
}
