import { createComponent, createRoot } from "solid-js";
import { Fa, FaProps } from "../../../../ts/components/common/Fa";

const prototypes = new Map<string, HTMLElement>();

// These icons are static word content. Clone an owned Fa instance rather than
// creating reactive computations for each letter of a long test.
export function createWordIcon(props: FaProps): HTMLElement {
  const key = `${props.icon}:${props.fixedWidth ?? false}:${props.class ?? ""}`;
  let prototype = prototypes.get(key);
  if (prototype === undefined) {
    prototype = createRoot((dispose) => {
      const node = createComponent(Fa, props);
      dispose();
      if (!(node instanceof HTMLElement)) {
        throw new Error("Fa must render an icon element");
      }
      return node;
    });
    prototypes.set(key, prototype);
  }
  return prototype.cloneNode(true) as HTMLElement;
}
