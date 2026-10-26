import init from "../../../packages/typing-engine/generated/engine.js";
import { BrowserSession } from "@caret/typing-engine/browser.client";
import { encodeText } from "@caret/typing-engine/text";
import { projectEngineConfig } from "@caret/typing-engine/config";

// Exercise the same generated/optimized Wasm and SDK used by the website.
await init({
  module_or_path: new URL(
    "../../../packages/typing-engine/generated/engine_bg.wasm",
    import.meta.url,
  ),
});
export function nativeSession(
  config: Parameters<typeof projectEngineConfig>[0],
  words: string[],
): BrowserSession {
  return new BrowserSession(projectEngineConfig(config), words.map(encodeText));
}
