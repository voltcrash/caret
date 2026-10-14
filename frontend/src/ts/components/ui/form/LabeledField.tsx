import { createMemo, JSXElement, Show } from "solid-js";

import { cn } from "../../../utils/cn";
import { FieldLabelContext } from "./field-label";

export function LabeledField(props: {
  label: string;
  subLabel?: string;
  id?: string;
  children: JSXElement;
  class?: string;
}): JSXElement {
  const label = createMemo(() => props.label);
  return (
    <FieldLabelContext.Provider value={label}>
      <label for={props.id} class={cn("grid gap-1", props.class)}>
        <span class="text-text lowercase">{props.label}</span>
        <Show when={props.subLabel}>
          <span class="mb-1 text-em-xs text-text/70">{props.subLabel}</span>
        </Show>
        {props.children}
      </label>
    </FieldLabelContext.Provider>
  );
}
