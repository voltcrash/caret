import { JSXElement } from "solid-js";

import { cn } from "../../../utils/cn";
import { Balloon } from "../../common/Balloon";

export function Stat(props: {
  label: string;
  value: string;
  balloon: string;
  /** outside the human range */
  bad?: boolean;
  /** not wrong, just not enough data to judge */
  warn?: boolean;
}): JSXElement {
  return (
    <Balloon
      class="flex cursor-help gap-1"
      text={props.balloon}
      position="up"
      length="xlarge"
      break
    >
      <span class="text-sub underline decoration-sub decoration-dotted underline-offset-2">
        {props.label}
      </span>
      <span
        class={cn(
          props.bad === true
            ? "text-error"
            : props.warn === true
              ? "text-main"
              : "text-text",
        )}
      >
        {props.value}
      </span>
    </Balloon>
  );
}
