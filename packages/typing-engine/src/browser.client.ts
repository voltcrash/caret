import {
  initSync,
  binding_version,
  analyze,
  policy as rawPolicy,
  WasmSession,
  WasmContent,
  WasmReplay,
} from "../generated/engine.js";
import wasmUrl from "../generated/engine_bg.wasm?url";
import type { Command } from "../generated/types/Command";
import type { Config } from "../generated/types/Config";
import type { Text } from "../generated/types/Text";
import type { Update } from "../generated/types/Update";

import type { Prepare } from "../generated/types/Prepare";
import type { Generated } from "../generated/types/Generated";
import type { NextWord } from "../generated/types/NextWord";
import type { Quote } from "../generated/types/Quote";
import type { Query } from "../generated/types/Query";
import type { Response } from "../generated/types/Response";
import type { Request as ContentRequest } from "../generated/types/Request";
import type { Source } from "../generated/types/Source";
import type { Preflight } from "../generated/types/Preflight";
import type { InsertionLayout } from "../generated/types/InsertionLayout";
import type { Snapshot } from "../generated/types/Snapshot";
import type { RestartOptions } from "../generated/types/RestartOptions";
import type { RestartDecision } from "../generated/types/RestartDecision";
import type { PaceCommand } from "../generated/types/PaceCommand";
import type { PaceUpdate } from "../generated/types/PaceUpdate";
import type { PlaybackSnapshot } from "../generated/types/PlaybackSnapshot";
import type { PlaybackUpdate } from "../generated/types/PlaybackUpdate";
import type { Cursor } from "../generated/types/Cursor";
import type { Log } from "../generated/types/Log";
export type {
  Query,
  Response,
  RestartOptions,
  RestartDecision,
  PaceCommand,
  PaceUpdate,
  PlaybackSnapshot,
  PlaybackUpdate,
  Cursor,
  Log,
  Snapshot,
  Preflight,
  InsertionLayout,
  ContentRequest,
  Source,
};

export type {
  Command,
  Config,
  Text,
  Update,
  Prepare,
  Generated,
  NextWord,
  Quote,
};
import { EngineFailure, disposed, invoke } from "./failure";
export { EngineFailure } from "./failure";
export type { EngineError, ErrorCode, Recovery } from "./failure";
import type { LiveMetrics } from "../generated/types/LiveMetrics";
export type { LiveMetrics };
import type { PolicyQuery } from "../generated/types/PolicyQuery";
import type { PolicyResponse } from "../generated/types/PolicyResponse";
export type { PolicyQuery, PolicyResponse };
import type { Random } from "../generated/types/Random";
export type { Random };
const BINDING_VERSION = 1;

export { encodeText, decodeText, toEngineLog, toWebLog } from "./text";
import { encodeText } from "./text";

/** Module preparation is async; all prepared session commands are synchronous. */
export async function loadEngine(signal?: AbortSignal): Promise<{
  createSession: (config: Partial<Config>, words: Text[]) => BrowserSession;
  memoryBytes: () => number;
  createContent: () => BrowserContent;
  createReplay: (log: Log, zen: boolean) => BrowserReplay;
  policy: typeof evaluatePolicy;
}> {
  // Compile asynchronously, then use wasm-bindgen's synchronous guard. Two
  // concurrent async initializers could otherwise replace memory under handles.
  signal?.throwIfAborted();
  const response = await fetch(wasmUrl, { signal });
  if (!response.ok) {
    throw new Error(`Typing engine download failed: ${response.status}`);
  }
  const compiled =
    typeof WebAssembly.compileStreaming === "function"
      ? await WebAssembly.compileStreaming(response)
      : await WebAssembly.compile(await response.arrayBuffer());
  signal?.throwIfAborted();
  const module = initSync({ module: compiled });
  if (binding_version() !== BINDING_VERSION) {
    throw new EngineFailure({
      code: "bindingMismatch",
      message: "Typing engine binding version mismatch",
      recovery: [],
    });
  }
  return {
    createSession: (config, words) => new BrowserSession(config, words),
    memoryBytes: () => module.memory.buffer.byteLength,
    createContent: () => new BrowserContent(),
    createReplay: (log, zen) => new BrowserReplay(log, zen),
    policy: evaluatePolicy,
  };
}

export function evaluatePolicy<Q extends PolicyQuery>(
  query: Q,
): Extract<PolicyResponse, { op: Q["op"] }> {
  return invoke(
    () =>
      JSON.parse(rawPolicy(JSON.stringify(query))) as Extract<
        PolicyResponse,
        { op: Q["op"] }
      >,
  );
}

export type Engine = Awaited<ReturnType<typeof loadEngine>>;

/** The caller owns this resource and must dispose it with its app/route owner. */
export function createEngineLoader(): {
  load: () => Promise<Engine>;
  dispose: () => void;
} {
  const controller = new AbortController();
  let pending: Promise<Engine> | undefined;
  let released = false;
  return {
    // oxlint-disable-next-line typescript/promise-function-async -- Owners share the exact pending promise.
    load: () => {
      if (released) {
        return Promise.reject(disposed("Typing engine loader disposed"));
      }
      pending ??= loadEngine(controller.signal).catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
      return pending;
    },
    dispose: () => {
      if (released) return;
      released = true;
      controller.abort();
      pending = undefined;
    },
  };
}

export class BrowserSession {
  private handle: WasmSession | undefined;
  constructor(config: Partial<Config>, words: Text[], handle?: WasmSession) {
    this.handle =
      handle ??
      invoke(
        () =>
          new WasmSession(
            JSON.stringify(config),
            JSON.stringify(words),
            BINDING_VERSION,
          ),
      );
  }
  private live(): WasmSession {
    if (this.handle === undefined) {
      throw disposed("Typing engine session disposed");
    }
    return this.handle;
  }
  command(command: Command): Update {
    return invoke(
      () => JSON.parse(this.live().command(JSON.stringify(command))) as Update,
    );
  }
  restartPolicy(options: Partial<RestartOptions> = {}): RestartDecision {
    return invoke(
      () =>
        JSON.parse(
          this.live().restart_policy(JSON.stringify(options)),
        ) as RestartDecision,
    );
  }
  pace(command: PaceCommand): PaceUpdate {
    return invoke(
      () => JSON.parse(this.live().pace(JSON.stringify(command))) as PaceUpdate,
    );
  }
  /** @internal Ownership transfer used by the app's content resource. */
  recycleTo(content: WasmContent): void {
    invoke(() => content.recycle_session(this.live()));
    this.dispose();
  }
  preflight(data: Text, layout: Partial<InsertionLayout> = {}): Preflight {
    return invoke(
      () =>
        JSON.parse(
          this.live().preflight(JSON.stringify(data), JSON.stringify(layout)),
        ) as Preflight,
    );
  }
  liveStats(now: number): LiveMetrics {
    return invoke(() => JSON.parse(this.live().live_stats(now)) as LiveMetrics);
  }
  snapshot(): Snapshot {
    return invoke(() => JSON.parse(this.live().snapshot()) as Snapshot);
  }
  log(): Log {
    return invoke(() => JSON.parse(this.live().log()) as Log);
  }
  dispose(): void {
    const handle = this.handle;
    if (handle === undefined) return;
    this.handle = undefined;
    invoke(() => {
      handle.dispose();
      handle.free();
    });
  }
}

/** Selected synchronous JSON boundary; prior object-control measurements are archived. */
export function benchmarkBoundary(): { jsonMs: number[] } {
  const jsonMs: number[] = [];
  const config: Partial<Config> = { mode: "words", words: 0 };
  const words = Array.from({ length: 101 }, () => encodeText("a "));
  for (let sample = 0; sample < 60; sample++) {
    const session = new BrowserSession(config, words);
    try {
      const start = performance.now();
      for (let index = 0; index < 100; index++) {
        const update = session.command({
          op: "insert",
          data: [97, 32],
          now: index * 100,
          date: 0,
          automatic: null,
          isCompositionEnding: null,
          correctShiftUsed: null,
        });
        if (update.state.wordIndex !== index + 1) {
          throw new Error("Boundary benchmark lost progress");
        }
      }
      if (sample >= 10) jsonMs.push((performance.now() - start) / 200);
    } finally {
      session.dispose();
    }
  }
  return { jsonMs };
}

export class BrowserContent {
  private handle: WasmContent | undefined = invoke(
    () => new WasmContent(BINDING_VERSION),
  );
  private live(): WasmContent {
    if (this.handle === undefined) {
      throw disposed("Typing engine content disposed");
    }
    return this.handle;
  }
  recycleSession(session: BrowserSession): void {
    session.recycleTo(this.live());
  }
  prepare(input: Prepare, repeating = false): void {
    invoke(() => this.live().prepare(JSON.stringify(input), repeating));
  }
  updateQuoteQueue(lengths: number[], random: Random): Random {
    return invoke(
      () =>
        JSON.parse(
          this.live().update_quote_queue(
            JSON.stringify(lengths),
            JSON.stringify(random),
          ),
        ) as Random,
    );
  }
  configure(config: Config): void {
    invoke(() => this.live().configure(JSON.stringify(config)));
  }
  generate(repeating = false): Generated {
    return invoke(
      () => JSON.parse(this.live().generate(repeating)) as Generated,
    );
  }
  next(
    index: number,
    bound: number,
    previous: Text | null,
    previous2: Text | null,
  ): NextWord {
    return invoke(
      () =>
        JSON.parse(
          this.live().next(
            index,
            bound,
            JSON.stringify(previous),
            JSON.stringify(previous2),
          ),
        ) as NextWord,
    );
  }
  request(): ContentRequest | null {
    return invoke(
      () => JSON.parse(this.live().request()) as ContentRequest | null,
    );
  }
  supply(request: ContentRequest, source: Source): void {
    invoke(() =>
      this.live().supply(JSON.stringify(request), JSON.stringify(source)),
    );
  }
  failSource(request: ContentRequest): never {
    invoke(() => this.live().fail_source(JSON.stringify(request)));
    throw new Error("Expected content failure");
  }
  createSession(repeating = false): BrowserSession {
    return new BrowserSession(
      {},
      [],
      invoke(() => this.live().session(repeating)),
    );
  }
  metadata(): { allWordsGenerated: boolean; currentQuote: Quote | null } {
    return invoke(
      () =>
        JSON.parse(this.live().metadata()) as {
          allWordsGenerated: boolean;
          currentQuote: Quote | null;
        },
    );
  }
  dispose(): void {
    const handle = this.handle;
    if (handle === undefined) return;
    this.handle = undefined;
    invoke(() => {
      handle.dispose();
      handle.free();
    });
  }
}

/** Derivation only: transport IDs, hashes and network policy stay with the host. */
export function analyzeLog<Q extends Query>(
  log: Log,
  query: Q,
): Extract<Response, { op: Q["op"] }> {
  return invoke(
    () =>
      JSON.parse(
        analyze(JSON.stringify(log), JSON.stringify(query)),
      ) as Extract<Response, { op: Q["op"] }>,
  );
}

/** Persistent playback: scheduling/audio/DOM belong to the host. */
export class BrowserReplay {
  private handle: WasmReplay | undefined;
  constructor(log: Log, zen: boolean) {
    this.handle = invoke(
      () => new WasmReplay(JSON.stringify(log), zen, BINDING_VERSION),
    );
  }
  private live(): WasmReplay {
    if (this.handle === undefined) {
      throw disposed("Typing engine replay disposed");
    }
    return this.handle;
  }
  snapshot(): PlaybackSnapshot {
    return invoke(() => JSON.parse(this.live().snapshot()) as PlaybackSnapshot);
  }
  step(): PlaybackUpdate {
    return invoke(() => JSON.parse(this.live().step()) as PlaybackUpdate);
  }
  seek(cursor: Cursor): PlaybackSnapshot {
    return invoke(
      () =>
        JSON.parse(
          this.live().seek(JSON.stringify(cursor)),
        ) as PlaybackSnapshot,
    );
  }
  dispose(): void {
    const handle = this.handle;
    if (handle === undefined) return;
    this.handle = undefined;
    invoke(() => {
      handle.dispose();
      handle.free();
    });
  }
}
