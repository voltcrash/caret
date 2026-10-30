import "@tanstack/solid-start/server-only";
import { getRequestHeader } from "@tanstack/solid-start/server";
import type { LayoutObject } from "@caret/schemas/layouts";
import { defaultInitialTyping } from "../features/typing/initial-default";
import {
  readTypingPreview,
  type InitialTypingSnapshot,
} from "../features/typing/initial-snapshot";

// Build-time assets only. Never fetch layouts on the document request path.
const layouts = import.meta.glob<LayoutObject>("../../static/layouts/*.json", {
  eager: true,
  import: "default",
});

/** No authentication, database, asset fetch or runtime Wasm on the document path. */
export function initialTypingSnapshot(): InitialTypingSnapshot {
  const fallback = defaultInitialTyping();
  const cached = readTypingPreview(getRequestHeader("cookie") ?? "");
  const snapshot =
    cached?.engineHash === fallback.engineHash ? cached : fallback;
  const settings = snapshot.settings;
  if (settings.keymapMode !== "off") {
    const raw =
      settings.keymapLayout === "overrideSync"
        ? settings.layout
        : settings.keymapLayout;
    snapshot.keymapLayout =
      layouts[
        `../../static/layouts/${raw === "default" ? "qwerty" : raw}.json`
      ];
  }
  return snapshot;
}
