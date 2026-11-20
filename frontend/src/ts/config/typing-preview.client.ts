import type { Config } from "@caret/schemas/configs";
import {
  initialTypingCookie,
  previewSettings,
  readTypingPreview,
  type InitialTypingSnapshot,
} from "./typing-preview";

/** Presentation changes do not restart content generation. Save them immediately. */
export function refreshTypingPreviewSettings(config: Config): void {
  let cookie: string;
  try {
    cookie = document.cookie;
  } catch {
    return;
  }
  const previous = readTypingPreview(cookie);
  // A legacy cookie contains played words; preference sync cannot promote it.
  if (previous?.version !== 2) return;
  const appearance = Object.fromEntries(
    Object.entries(previewSettings(config)).filter(
      ([key]) =>
        ![
          "mode",
          "time",
          "words",
          "quoteLength",
          "punctuation",
          "numbers",
          "language",
        ].includes(key),
    ),
  );
  saveTypingPreview(
    ["time", "words"].includes(config.mode)
      ? { ...config, ...previous.settings, ...appearance }
      : config,
    previous.seed,
    previous.key,
    previous.words,
    previous.engineHash,
  );
}

/** Save an unplayed paragraph so the next document and engine show the same words. */
export function saveTypingPreview(
  config: Config,
  seed: number,
  key: string,
  words: string[],
  engineHash: string,
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
    version: 2,
    seed,
    key,
    engineHash,
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
