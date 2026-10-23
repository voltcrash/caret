import {
  initSync,
  binding_version,
  analyze,
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
import type { PaceCommand } from "../generated/types/PaceCommand";
import type { PaceUpdate } from "../generated/types/PaceUpdate";
import type { PlaybackSnapshot } from "../generated/types/PlaybackSnapshot";
import type { PlaybackUpdate } from "../generated/types/PlaybackUpdate";
import type { Cursor } from "../generated/types/Cursor";
import type { Log } from "../generated/types/Log";
export type {
  Query,
  Response,
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
const BINDING_VERSION = 1;

export function encodeText(value: string): Text {
  return Array.from({ length: value.length }, (_, index) =>
    value.charCodeAt(index),
  );
}
export function decodeText(units: Text): string {
  let value = "";
  for (let i = 0; i < units.length; i += 4096) {
    value += String.fromCharCode(...units.slice(i, i + 4096));
  }
  return value;
}

/** Module preparation is async; all prepared session commands are synchronous. */
export async function loadEngine(signal?: AbortSignal): Promise<{
  createSession: (config: Partial<Config>, words: Text[]) => BrowserSession;
  memoryBytes: () => number;
  createContent: () => BrowserContent;
  createReplay: (log: Log, zen: boolean) => BrowserReplay;
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
    throw new Error("Typing engine binding version mismatch");
  }
  return {
    createSession: (config, words) => new BrowserSession(config, words),
    memoryBytes: () => module.memory.buffer.byteLength,
    createContent: () => new BrowserContent(),
    createReplay: (log, zen) => new BrowserReplay(log, zen),
  };
}

export type Engine = Awaited<ReturnType<typeof loadEngine>>;

/** The caller owns this resource and must dispose it with its app/route owner. */
export function createEngineLoader(): {
  load: () => Promise<Engine>;
  dispose: () => void;
} {
  const controller = new AbortController();
  let pending: Promise<Engine> | undefined;
  let disposed = false;
  return {
    // oxlint-disable-next-line typescript/promise-function-async -- Owners share the exact pending promise.
    load: () => {
      if (disposed) {
        return Promise.reject(new Error("Typing engine loader disposed"));
      }
      pending ??= loadEngine(controller.signal).catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
      return pending;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
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
      new WasmSession(
        JSON.stringify(config),
        JSON.stringify(words),
        BINDING_VERSION,
      );
  }
  command(command: Command): Update {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    return JSON.parse(this.handle.command(JSON.stringify(command))) as Update;
  }
  pace(command: PaceCommand): PaceUpdate {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    return JSON.parse(this.handle.pace(JSON.stringify(command))) as PaceUpdate;
  }
  /** @internal Ownership transfer used by the app's content resource. */
  recycleTo(content: WasmContent): void {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    content.recycle_session(this.handle);
    this.dispose();
  }
  preflight(data: Text, layout: Partial<InsertionLayout> = {}): Preflight {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    return JSON.parse(
      this.handle.preflight(JSON.stringify(data), JSON.stringify(layout)),
    ) as Preflight;
  }
  snapshot(): Snapshot {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    return JSON.parse(this.handle.snapshot()) as Snapshot;
  }
  log(): unknown {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    return JSON.parse(this.handle.log()) as unknown;
  }
  commandObject(command: Command): Update {
    if (this.handle === undefined) {
      throw new Error("Typing engine session disposed");
    }
    return this.handle.command_value(command) as Update;
  }
  dispose(): void {
    const handle = this.handle;
    if (handle === undefined) return;
    this.handle = undefined;
    handle.dispose();
    handle.free();
  }
}

/** Compare incremental object conversion with a JSON boundary, same core. */
export function benchmarkBoundary(): { jsonMs: number[]; objectMs: number[] } {
  const jsonMs: number[] = [];
  const objectMs: number[] = [];
  const config: Partial<Config> = { mode: "words", words: 0 };
  const words = Array.from({ length: 101 }, () => encodeText("a "));
  for (let sample = 0; sample < 60; sample++) {
    for (const [object, measurements] of [
      [false, jsonMs],
      [true, objectMs],
    ] as const) {
      const session = new BrowserSession(config, words);
      try {
        const start = performance.now();
        for (let index = 0; index < 100; index++) {
          const command: Command = {
            op: "insert",
            data: [97, 32],
            now: index * 100,
            date: 0,
            automatic: null,
            isCompositionEnding: null,
            correctShiftUsed: null,
          };
          const update = object
            ? session.commandObject(command)
            : session.command(command);
          if (update.state.wordIndex !== index + 1) {
            throw new Error("Boundary benchmark lost progress");
          }
        }
        if (sample >= 10) measurements.push((performance.now() - start) / 200);
      } finally {
        session.dispose();
      }
    }
  }
  return { jsonMs, objectMs };
}

export class BrowserContent {
  private handle: WasmContent | undefined = new WasmContent(BINDING_VERSION);
  private live(): WasmContent {
    if (this.handle === undefined) {
      throw new Error("Typing engine content disposed");
    }
    return this.handle;
  }
  recycleSession(session: BrowserSession): void {
    session.recycleTo(this.live());
  }
  prepare(input: Prepare, repeating = false): void {
    this.live().prepare(JSON.stringify(input), repeating);
  }
  generate(repeating = false): Generated {
    return JSON.parse(this.live().generate(repeating)) as Generated;
  }
  next(
    index: number,
    bound: number,
    previous: Text | null,
    previous2: Text | null,
  ): NextWord {
    return JSON.parse(
      this.live().next(
        index,
        bound,
        JSON.stringify(previous),
        JSON.stringify(previous2),
      ),
    ) as NextWord;
  }
  request(): ContentRequest | null {
    return JSON.parse(this.live().request()) as ContentRequest | null;
  }
  supply(request: ContentRequest, source: Source): void {
    this.live().supply(JSON.stringify(request), JSON.stringify(source));
  }
  createSession(repeating = false): BrowserSession {
    return new BrowserSession({}, [], this.live().session(repeating));
  }
  metadata(): { allWordsGenerated: boolean; currentQuote: Quote | null } {
    return JSON.parse(this.live().metadata()) as {
      allWordsGenerated: boolean;
      currentQuote: Quote | null;
    };
  }
  dispose(): void {
    const handle = this.handle;
    if (handle === undefined) return;
    this.handle = undefined;
    handle.dispose();
    handle.free();
  }
}

/** Derivation only: transport IDs, hashes and network policy stay with the host. */
export function analyzeLog<Q extends Query>(
  log: Log,
  query: Q,
): Extract<Response, { op: Q["op"] }> {
  return JSON.parse(
    analyze(JSON.stringify(log), JSON.stringify(query)),
  ) as Extract<Response, { op: Q["op"] }>;
}

/** Persistent playback: scheduling/audio/DOM belong to the host. */
export class BrowserReplay {
  private handle: WasmReplay | undefined;
  constructor(log: Log, zen: boolean) {
    this.handle = new WasmReplay(JSON.stringify(log), zen, BINDING_VERSION);
  }
  private live(): WasmReplay {
    if (this.handle === undefined) {
      throw new Error("Typing engine replay disposed");
    }
    return this.handle;
  }
  snapshot(): PlaybackSnapshot {
    return JSON.parse(this.live().snapshot()) as PlaybackSnapshot;
  }
  step(): PlaybackUpdate {
    return JSON.parse(this.live().step()) as PlaybackUpdate;
  }
  seek(cursor: Cursor): PlaybackSnapshot {
    return JSON.parse(
      this.live().seek(JSON.stringify(cursor)),
    ) as PlaybackSnapshot;
  }
  dispose(): void {
    const handle = this.handle;
    if (handle === undefined) return;
    this.handle = undefined;
    handle.dispose();
    handle.free();
  }
}
