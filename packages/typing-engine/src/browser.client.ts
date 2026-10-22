import initialize, {
  binding_version,
  analyze,
  WasmSession,
  WasmContent,
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
import type { Log } from "../generated/types/Log";
export type { Query, Response, Log };

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
export async function loadEngine(): Promise<{
  createSession: (config: Partial<Config>, words: Text[]) => BrowserSession;
  memoryBytes: () => number;
  createContent: () => BrowserContent;
}> {
  const module = await initialize({ module_or_path: wasmUrl });
  if (binding_version() !== BINDING_VERSION) {
    throw new Error("Typing engine binding version mismatch");
  }
  return {
    createSession: (config, words) => new BrowserSession(config, words),
    memoryBytes: () => module.memory.buffer.byteLength,
    createContent: () => new BrowserContent(),
  };
}

export class BrowserSession {
  private handle: WasmSession | undefined;

  constructor(config: Partial<Config>, words: Text[]) {
    this.handle = new WasmSession(
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
  prepare(input: Prepare): void {
    this.live().prepare(JSON.stringify(input));
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
