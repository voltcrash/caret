import type { CompletedEvent } from "@caret/schemas/results";
import type { AnnotationOptions } from "chartjs-plugin-annotation";

export let result: CompletedEvent;
export let resultAnnotation: AnnotationOptions<"line">[] = [];

export function setCurrentResult(value: CompletedEvent): void {
  result = value;
}
export function resetResultAnnotations(): void {
  resultAnnotation = [];
}
