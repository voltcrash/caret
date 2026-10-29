import { createAppOwned } from "../../app/application";
import { projectEngineConfig } from "@caret/typing-engine/config";
import type { Config } from "@caret/schemas/configs";
import {
  initialTypingCookie,
  previewSettings,
  type InitialTypingSnapshot,
} from "./initial-snapshot";

export const initialTypingState = createAppOwned(() => {
  let initial: InitialTypingSnapshot | undefined;
  let consumed = false;
  return {
    initialize: (value: InitialTypingSnapshot) => {
      initial = value;
      consumed = false;
    },
    seed: (key: string): number | undefined => {
      if (consumed || initial?.key !== key) return undefined;
      consumed = true;
      return initial.seed;
    },
    engineHash: () => initial?.engineHash ?? "",
  };
});

export async function initialContentKey(
  config: Config,
  languageHash: string,
  engineHash: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify([engineHash, languageHash, projectEngineConfig(config)]),
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Keep the next document's actual first wordset beside its visual preferences. */
export function saveTypingPreview(
  config: Config,
  seed: number,
  key: string,
  words: string[],
): void {
  // Local/custom text and adaptive/provider content must not be sent in cookies.
  if (
    !["time", "words"].includes(config.mode) ||
    config.funbox.length !== 0 ||
    words.length === 0
  ) {
    writePreviewCookie(
      `${initialTypingCookie}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
    return;
  }
  const preview: InitialTypingSnapshot = {
    version: 1,
    seed,
    key,
    engineHash: initialTypingState().engineHash(),
    settings: previewSettings(config),
    words: words.slice(0, 60),
  };
  let value = encodeURIComponent(JSON.stringify(preview));
  while (value.length > 3800 && preview.words.length > 1) {
    preview.words.pop();
    value = encodeURIComponent(JSON.stringify(preview));
  }
  if (value.length > 3800) return;
  writePreviewCookie(
    `${initialTypingCookie}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`,
  );
}

function writePreviewCookie(value: string): void {
  try {
    document.cookie = value;
  } catch {
    // Disabled cookie storage must not prevent the real test from starting.
  }
}
