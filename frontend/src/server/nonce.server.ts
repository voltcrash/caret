import "@tanstack/solid-start/server-only";
import { runtime } from "@caret/backend/runtime";

export function requestNonce(): string | undefined {
  return runtime().request?.nonce;
}
