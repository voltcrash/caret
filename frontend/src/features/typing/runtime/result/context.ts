import type { CompletedEvent } from "@caret/schemas/results";
import type { AnnotationOptions } from "chartjs-plugin-annotation";

import { createAppOwned } from "#app/application.ts";

type ResultContext = {
  result: CompletedEvent | undefined;
  annotations: AnnotationOptions<"line">[];
};

const context = createAppOwned<ResultContext>(() => ({
  result: undefined,
  annotations: [],
}));

/** The result on screen; set before any result rendering runs. */
export function currentResult(): CompletedEvent {
  const { result } = context();
  if (result === undefined) throw new Error("No result is shown");
  return result;
}

export function resultAnnotations(): AnnotationOptions<"line">[] {
  return context().annotations;
}

export function setCurrentResult(value: CompletedEvent): void {
  context().result = value;
}

export function resetResultAnnotations(): void {
  context().annotations = [];
}
