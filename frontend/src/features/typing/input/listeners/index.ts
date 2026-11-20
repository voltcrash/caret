import { bindCompositionListeners } from "./composition";
import { bindKeyListeners } from "./key";
import { bindInputListeners } from "./input";
import { bindMiscListeners } from "./misc";

export function bindInputListenersTo(element: HTMLTextAreaElement): void {
  bindCompositionListeners(element);
  bindKeyListeners(element);
  bindInputListeners(element);
  bindMiscListeners(element);
}
