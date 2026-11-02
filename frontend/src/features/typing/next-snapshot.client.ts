import type { Config } from "@caret/schemas/configs";
import type { BrowserContent } from "@caret/typing-engine/browser.client";
import { decodeText } from "@caret/typing-engine/text";
import { saveTypingPreview } from "./initial-snapshot.client";

/** Prepare the next reload without changing the live content/session. */
export function saveNextTypingPreview(
  config: Config,
  content: Pick<BrowserContent, "preview">,
  key: string,
  engineHash: string,
): void {
  // Never leave a consumed preview behind if preparation fails or is unsupported.
  saveTypingPreview(config, 0, key, [], engineHash);
  if (!["time", "words"].includes(config.mode) || config.funbox.length !== 0) {
    return;
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  saveTypingPreview(
    config,
    seed,
    key,
    content.preview(seed).map(decodeText),
    engineHash,
  );
}
