import { createAppSignal } from "#app/state.ts";
import { CompletedEvent } from "@caret/schemas/results";

export const [getLastResult, setLastResult] = createAppSignal<Omit<
  CompletedEvent,
  "hash" | "uid"
> | null>(null);
