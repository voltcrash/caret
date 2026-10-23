import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { initSync } from "../../../packages/typing-engine/generated/engine.js";
import { BrowserSession } from "@oxytype/typing-engine/browser.client";
import { encodeText } from "@oxytype/typing-engine/text";
import { projectEngineConfig } from "@oxytype/typing-engine/config";

// Exercise the same generated/optimized Wasm and SDK used by the website.
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
