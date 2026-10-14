import type { JSX } from "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      // Word letters are targeted by themes and funbox CSS.
      letter: JSX.HTMLAttributes<HTMLElement>;
    }
    interface ExplicitAttributes {
      // Word attributes are read by result-word highlight measurement.
      input: string;
      burst: string;
    }
  }
}
