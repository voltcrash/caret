import "@tanstack/solid-start/server-only";
import { runtime } from "@oxytype/backend/runtime";

export function requestNonce(): string | undefined {
  return runtime().request?.nonce;
}
