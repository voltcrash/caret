import { showKeymapKey } from "./test";

export function flash(key: string, correct?: boolean): void {
  showKeymapKey("flash", key, correct);
}

export function highlight(key: string): void {
  showKeymapKey("highlight", key);
}
