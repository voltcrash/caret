import "@tanstack/solid-start/server-only";
import { getRequestHeader } from "@tanstack/solid-start/server";
import { defaultInitialTyping } from "../features/typing/initial-default";
import {
  readTypingPreview,
  type InitialTypingSnapshot,
} from "../features/typing/initial-snapshot";

/** No authentication, database, asset fetch or runtime Wasm on the document path. */
export function initialTypingSnapshot(): InitialTypingSnapshot {
  const fallback = defaultInitialTyping();
  const cached = readTypingPreview(getRequestHeader("cookie") ?? "");
  return cached?.engineHash === fallback.engineHash ? cached : fallback;
}
