import type { Config } from "@caret/schemas/configs";
import type { Prepare } from "@caret/typing-engine/browser.client";
import { decodeText } from "@caret/typing-engine/text";
import { getBrowserEngine } from "./engine.client";
import { saveTypingPreview } from "./initial-snapshot.client";

/** Prepare the next reload without changing the live content/session. */
export function saveNextTypingPreview(
  config: Config,
  input: Prepare,
  key: string,
  engineHash: string,
): void {
  // Never leave a consumed preview behind if preparation fails or is unsupported.
  saveTypingPreview(config, 0, key, [], engineHash);
  if (!["time", "words"].includes(config.mode) || config.funbox.length !== 0) {
    return;
  }
  const content = getBrowserEngine().api().createContent();
  try {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    content.prepare({ ...input, random: { kind: "seeded", state: seed } });
    content.generate();
    const session = content.createSession();
    try {
      saveTypingPreview(
        config,
        seed,
        key,
        session.snapshot().words.map(decodeText),
        engineHash,
      );
    } finally {
      session.dispose();
    }
  } finally {
    content.dispose();
  }
}
