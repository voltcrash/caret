import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initSync } from "../../../packages/typing-engine/generated/engine.js";
import { BrowserSession } from "@caret/typing-engine/browser.client";
import { encodeText } from "@caret/typing-engine/text";
import { projectEngineConfig } from "@caret/typing-engine/config";

// Contract tests combine the client Wasm SDK with Node-only server validation.
initSync({
  module: readFileSync(
    resolve(
      import.meta.dirname,
      "../../../packages/typing-engine/generated/engine_bg.wasm",
    ),
  ),
});

export function nativeSession(
  config: Parameters<typeof projectEngineConfig>[0],
  words: string[],
): BrowserSession {
  return new BrowserSession(projectEngineConfig(config), words.map(encodeText));
}
