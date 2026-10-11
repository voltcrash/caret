import { isCoarsePointer } from "./pointer";

// touch has no command palette shortcut, it has the end test button instead
export function getBailOutHint(): string {
  return isCoarsePointer()
    ? "Tap end test under the words to save your result."
    : "Make sure to use Bail Out from the command palette to save your result.";
}
